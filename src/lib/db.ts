import * as SQLite from 'expo-sqlite';

/**
 * Lokal na cache ng app.
 *
 * MAHALAGA — HINDI NAKA-ENCRYPT ANG SQLITE SA EXPO GO (walang SQLCipher).
 * Kaya dito ay datos lang na ipinapakita ang inilalagay: dashboard, abiso,
 * at mamaya ang listahan ng residente at household. Ang token, PIN hash at
 * anumang sensitibo ay nasa expo-secure-store — doon lang, kasi naka-encrypt
 * iyon ng Android Keystore / iOS Keychain.
 *
 * Isang simpleng key-value table lang ang gamit. Sapat na ito para sa mga
 * buong sagot ng API, at madaling dagdagan ng tunay na table kapag kailangan
 * nang mag-query at mag-filter ng listahan offline.
 */

const DB_NAME = 'ibis.db';

let database: SQLite.SQLiteDatabase | null = null;

async function open() {
  if (database) return database;

  database = await SQLite.openDatabaseAsync(DB_NAME);

  await database.execAsync(`
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
  `);

  return database;
}

/** Ibinubukas ang database para magamit ng ibang module (outbox, sync). */
export async function getDatabase() {
  return open();
}

export type Cached<T> = {
  value: T;
  /** Kailan ito huling nakuha mula sa server. */
  updatedAt: Date;
};

/**
 * Iniimbak ang huling matagumpay na sagot ng server.
 * Hindi nagpapasabog kapag nabigo — cache lang naman ito.
 */
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
    // Kung hindi makasulat, tuloy pa rin ang app — mawawalan lang ng offline copy.
  }
}

/**
 * Kinukuha ang huling naka-imbak na sagot. Null kung wala pa.
 */
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

/** Tinatanggal ang isang entry — halimbawa kapag na-clear ang notifications. */
export async function removeCache(key: string): Promise<void> {
  try {
    const db = await open();
    await db.runAsync('DELETE FROM cache WHERE key = ?', key);
  } catch {
    // walang anuman
  }
}

/**
 * Binubura ang datos ng user — dashboard, abiso, ulat — pero PINAPANATILI ang
 * laman ng registration form.
 *
 * Ang laman ng form ay listahan ng barangay (purok, civil status, household),
 * hindi pag-aari ng sinumang user. Kung buburahin ito sa bawat logout, hindi
 * na bubukas ang form sa susunod na pagpasok kung walang signal — at iyon
 * mismo ang sandaling pinakakailangan ito.
 */
export async function clearUserCache(): Promise<void> {
  try {
    const db = await open();
    await db.runAsync("DELETE FROM cache WHERE key NOT LIKE 'form.%'");
  } catch {
    // walang anuman
  }
}

/**
 * Binubura ang lahat ng naka-cache, kasama ang laman ng form. Para sa tuluyang
 * pag-alis sa device, kung saan maaaring iba na ang susunod na gagamit.
 */
export async function clearCache(): Promise<void> {
  try {
    const db = await open();
    await db.runAsync('DELETE FROM cache');
  } catch {
    // walang anuman
  }
}

/** Mga key na ginagamit sa buong app. */
export const CacheKey = {
  dashboard: 'dashboard',
  notifications: 'notifications',
  dismissedNotifications: 'notifications.dismissed',
  reports: 'reports',

  /*
    Ang kailangan ng registration form bago pa ito lumitaw. Kung wala nito,
    hindi mabubuksan ang form nang walang signal — at walang saysay ang
    offline na pag-save kung hindi mo naman maabot ang form.
  */
  formOptions: 'form.options',
  formHouseholds: 'form.households',
  formFamilies: 'form.families',
  formResidents: 'form.residents',

  /*
    Laman ng tatlong tab na listahan. Ang walang hanap lang ang itinatabi —
    ang resulta ng paghahanap ay panandalian at hindi kapaki-pakinabang offline.
  */
  listResidents: 'list.residents',
  listFamilies: 'list.families',
  listHouseholds: 'list.households',
} as const;
