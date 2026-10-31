import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import type { StoreWeek as Week } from '@/api/types';

import { StorePicker } from '@/components/domain';
import { Badge, Card, Empty, ErrorState, IconButton, Loading, Row, Screen, Segmented, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useOrgKey, useTemplateNames } from '@/state/queries';
import { useApi } from '@/state/session';
import { useMyEmployments } from '@/state/staff';
import { useTheme } from '@/theme';
import { addDays, dayLabel, dayOfMonth, relativeDay, startOfWeek, time, timeRange, today, weekdayShort } from '@/utils/format';

/** "Lịch tuần": a store's week for its staff, every shift and who works it, so people see who they work with. */
export default function StoreWeek() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { colors, radius } = useTheme();
  const employments = useMyEmployments();
  const stores = (employments.data ?? []).map((e) => ({ id: e.storeId, name: e.storeName }));
  const [storeId, setStoreId] = useState<string | null>(null);
  const selected = storeId ?? stores[0]?.id ?? null;
  const [weekStart, setWeekStart] = useState(startOfWeek(today()));
  const [view, setView] = useState<'table' | 'list'>('table');
  const names = useTemplateNames(selected);
  const week = useQuery({
    queryKey: ['storeWeek', org, selected, weekStart],
    queryFn: () => api.storeWeek(selected!, weekStart),
    enabled: !!selected,
  });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const shifts = week.data?.shifts ?? [];

  return (
    <Screen onRefresh={week.refetch} refreshing={week.isRefetching}>
      <StorePicker stores={stores} value={selected} onChange={setStoreId} />
      <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <IconButton icon="chevron-back" label={t('storeWeek.prevWeek')} onPress={() => setWeekStart(addDays(weekStart, -7))} />
        <Txt variant="subheading">{dayLabel(weekStart)} – {dayLabel(addDays(weekStart, 6))}</Txt>
        <IconButton icon="chevron-forward" label={t('storeWeek.nextWeek')} onPress={() => setWeekStart(addDays(weekStart, 7))} />
      </Row>
      <View style={{ marginBottom: 14 }}>
        <Segmented value={view} onChange={setView} options={[
          { value: 'table', label: t('storeWeek.table') }, { value: 'list', label: t('storeWeek.list') },
        ]} />
      </View>
      {employments.isLoading || week.isLoading ? <Loading /> : week.error ? <ErrorState error={week.error} onRetry={week.refetch} />
        : shifts.length === 0 ? <Empty icon="calendar-outline" title={t('storeWeek.empty')} message={t('storeWeek.emptyMsg')} />
          : view === 'table' ? <WeekTable days={days} shifts={shifts} names={names} />
          : days.map((d) => {
            const list = shifts.filter((x) => x.shift.localDate === d);
            const isToday = d === today();
            return (
              <View key={d} style={{ marginBottom: 16, gap: 8 }}>
                <Txt variant="subheading" color={isToday ? colors.primary : colors.text}>{relativeDay(d)}</Txt>
                {list.length === 0 ? <Txt variant="small" muted>{t('storeWeek.noShifts')}</Txt> : list.map(({ shift: s, people }) => {
                  const mine = people.some((p) => p.mine);
                  const upcoming = s.status === 'published' && Date.parse(s.startsAt) > Date.now();
                  return (
                    <Card key={s.id} onPress={() => router.push(`/shift/${s.id}`)}
                      style={{ gap: 10, borderColor: mine ? colors.primary : colors.border, borderWidth: mine ? 2 : 1 }}>
                      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Txt variant="subheading">{timeRange(s.startsAt, s.endsAt, s.timezone)}</Txt>
                          {s.templateId && names[s.templateId] ? <Txt variant="small" muted>{names[s.templateId]}</Txt> : null}
                        </View>
                        {mine ? <Badge label={t('storeWeek.yourShift')} tone="primary" icon="person" />
                          : upcoming ? <Badge label={s.openSlots > 0 ? t('storeWeek.spots', { n: s.openSlots }) : t('storeWeek.full')}
                            tone={s.openSlots > 0 ? 'success' : 'neutral'} /> : null}
                      </Row>
                      <Row gap={6} wrap>
                        {people.length === 0 ? <Txt variant="small" muted>{t('storeWeek.nobody')}</Txt> : people.map((p, i) => (
                          <View key={i} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.md,
                            backgroundColor: p.mine ? colors.primary : colors.background }}>
                            <Txt variant="small" color={p.mine ? colors.textInverse : colors.text}>
                              {p.mine ? t('storeWeek.you') : p.displayName}
                            </Txt>
                          </View>
                        ))}
                      </Row>
                    </Card>
                  );
                })}
              </View>
            );
          })}
    </Screen>
  );
}

