import { useEffect, useState } from 'react';

import { fetchOptions, listFamilies, listHouseholds, listResidents } from '@/lib/api';
import { CacheKey, getCache, putCache } from '@/lib/db';
import { pendingChoices } from '@/lib/outbox';

import { EMPTY_SOURCES, type FormSources } from './sources';

/** Kung alin sa mga kaugnay na listahan ang kailangan ng isang form. */
export type SourceNeeds = {
  households?: boolean;
  families?: boolean;
  residents?: boolean;
};

/** Sapat na ang unang pahina para sa pagpili — hindi kayang i-scroll ang libo. */
const PICKER_PAGE_SIZE = 100;

type Choice = { value: string; label: string };

type State = {
  sources: FormSources;
  loading: boolean;
  error: string | null;
  /** Naka-save na kopya ang ipinapakita — walang naabot na server. */
  offline: boolean;
  /** Kailan huling nakuha mula sa server. */
  fetchedAt: Date | null;
};

/**
 * Kinukuha ang lahat ng kailangan ng form bago ito ipakita.
 *
 * NAKA-IMBAK ANG LAHAT NG ITO SA CELLPHONE. Ito ang kaibahan ng app na
 * "may offline save" sa app na tunay ngang magamit sa labas: kung ang mismong
 * form ay hindi bubukas nang walang signal, walang saysay ang pilang
 * naghihintay ng koneksyon — hindi ka nga makakapag-encode.
 *
 * Kaya tuwing matagumpay ang pagkuha, itinatabi ito. Kapag hindi maabot ang
 * server, ang huling kopya ang ginagamit at may malinaw na abiso kung kailan
 * iyon nakuha. Ang unang pagbukas lang ang talagang nangangailangan ng signal.
 */
export function useFormSources(needs: SourceNeeds = {}) {
  const { households = false, families = false, residents = false } = needs;

  const [state, setState] = useState<State>({
    sources: EMPTY_SOURCES,
    loading: true,
    error: null,
    offline: false,
    fetchedAt: null,
  });

  // Ang "Try again" ay nagpapataas nito, at iyon ang nagpapatakbo ulit ng
  // effect. Sa ganitong paraan, iisa lang ang daan ng pagkuha at nasa loob ng
  // callback ang lahat ng setState — hindi sunod-sunod na render.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    async function run() {
      if (attempt > 0) {
        setState((prev) => ({ ...prev, loading: true, error: null }));
      }

      // NAKA-SAVE MUNA, SAKA PAGSASARIWA.
      //
      // Kung hihintayin muna ang server bago ipakita ang form, ang bawat
      // pagbukas ay may paghihintay — at sa lugar na walang signal, aabot pa
      // iyon sa timeout bago pa man lumitaw ang form na nasa cellphone na
      // pala. Sa halip: ipakita agad ang huling kopya, tapos kunin ang bago
      // sa likod. Kapag may bago, tahimik itong papalit.
      const early = await readCache({ households, families, residents });

      if (early && active && attempt === 0) {
        setState({
          sources: await withPending(early.sources, { households, families, residents }),
          loading: false,
          error: null,
          offline: true,
          fetchedAt: early.fetchedAt,
        });
      }

      try {
        const [optionsResult, householdList, familyList, residentList] = await Promise.all([
          fetchOptions(),
          households ? listHouseholds({ perPage: PICKER_PAGE_SIZE }) : null,
          families ? listFamilies({ perPage: PICKER_PAGE_SIZE }) : null,
          residents ? listResidents({ perPage: PICKER_PAGE_SIZE }) : null,
        ]);

        const sources: FormSources = {
          options: optionsResult.options,
          households:
            householdList?.data.map((item) => ({
              value: String(item.id),
              label: item.house_number ?? `Household #${item.id}`,
            })) ?? [],
          families:
            familyList?.data.map((item) => ({
              value: String(item.id),
              label: item.family_name ?? `Family #${item.id}`,
            })) ?? [],
          residents:
            residentList?.data.map((item) => ({
              value: String(item.id),
              label: item.full_name,
            })) ?? [],
        };

        // Itinatabi kada uri nang hiwalay, kaya ang household na nakuha para
        // sa isang form ay magagamit din ng iba nang hindi na kumukuha ulit.
        putCache(CacheKey.formOptions, sources.options);
        if (householdList) putCache(CacheKey.formHouseholds, sources.households);
        if (familyList) putCache(CacheKey.formFamilies, sources.families);
        if (residentList) putCache(CacheKey.formResidents, sources.residents);

        const shown = await withPending(sources, { households, families, residents });

        if (active) {
          setState({
            sources: shown,
            loading: false,
            error: null,
            offline: false,
            fetchedAt: new Date(),
          });
        }
      } catch (error) {
        const cached = await readCache({ households, families, residents });

        if (!active) return;

        if (cached) {
          setState({
            sources: await withPending(cached.sources, { households, families, residents }),
            loading: false,
            error: null,
            offline: true,
            fetchedAt: cached.fetchedAt,
          });
          return;
        }

        setState({
          sources: EMPTY_SOURCES,
          loading: false,
          offline: false,
          fetchedAt: null,
          error:
            error instanceof Error
              ? `${error.message} Open this form once while connected so it can be used offline later.`
              : 'Cannot load the form right now.',
        });
      }
    }

    void run();

    return () => {
      active = false;
    };
  }, [households, families, residents, attempt]);

  return { ...state, reload: () => setAttempt((count) => count + 1) };
}

