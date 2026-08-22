import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { FormValues } from '@/components/form/types';
import { showFamily, showHousehold, showResident, type FullRecord } from '@/lib/api';
import { getCache, putCache, recordCacheKey } from '@/lib/db';
import { findByRecord, get, type OutboxType } from '@/lib/outbox';

const SHOW = {
  resident: showResident,
  household: showHousehold,
  family: showFamily,
} as const;

export type RecordFormMode =
  /** Bagong tala. */
  | 'create'
  /** Pagbabago ng umiiral nang tala sa server. */
  | 'edit'
  /** Muling pagbukas ng talang hindi tinanggap o hindi pa naipapadala. */
  | 'fix';

/**
 * Hinahawakan ang pinagmulan ng laman ng isang registration form.
 *
 * Tatlong pinto ang papasok dito, at magkaiba ang pinanggagalingan ng laman:
 *
 *  • BAGONG TALA — walang parameter. Bagong uuid na iisa sa buong buhay ng
 *    screen, kaya kung natimeout ang unang padala at inulit, kikilalanin ito
 *    ng server bilang parehong tala at hindi magdodoble.
 *
 *  • PAG-EDIT — `?id=<record>`. Kinukuha ang buong tala sa server at
 *    itinatabi; kapag walang signal, ang naka-tabi ang ginagamit. Dala rin
 *    ang `updated_at` — iyon ang bersyon na ipapadala pabalik, kaya
 *    matutukoy ng server kung may ibang nakaunang magpalit.
 *
 *  • PAG-AAYOS — `?draft=<uuid>`. Ang naka-queue na sagot ang ibinabalik, at
 *    GINAGAMIT ANG PAREHONG UUID. Kung may kasama itong `record_id`, pag-edit
 *    pala ang naka-queue — kaya kinukuha rin ang tala para sariwa ang bersyon.
 */
