import { File } from 'expo-file-system';

import { getToken } from '@/lib/auth-storage';
import { isDeviceOnline } from '@/lib/connectivity';
import { serverUrl } from '@/lib/server-url';

/**
 * Kliyente ng IBIS backend (/api/ibis/*).
 *
 * Nasa server-url.ts ang pagpili ng address: ang host ng Metro kapag naka-dev,
 * at ang nakasulat sa app.json (`expo.extra.apiBaseUrl`) kapag totoong build.
 */

/** Ilang segundo bago sumuko ang request. */
const TIMEOUT_MS = 15000;

export type ApiUser = {
  id: number;
  name: string;
  email: string;
  role: string | null;
  roles: string[];
  barangays: { id: number; name: string }[];
};

export type LoginResult = {
  token: string;
  user: ApiUser;
};

/**
 * Error na may dalang status code para maiba ang mensahe kada sitwasyon.
 *
 * DALAWA ANG ANYO NG MENSAHE, at sinasadya iyon:
 *
 *   message — para sa user. Malinis, walang jargon, at may sinasabi kung ano
 *             ang ibig sabihin. Ito ang ipinapakita sa screen.
 *   detail  — para sa nag-aayos. Ang hilaw na dahilan mula sa sistema, hal.
 *             "java.net.UnknownHostException". Nasa Sync queue lang ito.
 *
 * Dating iisa lang ang mensahe. Nakatulong iyon sa paghahanap ng bug, pero
 * mali ang ipakita sa user ang pangalan ng Java class — walang masasabi iyon
 * sa kanya at nagmumukhang sira ang app.
 */
