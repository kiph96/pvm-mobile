import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { View } from 'react-native';

import { Card, ErrorState, Loading, Row, Screen, Section, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';
import { useTheme } from '@/theme';
import { dayLabel, localDateOf, money } from '@/utils/format';

export default function Billing() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { colors } = useTheme();
  const estimate = useQuery({ queryKey: ['estimate', org], queryFn: api.estimate });
  const invoices = useQuery({ queryKey: ['invoices', org], queryFn: api.invoices });
  const e = estimate.data;
  const line = (label: string, value: string, strong = false) => (
    <Row style={{ justifyContent: 'space-between' }}>
      <Txt muted={!strong} variant={strong ? 'subheading' : 'body'}>{label}</Txt>
      <Txt variant={strong ? 'heading' : 'body'}>{value}</Txt>
    </Row>
  );
  return (
    <Screen onRefresh={() => { estimate.refetch(); invoices.refetch(); }} refreshing={false}>
      <Section title={t('billing.thisMonth')} style={{ marginTop: 12 }}>
        {estimate.isLoading ? <Loading /> : estimate.error ? <ErrorState error={estimate.error} onRetry={estimate.refetch} /> : e ? (
          <Card style={{ gap: 12 }}>
            <Txt variant="small" muted>{t('billing.plan', { plan: e.planCode })}</Txt>
            {line(t('billing.base'), money(e.baseFee, e.currency))}
            {line(t('billing.stores', { n: e.activeStores }), money(e.storeFees, e.currency))}
            {line(t('billing.people', { n: e.activeEmployees }), money(e.employeeFees, e.currency))}
            <View style={{ height: 1, backgroundColor: colors.border }} />
            {line(t('billing.total'), money(e.total, e.currency), true)}
          </Card>
        ) : null}
      </Section>
      <Section title={t('billing.invoices')}>
        {(invoices.data ?? []).length === 0 ? <Txt muted>{t('billing.none')}</Txt> : invoices.data!.map((inv) => (
          <Card key={inv.id} style={{ gap: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="subheading">{inv.invoiceNumber}</Txt>
              <Txt variant="heading">{money(inv.total, inv.currency)}</Txt>
            </Row>
            <Txt variant="small" muted>{t('billing.issued', { issued: dayLabel(localDateOf(inv.issuedAt)), due: dayLabel(localDateOf(inv.dueAt)) })}</Txt>
            {inv.lines.map((l) => (
              <Row key={l.code} style={{ justifyContent: 'space-between' }}>
                <Txt variant="small" muted>{l.description}</Txt>
                <Txt variant="small">{money(l.amount, inv.currency)}</Txt>
              </Row>
            ))}
          </Card>
        ))}
      </Section>
    </Screen>
  );
}
