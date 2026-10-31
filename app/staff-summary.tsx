import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import type { StaffSummary as Summary } from '@/api/types';
import { Ionicons } from '@expo/vector-icons';

import { Badge, Card, Chip, Empty, ErrorState, IconButton, Loading, Row, Screen, Segmented, Sheet, Stat, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';
import { useTheme } from '@/theme';
import { addDays, localDateOf, money, today } from '@/utils/format';

type Range = { from: string; to: string; label: string; periodId?: string };

const monthRange = (y: number, m: number, label: string): Range => {
  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { from, to: addDays(next, -1), label };
};

/**
 * "Tổng hợp nhân sự": the owner's monthly sheet in the app. One row per person: shifts, evening shifts, shifts at each
 * store (their home store and the branches they helped), bonus, wages and total; a month or a payroll period.
 */
export default function StaffSummary() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const [y0, m0] = today().split('-').map(Number);
  const [ym, setYm] = useState({ y: y0, m: m0 });
  const [period, setPeriod] = useState<Range | null>(null);
  // phones start with the short list (tap a row for the rest); wide screens with the full table
  const { width } = useWindowDimensions();
  const [view, setView] = useState<'compact' | 'table'>(width < 700 ? 'compact' : 'table');
  const periods = useQuery({ queryKey: ['periods', org], queryFn: api.payrollPeriods });
  const range = period ?? monthRange(ym.y, ym.m, t('summary.month', { m: ym.m, y: ym.y }));
  const summary = useQuery({
    queryKey: ['staffSummary', org, range.from, range.to],
    queryFn: () => api.staffSummary(range.from, range.to),
  });
  const moveMonth = (n: number) => {
    setPeriod(null);
    setYm(({ y, m }) => {
      const k = y * 12 + (m - 1) + n;
      return { y: Math.floor(k / 12), m: (k % 12) + 1 };
    });
  };
  const recent = (periods.data ?? []).slice(-4).reverse().map((p): Range => ({
    periodId: p.id, label: p.label, from: localDateOf(p.startsAt), to: addDays(localDateOf(p.endsAt), -1),
  }));

  return (
    <Screen onRefresh={summary.refetch} refreshing={summary.isRefetching}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <IconButton icon="chevron-back" label={t('storeWeek.prevWeek')} onPress={() => moveMonth(-1)} />
        <Txt variant="subheading">{range.label}</Txt>
        <IconButton icon="chevron-forward" label={t('storeWeek.nextWeek')} onPress={() => moveMonth(1)} />
      </Row>
      {recent.length ? (
        <Row gap={8} wrap style={{ marginBottom: 14 }}>
          <Txt variant="small" muted>{t('summary.periods')}</Txt>
          {recent.map((p) => <Chip key={p.periodId} label={p.label} selected={period?.periodId === p.periodId}
            onPress={() => setPeriod(period?.periodId === p.periodId ? null : p)} />)}
        </Row>
      ) : null}
      <View style={{ marginBottom: 14 }}>
        <Segmented value={view} onChange={setView} options={[
          { value: 'compact', label: t('summary.compact') }, { value: 'table', label: t('summary.fullTable') },
        ]} />
      </View>
      {summary.isLoading ? <Loading /> : summary.error ? <ErrorState error={summary.error} onRetry={summary.refetch} />
        : !summary.data?.people.length ? <Empty icon="people-outline" title={t('summary.empty')} message={t('summary.emptyMsg')} />
          : (
            <>
              <Overview data={summary.data} />
              {view === 'compact' ? <CompactTable data={summary.data} /> : <SummaryTable data={summary.data} />}
            </>
          )}
      <Txt variant="small" muted style={{ marginTop: 12, marginBottom: 24 }}>{t('summary.note')}</Txt>
    </Screen>
  );
}

type Person = Summary['people'][number];
const helpedShifts = (p: Person) => p.byStore.filter((b) => b.storeId !== p.homeStoreId).reduce((n, b) => n + b.shifts, 0);

