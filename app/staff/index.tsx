import { useQueries, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import type { AssignmentView, ClockType } from '@/api/types';
import { AssignmentCard, shortStore } from '@/components/domain';
import { useAction } from '@/components/toast';
import { Badge, Button, Card, Empty, IconBubble, IconButton, Loading, Row, Screen, Section, Txt } from '@/components/ui';
import { tv, useI18n } from '@/i18n';
import { useNotifications, useOrgKey } from '@/state/queries';
import { useApi, useSession } from '@/state/session';
import { useMyEmployments, useMyRequests, useMySchedule } from '@/state/staff';
import { useTheme } from '@/theme';
import { dateTime, localDateOf, relativeDay, time, timeRange } from '@/utils/format';

const EARLY_MINUTES = 30;

export default function StaffHome() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { session } = useSession();
  const employments = useMyEmployments();
  const schedule = useMySchedule(1, 21);
  const requests = useMyRequests();
  const notifications = useNotifications();
  const points = useQueries({
    queries: (employments.data ?? []).map((e) => ({ queryKey: ['points', org, e.employmentId], queryFn: () => api.points(e.employmentId) })),
  });
  const storeName = (id: string) => shortStore(employments.data?.find((e) => e.storeId === id)?.storeName ?? '');
  const now = Date.now();
  const upcoming = (schedule.data ?? []).filter((a) => a.state === 'assigned' && Date.parse(a.endsAt) > now);
  const current = upcoming[0];
  const later = upcoming.slice(1, 4);
  const pending = (requests.data ?? []).filter((r) => r.status === 'pending' || r.status === 'waitlisted');
  const totalPoints = points.reduce((n, q) => n + (q.data?.balance ?? 0), 0);
  const unread = notifications.data?.filter((n) => !n.deliveredAt).length ?? 0;

  const refresh = () => Promise.all([employments.refetch(), schedule.refetch(), requests.refetch(), notifications.refetch(), ...points.map((p) => p.refetch())]);

  return (
    <Screen title={t('staff.hello', { name: session?.displayName.split(' ').at(-1) })} subtitle={session?.workspace?.name}
      right={<IconButton icon="notifications-outline" label={t('owner.notifications')} badge={unread} onPress={() => router.push('/notifications')} />}
      onRefresh={refresh} refreshing={false}>
      {employments.data && employments.data.length === 0 ? (
        <Empty icon="hourglass-outline" title={t('staff.waitingTitle')} message={t('staff.waitingMsg')} />
      ) : null}

      {schedule.isLoading ? <Loading /> : current ? (
        <NextShift a={current} storeName={storeName(current.storeId)} />
      ) : (
        <Card tone="accent" style={{ gap: 10 }}>
          <Txt variant="heading">{t('staff.noUpcoming')}</Txt>
          <Txt>{t('staff.pickUp')}</Txt>
          <Button title={t('tabs.find')} icon="search" variant="accent" onPress={() => router.push('/staff/find')} />
        </Card>
      )}

      <Row gap={10} style={{ marginTop: 14 }}>
        <Card style={{ flex: 1, gap: 6 }} onPress={() => router.push('/staff/me')}>
          <IconBubble icon="star" tone="warning" size={34} />
          <Txt variant="heading">{totalPoints}</Txt>
          <Txt variant="small" muted>{t('common.points')}</Txt>
        </Card>
        <Card style={{ flex: 1, gap: 6 }} onPress={() => router.push('/staff/shifts')}>
          <IconBubble icon="calendar" tone="primary" size={34} />
          <Txt variant="heading">{upcoming.length}</Txt>
          <Txt variant="small" muted>{t('staff.upcoming')}</Txt>
        </Card>
      </Row>

      {pending.length ? (
        <Section title={t('staff.waitingAnswer')}>
          {pending.map((r) => (
            <Card key={r.id} onPress={() => router.push(`/shift/${r.shiftId}`)}>
              <Row>
                <IconBubble icon="hourglass-outline" tone="warning" size={36} />
                <View style={{ flex: 1 }}>
                  <Txt>{t('staff.requestAt', { store: storeName(r.storeId) })}</Txt>
                  <Txt variant="small" muted>{t('staff.sent', { when: dateTime(r.requestedAt) })}</Txt>
                </View>
                <Badge label={tv('status', r.status)} tone={r.status === 'waitlisted' ? 'info' : 'warning'} />
              </Row>
            </Card>
          ))}
        </Section>
      ) : null}

      {later.length ? (
        <Section title={t('staff.comingUp')} action={t('common.seeAll')} onAction={() => router.push('/staff/shifts')}>
          {later.map((a) => <AssignmentCard key={a.id} a={a} storeName={storeName(a.storeId)} onPress={() => router.push(`/shift/${a.shiftId}`)} />)}
        </Section>
      ) : null}
    </Screen>
  );
}

