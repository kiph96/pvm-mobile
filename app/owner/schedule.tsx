import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ShiftCard, StorePicker, useStores } from '@/components/domain';
import { useAction } from '@/components/toast';
import { Button, Card, Empty, ErrorState, Field, IconButton, Loading, Row, Screen, Sheet, Stepper, Toggle, Txt, tap } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useOrgKey, useTemplateNames } from '@/state/queries';
import { useApi } from '@/state/session';
import { useTheme } from '@/theme';
import { addDays, dayLabel, dayOfMonth, startOfWeek, today, weekdayShort } from '@/utils/format';

export default function OwnerSchedule() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { colors, radius } = useTheme();
  const [run, busy] = useAction();
  const { stores, storeId, setStoreId } = useStores();
  // ?date=yyyy-MM-dd (e.g. from the evening digest notification) opens that day
  const { date } = useLocalSearchParams<{ date?: string }>();
  const [weekStart, setWeekStart] = useState(startOfWeek(date ?? today()));
  const [day, setDay] = useState(date ?? today());
  useEffect(() => {
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setWeekStart(startOfWeek(date));
      setDay(date);
    }
  }, [date]);
  const [fillOpen, setFillOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const weekEnd = addDays(weekStart, 6);
  const names = useTemplateNames(storeId);

  const shifts = useQuery({
    queryKey: ['shifts', org, storeId, weekStart, weekEnd],
    queryFn: () => api.shifts(storeId!, weekStart, weekEnd),
    enabled: !!storeId,
  });
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const byDay = (d: string) => (shifts.data ?? []).filter((s) => s.localDate === d);
  const drafts = (shifts.data ?? []).filter((s) => s.status === 'draft');
  const moveWeek = (n: number) => {
    const ws = addDays(weekStart, n * 7);
    setWeekStart(ws);
    setDay(ws <= today() && today() <= addDays(ws, 6) ? today() : ws);
  };

  const publishAll = () => run('publish', async () => {
    for (const s of drafts) await api.publishShift(s.id);
  }, t('schedule.published', { n: drafts.length }));

  return (
    <Screen title={t('schedule.title')} subtitle={`${dayLabel(weekStart)} – ${dayLabel(weekEnd)}`}
      right={<Row gap={8}>
        <IconButton icon="chevron-back" label={t('schedule.prevWeek')} onPress={() => moveWeek(-1)} />
        <IconButton icon="chevron-forward" label={t('schedule.nextWeek')} onPress={() => moveWeek(1)} />
      </Row>}
      onRefresh={shifts.refetch} refreshing={shifts.isRefetching}>
      <StorePicker stores={stores} value={storeId} onChange={setStoreId} />

      <Row gap={6} style={{ marginBottom: 16 }}>
        {days.map((d) => {
          const list = byDay(d).filter((s) => s.status !== 'cancelled');
          const short = list.some((s) => s.belowMinimum && s.status !== 'closed');
          const selected = d === day;
          return (
            <Pressable key={d} onPress={() => { tap(); setDay(d); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md,
              backgroundColor: selected ? colors.primary : colors.surface, borderWidth: 1, borderColor: selected ? colors.primary : d === today() ? colors.accent : colors.border }}>
              <Txt variant="tiny" color={selected ? colors.textInverse : colors.textMuted}>{weekdayShort(d).toUpperCase()}</Txt>
              <Txt variant="subheading" color={selected ? colors.textInverse : colors.text}>{dayOfMonth(d)}</Txt>
              <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 4,
                backgroundColor: list.length === 0 ? 'transparent' : short ? colors.danger : selected ? colors.textInverse : colors.primary }} />
            </Pressable>
          );
        })}
      </Row>

      {drafts.length > 0 ? (
        <Card tone="warning" style={{ marginBottom: 12, gap: 10 }}>
          <Txt>{t('schedule.draftsHidden', { n: drafts.length })}</Txt>
          <Button small title={t('schedule.publishWeek')} icon="megaphone-outline" variant="accent" onPress={publishAll} loading={busy === 'publish'} />
        </Card>
      ) : null}

      <Row gap={8} style={{ marginBottom: 14 }}>
        <Button small title={t('schedule.fill')} icon="color-wand-outline" variant="secondary" style={{ flex: 1 }} onPress={() => setFillOpen(true)} />
        <Button small title={t('schedule.addShift')} icon="add" variant="secondary" style={{ flex: 1 }} onPress={() => setAddOpen(true)} />
      </Row>

      <Txt variant="heading" style={{ marginBottom: 10 }}>{dayLabel(day)}</Txt>
      <View style={{ gap: 10 }}>
        {shifts.isLoading ? <Loading /> : shifts.error ? <ErrorState error={shifts.error} onRetry={shifts.refetch} />
          : byDay(day).length === 0 ? (
            <Empty icon="calendar-clear-outline" title={t('schedule.noShifts')} message={t('schedule.noShiftsMsg')}
              action={t('schedule.fill')} onAction={() => setFillOpen(true)} />
          ) : byDay(day).map((s) => (
            <ShiftCard key={s.id} shift={s} showDate={false} title={s.templateId ? names[s.templateId] : t('schedule.extraShift')}
              onPress={() => router.push(`/shift/${s.id}`)} />
          ))}
      </View>

      {storeId ? <FillSheet visible={fillOpen} onClose={() => setFillOpen(false)} storeId={storeId} from={weekStart} to={weekEnd} /> : null}
      {storeId ? <AddShiftSheet visible={addOpen} onClose={() => setAddOpen(false)} storeId={storeId} date={day} /> : null}
    </Screen>
  );
}

