import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import type { DataRequestKind } from '@/api/types';
import { PrivacyPolicy } from '@/components/privacyPolicy';
import { useAction } from '@/components/toast';
import { Badge, Button, Card, confirm, ErrorState, IconBubble, ListItem, Loading, Row, Screen, Section, Toggle, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { usePrivacy } from '@/state/queries';
import { useApi, useSession } from '@/state/session';
import { dayLabel, localDateOf } from '@/utils/format';

const TONE = { open: 'warning', done: 'success', rejected: 'danger' } as const;

/** "Quyền riêng tư": what the person agreed to, the optional news consent, and requests about their data. */
export default function Privacy() {
  const api = useApi();
  const { t } = useI18n();
  const { signOut } = useSession();
  const [run, busy] = useAction();
  const privacy = usePrivacy();
  const [showPolicy, setShowPolicy] = useState(false);

  if (privacy.error) return <Screen><ErrorState error={privacy.error} onRetry={privacy.refetch} /></Screen>;
  if (!privacy.data) return <Screen><Loading /></Screen>;
  const state = privacy.data;
  const consent = state.consent;
  const open = (kind: DataRequestKind) => state.requests.some((r) => r.kind === kind && r.status === 'open');

  const setMarketing = (marketing: boolean) => run('marketing', () => api.savePrivacy({
    policyVersion: state.policyVersion, service: true, crossBorder: true, ageConfirmed: true, marketing, client: 'app-settings',
  }), t('privacy.saved'));
  const request = async (kind: DataRequestKind) => {
    if (kind === 'delete' && !(await confirm(t('privacy.deleteTitle'), t('privacy.deleteMsg'), t('privacy.delete'), true))) return;
    if (kind === 'withdraw' && !(await confirm(t('privacy.withdrawTitle'), t('privacy.withdrawMsg'), t('privacy.withdraw'), true))) return;
    const r = await run(kind, () => api.privacyRequest(kind), t('privacy.requestSent'));
    if (r && kind === 'withdraw') await signOut();
  };

  return (
    <Screen onRefresh={privacy.refetch} refreshing={false}>
      <Card style={{ gap: 12 }}>
        <Row>
          <IconBubble icon="shield-checkmark-outline" tone="success" />
          <Txt style={{ flex: 1 }}>
            {consent ? t('privacy.agreedOn', { date: dayLabel(localDateOf(consent.at)), version: consent.policyVersion }) : '–'}
          </Txt>
        </Row>
        <Toggle label={t('privacy.marketing')} hint={t('privacy.marketingHint')} value={!!consent?.marketing}
          onChange={(v) => { if (busy !== 'marketing') setMarketing(v); }} />
        <Button small variant="ghost" icon={showPolicy ? 'chevron-up' : 'document-text-outline'}
          title={showPolicy ? t('privacy.readLess') : t('privacy.viewPolicy')} onPress={() => setShowPolicy((x) => !x)} />
      </Card>
      {showPolicy ? <View style={{ marginTop: 12 }}><PrivacyPolicy state={state} /></View> : null}

      <Section title={t('privacy.rightsTitle')}>
        <Txt variant="small" muted>{t('privacy.rightsIntro')}</Txt>
        {(['export', 'delete', 'withdraw'] as const).map((kind) => (
          <Card key={kind} style={{ gap: 10 }}>
            <View>
              <Txt variant="subheading">{t(`privacy.${kind}`)}</Txt>
              <Txt variant="small" muted>{t(`privacy.${kind}Hint`)}</Txt>
            </View>
            <Button small variant={kind === 'export' ? 'secondary' : 'danger'} title={t(`privacy.${kind}`)}
              disabled={open(kind)} loading={busy === kind} onPress={() => request(kind)} />
          </Card>
        ))}
      </Section>

      {state.requests.length ? (
        <Section title={t('privacy.requests')}>
          {state.requests.map((r) => (
            <ListItem key={r.id} title={t(`privacy.kind_${r.kind}`)}
              subtitle={[dayLabel(localDateOf(r.createdAt)), r.handledNote].filter(Boolean).join(' · ')}
              right={<Badge label={t(`privacy.status_${r.status}`)} tone={TONE[r.status]} />} />
          ))}
        </Section>
      ) : null}

      <Pressable onPress={() => Linking.openURL(`mailto:${state.contactEmail}`)} style={{ marginTop: 16, marginBottom: 24 }}>
        <Txt variant="small" muted center>{t('privacy.contact', { contact: state.contactEmail })}</Txt>
      </Pressable>
    </Screen>
  );
}