function NextShift({ a, storeName }: { a: AssignmentView; storeName: string }) {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { colors } = useTheme();
  const [run, busy] = useAction();
  const events = useQuery({ queryKey: ['attendance', org, a.id], queryFn: () => api.attendance(a.id) });
  const last = events.data?.at(-1)?.type;
  const opensAt = Date.parse(a.startsAt) - EARLY_MINUTES * 60_000;
  const canClock = Date.now() >= opensAt;
  const live = Date.now() >= Date.parse(a.startsAt);
  const clock = (type: ClockType, msg: string) =>
    run(type, () => api.clock(a.id, type, `${a.id}:${type}:${Date.now()}`), msg);

  return (
    <Card style={{ gap: 14, backgroundColor: colors.primary, borderWidth: 0 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="small" color="rgba(255,255,255,0.8)">{live ? t('staff.happeningNow') : t('staff.nextShift')} · {storeName}</Txt>
        {last === 'clock_in' || last === 'break_end' ? <Badge label={t('staff.onClock')} tone="success" icon="radio-button-on" />
          : last === 'break_start' ? <Badge label={t('staff.onBreak')} tone="warning" icon="cafe" /> : null}
      </Row>
      <View>
        <Txt variant="title" color="#fff">{relativeDay(localDateOf(a.startsAt))}</Txt>
        <Txt variant="heading" color="#fff">{timeRange(a.startsAt, a.endsAt)}</Txt>
      </View>
      {events.isLoading ? null : !last || last === 'clock_out' ? (
        canClock ? (
          <Button title={t('staff.clockIn')} icon="finger-print" variant="accent" full loading={busy === 'clock_in'} onPress={() => clock('clock_in', t('staff.clockedIn'))} />
        ) : (
          <Txt variant="small" color="rgba(255,255,255,0.85)">{t('staff.clockOpens', { time: time(new Date(opensAt).toISOString()) })}</Txt>
        )
      ) : (
        <Row gap={8}>
          {last === 'break_start' ? (
            <Button title={t('staff.endBreak')} icon="play" variant="secondary" style={{ flex: 1 }} loading={busy === 'break_end'} onPress={() => clock('break_end', t('staff.welcomeBack'))} />
          ) : (
            <Button title={t('staff.startBreak')} icon="cafe-outline" variant="secondary" style={{ flex: 1 }} loading={busy === 'break_start'} onPress={() => clock('break_start', t('staff.enjoyBreak'))} />
          )}
          <Button title={t('staff.clockOut')} icon="log-out-outline" variant="accent" style={{ flex: 1 }} loading={busy === 'clock_out'} onPress={() => clock('clock_out', t('staff.clockedOut'))} />
        </Row>
      )}
      {events.data?.length ? (
        <Txt variant="small" color="rgba(255,255,255,0.8)">
          {events.data.map((e) => `${t(`staff.${e.type}`)} ${time(e.occurredAt)}`).join(' · ')}
        </Txt>
      ) : null}
    </Card>
  );
}
