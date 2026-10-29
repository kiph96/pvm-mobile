import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import type { PrivacyState } from '@/api/types';
import { Card, tap, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

const SECTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** The privacy notice the person agrees to, labelled with the server's policy version. */
export function PrivacyPolicy({ state }: { state: Pick<PrivacyState, 'controller' | 'contactEmail' | 'policyVersion'> }) {
  const { t } = useI18n();
  const params = { controller: state.controller, contact: state.contactEmail, version: state.policyVersion };
  return (
    <View style={{ gap: 10 }}>
      {SECTIONS.map((n) => (
        <Card key={n} style={{ gap: 6 }}>
          <Txt variant="subheading">{t(`privacy.s${n}Title`)}</Txt>
          <Txt variant="small">{t(`privacy.s${n}Body`, params)}</Txt>
        </Card>
      ))}
    </View>
  );
}

/** A consent box: never pre-ticked, one per purpose. */
export function ConsentCheck({ label, value, onChange, optional }: {
  label: string; value: boolean; onChange: (v: boolean) => void; optional?: boolean;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <Pressable onPress={() => { tap(); onChange(!value); }} accessibilityRole="checkbox" accessibilityLabel={label}
      accessibilityState={{ checked: value }} aria-checked={value}
      style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 2 }}>
      <Ionicons name={value ? 'checkbox' : 'square-outline'} size={24} color={value ? colors.primary : colors.textMuted} />
      <Txt style={{ flex: 1 }}>
        {label}
        {optional ? <Txt variant="small" muted>{`  (${t('privacy.optional')})`}</Txt> : null}
      </Txt>
    </Pressable>
  );
}

const SUMMARY = [
  { key: 'sumData', icon: 'person-outline' },
  { key: 'sumNotify', icon: 'notifications-outline' },
  { key: 'sumRights', icon: 'shield-checkmark-outline' },
] as const;

/** The short version shown first; the full notice is one tap away. */
export function PrivacySummary() {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <Card style={{ gap: 14 }}>
      {SUMMARY.map((x) => (
        <View key={x.key} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <Ionicons name={x.icon} size={20} color={colors.primary} style={{ marginTop: 2 }} />
          <Txt style={{ flex: 1 }}>{t(`privacy.${x.key}`)}</Txt>
        </View>
      ))}
    </Card>
  );
}