/** What the period costs at a glance. */
function Overview({ data }: { data: Summary }) {
  const { t } = useI18n();
  const cur = data.currency;
  const supportShifts = data.people.reduce((n, p) => n + helpedShifts(p), 0);
  return (
    <View style={{ gap: 10, marginBottom: 14 }}>
      <Card style={{ gap: 4 }}>
        <Txt variant="small" muted>{t('summary.toPay')}</Txt>
        <Txt variant="title">{money(data.totals.total, cur)}</Txt>
        <Txt variant="small" muted>
          {t('summary.wagesBonus', { wages: money(data.totals.wages, cur), bonus: money(data.totals.bonus, cur) })}
        </Txt>
      </Card>
      <Row gap={10}>
        <View style={{ flex: 1 }}><Stat label={t('summary.shifts')} value={String(data.totals.shifts)} icon="calendar-outline" /></View>
        <View style={{ flex: 1 }}><Stat label={t('summary.evening')} value={String(data.totals.eveningShifts)} icon="moon-outline" tone="info" /></View>
        <View style={{ flex: 1 }}><Stat label={t('summary.supportShifts')} value={String(supportShifts)} icon="swap-horizontal-outline" tone="accent" /></View>
      </Row>
    </View>
  );
}

/**
 * The phone view: name, shifts, bonus and total pay, nothing to scroll sideways. Tapping a row shows everything else
 * about that person (evening shifts, shifts per store, the branches they helped, wages).
 */
function CompactTable({ data }: { data: Summary }) {
  const { t } = useI18n();
  const { colors, radius } = useTheme();
  const [open, setOpen] = useState<Person | null>(null);
  const cur = data.currency;
  // the unit is said once under the table, so the numbers fit a phone
  const unit = money(0, cur).replace(/^[\d.,\s]+/, '').replace(/^\$0\.00$/, '$') || cur;
  const amt = (v: number) => money(v, cur).replace(/\s*₫$/, '').replace(new RegExp(`\\s*${cur}$`), '');
  const line = { borderBottomWidth: 1, borderColor: colors.border };
  const num = { width: 40, alignItems: 'flex-end' as const };
  const amount = { width: 72, alignItems: 'flex-end' as const };
  const total = { width: 86, alignItems: 'flex-end' as const };
  const row = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 10, minHeight: 48 };
  const bold = { fontWeight: '700' as const };

  return (
    <View style={{ gap: 8 }}>
      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden' }}>
        <View style={[row, line, { minHeight: 36 }]}>
          <Txt variant="tiny" color={colors.textMuted} style={{ flex: 1 }} numberOfLines={1}>{t('summary.name').toUpperCase()}</Txt>
          <View style={num}><Txt variant="tiny" color={colors.textMuted}>{t('summary.shiftsShort').toUpperCase()}</Txt></View>
          <View style={amount}><Txt variant="tiny" color={colors.textMuted}>{t('summary.bonus').toUpperCase()}</Txt></View>
          <View style={total}><Txt variant="tiny" color={colors.textMuted}>{t('summary.total').toUpperCase()}</Txt></View>
        </View>
        {data.people.map((p) => {
          const helped = helpedShifts(p) > 0;
          return (
            <Pressable key={p.membershipId} onPress={() => setOpen(p)} accessibilityRole="button" accessibilityLabel={p.displayName}
              style={({ pressed }) => [row, line, pressed && { backgroundColor: colors.surfaceAlt }]}>
              <Txt variant="small" style={[bold, { flex: 1 }]} numberOfLines={1}>{p.displayName}</Txt>
              <View style={[num, { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }]}>
                {helped ? <Ionicons name="swap-horizontal" size={12} color={colors.accent} /> : null}
                <Txt variant="small" color={helped ? colors.accent : undefined}>{p.shifts}</Txt>
              </View>
              <View style={amount}><Txt variant="small" muted={!p.bonus}>{p.bonus ? amt(p.bonus) : '–'}</Txt></View>
              <View style={total}><Txt variant="small" style={bold}>{amt(p.total)}</Txt></View>
            </Pressable>
          );
        })}
        <View style={[row, { backgroundColor: colors.surfaceAlt }]}>
          <Txt variant="small" style={[bold, { flex: 1 }]} numberOfLines={1}>{t('summary.all')}</Txt>
          <View style={num}><Txt variant="small" style={bold}>{data.totals.shifts}</Txt></View>
          <View style={amount}><Txt variant="small" style={bold}>{amt(data.totals.bonus)}</Txt></View>
          <View style={total}><Txt variant="small" style={bold}>{amt(data.totals.total)}</Txt></View>
        </View>
      </View>
      <Txt variant="small" muted>{t('summary.tapHint', { unit })}</Txt>
      <PersonSheet person={open} data={data} onClose={() => setOpen(null)} />
    </View>
  );
}

