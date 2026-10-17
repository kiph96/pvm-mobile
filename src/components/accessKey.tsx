import React from 'react';
import { Platform, Share } from 'react-native';

import type { AccessKeyView } from '@/api/types';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { fullDate } from '@/utils/format';
import { useToast } from './toast';
import { Button, Card, Txt } from './ui';

/** Big, readable access key with a share/copy action. */
export function AccessKeyCard({ accessKey }: { accessKey: AccessKeyView }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const toast = useToast();
  const share = async () => {
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(accessKey.accessKey);
        toast(t('key.copied'));
      } catch {
        toast(accessKey.accessKey, 'info');
      }
      return;
    }
    await Share.share({ message: t('key.shareMsg', { key: accessKey.accessKey }) });
  };
  return (
    <Card tone="primary" style={{ alignItems: 'center', gap: 8 }}>
      <Txt variant="small" muted>{t('key.label', { n: accessKey.version })}</Txt>
      <Txt variant="title" center color={colors.primary} style={{ letterSpacing: 2, flexShrink: 1, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) }}>
        {accessKey.accessKey}
      </Txt>
      <Txt variant="small" muted>{t('key.validUntil', { date: fullDate(accessKey.expiresAt) })}</Txt>
      <Button small title={Platform.OS === 'web' ? t('key.copy') : t('key.share')} icon={Platform.OS === 'web' ? 'copy-outline' : 'share-outline'} onPress={share} />
    </Card>
  );
}
