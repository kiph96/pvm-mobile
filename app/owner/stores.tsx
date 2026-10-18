import { useQueries } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { AccessKeyView } from '@/api/types';
import { AccessKeyCard } from '@/components/accessKey';
import { useBusinessSwitcher, useSwitchBusiness } from '@/components/businessSwitcher';
import { useStores } from '@/components/domain';
import { useAction } from '@/components/toast';
import { Badge, Button, Card, Chip, Empty, Field, IconBubble, IconButton, Loading, Row, Screen, Section, Sheet, Txt } from '@/components/ui';
import { tv, useI18n } from '@/i18n';
import { useAllStores, useOrgKey } from '@/state/queries';
import { useApi, useSession } from '@/state/session';

const TIMEZONES = ['Asia/Ho_Chi_Minh', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Tokyo'];

export default function Stores() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { session } = useSession();
  const { stores, isLoading, refetch, isRefetching } = useStores();
  const all = useAllStores();
  const others = all.groups.filter((g) => !g.current && g.stores.length > 0);
  const switchTo = useSwitchBusiness();
  const switcher = useBusinessSwitcher();
  // ?add=1 (from the dashboard checklist / Add staff) opens "New store" right away
  const { add } = useLocalSearchParams<{ add?: string }>();
  const [open, setOpen] = useState(add === '1');
  const policies = useQueries({ queries: stores.map((s) => ({ queryKey: ['policy', org, s.id], queryFn: () => api.policy(s.id) })) });

  return (
    <Screen title={t('stores.title')}
      subtitle={others.length ? t('stores.acrossBusinesses', { n: all.total, b: all.groups.filter((g) => g.stores.length).length }) : t('stores.locations', { n: stores.length })}
      right={<IconButton icon="add" label={t('stores.add')} tone="primary" onPress={() => setOpen(true)} />}
      onRefresh={() => { refetch(); all.refetch(); }} refreshing={isRefetching}>
      {/* where am I: the business these stores (and the other tabs) belong to */}
      <Card onPress={switcher.open} style={{ marginBottom: 12 }}>
        <Row>
          <IconBubble icon="business-outline" tone="primary" size={38} />
          <View style={{ flex: 1 }}>
            <Txt variant="small" muted>{t('stores.business')}</Txt>
            <Txt variant="subheading">{session?.workspace?.name}</Txt>
          </View>
          <Badge label={t('switcher.change')} tone="primary" icon="swap-horizontal" />
        </Row>
      </Card>
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
                  <Txt variant="small" muted numberOfLines={2}>{s.address ?? `${s.timezone} · ${s.currency}`}</Txt>
                </View>
                <Badge label={tv('storeStatus', s.status)} tone={s.status === 'active' ? 'success' : 'neutral'} />
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
      {others.map((g) => (
        <Section key={g.business.organizationId} title={g.business.name}
          action={t('switcher.open')} onAction={() => switchTo(g.business)}>
          {g.stores.map((s) => (
            <Card key={s.id} style={{ gap: 6 }} onPress={async () => { await switchTo(g.business); router.push(`/store/${s.id}`); }}>
              <Row>
                <IconBubble icon="storefront-outline" tone="neutral" size={40} />
                <View style={{ flex: 1 }}>
                  <Txt variant="subheading">{s.name}</Txt>
                  <Txt variant="small" muted>{t('stores.otherBusiness', { name: g.business.name })}</Txt>
                </View>
                <Badge label={tv('storeStatus', s.status)} tone={s.status === 'active' ? 'success' : 'neutral'} />
              </Row>
            </Card>
          ))}
        </Section>
      ))}
      <AddStoreSheet visible={open} onClose={() => setOpen(false)} />
      {switcher.sheet}
    </Screen>
  );
}

function AddStoreSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const api = useApi();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [tz, setTz] = useState(TIMEZONES[0]);
  const [key, setKey] = useState<AccessKeyView | null>(null);
  const business = useSession().session?.workspace?.name;
  const close = () => { setKey(null); setName(''); setAddress(''); onClose(); };
  return (
    <Sheet visible={visible} onClose={close} title={key ? t('stores.ready') : t('stores.newStore')}>
      {!key ? <Txt variant="small" muted>{t('stores.addsTo', { name: business ?? '' })}</Txt> : null}
      {key ? (
        <>
          <Txt muted>{t('stores.shareNote')}</Txt>
          <AccessKeyCard accessKey={key} />
          <Button title={t('common.done')} onPress={close} full />
        </>
      ) : (
        <>
          <Field label={t('stores.name')} value={name} onChangeText={setName} placeholder={t('stores.namePlaceholder')} autoFocus />
          <Field label={t('storeInfo.addressOptional')} value={address} onChangeText={setAddress} maxLength={300}
            placeholder={t('storeInfo.addressPlaceholder')} />
          <Txt variant="small" muted>{t('stores.timezone')}</Txt>
          <Row gap={8} wrap>{TIMEZONES.map((z) => <Chip key={z} label={z.split('/')[1].replace(/_/g, ' ')} selected={tz === z} onPress={() => setTz(z)} />)}</Row>
          <Txt variant="small" muted>{t('stores.defaults')}</Txt>
          <Button title={t('stores.create')} icon="checkmark" full loading={busy === 'create'} disabled={!name.trim()}
            onPress={async () => {
              const r = await run('create', () => api.createStore({ name: name.trim(), timezone: tz, currency: 'VND', address: address.trim() || null }), t('stores.created'));
              if (r) setKey(r.accessKey);
            }} />
        </>
      )}
    </Sheet>
  );
}