export class ApiError extends Error {
  status: number;
  /** Hilaw na dahilan. Hindi ipinapakita sa karaniwang screen. */
  detail?: string;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string | null;
    /** Mas maikli para sa login — mabilis dapat malaman kung offline. */
    timeout?: number;
  } = {}
): Promise<T> {
  const { method = 'GET', body, token, timeout = TIMEOUT_MS } = options;

  // Walang built-in na timeout ang fetch, kaya AbortController ang gamit.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response: Response;

  try {
    response = await fetch(`${serverUrl()}/api/ibis${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        // Ang FormData lang ang nakakaalam ng sariling boundary nito, kaya
        // hinahayaang ito ang magtakda ng Content-Type kapag may kalakip na file.
        ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    const detail = error instanceof Error ? error.message : undefined;

    if (aborted) {
      throw new ApiError('The server took too long to respond. Please try again.', 0, detail);
    }

    // Tinatanong ang cellphone para tumpak ang sasabihin. Malaki ang
    // pagkakaiba nito para sa user: kung walang signal, may magagawa siya;
    // kung patay naman ang server, wala — at dapat malinaw kung alin.
    const offline = !(await isDeviceOnline());

    throw new ApiError(
      offline ? 'No internet connection.' : 'Cannot reach the server. Please try again in a moment.',
      0,
      detail
    );
  } finally {
    clearTimeout(timer);
  }

  const raw = await response.text();
  let data: any = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    // Hindi JSON ang sagot — kadalasan HTML error page ng Laravel.
    throw new ApiError('The server returned an unexpected response.', response.status);
  }

  if (!response.ok) {
    // Sinusundan ang hugis ng Laravel: {"message": "...", "errors": {...}}
    const firstError =
      data?.errors && typeof data.errors === 'object'
        ? (Object.values(data.errors)[0] as string[] | undefined)?.[0]
        : undefined;

    throw new ApiError(firstError ?? data?.message ?? 'Something went wrong.', response.status);
  }

  return data as T;
}

export function login(email: string, password: string) {
  return request<LoginResult>('/login', {
    method: 'POST',
    body: { email, password, device_name: 'ibis-mobile' },
    // Mas maikli kaysa sa karaniwan: kapag hindi maabot ang server, mas mabuting
    // malaman agad at dumaan sa offline na pagpasok kaysa magmukhang nakatunganga
    // ang app nang labinlimang segundo.
    timeout: 6000,
  });
}

export async function me() {
  const token = await getToken();
  return request<{ user: ApiUser }>('/me', { token });
}

/**
 * Sumasagot ba ang server? Maikling tanong, maikling hintay.
 *
 * Ginagamit bago ang mabagal na pag-upload ng larawan. Kung wala nito, ang
 * pag-save habang patay ang server ay maghihintay ng buong timeout ng upload —
 * animnapung segundo ng "Saving…" bago pa man mapunta sa pila, gayong tatlong
 * segundo lang ang kailangan para malaman na walang sasagot.
 *
 * Kahit 401 ang isagot, abot pa rin ang server — ang mahalaga ay may sumagot.
 */
export async function serverReachable(): Promise<boolean> {
  const token = await getToken();

  try {
    await request('/me', { token, timeout: 3000 });
    return true;
  } catch (error) {
    return !(error instanceof ApiError && error.status === 0);
  }
}

/** Totoo kapag may larawan ang payload — mas matagal ang padala nito. */
export function payloadHasFiles(payload: RecordPayload): boolean {
  return hasFiles(payload);
}

export type Stat = {
  total: number;
  new_this_month: number;
};

/** Isang linya sa detail sheet. Ang backend ang pumipili kung ano ang laman. */
export type ActivityDetail = {
  label: string;
  value: string | number;
};

export type ActivityItem = {
  id: string;
  type: 'resident' | 'household' | 'document';
  title: string;
  subtitle: string;
  at: string;
  details: ActivityDetail[];
};

/**
 * Barangay ba o buong bayan ang nasasakupan ng naka-login?
 *
 * Ang server ang nagpapasiya nito mula sa tungkulin, hindi ang app — doon
 * nakatira ang tunay na kaalaman kung sino ang may pahintulot saan.
 */
export type DashboardScope = 'barangay' | 'municipal';

/** Isang barangay na maaaring piliin sa salain. */
export type BarangayChoice = {
  id: number;
  name: string;
};

export type DashboardData = {
  /** Ang kasalukuyang tinitingnan — isa kapag may pinili, lahat kapag wala. */
  barangays: string[];
  scope?: DashboardScope;
  /** Lahat ng nasasakupan, kahit isa lang ang tinitingnan ngayon. */
  available_barangays?: BarangayChoice[];
  stats: {
    residents: Stat;
    families: Stat;
    households: Stat;
    pending_documents: Stat;
  };
  activity: ActivityItem[];
};

/**
 * Ang bilang sa dashboard.
 *
 * Kapag may ipinasang barangay, doon lang ang bilang. Kapag wala, lahat ng
 * nasasakupan ng naka-login — iyon ang buod ng buong bayan para sa
 * tagapangasiwa, at iisang barangay pa rin para sa karaniwang user.
 */
export async function dashboard(barangayId?: number | null) {
  const token = await getToken();
  const query = barangayId ? `?barangay_id=${barangayId}` : '';

  return request<DashboardData>(`/dashboard${query}`, { token });
}

// ── Reports ─────────────────────────────────────────────────────────────

export type ReportSlice = {
  label: string;
  value: number;
  percent?: number;
};

export type ReportFilters = {
  barangay_id?: number | null;
  purok_id?: number | null;
  sex?: string | null;
  age_group?: string | null;
};

export type ReportData = {
  generated_at: string;
  barangays: string[];
  filters: {
    barangays: { id: number; label: string }[];
    puroks: { id: number; label: string }[];
    sexes: string[];
    age_groups: { key: string; label: string }[];
  };
  applied: Required<ReportFilters>;
  /** True kapag may filter na nagpapaliit ng bilang ng residente. */
  narrowed: boolean;
  population: {
    total: number;
    average_age: number | null;
    sex: ReportSlice[];
    age_groups: ReportSlice[];
    civil_status: ReportSlice[];
    purok: ReportSlice[];
    voters: { registered: number; voting_age: number; percent: number };
    registry_status: ReportSlice[];
  };
  sectors: ReportSlice[];
  households: {
    total: number;
    average_size: number | null;
    utilities: ReportSlice[];
    ownership: ReportSlice[];
    house_type: ReportSlice[];
  };
  families: {
    total: number;
    income_levels: ReportSlice[];
    types: ReportSlice[];
  };
};

export async function reports(filters: ReportFilters = {}) {
  const token = await getToken();

  // Ang walang laman ay hindi ipinapadala — mas malinis ang URL at mas
  // madaling basahin sa server log kung ano talaga ang sinala.
  const query = Object.entries(filters)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');

  return request<ReportData>(`/reports${query ? `?${query}` : ''}`, { token });
}

// ── Notifications ───────────────────────────────────────────────────────

export type Notification = {
  id: string;
  type: 'resident' | 'household' | 'document';
  level: 'info' | 'warning' | 'success';
  title: string;
  body: string;
  at: string | null;
};

export async function notifications() {
  const token = await getToken();
  return request<{ notifications: Notification[]; unread: number }>('/notifications', { token });
}

// ── Account ─────────────────────────────────────────────────────────────

export type Account = {
  id: number;
  name: string;
  email: string;
  role: string | null;
  barangays: { id: number; name: string }[];
  member_since: string | null;
};

export async function account() {
  const token = await getToken();
  return request<{ account: Account }>('/account', { token });
}

export async function updateAccount(name: string, email: string) {
  const token = await getToken();
  return request<{ message: string; account: Account }>('/account', {
    method: 'PUT',
    token,
    body: { name, email },
  });
}

export async function updatePassword(
  currentPassword: string,
  password: string,
  passwordConfirmation: string
) {
  const token = await getToken();
  return request<{ message: string }>('/account/password', {
    method: 'PUT',
    token,
    body: {
      current_password: currentPassword,
      password,
      password_confirmation: passwordConfirmation,
    },
  });
}

/** Binubura ang token sa server. Hindi nagpapasabog kapag nabigo. */
export async function logout() {
  try {
    const token = await getToken();
    if (token) await request('/logout', { method: 'POST', token });
  } catch {
    // Offline man o expired na ang token, tuloy pa rin ang lokal na logout.
  }
}

/* ── Registration ───────────────────────────────────────────────────── */

/** Isang option na galing sa `options` na talahanayan ng RBI. */
export type ApiOption = {
  id: number;
  name: string;
};

/** Naka-grupo ayon sa kategorya, hal. `civil_status`, `blood_type`. */
export type OptionGroups = Record<string, ApiOption[]>;

export type Paginated<T> = {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

export type ResidentSummary = {
  id: number;
  uuid: string | null;
  barangay_id: number | null;
  full_name: string;
  sex: string | null;
  age: number | null;
  civil_status: string | null;
  civil_status_id: number | null;
  purok: string | null;
  purok_id: number | null;
  contact_number: string | null;
  is_4ps_member: boolean;
  pwd: boolean;
  senior: boolean;
  solo_parent: boolean;
  osy: boolean;
};

export type HouseholdSummary = {
  id: number;
  uuid: string | null;
  barangay_id: number | null;
  house_number: string | null;
  house_type: string | null;
  house_type_id: number | null;
  ownership_type: string | null;
  ownership_type_id: number | null;
  purok: string | null;
  purok_id: number | null;
  number_of_residents: number | null;
  residents_count: number;
  has_business: boolean;
  business_name: string | null;
};

export type FamilySummary = {
  id: number;
  uuid: string | null;
  barangay_id: number | null;
  family_name: string | null;
  head_name: string | null;
  family_type: string | null;
  family_type_id: number | null;
  income_level: string | null;
  income_level_id: number | null;
  members_count: number;
};

/** Anumang payload ng registration form, kasama ang mga naka-nest na tala. */
export type RecordPayload = Record<string, unknown>;

/** Larawang galing sa camera o gallery — file:// ang anyo ng URI nito. */
const isLocalFile = (value: unknown): value is string =>
  typeof value === 'string' && /^(file|content):\/\//.test(value);

/**
 * Pinapatag ang payload tungo sa FormData.
 *
 * Kailangan ito kapag may larawan: hindi kayang magdala ng file ang JSON.
 * Sinusunod ang bracket na paraan ng Laravel (`educations[0][school_id]`)
 * para makilala pa rin nito ang mga naka-nest na tala at array.
 */
function appendTo(form: FormData, key: string, value: unknown): void {
  if (value === null || value === undefined) return;

  if (isLocalFile(value)) {
    const name = value.split('/').pop()?.split('?')[0] || 'photo.jpg';
    const extension = name.split('.').pop()?.toLowerCase();

    // ANG LUMANG ANYO NA { uri, name, type } AY HINDI NA TANGGAP.
    //
    // Simula SDK 54, sariling fetch na ang Expo — hindi na ang sa React
    // Native. Tatlo lang ang tinatanggap nito: string, Blob, o bagay na may
    // bytes(). Ang lumang paraan ay nagpapabagsak agad ng pagpapadala bago pa
    // ito umalis, at ang lumalabas ay "Unsupported FormDataPart
    // implementation" — na madaling mapagkamalang problema sa koneksyon.
    //
    // Ibinibigay pa rin ang `name`: batay doon ng PHP kung file ba ito o
    // ordinaryong field. Kung wala, hindi makikita ng $request->hasFile()
    // ang larawan at tahimik itong mawawala.
    const file = new File(value);

    form.append(key, {
      name,
      type: file.type ?? (extension === 'png' ? 'image/png' : 'image/jpeg'),
      bytes: () => file.bytes(),
    } as unknown as Blob);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (item !== null && typeof item === 'object') {
        for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
          appendTo(form, `${key}[${index}][${k}]`, v);
        }
      } else {
        appendTo(form, `${key}[]`, item);
      }
    });
    return;
  }

  if (typeof value === 'boolean') {
    form.append(key, value ? '1' : '0');
    return;
  }

  form.append(key, String(value));
}

function toFormData(payload: RecordPayload): FormData {
  const form = new FormData();

  for (const [key, value] of Object.entries(payload)) {
    appendTo(form, key, value);
  }

  return form;
}

/** May kasamang larawan ang payload, kahit nasa loob ng repeater. */
function hasFiles(value: unknown): boolean {
  if (isLocalFile(value)) return true;
  if (Array.isArray(value)) return value.some(hasFiles);
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(hasFiles);
  }

  return false;
}

async function authed<T>(
  path: string,
  options: { method?: string; body?: unknown; timeout?: number } = {}
) {
  const token = await getToken();
  return request<T>(path, { ...options, token });
}

/** Laman ng lahat ng dropdown. Isang tawag lang sa pagbukas ng form. */
export async function fetchOptions() {
  return authed<{ barangay_id: number; options: OptionGroups }>('/options');
}

/**
 * Kung paano sinasala ang isang listahan.
 *
 * Bukas ang hugis — bawat modulo ay may sariling dimensyon (purok at
 * kasarian sa residente, uri ng bahay sa sambahayan), at pare-pareho naman
 * ang pagdadala nila: pangalan ng param at halaga. Ang null ay "lahat".
 */
export type ListFilters = Record<string, string | number | null | undefined>;

type ListParams = {
  search?: string;
  perPage?: number;
  full?: boolean;
  filters?: ListFilters;
};

function listQuery(params: ListParams = {}) {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set('search', params.search.trim());
  if (params.perPage) query.set('per_page', String(params.perPage));
  if (params.full) query.set('full', '1');

  for (const [key, value] of Object.entries(params.filters ?? {})) {
    if (value !== null && value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  }

  const suffix = query.toString();
  return suffix ? `?${suffix}` : '';
}

export function listResidents(params?: ListParams) {
  return authed<Paginated<ResidentSummary>>(`/residents${listQuery(params)}`);
}

export function listHouseholds(params?: ListParams) {
  return authed<Paginated<HouseholdSummary>>(`/households${listQuery(params)}`);
}

export function listFamilies(params?: ListParams) {
  return authed<Paginated<FamilySummary>>(`/families${listQuery(params)}`);
}

/*
  ANG BUONG LAMAN NG BAWAT TALA, PARA SA PAG-EDIT NANG WALANG SIGNAL.

  Buod lang ang ibinabalik ng listahan sa itaas — pangalan, edad, purok.
  Sapat iyon para sa card, kulang para punuin ang labing-isang hakbang ng
  form. Kung ang buong laman ay kukunin lang isa-isa kapag pinindot, ang
  pag-edit sa bundok ay gagana lang sa mga talang nagkataong nabuksan na
  dati — at hindi mo naman alam nang maaga kung sino ang lalapit sa iyo.

  Isang request kada uri, ang buong barangay ay nae-edit offline.
*/
export type FullListPage<T> = Paginated<T> & { records?: FullRecord[] };

type FullListParams = { search?: string; perPage?: number; filters?: ListFilters };

export function listResidentsFull(params?: FullListParams) {
  return authed<FullListPage<ResidentSummary>>(`/residents${listQuery({ ...params, full: true })}`);
}

export function listHouseholdsFull(params?: FullListParams) {
  return authed<FullListPage<HouseholdSummary>>(
    `/households${listQuery({ ...params, full: true })}`
  );
}

export function listFamiliesFull(params?: FullListParams) {
  return authed<FullListPage<FamilySummary>>(`/families${listQuery({ ...params, full: true })}`);
}

/**
 * Gaano katagal hihintayin ang pag-save.
 *
 * PURONG TEKSTO — maikli. Ligtas itong paikliin dahil idempotent ang server
 * sa uuid: kung nakapasok pala ang tala at natimeout lang tayo, ang muling
 * pagpapadala ay sasagutin ng "already recorded". Mas mabuting isuko agad at
 * ipadala sa likod kaysa panoorin ng user ang "Saving…".
 *
 * MAY LARAWAN — mahaba. Ang pag-upload ng litrato ay hindi kasingbilis ng
 * pagpapadala ng ilang linya ng teksto; sa mahinang signal, umaabot ito ng
 * kalahating minuto. Kung paiikliin din ito, HINDI KAILANMAN MAIPAPADALA ANG
 * TALANG MAY LARAWAN — mabibigo ito sa pag-save at mabibigo ulit sa bawat
 * pagsubok ng sync, magpakailanman.
 */
const TEXT_TIMEOUT_MS = 8000;
const UPLOAD_TIMEOUT_MS = 60_000;

function createOptions(payload: RecordPayload, timeout?: number) {
  const files = hasFiles(payload);

  return {
    method: 'POST',
    body: files ? toFormData(payload) : payload,
    timeout: timeout ?? (files ? UPLOAD_TIMEOUT_MS : TEXT_TIMEOUT_MS),
  };
}

/** Ang pagpapadala mula sa pila ay walang nanonood, kaya pwedeng maghintay. */
export type CreateOptions = { timeout?: number };

export function createResident(payload: RecordPayload, options: CreateOptions = {}) {
  return authed<{ data: { id: number }; message: string }>(
    '/residents',
    createOptions(payload, options.timeout)
  );
}

export function createHousehold(payload: RecordPayload, options: CreateOptions = {}) {
  return authed<{ data: { id: number }; message: string }>(
    '/households',
    createOptions(payload, options.timeout)
  );
}

export function createFamily(payload: RecordPayload, options: CreateOptions = {}) {
  return authed<{ data: { id: number }; message: string }>(
    '/families',
    createOptions(payload, options.timeout)
  );
}

// ── Pag-edit ────────────────────────────────────────────────────────────

/** Ang buong laman ng isang tala, kasama ang mga naka-ugnay na listahan. */
export type FullRecord = Record<string, unknown> & { id: number; updated_at?: string | null };

export function showResident(id: number) {
  return authed<{ data: FullRecord }>(`/residents/${id}`);
}

export function showHousehold(id: number) {
  return authed<{ data: FullRecord }>(`/households/${id}`);
}

export function showFamily(id: number) {
  return authed<{ data: FullRecord }>(`/families/${id}`);
}

/*
  POST ANG GINAGAMIT, HINDI PUT.

  Hindi binabasa ng PHP ang multipart body ng PUT — walang laman ang $_FILES
  at $_POST doon, kaya mawawala ang bagong larawan nang tahimik. Tumatanggap
  ng pareho ang ruta sa backend, kaya iisang paraan na lang ang ginagamit
  dito: POST, may larawan man o wala.
*/
function updateOptions(payload: RecordPayload, timeout?: number) {
  const files = hasFiles(payload);

  return {
    method: 'POST',
    body: files ? toFormData(payload) : payload,
    timeout: timeout ?? (files ? UPLOAD_TIMEOUT_MS : TEXT_TIMEOUT_MS),
  };
}

export function updateResident(id: number, payload: RecordPayload, options: CreateOptions = {}) {
  return authed<{ data: FullRecord; message: string }>(
    `/residents/${id}`,
    updateOptions(payload, options.timeout)
  );
}

export function updateHousehold(id: number, payload: RecordPayload, options: CreateOptions = {}) {
  return authed<{ data: FullRecord; message: string }>(
    `/households/${id}`,
    updateOptions(payload, options.timeout)
  );
}

export function updateFamily(id: number, payload: RecordPayload, options: CreateOptions = {}) {
  return authed<{ data: FullRecord; message: string }>(
    `/families/${id}`,
    updateOptions(payload, options.timeout)
  );
}
