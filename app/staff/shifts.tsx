import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { AssignmentView } from '@/api/types';
import { AssignmentCard, shortStore } from '@/components/domain';
import { Button, Empty, ErrorState, Loading, Row, Screen, Segmented, Sheet, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';
import { useMyEmployments, useMySchedule } from '@/state/staff';
import { addDays, localDateOf, relativeDay, timeRange, today } from '@/utils/format';

export default function MyShifts() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [swapFor, setSwapFor] = useState<AssignmentView | null>(null);
  const employments = useMyEmployments();
  const schedule = useMySchedule(30, 30);
  const storeName = (id: string) => shortStore(employments.data?.find((e) => e.storeId === id)?.storeName ?? '');
  const now = Date.now();
  const all = schedule.data ?? [];
  const upcoming = all.filter((a) => Date.parse(a.endsAt) > now && a.state === 'assigned');
  const past = all.filter((a) => Date.parse(a.endsAt) <= now || a.state !== 'assigned').reverse();
  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <Screen title={t('myShifts.title')} onRefresh={schedule.refetch} refreshing={schedule.isRefetching}>
      <Segmented value={tab} onChange={setTab} options={[
        { value: 'upcoming', label: t('myShifts.upcoming', { n: upcoming.length }) }, { value: 'past', label: t('myShifts.history') },
      ]} />
      <View style={{ gap: 10, marginTop: 14 }}>
        {schedule.isLoading ? <Loading /> : schedule.error ? <ErrorState error={schedule.error} onRetry={schedule.refetch} />
          : list.length === 0 ? (
            <Empty icon="calendar-outline" title={tab === 'upcoming' ? t('myShifts.nothing') : t('myShifts.noPast')}
              action={tab === 'upcoming' ? t('tabs.find') : undefined} onAction={() => router.push('/staff/find')} />
          ) : list.map((a) => (
            <AssignmentCard key={a.id} a={a} storeName={storeName(a.storeId)} onPress={() => router.push(`/shift/${a.shiftId}`)}
              footer={tab === 'upcoming' && Date.parse(a.startsAt) > now ? (
                <Row gap={8}>
                  <Button small title={t('myShifts.swap')} icon="swap-horizontal" variant="secondary" onPress={() => setSwapFor(a)} />
                </Row>
              ) : undefined} />
          ))}
      </View>
      <SwapPicker mine={swapFor} onClose={() => setSwapFor(null)} />
    </Screen>
  );
}

/** Step 1 of a swap: pick a colleague's shift (then "Offer swap" on the shift screen). */
function SwapPicker({ mine, onClose }: { mine: AssignmentView | null; onClose: () => void }) {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const from = today();
  const to = addDays(from, 14);
  const q = useQuery({
    queryKey: ['shifts', org, mine?.storeId, from, to],
    queryFn: () => api.shifts(mine!.storeId, from, to),
    enabled: !!mine,
  });
  const options = (q.data ?? []).filter((s) => s.id !== mine?.shiftId && s.assignedCount > 0 && Date.parse(s.startsAt) > Date.now() && s.status === 'published');
  return (
    <Sheet visible={!!mine} onClose={onClose} title={t('myShifts.swapTitle')}>
      {mine ? <Txt muted>{t('myShifts.swapIntro', { shift: `${relativeDay(localDateOf(mine.startsAt))} ${timeRange(mine.startsAt, mine.endsAt)}` })}</Txt> : null}
      {q.isLoading ? <Loading /> : options.length === 0 ? <Txt muted>{t('myShifts.noOptions')}</Txt> : options.map((s) => (
        <Button key={s.id} variant="secondary" icon="calendar-outline"
          title={t('myShifts.option', { shift: `${relativeDay(s.localDate)} · ${timeRange(s.startsAt, s.endsAt, s.timezone)}`, n: s.assignedCount })}
          onPress={() => { onClose(); router.push(`/shift/${s.id}?swapFrom=${mine!.id}`); }} />
      ))}
    </Sheet>
  );
}
