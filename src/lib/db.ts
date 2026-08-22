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

/**
 * ANG PROMISE ANG ITINATAGO, HINDI ANG RESULTA — at mahalaga ang pagkakaiba.
 *
 * Dati, ang naka-bukas nang database ang itinatago. Pero sa pagitan ng
 * pagsisimula ng pagbukas at ng pagkakatago nito, ang sinumang tumawag ay
 * makikitang wala pa — kaya magbubukas siya ng PANGALAWANG koneksyon at
 * uulitin ang paggawa ng table. Mas masahol: may makakakuha ng database bago
 * pa matapos ang CREATE TABLE, at magtatanong sa table na wala pa.
 *
 * Nangyayari ito sa pagbukas ng app, kung saan sabay-sabay na humihingi ang
 * dashboard, ang sync engine, at ang profile. Paminsan-minsan lang ito
 * bumabagsak — kaya mahirap hulihin at madaling isipin na ibang bagay ang sira.
 *
 * Sa pagtatago ng promise, iisa lang ang tunay na pagbukas gaano man karami
 * ang sabay na humingi. Kapag nabigo, binubura ito para may pag-asa pa ang
 * susunod na subok.
 */
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

/**
 * Dinaragdagan ang `outbox` ng dalawang column na kailangan ng pag-edit.
 *
 * MAY APP NA SA CELLPHONE NG MGA GUMAGAMIT, at may naka-queue nang tala doon.
 * Kaya hindi puwedeng basta ipalit ang bagong CREATE TABLE — mananatili ang
 * lumang anyo at mabibigo ang bawat pagsingit. Dinaragdagan na lang ang
 * kulang, at ang mga dating naka-queue ay mananatiling paglikha (walang
 * `record_id`) tulad ng inaasahan nila.
 *
 *   record_id           — alin ang binabago; kapag wala, paglikha ito
 *   expected_updated_at — kailan huling nagbago ang tala nang kunin ito, kaya
 *                         natutukoy kung may ibang nakaunang magpalit
 */
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

/**
 * Ang buong tala ng isang residente/sambahayan/pamilya, para sa pag-edit.
 *
 * BUOD LANG ANG NASA LISTAHAN — pangalan, purok, edad. Hindi sapat iyon para
 * punuin ang labing-isang hakbang ng form. Kaya sa bawat pagbukas ng isang
 * tala habang may signal, itinatabi ang buong laman nito: kapag nasa bundok
 * na ang enumerator at kailangang itama ang isang numero, nariyan pa rin.
 */
/**
 * Sariling susi kada napiling barangay sa dashboard.
 *
 * Kung iisa lang ang susi, ang bilang ng isang barangay ay maipapakita habang
 * nakasulat sa chip ang pangalan ng iba — at ang numerong mukhang totoo pero
 * mali ay mas mapanganib kaysa sa walang numero.
 */
export function dashboardCacheKey(barangayId: number | null): string {
  return barangayId ? `${CacheKey.dashboard}:${barangayId}` : CacheKey.dashboard;
}

export function recordCacheKey(type: string, id: number | string): string {
  return `record.${type}.${id}`;
}

/**
 * Sariling susi kada kombinasyon ng filter sa ulat.
 *
 * BAKIT HINDI IISA LANG ANG SUSI. Ang itinatago ng ulat ay BUOD na bilang,
 * hindi hilaw na tala — kaya hindi ito kayang salain sa cellphone tulad ng
 * ginagawa natin sa listahan. Kung iisa lang ang susi, ang pagpili ng purok
 * habang walang koneksyon ay magpapakita ng bilang ng BUONG barangay habang
 * nakasulat sa chip na "Purok 1". Mas masahol pa iyon kaysa walang ipakita:
 * mukhang totoo ang numero, pero mali.
 *
 * Sa hiwalay na susi, ang nakita mo nang kombinasyon habang online ay
 * mababalikan mo offline — at ang hindi pa nakikita ay malinaw na sasabihing
 * kailangan ng koneksyon.
 */
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
