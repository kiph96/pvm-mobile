import { useQueries, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import type { AssignmentView } from '@/api/types';
import { useBusinessSwitcher } from '@/components/businessSwitcher';
import { businessName } from '@/components/businessType';
import { ShiftCard, useStores } from '@/components/domain';
import { GettingStarted } from '@/components/gettingStarted';
import { useAction } from '@/components/toast';
import { Avatar, Badge, Button, Card, Empty, IconButton, Loading, Row, Screen, Section, Stat, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAllStores, useApprovals, useNotifications, useOrgKey } from '@/state/queries';
import { greetingName, useApi, useSession } from '@/state/session';
import { ago, fullDate, localDateOf, relativeDay, timeRange, today } from '@/utils/format';

export default function OwnerHome() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { session } = useSession();
  const [run, busy] = useAction();
  const { stores, isLoading: storesLoading, refetch: refetchStores } = useStores();
  const approvals = useApprovals();
  const notifications = useNotifications();
  const plan = useQuery({ queryKey: ['plan', org], queryFn: api.plan });
  const switcher = useBusinessSwitcher();
  const all = useAllStores();
  const day = today();
  const todays = useQueries({
    queries: stores.map((s) => ({ queryKey: ['shifts', org, s.id, day, day], queryFn: () => api.shifts(s.id, day, day) })),
  });
  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? '';
  const pendingRequests = approvals.requests.data?.filter((r) => r.status === 'pending') ?? [];
  const todayShifts = todays.flatMap((q) => q.data ?? []).filter((s) => s.status !== 'cancelled')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const understaffed = todayShifts.filter((s) => s.belowMinimum).length;
  const unread = notifications.data?.filter((n) => !n.deliveredAt).length ?? 0;
  const shiftText = (a: AssignmentView) => `${relativeDay(localDateOf(a.startsAt))} ${timeRange(a.startsAt, a.endsAt)}`;

  const refresh = () => Promise.all([refetchStores(), approvals.refetch(), notifications.refetch(), plan.refetch(), ...todays.map((q) => q.refetch())]);

  return (
    <Screen title={businessName(session?.workspace) || t('tabs.home')} onTitlePress={switcher.open} titleLabel={t('switcher.title')}
      subtitle={t('owner.greeting', { part: t(`time.${greeting()}`), name: greetingName(session) })}
      right={<IconButton icon="notifications-outline" label={t('owner.notifications')} badge={unread} onPress={() => router.push('/notifications')} />}
      onRefresh={refresh} refreshing={false}>

      <GettingStarted stores={stores} storesLoaded={!storesLoading} />

      <Row wrap gap={10} style={{ alignItems: 'stretch' }}>
        {/* stores of this business; the label adds the total when the owner has other businesses */}
        <Stat icon="storefront-outline" value={stores.length} tone="accent" onPress={() => router.push('/owner/stores')}
          label={all.total > stores.length ? t('owner.storesOfTotal', { total: all.total }) : t('owner.stores')} />
        <Stat icon="people-outline" label={t('owner.team')} value={plan.data?.employees ?? '–'} tone="info" onPress={() => router.push('/owner/team')} />
        <Stat icon={understaffed ? 'warning-outline' : 'checkmark-done-outline'} label={t('owner.shortToday')} value={understaffed}
          tone={understaffed ? 'danger' : 'success'} onPress={() => router.push('/owner/schedule')} />
      </Row>

      <Section title={t('owner.needsOk')}>
        {approvals.loading ? <Loading /> : approvals.count === 0 ? (
          <Card tone="success"><Row><Txt>🎉</Txt><Txt style={{ flex: 1 }}>{t('owner.allCaughtUp')}</Txt></Row></Card>
        ) : (
          <>
            {approvals.enrollments.data?.map((e) => (
              <Card key={e.id} style={{ gap: 12 }}>
                <Row>
                  <Avatar name={e.displayName} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="subheading">{e.displayName}</Txt>
                    <Txt variant="small" muted>{t('owner.wantsToJoin', { store: storeName(e.storeId), ago: ago(e.requestedAt) })}</Txt>
                  </View>
                  <Badge label={t('owner.newHire')} tone="accent" />
                </Row>
                <Row gap={8}>
                  <Button small title={t('common.approve')} icon="checkmark" loading={busy === `ea${e.id}`} style={{ flex: 1 }}
                    onPress={() => run(`ea${e.id}`, () => api.approveEnrollment(e.id), t('owner.joinedTeam', { name: e.displayName }))} />
                  <Button small title={t('common.decline')} variant="secondary" loading={busy === `er${e.id}`} style={{ flex: 1 }}
                    onPress={() => run(`er${e.id}`, () => api.rejectEnrollment(e.id), t('owner.requestDeclined'))} />
                </Row>
              </Card>
            ))}
            {pendingRequests.map((r) => (
              <Card key={r.id} style={{ gap: 12 }} onPress={() => router.push(`/shift/${r.shiftId}`)}>
                <Row>
                  <Avatar name={r.displayName} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="subheading">{r.displayName}</Txt>
                    <Txt variant="small" muted>{t('owner.asksForShift', { store: storeName(r.storeId), ago: ago(r.requestedAt) })}</Txt>
                  </View>
                  <Badge label={t('owner.shiftBadge')} tone="primary" />
                </Row>
                <Row gap={8}>
                  <Button small title={t('common.approve')} icon="checkmark" loading={busy === `ra${r.id}`} style={{ flex: 1 }}
                    onPress={() => run(`ra${r.id}`, () => api.approveRequest(r.id), t('owner.shiftBooked'))} />
                  <Button small title={t('common.decline')} variant="secondary" loading={busy === `rr${r.id}`} style={{ flex: 1 }}
                    onPress={() => run(`rr${r.id}`, () => api.rejectRequest(r.id), t('owner.requestDeclined'))} />
                </Row>
              </Card>
            ))}
            {approvals.swaps.data?.map((s) => (
              <Card key={s.id} style={{ gap: 12 }}>
                <Row>
                  <Badge label={t('owner.swapBadge')} tone="info" icon="swap-horizontal" />
                  <Txt variant="small" muted style={{ flex: 1 }}>{t('owner.bothAgreed', { ago: ago(s.acceptedAt ?? s.expiresAt) })}</Txt>
                </Row>
                {[[s.from, s.to], [s.to, s.from]].map(([give, get]) => (
                  <Row key={give.id} gap={10}>
                    <Avatar name={give.displayName} size={30} />
                    <Txt variant="small" style={{ flex: 1 }}>
                      {t('owner.swapLine', { name: give.displayName, gives: shiftText(give), gets: shiftText(get) })}
                    </Txt>
                  </Row>
                ))}
                <Row gap={8}>
                  <Button small title={t('owner.approveSwap')} icon="checkmark" loading={busy === `sa${s.id}`} style={{ flex: 1 }}
                    onPress={() => run(`sa${s.id}`, () => api.swapAction(s.id, 'approve'), t('owner.swapApproved'))} />
                  <Button small title={t('common.reject')} variant="secondary" loading={busy === `sr${s.id}`} style={{ flex: 1 }}
                    onPress={() => run(`sr${s.id}`, () => api.swapAction(s.id, 'reject'), t('owner.swapRejected'))} />
                </Row>
              </Card>
            ))}
            {approvals.violations.data?.length ? (
              <Card onPress={() => router.push('/violations')}>
                <Row>
                  <Badge label={t('owner.toReview', { n: approvals.violations.data.length })} tone="warning" icon="alert-circle-outline" />
                  <Txt style={{ flex: 1 }}>{t('owner.reportedIssues')}</Txt>
                </Row>
              </Card>
            ) : null}
          </>
        )}
      </Section>

      <Section title={t('owner.today')} action={t('tabs.schedule')} onAction={() => router.push('/owner/schedule')}>
        {storesLoading || todays.some((q) => q.isLoading) ? <Loading /> : todayShifts.length === 0 ? (
          <Empty icon="calendar-outline" title={t('owner.noShiftsToday')} message={t('owner.noShiftsTodayMsg')} />
        ) : todayShifts.map((s) => (
          <ShiftCard key={s.id} shift={s} showDate={false} title={storeName(s.storeId)} onPress={() => router.push(`/shift/${s.id}`)} />
        ))}
      </Section>

      {plan.data ? (
        <Section title={t('owner.plan')} action={t('owner.details')} onAction={() => router.push('/billing')}>
          <Card style={{ gap: 4 }} tone={plan.data.overLimit ? 'warning' : undefined} onPress={() => router.push('/billing')}>
            <Txt variant="heading">
              {plan.data.plan === 'pro' ? t('plan.proN', { n: plan.data.storeLimit }) : t('plan.free')}
              {plan.data.plan === 'pro' && plan.data.subscription ? (
                <Txt variant="small" muted> · {t('plan.renews', { date: fullDate(plan.data.subscription.expiresAt) })}</Txt>
              ) : null}
            </Txt>
            <Txt variant="small" muted>
              {t('plan.usage', { stores: plan.data.stores, storeLimit: plan.data.storeLimit, employees: plan.data.employees })}
              {plan.data.employeeLimit != null ? ` / ${plan.data.employeeLimit}` : ''}
            </Txt>
            {plan.data.overLimit ? <Txt variant="small">{t('plan.overLimit')}</Txt> : null}
          </Card>
        </Section>
      ) : null}
      {switcher.sheet}
    </Screen>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}
