import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import apiClient, { setMobileAccessToken, setUnauthorizedHandler } from './api-client';

const TOKEN_KEY = 'rayhealth_mobile_access_token';
const USER_KEY = 'rayhealth_mobile_user';

export interface MobileUser {
  role: string;
  agencyId: string;
  firstName?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: MobileUser | null;
  sessionRevokedMessage: string | null;
  dismissSessionRevoked: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_REVOKED_TEXT = 'Your session was ended. Please sign in again.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<MobileUser | null>(null);
  const [sessionRevokedMessage, setSessionRevokedMessage] = useState<string | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLocalState = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    setMobileAccessToken(null);
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  const dismissSessionRevoked = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setSessionRevokedMessage(null);
  }, []);

  const showSessionRevoked = useCallback(() => {
    setSessionRevokedMessage(SESSION_REVOKED_TEXT);
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }
    dismissTimerRef.current = setTimeout(() => {
      setSessionRevokedMessage(null);
      dismissTimerRef.current = null;
    }, 5000);
  }, []);

  useEffect(() => {
    async function loadCachedUser() {
      const userJson = await SecureStore.getItemAsync(USER_KEY);
      if (userJson) {
        try {
          setUser(JSON.parse(userJson) as MobileUser);
        } catch {
          // Corrupt user blob — ignore, leave user null. Token is still trusted server-side.
        }
      }
    }

    async function hydrate() {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) {
        setIsLoading(false);
        return;
      }
      setMobileAccessToken(token);

      // Don't trust a stored token blindly — a stale/expired one must drop the
      // user to login, not silently show an empty dashboard. Validate it once
      // against the server before treating the session as authenticated.
      try {
        await apiClient.get('/api/auth/me', { skipAuthHandler: true } as never);
        await loadCachedUser();
        setIsAuthenticated(true);
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401) {
          // Token explicitly rejected — clear it and force a fresh login.
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          await SecureStore.deleteItemAsync(USER_KEY);
          setMobileAccessToken(null);
          setIsAuthenticated(false);
        } else {
          // No response (offline / server down) — don't lock a caregiver out in
          // the field. Trust the cached token; a later real 401 still clears it.
          await loadCachedUser();
          setIsAuthenticated(true);
        }
      } finally {
        setIsLoading(false);
      }
    }

    void hydrate();
  }, []);

  // Register a single 401 handler with the api-client. Fires when any authenticated
  // request comes back 401 (token revoked or expired), clears local state, and
  // surfaces the session-revoked toast.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clearLocalState();
      showSessionRevoked();
    });
    return () => {
      setUnauthorizedHandler(null);
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [clearLocalState, showSessionRevoked]);

  const login = async (email: string, password: string) => {
    const { data } = await apiClient.post('/api/auth/mobile/login', { email, password });
    await SecureStore.setItemAsync(TOKEN_KEY, data.token);
    setMobileAccessToken(data.token);
    const nextUser: MobileUser = { role: data.role, agencyId: data.agencyId };
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    setIsAuthenticated(true);
    // A successful login clears any lingering revoked-session banner.
    dismissSessionRevoked();
  };

  const logout = async () => {
    await clearLocalState();
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        sessionRevokedMessage,
        dismissSessionRevoked,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
