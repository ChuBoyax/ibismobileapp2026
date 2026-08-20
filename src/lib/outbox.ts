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
  | 'needs_fix'
  /**
   * May ibang nakaunang magpalit ng parehong tala habang offline ito.
   * Hindi ito kayang pagpasiyahan ng app — ang gumagamit ang pipili kung
   * ang kanyang bersyon ba ang mananaig o ang nasa server na.
   */
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
  /** Alin ang binabago. Kapag null, bagong tala ito. */
  recordId: number | null;
  /** Kailan huling nagbago ang tala nang buksan ito sa form. */
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
  /** Kung nabigo ang pagkopya, dala nito ang dahilan para makita ng user. */
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

        // ASYNC ANG COPY — kailangan itong hintayin.
        //
        // Kung hindi, ibabalik natin ang URI ng file na hindi pa tapos
        // kopyahin. Walang laman pa iyon pagdating ng oras ng pagpapadala,
        // kaya tatanggihan ng server ang larawan at mababaon ang buong tala
        // sa "needs fixing" — gayong walang naman talagang mali sa datos.
        await original.copy(copy);

        // Katiyakan bago ipagpalit: kung sa anumang dahilan ay walang
        // nabuong file, mas mabuti pang gamitin ang orihinal kaysa magturo
        // sa wala.
        if (copy.exists) return copy.uri;

        warning = 'The photo could not be saved on this device. It may not be sent.';
        return value;
      } catch (error) {
        // Kung hindi makopya, mas mabuti pa ring ma-queue ang tala kasama ang
        // orihinal na URI kaysa mawala ang buong record dahil sa isang larawan.
        // Pero ITINATALA ANG DAHILAN — ang tahimik na pagkabigo dito ay
        // nagiging misteryosong 422 mamaya, at walang paraan para maunawaan.
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
  /** Kapag may laman, pagbabago ito ng umiiral nang tala at hindi paglikha. */
  recordId?: number | null;
  expectedUpdatedAt?: string | null;
  /** Bakit hindi ito naipadala agad — para may makita ang user sa pila. */
  reason?: string;
}): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();

  const { payload, warning } = await persistPhotos(input.uuid, input.payload);

  // REPLACE para maging pag-update ito kapag inayos at ipinadala ulit ang
  // parehong tala — hindi bagong entry.
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
    // Ang babala sa larawan ang nauuna — mas tiyak iyon kaysa sa pangkalahatang
    // dahilan ng pagkabigo ng pagpapadala.
    warning ?? input.reason ?? null,
    input.recordId ?? null,
    input.expectedUpdatedAt ?? null,
    input.uuid,
    now,
    now
  );
}

/*
  ANG MGA PAGBASA AY HINDI DAPAT MAGPABAGSAK NG APP.

  Kapag nabigo ang isang query — abala ang database, o hindi pa tapos ang
  pagbukas — dating tumatalbog ang error paakyat sa tumawag. Ang bunga nito ay
  screen na walang reaksyon: ang pindutan ng Log out ay naghihintay ng bilang
  bago magpakita ng dialog, kaya kapag nabigo ang bilang, walang lumalabas at
  mukhang patay ang pindutan.

  Ang pagbabalik ng walang laman ay mas tapat: makikita ng user ang app na may
  kulang na impormasyon, hindi ang app na hindi tumutugon.
*/
export async function list(): Promise<OutboxItem[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>('SELECT * FROM outbox ORDER BY created_at ASC');

    return rows.map(toItem);
  } catch {
    return [];
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

/**
 * May naghihintay pa bang pagbabago para sa talang ito?
 *
 * BAKIT KAILANGAN. Kapag nag-edit ang user habang walang signal, ang bagong
 * laman ay nasa pila lang — hindi pa sa server at hindi rin sa naka-cache na
 * kopya. Kung muli niyang bubuksan ang parehong tala mula sa listahan,
 * makikita niya ang DATING laman at mag-aakalang hindi natuloy ang pag-edit.
 * Mag-e-edit siyang muli, at magkakaroon ng dalawang magkaibang padala para
 * sa iisang tala.
 *
 * Kaya bago magpakita, tinitingnan muna kung may naghihintay — at kung meron,
 * iyon ang ipinapakita, sa parehong uuid.
 */
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

/** Ang mga handa nang ipadala — hindi kasama ang naghihintay ng pag-aayos. */
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

/**
 * Nariyan pa ba ang lahat ng larawan ng talang ito?
 *
 * Tinatawag bago ipadala. Kapag wala na ang file, babagsak ang React Native
 * sa antas ng network at ang lumalabas ay "Cannot reach the server" — malayo
 * sa tunay na dahilan. Walang request na darating sa backend, kaya wala rin
 * itong makikita sa logs at mukhang problema sa signal ang lahat.
 *
 * Mas mabuting sabihin nang tuwiran kung aling file ang nawawala.
 */
export function missingPhotos(payload: unknown): string[] {
  const missing: string[] = [];

  function walk(value: unknown) {
    if (isLocalFile(value)) {
      try {
        const file = new File(value);

        // Hindi sapat na umiiral ito. Ang file na walang laman ay hindi
        // mababasa ng React Native at magpapabagsak ng pagpapadala bago pa
        // ito umalis — kaya kailangang mahuli rin dito.
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

/**
 * Ipinipilit ang bersyong nasa cellphone.
 *
 * Tinatanggal ang `expected_updated_at`, kaya hindi na titingnan ng server
 * ang bersyon at tatanggapin nito ang padala. SINASADYANG PAGPAPASIYA ITO NG
 * TAO — pinili niyang matabunan ang pagbabago ng iba pagkatapos ipakita sa
 * kanya na may nagbago. Hindi ito ginagawa ng app nang kusa.
 */
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

/** Binubura ang buong pila. Ginagamit kapag nag-logout nang tuluyan. */
export async function clearOutbox(): Promise<void> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ uuid: string }>('SELECT uuid FROM outbox');

  await db.runAsync('DELETE FROM outbox');
  rows.forEach((row) => removePhotos(row.uuid));
}
