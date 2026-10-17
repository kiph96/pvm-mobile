import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { PeriodView, RunView } from '@/api/types';
import { StatusBadge } from '@/components/domain';
import { useAction } from '@/components/toast';
import { Avatar, Button, Card, Empty, Field, Loading, Row, Screen, Section, Sheet, Txt, confirm } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';
import { useTheme } from '@/theme';
import { addDays, dayLabel, localDateOf, money, today } from '@/utils/format';

export default function Payroll() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const periods = useQuery({ queryKey: ['periods', org], queryFn: api.payrollPeriods });
  return (
    <Screen onRefresh={periods.refetch} refreshing={periods.isRefetching}>
      <Card tone="success" style={{ marginTop: 12, gap: 6 }}>
        <Txt variant="subheading">{t('payroll.howTitle')}</Txt>
        <Txt variant="small">{t('payroll.how')}</Txt>
      </Card>
      <Section title={t('payroll.periods')} action={t('payroll.newPeriod')} onAction={() => setOpen(true)}>
        {periods.isLoading ? <Loading /> : (periods.data ?? []).length === 0 ? (
          <Empty icon="cash-outline" title={t('payroll.none')} action={t('payroll.createOne')} onAction={() => setOpen(true)} />
        ) : periods.data!.map((p) => <PeriodCard key={p.id} period={p} />)}
      </Section>
      <NewPeriodSheet visible={open} onClose={() => setOpen(false)} />
    </Screen>
  );
}

function PeriodCard({ period }: { period: PeriodView }) {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const runs = useQuery({ queryKey: ['runs', org, period.id], queryFn: () => api.payrollRuns(period.id) });
  return (
    <Card style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Txt variant="subheading">{period.label}</Txt>
          <Txt variant="small" muted>{dayLabel(localDateOf(period.startsAt))} → {dayLabel(addDays(localDateOf(period.endsAt), -1))}</Txt>
        </View>
        <StatusBadge status={period.status} />
      </Row>
      {(runs.data ?? []).map((r) => <RunRow key={r.id} run={r} />)}
      {period.status === 'open' ? (
        <Button title={t('payroll.run')} icon="calculator-outline" loading={busy === 'run'}
          onPress={async () => {
            if (await confirm(t('payroll.runTitle'), t('payroll.runMsg'), t('payroll.run'))) {
              run('run', () => api.runPayroll(period.id), (r) => t('payroll.done', { amount: money(r.totalGross, r.currency) }));
            }
          }} />
      ) : null}
    </Card>
  );
}

function RunRow({ run }: { run: RunView }) {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const slips = useQuery({ queryKey: ['payslips', org, run.id], queryFn: () => api.payslips(run.id), enabled: open });
  return (
    <View style={{ gap: 8 }}>
      <Pressable onPress={() => setOpen((v) => !v)}>
        <Row style={{ backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 12 }}>
          <View style={{ flex: 1 }}>
            <Txt variant="small" muted>{t('payroll.runLine', { n: run.runNumber, lines: run.lineCount })}</Txt>
            <Txt variant="heading">{money(run.totalGross, run.currency)}</Txt>
          </View>
          <StatusBadge status={run.status} />
          <Txt color={colors.primary} variant="small">{open ? t('common.hide') : t('payroll.payslips')}</Txt>
        </Row>
      </Pressable>
      {open ? slips.isLoading ? <Loading /> : (slips.data ?? []).map((s) => (
        <Row key={s.employmentId} style={{ paddingHorizontal: 4 }}>
          <Avatar name={s.displayName} size={32} />
          <View style={{ flex: 1 }}>
            <Txt>{s.displayName}</Txt>
            <Txt variant="small" muted>
              {t('payroll.shifts', { n: s.lines.filter((l) => l.kind === 'shift').length })}{s.bonuses ? ` · ${t('payroll.bonus', { amount: money(s.bonuses, s.currency) })}` : ''}
            </Txt>
          </View>
          <Txt variant="subheading">{money(s.gross, s.currency)}</Txt>
        </Row>
      )) : null}
    </View>
  );
}

function NewPeriodSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const api = useApi();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const [from, setFrom] = useState(addDays(today(), -14));
  const [to, setTo] = useState(addDays(today(), -1));
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;
  return (
    <Sheet visible={visible} onClose={onClose} title={t('payroll.newPeriod')}>
      <Row gap={10}>
        <View style={{ flex: 1 }}><Field label={t('payroll.from')} value={from} onChangeText={setFrom} placeholder="2026-10-01" /></View>
        <View style={{ flex: 1 }}><Field label={t('payroll.to')} value={to} onChangeText={setTo} placeholder="2026-10-15" /></View>
      </Row>
      <Button title={t('payroll.createPeriod')} icon="checkmark" full disabled={!valid} loading={busy === 'p'}
        onPress={async () => { if (await run('p', () => api.createPeriod('VND', from, to), t('payroll.periodCreated'))) onClose(); }} />
    </Sheet>
  );
}
