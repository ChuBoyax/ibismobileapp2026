import { getDatabase } from '@/lib/db';
import type { OutboxType } from '@/lib/outbox';

/**
 * Pagtukoy sa talang wala pang id.
 *
 * ANG SULIRANIN. Ang enumerator na dumating sa isang bahay na walang signal ay
 * kailangang i-encode ang buong sambahayan: ang bahay muna, saka ang mga
 * naninirahan doon. Pero ang sambahayang kagagawa lang niya ay nasa pila pa
 * lang — walang id, dahil ang server ang gumagawa niyon at hindi pa ito
 * naaabot. Kaya sa dating anyo, hindi ito lumalabas sa pagpipilian ng
 * residente, at ang tanging magagawa niya ay hintayin ang signal bago
 * ituloy — na siya namang dahilan kung bakit siya nag-e-encode offline.
 *
 * ANG PARAAN. Habang nasa pila pa, ang tala ay tinutukoy sa pamamagitan ng
 * uuid nito, nakasulat bilang `pending:<uuid>`. Hindi ito kailanman umaabot sa
 * server: bago ipadala ang isang tala, pinapalitan ang bawat ganitong pananda
 * ng tunay na id — na alam na natin sa sandaling makarating ang tinutukoy.
 *
 * Kaya walang binabago sa backend. Ang server ay tumatanggap pa rin ng
 * numerong id gaya ng dati; ang buong pag-aayos ay nasa cellphone lamang.
 */

const PREFIX = 'pending:';

/** Ang pananda para sa talang nasa pila pa. */
export function localRef(uuid: string): string {
  return `${PREFIX}${uuid}`;
}

export function isLocalRef(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/** Ang uuid na nasa loob ng pananda. */
export function refUuid(value: string): string {
  return value.slice(PREFIX.length);
}

/**
 * Itinatala ang naging id ng talang kagagaling lang sa pila.
 *
 * Tinatawag matapos ang matagumpay na paglikha. Mula rito, ang sinumang
 * naghihintay pang tala na tumutukoy sa uuid na ito ay may mapagpapalit na.
 */
export async function rememberId(
  uuid: string,
  type: OutboxType,
  recordId: number
): Promise<void> {
  try {
    const db = await getDatabase();

    await db.runAsync(
      'INSERT OR REPLACE INTO id_map (uuid, type, record_id, created_at) VALUES (?, ?, ?, ?)',
      uuid,
      type,
      recordId,
      Date.now()
    );
  } catch {
    // Kung hindi maitala, hindi mareresolba ang mga tumutukoy dito at
    // maiiwan silang naghihintay — makikita iyon ng user sa Sync queue na may
    // malinaw na dahilan. Mas mabuti iyon kaysa ihinto ang padalang tapos na.
  }
}

/** Ang id ng tala, kung nakarating na ito sa server. */
export async function lookupId(uuid: string): Promise<number | null> {
  try {
    const db = await getDatabase();

    const row = await db.getFirstAsync<{ record_id: number }>(
      'SELECT record_id FROM id_map WHERE uuid = ?',
      uuid
    );

    return row?.record_id ?? null;
  } catch {
    return null;
  }
}

/** Lahat ng uuid na tinutukoy ng payload na ito. */
export function referencedUuids(payload: unknown): string[] {
  const found = new Set<string>();

  function walk(value: unknown) {
    if (typeof value === 'string') {
      if (isLocalRef(value)) found.add(refUuid(value));
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    if (value !== null && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach(walk);
    }
  }

  walk(payload);

  return [...found];
}

export type ResolveResult =
  /** Handa nang ipadala — nasa `payload` ang bersyong may tunay na id. */
  | { ready: true; payload: Record<string, unknown> }
  /**
   * May tinutukoy pang hindi nakakarating. Hindi ito pagkakamali: ang
   * tinutukoy ay nasa pila rin, at mauuna lang itong ipadala.
   */
  | { ready: false; waitingFor: string[] }
  /**
   * Tinutukoy ang talang hindi na darating — itinapon ito ng gumagamit mula
   * sa pila. Kailangan na ng tao rito.
   */
  | { ready: false; missing: string[] };

/**
 * Pinapalitan ng tunay na id ang bawat pananda sa payload.
 *
 * TATLO ANG MAAARING KALABASAN, at magkaiba ang nararapat sa bawat isa:
 *
 *   handa    — nakarating na ang lahat ng tinutukoy, ipadala na
 *   naghihintay — nasa pila pa ang tinutukoy, ipadala muna iyon
 *   nawawala — itinapon ang tinutukoy, hindi na ito maaayos ng paghihintay
 *
 * Ang ikatlo ang madaling makaligtaan. Kung ituturing itong "naghihintay",
 * ang talang tumutukoy sa itinapong sambahayan ay maghihintay magpakailanman
 * nang walang sinasabi kahit kanino.
 *
 * @param stillQueued Alin sa mga uuid ang nasa pila pa — dito nakikilala ang
 *                    naghihintay sa nawawala.
 */
export async function resolveRefs(
  payload: Record<string, unknown>,
  stillQueued: (uuid: string) => boolean
): Promise<ResolveResult> {
  const uuids = referencedUuids(payload);

  if (uuids.length === 0) return { ready: true, payload };

  const waitingFor: string[] = [];
  const missing: string[] = [];
  const resolved = new Map<string, number>();

  for (const uuid of uuids) {
    const id = await lookupId(uuid);

    if (id !== null) {
      resolved.set(uuid, id);
      continue;
    }

    if (stillQueued(uuid)) waitingFor.push(uuid);
    else missing.push(uuid);
  }

  // Ang nawawala ang nauuna: kahit may hinihintay pa, hindi na ito matutuloy
  // kailanman, at ang tao ang kailangang magpasiya.
  if (missing.length > 0) return { ready: false, missing };
  if (waitingFor.length > 0) return { ready: false, waitingFor };

  function swap(value: unknown): unknown {
    if (typeof value === 'string') {
      return isLocalRef(value) ? resolved.get(refUuid(value)) ?? value : value;
    }

    if (Array.isArray(value)) return value.map(swap);

    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, swap(item)])
      );
    }

    return value;
  }

  return { ready: true, payload: swap(payload) as Record<string, unknown> };
}

