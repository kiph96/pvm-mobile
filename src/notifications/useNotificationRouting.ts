import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useApi, useSession } from '@/state/session';
import { registerForPush } from './push';
import { notificationRoute } from './route';

/**
 * - Tapping a push opens what it is about (see notificationRoute): the evening digest opens Schedule on that day, a
 *   shift alert that shift; one with nothing to open goes to the notification list.
 * - Signed-in managers on a phone re-register their push token silently (tokens can change).
 */
export function useNotificationRouting() {
  const { session, isManager } = useSession();
  const api = useApi();
  const owner = useRef(isManager);
  owner.current = isManager;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data as Record<string, unknown> | undefined;
      if (!data) return;
      const eventType = typeof data.eventType === 'string' ? data.eventType : '';
      router.push(notificationRoute(eventType, data, owner.current) ?? '/notifications');
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
