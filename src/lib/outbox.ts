import { Directory, File, Paths } from 'expo-file-system';

import { getDatabase } from '@/lib/db';

/**
 * Pila ng mga talang hindi pa naipapadala sa server.
 *
 * Ang uuid ay galing sa app at siya ring ipapadala. Idempotent ang server sa
 * uuid — kapag naipadala na dati ang parehong uuid, ibinabalik nito ang dating
 * tala imbes na gumawa ng bago. Kaya ligtas ulit-ulitin ang padala kahit
 * putol-putol ang signal.
 */

export type OutboxType = 'resident' | 'household' | 'family';

export type OutboxStatus =
  /** Naghihintay ng koneksyon o ng susunod na subok. */
  | 'pending'
  /** Kasalukuyang ipinapadala. */
  | 'syncing'
  /** Tinanggihan ng server — may mali sa datos, kailangan ng tao. */
  | 'needs_fix';

export type OutboxItem = {
  uuid: string;
  type: OutboxType;
  label: string | null;
  payload: Record<string, unknown>;
  formValues: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
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
  created_at: number;
  updated_at: number;
};

/** Larawang galing sa camera o gallery. Kapareho ng tsek sa api.ts. */
const isLocalFile = (value: unknown): value is string =>
  typeof value === 'string' && /^(file|content):\/\//.test(value);

// ── Larawan ─────────────────────────────────────────────────────────────

/**
 * Ang larawan mula sa image picker ay nasa cache directory — kayang burahin
 * ng OS anumang oras kapag naubusan ng espasyo ang device. Kung ang tala ay
 * na-queue ngayon at na-sync makalipas ang dalawang araw, malamang wala na
 * ang file at mawawala ang larawan nang tahimik.
 *
 * Kaya kinokopya natin ito sa document directory — hindi ito binubura ng OS.
 * Ang folder ay pinapangalanan sa uuid, kaya isang tanggal lang kapag
 * naipadala na o na-discard.
 */
function outboxDirectory(uuid: string) {
  return new Directory(Paths.document, 'outbox', uuid);
}

async function persistPhotos(uuid: string, payload: Record<string, unknown>) {
  let index = 0;
  let directoryReady = false;

  function ensureDirectory() {
    if (directoryReady) return;
    outboxDirectory(uuid).create({ intermediates: true, idempotent: true });
    directoryReady = true;
  }

  function walk(value: unknown): unknown {
    if (isLocalFile(value)) {
      try {
        ensureDirectory();

        const original = new File(value);
        const extension = value.split('.').pop()?.split('?')[0] || 'jpg';
        const copy = new File(outboxDirectory(uuid), `photo-${index++}.${extension}`);

        original.copy(copy);

        return copy.uri;
      } catch {
        // Kung hindi makopya, mas mabuti pa ring ma-queue ang tala kasama ang
        // orihinal na URI kaysa mawala ang buong record dahil sa isang larawan.
        return value;
      }
    }

    if (Array.isArray(value)) return value.map(walk);

    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, walk(item)])
      );
    }

    return value;
  }

  return walk(payload) as Record<string, unknown>;
}

function removePhotos(uuid: string) {
  try {
    const directory = outboxDirectory(uuid);
    if (directory.exists) directory.delete();
  } catch {
    // Hindi mahalaga kung nabigo — cache lang naman ang laman.
  }
}

// ── Pila ────────────────────────────────────────────────────────────────

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
}): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();

  const payload = await persistPhotos(input.uuid, input.payload);

  // REPLACE para maging pag-update ito kapag inayos at ipinadala ulit ang
  // parehong tala — hindi bagong entry.
  await db.runAsync(
    `INSERT OR REPLACE INTO outbox
       (uuid, type, label, payload, form_values, status, attempts, last_error, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', 0, NULL, COALESCE((SELECT created_at FROM outbox WHERE uuid = ?), ?), ?)`,
    input.uuid,
    input.type,
    input.label ?? null,
    JSON.stringify(payload),
    JSON.stringify(input.formValues),
    input.uuid,
    now,
    now
  );
}

export async function list(): Promise<OutboxItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Row>('SELECT * FROM outbox ORDER BY created_at ASC');

  return rows.map(toItem);
}

export async function get(uuid: string): Promise<OutboxItem | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Row>('SELECT * FROM outbox WHERE uuid = ?', uuid);

  return row ? toItem(row) : null;
}

/** Ang mga handa nang ipadala — hindi kasama ang naghihintay ng pag-aayos. */
export async function pending(): Promise<OutboxItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Row>(
    "SELECT * FROM outbox WHERE status IN ('pending', 'syncing') ORDER BY created_at ASC"
  );

  return rows.map(toItem);
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

export type OutboxCounts = {
  pending: number;
  syncing: number;
  needsFix: number;
  total: number;
};

export async function counts(): Promise<OutboxCounts> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{ status: string; total: number }>(
    'SELECT status, COUNT(*) as total FROM outbox GROUP BY status'
  );

  const byStatus = Object.fromEntries(rows.map((row) => [row.status, row.total]));

  const result = {
    pending: byStatus.pending ?? 0,
    syncing: byStatus.syncing ?? 0,
    needsFix: byStatus.needs_fix ?? 0,
    total: 0,
  };

  result.total = result.pending + result.syncing + result.needsFix;

  return result;
}

/** Binubura ang buong pila. Ginagamit kapag nag-logout nang tuluyan. */
export async function clearOutbox(): Promise<void> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ uuid: string }>('SELECT uuid FROM outbox');

  await db.runAsync('DELETE FROM outbox');
  rows.forEach((row) => removePhotos(row.uuid));
}
