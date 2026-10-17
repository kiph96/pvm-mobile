import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { StatusBadge, StorePicker, useStores } from '@/components/domain';
import { InviteSheet } from '@/components/inviteSheet';
import { useAction } from '@/components/toast';
import { Avatar, Badge, Button, Card, Empty, ErrorState, IconButton, ListItem, Loading, Row, Screen, Segmented, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';
import { ago, dayLabel, localDateOf, money } from '@/utils/format';
import { wageText } from '@/utils/pay';

export default function Team() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const { stores, store, storeId, setStoreId } = useStores();
  const [tab, setTab] = useState<'team' | 'requests'>('team');
  // ?invite=1 (from the dashboard checklist) opens "Add staff" right away
  const { invite } = useLocalSearchParams<{ invite?: string }>();
  const [inviteOpen, setInviteOpen] = useState(invite === '1');
  const team = useQuery({ queryKey: ['employees', org, storeId], queryFn: () => api.employees(storeId!), enabled: !!storeId });
  const joins = useQuery({ queryKey: ['enrollments', org, 'store', storeId], queryFn: () => api.enrollments(storeId!), enabled: !!storeId });
  const pending = (joins.data ?? []).filter((e) => e.status === 'pending');
  const active = (team.data ?? []).filter((e) => e.status !== 'ended');
  const former = (team.data ?? []).filter((e) => e.status === 'ended');

  return (
    <Screen title={t('team.title')} subtitle={store?.name}
      right={<IconButton icon="person-add-outline" label={t('invite.title')} tone="primary" onPress={() => setInviteOpen(true)} />}
      onRefresh={() => { team.refetch(); joins.refetch(); }} refreshing={team.isRefetching}>
      <StorePicker stores={stores} value={storeId} onChange={setStoreId} />
      <Segmented value={tab} onChange={setTab} options={[
        { value: 'team', label: t('team.tabTeam', { n: active.length }) },
        { value: 'requests', label: t('team.tabRequests'), badge: pending.length },
      ]} />
      <View style={{ gap: 10, marginTop: 14 }}>
        {tab === 'team' ? (
          team.isLoading ? <Loading /> : team.error ? <ErrorState error={team.error} onRetry={team.refetch} />
            : active.length === 0 ? (
              pending.length > 0 ? (
                <Empty icon="mail-unread-outline" title={t('team.emptyTitle')} message={t('team.waitingMsg', { n: pending.length })}
                  action={t('team.review')} onAction={() => setTab('requests')} />
              ) : (
                <Empty icon="people-outline" title={t('team.emptyTitle')} message={t('team.emptyMsg')}
                  action={t('invite.title')} onAction={() => setInviteOpen(true)} />
              )
            ) : (
              <>
                {active.map((e) => (
                  <ListItem key={e.employmentId} title={e.displayName}
                    subtitle={`${wageText(e.currentWage, e.wageBasis, e.currency)} · ${t('common.since', { date: dayLabel(localDateOf(e.startedAt)) })}`}
                    left={<Avatar name={e.displayName} />}
                    right={e.status !== 'active' ? <StatusBadge status={e.status} />
                      : e.currentWage == null ? <Badge label={t('team.noWage')} tone="warning" icon="cash-outline" /> : undefined}
                    onPress={() => router.push(`/employee/${e.employmentId}?storeId=${e.storeId}`)} />
                ))}
                {former.length ? <Txt variant="small" muted style={{ marginTop: 8 }}>{t('team.former', { names: former.map((e) => e.displayName).join(', ') })}</Txt> : null}
              </>
            )
        ) : joins.isLoading ? <Loading /> : (joins.data ?? []).length === 0 ? (
          <Empty icon="mail-open-outline" title={t('team.noRequests')} message={t('team.noRequestsMsg')} />
        ) : (joins.data ?? []).map((e) => (
          <Card key={e.id} style={{ gap: 12 }}>
            <Row>
              <Avatar name={e.displayName} />
              <View style={{ flex: 1 }}>
                <Txt variant="subheading">{e.displayName}</Txt>
                <Txt variant="small" muted>{t('team.requested', { ago: ago(e.requestedAt) })}</Txt>
              </View>
              <StatusBadge status={e.status} />
            </Row>
            {e.warning ? <Badge label={e.warning} tone="warning" icon="warning-outline" /> : null}
            {e.status === 'pending' ? (
              <Row gap={8}>
                <Button small title={t('common.approve')} icon="checkmark" style={{ flex: 1 }} loading={busy === `a${e.id}`}
                  onPress={() => run(`a${e.id}`, () => api.approveEnrollment(e.id), t('team.welcome', { name: e.displayName }))} />
                <Button small title={t('common.decline')} variant="secondary" style={{ flex: 1 }} loading={busy === `r${e.id}`}
                  onPress={() => run(`r${e.id}`, () => api.rejectEnrollment(e.id), t('owner.requestDeclined'))} />
              </Row>
            ) : null}
          </Card>
        ))}
      </View>
      <InviteSheet visible={inviteOpen} onClose={() => setInviteOpen(false)} stores={stores} initialStoreId={storeId} />
    </Screen>
  );
}
