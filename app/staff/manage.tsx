import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { AssignmentView } from '@/api/types';
import { StorePicker, codeLabel } from '@/components/domain';
import { IssueSheet } from '@/components/issueSheet';
import { useAction } from '@/components/toast';
import { Avatar, Badge, Button, Card, Empty, Row, Screen, Section, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useManagedStores, useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';
import { ago, dayLabel, localDateOf, relativeDay, timeRange } from '@/utils/format';

/**
 * "Quản lý": for staff the owner made manager of one or more stores. What waits for them at each store (shift requests,
 * swaps, violations to confirm), reporting a violation, and the store's week to put or borrow people on shifts.
 */
export default function Manage() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const managed = useManagedStores();
  const stores = (managed.data ?? []).map((s) => ({ id: s.storeId, name: s.storeName }));
  const [storeId, setStoreId] = useState<string | null>(null);
  const selected = storeId ?? stores[0]?.id ?? null;
  const [reporting, setReporting] = useState(false);
  const on = !!selected;
  const requests = useQuery({ queryKey: ['requests', org, selected], queryFn: () => api.openRequests(selected!), enabled: on });
  const swaps = useQuery({ queryKey: ['swaps', org, 'accepted'], queryFn: () => api.swaps('accepted'), enabled: on });
  const violations = useQuery({ queryKey: ['violations', org, 'store', selected, 'reported'],
    queryFn: () => api.violations({ storeId: selected!, status: 'reported' }), enabled: on });
  const team = useQuery({ queryKey: ['employees', org, selected], queryFn: () => api.employees(selected!), enabled: on });
  const policy = useQuery({ queryKey: ['policy', org, selected], queryFn: () => api.policy(selected!), enabled: on });

  const pending = (requests.data ?? []).filter((r) => r.status === 'pending' || r.status === 'waitlisted');
  const storeSwaps = (swaps.data ?? []).filter((s) => s.from.storeId === selected);
  const reported = violations.data ?? [];
  const nameOf = (employmentId: string) => team.data?.find((e) => e.employmentId === employmentId)?.displayName ?? '';
  const shiftText = (a: AssignmentView) => `${relativeDay(localDateOf(a.startsAt))} ${timeRange(a.startsAt, a.endsAt)}`;
  const refresh = () => { requests.refetch(); swaps.refetch(); violations.refetch(); };

  return (
    <Screen title={t('manage.title')} subtitle={t('manage.subtitle')} onRefresh={refresh} refreshing={false}>
      <StorePicker stores={stores} value={selected} onChange={setStoreId} />
      <Row gap={8}>
        <Button title={t('manage.week')} icon="calendar-number-outline" variant="secondary" style={{ flex: 1 }}
          onPress={() => router.push(`/store-week?storeId=${selected}`)} />
        <Button title={t('manage.report')} icon="flag-outline" variant="secondary" style={{ flex: 1 }} onPress={() => setReporting(true)} />
      </Row>
      <Txt variant="small" muted style={{ marginTop: 8 }}>{t('manage.hint')}</Txt>

      {!pending.length && !storeSwaps.length && !reported.length ? (
        <View style={{ marginTop: 16 }}><Empty icon="checkmark-done-outline" title={t('manage.nothing')} /></View>
      ) : null}

      {pending.length ? (
        <Section title={t('manage.requests', { n: pending.length })}>
          {pending.map((r) => (
            <Card key={r.id} style={{ gap: 12 }} onPress={() => router.push(`/shift/${r.shiftId}`)}>
              <Row>
                <Avatar name={r.displayName} />
                <View style={{ flex: 1 }}>
                  <Txt variant="subheading">{r.displayName}</Txt>
                  <Txt variant="small" muted>{t('shift.asked', { ago: ago(r.requestedAt) })}</Txt>
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
        </Section>
      ) : null}

      {storeSwaps.length ? (
        <Section title={t('manage.swaps', { n: storeSwaps.length })}>
          {storeSwaps.map((s) => (
            <Card key={s.id} style={{ gap: 10 }}>
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
        </Section>
      ) : null}

      {reported.length ? (
        <Section title={t('manage.violations', { n: reported.length })}>
          {reported.map((v) => (
            <Card key={v.id} style={{ gap: 8 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="subheading" style={{ flex: 1 }}>{nameOf(v.employmentId)} · {codeLabel(v.code)}</Txt>
                {v.points != null ? <Txt variant="subheading">{v.points}</Txt> : null}
              </Row>
              <Txt variant="small" muted>{dayLabel(localDateOf(v.occurredAt))} · {v.description}</Txt>
              <Row gap={8}>
                <Button small title={t('manage.confirm')} icon="checkmark" loading={busy === `vc${v.id}`} style={{ flex: 1 }}
                  onPress={() => run(`vc${v.id}`, () => api.violationAction(v.id, 'confirm'), t('manage.confirmed'))} />
                <Button small title={t('manage.dismiss')} variant="secondary" loading={busy === `vd${v.id}`} style={{ flex: 1 }}
                  onPress={() => run(`vd${v.id}`, () => api.violationAction(v.id, 'dismiss'), t('manage.dismissed'))} />
              </Row>
            </Card>
          ))}
        </Section>
      ) : null}

      <IssueSheet key={selected ?? 'none'} visible={reporting} onClose={() => setReporting(false)}
        people={(team.data ?? []).filter((e) => e.status === 'active')} codes={policy.data?.rules?.violations ?? {}} />
    </Screen>
  );
}
