import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ProfileScreen from '../ProfileScreen';

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: jest.fn(),
  }),
}));

// Mock AuthContext
const mockLogout = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../lib/AuthContext', () => ({
  useAuth: () => ({
    logout: mockLogout,
    isAuthenticated: true,
    isLoading: false,
    login: jest.fn(),
  }),
}));

// Mock vector icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders offline queue items', () => {
    render(<ProfileScreen />);

    expect(screen.getByText('Arthur Pendelton')).toBeTruthy();
  });

  it('renders sync button', () => {
    render(<ProfileScreen />);

    expect(screen.getByText(/SYNC/i)).toBeTruthy();
  });
});
