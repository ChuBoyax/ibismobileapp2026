import { Directory, File, Paths } from 'expo-file-system';

import { getDatabase } from '@/lib/db';
import { localRef } from '@/lib/local-refs';
export type OutboxType = 'resident' | 'household' | 'family';

export type OutboxStatus =
 
  | 'pending'
 
  | 'syncing'
 
  | 'needs_fix'
 
  | 'conflict';

export type OutboxItem = {
  uuid: string;
  type: OutboxType;
  label: string | null;
  payload: Record<string, unknown>;
  formValues: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  recordId: number | null;
  expectedUpdatedAt: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type Row = {
  uuid: string;
  type: string;
  label: string | null;
  payload: string;
  form_values: string;
  status: string;
  attempts: number;
  last_error: string | null;
  record_id: number | null;
  expected_updated_at: string | null;
  created_at: number;
  updated_at: number;
};

const isLocalFile = (value: unknown): value is string =>
  typeof value === 'string' && /^(file|content):\/\//.test(value);

function outboxDirectory(uuid: string) {
  return new Directory(Paths.document, 'outbox', uuid);
}

async function persistPhotos(uuid: string, payload: Record<string, unknown>) {
  let index = 0;
  let directoryReady = false;
  let warning: string | null = null;

  function ensureDirectory() {
    if (directoryReady) return;
    outboxDirectory(uuid).create({ intermediates: true, idempotent: true });
    directoryReady = true;
  }

  async function walk(value: unknown): Promise<unknown> {
    if (isLocalFile(value)) {
      try {
        ensureDirectory();

        const original = new File(value);
        const name = value.split('/').pop()?.split('?')[0] ?? '';
        const extension = name.includes('.') ? name.split('.').pop() : 'jpg';
        const copy = new File(outboxDirectory(uuid), `photo-${index++}.${extension || 'jpg'}`);

        await original.copy(copy);

      
        if (copy.exists) return copy.uri;

        warning = 'The photo could not be saved on this device. It may not be sent.';
        return value;
      } catch (error) {
        warning = `Photo could not be copied: ${
          error instanceof Error ? error.message : 'unknown error'
        }`;

        return value;
      }
    }

    if (Array.isArray(value)) {
      return Promise.all(value.map(walk));
    }

    if (value !== null && typeof value === 'object') {
      const entries = await Promise.all(
        Object.entries(value as Record<string, unknown>).map(
          async ([key, item]) => [key, await walk(item)] as const
        )
      );

      return Object.fromEntries(entries);
    }

    return value;
  }

  return {
    payload: (await walk(payload)) as Record<string, unknown>,
    warning,
  };
}

function removePhotos(uuid: string) {
  try {
    const directory = outboxDirectory(uuid);
    if (directory.exists) directory.delete();
  } catch {
   
  }
}



function toItem(row: Row): OutboxItem {
  return {
    uuid: row.uuid,
    type: row.type as OutboxType,
    label: row.label,
    payload: JSON.parse(row.payload),
    formValues: JSON.parse(row.form_values),
    status: row.status as OutboxStatus,
    attempts: row.attempts,
    lastError: row.last_error,
    recordId: row.record_id ?? null,
    expectedUpdatedAt: row.expected_updated_at ?? null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function enqueue(input: {
  uuid: string;
  type: OutboxType;
  label?: string | null;
  payload: Record<string, unknown>;
  formValues: Record<string, unknown>;
  recordId?: number | null;
  expectedUpdatedAt?: string | null;
  reason?: string;
}): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();

  const { payload, warning } = await persistPhotos(input.uuid, input.payload);

  await db.runAsync(
    `INSERT OR REPLACE INTO outbox
       (uuid, type, label, payload, form_values, status, attempts, last_error,
        record_id, expected_updated_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?,
             COALESCE((SELECT created_at FROM outbox WHERE uuid = ?), ?), ?)`,
    input.uuid,
    input.type,
    input.label ?? null,
    JSON.stringify(payload),
    JSON.stringify(input.formValues),
    
    warning ?? input.reason ?? null,
    input.recordId ?? null,
    input.expectedUpdatedAt ?? null,
    input.uuid,
    now,
    now
  );
}

export type OutboxSummary = Omit<OutboxItem, 'payload' | 'formValues'>;

type SummaryRow = Omit<Row, 'payload' | 'form_values'>;

export async function listSummaries(): Promise<OutboxSummary[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<SummaryRow>(
      `SELECT uuid, type, label, status, attempts, last_error, record_id,
              expected_updated_at, created_at, updated_at
         FROM outbox
        ORDER BY created_at ASC`
    );

    return rows.map((row) => ({
      uuid: row.uuid,
      type: row.type as OutboxType,
      label: row.label,
      status: row.status as OutboxStatus,
      attempts: row.attempts,
      lastError: row.last_error,
      recordId: row.record_id ?? null,
      expectedUpdatedAt: row.expected_updated_at ?? null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  } catch {
    return [];
  }
}


export async function pendingChoices(
  type: OutboxType
): Promise<{ value: string; label: string }[]> {
  try {
    const db = await getDatabase();

    const rows = await db.getAllAsync<{ uuid: string; label: string | null }>(
      `SELECT uuid, label
         FROM outbox
        WHERE type = ? AND record_id IS NULL
        ORDER BY created_at ASC`,
      type
    );

    return rows.map((row) => ({
      value: localRef(row.uuid),

      label: `${row.label ?? TYPE_NOUN[type]} · not yet sent`,
    }));
  } catch {
    return [];
  }
}

const TYPE_NOUN: Record<OutboxType, string> = {
  resident: 'New resident',
  household: 'New household',
  family: 'New family',
};


export async function outboxUuids(): Promise<Set<string>> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ uuid: string }>('SELECT uuid FROM outbox');

    return new Set(rows.map((row) => row.uuid));
  } catch {
    return new Set();
  }
}

export async function get(uuid: string): Promise<OutboxItem | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Row>('SELECT * FROM outbox WHERE uuid = ?', uuid);

    return row ? toItem(row) : null;
  } catch {
    return null;
  }
}

