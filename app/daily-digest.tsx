import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import type { DigestSettings, StaffingDigest } from '@/api/types';
import { useAction, useToast } from '@/components/toast';
import { Badge, Button, Card, Chip, ErrorState, IconBubble, IconButton, Loading, Row, Screen, Section, Toggle, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { registerForPush, type PushStatus } from '@/notifications/push';
import { useOrgKey } from '@/state/queries';
import { useApi, useSession } from '@/state/session';
import { useTheme } from '@/theme';
import { dateTime } from '@/utils/format';

const PRESETS = ['20:00', '21:00', '22:00', '23:00'];
const MINUTES = ['00', '15', '30', '45'];
const pad = (n: number) => String(n).padStart(2, '0');

/** Owner settings for the evening "tomorrow's shifts" notification. */
export default function DailyDigest() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const settings = useQuery({ queryKey: ['digest', org], queryFn: api.digestSettings });
  const preview = useQuery({ queryKey: ['digest-preview', org], queryFn: api.previewDigest });

  return (
    <Screen onRefresh={() => { settings.refetch(); preview.refetch(); }} refreshing={false}>
      <Card tone="primary" style={{ marginTop: 12 }}>
        <Row>
          <IconBubble icon="moon" tone="primary" size={44} />
          <Txt style={{ flex: 1 }}>{t('digest.intro')}</Txt>
        </Row>
      </Card>
      {settings.isLoading ? <Loading /> : settings.error ? <ErrorState error={settings.error} onRetry={settings.refetch} />
        : <SettingsCard settings={settings.data!} />}
      <PreviewCard query={preview} />
      <PhoneCard />
    </Screen>
  );
}

function SettingsCard({ settings }: { settings: DigestSettings }) {
  const api = useApi();
  const { t } = useI18n();
  const { colors, radius } = useTheme();
  const [run, busy] = useAction();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [hour, setHour] = useState(Number(settings.sendAt.slice(0, 2)));
  const [minute, setMinute] = useState(settings.sendAt.slice(3, 5));
  const [language, setLanguage] = useState(settings.language);
  useEffect(() => {
    setEnabled(settings.enabled);
    setHour(Number(settings.sendAt.slice(0, 2)));
    setMinute(settings.sendAt.slice(3, 5));
    setLanguage(settings.language);
  }, [settings]);
  const sendAt = `${pad(hour)}:${minute}`;
  const dirty = enabled !== settings.enabled || sendAt !== settings.sendAt.slice(0, 5) || language !== settings.language;
  const setPreset = (p: string) => { setHour(Number(p.slice(0, 2))); setMinute(p.slice(3, 5)); };

  return (
    <Section title={t('screens.digest')}>
      <Card style={{ gap: 18 }}>
        <Toggle label={t('digest.enabled')} hint={t('digest.enabledHint')} value={enabled} onChange={setEnabled} />
        {enabled ? (
          <>
            <View style={{ gap: 10 }}>
              <Txt variant="small" muted>{t('digest.time')} · {t('digest.timeHint', { tz: settings.timezone })}</Txt>
              <Row style={{ justifyContent: 'center' }} gap={16}>
                <IconButton icon="remove" label="-1h" onPress={() => setHour((h) => (h + 23) % 24)} />
                <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.lg, paddingHorizontal: 22, paddingVertical: 8 }}>
                  <Txt variant="title" color={colors.primary} style={{ fontSize: 40, letterSpacing: 1 }}>{sendAt}</Txt>
                </View>
                <IconButton icon="add" label="+1h" onPress={() => setHour((h) => (h + 1) % 24)} />
              </Row>
              <Row gap={8} wrap style={{ justifyContent: 'center' }}>
                {MINUTES.map((m) => <Chip key={m} label={`:${m}`} selected={minute === m} onPress={() => setMinute(m)} />)}
              </Row>
              <Row gap={8} wrap style={{ justifyContent: 'center' }}>
                {PRESETS.map((p) => <Chip key={p} label={p} icon="time-outline" selected={sendAt === p} onPress={() => setPreset(p)} />)}
              </Row>
            </View>
            <View style={{ gap: 8 }}>
              <Txt variant="small" muted>{t('digest.language')}</Txt>
              <Row gap={8} wrap>
                <Chip label="🇻🇳 Tiếng Việt" selected={language === 'vi'} onPress={() => setLanguage('vi')} />
                <Chip label="🇬🇧 English" selected={language === 'en'} onPress={() => setLanguage('en')} />
              </Row>
            </View>
          </>
        ) : null}
        {!dirty ? (
          <Badge tone={settings.enabled ? 'success' : 'neutral'} icon={settings.enabled ? 'alarm-outline' : 'notifications-off-outline'}
            label={settings.enabled && settings.nextSendAt ? t('digest.next', { when: dateTime(settings.nextSendAt, settings.timezone) }) : t('digest.off')} />
        ) : (
          <Row gap={8}>
            <Button title={t('common.discard')} variant="secondary" style={{ flex: 1 }}
              onPress={() => { setEnabled(settings.enabled); setPreset(settings.sendAt); setLanguage(settings.language); }} />
            <Button title={t('common.save')} icon="checkmark" style={{ flex: 1 }} loading={busy === 'save'}
              onPress={() => run('save', () => api.updateDigestSettings(enabled, sendAt, language),
                (s) => s.enabled ? t('digest.saved', { time: s.sendAt.slice(0, 5) }) : t('digest.off'))} />
          </Row>
        )}
      </Card>
    </Section>
  );
}

