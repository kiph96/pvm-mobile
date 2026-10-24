import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import type { ReportPreview, ReportSettings } from '@/api/types';
import { useAction } from '@/components/toast';
import { Badge, Button, Card, Chip, ErrorState, Field, IconBubble, Loading, Row, Screen, Section, Toggle, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';
import { useTheme } from '@/theme';
import { dateTime } from '@/utils/format';

/** Owner settings for the detailed email report sent after each payroll period (or calendar month). */
export default function PeriodReport() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const settings = useQuery({ queryKey: ['period-report', org], queryFn: api.reportSettings });
  const preview = useQuery({ queryKey: ['period-report-preview', org], queryFn: api.previewReport });

  return (
    <Screen onRefresh={() => { settings.refetch(); preview.refetch(); }} refreshing={false}>
      <Card tone="primary" style={{ marginTop: 12 }}>
        <Row>
          <IconBubble icon="mail" tone="primary" size={44} />
          <Txt style={{ flex: 1 }}>{t('report.intro')}</Txt>
        </Row>
      </Card>
      {settings.isLoading ? <Loading /> : settings.error ? <ErrorState error={settings.error} onRetry={settings.refetch} /> : (
        <>
          {!settings.data!.mailConfigured ? <Card tone="warning" style={{ marginTop: 12 }}><Txt>{t('report.noMail')}</Txt></Card> : null}
          <SettingsCard settings={settings.data!} />
        </>
      )}
      <PreviewCard query={preview} />
    </Screen>
  );
}

function SettingsCard({ settings }: { settings: ReportSettings }) {
  const api = useApi();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [email, setEmail] = useState(settings.email ?? '');
  const [language, setLanguage] = useState(settings.language);
  useEffect(() => {
    setEnabled(settings.enabled);
    setEmail(settings.email ?? '');
    setLanguage(settings.language);
  }, [settings]);
  const dirty = enabled !== settings.enabled || email.trim().toLowerCase() !== (settings.email ?? '') || language !== settings.language;
  const tz = settings.timezone;

  return (
    <Section title={t('screens.report')}>
      <Card style={{ gap: 18 }}>
        <Toggle label={t('report.enabled')} hint={t('report.enabledHint')} value={enabled} onChange={setEnabled} />
        {enabled ? (
          <>
            <Field label={t('report.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
              autoCorrect={false} placeholder={settings.accountEmail ?? 'ten@email.com'}
              hint={settings.accountEmail ? t('report.emailHint', { email: settings.accountEmail }) : t('report.emailHintNone')} />
            <View style={{ gap: 8 }}>
              <Txt variant="small" muted>{t('report.language')}</Txt>
              <Row gap={8} wrap>
                <Chip label="🇻🇳 Tiếng Việt" selected={language === 'vi'} onPress={() => setLanguage('vi')} />
                <Chip label="🇬🇧 English" selected={language === 'en'} onPress={() => setLanguage('en')} />
              </Row>
            </View>
            <Txt variant="small" muted>{settings.followsPayrollPeriods ? t('report.followsPeriods') : t('report.followsMonths')}</Txt>
          </>
        ) : null}
        {!dirty ? (
          <View style={{ gap: 8 }}>
            <Badge tone={settings.enabled ? 'success' : 'neutral'} icon={settings.enabled ? 'mail-outline' : 'mail-unread-outline'}
              label={!settings.enabled ? t('report.off') : settings.next
                ? t('report.next', { label: settings.next.periodLabel, when: dateTime(settings.next.sendAt, tz) }) : t('report.noNext')} />
            {settings.last ? (
              <Txt variant="small" muted>{settings.last.status === 'failed' ? t('report.lastFailed', { label: settings.last.periodLabel })
                : t('report.last', { label: settings.last.periodLabel, to: settings.last.recipient, when: dateTime(settings.last.sentAt, tz) })}</Txt>
            ) : null}
          </View>
        ) : (
          <Row gap={8}>
            <Button title={t('common.discard')} variant="secondary" style={{ flex: 1 }}
              onPress={() => { setEnabled(settings.enabled); setEmail(settings.email ?? ''); setLanguage(settings.language); }} />
            <Button title={t('common.save')} icon="checkmark" style={{ flex: 1 }} loading={busy === 'save'}
              onPress={() => run('save', () => api.updateReportSettings(enabled, email.trim() || null, language), t('report.saved'))} />
          </Row>
        )}
      </Card>
    </Section>
  );
}

function PreviewCard({ query }: { query: UseQueryResult<ReportPreview> }) {
  const api = useApi();
  const { t } = useI18n();
  const { colors } = useTheme();
  const [run, busy] = useAction();
  const p = query.data;
  return (
    <Section title={t('report.preview')}>
      {query.isLoading ? <Loading /> : !p ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
        <Card style={{ gap: 12 }}>
          <Row gap={8} wrap>
            <Txt variant="subheading" style={{ flex: 1 }}>{t('report.previewOf', { label: p.periodLabel })}</Txt>
            <Badge tone={p.payrollFinal ? 'success' : 'warning'} label={p.payrollFinal ? t('report.final') : t('report.estimate')} />
          </Row>
          {Platform.OS === 'web' ? (
            // the email exactly as it will arrive
            <View style={{ height: 560, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
              {React.createElement('iframe', { srcDoc: p.html, title: p.subject, style: { width: '100%', height: '100%', border: 0, background: '#fff' } })}
            </View>
          ) : (
            <Txt variant="small" muted>{t('report.phonePreview')}</Txt>
          )}
          <Button title={t('report.sendNow', { label: p.periodLabel })} icon="paper-plane-outline" variant="secondary" loading={busy === 'send'}
            onPress={() => run('send', () => api.sendReportNow(),
              (r) => r.status === 'sent' ? t('report.sent', { email: r.recipient }) : t('report.logged'))} />
        </Card>
      )}
    </Section>
  );
}
