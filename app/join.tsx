import { router } from 'expo-router';
import React, { useState } from 'react';

import type { EnrollmentView } from '@/api/types';
import { useAction } from '@/components/toast';
import { Button, Card, Field, IconBubble, Row, Screen, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useApi, useSession } from '@/state/session';

/** Employee enters the store access key; the owner then approves the request. */
export default function Join() {
  const api = useApi();
  const { t } = useI18n();
  const { session } = useSession();
  const [run, busy] = useAction();
  const [key, setKey] = useState('');
  const [result, setResult] = useState<EnrollmentView | null>(null);

  const submit = async () => {
    const r = await run('join', () => api.joinStore(key.trim()));
    if (r) setResult(r);
  };

  return (
    <Screen>
      {result ? (
        <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 32, marginTop: 24 }}>
          <IconBubble icon="paper-plane-outline" tone="success" size={64} />
          <Txt variant="heading" center>{t('join.sentTitle')}</Txt>
          <Txt muted center>{t('join.sentMsg')}</Txt>
          <Button title={t('common.done')} onPress={() => router.back()} />
        </Card>
      ) : (
        <Card style={{ gap: 16, marginTop: 24 }}>
          <Row>
            <IconBubble icon="key-outline" tone="primary" size={48} />
            <Txt muted style={{ flex: 1 }}>{t('join.intro')}</Txt>
          </Row>
          <Field label={t('join.key')} value={key} onChangeText={(v) => setKey(v.toUpperCase())} autoCapitalize="characters"
            autoCorrect={false} placeholder="K7QM-4XRD-9TPW" autoFocus
            hint={session?.mode === 'demo' ? t('join.demoKeys') : undefined} />
          <Button title={t('join.send')} icon="paper-plane-outline" onPress={submit} loading={busy === 'join'} disabled={key.trim().length < 4} full />
        </Card>
      )}
    </Screen>
  );
}
