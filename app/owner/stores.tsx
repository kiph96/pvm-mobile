import { useQueries } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { MyOrganization, StoreView } from '@/api/types';
import { useSwitchBusiness } from '@/components/businessSwitcher';
import { BUSINESS_TYPES, BUSINESS_TYPE_ICON, isBusinessType, type BusinessType } from '@/components/businessType';
import { OpenStoreSheet } from '@/components/openStore';
import { useStores } from '@/components/domain';
import { Badge, Card, Empty, IconBubble, IconButton, Loading, Row, Screen, Txt } from '@/components/ui';
import { tv, useI18n } from '@/i18n';
import { useAllStores, useOrgKey } from '@/state/queries';
import { useApi, useSession } from '@/state/session';
import { useTheme } from '@/theme';

export default function Stores() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { session } = useSession();
  const { stores, isLoading, refetch, isRefetching } = useStores();
  const all = useAllStores();
  const switchTo = useSwitchBusiness();
  // ?add=1 (from the dashboard checklist / Add staff) opens "New store" right away
  const { add } = useLocalSearchParams<{ add?: string }>();
  const [open, setOpen] = useState(add === '1');
  // store rules are read inside the Business you are in, so only its stores show them
  const policies = useQueries({ queries: stores.map((s) => ({ queryKey: ['policy', org, s.id], queryFn: () => api.policy(s.id) })) });
  const policyOf = (id: string) => policies[stores.findIndex((s) => s.id === id)]?.data;

  // every store of every Business you manage, grouped by business type (the type you are in first)
  const currentType = session?.workspace?.businessType;
  const byType = new Map<string, { store: StoreView; business: MyOrganization; current: boolean }[]>();
  for (const g of all.groups) {
    const type = isBusinessType(g.business.businessType) ? g.business.businessType : 'others';
    // closed stores are history only: not listed here
    for (const store of g.stores.filter((s) => s.status !== 'closed')) {
      byType.set(type, [...(byType.get(type) ?? []), { store, business: g.business, current: g.current }]);
    }
  }
  const types = [...byType.keys()].sort((a, b) =>
    Number(b === currentType) - Number(a === currentType) || BUSINESS_TYPES.indexOf(a as BusinessType) - BUSINESS_TYPES.indexOf(b as BusinessType));
  const loading = isLoading || all.loading;

  return (
    <Screen title={t('stores.title')} subtitle={t('stores.byTypeSubtitle', { n: all.total, k: types.length })}
      right={<IconButton icon="add" label={t('stores.add')} tone="primary" onPress={() => setOpen(true)} />}
      onRefresh={() => { refetch(); all.refetch(); }} refreshing={isRefetching}>
      {loading && types.length === 0 ? <Loading /> : types.length === 0 ? (
        <Empty icon="storefront-outline" title={t('stores.firstTitle')} message={t('stores.firstMsg')} action={t('stores.add')} onAction={() => setOpen(true)} />
      ) : types.map((type, i) => {
        const items = byType.get(type)!;
        const viewing = items.some((x) => x.current);
        return (
          <View key={type} style={{ gap: 10, marginTop: i === 0 ? 4 : 20 }}>
            <Row gap={10}>
              <IconBubble icon={BUSINESS_TYPE_ICON[type as BusinessType]} tone={viewing ? 'primary' : 'accent'} size={34} />
              <Txt variant="heading" style={{ flex: 1 }}>{t(`businessType.${type}`)}</Txt>
              {viewing ? <Badge label={t('switcher.here')} tone="success" icon="eye-outline" /> : null}
              <Badge label={String(items.length)} tone="neutral" icon="storefront-outline" />
            </Row>
            {items.map(({ store: s, business, current }) => {
              const p = current ? policyOf(s.id) : undefined;
              return (
                <Card key={s.id} style={{ gap: 12, borderWidth: current ? 0 : 1, borderColor: colors.border }}
                  onPress={async () => {
                    // a store of another Business: move into that Business first (its stores, staff and schedule)
                    if (!current) await switchTo(business);
                    router.push(`/store/${s.id}`);
                  }}>
                  <Row>
                    <IconBubble icon="storefront" tone={current ? 'accent' : 'neutral'} size={44} />
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
                  ) : !current ? <Txt variant="small" muted>{t('stores.tapToSwitch')}</Txt> : null}
                </Card>
              );
            })}
          </View>
        );
      })}
      <OpenStoreSheet visible={open} onClose={() => setOpen(false)} initialType={currentType} />
    </Screen>
  );
}
