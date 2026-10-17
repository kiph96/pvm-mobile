import { useQuery } from '@tanstack/react-query';
import React from 'react';

import { AppTabs } from '@/components/tabs';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi, useSession } from '@/state/session';

export default function StaffTabs() {
  const { t } = useI18n();
  const api = useApi();
  const org = useOrgKey();
  const { session } = useSession();
  const swaps = useQuery({ queryKey: ['swaps', org, 'all'], queryFn: () => api.swaps() });
  const waiting = (swaps.data ?? []).filter((s) => s.status === 'requested' && s.to.userId === session?.userId).length;
  return (
    <AppTabs tabs={[
      { name: 'index', title: t('tabs.home'), icon: 'home-outline' },
      { name: 'find', title: t('tabs.find'), icon: 'search-outline' },
      { name: 'shifts', title: t('tabs.myShifts'), icon: 'calendar-outline' },
      { name: 'swaps', title: t('tabs.swaps'), icon: 'swap-horizontal-outline', badge: waiting },
      { name: 'me', title: t('tabs.me'), icon: 'person-circle-outline' },
    ]} />
  );
}