const LABEL_W = 96;
const DAY_W = 92;
const PILL_H = 24;

/**
 * The same week as a grid, like the paper/Excel schedule many stores use: one row per shift (template, or start–end
 * time when there is none), one column per day, the names of who works it in each cell. Days scroll sideways.
 */
function WeekTable({ days, shifts, names }: { days: string[]; shifts: Week['shifts']; names: Record<string, string> }) {
  const { t } = useI18n();
  const { colors, radius } = useTheme();
  const rows = new Map<string, { label: string; hours: string; start: string; cells: Record<string, Week['shifts']> }>();
  for (const x of shifts) {
    const s = x.shift;
    const hours = timeRange(s.startsAt, s.endsAt, s.timezone);
    const key = s.templateId ?? hours;
    const row = rows.get(key) ?? { label: (s.templateId && names[s.templateId]) || '', hours, start: time(s.startsAt, s.timezone), cells: {} };
    (row.cells[s.localDate] ??= []).push(x);
    rows.set(key, row);
  }
  const sorted = [...rows.values()].sort((a, b) => a.start.localeCompare(b.start));
  const line = { borderColor: colors.border, borderBottomWidth: 1 };
  const heightOf = (r: (typeof sorted)[number]) =>
    14 + Math.max(1, ...days.map((d) => (r.cells[d] ?? []).reduce((n, x) => n + Math.max(1, x.people.length), 0))) * (PILL_H + 4);
  const header = 48;

  return (
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
      backgroundColor: colors.surface, overflow: 'hidden', marginBottom: 24 }}>
      {/* shift names stay put */}
      <View style={{ width: LABEL_W, borderRightWidth: 1, borderColor: colors.border }}>
        <View style={[{ height: header, justifyContent: 'center', paddingHorizontal: 10 }, line]}>
          <Txt variant="tiny" color={colors.textMuted}>{t('storeWeek.shift').toUpperCase()}</Txt>
        </View>
        {sorted.map((r, i) => (
          <View key={i} style={[{ height: heightOf(r), padding: 8, gap: 2 }, i < sorted.length - 1 && line]}>
            {r.label ? <Txt variant="small" style={{ fontWeight: '700' }} numberOfLines={2}>{r.label}</Txt> : null}
            <Txt variant="small" muted>{r.hours}</Txt>
          </View>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[{ flexDirection: 'row', height: header }, line]}>
            {days.map((d) => {
              const isToday = d === today();
              return (
                <View key={d} style={{ width: DAY_W, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isToday ? colors.primary : undefined }}>
                  <Txt variant="tiny" color={isToday ? colors.textInverse : colors.textMuted}>{weekdayShort(d).toUpperCase()}</Txt>
                  <Txt variant="small" style={{ fontWeight: '700' }} color={isToday ? colors.textInverse : colors.text}>
                    {dayOfMonth(d)}/{Number(d.slice(5, 7))}
                  </Txt>
                </View>
              );
            })}
          </View>
          {sorted.map((r, i) => (
            <View key={i} style={[{ flexDirection: 'row', height: heightOf(r) }, i < sorted.length - 1 && line]}>
              {days.map((d) => {
                const here = r.cells[d] ?? [];
                return (
                  <View key={d} style={{ width: DAY_W, padding: 5, gap: 4, borderLeftWidth: 1, borderColor: colors.border }}>
                    {here.map(({ shift: s, people }) => (
                      <Pressable key={s.id} onPress={() => router.push(`/shift/${s.id}`)} style={{ gap: 4 }}>
                        {people.length === 0 ? (
                          <Txt variant="small" muted center style={{ lineHeight: PILL_H }}>–</Txt>
                        ) : people.map((p, k) => (
                          <View key={k} style={{ height: PILL_H, borderRadius: radius.sm, paddingHorizontal: 6, justifyContent: 'center',
                            backgroundColor: p.mine ? colors.primary : colors.background }}>
                            <Txt variant="small" numberOfLines={1} color={p.mine ? colors.textInverse : colors.text}>
                              {p.mine ? t('storeWeek.you') : p.displayName}
                            </Txt>
                          </View>
                        ))}
                      </Pressable>
                    ))}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
