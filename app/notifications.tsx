import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { NotificationView } from '@/api/types';

import { Card, Empty, ErrorState, IconBubble, Loading, Row, Screen, Sheet, Txt, type IconName, type Tone } from '@/components/ui';
import { useI18n } from '@/i18n';
import { notificationRoute } from '@/notifications/route';
import { notificationText } from '@/notifications/text';
import { useNotifications } from '@/state/queries';
import { useSession } from '@/state/session';
import { useTheme } from '@/theme';
import { ago, dateTime } from '@/utils/format';

function look(eventType: string): { icon: IconName; tone: Tone } {
  if (eventType.includes('swap')) return { icon: 'swap-horizontal', tone: 'info' };
  if (eventType.includes('enrollment')) return { icon: 'person-add-outline', tone: 'accent' };
  if (eventType.includes('understaffed') || eventType.includes('failed')) return { icon: 'warning-outline', tone: 'danger' };
  if (eventType.includes('violation')) return { icon: 'alert-circle-outline', tone: 'warning' };
  if (eventType.includes('points') || eventType.includes('reward')) return { icon: 'star-outline', tone: 'success' };
  return { icon: 'calendar-outline', tone: 'primary' };
}

/** The feed. Tapping one opens what it is about (a shift, approvals, payslips...), or shows it in full. */
export default function Notifications() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { isManager } = useSession();
  const q = useNotifications();
  const [open, setOpen] = useState<NotificationView | null>(null);
  return (
    <Screen onRefresh={q.refetch} refreshing={q.isRefetching}>
      <View style={{ gap: 10, marginTop: 12 }}>
        {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} />
          : (q.data ?? []).length === 0 ? <Empty icon="notifications-off-outline" title={t('notifications.empty')} />
            : q.data!.map((n) => {
              const l = look(n.eventType);
              const route = notificationRoute(n.eventType, n.payload, isManager);
              return (
                <Card key={n.id} style={{ paddingVertical: 14 }} onPress={() => (route ? router.push(route) : setOpen(n))}>
                  <Row>
                    <IconBubble icon={l.icon} tone={l.tone} size={38} />
                    <View style={{ flex: 1 }}>
                      <Txt numberOfLines={3}>{notificationText(n)}</Txt>
                      <Txt variant="small" muted>{ago(n.availableAt)}</Txt>
                    </View>
                    {route ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
                  </Row>
                </Card>
              );
            })}
      </View>
      <Sheet visible={!!open} onClose={() => setOpen(null)} title={t('notifications.detail')}>
        {open ? (
          <View style={{ gap: 12 }}>
            <Row>
              <IconBubble icon={look(open.eventType).icon} tone={look(open.eventType).tone} size={38} />
              <Txt variant="small" muted style={{ flex: 1 }}>{dateTime(open.availableAt)}</Txt>
            </Row>
            <Txt>{notificationText(open)}</Txt>
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
