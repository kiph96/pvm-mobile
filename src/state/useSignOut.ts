import { router } from 'expo-router';
import { useCallback } from 'react';

import { confirm } from '@/components/ui';
import { useI18n } from '@/i18n';
import { unregisterPush } from '@/notifications/push';
import { useApi, useSession } from './session';

/**
 * Sign out from any screen, after the same "Đăng xuất?" confirmation everywhere.
 * Navigates to sign-in first so no signed-in screen ever renders without a session (screens assume
 * one), stops push to this phone while the token is still valid, then revokes the session.
 */
export function useSignOut() {
  const api = useApi();
  const { t } = useI18n();
  const { session, signOut } = useSession();
  return useCallback(async () => {
    if (!(await confirm(t('more.signOutTitle'), t('more.signOutMsg'), t('more.signOut'), true))) return;
    router.replace('/sign-in');
    if (session?.mode === 'server') await unregisterPush(api);
    await signOut();
  }, [api, t, session?.mode, signOut]);
}
