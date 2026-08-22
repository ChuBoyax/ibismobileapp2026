import * as SQLite from 'expo-sqlite';
const DB_NAME = 'ibis.db';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function open(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = initialise().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

async function initialise(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS cache (
      key        TEXT PRIMARY KEY NOT NULL,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    /*
      Mga talang hindi pa naipapadala sa server.

      Ang uuid ay galing sa app at siya ring ipapadala — idempotent ang server
      sa uuid, kaya kahit maulit ang padala dahil sa mahinang signal, hindi
      magdodoble ang tala.

      Dalawang kopya ang itinatago at sinasadya iyon:
        payload      — handa nang i-POST, kaya hindi kailangan ng sync engine
                       ang form definition o ang /options mula sa server
        form_values  — hilaw na sagot, para mabuksan ulit sa form kapag may
                       kailangang ayusin
    */
    CREATE TABLE IF NOT EXISTS outbox (
      uuid        TEXT PRIMARY KEY NOT NULL,
      type        TEXT NOT NULL,
      label       TEXT,
      payload     TEXT NOT NULL,
      form_values TEXT NOT NULL,
      status      TEXT NOT NULL,
      attempts    INTEGER NOT NULL DEFAULT 0,
      last_error  TEXT,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS outbox_status_idx ON outbox (status, created_at);

    /*
      Talaan ng mga naipadala na.

      BAKIT MAY TALAAN. Kapag naipadala ang isang tala, binubura ito sa pila —
      at basta na lang itong nawawala sa screen. Walang natitirang patunay na
      nangyari nga iyon. Ang enumerator na nag-encode ng dalawampung tala sa
      bundok at bumalik sa bayan ay walang paraan para malamang nakarating
      talaga ang lahat; ang tanging alam niya ay wala nang laman ang pila —
      na siya ring hitsura ng talang tahimik na nawala.

      Ang talaang ito ang kaibahan ng "wala nang naghihintay" sa "naipadala
      na ang lahat". Magkaibang bagay iyon, at magkaiba rin ang dapat mabasa.
    */
    CREATE TABLE IF NOT EXISTS sync_history (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid      TEXT NOT NULL,
      type      TEXT NOT NULL,
      label     TEXT,
      action    TEXT NOT NULL,
      record_id INTEGER,
      synced_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sync_history_time_idx ON sync_history (synced_at DESC);

    /*
      Ang tulay sa pagitan ng uuid na gawa ng cellphone at ng id na gawa ng
      server.

      BAKIT KAILANGAN. Kapag gumawa ng sambahayan habang walang signal, wala
      pa itong id — nasa pila pa lang ito, at uuid lang ang pagkakakilanlan.
      Pero kailangan itong matukoy ng residenteng itatalaga roon, at ang
      hinihingi ng server ay id. Dito naitatala ang naging id nito nang
      makarating na, kaya ang mga sumunod na talang naghihintay pa sa pila ay
      may mapagpapalitan bago sila ipadala.

      HIWALAY ITO SA TALAAN NG NAIPADALA AT SINASADYA IYON. Nabubura ng gumagamit
      ang talaan ng naipadala ("Clear list") — at kung doon nakasandal ang
      ugnayan, ang pagpindot niya roon ay puputol sa mga taling hindi pa
      naipapadala. Ang tulay na ito ay hindi nabubura ng sinuman.
    */
    CREATE TABLE IF NOT EXISTS id_map (
      uuid       TEXT PRIMARY KEY NOT NULL,
      type       TEXT NOT NULL,
      record_id  INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  await addOutboxEditColumns(db);

  return db;
}


async function addOutboxEditColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(outbox)');
  const existing = new Set(columns.map((column) => column.name));

  if (!existing.has('record_id')) {
    await db.execAsync('ALTER TABLE outbox ADD COLUMN record_id INTEGER');
  }

  if (!existing.has('expected_updated_at')) {
    await db.execAsync('ALTER TABLE outbox ADD COLUMN expected_updated_at TEXT');
  }
}

export async function getDatabase() {
  return open();
}

export type Cached<T> = {
  value: T;
  updatedAt: Date;
};


export async function putCache(key: string, value: unknown): Promise<void> {
  try {
    const db = await open();

    await db.runAsync(
      'INSERT OR REPLACE INTO cache (key, value, updated_at) VALUES (?, ?, ?)',
      key,
      JSON.stringify(value),
      Date.now()
    );
  } catch {
   
  }
}


export async function getCache<T>(key: string): Promise<Cached<T> | null> {
  try {
    const db = await open();

    const row = await db.getFirstAsync<{ value: string; updated_at: number }>(
      'SELECT value, updated_at FROM cache WHERE key = ?',
      key
    );

    if (!row) return null;

    return {
      value: JSON.parse(row.value) as T,
      updatedAt: new Date(row.updated_at),
    };
  } catch {
    return null;
  }
}


export async function removeCache(key: string): Promise<void> {
  try {
    const db = await open();
    await db.runAsync('DELETE FROM cache WHERE key = ?', key);
  } catch {
   
  }
}


export async function clearUserCache(): Promise<void> {
  try {
    const db = await open();
    await db.runAsync("DELETE FROM cache WHERE key NOT LIKE 'form.%'");
  } catch {
   
  }
}


export async function clearCache(): Promise<void> {
  try {
    const db = await open();
    await db.runAsync('DELETE FROM cache');
  } catch {
   
  }
}


export const CacheKey = {
  dashboard: 'dashboard',
  notifications: 'notifications',
  dismissedNotifications: 'notifications.dismissed',
  reports: 'reports',

 
  formOptions: 'form.options',
  formHouseholds: 'form.households',
  formFamilies: 'form.families',
  formResidents: 'form.residents',

  
  listResidents: 'list.residents',
  listFamilies: 'list.families',
  listHouseholds: 'list.households',
} as const;

export function dashboardCacheKey(barangayId: number | null): string {
  return barangayId ? `${CacheKey.dashboard}:${barangayId}` : CacheKey.dashboard;
}

export function recordCacheKey(type: string, id: number | string): string {
  return `record.${type}.${id}`;
}


export function reportCacheKey(filters: {
  barangay_id?: number | null;
  purok_id?: number | null;
  sex?: string | null;
  age_group?: string | null;
}): string {
  const parts = [
    filters.barangay_id ?? '',
    filters.purok_id ?? '',
    filters.sex ?? '',
    filters.age_group ?? '',
  ];

  return `${CacheKey.reports}:${parts.join('|')}`;
}
