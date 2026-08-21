import { getDatabase } from '@/lib/db';
import type { OutboxType } from '@/lib/outbox';

/**
 * Talaan ng mga naipadala na sa server.
 *
 * ANG PILA AY NAGSASABI KUNG ANO ANG NATITIRA; ITO ANG NAGSASABI KUNG ANO ANG
 * NAKARATING. Magkaibang tanong iyon, at ang pangalawa ang tunay na hinahanap
 * ng nag-encode: hindi "wala nang naghihintay" kundi "nakarating nga ba".
 *
 * Nang walang talaang ito, magkamukha ang dalawang bagay na dapat sana ay
 * magkaiba — ang talang matagumpay na naipadala at ang talang tahimik na
 * nawala ay parehong nagiging blangkong pila.
 */

export type SyncAction = 'created' | 'updated';

export type SyncEntry = {
  id: number;
  uuid: string;
  type: OutboxType;
  label: string | null;
  action: SyncAction;
  recordId: number | null;
  syncedAt: Date;
};

type Row = {
  id: number;
  uuid: string;
  type: string;
  label: string | null;
  action: string;
  record_id: number | null;
  synced_at: number;
};

/**
 * Ilan ang itinatago.
 *
 * Sapat ang limampu para masagot ang "nakarating ba ang mga inencode ko
 * kanina" nang hindi lumalaki nang walang hanggan ang database sa cellphone.
 * Ang mas matanda ay tinatanggal sa bawat bagong tala.
 */
const KEEP = 50;

function toEntry(row: Row): SyncEntry {
  return {
    id: row.id,
    uuid: row.uuid,
    type: row.type as OutboxType,
    label: row.label,
    action: row.action as SyncAction,
    recordId: row.record_id,
    syncedAt: new Date(row.synced_at),
  };
}

export async function recordSynced(input: {
  uuid: string;
  type: OutboxType;
  label?: string | null;
  action: SyncAction;
  recordId?: number | null;
}): Promise<void> {
  try {
    const db = await getDatabase();

    await db.runAsync(
      `INSERT INTO sync_history (uuid, type, label, action, record_id, synced_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      input.uuid,
      input.type,
      input.label ?? null,
      input.action,
      input.recordId ?? null,
      Date.now()
    );

    // Pinuputol agad, hindi sa hiwalay na paglilinis: walang ibang sandali
    // na tiyak na tatakbo sa app na minsanan lang buksan.
    await db.runAsync(
      `DELETE FROM sync_history
        WHERE id NOT IN (SELECT id FROM sync_history ORDER BY synced_at DESC LIMIT ?)`,
      KEEP
    );
  } catch {
    // Ang talaan ay patunay, hindi datos. Kung hindi ito maisulat, hindi
    // dapat mabigo ang pagpapadala na tagumpay naman talaga.
  }
}

export async function history(limit = KEEP): Promise<SyncEntry[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>(
      'SELECT * FROM sync_history ORDER BY synced_at DESC LIMIT ?',
      limit
    );

    return rows.map(toEntry);
  } catch {
    return [];
  }
}

/** Ilan ang naipadala mula noong itinakdang oras. Para sa "3 sent just now". */
export async function countSince(since: number): Promise<number> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) as total FROM sync_history WHERE synced_at >= ?',
      since
    );

    return row?.total ?? 0;
  } catch {
    return 0;
  }
}

export async function clearHistory(): Promise<void> {
  try {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM sync_history');
  } catch {
    // walang anuman
  }
}
