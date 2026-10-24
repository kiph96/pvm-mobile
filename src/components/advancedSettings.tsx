import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { PolicyRules, PolicyView } from '@/api/types';
import { useI18n } from '@/i18n';
import { useApi } from '@/state/session';
import { useTheme } from '@/theme';
import { money, pct } from '@/utils/format';
import { hoursText, NIGHT_DEFAULT, OVERTIME_DEFAULT, payRulesOf, type PayRulesJson } from '@/utils/pay';
import { useAction } from './toast';
import { Badge, Button, Card, Chip, Row, Section, Stepper, Toggle, Txt } from './ui';

const NIGHT_STARTS = ['21:00', '22:00', '23:00'];
const NIGHT_ENDS = ['05:00', '06:00', '07:00'];

type Sales = NonNullable<PolicyRules['sales']>;
type Attendance = { enabled: boolean; late_grace_minutes: number; early_leave_grace_minutes: number };

const attendanceOf = (rules: PolicyRules | null | undefined): Attendance => ({
  enabled: !!rules?.attendance?.enabled,
  late_grace_minutes: rules?.attendance?.late_grace_minutes ?? 5,
  early_leave_grace_minutes: rules?.attendance?.early_leave_grace_minutes ?? 5,
});

/**
 * Extras most stores do not need: clock in / out, overtime pay, night pay and sales commission. All off for a new store;
 * the section stays folded until the owner opens it (its header says which extras are on).
 */
