import { create } from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'https://rayhealthevv.com';
let accessToken: string | null = null;

const apiClient = create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

export function setMobileAccessToken(token: string | null): void {
  accessToken = token;
}

export default apiClient;
