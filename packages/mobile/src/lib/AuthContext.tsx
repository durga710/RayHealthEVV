import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import apiClient, { setMobileAccessToken, setUnauthorizedHandler } from './api-client';
import { cancelAllShiftAlerts } from './shift-alert-scheduler';

const TOKEN_KEY = 'rayhealth_mobile_access_token';
const USER_KEY = 'rayhealth_mobile_user';
const AGENCIES_KEY = 'rayhealth_mobile_agencies';

export interface MobileUser {
  role: string;
  agencyId: string;
  /** Display name of the agency the current token is scoped to. */
  agencyName?: string;
  firstName?: string;
}

/** One agency the signed-in caregiver may act in (from /api/auth/mobile/agencies). */
export interface AgencyMembership {
  agencyId: string;
  agencyName: string;
  role: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: MobileUser | null;
  /** Every agency linked to this mobile identity. Single-agency users get one entry. */
  agencies: AgencyMembership[];
  /**
   * True right after a fresh sign-in when the account is linked to more than
   * one agency, the app must show the agency picker before any agency-scoped
   * screen. Cleared by selectAgency; never set on token-restore (the restored
   * token is already scoped to the last agency the user chose).
   */
  needsAgencySelection: boolean;
  sessionRevokedMessage: string | null;
  dismissSessionRevoked: () => void;
  login: (email: string, password: string) => Promise<void>;
  /**
   * Scope the session to `agencyId`. No-ops (beyond clearing the selection
   * flag) when it's already the active agency; otherwise exchanges the token
   * via /api/auth/mobile/switch-agency, so all subsequent requests read that
   * agency's data. Throws when the server denies the switch.
   */
  selectAgency: (agencyId: string) => Promise<void>;
  /** Re-fetch the membership list (e.g. when opening the agency screen). */
  refreshAgencies: () => Promise<AgencyMembership[]>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_REVOKED_TEXT = 'Your session was ended. Please sign in again.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<MobileUser | null>(null);
  const [agencies, setAgencies] = useState<AgencyMembership[]>([]);
  const [needsAgencySelection, setNeedsAgencySelection] = useState(false);
  const [sessionRevokedMessage, setSessionRevokedMessage] = useState<string | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLocalState = useCallback(async () => {
    // Cancel any scheduled shift-alert notifications first, their body carries
    // the client's name (PHI), so a logged-out or shared device must not keep
    // surfacing them. Best-effort; never block logout on it.
    try {
      await cancelAllShiftAlerts();
    } catch {
      /* ignore, proceed with clearing the session regardless */
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync(AGENCIES_KEY);
    setMobileAccessToken(null);
    setIsAuthenticated(false);
    setUser(null);
    setAgencies([]);
    setNeedsAgencySelection(false);
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
          // Corrupt user blob, ignore, leave user null. Token is still trusted server-side.
        }
      }
    }

