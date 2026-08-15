import Constants from 'expo-constants';

import { getToken } from '@/lib/auth-storage';

/**
 * Kliyente ng IBIS backend (/api/ibis/*).
 *
 * Nasa app.json ang base URL (expo.extra.apiBaseUrl). Palitan mo lang doon
 * kapag nagbago ang IP ng laptop mo o kapag nasa totoong server na.
 */

const BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? 'http://127.0.0.1:8000';

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
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
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
