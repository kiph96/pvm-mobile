import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** API tokens from /api/auth. Kept in the OS keychain/keystore on phones. */
export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  /** epoch ms when the access token expires */
  expiresAt: number;
}

const KEY = 'pvm.tokens.v1';

// SecureStore is not available on web; there the browser's storage is the best we have.
const web = Platform.OS === 'web';

export async function loadTokens(): Promise<StoredTokens | null> {
  try {
    const raw = web ? await AsyncStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    return null;
  }
}

export async function saveTokens(tokens: StoredTokens | null) {
  try {
    if (tokens) {
      const raw = JSON.stringify(tokens);
      if (web) await AsyncStorage.setItem(KEY, raw);
      else await SecureStore.setItemAsync(KEY, raw);
    } else if (web) {
      await AsyncStorage.removeItem(KEY);
    } else {
      await SecureStore.deleteItemAsync(KEY);
    }
  } catch {
    // storage unavailable: the session still works until the app closes
  }
}
