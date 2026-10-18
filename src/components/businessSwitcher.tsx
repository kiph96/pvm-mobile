import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { MyOrganization } from '@/api/types';
import { useI18n } from '@/i18n';
import { useMyBusinesses } from '@/state/queries';
import { useSession } from '@/state/session';
import { useTheme } from '@/theme';
import { BUSINESS_TYPES, businessIcon, businessName, type BusinessType } from './businessType';
import { Badge, Button, IconBubble, Loading, Row, Sheet, Txt } from './ui';

/** Moves the app into another business (each business's stores, staff and schedule are separate). */
export function useSwitchBusiness() {
  const { chooseWorkspace } = useSession();
  return async (b: MyOrganization) => {
    await chooseWorkspace({ id: b.organizationId, name: businessName(b), role: b.role, businessType: b.businessType });
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

/**
 * Keeps the saved Business in step with the server: sessions saved before business types existed
 * (or before a rename) show the type name in the header after this.
 */
export function useSyncWorkspace() {
  const { session, refreshWorkspace, chooseWorkspace } = useSession();
  const businesses = useMyBusinesses();
  const ws = session?.workspace;
  useEffect(() => {
    if (!ws || !businesses.data) return;
    const o = businesses.data.find((b) => b.organizationId === ws.id);
    if (!o) {
      // the saved Business is gone (closed or merged): move to your Business of the same type, else pick again
      const same = businesses.data.find((b) => b.businessType === ws.businessType && b.role === ws.role)
        ?? (businesses.data.length === 1 ? businesses.data[0] : undefined);
      if (same) {
        chooseWorkspace({ id: same.organizationId, name: businessName(same), role: same.role, businessType: same.businessType });
      } else {
        chooseWorkspace(null).then(() => router.replace('/workspace'));
      }
      return;
    }
    const name = businessName(o);
    if (ws.name !== name || ws.businessType !== o.businessType || ws.role !== o.role) {
      refreshWorkspace({ id: ws.id, name, role: o.role, businessType: o.businessType });
    }
  }, [businesses.data, ws, refreshWorkspace, chooseWorkspace]);
}

const PREVIEW = 3;

function BusinessSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { session } = useSession();
  const businesses = useMyBusinesses();
  const switchTo = useSwitchBusiness();
  const currentId = session?.workspace?.id;
  // Businesses with stores, the one you are in first, then by business type
  const list = (businesses.data ?? [])
    .filter((b) => b.stores.length > 0 || b.organizationId === currentId)
    .sort((a, b) => Number(b.organizationId === currentId) - Number(a.organizationId === currentId)
      || BUSINESS_TYPES.indexOf(a.businessType as BusinessType) - BUSINESS_TYPES.indexOf(b.businessType as BusinessType));
  // older data can still have several Businesses of one type: those are titled by their first store
  const sameType = (b: MyOrganization) => list.filter((x) => x.businessType === b.businessType).length > 1;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (visible) setExpanded(new Set());
  }, [visible]);

  /** Go into a store: switch Business first when needed; owners/admins land on its settings, staff on their home. */
  const openStore = async (b: MyOrganization, storeId: string) => {
    onClose();
    // navigating while the sheet is still closing is dropped on Android: let it close first
    await new Promise((r) => setTimeout(r, 300));
    if (b.organizationId !== currentId) await switchTo(b);
    if (b.role === 'owner' || b.role === 'admin') router.push(`/store/${storeId}`);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('switcher.title')}>
      <Txt variant="small" muted>{t('switcher.note')}</Txt>
      {businesses.isLoading ? <Loading /> : list.map((b) => (
        <BusinessCard key={b.organizationId} business={b} current={b.organizationId === currentId}
          title={sameType(b) ? b.stores[0]?.name ?? businessName(b) : businessName(b)}
          open={expanded.has(b.organizationId)}
          onToggle={() => setExpanded((x) => {
            const next = new Set(x);
            if (next.has(b.organizationId)) next.delete(b.organizationId); else next.add(b.organizationId);
            return next;
          })}
          onSwitch={async () => { onClose(); await switchTo(b); }}
          onOpenStore={(id) => openStore(b, id)} />
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

function BusinessCard({ business: b, current, title, open, onToggle, onSwitch, onOpenStore }: {
  business: MyOrganization; current: boolean; title: string; open: boolean;
  onToggle: () => void; onSwitch: () => void; onOpenStore: (storeId: string) => void;
}) {
  const { t } = useI18n();
  const { colors, radius } = useTheme();
  const shown = open ? b.stores : b.stores.slice(0, PREVIEW);
  const hidden = b.stores.length - PREVIEW;
  return (
    <View style={{ borderRadius: radius.lg, borderWidth: current ? 1.5 : 1, borderColor: current ? colors.primary : colors.border,
      backgroundColor: colors.surface, overflow: 'hidden' }}>
      {/* the Business */}
      <Row gap={12} style={{ padding: 14 }}>
        <IconBubble icon={businessIcon(b.businessType)} tone={current ? 'primary' : 'accent'} size={44} />
        <View style={{ flex: 1 }}>
          <Txt variant="subheading" numberOfLines={1}>{title}</Txt>
          <Txt variant="small" muted numberOfLines={1}>
            {[b.role === 'owner' ? null : b.ownerName, t('switcher.stores', { n: b.stores.length })].filter(Boolean).join(' · ')}
          </Txt>
        </View>
        {current ? <Badge label={t('switcher.here')} tone="success" icon="checkmark" />
          : <Button small variant="secondary" icon="swap-horizontal" title={t('switcher.change')} onPress={onSwitch} />}
      </Row>
      {/* its stores: tap to go straight in */}
      {shown.map((s, i) => (
        <Pressable key={s.id} onPress={() => onOpenStore(s.id)} accessibilityRole="button" accessibilityLabel={s.name}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14,
            borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="storefront-outline" size={16} color={colors.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt numberOfLines={1} style={{ fontWeight: '600' }}>{s.name}</Txt>
            {s.address ? <Txt variant="small" muted numberOfLines={1}>{s.address}</Txt> : null}
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
