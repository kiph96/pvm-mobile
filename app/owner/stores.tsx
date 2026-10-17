import { useQueries } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { AccessKeyView } from '@/api/types';
import { AccessKeyCard } from '@/components/accessKey';
import { useStores } from '@/components/domain';
import { useAction } from '@/components/toast';
import { Badge, Button, Card, Chip, Empty, Field, IconBubble, IconButton, Loading, Row, Screen, Sheet, Txt } from '@/components/ui';
import { tv, useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';

const TIMEZONES = ['Asia/Ho_Chi_Minh', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Tokyo'];

export default function Stores() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { stores, isLoading, refetch, isRefetching } = useStores();
  // ?add=1 (from the dashboard checklist / Add staff) opens "New store" right away
  const { add } = useLocalSearchParams<{ add?: string }>();
  const [open, setOpen] = useState(add === '1');
  const policies = useQueries({ queries: stores.map((s) => ({ queryKey: ['policy', org, s.id], queryFn: () => api.policy(s.id) })) });

  return (
    <Screen title={t('stores.title')} subtitle={t('stores.locations', { n: stores.length })}
      right={<IconButton icon="add" label={t('stores.add')} tone="primary" onPress={() => setOpen(true)} />}
      onRefresh={refetch} refreshing={isRefetching}>
      <View style={{ gap: 12 }}>
        {isLoading ? <Loading /> : stores.length === 0 ? (
          <Empty icon="storefront-outline" title={t('stores.firstTitle')} message={t('stores.firstMsg')} action={t('stores.add')} onAction={() => setOpen(true)} />
        ) : stores.map((s, i) => {
          const p = policies[i]?.data;
          return (
            <Card key={s.id} onPress={() => router.push(`/store/${s.id}`)} style={{ gap: 12 }}>
              <Row>
                <IconBubble icon="storefront" tone="accent" size={46} />
                <View style={{ flex: 1 }}>
                  <Txt variant="subheading">{s.name}</Txt>
                  <Txt variant="small" muted>{s.timezone} · {s.currency}</Txt>
                </View>
                <Badge label={tv('status', s.status)} tone={s.status === 'active' ? 'success' : 'neutral'} />
              </Row>
              {p ? (
                <Row gap={8} wrap>
                  <Badge label={t('stores.upTo', { n: p.employeeLimit })} icon="people-outline" />
                  <Badge label={t('stores.perShift', { min: p.minStaff, opt: p.optimalStaff, max: p.maxStaff })} icon="layers-outline" />
                  <Badge label={p.registrationMode === 'automatic' ? t('stores.auto') : t('stores.youApprove')} icon="hand-right-outline" />
                </Row>
              ) : null}
            </Card>
          );
        })}
      </View>
      <AddStoreSheet visible={open} onClose={() => setOpen(false)} />
    </Screen>
  );
}

function AddStoreSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const api = useApi();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const [name, setName] = useState('');
  const [tz, setTz] = useState(TIMEZONES[0]);
  const [key, setKey] = useState<AccessKeyView | null>(null);
  const close = () => { setKey(null); setName(''); onClose(); };
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
          <Field label={t('stores.name')} value={name} onChangeText={setName} placeholder="K Coffee - Quận 7" autoFocus />
          <Txt variant="small" muted>{t('stores.timezone')}</Txt>
          <Row gap={8} wrap>{TIMEZONES.map((z) => <Chip key={z} label={z.split('/')[1].replace('_', ' ')} selected={tz === z} onPress={() => setTz(z)} />)}</Row>
          <Txt variant="small" muted>{t('stores.defaults')}</Txt>
          <Button title={t('stores.create')} icon="checkmark" full loading={busy === 'create'} disabled={!name.trim()}
            onPress={async () => {
              const r = await run('create', () => api.createStore({ name: name.trim(), timezone: tz, currency: 'VND' }), t('stores.created'));
              if (r) setKey(r.accessKey);
            }} />
        </>
      )}
    </Sheet>
  );
}