function PreviewCard({ query }: { query: UseQueryResult<StaffingDigest> }) {
  const api = useApi();
  const { t } = useI18n();
  const { colors } = useTheme();
  const [run, busy] = useAction();
  const d = query.data;
  return (
    <Section title={t('digest.preview')} action={t('digest.refresh')} onAction={() => query.refetch()}>
      {query.isLoading ? <Loading /> : !d ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
        <Card style={{ gap: 12 }}>
          {/* looks like the phone notification */}
          <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 16, padding: 14, gap: 4 }}>
            <Row gap={8}>
              <IconBubble icon="cafe" tone="primary" size={22} />
              <Txt variant="tiny" muted>PVM</Txt>
            </Row>
            <Txt variant="subheading">{d.title}</Txt>
            <Txt variant="small">{d.body}</Txt>
          </View>
          <Row gap={6} wrap>
            {d.totals.shifts === 0 ? null : d.totals.understaffedShifts === 0
              ? <Badge tone="success" icon="checkmark-circle" label={t('digest.allGood', { n: d.totals.shifts })} />
              : (
                <>
                  <Badge tone="danger" icon="people-outline" label={t('digest.missing', { n: d.totals.peopleMissing })} />
                  <Badge tone="warning" label={t('digest.understaffed', { n: d.totals.understaffedShifts, total: d.totals.shifts })} />
                </>
              )}
            {d.totals.drafts ? <Badge tone="neutral" label={t('digest.drafts', { n: d.totals.drafts })} /> : null}
            {d.totals.pendingRequests ? <Badge tone="info" label={t('digest.pending', { n: d.totals.pendingRequests })} /> : null}
          </Row>
          <Row gap={8} wrap>
            <Button small title={t('digest.open')} icon="calendar-outline" variant="secondary"
              onPress={() => router.push(`/owner/schedule?date=${d.date}`)} />
            <Button small title={t('digest.sendNow')} icon="paper-plane-outline" variant="ghost" loading={busy === 'send'}
              onPress={() => run('send', () => api.sendDigestNow(), t('digest.sent'))} />
          </Row>
        </Card>
      )}
    </Section>
  );
}

function PhoneCard() {
  const api = useApi();
  const { t } = useI18n();
  const toast = useToast();
  const { session } = useSession();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);

  // Without prompting: show whether this phone can already receive notifications.
  useEffect(() => {
    if (session?.mode === 'server') registerForPush(api, false).then(setStatus);
    else setStatus(Platform.OS === 'web' ? { ok: false, reason: 'web' } : null);
  }, [api, session?.mode]);

  const enable = async () => {
    setBusy(true);
    const s = await registerForPush(api, true);
    setStatus(s);
    setBusy(false);
    if (!s.ok && s.reason === 'error') toast(t('digest.pushError', { msg: s.message ?? '' }), 'error');
  };

  const message = !status ? null : status.ok ? t('digest.deviceOk')
    : status.reason === 'web' ? t('digest.pushWeb')
      : status.reason === 'simulator' ? t('digest.pushSimulator')
        : status.reason === 'denied' ? t('digest.pushDenied')
          : status.reason === 'no-project' ? t('digest.pushNoProject')
            : t('digest.pushError', { msg: status.message ?? '' });
  return (
    <Section title={t('digest.devicesTitle')}>
      <Card style={{ gap: 12 }}>
        <Row>
          <IconBubble icon={status?.ok ? 'phone-portrait' : 'phone-portrait-outline'} tone={status?.ok ? 'success' : 'warning'} size={40} />
          <Txt style={{ flex: 1 }}>{message ?? t('common.loading')}</Txt>
        </Row>
        {/* 'denied' also means "not asked yet": the silent check never prompts */}
        {status && !status.ok && (status.reason === 'denied' || status.reason === 'error') ? (
          <Button title={t('digest.enablePush')} icon="notifications-outline" loading={busy} onPress={enable} />
        ) : null}
      </Card>
    </Section>
  );
}
