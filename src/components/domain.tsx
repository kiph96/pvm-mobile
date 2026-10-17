// Components that know about PVM concepts (shifts, stores, statuses).
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import { ScrollView, View } from 'react-native';

import type { AssignmentView, ShiftView, StoreView } from '@/api/types';
import { tv, useI18n } from '@/i18n';
import { useApi, useSession } from '@/state/session';
import { useTheme } from '@/theme';
import { hoursBetween, localDateOf, money, relativeDay, timeRange } from '@/utils/format';
import { wageText } from '@/utils/pay';
import { Badge, Card, Chip, Row, StaffingBar, Txt, type Tone } from './ui';

export const SHIFT_TONE: Record<string, Tone> = { draft: 'neutral', published: 'primary', cancelled: 'danger', closed: 'info' };
export const STATUS_TONE: Record<string, Tone> = {
  pending: 'warning', waitlisted: 'info', approved: 'success', rejected: 'danger', cancelled: 'neutral',
  requested: 'warning', accepted: 'info', expired: 'neutral', reported: 'warning', confirmed: 'danger',
  dismissed: 'neutral', reversed: 'info', assigned: 'primary', completed: 'success', no_show: 'danger',
  open: 'warning', closed: 'neutral', finalized: 'success', active: 'success', ended: 'neutral',
};

export function StatusBadge({ status }: { status: string }) {
  useI18n();
  return <Badge label={tv('status', status)} tone={STATUS_TONE[status] ?? 'neutral'} />;
}

export function ShiftCard({ shift, title, onPress, showDate = true }: {
  shift: ShiftView; title?: string; onPress?: () => void; showDate?: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const health: { label: string; tone: Tone } | null = shift.status === 'cancelled' ? null
    : shift.belowMinimum ? { label: t('shiftCard.understaffed'), tone: 'danger' }
      : shift.assignedCount < shift.optimalStaff ? { label: t('shiftCard.moreIdeal', { n: shift.optimalStaff - shift.assignedCount }), tone: 'warning' }
        : { label: t('shiftCard.full'), tone: 'success' };
  return (
    <Card onPress={onPress} style={{ gap: 12, opacity: shift.status === 'cancelled' ? 0.6 : 1 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Txt variant="subheading">{title ?? timeRange(shift.startsAt, shift.endsAt, shift.timezone)}</Txt>
          <Txt variant="small" muted>
            {showDate ? `${relativeDay(shift.localDate, shift.timezone)} · ` : ''}
            {title ? `${timeRange(shift.startsAt, shift.endsAt, shift.timezone)} · ` : ''}{hoursBetween(shift.startsAt, shift.endsAt)}
          </Txt>
        </View>
        <Row gap={6}>
          {shift.status !== 'published' ? <Badge label={tv('status', shift.status)} tone={SHIFT_TONE[shift.status]} /> : null}
          {health ? <Badge label={health.label} tone={health.tone} /> : null}
        </Row>
      </Row>
      {shift.status !== 'cancelled' ? (
        <StaffingBar assigned={shift.assignedCount} min={shift.minStaff} optimal={shift.optimalStaff} max={shift.maxStaff} />
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ position: 'absolute', right: 12, bottom: 14 }} /> : null}
    </Card>
  );
}

export function AssignmentCard({ a, storeName, tz, onPress, footer }: {
  a: AssignmentView; storeName?: string; tz?: string; onPress?: () => void; footer?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const date = relativeDay(localDateOf(a.startsAt, tz), tz);
  const live = Date.parse(a.startsAt) <= Date.now() && Date.now() < Date.parse(a.endsAt);
  return (
    <Card onPress={onPress} style={{ gap: 10, borderLeftWidth: 4, borderLeftColor: live ? colors.accent : a.state === 'completed' ? colors.info : colors.primary }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Txt variant="small" muted>{date}{storeName ? ` · ${storeName}` : ''}</Txt>
          <Txt variant="heading">{timeRange(a.startsAt, a.endsAt, tz)}</Txt>
        </View>
        {live ? <Badge label={t('common.now')} tone="accent" icon="radio-button-on" /> : <StatusBadge status={a.state} />}
      </Row>
      <Row gap={16}>
        <Row gap={4}><Ionicons name="time-outline" size={14} color={colors.textMuted} /><Txt variant="small" muted>{hoursBetween(a.startsAt, a.endsAt)}</Txt></Row>
        {a.wageAmount != null ? (
          <Row gap={4}>
            <Ionicons name="wallet-outline" size={14} color={colors.textMuted} />
            <Txt variant="small" muted>
              {a.wageBasis === 'hourly'
                ? `${wageText(a.wageAmount, 'hourly', a.currency)} · ${t('pay.estimate', { amount: money(Math.round(a.wageAmount * (Date.parse(a.endsAt) - Date.parse(a.startsAt)) / 3_600_000), a.currency) })}`
                : money(a.wageAmount, a.currency)}
            </Txt>
          </Row>
        ) : null}
      </Row>
      {footer}
    </Card>
  );
}

/** Horizontal store selector; the parent owns the selected id. */
export function StorePicker({ stores, value, onChange }: { stores: { id: string; name: string }[]; value: string | null; onChange: (id: string) => void }) {
  if (stores.length <= 1) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }} style={{ marginBottom: 12 }}>
      {stores.map((s) => <Chip key={s.id} label={shortStore(s.name)} icon="storefront-outline" selected={s.id === value} onPress={() => onChange(s.id)} />)}
    </ScrollView>
  );
}

export function shortStore(name: string) {
  const i = name.indexOf(' - ');
  return i > 0 ? name.slice(i + 3) : name;
}

/** Translated label for a policy code such as LATE or PERFECT_SHIFT. */
export function codeLabel(code: string) {
  return tv('code', code);
}

/** Stores of the current business plus a selected-store state that defaults to the first. */
export function useStores() {
  const api = useApi();
  const { session } = useSession();
  const query = useQuery({ queryKey: ['stores', session?.workspace?.id], queryFn: api.stores, enabled: !!session?.workspace });
  const [storeId, setStoreId] = React.useState<string | null>(null);
  const stores: StoreView[] = query.data ?? [];
  useEffect(() => {
    if (stores.length && !stores.some((s) => s.id === storeId)) setStoreId(stores[0].id);
  }, [stores, storeId]);
  const store = stores.find((s) => s.id === storeId) ?? null;
  return { ...query, stores, store, storeId: store?.id ?? null, setStoreId };
}
