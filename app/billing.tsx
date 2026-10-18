import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';

import type { PlanTier, PlanView } from '@/api/types';
import { buy, manageUrl, purchasesAvailable, restore, storePrices } from '@/billing/purchases';
import { useAction, useToast } from '@/components/toast';
import { Badge, Button, Card, ErrorState, IconBubble, Loading, Row, Screen, Section, Stepper, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';
import { useTheme } from '@/theme';
import { errorMessage, fullDate, money } from '@/utils/format';

/**
 * The business's app plan: free (1 store, up to 3 people) or Pro for N stores, bought in the app
 * through the App Store / Google Play. Prices shown come from the store when it is reachable.
 */
export default function Billing() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const plan = useQuery({ queryKey: ['plan', org], queryFn: api.plan });
  const p = plan.data;
  return (
    <Screen onRefresh={plan.refetch} refreshing={plan.isRefetching}>
      {plan.isLoading ? <Loading /> : plan.error ? <ErrorState error={plan.error} onRetry={plan.refetch} /> : p ? (
        <>
          <CurrentPlan p={p} />
          <PriceGuide p={p} />
          <Choose p={p} />
        </>
      ) : null}
      <Txt variant="small" muted center style={{ marginTop: 16 }}>{t('plan.legal')}</Txt>
    </Screen>
  );
}

function CurrentPlan({ p }: { p: PlanView }) {
  const { t } = useI18n();
  const s = p.subscription;
  const pro = p.plan === 'pro';
  return (
    <Section title={t('plan.current')} style={{ marginTop: 12 }}>
      <Card style={{ gap: 12 }} tone={p.overLimit ? 'warning' : undefined}>
        <Row>
          <IconBubble icon={pro ? 'diamond' : 'leaf-outline'} tone={pro ? 'accent' : 'success'} size={46} />
          <View style={{ flex: 1 }}>
            <Txt variant="heading">{pro ? t('plan.proN', { n: p.storeLimit }) : t('plan.free')}</Txt>
            <Txt variant="small" muted>
              {t('plan.usage', { stores: p.stores, storeLimit: p.storeLimit, employees: p.employees })}
              {p.employeeLimit != null ? ` / ${p.employeeLimit}` : ` · ${t('plan.unlimitedStaff')}`}
            </Txt>
          </View>
          {s?.environment === 'sandbox' ? <Badge label={t('plan.test')} tone="info" /> : null}
        </Row>
        {s && pro ? (
          <Txt variant="small" muted>
            {s.willRenew ? t('plan.renews', { date: fullDate(s.expiresAt) }) : t('plan.endsOn', { date: fullDate(s.expiresAt) })}
            {s.store && s.provider !== 'dev' ? ` · ${storeName(s.store)}` : ''}
          </Txt>
        ) : s && !s.active ? (
          <Txt variant="small" muted>{t('plan.expired', { date: fullDate(s.expiresAt) })}</Txt>
        ) : null}
        {p.overLimit ? <Txt variant="small">{t('plan.overLimit')}</Txt> : null}
      </Card>
    </Section>
  );
}

function PriceGuide({ p }: { p: PlanView }) {
  const { t } = useI18n();
  return (
    <Section title={t('plan.pricing')}>
      <Card style={{ gap: 10 }}>
        <Row gap={10}>
          <Badge label={t('plan.free')} tone="success" />
          <Txt variant="small" style={{ flex: 1 }}>{t('plan.freeLine', { stores: p.freeMaxStores, people: p.freeMaxEmployees })}</Txt>
        </Row>
        <Row gap={10}>
          <Badge label="Pro" tone="accent" />
          <Txt variant="small" style={{ flex: 1 }}>
            {t('plan.proLine', { price: money(p.basePrice, p.currency), n: p.includedStores,
              extra: money(p.extraStorePrice, p.currency), from: p.includedStores + 1 })}
          </Txt>
        </Row>
      </Card>
    </Section>
  );
}

