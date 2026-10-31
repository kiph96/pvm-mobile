import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';

import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';
import { addDays, localDateOf, today } from '@/utils/format';
import { Chip, IconButton, Row, Txt } from './ui';

export type Range = { from: string; to: string; label: string; periodId?: string };

const monthRange = (y: number, m: number, label: string): Range => {
  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { from, to: addDays(next, -1), label };
};

/** A calendar month (this one first) or one of the last payroll periods, for the owner's monthly reports. */
export function usePeriodRange() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const [y0, m0] = today().split('-').map(Number);
  const [ym, setYm] = useState({ y: y0, m: m0 });
  const [period, setPeriod] = useState<Range | null>(null);
  const periods = useQuery({ queryKey: ['periods', org], queryFn: api.payrollPeriods });
  const range = period ?? monthRange(ym.y, ym.m, t('summary.month', { m: ym.m, y: ym.y }));
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
  return { range, period, setPeriod, moveMonth, recent };
}

/** Month arrows, plus the recent payroll periods as chips (tap again to go back to the month). */
export function PeriodPicker({ p }: { p: ReturnType<typeof usePeriodRange> }) {
  const { t } = useI18n();
  return (
    <>
      <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <IconButton icon="chevron-back" label={t('summary.prevMonth')} onPress={() => p.moveMonth(-1)} />
        <Txt variant="subheading">{p.range.label}</Txt>
        <IconButton icon="chevron-forward" label={t('summary.nextMonth')} onPress={() => p.moveMonth(1)} />
      </Row>
      {p.recent.length ? (
        <Row gap={8} wrap style={{ marginBottom: 14 }}>
          <Txt variant="small" muted>{t('summary.periods')}</Txt>
          {p.recent.map((r) => <Chip key={r.periodId} label={r.label} selected={p.period?.periodId === r.periodId}
            onPress={() => p.setPeriod(p.period?.periodId === r.periodId ? null : r)} />)}
        </Row>
      ) : null}
    </>
  );
}
