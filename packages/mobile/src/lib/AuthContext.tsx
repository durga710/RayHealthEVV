import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import apiClient, { setMobileAccessToken } from './api-client';

const TOKEN_KEY = 'rayhealth_mobile_access_token';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function hydrate() {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      setMobileAccessToken(token);
      setIsAuthenticated(!!token);
      setIsLoading(false);
    }

    void hydrate();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await apiClient.post('/api/auth/mobile/login', { email, password });
    await SecureStore.setItemAsync(TOKEN_KEY, data.token);
    setMobileAccessToken(data.token);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setMobileAccessToken(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
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
