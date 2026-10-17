import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ApiError, createAuthApi, createHttpApi } from '@/api/http';
import { DEMO_USERS } from '@/api/mock';
import { SocialButtons } from '@/auth/SocialButtons';
import { LanguagePicker } from '@/components/language';
import { ThemePicker } from '@/components/themePicker';
import { useToast } from '@/components/toast';
import { Avatar, Badge, Button, Card, Field, Gap, IconBubble, ListItem, Row, Screen, Section, Segmented, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { DEFAULT_SERVER, useSession } from '@/state/session';
import { useTheme } from '@/theme';
import { errorMessage } from '@/utils/format';

export default function SignIn() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { signIn, signInWithTokens } = useSession();
  const toast = useToast();
  const [showServer, setShowServer] = useState(false);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER);
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const enterDemo = async (u: (typeof DEMO_USERS)[number]) => {
    await signIn({ mode: 'demo', serverUrl, userId: u.id, displayName: u.displayName });
    router.replace('/workspace');
  };

  /**
   * Development server sign-in (pvm.auth.dev-login): an existing user id, a seeded person or a
   * brand-new account. Like Google/Facebook it ends with real API tokens from /api/auth.
   */
  const connect = async (existingId?: string) => {
    const key = existingId ?? 'connect';
    setBusy(key);
    try {
      let id = (existingId ?? userId).trim();
      if (!existingId && mode === 'new') {
        const created = await createHttpApi(serverUrl, () => ({ userId: null, organizationId: null })).createUser(name.trim(), email.trim());
        id = created.id;
      }
      const tokens = await createAuthApi(serverUrl).dev(id);
      await signInWithTokens(serverUrl, 'dev', tokens);
      router.replace('/workspace');
    } catch (e) {
      toast(e instanceof ApiError && e.status === 403 ? t('auth.devOnly') : errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center', paddingTop: 36, paddingBottom: 8, gap: 10 }}>
        <View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="cafe" size={44} color="#fff" />
        </View>
        <Txt variant="title" center>PVM</Txt>
        <Txt muted center style={{ maxWidth: 320 }}>{t('signIn.tagline')}</Txt>
        <LanguagePicker />
        <ThemePicker />
      </View>

      <Gap size={20} />
      <Card style={{ gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }} wrap>
          <Txt variant="subheading">{t('signIn.title')}</Txt>
          <Badge label={t('signIn.googleSoon')} tone="info" icon="shield-checkmark-outline" />
        </Row>
        <Txt variant="small" muted>{t('signIn.googleNote')}</Txt>
        <SocialButtons serverUrl={serverUrl} onSignedIn={() => router.replace('/workspace')} />
      </Card>

      <Section title={t('signIn.demoTitle')}>
        <Txt variant="small" muted>{t('signIn.demoNote')}</Txt>
        {DEMO_USERS.map((u) => (
          <ListItem key={u.id} title={u.displayName} subtitle={t(`signIn.${u.hintKey}`)} left={<Avatar name={u.displayName} />} onPress={() => enterDemo(u)} />
        ))}
      </Section>

      <Section title={t('signIn.serverTitle')} action={showServer ? t('common.hide') : t('common.show')} onAction={() => setShowServer((v) => !v)}>
        {showServer ? (
          <>
            <Card style={{ gap: 14 }}>
              <Row gap={10}>
                <IconBubble icon="server-outline" tone="info" size={36} />
                <Txt variant="small" muted style={{ flex: 1 }}>{t('signIn.serverNote')}</Txt>
              </Row>
              <Field label={t('signIn.serverAddress')} value={serverUrl} onChangeText={setServerUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
              <Segmented value={mode} onChange={setMode} options={[{ value: 'existing', label: t('signIn.haveId') }, { value: 'new', label: t('signIn.newAccount') }]} />
              {mode === 'existing' ? (
                <Field label={t('signIn.userId')} value={userId} onChangeText={setUserId} autoCapitalize="none" autoCorrect={false}
                  placeholder="10000000-0000-4000-8000-000000000001" />
              ) : (
                <>
                  <Field label={t('signIn.yourName')} value={name} onChangeText={setName} placeholder="Nguyễn Văn A" />
                  <Field label={t('signIn.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
                </>
              )}
              <Button title={mode === 'new' ? t('signIn.createAccount') : t('signIn.connect')} icon="log-in-outline" onPress={() => connect()}
                loading={busy === 'connect'} disabled={mode === 'new' ? !name.trim() : !userId.trim()} full />
            </Card>
            <Txt variant="subheading" style={{ marginTop: 8 }}>{t('signIn.seeded')}</Txt>
            <Txt variant="small" muted>{t('signIn.seededNote')}</Txt>
            {DEMO_USERS.map((u) => (
              <ListItem key={`s${u.id}`} title={u.displayName} subtitle={t(`signIn.${u.hintKey}`)} left={<Avatar name={u.displayName} size={36} />}
                right={busy === u.id ? <Badge label={t('common.loading')} tone="info" /> : undefined} onPress={() => connect(u.id)} />
            ))}
          </>
        ) : (
          <Pressable onPress={() => setShowServer(true)}>
            <Txt variant="small" muted>{t('signIn.serverHint')}</Txt>
          </Pressable>
        )}
      </Section>
    </Screen>
  );
}
