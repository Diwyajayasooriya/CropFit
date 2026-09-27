// ============================================================
// CropFit — Central Fetch Wrapper
// Attaches JWT token to every request.
// Falls back to mock data when the backend is unreachable.
// ============================================================

import type { AuthTokens, ApiError } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

// --------------- Token helpers ---------------

let tokens: AuthTokens | null = null;

export function setTokens(t: AuthTokens) {
  tokens = t;
  if (typeof window !== 'undefined') {
    localStorage.setItem('cropfit_tokens', JSON.stringify(t));
    document.cookie = `cropfit_auth=1; path=/; max-age=604800; SameSite=Lax`;
  }
}

export function getTokens(): AuthTokens | null {
  if (tokens) return tokens;
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('cropfit_tokens');
    if (raw) {
      tokens = JSON.parse(raw) as AuthTokens;
      return tokens;
    }
  }
  return null;
}

export function clearTokens() {
  tokens = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('cropfit_tokens');
    document.cookie = 'cropfit_auth=; path=/; max-age=0; SameSite=Lax';
  }
}

// --------------- Token refresh ---------------

let refreshPromise: Promise<AuthTokens> | null = null;

async function refreshAccessToken(): Promise<AuthTokens> {
  const current = getTokens();
  if (!current?.refresh) throw new Error('No refresh token');

  const res = await fetch(`${API_BASE}/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: current.refresh }),
  });

  if (!res.ok) {
    clearTokens();
    throw new Error('Token refresh failed');
  }

  const data = await res.json();
  const newTokens: AuthTokens = {
    access: data.access,
    refresh: current.refresh,
  };
  setTokens(newTokens);
  return newTokens;
}

// Deduplicate concurrent refresh calls
async function ensureFreshToken(): Promise<string> {
  const current = getTokens();
  if (!current?.access) throw new Error('Not authenticated');

  // Check if token is about to expire (decode JWT exp claim)
  try {
    const payload = JSON.parse(atob(current.access.split('.')[1]));
    const expiresAt = payload.exp * 1000;
    const buffer = 60_000; // refresh 60s before expiry

    if (Date.now() < expiresAt - buffer) {
      return current.access;
    }
  } catch {
    return current.access; // if we can't decode, just use it
  }

  // Token is expiring soon — refresh
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  const refreshed = await refreshPromise;
  return refreshed.access;
}

// --------------- Core fetch ---------------

export interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;  // default true
}

export class ApiRequestError extends Error {
  status: number;
  data: ApiError;

  constructor(status: number, data: ApiError) {
    super(data.detail || `API error ${status}`);
    this.status = status;
    this.data = data;
  }
}

export async function api<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { body, auth = true, headers: extraHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders as Record<string, string>,
  };

  // Attach JWT if authenticated
  if (auth) {
    try {
      const accessToken = await ensureFreshToken();
      headers['Authorization'] = `Bearer ${accessToken}`;
    } catch {
      // If token refresh fails, redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Authentication required');
    }
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...rest,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let errorData: ApiError;
    try {
      errorData = await res.json();
    } catch {
      errorData = { detail: `Request failed with status ${res.status}` };
    }
    throw new ApiRequestError(res.status, errorData);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// --------------- Convenience methods ---------------

export const apiFetch = {
  get<T>(endpoint: string, opts?: FetchOptions) {
    return api<T>(endpoint, { ...opts, method: 'GET' });
  },
  post<T>(endpoint: string, body?: unknown, opts?: FetchOptions) {
    return api<T>(endpoint, { ...opts, method: 'POST', body });
  },
  put<T>(endpoint: string, body?: unknown, opts?: FetchOptions) {
    return api<T>(endpoint, { ...opts, method: 'PUT', body });
  },
  patch<T>(endpoint: string, body?: unknown, opts?: FetchOptions) {
    return api<T>(endpoint, { ...opts, method: 'PATCH', body });
  },
  delete<T>(endpoint: string, opts?: FetchOptions) {
    return api<T>(endpoint, { ...opts, method: 'DELETE' });
  },
};
