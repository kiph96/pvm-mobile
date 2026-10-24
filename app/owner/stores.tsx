import { useQueries } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { StoreView } from '@/api/types';
import { BUSINESS_TYPES, BUSINESS_TYPE_ICON, isBusinessType, type BusinessType } from '@/components/businessType';
import { OpenStoreSheet } from '@/components/openStore';
import { useStores } from '@/components/domain';
import { Badge, Card, Empty, IconBubble, IconButton, Loading, Row, Screen, Txt } from '@/components/ui';
import { tv, useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';

export default function Stores() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { stores, isLoading, refetch, isRefetching } = useStores();
  // ?add=1 (from the dashboard checklist / Add staff) opens "New store" right away
  const { add } = useLocalSearchParams<{ add?: string }>();
  const [open, setOpen] = useState(add === '1');
  const policies = useQueries({ queries: stores.map((s) => ({ queryKey: ['policy', org, s.id], queryFn: () => api.policy(s.id) })) });
  const policyOf = (id: string) => policies[stores.findIndex((s) => s.id === id)]?.data;

  // open stores grouped by business type (closed stores are history only: not listed here)
  const byType = new Map<BusinessType, StoreView[]>();
  for (const st of stores.filter((x) => x.status !== 'closed')) {
    const type: BusinessType = isBusinessType(st.businessType) ? st.businessType : 'others';
    byType.set(type, [...(byType.get(type) ?? []), st]);
  }
  const types = BUSINESS_TYPES.filter((x) => byType.has(x));
  const total = types.reduce((n, x) => n + byType.get(x)!.length, 0);

  return (
    <Screen title={t('stores.title')} subtitle={t('stores.byTypeSubtitle', { n: total, k: types.length })}
      right={<IconButton icon="add" label={t('stores.add')} tone="primary" onPress={() => setOpen(true)} />}
      onRefresh={refetch} refreshing={isRefetching}>
      {isLoading && types.length === 0 ? <Loading /> : types.length === 0 ? (
        <Empty icon="storefront-outline" title={t('stores.firstTitle')} message={t('stores.firstMsg')} action={t('stores.add')} onAction={() => setOpen(true)} />
      ) : types.map((type, i) => {
        const items = byType.get(type)!;
        return (
          <View key={type} style={{ gap: 10, marginTop: i === 0 ? 4 : 20 }}>
            <Row gap={10}>
              <IconBubble icon={BUSINESS_TYPE_ICON[type]} tone="accent" size={34} />
              <Txt variant="heading" style={{ flex: 1 }}>{t(`businessType.${type}`)}</Txt>
              <Badge label={String(items.length)} tone="neutral" icon="storefront-outline" />
            </Row>
            {items.map((s) => {
              const p = policyOf(s.id);
              return (
                <Card key={s.id} style={{ gap: 12 }} onPress={() => router.push(`/store/${s.id}`)}>
                  <Row>
                    <IconBubble icon="storefront" tone="accent" size={44} />
                    <View style={{ flex: 1 }}>
                      <Txt variant="subheading">{s.name}</Txt>
                      <Txt variant="small" muted numberOfLines={2}>{s.address ?? `${s.timezone} · ${s.currency}`}</Txt>
                    </View>
                    <Badge label={tv('storeStatus', s.status)} tone={s.status === 'active' ? 'success' : 'neutral'} />
                  </Row>
                  {p ? (
                    <Row gap={8} wrap>
                      <Badge label={t('stores.upTo', { n: p.employeeLimit })} icon="people-outline" />
                      <Badge label={p.registrationMode === 'automatic' ? t('stores.auto') : t('stores.youApprove')} icon="hand-right-outline" />
                    </Row>
                  ) : null}
                </Card>
              );
            })}
          </View>
        );
      })}
      <OpenStoreSheet visible={open} onClose={() => setOpen(false)} />
    </Screen>
  );
}