/**
 * Pinapalitan ng tunay na id ang mga pananda sa sagot ng form.
 *
 * BAKIT KAILANGAN SA PAGBUKAS NG DRAFT. Habang nasa pila pa ang sambahayan,
 * ang sagot ng residente ay `pending:<uuid>` — at iyon ang lumalabas sa
 * pagpipilian, kaya tumutugma. Pero kapag nakarating na ang sambahayan,
 * nawawala na ito sa listahan ng naghihintay at nasa listahan na ng server sa
 * ilalim ng bago nitong id. Kung hindi papalitan ang sagot, ang select ay
 * walang matatagpuang katugma at magmumukhang WALANG NAPILI — kahit may
 * napili naman, at kahit tama pa rin ang maipapadala.
 *
 * Ang taong nag-aayos ng isang maling petsa ay makikita ang sambahayang
 * blangko at aakalaing nabura iyon. Kaya sa pagbukas pa lang, itinutuwid na.
 */
export async function resolveFormValues(
  values: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const uuids = referencedUuids(values);

  if (uuids.length === 0) return values;

  const resolved = new Map<string, number>();

  for (const uuid of uuids) {
    const id = await lookupId(uuid);
    if (id !== null) resolved.set(uuid, id);
  }

  if (resolved.size === 0) return values;

  function swap(value: unknown): unknown {
    if (typeof value === 'string') {
      if (!isLocalRef(value)) return value;

      const id = resolved.get(refUuid(value));

      // Ang sagot ng form ay teksto — doon naghahanap ng katugma ang select.
      return id === undefined ? value : String(id);
    }

    if (Array.isArray(value)) return value.map(swap);

    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, swap(item)])
      );
    }

    return value;
  }

  return swap(values) as Record<string, unknown>;
}