function FillSheet({ visible, onClose, storeId, from, to }: { visible: boolean; onClose: () => void; storeId: string; from: string; to: string }) {
  const api = useApi();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const [publish, setPublish] = useState(true);
  const go = async () => {
    const r = await run('fill', () => api.generateShifts(storeId, from, to, publish),
      (res) => res.created.length ? t('schedule.created', { n: res.created.length })
        : res.skippedPast && !res.alreadyExisting ? t('schedule.allPast') : t('schedule.alreadyFilled'));
    if (r) onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t('schedule.fillTitle')}>
      <Txt muted>{t('schedule.fillNote', { from: dayLabel(from), to: dayLabel(to) })}</Txt>
      <Toggle label={t('common.publishNow')} hint={t('common.publishNowHint')} value={publish} onChange={setPublish} />
      <Button title={t('schedule.createShifts')} icon="color-wand-outline" onPress={go} loading={busy === 'fill'} full />
      <Button title={t('schedule.manageTemplates')} variant="ghost" onPress={() => { onClose(); router.push(`/store/${storeId}`); }} />
    </Sheet>
  );
}

function AddShiftSheet({ visible, onClose, storeId, date }: { visible: boolean; onClose: () => void; storeId: string; date: string }) {
  const api = useApi();
  const { t } = useI18n();
  const { colors } = useTheme();
  const [run, busy] = useAction();
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('12:00');
  const [max, setMax] = useState(3);
  const [publish, setPublish] = useState(true);
  // multi-day shift (e.g. Fri 08:00 -> Sun 22:00): off unless the owner turns it on
  const [multiDay, setMultiDay] = useState(false);
  const [days, setDays] = useState(2);
  const timesOk = /^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end);
  const endDate = multiDay ? addDays(date, days - 1) : null;
  const span = timesOk && endDate
    ? Math.round((Date.parse(`${endDate}T${end}:00Z`) - Date.parse(`${date}T${start}:00Z`)) / 60_000) : null;
  const valid = timesOk && (span == null || span > 0);
  const close = () => { setMultiDay(false); setDays(2); onClose(); };
  const go = async () => {
    const r = await run('add', () => api.createShift({ storeId, localDate: date, localStart: start, localEnd: end,
      minStaff: 1, optimalStaff: Math.min(2, max), maxStaff: max, publish, localEndDate: endDate }), t('schedule.shiftAdded'));
    if (r) close();
  };
  return (
    <Sheet visible={visible} onClose={close} title={t('schedule.extraTitle', { date: dayLabel(date) })}>
      <Row gap={10}>
        <View style={{ flex: 1 }}><Field label={t('common.starts')} value={start} onChangeText={setStart} placeholder="08:00" /></View>
        <View style={{ flex: 1 }}>
          <Field label={multiDay ? t('schedule.endsOn', { date: dayLabel(endDate!) }) : t('common.ends')} value={end} onChangeText={setEnd} placeholder="12:00"
            hint={!multiDay && timesOk && end <= start ? t('common.endsNextDay') : undefined} />
        </View>
      </Row>
      <Toggle label={t('schedule.multiDay')} hint={t('schedule.multiDayHint')} value={multiDay} onChange={setMultiDay} />
      {multiDay ? (
        <>
          <Stepper label={t('schedule.days')} value={days} onChange={setDays} min={2} max={7} />
          {span != null ? (
            span > 0
              ? <Txt variant="small" muted>{t('schedule.multiDaySummary', { from: `${dayLabel(date)} ${start}`, to: `${dayLabel(endDate!)} ${end}`, hours: Math.round(span / 6) / 10 })}</Txt>
              : <Txt variant="small" color={colors.danger}>{t('errors.invalid_shift_span')}</Txt>
          ) : null}
        </>
      ) : null}
      <Stepper label={t('schedule.maxPeople')} value={max} onChange={setMax} min={1} max={20} />
      <Toggle label={t('common.publishNow')} value={publish} onChange={setPublish} />
      <Button title={t('schedule.addShift')} icon="add" onPress={go} loading={busy === 'add'} disabled={!valid} full />
    </Sheet>
  );
}
