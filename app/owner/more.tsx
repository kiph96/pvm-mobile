import React from 'react';

import { ProfileMenu } from '@/components/profile';
import { Screen } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useApprovals, useNotifications } from '@/state/queries';

export default function OwnerMore() {
  const { t } = useI18n();
  const { violations } = useApprovals();
  const notifications = useNotifications();
  return (
    <Screen title={t('more.title')}>
      <ProfileMenu items={[
        { title: t('digest.menu'), subtitle: t('digest.menuSub'), icon: 'moon-outline', tone: 'primary', href: '/daily-digest' },
        { title: t('more.payroll'), subtitle: t('more.payrollSub'), icon: 'cash-outline', tone: 'success', href: '/payroll' },
        { title: t('more.violations'), subtitle: t('more.violationsSub'), icon: 'alert-circle-outline', tone: 'warning', href: '/violations', badge: violations.data?.length },
        { title: t('more.notifications'), icon: 'notifications-outline', tone: 'info', href: '/notifications', badge: notifications.data?.filter((n) => !n.deliveredAt).length },
        { title: t('more.billing'), subtitle: t('more.billingSub'), icon: 'card-outline', tone: 'accent', href: '/billing' },
      ]} />
    </Screen>
  );
}