/** Everything about one person in the period. */
function PersonSheet({ person: p, data, onClose }: { person: Person | null; data: Summary; onClose: () => void }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const cur = data.currency;
  const storeName = (id: string | null) => data.stores.find((s) => s.id === id)?.name ?? '';
  const line = (label: string, value: React.ReactNode, strong = false) => (
    <Row key={label} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
      <Txt muted={!strong} style={strong ? { fontWeight: '700' } : undefined}>{label}</Txt>
      {typeof value === 'string' || typeof value === 'number'
        ? <Txt style={strong ? { fontWeight: '700' } : undefined}>{value}</Txt> : value}
    </Row>
  );
  return (
    <Sheet visible={!!p} onClose={onClose} title={p?.displayName ?? ''}>
      {p ? (
        <View style={{ gap: 14 }}>
          <Txt variant="small" muted>{t('summary.homeOf', { store: storeName(p.homeStoreId) })}</Txt>
          <Card style={{ gap: 2 }}>
            {line(t('summary.shifts'), p.shifts)}
            {line(t('summary.evening'), p.eveningShifts)}
            {p.noShows ? line(t('summary.absent'), <Txt color={colors.danger}>{p.noShows}</Txt>) : null}
          </Card>
          <Card style={{ gap: 2 }}>
            {data.stores.map((s) => {
              const n = p.byStore.find((b) => b.storeId === s.id)?.shifts ?? 0;
              if (!n && s.id !== p.homeStoreId) return null;
              const home = s.id === p.homeStoreId;
              return line(s.name, (
                <Row gap={6}>
                  {home ? <Badge tone="primary" label={t('branches.home')} />
                    : <Badge tone="accent" icon="swap-horizontal-outline" label={t('summary.support')} />}
                  <Txt style={{ fontWeight: '700', minWidth: 24, textAlign: 'right' }}>{n}</Txt>
                </Row>
              ));
            })}
          </Card>
          <Card style={{ gap: 2 }}>
            {line(t('summary.wages'), money(p.wages, cur))}
            {line(t('summary.bonus'), money(p.bonus, cur))}
            {p.branchSupport ? (
              <Txt variant="small" color={colors.accent} style={{ textAlign: 'right' }}>
                {t('summary.supportOf', { amount: money(p.branchSupport, cur) })}
              </Txt>
            ) : null}
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
            {line(t('summary.total'), money(p.total, cur), true)}
          </Card>
        </View>
      ) : null}
    </Sheet>
  );
}

const NAME_W = 132;
const ROW_H = 54;
const NUM_W = 64;
const STORE_W = 84;
const MONEY_W = 112;

