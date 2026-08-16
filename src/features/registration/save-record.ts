import { ApiError, createFamily, createHousehold, createResident } from '@/lib/api';
import { isDeviceOnline } from '@/lib/connectivity';
import { enqueue, type OutboxType } from '@/lib/outbox';
import { drain } from '@/lib/sync';

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

export type SaveResult =
  /** Naipadala na sa server. */
  | { queued: false }
  /** Nakatabi muna sa cellphone — ipapadala kapag may koneksyon. */
  | { queued: true };

export async function saveRecord(input: {
  type: OutboxType;
  uuid: string;
  label?: string | null;
  payload: Record<string, unknown>;
  formValues: Record<string, unknown>;
}): Promise<SaveResult> {
  // Kapag alam na ng cellphone na walang koneksyon, huwag nang subukan ang
  // server. Ang pagpapadala ay hihintayin ang buong timeout bago sumuko —
  // labinlimang segundong "Saving…" bago pa man mapunta sa pila, gayong
  // alam naman natin sa simula pa lang na mabibigo iyon.
  if (!(await isDeviceOnline())) {
    await queue(input);
    return { queued: true };
  }

  try {
    await CREATE[input.type]({ ...input.payload, uuid: input.uuid });

    return { queued: false };
  } catch (error) {
    const status = error instanceof ApiError ? error.status : -1;

    // Kayang ayusin ng user habang nasa form — ipakita agad.
    if (status === 422 || status === 413) throw error;

    // Kailangan ng bagong login — hayaang hawakan ng tumawag.
    if (status === 401) throw error;

    // Hindi maabot ang server (0) o problema sa server (5xx) — itabi.
    await queue(input);

    // Kung sakaling bumalik agad ang signal, hindi na maghihintay ng
    // reconnect event — pero walang halaga kung mabibigo rin.
    void drain();

    return { queued: true };
  }
}

async function queue(input: {
  type: OutboxType;
  uuid: string;
  label?: string | null;
  payload: Record<string, unknown>;
  formValues: Record<string, unknown>;
}) {
  await enqueue({
    uuid: input.uuid,
    type: input.type,
    label: input.label ?? null,
    payload: { ...input.payload, uuid: input.uuid },
    formValues: input.formValues,
  });
}
