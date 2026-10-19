import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';

import type { MyOrganization } from '@/api/types';
import { accountName } from '@/components/accountSwitcher';
import { OpenStoreSheet } from '@/components/openStore';
import { useAction } from '@/components/toast';
import { Avatar, Badge, Button, Card, Empty, ErrorState, Field, IconBubble, IconButton, ListItem, Loading, Row, Screen, Section, Sheet, Txt } from '@/components/ui';
import { tv, useI18n } from '@/i18n';
import { greetingName, useApi, useSession } from '@/state/session';
import { useSignOut } from '@/state/useSignOut';
import { ago } from '@/utils/format';

/**
 * Choose where to work: your own stores, or an owner you work for (someone may work for several).
 * With nothing chosen yet and only one place to work, it opens that place straight away; opened from inside
 * the app it keeps the current place and offers a way back to it.
 */
export default function WorkspacePicker() {
  const api = useApi();
  const { t } = useI18n();
  const { session, chooseWorkspace } = useSession();
  const signOut = useSignOut();
  const [run, busy] = useAction();
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();
  const orgs = useQuery({ queryKey: ['my-orgs', session?.userId], queryFn: api.myOrganizations, enabled: !!session });
  // join requests not yet turned into an account here; poll while one is waiting so approval shows up by itself
  const requests = useQuery({
    queryKey: ['my-enrollments', session?.userId], queryFn: api.myEnrollments, enabled: !!session,
    refetchInterval: (q) => (q.state.data ?? []).some((r) => r.status === 'pending') ? 15_000 : false,
  });
  const pendingCount = (requests.data ?? []).filter((r) => r.status === 'pending').length;
  const lastPending = useRef(pendingCount);
  useEffect(() => {
    if (pendingCount < lastPending.current) qc.invalidateQueries({ queryKey: ['my-orgs'] });
    lastPending.current = pendingCount;
  }, [pendingCount, qc]);
  const memberOf = new Set((orgs.data ?? []).map((o) => o.organizationId));
  const shownRequests = (requests.data ?? []).filter((r) => r.status === 'pending' || (r.status === 'rejected' && !memberOf.has(r.organizationId)));
  const refresh = () => { orgs.refetch(); requests.refetch(); };

  const open = async (o: MyOrganization) => {
    await chooseWorkspace({ id: o.organizationId, name: o.ownerName ?? '', role: o.role });
    router.replace(o.role === 'owner' || o.role === 'admin' ? '/owner' : '/staff');
  };

  // the place you were working in when you came here from inside the app
  const current = session?.workspace ?? null;
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace(current?.role === 'owner' || current?.role === 'admin' ? '/owner' : '/staff');
  };
  // nothing chosen yet and only one place to work: go straight in (most owners never see this screen)
  const only = !current && orgs.data?.length === 1 ? orgs.data[0] : null;
  const entered = useRef(false);
  useEffect(() => {
    if (only && !entered.current) {
      entered.current = true;
      open(only);
    }
  }, [only]); // eslint-disable-line react-hooks/exhaustive-deps
  if (only) return <Screen><Loading /></Screen>;


  return (
    <Screen title={t('workspace.hello', { name: greetingName(session) })} subtitle={t('workspace.where')}
      right={<IconButton icon="log-out-outline" label={t('workspace.signOut')} onPress={signOut} />}
      onRefresh={refresh} refreshing={orgs.isRefetching || requests.isRefetching}>
      {current ? (
        <Button small variant="ghost" icon="arrow-back" title={t('workspace.back', { name: accountName(current) })}
          onPress={back} style={{ alignSelf: 'flex-start' }} />
      ) : null}
      {!orgs.data && !orgs.error ? <Loading /> : orgs.error ? <ErrorState error={orgs.error} onRetry={orgs.refetch} /> : (
        <>
          {orgs.data.length === 0 && shownRequests.length === 0 ? (
            <Empty icon="storefront-outline" title={t('workspace.noneTitle')} message={t('workspace.noneMsg')} />
          ) : orgs.data.map((o) => (
            <ListItem key={o.organizationId} title={accountName(o)}
              subtitle={o.stores.map((s) => s.name).join(', ') || undefined}
              left={<IconBubble icon={o.role === 'owner' ? 'storefront' : 'briefcase-outline'} tone="accent" size={46} />}
              right={o.organizationId === current?.id ? <Badge label={t('switcher.here')} tone="success" icon="checkmark" />
                : <Badge label={tv('role', o.role)} tone={o.role === 'employee' ? 'info' : 'accent'} />}
              onPress={() => (o.organizationId === current?.id ? back() : open(o))} />
          ))}
        </>
      )}

      {shownRequests.length > 0 ? (
        <Section title={t('workspace.requestsTitle')}>
          {shownRequests.map((r) => (
            <ListItem key={r.id} title={r.storeName}
              subtitle={r.status === 'pending' ? t('workspace.pendingHint', { when: ago(r.requestedAt) }) : t('workspace.rejectedHint')}
              left={<IconBubble icon={r.status === 'pending' ? 'hourglass-outline' : 'close-circle-outline'} tone={r.status === 'pending' ? 'warning' : 'danger'} />}
              right={<Badge label={t(`workspace.${r.status}`)} tone={r.status === 'pending' ? 'warning' : 'danger'} />} />
          ))}
        </Section>
      ) : null}

      <Section title={t('workspace.newTitle')}>
        <Card onPress={() => router.push('/join')}>
          <Row>
            <IconBubble icon="key-outline" tone="primary" />
            <Txt variant="subheading" style={{ flex: 1 }}>{t('workspace.joinStore')}</Txt>
          </Row>
        </Card>
        <Card onPress={() => setCreating(true)}>
          <Row>
            <IconBubble icon="add-circle-outline" tone="accent" />
            <Txt variant="subheading" style={{ flex: 1 }}>{t('workspace.openStore')}</Txt>
          </Row>
        </Card>
      </Section>

      <OpenStoreSheet visible={creating} onClose={() => setCreating(false)} />
    </Screen>
  );
}
