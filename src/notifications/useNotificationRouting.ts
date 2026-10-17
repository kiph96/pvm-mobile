import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useApi, useSession } from '@/state/session';
import { registerForPush } from './push';

/**
 * - Tapping the evening digest opens Schedule on that day.
 * - Signed-in managers on a phone re-register their push token silently (tokens can change).
 */
export function useNotificationRouting() {
  const { session, isManager } = useSession();
  const api = useApi();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data as { screen?: string; date?: string } | undefined;
      if (data?.screen === 'schedule') router.push(data.date ? `/owner/schedule?date=${data.date}` : '/owner/schedule');
      else if (data) router.push('/notifications');
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (session?.mode === 'server' && session.workspace && isManager) {
      registerForPush(api, false).catch(() => undefined); // never prompts here; the settings screen asks
    }
  }, [api, session?.mode, session?.workspace, isManager]);
}
