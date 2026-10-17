import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { View } from 'react-native';

import { Card, Empty, ErrorState, Loading, Row, Screen, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';
import { useTheme } from '@/theme';
import { dayLabel, money } from '@/utils/format';
import { hoursText } from '@/utils/pay';

export default function Payslips() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ['my-payslips', org], queryFn: api.myPayslips });
  return (
    <Screen onRefresh={q.refetch} refreshing={q.isRefetching}>
      <View style={{ gap: 12, marginTop: 12 }}>
        {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} />
          : (q.data ?? []).length === 0 ? <Empty icon="wallet-outline" title={t('payslips.none')} message={t('payslips.noneMsg')} />
            : q.data!.map((s, i) => (
              <Card key={`${s.employmentId}-${i}`} style={{ gap: 10 }}>
                <Txt variant="small" muted>{s.storeName}</Txt>
                <Txt variant="title" color={colors.primary}>{money(s.gross, s.currency)}</Txt>
                <Row gap={16}>
                  <Txt variant="small">{t('payslips.wages', { amount: money(s.wages, s.currency) })}</Txt>
                  {s.bonuses ? <Txt variant="small">{t('payslips.bonus', { amount: money(s.bonuses, s.currency) })}</Txt> : null}
                </Row>
                <Txt variant="small" muted>{t('payroll.shifts', { n: s.lines.filter((l) => l.kind === 'shift').length })}</Txt>
                {s.lines.slice(0, 8).map((l) => {
                  const d = (l.details ?? {}) as Record<string, unknown>;
                  const date = (d.shift_date ?? d.date) as string | undefined;
                  const extras = [
                    d.wage_basis === 'hourly' && typeof d.paid_minutes === 'number' ? t('pay.slipHours', { hours: hoursText(d.paid_minutes) }) : null,
                    Number(d.overtime_premium) > 0 ? t('pay.slipOvertime', { amount: money(Number(d.overtime_premium), s.currency) }) : null,
                    Number(d.night_premium) > 0 ? t('pay.slipNight', { amount: money(Number(d.night_premium), s.currency) }) : null,
                  ].filter(Boolean).join(' · ');
                  return (
                    <View key={l.lineId}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <Txt variant="small" muted>{date ? dayLabel(date) : l.kind}</Txt>
                        <Txt variant="small">{money(l.amount, s.currency)}</Txt>
                      </Row>
                      {extras ? <Txt variant="tiny" muted>{extras}</Txt> : null}
                    </View>
                  );
                })}
              </Card>
            ))}
      </View>
    </Screen>
  );
}
