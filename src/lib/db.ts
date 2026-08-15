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
  `);

  return database;
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
 * Binubura ang lahat ng naka-cache. Tinatawag kapag nag-logout — hindi dapat
 * makita ng susunod na user ang datos ng nauna.
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
} as const;
