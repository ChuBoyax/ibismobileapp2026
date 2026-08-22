import {
  ApiError,
  createFamily,
  createHousehold,
  createResident,
  payloadHasFiles,
  serverReachable,
  updateFamily,
  updateHousehold,
  updateResident,
} from '@/lib/api';
import { isDeviceOnline } from '@/lib/connectivity';
import { putCache, recordCacheKey } from '@/lib/db';
import { referencedUuids, resolveRefs } from '@/lib/local-refs';
import { enqueue, outboxUuids, type OutboxType } from '@/lib/outbox';
import { drain, refresh } from '@/lib/sync';

/**
 * Iisang paraan ng pag-save para sa tatlong registration form.
 *
 * Kapag may internet, diretso sa server — kaya agad makikita ng user ang
 * validation error habang nasa form pa siya, kung saan niya ito kayang ayusin.
 *
 * Kapag hindi maabot ang server, pumapasok sa lokal na pila. Hindi ito basta
 * "kapag offline": kasama rin ang 5xx, dahil kung nagkakaproblema ang server,
 * hindi dapat mawala ang mahabang inencode ng user dahil doon.
 *
 * Ang 422 lang ang ibinabalik sa form — iyon lang ang kaya niyang ayusin doon
 * mismo. Ang iba ay itinatabi at ipapadala kapag maayos na ang koneksyon.
 */

const CREATE = {
  resident: createResident,
  household: createHousehold,
  family: createFamily,
} as const;

const UPDATE = {
  resident: updateResident,
  household: updateHousehold,
  family: updateFamily,
} as const;

export type SaveResult =
  /** Naipadala na sa server. */
  | { queued: false }
  /**
   * Nakatabi muna sa cellphone — ipapadala kapag may koneksyon.
   * Dala ang dahilan kung bakit hindi ito naipadala agad, para makita agad
   * ng user habang nasa harap pa niya ang form.
   */
  | { queued: true; reason: string };

export type SaveInput = {
  type: OutboxType;
  uuid: string;
  label?: string | null;
  payload: Record<string, unknown>;
  formValues: Record<string, unknown>;
  /** Kapag may laman, pagbabago ito ng umiiral nang tala. */
  recordId?: number | null;
  /** Bersyon ng tala nang buksan ito — dito nakikita ang banggaan. */
  expectedUpdatedAt?: string | null;
};

export async function saveRecord(input: SaveInput): Promise<SaveResult> {
  // Kapag alam na ng cellphone na walang koneksyon, huwag nang subukan ang
  // server. Ang pagpapadala ay hihintayin ang buong timeout bago sumuko —
  // labinlimang segundong "Saving…" bago pa man mapunta sa pila, gayong
  // alam naman natin sa simula pa lang na mabibigo iyon.
  if (!(await isDeviceOnline())) {
    await queue(input, 'No internet connection.');
    return { queued: true, reason: 'No internet connection.' };
  }

  // May larawan: matagal ang upload nito, kaya tiyakin muna sa loob ng tatlong
  // segundo na may sasagot. Kung wala, huwag nang simulan — animnapung
  // segundong paghihintay iyon bago pa man mapunta sa pila.
  if (payloadHasFiles(input.payload) && !(await serverReachable())) {
    await queue(input, 'The server did not respond.');
    return { queued: true, reason: 'The server did not respond.' };
  }

  /*
    TUMUTUKOY BA ITO SA TALANG NASA PILA PA?

    Nangyayari ito kapag gumawa ng sambahayan nang walang signal, tapos
    bumalik ang signal bago pa naipadala iyon, at doon itinalaga ang residente.
    Ang hawak ng payload ay pananda pa rin — walang id — kaya walang saysay
    ang diretsong padala: 422 lang ang isasagot ng server at hindi mauunawaan
    ng gumagamit kung bakit.

    Ang tamang gawin ay isabay ito sa pila. Doon, ang sambahayan ang mauuna
    at ang residente ay susunod na may tunay nang id — na siya ring
    nangyayari kapag pareho silang ginawa nang walang signal.

    Ang pila ay binabasa lang kapag may pananda talaga. Karamihan ng pag-save
    ay wala, at walang dahilan para dagdagan silang lahat ng isang query.
  */
  const resolved = await resolveReferences(input.payload);

  if (!resolved.ready) {
    const reason =
      'missing' in resolved
        ? 'This points to a record that was discarded from the queue.'
        : 'Waiting for the household or family it belongs to.';

    await queue(input, reason);

    // Kung nariyan naman ang signal, agad itong susubukan — mauuna ang
    // tinutukoy, saka ito.
    void drain();

    return { queued: true, reason };
  }

  try {
    if (input.recordId) {
      const { data } = await UPDATE[input.type](input.recordId, {
        ...resolved.payload,
        ...(input.expectedUpdatedAt ? { expected_updated_at: input.expectedUpdatedAt } : {}),
      });

      // Ang naka-tabing kopya ay luma na sa sandaling ito. Kung hindi ito
      // papalitan, ang muling pagbukas ng talang ito habang walang signal ay
      // magpapakita ng laman BAGO ang pag-edit — na parang hindi natuloy ang
      // ginawa, at aakalain ng user na nasayang ang trabaho niya.
      void putCache(recordCacheKey(input.type, input.recordId), data);
    } else {
      await CREATE[input.type]({ ...resolved.payload, uuid: input.uuid });
    }

    return { queued: false };
  } catch (error) {
    const status = error instanceof ApiError ? error.status : -1;

    // Kayang ayusin ng user habang nasa form — ipakita agad.
    if (status === 422 || status === 413) throw error;

    // May ibang nauna. Hindi ito itinatabi para subukan ulit mamaya: ang
    // muling padala ay tatanggihan din, at ang tahimik na pag-uulit ay
    // magbubura ng trabaho ng iba. Ipinapakita ito sa gumagamit ngayon din,
    // habang nasa harap niya ang parehong bersyon.
    if (status === 409) throw error;

    // Kailangan ng bagong login — hayaang hawakan ng tumawag.
    if (status === 401) throw error;

    // Hindi maabot ang server (0) o problema sa server (5xx) — itabi.
    await queue(input, error instanceof Error ? error.message : 'Could not send the record.');

    // Kung sakaling bumalik agad ang signal, hindi na maghihintay ng
    // reconnect event — pero walang halaga kung mabibigo rin.
    void drain();

    return {
      queued: true,
      reason: error instanceof Error ? error.message : 'Could not send the record.',
    };
  }
}

async function resolveReferences(payload: Record<string, unknown>) {
  if (referencedUuids(payload).length === 0) {
    return { ready: true, payload } as const;
  }

  const queued = await outboxUuids();

  return resolveRefs(payload, (uuid) => queued.has(uuid));
}

async function queue(input: SaveInput, reason?: string) {
  await enqueue({
    uuid: input.uuid,
    type: input.type,
    label: input.label ?? null,
    payload: { ...input.payload, uuid: input.uuid },
    formValues: input.formValues,
    recordId: input.recordId ?? null,
    expectedUpdatedAt: input.expectedUpdatedAt ?? null,
    reason,
  });

  // NANDITO ANG ABISO, HINDI SA TUMATAWAG.
  //
  // Tatlo ang daan papunta sa pila — walang internet, walang sumagot na
  // server, at nabigong padala. Dati ay isa lang sa kanila ang nagpapaalam sa
  // dashboard, kaya nananatiling zero ang bilang sa pill at mukhang walang
  // naghihintay gayong may naitabi naman. Sa paglalagay nito rito, sakop na
  // ang lahat ng daan — pati ang idadagdag pa mamaya.
  await refresh();
}
