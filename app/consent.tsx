import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, View } from 'react-native';

import { ConsentCheck, PrivacyPolicy, PrivacySummary } from '@/components/privacyPolicy';
import { useAction } from '@/components/toast';
import { Button, Card, confirm, ErrorState, Loading, Screen, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { usePrivacy } from '@/state/queries';
import { useApi, useSession } from '@/state/session';

/**
 * Asked before first use, and again when the policy version changes or after a withdrawal: the privacy notice and
 * unticked boxes. Service (including the transfer abroad) and age are required to use PVM; news is optional.
 */
export default function Consent() {
  const api = useApi();
  const qc = useQueryClient();
  const { t } = useI18n();
  const { session, signOut } = useSession();
  const [run, busy] = useAction();
  const privacy = usePrivacy();
  const [service, setService] = useState(false);
  const [age, setAge] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [full, setFull] = useState(false);
  const ready = service && age;

  if (privacy.error) return <Screen title={t('privacy.menu')}><ErrorState error={privacy.error} onRetry={privacy.refetch} /></Screen>;
  if (!privacy.data) return <Screen title={t('privacy.menu')}><Loading /></Screen>;
  const state = privacy.data;

  const accept = async () => {
    const r = await run('accept', () => api.savePrivacy({
      // the service box includes the transfer abroad, so one tick records both
      policyVersion: state.policyVersion, service, crossBorder: service, ageConfirmed: age, marketing, client: `app-${Platform.OS}`,
    }), t('privacy.saved'));
    if (r) {
      qc.setQueryData(['privacy', session?.userId], r);
      router.replace('/');
    }
  };
  const decline = async () => {
    if (await confirm(t('privacy.declineTitle'), t('privacy.declineMsg'), t('privacy.declineConfirm'), true)) await signOut();
  };

  return (
    <Screen title={t('privacy.menu')}>
      <Txt muted style={{ marginBottom: 12 }}>{t('privacy.intro')}</Txt>
      <PrivacySummary />
      <Button small variant="ghost" icon={full ? 'chevron-up' : 'document-text-outline'} style={{ marginVertical: 6 }}
        title={full ? t('privacy.readLess') : t('privacy.fullPolicy')} onPress={() => setFull((x) => !x)} />
      {full ? <View style={{ marginBottom: 12 }}><PrivacyPolicy state={state} /></View> : null}

      <Card style={{ gap: 14 }}>
        <ConsentCheck label={t('privacy.service')} value={service} onChange={setService} />
        <ConsentCheck label={t('privacy.age')} value={age} onChange={setAge} />
        <ConsentCheck optional label={t('privacy.marketing')} value={marketing} onChange={setMarketing} />
      </Card>

      <View style={{ gap: 10, marginTop: 16, marginBottom: 24 }}>
        {!ready ? <Txt variant="small" muted center>{t('privacy.needRequired')}</Txt> : null}
        <Button title={t('privacy.accept')} icon="checkmark" full disabled={!ready} loading={busy === 'accept'} onPress={accept} />
        <Button title={t('privacy.decline')} variant="ghost" full onPress={decline} />
      </View>
    </Screen>
  );
}
