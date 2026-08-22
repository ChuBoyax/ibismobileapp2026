import { getDatabase } from '@/lib/db';
import type { OutboxType } from '@/lib/outbox';



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

    await db.runAsync(
      `DELETE FROM sync_history
        WHERE id NOT IN (SELECT id FROM sync_history ORDER BY synced_at DESC LIMIT ?)`,
      KEEP
    );
  } catch {
  
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
  
  }
}
