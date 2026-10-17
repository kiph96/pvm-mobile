import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Api } from '@/api/http';

const TOKEN_KEY = 'pvm.push.token';
export const DIGEST_CHANNEL = 'daily-digest';

export type PushStatus =
  | { ok: true; token: string }
  | { ok: false; reason: 'web' | 'simulator' | 'denied' | 'no-project' | 'error'; message?: string };

// Show notifications as banners even when the app is open.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/** EAS project id: needed by Expo to issue push tokens (app.json extra.eas.projectId or EXPO_PUBLIC_EAS_PROJECT_ID). */
function projectId(): string | undefined {
  return process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    || (Constants.expoConfig?.extra?.eas?.projectId as string | undefined)
    || Constants.easConfig?.projectId;
}

/**
 * Asks for permission (once), gets this phone's Expo push token and registers it with the backend so the
 * evening digest and other alerts arrive as notifications.
 */
export async function registerForPush(api: Api, askPermission = true): Promise<PushStatus> {
  if (Platform.OS === 'web') return { ok: false, reason: 'web' };
  if (!Device.isDevice) return { ok: false, reason: 'simulator' };
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(DIGEST_CHANNEL, {
        name: 'Báo cáo ca hằng ngày', importance: Notifications.AndroidImportance.HIGH, sound: 'default',
      });
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Thông báo', importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && askPermission) status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return { ok: false, reason: 'denied' };
    const pid = projectId();
    if (!pid) return { ok: false, reason: 'no-project' };
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: pid })).data;
    await api.registerDevice(token, Platform.OS === 'ios' ? 'ios' : 'android');
    await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => undefined);
    return { ok: true, token };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

/** On sign-out: stop this phone from receiving the user's notifications. */
export async function unregisterPush(api: Api) {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) {
      await api.unregisterDevice(token);
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // best effort: the server also disables tokens Expo reports as unregistered
  }
}
