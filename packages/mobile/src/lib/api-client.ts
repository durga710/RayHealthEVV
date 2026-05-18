import { create as axiosCreate, type AxiosInstance } from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'https://rayhealthevv.com';
let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

const apiClient: AxiosInstance = axiosCreate({
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

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only treat as a revoked/expired session if we had a token (i.e. user was authenticated).
    // A 401 on the /login call itself just means bad credentials — leave that to the caller.
    const status = error?.response?.status;
    const url: string | undefined = error?.config?.url;
    const isLoginCall = typeof url === 'string' && url.includes('/auth/mobile/login');
    if (status === 401 && accessToken && !isLoginCall && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export function setMobileAccessToken(token: string | null): void {
  accessToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export default apiClient;
