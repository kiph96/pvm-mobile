import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState } from 'react';

import type { MyOrganization } from '@/api/types';
import { useAction } from '@/components/toast';
import { Avatar, Badge, Button, Card, Empty, ErrorState, Field, IconBubble, IconButton, ListItem, Loading, Row, Screen, Section, Sheet, Txt } from '@/components/ui';
import { tv, useI18n } from '@/i18n';
import { useApi, useSession } from '@/state/session';
import { useSignOut } from '@/state/useSignOut';

/** Choose which business to work in (an employee can work for several). */
export default function WorkspacePicker() {
  const api = useApi();
  const { t } = useI18n();
  const { session, chooseWorkspace } = useSession();
  const signOut = useSignOut();
  const [run, busy] = useAction();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const orgs = useQuery({ queryKey: ['my-orgs', session?.userId], queryFn: api.myOrganizations, enabled: !!session });

  const open = async (o: MyOrganization) => {
    await chooseWorkspace({ id: o.organizationId, name: o.name, role: o.role });
    router.replace(o.role === 'owner' || o.role === 'admin' ? '/owner' : '/staff');
  };

  const create = async () => {
    const org = await run('create', () => api.createOrganization(name.trim(), 'Asia/Ho_Chi_Minh'), t('workspace.created'));
    if (org) {
      setCreating(false);
      await chooseWorkspace({ id: org.id, name: org.name, role: 'owner' });
      router.replace('/owner');
    }
  };

  return (
    <Screen title={t('workspace.hello', { name: session?.displayName.split(' ').at(-1) ?? '' })} subtitle={t('workspace.where')}
      right={<IconButton icon="log-out-outline" label={t('workspace.signOut')} onPress={signOut} />}
      onRefresh={orgs.refetch} refreshing={orgs.isRefetching}>
      {!orgs.data && !orgs.error ? <Loading /> : orgs.error ? <ErrorState error={orgs.error} onRetry={orgs.refetch} /> : (
        <>
          {orgs.data.length === 0 ? (
            <Empty icon="storefront-outline" title={t('workspace.noneTitle')} message={t('workspace.noneMsg')} />
          ) : orgs.data.map((o) => (
            <ListItem key={o.organizationId} title={o.name} left={<Avatar name={o.name} size={46} />}
              right={<Badge label={tv('role', o.role)} tone={o.role === 'employee' ? 'info' : 'accent'} />}
              onPress={() => open(o)} />
          ))}
        </>
      )}

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
            <Txt variant="subheading" style={{ flex: 1 }}>{t('workspace.createOwn')}</Txt>
          </Row>
        </Card>
      </Section>

      <Sheet visible={creating} onClose={() => setCreating(false)} title={t('workspace.newBusiness')}>
        <Txt muted>{t('workspace.newBusinessNote')}</Txt>
        <Field label={t('workspace.businessName')} value={name} onChangeText={setName} placeholder="K Coffee House" autoFocus />
        <Button title={t('workspace.create')} icon="checkmark" onPress={create} loading={busy === 'create'} disabled={!name.trim()} full />
      </Sheet>
    </Screen>
  );
}
