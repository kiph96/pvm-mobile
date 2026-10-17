import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { View } from 'react-native';

import type { AssignmentView, SwapView } from '@/api/types';
import { StatusBadge } from '@/components/domain';
import { useAction } from '@/components/toast';
import { Avatar, Button, Card, Empty, Loading, Row, Screen, Section, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi, useSession } from '@/state/session';
import { useTheme } from '@/theme';
import { ago, localDateOf, relativeDay, timeRange } from '@/utils/format';

export default function Swaps() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { session } = useSession();
  const swaps = useQuery({ queryKey: ['swaps', org, 'all'], queryFn: () => api.swaps() });
  const me = session?.userId;
  const all = swaps.data ?? [];
  const forMe = all.filter((s) => s.status === 'requested' && s.to.userId === me);
  const open = all.filter((s) => !forMe.includes(s) && (s.status === 'requested' || s.status === 'accepted'));
  const done = all.filter((s) => !forMe.includes(s) && !open.includes(s));

  return (
    <Screen title={t('swaps.title')} subtitle={t('swaps.subtitle')} onRefresh={swaps.refetch} refreshing={swaps.isRefetching}>
      {swaps.isLoading ? <Loading /> : all.length === 0 ? (
        <Empty icon="swap-horizontal" title={t('swaps.none')} message={t('swaps.noneMsg')} />
      ) : (
        <>
          {forMe.length ? <Section title={t('swaps.askingYou')} style={{ marginTop: 0 }}>{forMe.map((s) => <SwapCard key={s.id} swap={s} />)}</Section> : null}
          {open.length ? <Section title={t('swaps.inProgress')}>{open.map((s) => <SwapCard key={s.id} swap={s} />)}</Section> : null}
          {done.length ? <Section title={t('swaps.history')}>{done.map((s) => <SwapCard key={s.id} swap={s} />)}</Section> : null}
        </>
      )}
    </Screen>
  );
}

function SwapCard({ swap }: { swap: SwapView }) {
  const api = useApi();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { session } = useSession();
  const [run, busy] = useAction();
  const iAsked = swap.from.userId === session?.userId;
  const other = iAsked ? swap.to : swap.from;
  const mine = iAsked ? swap.from : swap.to;
  const label = (a: AssignmentView) => `${relativeDay(localDateOf(a.startsAt))} · ${timeRange(a.startsAt, a.endsAt)}`;
  return (
    <Card style={{ gap: 12 }}>
      <Row>
        <Avatar name={other.displayName} size={36} />
        <View style={{ flex: 1 }}>
          <Txt variant="subheading">{iAsked ? t('swaps.youTo', { name: other.displayName }) : t('swaps.toYou', { name: other.displayName })}</Txt>
          <Txt variant="small" muted>{swap.status === 'accepted' ? t('swaps.waitingManager') : ago(swap.acceptedAt ?? swap.decidedAt ?? swap.expiresAt)}</Txt>
        </View>
        <StatusBadge status={swap.status} />
      </Row>
      <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 12, gap: 6 }}>
        <Row gap={8}><Txt variant="small" muted style={{ width: 80 }}>{t('swaps.give')}</Txt><Txt variant="small" style={{ fontWeight: '700', flex: 1 }}>{label(mine)}</Txt></Row>
        <Row gap={8}><Txt variant="small" muted style={{ width: 80 }}>{t('swaps.get')}</Txt><Txt variant="small" style={{ fontWeight: '700', flex: 1 }}>{label(other)}</Txt></Row>
      </View>
      {swap.status === 'requested' && !iAsked ? (
        <Row gap={8}>
          <Button small title={t('swaps.accept')} icon="checkmark" style={{ flex: 1 }} loading={busy === 'a'}
            onPress={() => run('a', () => api.swapAction(swap.id, 'accept'), (r) => r.status === 'approved' ? t('swaps.swapped') : t('swaps.acceptedWait'))} />
          <Button small title={t('common.decline')} variant="secondary" style={{ flex: 1 }} loading={busy === 'd'}
            onPress={() => run('d', () => api.swapAction(swap.id, 'decline'), t('swaps.declined'))} />
        </Row>
      ) : (swap.status === 'requested' || swap.status === 'accepted') && iAsked ? (
        <Button small title={t('swaps.cancelSwap')} variant="ghost" loading={busy === 'c'} onPress={() => run('c', () => api.swapAction(swap.id, 'cancel'), t('swaps.cancelled'))} />
      ) : null}
    </Card>
  );
}
