import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import type { AccessKeyView, StoreView } from '@/api/types';
import { useI18n } from '@/i18n';
import { useApi } from '@/state/session';
import { useTheme } from '@/theme';
import { AccessKeyCard } from './accessKey';
import { StorePicker } from './domain';
import { useAction } from './toast';
import { Button, Row, Sheet, Txt } from './ui';

/** "Add staff": explains how people join and creates a shareable access key for the chosen store. */
export function InviteSheet({ visible, onClose, stores, initialStoreId }: {
  visible: boolean; onClose: () => void; stores: StoreView[]; initialStoreId: string | null;
}) {
  const api = useApi();
  const { t } = useI18n();
  const { colors } = useTheme();
  const [run, busy] = useAction();
  const [storeId, setStoreId] = useState(initialStoreId);
  const [key, setKey] = useState<AccessKeyView | null>(null);
  useEffect(() => {
    if (visible) {
      setStoreId(initialStoreId ?? stores[0]?.id ?? null);
      setKey(null);
    }
  }, [visible, initialStoreId, stores]);

  const create = async () => {
    if (!storeId) return;
    const k = await run('key', () => api.rotateAccessKey(storeId));
    if (k) setKey(k);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('invite.title')}>
      {stores.length === 0 ? (
        <>
          <Txt muted>{t('invite.noStore')}</Txt>
          <Button title={t('invite.createStore')} icon="storefront-outline" full
            onPress={() => { onClose(); router.push('/owner/stores?add=1'); }} />
        </>
      ) : (
        <>
          <StorePicker stores={stores} value={storeId} onChange={(id) => { setStoreId(id); setKey(null); }} />
          <View style={{ gap: 8 }}>
            <Txt variant="subheading">{t('invite.how')}</Txt>
            {[t('invite.step1'), t('invite.step2'), t('invite.step3')].map((text, i) => (
              <Row key={i} gap={10} style={{ alignItems: 'flex-start' }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt variant="tiny" color={colors.primary}>{i + 1}</Txt>
                </View>
                <Txt style={{ flex: 1 }}>{text}</Txt>
              </Row>
            ))}
          </View>
          {key ? <AccessKeyCard accessKey={key} /> : null}
          <Button title={key ? t('invite.newKey') : t('invite.create')} icon="key-outline" variant={key ? 'secondary' : 'primary'}
            full loading={busy === 'key'} onPress={create} />
          <Txt variant="small" muted>{t('invite.keyNote')}</Txt>
        </>
      )}
    </Sheet>
  );
}
