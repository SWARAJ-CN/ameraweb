"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, clearToken, getToken, onUnauthorized, setToken } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // A rejected token anywhere in the app signs the session out.
  useEffect(
    () =>
      onUnauthorized(() => {
        clearToken();
        setUser(null);
      }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getToken();
      if (!token) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const { user: me } = await api.get<{ user: AuthUser }>("/api/auth/me");
        if (!cancelled) setUser(me);
      } catch {
        clearToken();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      const result = await api.post<{ token: string; user: AuthUser }>(
        "/api/auth/login",
        { username, password },
        { auth: false }
      );
      setToken(result.token);
      setUser(result.user);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      const result = await api.post<{ token: string; user: AuthUser }>(
        "/api/auth/register",
        { username, password },
        { auth: false }
      );
      setToken(result.token);
      setUser(result.user);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, loading, login, register, logout }),
    [user, ready, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
