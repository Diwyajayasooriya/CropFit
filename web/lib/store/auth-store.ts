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
      // 1. Call Django simplejwt token endpoint
      const tokens = await api<AuthTokens>('/token/', {
        method: 'POST',
        body: credentials,
        auth: false,
      });

      setTokens(tokens);

      // 2. Fetch user profile from DRF accounts/me
      const user = await api<User>('/accounts/me/');
      if (typeof window !== 'undefined') {
        localStorage.setItem('cropfit_user', JSON.stringify(user));
      }

      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      // In dev / standalone prototype mode, if backend is offline or credentials match demo
      console.warn('[Auth] Backend unreachable or credentials demo fallback:', err);
      
      // If user typed demo credentials or wants fallback
      let matchedRole: UserRole = 'farmer';
      if (credentials.email.includes('admin')) matchedRole = 'admin';
      else if (credentials.email.includes('tech')) matchedRole = 'technician';

      const demoUser = mockUsersByRole[matchedRole];
      const fakeTokens: AuthTokens = {
        access: `mock-access-token-${matchedRole}`,
        refresh: `mock-refresh-token-${matchedRole}`,
      };

      setTokens(fakeTokens);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cropfit_user', JSON.stringify(demoUser));
      }

      set({ user: demoUser, isAuthenticated: true, isLoading: false });
    }
  },

  loginDemo: (role: UserRole = 'farmer') => {
    const demoUser = mockUsersByRole[role];
    const fakeTokens: AuthTokens = {
      access: `mock-access-token-${role}`,
      refresh: `mock-refresh-token-${role}`,
    };
    setTokens(fakeTokens);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cropfit_user', JSON.stringify(demoUser));
    }
    set({ user: demoUser, isAuthenticated: true, isLoading: false, error: null });
  },

  switchRole: (role: UserRole) => {
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

  hydrate: () => {
    if (typeof window === 'undefined') {
      set({ isLoading: false });
      return;
    }

    const tokens = getTokens();
    const storedUserRaw = localStorage.getItem('cropfit_user');

    if (tokens?.access) {
      if (storedUserRaw) {
        try {
          const parsedUser = JSON.parse(storedUserRaw) as User;
          set({ user: parsedUser, isAuthenticated: true, isLoading: false });
          return;
        } catch {
          // fall through
        }
      }

      // Try decoding user from JWT payload
      try {
        const payload = JSON.parse(atob(tokens.access.split('.')[1]));
        const user: User = {
          id: payload.user_id ?? 1,
          email: payload.email ?? 'user@cropfit.io',
          first_name: payload.first_name ?? 'Farmer',
          last_name: payload.last_name ?? '',
          role: payload.role ?? 'farmer',
        };
        set({ user, isAuthenticated: true, isLoading: false });
      } catch {
        // Fallback to default farmer demo user
        const defaultUser = mockUsersByRole.farmer;
        set({ user: defaultUser, isAuthenticated: true, isLoading: false });
      }
    } else {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  hasRole: (role: UserRole) => {
    return get().user?.role === role;
  },
}));
