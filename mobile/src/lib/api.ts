import axios from 'axios';
import { tokenStore } from './secureStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// Attach Bearer token to every request
api.interceptors.request.use(async (config) => {
  const token = await tokenStore.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token?: string) {
  refreshQueue.forEach(({ resolve, reject }) => (token ? resolve(token) : reject(error)));
  refreshQueue = [];
}

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res.data,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error.response?.data ?? error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await tokenStore.getRefresh();
      if (!refreshToken) throw new Error('No refresh token');

      const response = await axios.post(`${API_URL}/auth/mobile-refresh`, { refreshToken });
      const { accessToken, refreshToken: newRefresh } = response.data;

      await tokenStore.setTokens(accessToken, newRefresh);
      processQueue(null, accessToken);

      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch (err) {
      processQueue(err);
      await tokenStore.clear();
      // Auth store will detect empty tokens on next render and redirect to login
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  },
);
