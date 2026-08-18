import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getCsrfToken, setCsrfToken } from './session-state.js';
// Deep import, NOT the package barrel: the barrel re-exports every repository
// and would pull knex, pg, and ssh2-sftp-client into the browser bundle.
import { AGENCY_THEME_VARIABLES, resolveAgencyTheme } from '@rayhealth/core/domain/theme-resolver.js';

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
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  agencyTheme?: AgencyTheme | null;
}

export type LoginResult =
  | { role: string }
  | { twoFactorRequired: true; challengeToken: string };

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  completeTwoFactor: (challengeToken: string, code: string) => Promise<{ role: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

/**
 * Apply an agency's branding by handing its colors to the shared resolver,
 * which derives every dependent token (foreground ink, gradients, tints, focus
 * ring, sidebar states) by measured contrast.
 *
 * This used to set three variables by hand and leave --color-on-brand pinned to
 * white, so a pale brand color meant white-on-pale text everywhere. Clearing
 * and setting are both driven off AGENCY_THEME_VARIABLES so the two lists
 * cannot drift, and so switching agencies never leaves a stale color behind.
 */
function applyAgencyTheme(theme?: AgencyTheme | null) {
  const root = document.documentElement;

  // Always clear first. With no agency override the shared stylesheet stays the
  // single source of truth for public, admin, and caregiver experiences.
  for (const name of AGENCY_THEME_VARIABLES) root.style.removeProperty(name);

  if (!theme?.primaryColor?.trim()) return;

  const { variables } = resolveAgencyTheme(theme);
  for (const [name, value] of Object.entries(variables)) {
    root.style.setProperty(name, value);
  }
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
          setUser({ userId: data.userId, role: data.role, agencyId: data.agencyId, agencyTheme: data.agencyTheme, email: data.email ?? null, firstName: data.firstName ?? null, lastName: data.lastName ?? null, avatarUrl: data.avatarUrl ?? null });
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

  const login = async (email: string, password: string): Promise<LoginResult> => {
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
    if (data.twoFactorRequired) {
      return { twoFactorRequired: true, challengeToken: data.challengeToken as string };
    }
    setUser({ userId: data.userId, role: data.role, agencyId: data.agencyId, agencyTheme: data.agencyTheme, email: data.email ?? null, firstName: data.firstName ?? null, lastName: data.lastName ?? null, avatarUrl: data.avatarUrl ?? null });
    setCsrfToken(data.csrfToken ?? null);
    applyAgencyTheme(data.agencyTheme);
    return { role: data.role as string };
  };

  const completeTwoFactor = async (challengeToken: string, code: string): Promise<{ role: string }> => {
    const res = await fetch(`${API_BASE}/auth/login/2fa`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeToken, code }),
    });
    if (!res.ok) {
      const { message } = await res.json().catch(() => ({ message: 'Verification failed' }));
      throw new Error(message);
    }
    const data = await res.json();
    setUser({ userId: data.userId, role: data.role, agencyId: data.agencyId, agencyTheme: data.agencyTheme, email: data.email ?? null, firstName: data.firstName ?? null, lastName: data.lastName ?? null, avatarUrl: data.avatarUrl ?? null });
    setCsrfToken(data.csrfToken ?? null);
    applyAgencyTheme(data.agencyTheme);
    return { role: data.role as string };
  };

  const refreshUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include', headers: { accept: 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      setUser((prev) => prev ? { ...prev, email: data.email ?? null, firstName: data.firstName ?? null, lastName: data.lastName ?? null, avatarUrl: data.avatarUrl ?? null } : prev);
    } catch { /* silent */ }
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
    <AuthContext.Provider value={{ isAuthenticated: !!user, user, login, completeTwoFactor, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
