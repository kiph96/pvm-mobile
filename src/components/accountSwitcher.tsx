import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { MyOrganization } from '@/api/types';
import { t, useI18n } from '@/i18n';
import { useMyAccounts } from '@/state/queries';
import { useSession, type Workspace } from '@/state/session';
import { useTheme } from '@/theme';
import { businessIcon, typeName } from './businessType';
import { Badge, Button, IconBubble, Loading, Row, Sheet, Txt } from './ui';

/**
 * Every owner has one account holding all their stores. An account is shown as "My stores" to its owner and
 * as "Working for {owner}" to the people who work there (someone may work for several owners).
 */
export function accountName(a: { role?: string | null; name?: string | null; ownerName?: string | null } | null | undefined) {
  if (!a) return '';
  return a.role === 'owner' ? t('account.mine') : t('account.of', { name: a.ownerName ?? a.name ?? '' });
}

const workspaceOf = (a: MyOrganization): Workspace => ({ id: a.organizationId, name: a.ownerName ?? '', role: a.role });
const manages = (role: string) => role === 'owner' || role === 'admin';

/** Work in another account: its stores, staff and schedule. */
export function useSwitchAccount() {
  const { chooseWorkspace } = useSession();
  return async (a: MyOrganization) => {
    await chooseWorkspace(workspaceOf(a));
    router.replace(manages(a.role) ? '/owner' : '/staff');
  };
}

/** Header switcher: `open` shows every store the user can reach, so going into one is a single tap. */
export function useAccountSwitcher() {
  const [visible, setVisible] = useState(false);
  const sheet = <AccountSheet visible={visible} onClose={() => setVisible(false)} />;
  return { open: () => setVisible(true), sheet };
}

/** Keeps the saved account in step with the server (owner renamed, role changed, or no longer a member). */
export function useSyncAccount() {
  const { session, refreshWorkspace, chooseWorkspace } = useSession();
  const accounts = useMyAccounts();
  const ws = session?.workspace;
  useEffect(() => {
    if (!ws || !accounts.data) return;
    const a = accounts.data.find((x) => x.organizationId === ws.id);
    if (!a) {
      chooseWorkspace(null).then(() => router.replace('/workspace'));
      return;
    }
    const next = workspaceOf(a);
    if (ws.name !== next.name || ws.role !== next.role) refreshWorkspace(next);
  }, [accounts.data, ws, refreshWorkspace, chooseWorkspace]);
}

const PREVIEW = 3;

function AccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { session } = useSession();
  const accounts = useMyAccounts();
  const switchTo = useSwitchAccount();
  const currentId = session?.workspace?.id;
  // the account you are in first, then your own, then the owners you work for
  const list = (accounts.data ?? [])
    .filter((a) => a.stores.length > 0 || a.organizationId === currentId)
    .sort((a, b) => Number(b.organizationId === currentId) - Number(a.organizationId === currentId)
      || Number(b.role === 'owner') - Number(a.role === 'owner'));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (visible) setExpanded(new Set());
  }, [visible]);

  /** Go into a store: switch account first when needed; owners/admins land on its settings, staff on their home. */
  const openStore = async (a: MyOrganization, storeId: string) => {
    onClose();
    if (a.organizationId !== currentId) await switchTo(a);
    if (manages(a.role)) router.push(`/store/${storeId}`);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('switcher.title')}>
      <Txt variant="small" muted>{t('switcher.note')}</Txt>
      {accounts.isLoading ? <Loading /> : list.map((a) => (
        <AccountCard key={a.organizationId} account={a} current={a.organizationId === currentId}
          open={expanded.has(a.organizationId)}
          onToggle={() => setExpanded((x) => {
            const next = new Set(x);
            if (next.has(a.organizationId)) next.delete(a.organizationId); else next.add(a.organizationId);
            return next;
          })}
          onSwitch={async () => { onClose(); await switchTo(a); }}
          onOpenStore={(id) => openStore(a, id)} />
      ))}
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

function AccountCard({ account: a, current, open, onToggle, onSwitch, onOpenStore }: {
  account: MyOrganization; current: boolean; open: boolean;
  onToggle: () => void; onSwitch: () => void; onOpenStore: (storeId: string) => void;
}) {
  const { t } = useI18n();
  const { colors, radius } = useTheme();
  const shown = open ? a.stores : a.stores.slice(0, PREVIEW);
  const hidden = a.stores.length - PREVIEW;
  return (
    <View style={{ borderRadius: radius.lg, borderWidth: current ? 1.5 : 1, borderColor: current ? colors.primary : colors.border,
      backgroundColor: colors.surface, overflow: 'hidden' }}>
      <Row gap={12} style={{ padding: 14 }}>
        <IconBubble icon={a.role === 'owner' ? 'storefront' : 'briefcase-outline'} tone={current ? 'primary' : 'accent'} size={44} />
        <View style={{ flex: 1 }}>
          <Txt variant="subheading" numberOfLines={1}>{accountName(a)}</Txt>
          <Txt variant="small" muted numberOfLines={1}>{t('switcher.stores', { n: a.stores.length })}</Txt>
        </View>
        {current ? <Badge label={t('switcher.here')} tone="success" icon="checkmark" />
          : <Button small variant="secondary" icon="swap-horizontal" title={t('switcher.change')} onPress={onSwitch} />}
      </Row>
      {/* its stores: tap to go straight in */}
      {shown.map((s) => (
        <Pressable key={s.id} onPress={() => onOpenStore(s.id)} accessibilityRole="button" accessibilityLabel={s.name}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14,
            borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={businessIcon(s.businessType)} size={16} color={colors.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt numberOfLines={1} style={{ fontWeight: '600' }}>{s.name}</Txt>
            <Txt variant="small" muted numberOfLines={1}>{[typeName(s.businessType), s.address].filter(Boolean).join(' · ')}</Txt>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ))}
      {hidden > 0 ? (
        <Pressable onPress={onToggle} accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10,
            borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}>
          <Txt variant="small" color={colors.primary} style={{ fontWeight: '700' }}>
            {open ? t('switcher.collapse') : t('switcher.showMore', { n: hidden })}
          </Txt>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}
