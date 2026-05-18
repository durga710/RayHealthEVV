import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getCsrfToken, setCsrfToken } from './session-state.js';

const API_BASE = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? '/api';

interface AuthUser {
  userId: string;
  role: string;
  agencyId: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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
          setUser({ userId: data.userId, role: data.role, agencyId: data.agencyId });
          setCsrfToken(data.csrfToken ?? null);
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

  const login = async (email: string, password: string) => {
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
    setUser({ userId: data.userId, role: data.role, agencyId: data.agencyId });
    setCsrfToken(data.csrfToken ?? null);
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
  };

  if (isLoading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!user, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
