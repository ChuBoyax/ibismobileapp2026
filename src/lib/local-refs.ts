import { getDatabase } from '@/lib/db';
import type { OutboxType } from '@/lib/outbox';



const PREFIX = 'pending:';

export function localRef(uuid: string): string {
  return `${PREFIX}${uuid}`;
}

export function isLocalRef(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function refUuid(value: string): string {
  return value.slice(PREFIX.length);
}

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
  
  }
}

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
  | { ready: true; payload: Record<string, unknown> }

  | { ready: false; waitingFor: string[] }

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
