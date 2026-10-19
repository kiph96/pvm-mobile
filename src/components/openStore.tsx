import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import type { AccessKeyView, StoreOpened } from '@/api/types';
import { useI18n } from '@/i18n';
import { useApi, useSession } from '@/state/session';
import { AccessKeyCard } from './accessKey';
import { BUSINESS_TYPES, BUSINESS_TYPE_ICON, isBusinessType, type BusinessType } from './businessType';
import { useAction } from './toast';
import { Button, Chip, Field, Row, Sheet, Txt } from './ui';

const TIMEZONES = ['Asia/Ho_Chi_Minh', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Tokyo'];

/**
 * Open a new store of one of the system business types. The first store also creates the owner's account,
 * and the app moves into it so the new store is right there.
 */
export function OpenStoreSheet({ visible, onClose, initialType }: { visible: boolean; onClose: () => void; initialType?: string | null }) {
  const api = useApi();
  const { t } = useI18n();
  const { session, chooseWorkspace } = useSession();
  const [run, busy] = useAction();
  const [type, setType] = useState<BusinessType | null>(isBusinessType(initialType) ? initialType : null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [tz, setTz] = useState(TIMEZONES[0]);
  const [opened, setOpened] = useState<StoreOpened | null>(null);
  useEffect(() => {
    if (visible) setType(isBusinessType(initialType) ? initialType : null);
  }, [visible, initialType]);

  const close = async () => {
    const r = opened;
    setOpened(null);
    setName('');
    setAddress('');
    onClose();
    if (r && session?.workspace?.id !== r.organizationId) {
      // the first store: work in the owner's own account from now on
      await chooseWorkspace({ id: r.organizationId, name: session?.displayName ?? '', role: 'owner' });
      router.replace('/owner/stores');
    }
  };

  const key: AccessKeyView | null = opened?.accessKey ?? null;
  return (
    <Sheet visible={visible} onClose={close} title={key ? t('stores.ready') : t('stores.newStore')}>
      {key ? (
        <>
          <Txt muted>{t('stores.shareNote')}</Txt>
          <AccessKeyCard accessKey={key} />
          <Button title={t('common.done')} onPress={close} full />
        </>
      ) : (
        <>
          <Txt variant="small" muted>{t('openStore.typeLabel')}</Txt>
          <Row gap={8} wrap>
            {BUSINESS_TYPES.map((bt) => (
              <Chip key={bt} icon={BUSINESS_TYPE_ICON[bt]} label={t(`businessType.${bt}`)} selected={type === bt} onPress={() => setType(bt)} />
            ))}
          </Row>
          <View style={{ gap: 14 }}>
            <Field label={t('stores.name')} value={name} onChangeText={setName} placeholder={t('stores.namePlaceholder')} />
            <Field label={t('storeInfo.addressOptional')} value={address} onChangeText={setAddress} maxLength={300}
              placeholder={t('storeInfo.addressPlaceholder')} />
          </View>
          <Txt variant="small" muted>{t('stores.timezone')}</Txt>
          <Row gap={8} wrap>{TIMEZONES.map((z) => <Chip key={z} label={z.split('/')[1].replace(/_/g, ' ')} selected={tz === z} onPress={() => setTz(z)} />)}</Row>
          <Txt variant="small" muted>{t('stores.defaults')}</Txt>
          <Button title={t('stores.create')} icon="checkmark" full loading={busy === 'open'} disabled={!type || !name.trim()}
            onPress={async () => {
              const r = await run('open', () => api.openStore({ businessType: type!, name: name.trim(), timezone: tz, currency: 'VND',
                address: address.trim() || null }), t('stores.created'));
              if (r) setOpened(r);
            }} />
        </>
      )}
    </Sheet>
  );
}
