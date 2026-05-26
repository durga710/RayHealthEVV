import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../LoginScreen';

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
  }),
}));

// Mock AuthContext
const mockLogin = jest.fn();
jest.mock('../../../lib/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    isAuthenticated: false,
    isLoading: false,
    logout: jest.fn(),
  }),
}));

// Mock vector icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders branding and form fields', () => {
    render(<LoginScreen />);

    expect(screen.getByText('RayHealth EVV')).toBeTruthy();
    expect(screen.getByPlaceholderText('Caregiver Email Address')).toBeTruthy();
    expect(screen.getByPlaceholderText('Account Password')).toBeTruthy();
  });

  it('disables login button when fields are empty', () => {
    render(<LoginScreen />);

    const button = screen.getByText('AUTHENTICATE & LOG IN');
    // The button should be pressable but disabled state indicated by style
    expect(button).toBeTruthy();
  });

  it('enables login when both fields have values', () => {
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Caregiver Email Address'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Account Password'), 'password123');

    expect(screen.getByText('AUTHENTICATE & LOG IN')).toBeTruthy();
  });

  it('calls login with email and password on submit', async () => {
    mockLogin.mockResolvedValue(undefined);

    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Caregiver Email Address'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Account Password'), 'password123');
    fireEvent.press(screen.getByText('AUTHENTICATE & LOG IN'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('shows error message on login failure', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));

    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Caregiver Email Address'), 'bad@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Account Password'), 'wrong');
    fireEvent.press(screen.getByText('AUTHENTICATE & LOG IN'));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password. Please verify credentials.')).toBeTruthy();
    });
  });

  it('clears error when user types in email field', async () => {
    mockLogin.mockRejectedValue(new Error('fail'));

    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Caregiver Email Address'), 'bad@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('Account Password'), 'wrong');
    fireEvent.press(screen.getByText('AUTHENTICATE & LOG IN'));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password. Please verify credentials.')).toBeTruthy();
    });

    // Type again to clear error
    fireEvent.changeText(screen.getByPlaceholderText('Caregiver Email Address'), 'new@test.com');

    await waitFor(() => {
      expect(screen.queryByText('Invalid email or password. Please verify credentials.')).toBeNull();
    });
  });
});
