// ============================================================
// CropFit — Central Fetch Wrapper
// Attaches JWT token to every request.
// API failures are surfaced to callers for explicit error states.
// ============================================================

import type { AuthTokens, ApiError } from '@/types';

// Base server URL (no path suffix)
const SERVER_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000')
  .replace(/\/api\/?$/, '')
  .replace(/\/$/, '');

// Resolve endpoint: paths starting with /auth/ go to /api/auth/, everything else to /api/v1/
function resolveUrl(endpoint: string): string {
  if (endpoint.startsWith('http')) return endpoint;
  if (endpoint.startsWith('/auth/')) return `${SERVER_BASE}/api${endpoint}`;
  return `${SERVER_BASE}/api/v1${endpoint}`;
}

// --------------- Token helpers ---------------

let tokens: AuthTokens | null = null;

export function setTokens(t: AuthTokens, role?: string) {
  tokens = t;
  if (typeof window !== 'undefined') {
    localStorage.setItem('cropfit_tokens', JSON.stringify(t));
    document.cookie = `cropfit_auth=1; path=/; max-age=604800; SameSite=Lax`;
    // Store role for Next.js middleware to read (server-side admin protection)
    if (role) {
      document.cookie = `cropfit_role=${role}; path=/; max-age=604800; SameSite=Lax`;
    }
  }
}

export function getTokens(): AuthTokens | null {
  if (tokens) return tokens;
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('cropfit_tokens');
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as AuthTokens;
        if (typeof parsed.access !== 'string' || typeof parsed.refresh !== 'string') throw new Error('Invalid tokens');
        tokens = parsed;
        return tokens;
      } catch {
        clearTokens();
      }
    }
  }
  return null;
}

export function clearTokens() {
  tokens = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('cropfit_tokens');
    localStorage.removeItem('cropfit_user');
    document.cookie = 'cropfit_auth=; path=/; max-age=0; SameSite=Lax';
    document.cookie = 'cropfit_role=; path=/; max-age=0; SameSite=Lax';
  }
}

// --------------- Token refresh ---------------

let refreshPromise: Promise<AuthTokens> | null = null;

async function refreshAccessToken(): Promise<AuthTokens> {
  const current = getTokens();
  if (!current?.refresh) throw new Error('No refresh token');

  const res = await fetch(resolveUrl('/auth/token/refresh/'), {
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
    // Extract first error message from DRF error structures
    let message = data.detail || data.message || data.error;
    if (!message && typeof data === 'object' && data !== null) {
      const entries = Object.entries(data);
      if (entries.length > 0) {
        const [field, val] = entries[0];
        const valText = Array.isArray(val) ? val[0] : String(val);
        message = field && field !== 'non_field_errors' ? `${field}: ${valText}` : String(valText);
      }
    }
    super(message || `API error ${status}`);
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
        if (!window.location.pathname.endsWith('/login')) {
          const destination = window.location.pathname + window.location.search;
          sessionStorage.setItem('cropfit_redirect', destination);
          window.location.href = `/login?redirect=${encodeURIComponent(destination)}`;
        }
      }
      throw new Error('Authentication required');
    }
  }

  const url = resolveUrl(endpoint);

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
