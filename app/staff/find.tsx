import { useQueries, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { ShiftView, WeekRequestResult } from '@/api/types';
import { StorePicker } from '@/components/domain';
import { useAction } from '@/components/toast';
import { Badge, Button, Card, Empty, IconBubble, Loading, Row, Screen, StaffingBar, Txt, confirm } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';
import { useMyEmployments, useMyRequests, useMySchedule } from '@/state/staff';
import { addDays, dateTime, hoursBetween, money, relativeDay, signupState, timeRange, today } from '@/utils/format';
import { wageText } from '@/utils/pay';

/** Open shifts at my stores for the next two weeks. */
export default function FindShifts() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const employments = useMyEmployments();
  const mine = useMySchedule(0, 14);
  const requests = useMyRequests();
  const stores = (employments.data ?? []).map((e) => ({ id: e.storeId, name: e.storeName }));
  const [storeId, setStoreId] = useState<string | null>(null);
  const selected = storeId ?? stores[0]?.id ?? null;
  const from = today();
  const to = addDays(from, 14);
  const lists = useQueries({
    queries: stores.map((s) => ({ queryKey: ['shifts', org, s.id, from, to], queryFn: () => api.shifts(s.id, from, to) })),
  });
  const myShiftIds = new Set((mine.data ?? []).map((a) => a.shiftId));
  const asked = new Map((requests.data ?? []).filter((r) => r.status === 'pending' || r.status === 'waitlisted').map((r) => [r.shiftId, r.status]));
  const employment = employments.data?.find((e) => e.storeId === selected);
  const open = (lists[stores.findIndex((s) => s.id === selected)]?.data ?? [])
    .filter((s) => s.status === 'published' && Date.parse(s.startsAt) > Date.now() && !myShiftIds.has(s.id));
  const days = [...new Set(open.map((s) => s.localDate))];

  const prefs = useQuery({ queryKey: ['preferences', org, selected], queryFn: () => api.preferences(selected!), enabled: !!selected });
  const hasPrefs = (prefs.data?.slots.length ?? 0) > 0;
  const weekResult = (r: WeekRequestResult) => {
    const parts = [r.booked ? t('week.booked', { n: r.booked }) : null, r.requested ? t('week.requested', { n: r.requested }) : null,
      r.waitlisted ? t('week.waitlisted', { n: r.waitlisted }) : null].filter(Boolean);
    return parts.length ? parts.join(' · ') : t('week.none');
  };
  const askWeek = async () => {
    if (!selected || !await confirm(t('week.confirmTitle'), t('week.confirmMsg'), t('week.confirm'))) return;
    run('week', () => api.requestWeek(selected), weekResult);
  };

  const ask = (s: ShiftView) => run(s.id, () => api.registerForShift(s.id),
    (r) => r.status === 'approved' ? t('shift.booked') : r.status === 'waitlisted' ? t('find.fullWaitlist') : t('shift.requestSent'));

  return (
    <Screen title={t('find.title')} subtitle={t('find.subtitle')} onRefresh={() => lists.forEach((l) => l.refetch())} refreshing={false}>
      <StorePicker stores={stores} value={selected} onChange={setStoreId} />
      {employment?.currentWage ? (
        <Card tone="success" style={{ marginBottom: 14 }}>
          <Txt>{t('find.earn', { amount: wageText(employment.currentWage, employment.wageBasis, employment.currency), store: employment.storeName })}</Txt>
        </Card>
      ) : null}
      {selected && prefs.data ? (
        <Card style={{ gap: 12, marginBottom: 14 }}>
          <Row>
            <IconBubble icon="calendar-outline" tone="primary" />
            <View style={{ flex: 1 }}>
              <Txt variant="subheading">{t('week.title')}</Txt>
              <Txt variant="small" muted>{hasPrefs ? t('week.hint') : t('week.setup')}</Txt>
            </View>
          </Row>
          {hasPrefs ? (
            <Row gap={8}>
              <Button title={t('week.button')} icon="flash-outline" style={{ flex: 1 }} loading={busy === 'week'} onPress={askWeek} />
              <Button small variant="ghost" title={t('week.edit')} onPress={() => router.push('/preferences')} />
            </Row>
          ) : (
            <Button title={t('week.setupButton')} icon="options-outline" variant="secondary" full onPress={() => router.push('/preferences')} />
          )}
        </Card>
      ) : null}
      {employments.isLoading || lists.some((l) => l.isLoading) ? <Loading /> : open.length === 0 ? (
        <Empty icon="sparkles-outline" title={t('find.none')} message={t('find.noneMsg')} />
      ) : days.map((d) => (
        <View key={d} style={{ marginBottom: 18, gap: 10 }}>
          <Txt variant="heading">{relativeDay(d)}</Txt>
          {open.filter((s) => s.localDate === d).map((s) => {
            const status = asked.get(s.id);
            const full = s.openSlots <= 0;
            return (
              <Card key={s.id} style={{ gap: 12 }} onPress={() => router.push(`/shift/${s.id}`)}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View>
                    <Txt variant="heading">{timeRange(s.startsAt, s.endsAt, s.timezone)}</Txt>
                    <Txt variant="small" muted>{hoursBetween(s.startsAt, s.endsAt)}</Txt>
                  </View>
                  {full ? <Badge label={t('find.full')} tone="neutral" /> : s.belowMinimum ? <Badge label={t('find.needsPeople')} tone="danger" icon="flame-outline" />
                    : <Badge label={t('find.spots', { n: s.openSlots })} tone="success" />}
                </Row>
                <StaffingBar assigned={s.assignedCount} min={s.minStaff} optimal={s.optimalStaff} max={s.maxStaff} />
                {status ? (
                  <Badge label={status === 'waitlisted' ? t('shift.onWaitlistBadge') : t('find.requested')} tone="warning" icon="hourglass-outline" />
                ) : signupState(s) === 'closed' ? (
                  <Badge label={t('find.closed')} tone="neutral" icon="lock-closed-outline" />
                ) : signupState(s) === 'notYet' ? (
                  <Badge label={t('find.opensAt', { when: dateTime(s.registrationOpensAt, s.timezone) })} tone="info" icon="time-outline" />
                ) : (
                  <Button title={full ? t('find.joinWaitlist') : t('shift.want')} icon="hand-right-outline" variant={full ? 'secondary' : 'primary'}
                    loading={busy === s.id} onPress={() => ask(s)} />
                )}
              </Card>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}
