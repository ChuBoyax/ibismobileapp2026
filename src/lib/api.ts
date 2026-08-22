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


export class ApiError extends Error {
  status: number;

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
   
    timeout?: number;
  } = {}
): Promise<T> {
  const { method = 'GET', body, token, timeout = TIMEOUT_MS } = options;

  
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response: Response;

  try {
    response = await fetch(`${serverUrl()}/api/ibis${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
       
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
   
    throw new ApiError('The server returned an unexpected response.', response.status);
  }

  if (!response.ok) {
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
  
    timeout: 6000,
  });
}

export async function me() {
  const token = await getToken();
  return request<{ user: ApiUser }>('/me', { token });
}


export async function serverReachable(): Promise<boolean> {
  const token = await getToken();

  try {
    await request('/me', { token, timeout: 3000 });
    return true;
  } catch (error) {
    return !(error instanceof ApiError && error.status === 0);
  }
}

export function payloadHasFiles(payload: RecordPayload): boolean {
  return hasFiles(payload);
}

export type Stat = {
  total: number;
  new_this_month: number;
};


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

export type DashboardScope = 'barangay' | 'municipal';

export type BarangayChoice = {
  id: number;
  name: string;
};

export type DashboardData = {
 
  barangays: string[];
  scope?: DashboardScope;
 
  available_barangays?: BarangayChoice[];
  stats: {
    residents: Stat;
    families: Stat;
    households: Stat;
    pending_documents: Stat;
  };
  activity: ActivityItem[];
};

export async function dashboard(barangayId?: number | null) {
  const token = await getToken();
  const query = barangayId ? `?barangay_id=${barangayId}` : '';

  return request<DashboardData>(`/dashboard${query}`, { token });
}

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


  const query = Object.entries(filters)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');

  return request<ReportData>(`/reports${query ? `?${query}` : ''}`, { token });
}



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


export async function logout() {
  try {
    const token = await getToken();
    if (token) await request('/logout', { method: 'POST', token, timeout: 4000 });
  } catch {
   
  }
}




export type ApiOption = {
  id: number;
  name: string;
};


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


export type RecordPayload = Record<string, unknown>;


const isLocalFile = (value: unknown): value is string =>
  typeof value === 'string' && /^(file|content):\/\//.test(value);


function appendTo(form: FormData, key: string, value: unknown): void {
  if (value === null || value === undefined) return;

  if (isLocalFile(value)) {
    const name = value.split('/').pop()?.split('?')[0] || 'photo.jpg';
    const extension = name.split('.').pop()?.toLowerCase();

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


export async function fetchOptions() {
  return authed<{ barangay_id: number; options: OptionGroups }>('/options');
}


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


export function recordPhotoUrl(
  type: 'resident' | 'household',
  id: number,
  field: string
): string {
  const collection = type === 'resident' ? 'residents' : 'households';

  return `${serverUrl()}/api/ibis/${collection}/${id}/photos/${field}`;
}


export async function photoHeaders(): Promise<Record<string, string>> {
  const token = await getToken();

  return token ? { Authorization: `Bearer ${token}` } : {};
}


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