    async function loadCachedAgencies() {
      const agenciesJson = await SecureStore.getItemAsync(AGENCIES_KEY);
      if (agenciesJson) {
        try {
          const cached = JSON.parse(agenciesJson) as AgencyMembership[];
          if (Array.isArray(cached)) setAgencies(cached);
        } catch {
          // Corrupt blob, the agency screen re-fetches the live list anyway.
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
      await loadCachedAgencies();

      // Don't trust a stored token blindly, a stale/expired one must drop the
      // user to login, not silently show an empty dashboard. Validate it once
      // against the server before treating the session as authenticated.
      try {
        const { data } = await apiClient.get('/api/auth/me', { skipAuthHandler: true } as never);
        const me = (data ?? {}) as { role?: string; agencyId?: string; firstName?: string | null };
        const cachedJson = await SecureStore.getItemAsync(USER_KEY);
        const cached = cachedJson ? (JSON.parse(cachedJson) as Partial<MobileUser>) : null;
        const agencyId = me.agencyId ?? cached?.agencyId ?? '';
        const nextUser: MobileUser = {
          role: me.role ?? cached?.role ?? '',
          agencyId,
          // /me doesn't carry the agency name; keep the cached one as long as
          // it belongs to the same agency the token is scoped to.
          agencyName: cached?.agencyId === agencyId ? cached?.agencyName : undefined,
          firstName: me.firstName ?? cached?.firstName ?? undefined,
        };
        setUser(nextUser);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser));
        setIsAuthenticated(true);
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401) {
          // Token explicitly rejected, clear it and force a fresh login.
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          await SecureStore.deleteItemAsync(USER_KEY);
          setMobileAccessToken(null);
          setIsAuthenticated(false);
        } else {
          // No response (offline / server down), don't lock a caregiver out in
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

  const persistAgencies = useCallback(async (list: AgencyMembership[]) => {
    setAgencies(list);
    await SecureStore.setItemAsync(AGENCIES_KEY, JSON.stringify(list));
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await apiClient.post('/api/auth/mobile/login', { email, password });
    await SecureStore.setItemAsync(TOKEN_KEY, data.token);
    setMobileAccessToken(data.token);

    // agencies is absent when the API predates multi-agency support, treat
    // that as a single-agency account so sign-in behaves exactly as before.
    const memberships: AgencyMembership[] = Array.isArray(data.agencies)
      ? (data.agencies as AgencyMembership[])
      : [{ agencyId: data.agencyId, agencyName: '', role: data.role }];
    await persistAgencies(memberships);

    const homeAgency = memberships.find((a) => a.agencyId === data.agencyId);
    let nextUser: MobileUser = { role: data.role, agencyId: data.agencyId, agencyName: homeAgency?.agencyName };
    // The login response doesn't carry the caregiver's name; fetch it for the
    // dashboard greeting. Best-effort, never block sign-in on it.
    try {
      const me = await apiClient.get('/api/auth/me');
      const firstName = (me.data as { firstName?: string | null })?.firstName;
      if (firstName) nextUser = { ...nextUser, firstName };
    } catch {
      /* greeting personalization is non-critical */
    }
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    // A multi-agency caregiver must pick which agency this session is for
    // before seeing any agency-scoped data (schedules, patients, messages).
    setNeedsAgencySelection(memberships.length > 1);
    setIsAuthenticated(true);
    // A successful login clears any lingering revoked-session banner.
    dismissSessionRevoked();
  };

  const refreshAgencies = useCallback(async (): Promise<AgencyMembership[]> => {
    const { data } = await apiClient.get('/api/auth/mobile/agencies');
    const list = Array.isArray(data?.agencies) ? (data.agencies as AgencyMembership[]) : [];
    if (list.length > 0) {
      await persistAgencies(list);
    }
    return list;
  }, [persistAgencies]);

  const selectAgency = useCallback(
    async (agencyId: string) => {
      // Picking the agency the token is already scoped to needs no round-trip , 
      // just confirm the selection so the guards let the user through.
      const current = await SecureStore.getItemAsync(USER_KEY);
      const currentUser = current ? (JSON.parse(current) as MobileUser) : null;
      if (currentUser && currentUser.agencyId === agencyId) {
        if (!currentUser.agencyName) {
          const match = agencies.find((a) => a.agencyId === agencyId);
          if (match?.agencyName) {
            const updated = { ...currentUser, agencyName: match.agencyName };
            await SecureStore.setItemAsync(USER_KEY, JSON.stringify(updated));
            setUser(updated);
          }
        }
        setNeedsAgencySelection(false);
        return;
      }

      const { data } = await apiClient.post('/api/auth/mobile/switch-agency', { agencyId });
      await SecureStore.setItemAsync(TOKEN_KEY, data.token);
      setMobileAccessToken(data.token);

      let nextUser: MobileUser = { role: data.role, agencyId: data.agencyId, agencyName: data.agencyName };
      // The caregiver is a different record at each agency, refresh the
      // greeting name under the new scope. Best-effort, like login.
      try {
        const me = await apiClient.get('/api/auth/me');
        const firstName = (me.data as { firstName?: string | null })?.firstName;
        if (firstName) nextUser = { ...nextUser, firstName };
      } catch {
        /* greeting personalization is non-critical */
      }
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
      setNeedsAgencySelection(false);
    },
    [agencies],
  );

  const logout = async () => {
    await clearLocalState();
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        agencies,
        needsAgencySelection,
        sessionRevokedMessage,
        dismissSessionRevoked,
        login,
        selectAgency,
        refreshAgencies,
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
