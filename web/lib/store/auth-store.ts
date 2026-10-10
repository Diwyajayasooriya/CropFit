// ============================================================
// CropFit — Zustand Auth Store
// Manages JWT tokens, current user, login/logout, role switching,
// and auto-refresh.
// ============================================================

import { create } from 'zustand';
import type { User, AuthTokens, LoginCredentials, UserRole } from '@/types';
import { api, setTokens, getTokens, clearTokens } from '@/lib/api';
import { mockUsersByRole } from '@/lib/mock-data';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (credentials: LoginCredentials) => Promise<void>;
  loginAdmin: (credentials: LoginCredentials) => Promise<void>;
  loginDemo: (role?: UserRole) => void;
  switchRole: (role: UserRole) => void;
  logout: () => void;
  hydrate: () => void; // restore session from storage on mount
  hasRole: (role: UserRole) => boolean;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // true until hydrate completes
  error: null,

  clearError: () => set({ error: null }),

  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null });

    try {
      // 1. Call Django simplejwt token endpoint (Farmer login)
      const tokens = await api<AuthTokens>('/auth/token/', {
        method: 'POST',
        body: {
          username: credentials.email,
          password: credentials.password,
        },
        auth: false,
      });

      setTokens(tokens);

      // 2. Fetch user profile from DRF auth/me
      const user = await api<User>('/auth/me/');
      setTokens(tokens, user.role);

      if (typeof window !== 'undefined') {
        localStorage.setItem('cropfit_user', JSON.stringify(user));
      }

      set({ user, isAuthenticated: true, isLoading: false, error: null });
    } catch (err: unknown) {
      console.error('[Auth] Login failed:', err);
      const message = err instanceof Error ? err.message : 'Invalid credentials or server unavailable.';
      clearTokens();
      set({ user: null, isAuthenticated: false, isLoading: false, error: message });
      throw err;
    }
  },

  loginAdmin: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null });

    try {
      // 1. Call secure Admin SimpleJWT token endpoint
      const tokens = await api<AuthTokens>('/auth/admin/token/', {
        method: 'POST',
        body: {
          username: credentials.email,
          password: credentials.password,
        },
        auth: false,
      });

      setTokens(tokens, 'admin');

      // 2. Fetch user profile and verify clearance
      const user = await api<User>('/auth/me/');
      if (user.role !== 'admin') {
        clearTokens();
        throw new Error('Access Denied: Account lacks administrative clearance.');
      }

      setTokens(tokens, 'admin');

      if (typeof window !== 'undefined') {
        localStorage.setItem('cropfit_user', JSON.stringify(user));
      }

      set({ user, isAuthenticated: true, isLoading: false, error: null });
    } catch (err: unknown) {
      console.error('[Auth] Admin Login failed:', err);
      const message = err instanceof Error ? err.message : 'Invalid administrator credentials.';
      clearTokens();
      set({ user: null, isAuthenticated: false, isLoading: false, error: message });
      throw err;
    }
  },

  loginDemo: (role: UserRole = 'farmer') => {
    if (process.env.NODE_ENV !== 'development') return;
    const demoUser = mockUsersByRole[role];
    const fakeTokens: AuthTokens = {
      access: `mock-access-token-${role}`,
      refresh: `mock-refresh-token-${role}`,
    };
    setTokens(fakeTokens, role);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cropfit_user', JSON.stringify(demoUser));
    }
    set({ user: demoUser, isAuthenticated: true, isLoading: false, error: null });
  },

  switchRole: (role: UserRole) => {
    if (process.env.NODE_ENV !== 'development') return;
    const updated = mockUsersByRole[role];
    if (typeof window !== 'undefined') {
      localStorage.setItem('cropfit_user', JSON.stringify(updated));
    }
    set({ user: updated });
  },

  logout: () => {
    clearTokens();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cropfit_user');
      window.location.href = '/login';
    }
    set({ user: null, isAuthenticated: false, error: null });
  },

  hydrate: async () => {
    if (typeof window === 'undefined') return;
    try {
      if (!getTokens()?.access) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }
      const user = await api<User>('/auth/me/');
      localStorage.setItem('cropfit_user', JSON.stringify(user));
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      clearTokens();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  hasRole: (role: UserRole) => {
    return get().user?.role === role;
  },
}));
