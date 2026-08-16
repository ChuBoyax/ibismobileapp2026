import Constants from 'expo-constants';

import { getToken } from '@/lib/auth-storage';

/**
 * Kliyente ng IBIS backend (/api/ibis/*).
 *
 * Nasa app.json ang base URL (expo.extra.apiBaseUrl) — iyon ang ginagamit sa
 * totoong build. Sa development, ang IP ng laptop ang madalas magpalit (bagong
 * DHCP lease, ibang WiFi), at tuwing mangyayari iyon ay tumitigil ang app kahit
 * walang nabago sa code. Dahil sa iisang makina tumatakbo ang Metro at ang
 * Laravel, ang host ng Metro na mismo ang pinagkukunan ng API host kapag naka-
 * dev — kaya sumasabay ito sa bawat palit ng IP nang walang inaayos.
 */

const DEV_API_PORT = 8000;

/** Hinahango ang host mula sa `hostUri` ng Metro, hal. "192.168.0.103:8081". */
function apiHostFromMetro(): string | null {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];

  return host ? `http://${host}:${DEV_API_PORT}` : null;
}

const BASE_URL: string =
  (__DEV__ ? apiHostFromMetro() : null) ??
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  'http://127.0.0.1:8000';

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

/** Error na may dalang status code para maiba ang mensahe kada sitwasyon. */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {}
): Promise<T> {
  const { method = 'GET', body, token } = options;

  // Walang built-in na timeout ang fetch, kaya AbortController ang gamit.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(`${BASE_URL}/api/ibis${path}`, {
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
    // Abort, walang WiFi, maling IP, o patay ang server — pare-parehong
    // walang naabot na server, kaya iisang mensahe.
    const aborted = error instanceof Error && error.name === 'AbortError';
    throw new ApiError(
      aborted
        ? 'The server took too long to respond. Please try again.'
        : 'Cannot reach the server. Check your connection and try again.',
      0
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
  });
}

export async function me() {
  const token = await getToken();
  return request<{ user: ApiUser }>('/me', { token });
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

export type DashboardData = {
  barangays: string[];
  stats: {
    residents: Stat;
    families: Stat;
    households: Stat;
    pending_documents: Stat;
  };
  activity: ActivityItem[];
};

export async function dashboard() {
  const token = await getToken();
  return request<DashboardData>('/dashboard', { token });
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

/** Para maipakita sa Settings kung saan nakakabit ang app. */
export const apiBaseUrl = BASE_URL;

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
  full_name: string;
  sex: string | null;
  age: number | null;
  civil_status: string | null;
  purok: string | null;
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
  house_number: string | null;
  house_type: string | null;
  ownership_type: string | null;
  number_of_residents: number | null;
  residents_count: number;
  has_business: boolean;
  business_name: string | null;
};

export type FamilySummary = {
  id: number;
  uuid: string | null;
  family_name: string | null;
  head_name: string | null;
  family_type: string | null;
  income_level: string | null;
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
    const name = value.split('/').pop() || 'photo.jpg';
    const extension = name.split('.').pop()?.toLowerCase();

    form.append(key, {
      uri: value,
      name,
      type: extension === 'png' ? 'image/png' : 'image/jpeg',
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

async function authed<T>(path: string, options: { method?: string; body?: unknown } = {}) {
  const token = await getToken();
  return request<T>(path, { ...options, token });
}

/** Laman ng lahat ng dropdown. Isang tawag lang sa pagbukas ng form. */
export async function fetchOptions() {
  return authed<{ barangay_id: number; options: OptionGroups }>('/options');
}

function listQuery(params: { search?: string; perPage?: number } = {}) {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set('search', params.search.trim());
  if (params.perPage) query.set('per_page', String(params.perPage));

  const suffix = query.toString();
  return suffix ? `?${suffix}` : '';
}

export function listResidents(params?: { search?: string; perPage?: number }) {
  return authed<Paginated<ResidentSummary>>(`/residents${listQuery(params)}`);
}

export function listHouseholds(params?: { search?: string; perPage?: number }) {
  return authed<Paginated<HouseholdSummary>>(`/households${listQuery(params)}`);
}

export function listFamilies(params?: { search?: string; perPage?: number }) {
  return authed<Paginated<FamilySummary>>(`/families${listQuery(params)}`);
}

export function createResident(payload: RecordPayload) {
  return authed<{ data: { id: number }; message: string }>('/residents', {
    method: 'POST',
    body: hasFiles(payload) ? toFormData(payload) : payload,
  });
}

export function createHousehold(payload: RecordPayload) {
  return authed<{ data: { id: number }; message: string }>('/households', {
    method: 'POST',
    body: hasFiles(payload) ? toFormData(payload) : payload,
  });
}

export function createFamily(payload: RecordPayload) {
  return authed<{ data: { id: number }; message: string }>('/families', {
    method: 'POST',
    body: hasFiles(payload) ? toFormData(payload) : payload,
  });
}