export function useRecordForm(type: OutboxType) {
  const params = useLocalSearchParams<{
    draft?: string;
    id?: string;
    edit?: string;
    step?: string;
  }>();

  const draftUuid = typeof params.draft === 'string' ? params.draft : null;
  const wantsEdit = params.edit === '1';
  const paramId = typeof params.id === 'string' ? Number(params.id) : NaN;
  const routeRecordId = Number.isFinite(paramId) && paramId > 0 ? paramId : null;

  const freshUuid = useMemo(() => randomUUID(), []);

  /** Uuid ng naka-queue nang pagbabago para sa parehong tala, kung meron. */
  const [queuedUuid, setQueuedUuid] = useState<string | null>(null);

  const [draftValues, setDraftValues] = useState<FormValues | null>(null);
  const [record, setRecord] = useState<FullRecord | null>(null);
  const [recordId, setRecordId] = useState<number | null>(routeRecordId);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!!draftUuid || !!routeRecordId);
  /** Pinapalitan sa bawat "Try again" para muling tumakbo ang effect. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    if (!draftUuid && !routeRecordId) return;

    // Ang paglilinis ng estado ay nasa `reload` at nasa paunang halaga ng
    // useState — hindi rito. Ang setState sa katawan mismo ng effect ay
    // nagdudulot ng dagdag na render bago pa makapagpakita ng kahit ano.
    void (async () => {
      let targetId = routeRecordId;

      // ── Ang naka-queue na sagot ────────────────────────────────────
      //
      // Kapag walang tinukoy na draft, hinahanap pa rin kung may naghihintay
      // nang pagbabago para sa talang binubuksan. Tingnan ang paliwanag sa
      // findByRecord: kung hindi, dalawang beses maie-encode ang parehong
      // pagwawasto at dalawang padala ang lalabas para sa iisang tala.
      const item = draftUuid
        ? await get(draftUuid).catch(() => null)
        : routeRecordId
          ? await findByRecord(type, routeRecordId)
          : null;

      if (!active) return;

      if (item) {
        setDraftValues(item.formValues as FormValues);
        setExpectedUpdatedAt(item.expectedUpdatedAt);
        setQueuedUuid(item.uuid);

        if (item.recordId) {
          targetId = item.recordId;
          setRecordId(item.recordId);
        }
      }

      // ── Ang tala mismo ────────────────────────────────────────────
      if (targetId) {
        const key = recordCacheKey(type, targetId);

        /*
          NANANAIG ANG BERSYONG DALA NG NAKA-QUEUE NA PAGBABAGO.

          Kung papalitan ito ng sariwang `updated_at` mula sa server, mawawala
          ang buong silbi ng pagtukoy ng banggaan: ang taong nag-edit kahapon
          habang walang signal ay tatabunan ang pagbabagong ginawa ng iba
          kaninang umaga, at walang sinuman ang makakaalam. Ang tamang bersyon
          na ihahambing ay ang nakita ng user NANG SIMULAN NIYA ANG PAG-EDIT.
        */
        const keepVersion = !!item?.expectedUpdatedAt;

        /*
          NAKA-TABI MUNA, SAKA ANG SERVER — at hindi kabaligtaran.

          Dati, hinihintay muna ang sagot ng server bago tingnan ang naka-tabi.
          Kapag walang signal, ang buong labinlimang segundo ng timeout ang
          hinihintay bago pa man lumitaw ang formang nasa cellphone na pala.
          Ganoon katagal ang "Loading the form…" para sa datos na nasa kamay
          na natin mula pa kanina.

          Ngayon: ipinapakita agad ang naka-tabi, at ang pagkuha sa server ay
          sa likod na tumatakbo — pampasariwa lang ng nakaimbak para sa
          susunod. Kaagad bumubukas ang form, may signal man o wala.
        */
        const saved = await getCache<FullRecord>(key);

        if (!active) return;

        if (saved) {
          setRecord(saved.value);

          // ANG BERSYON AY SUMUSUNOD SA LAMAN NA IPINAPAKITA.
          //
          // Ito ang bersyon ng kopyang aktwal na binabago ng user, kahit luma
          // na ito. Kung ipagpapalit natin ito sa sariwang bersyong dumating
          // sa likod, ang ipapadala ay sasabihing "batay ako sa pinakabago" —
          // gayong ang nasa harap niya ay ang luma. Doon tahimik na nabubura
          // ang trabaho ng ibang tao. Sa pananatili nito, mahuhuli ng server
          // ang banggaan at tatanungin ang user.
          if (!keepVersion) {
            setExpectedUpdatedAt(
              typeof saved.value.updated_at === 'string' ? saved.value.updated_at : null
            );
          }

          // Bukas na ang form. Ang natitira ay nasa likod na.
          setLoading(false);
        }

        try {
          const { data } = await SHOW[type](targetId);
          if (!active) return;

          // Laging pinapasariwa ang nakaimbak — ito ang magpapabilis sa
          // susunod na pagbukas, may signal man o wala noon.
          void putCache(key, data);

          // Ang laman sa harap ng user ay hindi na hinahawakan kapag may
          // naipakita na: hindi dapat magbago ang form habang tinitipa niya
          // ito. Ang sariwang kopya ay para sa susunod na pagbukas.
          if (!saved) {
            setRecord(data);

            if (!keepVersion) {
              setExpectedUpdatedAt(typeof data.updated_at === 'string' ? data.updated_at : null);
            }
          }
        } catch {
          if (!active) return;

          // Walang naabot na server at wala ring naka-tabi — dito lang
          // tunay na walang maipapakita.
          if (!saved && !draftUuid) {
            setError(
              'This record has not been opened on this device yet. Connect to the server to open it.'
            );
          }
        }
      }

      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [draftUuid, routeRecordId, type, attempt]);

  const reload = useCallback(() => {
    setLoading(true);
    setError('');
    setAttempt((value) => value + 1);
  }, []);

  const mode: RecordFormMode = draftUuid ? 'fix' : routeRecordId ? 'edit' : 'create';

  /*
    TINITINGNAN, HINDI BINABAGO.

    Ang pagpindot sa isang tala sa listahan ay nangangahulugang gusto itong
    makita — hindi baguhin. Ang stepper ay nasa likod ng `edit=1`, na ang
    pindutang "Edit" lang ang naglalagay.

    Hindi kasama ang `fix`: kapag may naka-queue nang pagbabagong tinutukoy ng
    `?draft=`, sinadya ng gumagamit na buksan ito para ayusin, kaya diretso na
    sa form.
  */
  const viewing = mode === 'edit' && !wantsEdit;

  /*
    Sariwa ang buod tuwing babalik dito.

    Mula sa view page pumapasok ang pag-edit, at doon din bumabalik pagkatapos
    mag-save. Kung hindi muling kukunin, ang unang bagay na makikita ng
    nag-eencode pagkatapos magpalit ng sagot ay ang lumang sagot.
  */
  const firstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        // Kakakuha lang ng effect sa itaas — walang saysay na ulitin ito.
        firstFocus.current = false;
        return;
      }

      if (viewing) setAttempt((value) => value + 1);
    }, [viewing])
  );

  return {
    /** Buod muna; nasa likod ng "Edit" ang labing-isang hakbang. */
    viewing,
    /** Ruta ng stepper para sa talang ito, opsyonal na may hakbang. */
    editHref: (step?: number) =>
      `/registration/${type}?id=${routeRecordId ?? recordId}&edit=1` +
      (step === undefined ? '' : `&step=${step}`),
    /**
     * Saang hakbang bubukas ang stepper. Ang pagpindot sa isang seksyon ng
     * view page ay dapat magbukas doon mismo, hindi sa simula ng labing-isa.
     */
    initialStep: Number.isFinite(Number(params.step)) ? Math.max(0, Number(params.step)) : 0,
    // ANG PAREHONG UUID ANG GINAGAMIT sa muling pag-save. Kung nakapasok na
    // pala ang unang padala at hindi lang nakarating ang sagot, kikilalanin
    // ito ng server bilang parehong tala at hindi magdodoble.
    uuid: draftUuid ?? queuedUuid ?? freshUuid,
    mode,
    /** Ang buong tala mula sa server, kung pag-edit ito. */
    record,
    /** Ang naka-queue nang sagot, kung pag-aayos ito. */
    draftValues,
    recordId,
    expectedUpdatedAt,
    loading,
    error,
    reload,
  };
}
