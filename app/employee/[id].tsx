import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { BranchesSection } from '@/components/branches';
import { IssueSheet } from '@/components/issueSheet';
import { ManagerStoresSection } from '@/components/managers';
import { StatusBadge, codeLabel } from '@/components/domain';
import { useAction } from '@/components/toast';
import { Avatar, Button, Card, Chip, ErrorState, Field, Loading, Row, Screen, Section, Segmented, Sheet, Txt, confirm } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';
import { useTheme } from '@/theme';
import { ago, dayLabel, localDateOf, money } from '@/utils/format';
import { payRulesOf, wageText, type WageBasis } from '@/utils/pay';

export default function EmployeeScreen() {
  const { id, storeId } = useLocalSearchParams<{ id: string; storeId: string }>();
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { colors } = useTheme();
  const [run, busy] = useAction();
  const [wageOpen, setWageOpen] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const team = useQuery({ queryKey: ['employees', org, storeId], queryFn: () => api.employees(storeId) });
  const rates = useQuery({ queryKey: ['rates', org, id], queryFn: () => api.rates(id) });
  const points = useQuery({ queryKey: ['points', org, id], queryFn: () => api.points(id) });
  const violations = useQuery({ queryKey: ['violations', org, 'emp', id], queryFn: () => api.violations({ employmentId: id }) });
  const policy = useQuery({ queryKey: ['policy', org, storeId], queryFn: () => api.policy(storeId) });
  const e = team.data?.find((x) => x.employmentId === id);

  if (team.isLoading) return <Screen><Loading /></Screen>;
  if (!e) return <Screen><ErrorState error={team.error ?? new Error(t('mock.notFound'))} onRetry={team.refetch} /></Screen>;
  const balance = points.data?.balance ?? 0;

  return (
    <Screen onRefresh={() => { team.refetch(); rates.refetch(); points.refetch(); violations.refetch(); }} refreshing={false}>
      <Stack.Screen options={{ title: e.displayName }} />
      <View style={{ alignItems: 'center', gap: 8, paddingVertical: 16 }}>
        <Avatar name={e.displayName} size={76} />
        <Txt variant="title">{e.displayName}</Txt>
        <Row gap={8}><StatusBadge status={e.status} /><Txt variant="small" muted>{t('common.since', { date: dayLabel(localDateOf(e.startedAt)) })}</Txt></Row>
      </View>

      <Row gap={10}>
        <Card style={{ flex: 1, gap: 4 }} onPress={() => setWageOpen(true)}>
          <Txt variant="small" muted>{t('employee.wage')}</Txt>
          <Txt variant="heading" color={e.currentWage == null ? colors.warning : undefined}>
            {e.currentWage == null ? t('team.noWage') : wageText(e.currentWage, e.wageBasis, e.currency)}
          </Txt>
          <Txt variant="small" color={colors.primary}>{e.currentWage == null ? t('employee.setWage') : t('employee.change')}</Txt>
        </Card>
        <Card style={{ flex: 1, gap: 4 }} onPress={() => setPointsOpen(true)}>
          <Txt variant="small" muted>{t('common.points')}</Txt>
          <Txt variant="heading" color={balance < 0 ? colors.danger : colors.text}>{balance > 0 ? '+' : ''}{balance}</Txt>
          <Txt variant="small" color={colors.primary}>{t('employee.givePoints')}</Txt>
        </Card>
      </Row>

      {e.status !== 'ended' ? <BranchesSection employmentId={id} /> : null}
      {e.status !== 'ended' && e.role === 'employee' ? <ManagerStoresSection employmentId={id} /> : null}

      <Section title={t('employee.history')}>
        {points.isLoading ? <Loading /> : (points.data?.entries ?? []).length === 0 ? <Txt muted>{t('employee.noPoints')}</Txt>
          : [...(points.data?.entries ?? [])].reverse().slice(0, 8).map((p) => (
            <Card key={p.id} style={{ paddingVertical: 12 }}>
              <Row>
                <Txt variant="subheading" color={p.delta < 0 ? colors.danger : colors.success} style={{ width: 44 }}>{p.delta > 0 ? '+' : ''}{p.delta}</Txt>
                <View style={{ flex: 1 }}>
                  <Txt numberOfLines={1}>{p.reason}</Txt>
                  <Txt variant="small" muted>{ago(p.effectiveAt)}</Txt>
                </View>
              </Row>
            </Card>
          ))}
      </Section>

      <Section title={t('employee.issues')} action={t('employee.report')} onAction={() => setIssueOpen(true)}>
        {(violations.data ?? []).length === 0 ? <Txt muted>{t('employee.clean')}</Txt> : violations.data!.map((v) => (
          <Card key={v.id} style={{ gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="subheading">{codeLabel(v.code)}</Txt>
              <StatusBadge status={v.status} />
            </Row>
            <Txt variant="small" muted>{v.description} · {ago(v.occurredAt)}{v.points ? ` · ${t('violations.pts', { n: v.points })}` : ''}</Txt>
          </Card>
        ))}
      </Section>

      <Section title={t('employee.wageHistory')}>
        {(rates.data ?? []).map((r) => (
          <Row key={r.id} style={{ justifyContent: 'space-between' }}>
            <Txt>{wageText(r.amount, r.basis, r.currency)}</Txt>
            <Txt variant="small" muted>{dayLabel(localDateOf(r.validFrom))} → {r.validTo ? dayLabel(localDateOf(r.validTo)) : t('employee.now')}</Txt>
          </Row>
        ))}
      </Section>

      {e.status !== 'ended' ? (
        <Button title={t('employee.end')} variant="danger" icon="exit-outline" style={{ marginTop: 28 }} loading={busy === 'end'}
          onPress={async () => {
            if (await confirm(t('employee.endTitle', { name: e.displayName }), t('employee.endMsg'), t('employee.end'), true)) {
              if (await run('end', () => api.endEmployment(id), t('employee.ended'))) router.back();
            }
          }} />
      ) : null}

      <WageSheet visible={wageOpen} onClose={() => setWageOpen(false)} employmentId={id} current={e.currentWage ?? 0}
        currentBasis={(e.wageBasis as WageBasis | null) ?? payRulesOf(policy.data?.rules).basis} />
      <PointsSheet visible={pointsOpen} onClose={() => setPointsOpen(false)} employmentId={id} awards={policy.data?.rules?.awards ?? {}} />
      <IssueSheet visible={issueOpen} onClose={() => setIssueOpen(false)} employmentId={id} codes={policy.data?.rules?.violations ?? {}} />
    </Screen>
  );
}

const SUGGESTED: Record<WageBasis, number[]> = { hourly: [25000, 28000, 30000, 35000], per_shift: [150000, 170000, 180000, 200000] };

function WageSheet({ visible, onClose, employmentId, current, currentBasis }: {
  visible: boolean; onClose: () => void; employmentId: string; current: number; currentBasis: WageBasis;
}) {
  const api = useApi();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const [basis, setBasis] = useState<WageBasis>(currentBasis);
  const [value, setValue] = useState(String(current || ''));
  const amount = Number(value.replace(/[^\d]/g, ''));
  return (
    <Sheet visible={visible} onClose={onClose} title={t('employee.wage')}>
      <Txt muted>{t('employee.wageNote')}</Txt>
      <Txt variant="small" muted>{t('pay.wageType')}</Txt>
      <Segmented value={basis} onChange={(b) => { setBasis(b); setValue(''); }}
        options={[{ value: 'hourly', label: t('pay.hourly') }, { value: 'per_shift', label: t('pay.perShift') }]} />
      <Field label={t('employee.amount')} value={value} onChangeText={setValue} keyboardType="numeric" autoFocus
        hint={amount > 0 ? wageText(amount, basis) : undefined} />
      <Row gap={8} wrap>
        {SUGGESTED[basis].map((v) => <Chip key={v} label={money(v)} selected={amount === v} onPress={() => setValue(String(v))} />)}
      </Row>
      <Button title={t('employee.saveWage')} icon="checkmark" full loading={busy === 'w'} disabled={!(amount > 0)}
        onPress={async () => { if (await run('w', () => api.setRate(employmentId, amount, basis), t('employee.wageSaved'))) onClose(); }} />
    </Sheet>
  );
}

function PointsSheet({ visible, onClose, employmentId, awards }: { visible: boolean; onClose: () => void; employmentId: string; awards: Record<string, { points: number }> }) {
  const api = useApi();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const [reason, setReason] = useState('');
  return (
    <Sheet visible={visible} onClose={onClose} title={t('employee.givePoints')}>
      <Txt muted>{t('employee.pointsNote')}</Txt>
      {Object.entries(awards).map(([code, a]) => (
        <Button key={code} variant="secondary" title={`${codeLabel(code)} (+${a.points})`} icon="star-outline" loading={busy === code}
          onPress={async () => { if (await run(code, () => api.awardPoints(employmentId, { code, reason: reason || codeLabel(code) }), t('employee.given', { n: a.points }))) onClose(); }} />
      ))}
      <Field label={t('employee.note')} value={reason} onChangeText={setReason} placeholder={t('employee.notePlaceholder')} />
      <Button title={t('employee.give5')} icon="star" full loading={busy === 'custom'} disabled={!reason.trim()}
        onPress={async () => { if (await run('custom', () => api.awardPoints(employmentId, { points: 5, reason }), t('employee.given', { n: 5 }))) onClose(); }} />
    </Sheet>
  );
}

