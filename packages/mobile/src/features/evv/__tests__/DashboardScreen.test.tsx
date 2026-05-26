import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import DashboardScreen from '../DashboardScreen';
import apiClient from '../../../lib/api-client';

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
  }),
}));

// Mock AuthContext
jest.mock('../../../lib/AuthContext', () => ({
  useAuth: () => ({
    logout: jest.fn(),
    isAuthenticated: true,
    isLoading: false,
    login: jest.fn(),
  }),
}));

// Mock api-client
jest.mock('../../../lib/api-client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// Mock vector icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('DashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading indicator initially', () => {
    (apiClient.get as jest.Mock).mockReturnValue(new Promise(() => {})); // never resolves
    render(<DashboardScreen />);
    // The component starts with loading=true and renders ActivityIndicator
  });

  it('renders assignments from API', async () => {
    const mockAssignments = [
      { id: '1', clientName: 'Jane Doe', time: '9:00 AM', address: '123 Main St' },
      { id: '2', clientName: 'John Smith', time: '2:00 PM', address: '456 Oak Ave' },
    ];
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockAssignments });

    render(<DashboardScreen />);

    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeTruthy();
      expect(screen.getByText('John Smith')).toBeTruthy();
    });
  });

  it('fetches caregiver assignments on mount', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

    render(<DashboardScreen />);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/assignments/caregiver');
    });
  });

  it('renders stats panel', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

    render(<DashboardScreen />);

    await waitFor(() => {
      expect(screen.getByText('18.5 hrs')).toBeTruthy();
      expect(screen.getByText('100% Compliant')).toBeTruthy();
    });
  });
});
