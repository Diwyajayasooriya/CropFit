import { create } from "zustand";

export type AppMode = "landing" | "auth";

interface AuthState {
  mode: AppMode;
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;

  setMode: (mode: AppMode) => void;
  login: (token: string, username: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  mode: "landing",
  isAuthenticated: false,
  token: null,
  username: null,

  setMode: (mode) => set({ mode }),

  login: (token, username) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("gn_token", token);
    }
    set({ isAuthenticated: true, token, username });
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("gn_token");
    }
    set({ isAuthenticated: false, token: null, username: null, mode: "landing" });
  },
}));