export function AdvancedSettings({ storeId, policy }: { storeId: string; policy: PolicyView }) {
  const api = useApi();
  const { t } = useI18n();
  const { colors } = useTheme();
  const [run, busy] = useAction();
  const savedPay = payRulesOf(policy.rules);
  const savedSales: Sales = { enabled: !!policy.rules?.sales?.enabled, commission_percent: policy.rules?.sales?.commission_percent ?? 2 };
  const [open, setOpen] = useState(false);
  const [overtime, setOvertime] = useState<PayRulesJson['overtime']>(savedPay.overtime);
  const [night, setNight] = useState<PayRulesJson['night']>(savedPay.night);
  const [sales, setSales] = useState<Sales>(savedSales);
  const savedAttendance = attendanceOf(policy.rules);
  const [attendance, setAttendance] = useState<Attendance>(savedAttendance);
  useEffect(() => {
    const p = payRulesOf(policy.rules);
    setOvertime(p.overtime);
    setNight(p.night);
    setSales({ enabled: !!policy.rules?.sales?.enabled, commission_percent: policy.rules?.sales?.commission_percent ?? 2 });
    setAttendance(attendanceOf(policy.rules));
  }, [policy]);
  const dirty = JSON.stringify([overtime, night, sales, attendance])
    !== JSON.stringify([savedPay.overtime, savedPay.night, savedSales, savedAttendance]);
  const on = [savedAttendance.enabled ? t('advanced.attendanceOn') : null, savedPay.overtime ? t('advanced.overtimeOn') : null, savedPay.night ? t('advanced.nightOn') : null,
    savedSales.enabled ? t('advanced.salesOn', { n: pct(savedSales.commission_percent ?? 2) }) : null].filter(Boolean);

  const save = () => run('advanced', () => api.updatePolicy(storeId, {
    employeeLimit: policy.employeeLimit, employeeLimitMode: policy.employeeLimitMode, minStaff: policy.minStaff,
    optimalStaff: policy.optimalStaff, maxStaff: policy.maxStaff, registrationMode: policy.registrationMode,
    swapApprovalRequired: policy.swapApprovalRequired,
    rules: { ...(policy.rules ?? {}), pay: { ...savedPay, overtime, night }, sales, attendance },
  }), t('advanced.saved'));

  return (
    <Section title={t('advanced.title')}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <Card style={{ gap: 4 }}>
          <Row gap={10}>
            <Ionicons name="options-outline" size={20} color={colors.text} />
            <Txt variant="subheading" style={{ flex: 1 }}>{t('advanced.heading')}</Txt>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
          </Row>
          <Txt variant="small" muted>{on.length ? t('advanced.onList', { list: on.join(' · ') }) : t('advanced.allOff')}</Txt>
        </Card>
      </Pressable>
      {open ? (
        <Card style={{ gap: 18 }}>
          <View style={{ gap: 10 }}>
            <Toggle label={t('attendance.title')} hint={t('attendance.hint')} value={attendance.enabled}
              onChange={(v) => setAttendance({ ...attendance, enabled: v })} />
            {attendance.enabled ? (
              <>
                <Stepper label={t('attendance.lateGrace')} value={attendance.late_grace_minutes} min={0} max={60}
                  onChange={(m) => setAttendance({ ...attendance, late_grace_minutes: m })} />
                <Stepper label={t('attendance.earlyGrace')} value={attendance.early_leave_grace_minutes} min={0} max={60}
                  onChange={(m) => setAttendance({ ...attendance, early_leave_grace_minutes: m })} />
                <Txt variant="small" muted>{t('attendance.graceHint')}</Txt>
                <Txt variant="small" muted>{t('attendance.payHint')}</Txt>
              </>
            ) : null}
          </View>

          <View style={{ gap: 10 }}>
            <Toggle label={t('pay.overtime')} hint={t('pay.overtimeHint')} value={!!overtime}
              onChange={(v) => setOvertime(v ? OVERTIME_DEFAULT : null)} />
            {overtime ? (
              <>
                <Stepper label={`${t('pay.overtimeAfter')} (${hoursText(Math.round(overtime.after_hours * 60))})`} value={overtime.after_hours}
                  min={1} max={16} onChange={(h) => setOvertime({ ...overtime, after_hours: h })} />
                <Row gap={8} wrap>
                  <Txt variant="small" muted>{t('pay.multiplier')}</Txt>
                  {[1.5, 2, 3].map((m) => <Chip key={m} label={`${Math.round(m * 100)}%`} selected={overtime.multiplier === m}
                    onPress={() => setOvertime({ ...overtime, multiplier: m })} />)}
                </Row>
              </>
            ) : null}
          </View>

          <View style={{ gap: 10 }}>
            <Toggle label={t('pay.night')} hint={t('pay.nightHint')} value={!!night}
              onChange={(v) => setNight(v ? NIGHT_DEFAULT : null)} />
            {night ? (
              <>
                <Row gap={8} wrap>
                  <Txt variant="small" muted>{t('pay.nightFrom')}</Txt>
                  {NIGHT_STARTS.map((h) => <Chip key={h} label={h} selected={night.start === h} onPress={() => setNight({ ...night, start: h })} />)}
                </Row>
                <Row gap={8} wrap>
                  <Txt variant="small" muted>{t('pay.nightTo')}</Txt>
                  {NIGHT_ENDS.map((h) => <Chip key={h} label={h} selected={night.end === h} onPress={() => setNight({ ...night, end: h })} />)}
                </Row>
                <Row gap={8} wrap>
                  <Txt variant="small" muted>{t('pay.multiplier')}</Txt>
                  {[1.3, 1.5, 2].map((m) => <Chip key={m} label={`${Math.round(m * 100)}%`} selected={night.multiplier === m}
                    onPress={() => setNight({ ...night, multiplier: m })} />)}
                </Row>
              </>
            ) : null}
          </View>

          <View style={{ gap: 10 }}>
            <Toggle label={t('sales.settingsTitle')} hint={t('sales.enableHint')} value={!!sales.enabled}
              onChange={(v) => setSales({ ...sales, enabled: v })} />
            {sales.enabled ? (
              <>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt>{t('sales.rate')}</Txt>
                  <Row gap={10}>
                    <Button small variant="secondary" title="−" disabled={(sales.commission_percent ?? 2) <= 2}
                      onPress={() => setSales({ ...sales, commission_percent: Math.max(2, (sales.commission_percent ?? 2) - 0.5) })} />
                    <Txt variant="subheading" style={{ minWidth: 52, textAlign: 'center' }}>{pct(sales.commission_percent ?? 2)}%</Txt>
                    <Button small variant="secondary" title="+" disabled={(sales.commission_percent ?? 2) >= 10}
                      onPress={() => setSales({ ...sales, commission_percent: Math.min(10, (sales.commission_percent ?? 2) + 0.5) })} />
                  </Row>
                </Row>
                <Txt variant="small" muted>{t('sales.example', { amount: money(1_000_000), commission: money(10_000 * (sales.commission_percent ?? 2)) })}</Txt>
              </>
            ) : null}
          </View>

          {dirty ? <Button title={t('advanced.save')} icon="checkmark" loading={busy === 'advanced'} onPress={save} full />
            : <Badge tone="success" icon="checkmark-circle" label={t('storeSettings.version', { n: policy.version })} />}
        </Card>
      ) : null}
    </Section>
  );
}
