import React from 'react';
import { View } from 'react-native';

import { Card, Empty, ErrorState, IconBubble, Loading, Row, Screen, Txt, type IconName, type Tone } from '@/components/ui';
import { useI18n } from '@/i18n';
import { notificationText } from '@/notifications/text';
import { useNotifications } from '@/state/queries';
import { ago } from '@/utils/format';

function look(eventType: string): { icon: IconName; tone: Tone } {
  if (eventType.includes('swap')) return { icon: 'swap-horizontal', tone: 'info' };
  if (eventType.includes('enrollment')) return { icon: 'person-add-outline', tone: 'accent' };
  if (eventType.includes('understaffed') || eventType.includes('failed')) return { icon: 'warning-outline', tone: 'danger' };
  if (eventType.includes('violation')) return { icon: 'alert-circle-outline', tone: 'warning' };
  if (eventType.includes('points') || eventType.includes('reward')) return { icon: 'star-outline', tone: 'success' };
  return { icon: 'calendar-outline', tone: 'primary' };
}

export default function Notifications() {
  const { t } = useI18n();
  const q = useNotifications();
  return (
    <Screen onRefresh={q.refetch} refreshing={q.isRefetching}>
      <View style={{ gap: 10, marginTop: 12 }}>
        {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} />
          : (q.data ?? []).length === 0 ? <Empty icon="notifications-off-outline" title={t('notifications.empty')} />
            : q.data!.map((n) => {
              const l = look(n.eventType);
              return (
                <Card key={n.id} style={{ paddingVertical: 14 }}>
                  <Row>
                    <IconBubble icon={l.icon} tone={l.tone} size={38} />
                    <View style={{ flex: 1 }}>
                      <Txt>{notificationText(n)}</Txt>
                      <Txt variant="small" muted>{ago(n.availableAt)}</Txt>
                    </View>
                  </Row>
                </Card>
              );
            })}
      </View>
    </Screen>
  );
}