/** Names stay put, the numbers scroll sideways; the last row adds everyone up. */
function SummaryTable({ data }: { data: Summary }) {
  const { t } = useI18n();
  const { colors, radius } = useTheme();
  const cur = data.currency;
  const storeName = (id: string | null) => data.stores.find((s) => s.id === id)?.name ?? '';
  const line = { borderBottomWidth: 1, borderColor: colors.border };
  const cell = (w: number, right = true) => ({ width: w, height: ROW_H - 1, justifyContent: 'center' as const,
    alignItems: right ? 'flex-end' as const : 'center' as const, paddingHorizontal: 8, borderLeftWidth: 1, borderColor: colors.border });
  const head = (label: string, w: number, right = true) => (
    <View key={label} style={[cell(w, right), { height: 47 }]}>
      <Txt variant="tiny" color={colors.textMuted} numberOfLines={2} center={!right}>{label.toUpperCase()}</Txt>
    </View>
  );
  const totalRow = { backgroundColor: colors.surfaceAlt, ...line };

  return (
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
      backgroundColor: colors.surface, overflow: 'hidden' }}>
      <View style={{ width: NAME_W }}>
        <View style={[{ height: 48, justifyContent: 'center', paddingHorizontal: 10 }, line]}>
          <Txt variant="tiny" color={colors.textMuted}>{t('summary.name').toUpperCase()}</Txt>
        </View>
        {data.people.map((p) => (
          <View key={p.membershipId} style={[{ height: ROW_H, justifyContent: 'center', paddingHorizontal: 10 }, line]}>
            <Txt variant="small" style={{ fontWeight: '700' }} numberOfLines={1}>{p.displayName}</Txt>
            <Txt variant="tiny" muted numberOfLines={1}>{storeName(p.homeStoreId)}</Txt>
          </View>
        ))}
        <View style={[{ height: ROW_H, justifyContent: 'center', paddingHorizontal: 10 }, totalRow]}>
          <Txt variant="small" style={{ fontWeight: '700' }}>{t('summary.all')}</Txt>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[{ flexDirection: 'row' }, line]}>
            {head(t('summary.shifts'), NUM_W)}
            {head(t('summary.evening'), NUM_W)}
            {data.stores.map((s) => head(s.name, STORE_W, false))}
            {head(t('summary.bonus'), MONEY_W)}
            {head(t('summary.wages'), MONEY_W)}
            {head(t('summary.total'), MONEY_W)}
          </View>
          {data.people.map((p) => (
            <View key={p.membershipId} style={[{ flexDirection: 'row' }, line]}>
              <View style={cell(NUM_W)}>
                <Txt variant="small" style={{ fontWeight: '700' }}>{p.shifts}</Txt>
                {p.noShows ? <Txt variant="tiny" color={colors.danger}>{t('summary.noShows', { n: p.noShows })}</Txt> : null}
              </View>
              <View style={cell(NUM_W)}><Txt variant="small">{p.eveningShifts}</Txt></View>
              {data.stores.map((s) => {
                const n = p.byStore.find((b) => b.storeId === s.id)?.shifts ?? 0;
                const home = s.id === p.homeStoreId;
                const helped = !home && n > 0;
                return (
                  <View key={s.id} style={cell(STORE_W, false)}>
                    <View style={{ minWidth: 34, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, alignItems: 'center',
                      backgroundColor: helped ? colors.primary : 'transparent' }}>
                      <Txt variant="small" style={{ fontWeight: home || helped ? '700' : '400' }}
                        color={helped ? colors.textInverse : n ? colors.text : colors.textMuted}>{n}</Txt>
                    </View>
                  </View>
                );
              })}
              <View style={cell(MONEY_W)}>
                <Txt variant="small">{money(p.bonus, cur)}</Txt>
                {p.branchSupport ? <Txt variant="tiny" color={colors.primary} numberOfLines={1}>+{money(p.branchSupport, cur)}</Txt> : null}
              </View>
              <View style={cell(MONEY_W)}><Txt variant="small">{money(p.wages, cur)}</Txt></View>
              <View style={cell(MONEY_W)}><Txt variant="small" style={{ fontWeight: '700' }}>{money(p.total, cur)}</Txt></View>
            </View>
          ))}
          <View style={[{ flexDirection: 'row' }, totalRow]}>
            <View style={cell(NUM_W)}><Txt variant="small" style={{ fontWeight: '700' }}>{data.totals.shifts}</Txt></View>
            <View style={cell(NUM_W)}><Txt variant="small" style={{ fontWeight: '700' }}>{data.totals.eveningShifts}</Txt></View>
            {data.stores.map((s) => (
              <View key={s.id} style={cell(STORE_W, false)}>
                <Txt variant="small" style={{ fontWeight: '700' }}>
                  {data.people.reduce((n, p) => n + (p.byStore.find((b) => b.storeId === s.id)?.shifts ?? 0), 0)}
                </Txt>
              </View>
            ))}
            <View style={cell(MONEY_W)}><Txt variant="small" style={{ fontWeight: '700' }}>{money(data.totals.bonus, cur)}</Txt></View>
            <View style={cell(MONEY_W)}><Txt variant="small" style={{ fontWeight: '700' }}>{money(data.totals.wages, cur)}</Txt></View>
            <View style={cell(MONEY_W)}><Txt variant="small" style={{ fontWeight: '700' }}>{money(data.totals.total, cur)}</Txt></View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