/**
 * Idinaragdag ang mga talang nasa pila pa sa mapagpipilian.
 *
 * ITO ANG NAGPAPAGANA SA PAG-ENCODE NG BUONG SAMBAHAYAN NANG WALANG SIGNAL.
 * Ang naka-cache na listahan ay galing sa server, kaya ang sambahayang
 * kagagawa lang sa bahay na ito ay wala roon. Kung iyon lang ang ipapakita,
 * ang enumerator ay may bagong sambahayan na hindi niya matukoy — at ang
 * tanging magagawa niya ay hintayin ang signal, gayong iyon mismo ang
 * iniiwasan.
 *
 * Nauuna ang mga nasa pila. Sila ang kababuo lang at malamang sila ang
 * hinahanap; ang daan-daang galing sa server ay nasa ilalim, gaya ng dati.
 */
async function withPending(sources: FormSources, needs: Required<SourceNeeds>) {
  const [households, families, residents] = await Promise.all([
    needs.households ? pendingChoices('household') : [],
    needs.families ? pendingChoices('family') : [],
    needs.residents ? pendingChoices('resident') : [],
  ]);

  return {
    ...sources,
    households: [...households, ...sources.households],
    families: [...families, ...sources.families],
    residents: [...residents, ...sources.residents],
  };
}

/**
 * Binabasa ang huling naka-save na kopya. Kailangang kumpleto — kung wala ang
 * options, walang kahulugan ang mga dropdown at mas mabuti pang magpakita ng
 * malinaw na mensahe kaysa ng form na puro blangko ang pagpipilian.
 */
async function readCache(needs: Required<SourceNeeds>) {
  const [options, householdList, familyList, residentList] = await Promise.all([
    getCache<FormSources['options']>(CacheKey.formOptions),
    needs.households ? getCache<Choice[]>(CacheKey.formHouseholds) : null,
    needs.families ? getCache<Choice[]>(CacheKey.formFamilies) : null,
    needs.residents ? getCache<Choice[]>(CacheKey.formResidents) : null,
  ]);

  if (!options) return null;

  return {
    sources: {
      options: options.value,
      households: householdList?.value ?? [],
      families: familyList?.value ?? [],
      residents: residentList?.value ?? [],
    } as FormSources,
    fetchedAt: options.updatedAt,
  };
}

/**
 * Kinukuha nang maaga ang laman ng form habang may koneksyon pa.
 *
 * Tinatawag pagkatapos mag-login, kaya handa na ang form bago pa lumabas ang
 * user sa field. Kung hindi ito ginawa, ang unang pagbukas ng form sa lugar na
 * walang signal ay mabibigo — at doon pa lang malalaman ng user, kung kailan
 * huli na.
 */
export async function warmFormSources(): Promise<void> {
  try {
    const [options, householdList, familyList, residentList] = await Promise.all([
      fetchOptions(),
      listHouseholds({ perPage: PICKER_PAGE_SIZE }),
      listFamilies({ perPage: PICKER_PAGE_SIZE }),
      listResidents({ perPage: PICKER_PAGE_SIZE }),
    ]);

    await Promise.all([
      putCache(CacheKey.formOptions, options.options),
      putCache(
        CacheKey.formHouseholds,
        householdList.data.map((item) => ({
          value: String(item.id),
          label: item.house_number ?? `Household #${item.id}`,
        }))
      ),
      putCache(
        CacheKey.formFamilies,
        familyList.data.map((item) => ({
          value: String(item.id),
          label: item.family_name ?? `Family #${item.id}`,
        }))
      ),
      putCache(
        CacheKey.formResidents,
        residentList.data.map((item) => ({
          value: String(item.id),
          label: item.full_name,
        }))
      ),
    ]);
  } catch {
    // Paghahanda lang ito — kung mabigo, ang mismong pagbukas ng form ang
    // susubok ulit. Walang dapat ipaalam sa user dito.
  }
}
