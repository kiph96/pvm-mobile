import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { MyOrganization } from '@/api/types';
import { tv, useI18n } from '@/i18n';
import { useAllStores, useMyBusinesses } from '@/state/queries';
import { useApi, useSession } from '@/state/session';
import { Avatar, Badge, Button, ListItem, Loading, Row, Sheet, Txt } from './ui';

/** Moves the app into another business (each business's stores, staff and schedule are separate). */
export function useSwitchBusiness() {
  const { chooseWorkspace } = useSession();
  return async (b: MyOrganization) => {
    await chooseWorkspace({ id: b.organizationId, name: b.name, role: b.role });
    router.replace(b.role === 'owner' || b.role === 'admin' ? '/owner' : '/staff');
  };
}

/**
 * Header switcher: `open` shows a sheet with every business I belong to (store count for the ones I
 * manage) so changing business is one tap from the screen title.
 */
export function useBusinessSwitcher() {
  const [visible, setVisible] = useState(false);
  const sheet = <BusinessSheet visible={visible} onClose={() => setVisible(false)} />;
  return { open: () => setVisible(true), sheet };
}

function BusinessSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { session } = useSession();
  const api = useApi();
  const businesses = useMyBusinesses();
  const { groups } = useAllStores();
  const switchTo = useSwitchBusiness();
  const storeCount = (id: string) => groups.find((g) => g.business.organizationId === id)?.stores.filter((s) => s.status === 'active').length;
  return (
    <Sheet visible={visible} onClose={onClose} title={t('switcher.title')}>
      <Txt variant="small" muted>{t('switcher.note')}</Txt>
      {businesses.isLoading ? <Loading /> : (businesses.data ?? []).map((b) => {
        const current = b.organizationId === session?.workspace?.id;
        const n = storeCount(b.organizationId);
        return (
          <ListItem key={b.organizationId} title={b.name}
            subtitle={[tv('role', b.role), n != null ? t('switcher.stores', { n }) : null].filter(Boolean).join(' · ')}
            left={<Avatar name={b.name} uri={api.logoUrl(b.organizationId, b.logoVersion)} square />}
            right={current ? <Badge label={t('switcher.here')} tone="success" icon="checkmark" /> : undefined}
            onPress={async () => { onClose(); if (!current) await switchTo(b); }} />
        );
      })}
      <Row gap={8}>
        <View style={{ flex: 1 }}>
          <Button small variant="secondary" icon="key-outline" title={t('switcher.join')} full
            onPress={() => { onClose(); router.push('/join'); }} />
        </View>
        <View style={{ flex: 1 }}>
          <Button small variant="ghost" icon="grid-outline" title={t('switcher.all')} full
            onPress={() => { onClose(); router.push('/workspace'); }} />
        </View>
      </Row>
    </Sheet>
  );
}
