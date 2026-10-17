import React from 'react';

import { useI18n } from '@/i18n';
import { useThemePreference, type ThemePreference } from '@/theme';
import { Chip, Row, type IconName } from './ui';

const OPTIONS: { value: ThemePreference; icon: IconName }[] = [
  { value: 'system', icon: 'phone-portrait-outline' },
  { value: 'light', icon: 'sunny-outline' },
  { value: 'dark', icon: 'moon-outline' },
];

/** System / Light / Dark switch (remembered on this device). */
export function ThemePicker() {
  const { t } = useI18n();
  const { preference, setPreference } = useThemePreference();
  return (
    <Row gap={8} wrap>
      {OPTIONS.map((o) => (
        <Chip key={o.value} icon={o.icon} label={t(`theme.${o.value}`)} selected={preference === o.value}
          onPress={() => setPreference(o.value)} />
      ))}
    </Row>
  );
}
