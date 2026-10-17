import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createChunkedStorage, type StorageDriver } from './chunkedStorage';

const nativeDriver: StorageDriver = {
  getItem: key => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: key => SecureStore.deleteItemAsync(key),
};
const webDriver: StorageDriver = {
  async getItem(key) { return typeof window === 'undefined' ? null : window.localStorage.getItem(key); },
  async setItem(key, value) { if (typeof window !== 'undefined') window.localStorage.setItem(key, value); },
  async removeItem(key) { if (typeof window !== 'undefined') window.localStorage.removeItem(key); },
};
export const sessionStorage = Platform.OS === 'web' ? webDriver : createChunkedStorage(nativeDriver);