export async function findByRecord(
  type: OutboxType,
  recordId: number
): Promise<OutboxItem | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Row>(
      'SELECT * FROM outbox WHERE type = ? AND record_id = ? ORDER BY created_at DESC LIMIT 1',
      type,
      recordId
    );

    return row ? toItem(row) : null;
  } catch {
    return null;
  }
}

export async function pending(): Promise<OutboxItem[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>(
      "SELECT * FROM outbox WHERE status IN ('pending', 'syncing') ORDER BY created_at ASC"
    );

    return rows.map(toItem);
  } catch {
    return [];
  }
}


export function missingPhotos(payload: unknown): string[] {
  const missing: string[] = [];

  function walk(value: unknown) {
    if (isLocalFile(value)) {
      try {
        const file = new File(value);
        if (!file.exists) {
          missing.push(`${value} (missing)`);
        } else if (!file.size) {
          missing.push(`${value} (empty)`);
        }
      } catch (error) {
        missing.push(`${value} (${error instanceof Error ? error.message : 'unreadable'})`);
      }
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

  return missing;
}

export async function remove(uuid: string): Promise<void> {
  const db = await getDatabase();

  await db.runAsync('DELETE FROM outbox WHERE uuid = ?', uuid);
  removePhotos(uuid);
}

export async function setStatus(
  uuid: string,
  status: OutboxStatus,
  options: { error?: string | null; countAttempt?: boolean } = {}
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE outbox
        SET status = ?,
            last_error = ?,
            attempts = attempts + ?,
            updated_at = ?
      WHERE uuid = ?`,
    status,
    options.error ?? null,
    options.countAttempt ? 1 : 0,
    Date.now(),
    uuid
  );
}

export async function overrideConflict(uuid: string): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE outbox
        SET status = 'pending',
            expected_updated_at = NULL,
            attempts = 0,
            last_error = ?,
            updated_at = ?
      WHERE uuid = ?`,
    'You chose to keep your version. It will replace the one on the server.',
    Date.now(),
    uuid
  );
}

export type OutboxCounts = {
  pending: number;
  syncing: number;
  needsFix: number;
  conflicts: number;
  total: number;
};

export async function counts(): Promise<OutboxCounts> {
  const empty = { pending: 0, syncing: 0, needsFix: 0, conflicts: 0, total: 0 };

  try {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{ status: string; total: number }>(
    'SELECT status, COUNT(*) as total FROM outbox GROUP BY status'
  );

  const byStatus = Object.fromEntries(rows.map((row) => [row.status, row.total]));

  const result = {
    pending: byStatus.pending ?? 0,
    syncing: byStatus.syncing ?? 0,
    needsFix: byStatus.needs_fix ?? 0,
    conflicts: byStatus.conflict ?? 0,
    total: 0,
  };

  result.total = result.pending + result.syncing + result.needsFix + result.conflicts;

  return result;
  } catch {
    return empty;
  }
}

export async function clearOutbox(): Promise<void> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ uuid: string }>('SELECT uuid FROM outbox');

  await db.runAsync('DELETE FROM outbox');
  rows.forEach((row) => removePhotos(row.uuid));
}
