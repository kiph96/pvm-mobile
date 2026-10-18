import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { useSignOut } from '@/state/useSignOut';
import { businessIcon, businessName } from './businessType';
import { LanguagePicker } from './language';
import { ThemePicker } from './themePicker';
import { Avatar, Badge, Card, IconBubble, ListItem, Row, Txt, type IconName, type Tone } from './ui';

export interface MenuItem { title: string; subtitle?: string; icon: IconName; tone?: Tone; href?: string; onPress?: () => void; badge?: number }

/** Profile header + menu + language + switch/sign-out, used by both the owner and staff "More/Me" tabs. */
export function ProfileMenu({ items }: { items: MenuItem[] }) {
  const { t } = useI18n();
  const { session, chooseWorkspace } = useSession();
  const signOut = useSignOut();
  if (!session) return null;
  return (
    <View style={{ gap: 10 }}>
      <Card style={{ marginBottom: 8 }}>
        <Row>
          <Avatar name={session.displayName} size={56} />
          <View style={{ flex: 1, gap: 4 }}>
            <Txt variant="heading">{session.displayName}</Txt>
            <Row gap={6} wrap>
              <Badge label={businessName(session.workspace)} tone="accent" icon={businessIcon(session.workspace?.businessType)} />
              {session.mode === 'demo' ? <Badge label={t('more.demo')} tone="info" /> : null}
              {session.method === 'google' ? <Badge label="Google" tone="info" icon="logo-google" />
                : session.method === 'facebook' ? <Badge label="Facebook" tone="info" icon="logo-facebook" /> : null}
            </Row>
          </View>
        </Row>
      </Card>
      {items.map((it) => (
        <ListItem key={it.title} title={it.title} subtitle={it.subtitle} left={<IconBubble icon={it.icon} tone={it.tone ?? 'primary'} size={38} />}
          right={it.badge ? <Badge label={String(it.badge)} tone="danger" /> : undefined}
          onPress={it.onPress ?? (() => router.push(it.href as never))} />
      ))}
      <Card style={{ gap: 10 }}>
        <Row gap={10}>
          <IconBubble icon="language-outline" tone="info" size={38} />
          <Txt variant="subheading">{t('common.language')}</Txt>
        </Row>
        <LanguagePicker />
      </Card>
      <Card style={{ gap: 10 }}>
        <Row gap={10}>
          <IconBubble icon="contrast-outline" tone="accent" size={38} />
          <Txt variant="subheading">{t('theme.title')}</Txt>
        </Row>
        <ThemePicker />
      </Card>
      <ListItem title={t('more.switch')} subtitle={t('more.switchSub')} left={<IconBubble icon="swap-horizontal-outline" tone="info" size={38} />}
        onPress={async () => { await chooseWorkspace(null); router.replace('/workspace'); }} />
      <ListItem title={t('more.signOut')} left={<IconBubble icon="log-out-outline" tone="danger" size={38} />} chevron={false}
        onPress={signOut} />
      <Txt variant="small" muted center style={{ marginTop: 16 }}>{t('more.version')}</Txt>
    </View>
  );
}
