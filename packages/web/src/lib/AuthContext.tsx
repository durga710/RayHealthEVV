import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getCsrfToken, setCsrfToken } from './session-state.js';

const API_BASE = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? '/api';

interface AgencyTheme {
  primaryColor?: string;
  primaryDark?: string;
  accentColor?: string;
  logoText?: string;
  tagline?: string;
}

interface AuthUser {
  userId: string;
  role: string;
  agencyId: string;
  agencyTheme?: AgencyTheme | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<{ role: string }>;
  logout: () => Promise<void>;
  switchAgency: (agencyId: string) => Promise<{ agencyName: string }>;
}

function applyAgencyTheme(theme?: AgencyTheme | null) {
  const root = document.documentElement;
  const primary = theme?.primaryColor ?? '#6366F1';
  const primaryDark = theme?.primaryDark ?? '#4F46E5';
  root.style.setProperty('--color-primary', primary);
  root.style.setProperty('--color-primary-dark', primaryDark);
  // Derive a low-opacity bg tint from the primary color for hover/active states.
  root.style.setProperty('--color-primary-bg', primary + '14');
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: 'include',
          headers: { accept: 'application/json' }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setUser({ userId: data.userId, role: data.role, agencyId: data.agencyId, agencyTheme: data.agencyTheme });
          setCsrfToken(data.csrfToken ?? null);
          applyAgencyTheme(data.agencyTheme);
        }
      } catch {
        setCsrfToken(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ role: string }> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const { message } = await res.json().catch(() => ({ message: 'Login failed' }));
      throw new Error(message);
    }
    const data = await res.json();
    setUser({ userId: data.userId, role: data.role, agencyId: data.agencyId, agencyTheme: data.agencyTheme });
    setCsrfToken(data.csrfToken ?? null);
    applyAgencyTheme(data.agencyTheme);
    return { role: data.role as string };
  };

  const switchAgency = async (agencyId: string): Promise<{ agencyName: string }> => {
    const csrfToken = getCsrfToken();
    const res = await fetch(`${API_BASE}/agencies/switch`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
      },
      body: JSON.stringify({ agencyId })
    });
    if (!res.ok) {
      const { message } = await res.json().catch(() => ({ message: 'Switch failed' }));
      throw new Error(message);
    }
    const data = await res.json();
    setUser((prev) => prev ? { ...prev, agencyId: data.agencyId, agencyTheme: data.agencyTheme } : prev);
    applyAgencyTheme(data.agencyTheme);
    return { agencyName: data.agencyName as string };
  };

  const logout = async () => {
    const csrfToken = getCsrfToken();
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: csrfToken ? { 'x-csrf-token': csrfToken } : {}
    }).catch(() => undefined);
    setCsrfToken(null);
    setUser(null);
    applyAgencyTheme(null);
  };

  if (isLoading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!user, user, login, logout, switchAgency }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