function Choose({ p }: { p: PlanView }) {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { colors } = useTheme();
  const toast = useToast();
  const [run, busy] = useAction();
  const s = p.subscription;
  const min = p.tiers[0]?.storeQuota ?? p.includedStores;
  const max = p.tiers.at(-1)?.storeQuota ?? min;
  const suggested = Math.min(max, Math.max(min, p.neededTier?.storeQuota ?? 0, p.plan === 'pro' ? p.storeLimit : 0, p.stores));
  const [n, setN] = useState(suggested);
  useEffect(() => setN(suggested), [suggested]);
  const tier: PlanTier | undefined = p.tiers.find((x) => x.storeQuota === n);
  const canBuy = purchasesAvailable();
  // the store's own localized price wins (Apple rounds to its price points)
  const prices = useQuery({
    queryKey: ['store-prices', org], enabled: canBuy, staleTime: 3_600_000,
    queryFn: () => storePrices(p.appUserId, p.tiers.map((x) => x.productId)),
  });
  const product = tier ? prices.data?.[tier.productId] : undefined;
  const current = p.plan === 'pro' && s?.productId === tier?.productId;
  const extra = Math.max(0, n - p.includedStores);

  const purchase = async () => {
    if (!tier) return;
    if (!product) {
      toast(prices.error ? errorMessage(prices.error) : t('plan.noProduct'), 'error');
      return;
    }
    await run('buy', async () => {
      const outcome = await buy(p.appUserId, product, s?.active ? s.productId : null);
      if (outcome === 'cancelled') return null;
      return api.syncPlan();
    }, (r) => (r ? t('plan.thanks') : t('plan.cancelled')));
  };

  return (
    <Section title={p.plan === 'pro' ? t('plan.change') : t('plan.upgrade')}>
      <Card style={{ gap: 14 }}>
        <Stepper label={t('plan.stores')} value={n} min={min} max={max} onChange={setN} />
        {tier ? (
          <>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View style={{ flexShrink: 1 }}>
                <Txt variant="small" muted>{t('plan.proN', { n })}</Txt>
                <Txt variant="small" muted>
                  {extra > 0
                    ? t('plan.breakdown', { base: money(p.basePrice, p.currency), extra, each: money(p.extraStorePrice, p.currency) })
                    : t('plan.includes', { n: p.includedStores })}
                </Txt>
              </View>
              <Txt variant="title" color={colors.primary}>
                {product?.priceString ?? money(tier.monthlyPrice, p.currency)}
                <Txt variant="small" muted>{t('plan.perMonth')}</Txt>
              </Txt>
            </Row>
            {n < p.stores ? <Txt variant="small" color={colors.warning}>{t('plan.tooSmall', { n: p.stores })}</Txt> : null}
          </>
        ) : null}
        {canBuy ? (
          <>
            <Button full icon={current ? 'checkmark-circle' : 'card-outline'} loading={busy === 'buy'} disabled={current || !tier}
              title={current ? t('plan.yourPlan') : p.plan === 'pro' ? t('plan.switch') : t('plan.subscribe')} onPress={purchase} />
            <Row gap={8}>
              <Button small variant="ghost" title={t('plan.restore')} icon="refresh" loading={busy === 'restore'} style={{ flex: 1 }}
                onPress={() => run('restore', async () => { await restore(p.appUserId); return api.syncPlan(); }, t('plan.restored'))} />
              {s?.provider === 'revenuecat' ? (
                <Button small variant="ghost" title={t('plan.manage')} icon="open-outline" style={{ flex: 1 }}
                  onPress={async () => { const url = await manageUrl(p.appUserId); if (url) Linking.openURL(url); }} />
              ) : null}
            </Row>
          </>
        ) : p.devPurchase ? (
          <>
            <Txt variant="small" muted>{t('plan.devNote')}</Txt>
            <Button full variant="secondary" icon="flask-outline" title={current ? t('plan.yourPlan') : t('plan.devBuy', { n })}
              loading={busy === 'dev'} disabled={!tier || current}
              onPress={() => run('dev', () => api.devPurchase(n), t('plan.thanks'))} />
          </>
        ) : (
          <Txt variant="small" muted>{Platform.OS === 'web' ? t('plan.webNote') : t('plan.buildNote')}</Txt>
        )}
      </Card>
    </Section>
  );
}

function storeName(store: string) {
  const s = store.toLowerCase();
  return s.includes('app_store') ? 'App Store' : s.includes('play') ? 'Google Play' : store;
}
