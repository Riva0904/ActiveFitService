import * as SecureStore from 'expo-secure-store';

const KEYS = {
  ACCESS: 'ab_access',
  REFRESH: 'ab_refresh',
  PUSH_TOKEN: 'ab_push_token',
};

export const tokenStore = {
  async getAccess(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.ACCESS);
  },
  async getRefresh(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.REFRESH);
  },
  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.ACCESS, accessToken),
      SecureStore.setItemAsync(KEYS.REFRESH, refreshToken),
    ]);
  },
  async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS),
      SecureStore.deleteItemAsync(KEYS.REFRESH),
    ]);
  },
  async getPushToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.PUSH_TOKEN);
  },
  async setPushToken(token: string): Promise<void> {
    return SecureStore.setItemAsync(KEYS.PUSH_TOKEN, token);
  },
};
