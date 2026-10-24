import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import type { PolicyView } from '@/api/types';
import { useI18n } from '@/i18n';
import { useApi } from '@/state/session';
import { useTheme } from '@/theme';
import { money } from '@/utils/format';
import { DEFAULT_PAY, estimatePay, hoursText, payRulesOf, wageText, type PayRulesJson } from '@/utils/pay';
import { useAction } from './toast';
import { Badge, Button, Card, Chip, Row, Section, Segmented, Toggle, Txt } from './ui';

const EXAMPLES: [string, string][] = [['08:00', '12:00'], ['14:00', '23:00'], ['18:00', '02:00']];
const EXAMPLE_RATE = 30000;

/** Owner editor for rules.pay of a store policy (saved as a new policy version). */
export function PayRulesEditor({ storeId, policy }: { storeId: string; policy: PolicyView }) {
  const api = useApi();
  const { t } = useI18n();
  const { colors } = useTheme();
  const [run, busy] = useAction();
  const saved = payRulesOf(policy.rules);
  const legacy = !policy.rules?.pay;
  // Stores still on the old per-shift setup start editing from the recommended defaults.
  const [pay, setPay] = useState<PayRulesJson>(legacy ? DEFAULT_PAY : saved);
  const [example, setExample] = useState(1);
  useEffect(() => setPay(policy.rules?.pay ? payRulesOf(policy.rules) : DEFAULT_PAY), [policy]);
  const dirty = legacy || JSON.stringify(pay) !== JSON.stringify(saved);
  const set = <K extends keyof PayRulesJson>(k: K, v: PayRulesJson[K]) => setPay((p) => ({ ...p, [k]: v }));
  // hour options only matter when staff clock in (Advanced > Clock in/out); the server ignores them otherwise
  const hourOptions = !!policy.rules?.attendance?.enabled;

  const [exStart, exEnd] = EXAMPLES[example];
  const est = estimatePay(pay, 'hourly', EXAMPLE_RATE, exStart, exEnd);
  const pct = (m: number) => Math.round((m - 1) * 100);

  const save = () => run('pay', () => api.updatePolicy(storeId, {
    employeeLimit: policy.employeeLimit, employeeLimitMode: policy.employeeLimitMode, minStaff: policy.minStaff,
    optimalStaff: policy.optimalStaff, maxStaff: policy.maxStaff, registrationMode: policy.registrationMode,
    swapApprovalRequired: policy.swapApprovalRequired, rules: { ...(policy.rules ?? {}), pay },
  }), t('pay.saved'));

  return (
    <Section title={t('pay.title')}>
      {legacy ? <Card tone="warning"><Txt>{t('pay.legacy')}</Txt></Card> : null}
      <Card style={{ gap: 18 }}>
        <Txt variant="small" muted>{t('pay.intro')}</Txt>

        <View style={{ gap: 8 }}>
          <Txt variant="subheading">{t('pay.basis')}</Txt>
          <Segmented value={pay.basis} onChange={(v) => set('basis', v)}
            options={[{ value: 'hourly', label: t('pay.hourly') }, { value: 'per_shift', label: t('pay.perShift') }]} />
          <Txt variant="small" muted>{t('pay.basisHint')}</Txt>
        </View>

        {!hourOptions ? <Txt variant="small" muted>{t('attendance.payOff')}</Txt> : null}
        {hourOptions ? (
          <>
            <View style={{ gap: 8 }}>
              <Txt variant="subheading">{t('pay.source')}</Txt>
              {([['actual', 'sourceActual'], ['actual_capped', 'sourceCapped'], ['scheduled', 'sourceScheduled']] as const).map(([v, key]) => (
                <Chip key={v} label={`${t(`pay.${key}`)} — ${t(`pay.${key}Hint`)}`} selected={pay.hours_source === v} onPress={() => set('hours_source', v)} />
              ))}
            </View>

            <View style={{ gap: 8 }}>
              <Txt variant="subheading">{t('pay.rounding')}</Txt>
              <Row gap={8} wrap>
                {[0, 5, 15, 30].map((m) => (
                  <Chip key={m} label={m === 0 ? t('pay.roundingNone') : `${m}′`} selected={pay.rounding.minutes === m}
                    onPress={() => set('rounding', { ...pay.rounding, minutes: m })} />
                ))}
              </Row>
              {pay.rounding.minutes > 0 ? (
                <Segmented value={pay.rounding.mode} onChange={(mode) => set('rounding', { ...pay.rounding, mode })}
                  options={[{ value: 'nearest', label: t('pay.roundNearest') }, { value: 'down', label: t('pay.roundDown') }, { value: 'up', label: t('pay.roundUp') }]} />
              ) : null}
            </View>

            <Toggle label={t('pay.breaks')} hint={t('pay.breaksHint')} value={pay.unpaid_breaks} onChange={(v) => set('unpaid_breaks', v)} />

            <View style={{ gap: 8 }}>
              <Txt variant="subheading">{t('pay.minimum')}</Txt>
              <Row gap={8} wrap>
                {[0, 60, 120, 180, 240].map((m) => (
                  <Chip key={m} label={m === 0 ? t('pay.none') : hoursText(m)} selected={pay.min_paid_minutes === m} onPress={() => set('min_paid_minutes', m)} />
                ))}
              </Row>
              <Txt variant="small" muted>{t('pay.minimumHint')}</Txt>
            </View>

            {/* overtime and night pay live under Advanced; the example still includes them when on */}
            {/* live example so the owner sees what the settings mean */}
            <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 14, gap: 8 }}>
              <Txt variant="subheading">{t('pay.example')}</Txt>
              {/* own line + wrap: three time chips don't fit beside the title on a phone */}
              <Row gap={6} wrap>
                {EXAMPLES.map(([a, b], i) => <Chip key={a} label={`${a}–${b}`} selected={example === i} onPress={() => setExample(i)} />)}
              </Row>
              {pay.basis === 'per_shift' ? (
                <Txt variant="small">{wageText(180000, 'per_shift')}</Txt>
              ) : (
                <>
                  <Txt variant="small" muted>{t('pay.exampleLine', { start: exStart, end: exEnd, rate: wageText(EXAMPLE_RATE, 'hourly') })}</Txt>
                  <ExampleLine label={t('pay.exBase', { hours: hoursText(est.paidMinutes) })} amount={est.base} />
                  {est.overtime ? <ExampleLine label={t('pay.exOvertime', { hours: hoursText(est.overtimeMinutes), pct: pct(pay.overtime!.multiplier) })} amount={est.overtime} /> : null}
                  {est.night ? <ExampleLine label={t('pay.exNight', { hours: hoursText(est.nightMinutes), pct: pct(pay.night!.multiplier) })} amount={est.night} /> : null}
                  <View style={{ height: 1, backgroundColor: colors.border }} />
                  <ExampleLine label={t('pay.exTotal')} amount={est.total} strong />
                </>
              )}
            </View>
          </>
        ) : null}

        {dirty ? <Button title={t('pay.save')} icon="checkmark" loading={busy === 'pay'} onPress={save} full />
          : <Badge tone="success" icon="checkmark-circle" label={t('storeSettings.version', { n: policy.version })} />}
      </Card>
    </Section>
  );
}

function ExampleLine({ label, amount, strong }: { label: string; amount: number; strong?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <Txt variant={strong ? 'subheading' : 'small'} style={{ flex: 1 }}>{label}</Txt>
      <Txt variant={strong ? 'subheading' : 'small'}>{money(amount)}</Txt>
    </Row>
  );
}
