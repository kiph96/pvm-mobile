import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { DEMO_USERS } from '@/api/mock';
import { SocialButtons } from '@/auth/SocialButtons';
import { Avatar, Badge, Card, Gap, ListItem, Row, Screen, Section, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { DEFAULT_SERVER, useSession } from '@/state/session';
import { useTheme } from '@/theme';

export default function SignIn() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { ready, session, signIn } = useSession();

  const enterDemo = async (u: (typeof DEMO_USERS)[number]) => {
    await signIn({ mode: 'demo', serverUrl: DEFAULT_SERVER, userId: u.id, displayName: u.displayName });
    router.replace('/workspace');
  };

  // already signed in (e.g. reopened the sign-in page): straight into the app
  if (ready && session) return <Redirect href="/" />;

  return (
    <Screen>
      <View style={{ alignItems: 'center', paddingTop: 36, paddingBottom: 8, gap: 10 }}>
        <View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="cafe" size={44} color="#fff" />
        </View>
        <Txt variant="title" center>PVM</Txt>
        <Txt muted center style={{ maxWidth: 320 }}>{t('signIn.tagline')}</Txt>
      </View>

      <Gap size={20} />
      <Card style={{ gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }} wrap>
          <Txt variant="subheading">{t('signIn.title')}</Txt>
          <Badge label={t('signIn.googleSoon')} tone="info" icon="shield-checkmark-outline" />
        </Row>
        <Txt variant="small" muted>{t('signIn.googleNote')}</Txt>
        <SocialButtons serverUrl={DEFAULT_SERVER} onSignedIn={() => router.replace('/workspace')} />
      </Card>

      <Section title={t('signIn.demoTitle')}>
        <Txt variant="small" muted>{t('signIn.demoNote')}</Txt>
        {DEMO_USERS.map((u) => (
          <ListItem key={u.id} title={u.displayName} subtitle={t(`signIn.${u.hintKey}`)} left={<Avatar name={u.displayName} />} onPress={() => enterDemo(u)} />
        ))}
      </Section>
    </Screen>
  );
}
