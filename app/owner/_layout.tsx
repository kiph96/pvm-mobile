import React from 'react';

import { useSyncAccount } from '@/components/accountSwitcher';
import { AppTabs } from '@/components/tabs';
import { useI18n } from '@/i18n';
import { useApprovals } from '@/state/queries';

export default function OwnerTabs() {
  useSyncAccount();
  const { t } = useI18n();
  const { count } = useApprovals();
  return (
    <AppTabs tabs={[
      { name: 'index', title: t('tabs.home'), icon: 'home-outline', badge: count },
      { name: 'schedule', title: t('tabs.schedule'), icon: 'calendar-outline' },
      { name: 'team', title: t('tabs.team'), icon: 'people-outline' },
      { name: 'stores', title: t('tabs.stores'), icon: 'storefront-outline' },
      { name: 'more', title: t('tabs.more'), icon: 'grid-outline' },
    ]} />
  );
}
