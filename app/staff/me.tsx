import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import React from 'react';
import { Linking, View } from 'react-native';

import { ProfileMenu } from '@/components/profile';
import { Button, Card, IconBubble, Row, Screen, Section, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useNotifications, useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';
import { useMyEmployments } from '@/state/staff';
import { useTheme } from '@/theme';
import { ago, dayLabel, localDateOf, mapsUrl, money } from '@/utils/format';
import { wageText } from '@/utils/pay';

export default function Me() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { colors } = useTheme();
  const employments = useMyEmployments();
  const notifications = useNotifications();
  const points = useQueries({
    queries: (employments.data ?? []).map((e) => ({ queryKey: ['points', org, e.employmentId], queryFn: () => api.points(e.employmentId) })),
  });

  return (
    <Screen title={t('me.title')} onRefresh={() => { employments.refetch(); points.forEach((p) => p.refetch()); }} refreshing={false}>
      <ProfileMenu items={[
        { title: t('prefs.menu'), subtitle: t('prefs.menuSub'), icon: 'calendar-outline', tone: 'primary', href: '/preferences' },
        { title: t('me.payslips'), subtitle: t('me.payslipsSub'), icon: 'wallet-outline', tone: 'success', href: '/payslips' },
        { title: t('more.notifications'), icon: 'notifications-outline', tone: 'info', href: '/notifications', badge: notifications.data?.filter((n) => !n.deliveredAt).length },
        { title: t('me.record'), icon: 'alert-circle-outline', tone: 'warning', href: '/violations' },
        { title: t('me.joinAnother'), subtitle: t('me.joinAnotherSub'), icon: 'key-outline', tone: 'accent', href: '/join' },
      ]} />

      <Section title={t('me.myStores')}>
        {(employments.data ?? []).map((e, i) => {
          const p = points[i]?.data;
          return (
            <Card key={e.employmentId} style={{ gap: 12 }}>
              <Row>
                <IconBubble icon="storefront" tone="accent" />
                <View style={{ flex: 1 }}>
                  <Txt variant="subheading">{e.storeName}</Txt>
                  <Txt variant="small" muted>
                    {t('common.since', { date: dayLabel(localDateOf(e.startedAt)) })} · {wageText(e.currentWage, e.wageBasis, e.currency)}
                  </Txt>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt variant="heading" color={(p?.balance ?? 0) < 0 ? colors.danger : colors.warning}>⭐ {p?.balance ?? '–'}</Txt>
                  <Txt variant="small" muted>{t('me.points')}</Txt>
                </View>
              </Row>
              {e.storeAddress ? (
                <Row gap={8} style={{ alignItems: 'flex-start' }}>
                  <Ionicons name="location-outline" size={18} color={colors.textMuted} />
                  <Txt variant="small" style={{ flex: 1 }}>{e.storeAddress}</Txt>
                  <Button small variant="ghost" icon="navigate-outline" title={t('storeInfo.directions')}
                    onPress={() => Linking.openURL(mapsUrl(e.storeAddress!))} />
                </Row>
              ) : null}
              {p?.entries.length ? (
                <View style={{ gap: 6 }}>
                  {[...p.entries].reverse().slice(0, 3).map((x) => (
                    <Row key={x.id} gap={8}>
                      <Txt variant="small" style={{ width: 36, fontWeight: '800' }} color={x.delta < 0 ? colors.danger : colors.success}>{x.delta > 0 ? '+' : ''}{x.delta}</Txt>
                      <Txt variant="small" style={{ flex: 1 }} numberOfLines={1}>{x.reason}</Txt>
                      <Txt variant="small" muted>{ago(x.effectiveAt)}</Txt>
                    </Row>
                  ))}
                </View>
              ) : null}
            </Card>
          );
        })}
      </Section>
    </Screen>
  );
}
