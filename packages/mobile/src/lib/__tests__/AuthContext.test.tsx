import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api-client';

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock api-client
jest.mock('../api-client', () => {
  const actual = jest.requireActual('../api-client');
  return {
    __esModule: true,
    default: {
      post: jest.fn(),
    },
    setMobileAccessToken: actual.setMobileAccessToken || jest.fn(),
  };
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  });

  it('starts in loading state and resolves to unauthenticated', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for hydration
    await act(async () => {});

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('hydrates as authenticated when token exists in SecureStore', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-token');

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {});

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('login stores token and sets authenticated', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: { token: 'new-jwt-token' },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/mobile/login', {
      email: 'test@example.com',
      password: 'password123',
    });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'rayhealth_mobile_access_token',
      'new-jwt-token'
    );
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('logout clears token and sets unauthenticated', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-token');

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.logout();
    });

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('rayhealth_mobile_access_token');
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('throws when useAuth is used outside AuthProvider', () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');
  });
});
