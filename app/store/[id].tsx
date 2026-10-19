import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import type { AccessKeyView, PolicyRules, PolicyView, StoreView } from '@/api/types';
import { AccessKeyCard } from '@/components/accessKey';
import { AdvancedSettings } from '@/components/advancedSettings';
import { BUSINESS_TYPES, BUSINESS_TYPE_ICON, businessIcon, isBusinessType, typeName, type BusinessType } from '@/components/businessType';
import { codeLabel, useStores } from '@/components/domain';
import { PayRulesEditor } from '@/components/payRules';
import { useAction } from '@/components/toast';
import { Badge, Button, Card, Chip, Field, IconBubble, ListItem, Loading, Row, Screen, Section, Sheet, Stepper, Toggle, Txt, confirm } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi, useSession } from '@/state/session';
import { useTheme } from '@/theme';
import { isoWeekdays, money } from '@/utils/format';

export default function StoreSettings() {
  const { id, invite } = useLocalSearchParams<{ id: string; invite?: string }>();
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const { stores } = useStores();
  const store = stores.find((s) => s.id === id);
  const [key, setKey] = useState<AccessKeyView | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { session } = useSession();
  const ws = session?.workspace;
  const { colors } = useTheme();
  const policy = useQuery({ queryKey: ['policy', org, id], queryFn: () => api.policy(id) });
  const templates = useQuery({ queryKey: ['templates', org, id], queryFn: () => api.templates(id) });
  const days = isoWeekdays();

  const rotate = async () => {
    const ok = key || await confirm(t('storeSettings.newKeyTitle'), t('storeSettings.newKeyMsg'), t('storeSettings.newKeyConfirm'));
    if (!ok) return;
    const k = await run('rotate', () => api.rotateAccessKey(id), t('storeSettings.keyReady'));
    if (k) setKey(k);
  };

  return (
    <Screen onRefresh={() => { policy.refetch(); templates.refetch(); }} refreshing={false}>
      <Stack.Screen options={{ title: store?.name ?? t('screens.store') }} />

      {store ? (
        <Section title={t('storeInfo.title')} action={t('common.edit')} onAction={() => setEditOpen(true)} style={{ marginTop: 12 }}>
          <Card style={{ gap: 10 }} onPress={() => setEditOpen(true)}>
            <Row>
              <IconBubble icon="storefront" tone="accent" />
              <View style={{ flex: 1 }}>
                <Txt variant="subheading">{store.name}</Txt>
                <Txt variant="small" muted>{store.timezone} · {store.currency}</Txt>
              </View>
            </Row>
            <Row gap={8} style={{ alignItems: 'flex-start' }}>
              <Ionicons name="location-outline" size={18} color={store.address ? colors.text : colors.textMuted} />
              <Txt variant="small" muted={!store.address} style={{ flex: 1 }}>{store.address ?? t('storeInfo.noAddress')}</Txt>
            </Row>
            <Row gap={8}>
              <Ionicons name={businessIcon(store.businessType)} size={18} color={colors.text} />
              <Txt variant="small" style={{ flex: 1 }}>{t('storeInfo.type')}: {typeName(store.businessType)}</Txt>
            </Row>
          </Card>
        </Section>
      ) : null}

      <Section title={t('storeSettings.invite')}>
        {key ? <AccessKeyCard accessKey={key} /> : (
          <Card style={{ gap: 12 }}>
            <Row>
              <IconBubble icon="key-outline" tone="primary" />
              <Txt style={{ flex: 1 }}>{invite ? t('storeSettings.keyOnce') : t('storeSettings.keyIntro')}</Txt>
            </Row>
            <Button title={t('storeSettings.newKey')} icon="key-outline" loading={busy === 'rotate'} onPress={rotate} />
          </Card>
        )}
      </Section>

      <Section title={t('storeSettings.templates')} action={t('common.add')} onAction={() => setTemplateOpen(true)}>
        {templates.isLoading ? <Loading /> : (templates.data ?? []).length === 0
          ? <Txt muted>{autoSchedule(policy.data).on ? t('storeSettings.noTemplatesAuto', { n: autoSchedule(policy.data).days }) : t('storeSettings.noTemplates')}</Txt>
          : templates.data!.map((tp) => (
            <ListItem key={tp.id} title={tp.name}
              subtitle={`${tp.localStart.slice(0, 5)} – ${tp.localEnd.slice(0, 5)}${tp.overnight ? ` ${t('time.plusDay')}` : ''} · ${tp.weekdays.length === 7 ? t('time.everyDay') : tp.weekdays.map((d) => days[d - 1]).join(', ')}`}
              left={<IconBubble icon="time-outline" tone="info" size={38} />}
              right={<Button small variant="ghost" title={t('common.archive')} loading={busy === tp.id}
                onPress={async () => { if (await confirm(t('storeSettings.archiveTitle'), t('storeSettings.archiveMsg'), t('common.archive'))) run(tp.id, () => api.archiveTemplate(tp.id), t('storeSettings.archived')); }} />} />
          ))}
      </Section>

      {policy.data ? <PayRulesEditor storeId={id} policy={policy.data} /> : null}
      {policy.data ? <PolicyEditor storeId={id} policy={policy.data} /> : <Loading />}
      {policy.data ? <AdvancedSettings storeId={id} policy={policy.data} /> : null}
      {store ? <EditStoreSheet visible={editOpen} onClose={() => setEditOpen(false)} store={store} /> : null}
      <TemplateSheet visible={templateOpen} onClose={() => setTemplateOpen(false)} storeId={id}
        autoDays={autoSchedule(policy.data).on ? autoSchedule(policy.data).days : null} />

      {store && ws?.role === 'owner' ? (
        <Section title={t('closeStore.title')}>
          <Card style={{ gap: 12 }}>
            <Txt variant="small" muted>{t('closeStore.note')}</Txt>
            <Button title={t('closeStore.button')} icon="lock-closed-outline" variant="danger" loading={busy === 'close'}
              onPress={async () => {
                if (!await confirm(t('closeStore.confirmTitle', { store: store.name }), t('closeStore.confirmMsg'), t('closeStore.confirm'), true)) return;
                const r = await run('close', () => api.closeStore(store.id), t('closeStore.done', { store: store.name }));
                if (r) router.replace('/owner/stores');
              }} />
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

/** Store's auto-schedule rule with the server's defaults (on, 14 days). */
function autoSchedule(p: PolicyView | undefined) {
  const s = p?.rules?.schedule;
  return { on: s?.auto_generate !== false, days: s?.days_ahead ?? 14 };
}

function PolicyEditor({ storeId, policy }: { storeId: string; policy: PolicyView }) {
  const api = useApi();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const [p, setP] = useState(policy);
  useEffect(() => setP(policy), [policy]);
  const set = <K extends keyof PolicyView>(k: K, v: PolicyView[K]) => setP((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(p) !== JSON.stringify(policy);
  const rules = p.rules ?? {};
  const auto = autoSchedule(p);
  const cutoffOn = p.rules?.registration?.cutoff_enabled !== false;
  const cutoffMinutes = p.rules?.registration?.closes_minutes_before ?? 15;
  const setSchedule = (patch: NonNullable<PolicyRules['schedule']>) =>
    setP((x) => ({ ...x, rules: { ...(x.rules ?? {}), schedule: { ...(x.rules?.schedule ?? {}), ...patch } } }));
  return (
    <Section title={t('storeSettings.rules')}>
      <Card style={{ gap: 16 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="subheading">{t('storeSettings.teamSize')}</Txt>
          <Badge label={t('storeSettings.version', { n: policy.version })} />
        </Row>
        <Stepper label={t('storeSettings.included')} value={p.employeeLimit} min={1} max={200} onChange={(v) => set('employeeLimit', v)} />
        <Toggle label={t('storeSettings.hardLimit')} hint={t('storeSettings.hardLimitHint')} value={p.employeeLimitMode === 'hard'}
          onChange={(v) => set('employeeLimitMode', v ? 'hard' : 'advisory')} />
      </Card>
      <Card style={{ gap: 16 }}>
        <Txt variant="subheading">{t('storeSettings.defaultsTitle')}</Txt>
        <Stepper label={t('shift.minimum')} value={p.minStaff} onChange={(v) => setP((x) => ({ ...x, minStaff: v, optimalStaff: Math.max(v, x.optimalStaff), maxStaff: Math.max(v, x.maxStaff) }))} />
        <Stepper label={t('shift.ideal')} value={p.optimalStaff} onChange={(v) => setP((x) => ({ ...x, optimalStaff: v, minStaff: Math.min(v, x.minStaff), maxStaff: Math.max(v, x.maxStaff) }))} />
        <Stepper label={t('shift.maximum')} value={p.maxStaff} min={1} onChange={(v) => setP((x) => ({ ...x, maxStaff: v, optimalStaff: Math.min(v, x.optimalStaff), minStaff: Math.min(v, x.minStaff) }))} />
      </Card>
      <Card style={{ gap: 16 }}>
        <Txt variant="subheading">{t('storeSettings.autoTitle')}</Txt>
        <Toggle label={t('storeSettings.autoSchedule')} hint={t('storeSettings.autoScheduleHint')} value={auto.on}
          onChange={(v) => setSchedule({ auto_generate: v })} />
        {auto.on ? (
          <Stepper label={t('storeSettings.daysAhead')} value={auto.days} min={7} max={28} onChange={(v) => setSchedule({ days_ahead: v })} />
        ) : null}
      </Card>
      <Card style={{ gap: 16 }}>
        <Txt variant="subheading">{t('storeSettings.signups')}</Txt>
        <Toggle label={t('storeSettings.cutoff', { n: cutoffMinutes })} hint={cutoffOn ? t('storeSettings.cutoffOnHint', { n: cutoffMinutes }) : t('storeSettings.cutoffOffHint')}
          value={cutoffOn} onChange={(v) => setP((x) => ({ ...x, rules: { ...(x.rules ?? {}),
            registration: { ...(x.rules?.registration ?? {}), cutoff_enabled: v, closes_minutes_before: x.rules?.registration?.closes_minutes_before ?? 15 } } }))} />
        <Toggle label={t('storeSettings.autoApprove')} hint={t('storeSettings.autoApproveHint')} value={p.registrationMode === 'automatic'}
          onChange={(v) => set('registrationMode', v ? 'automatic' : 'owner_approval')} />
        <Toggle label={t('storeSettings.swapApproval')} value={p.swapApprovalRequired} onChange={(v) => set('swapApprovalRequired', v)} />
      </Card>
      {rules.violations || rules.awards ? (
        <Card style={{ gap: 10 }}>
          <Txt variant="subheading">{t('storeSettings.pointsSystem')}</Txt>
          <Row gap={6} wrap>
            {Object.entries(rules.awards ?? {}).map(([c, a]) => <Badge key={c} tone="success" label={`${codeLabel(c)} +${a.points}`} />)}
            {Object.entries(rules.violations ?? {}).map(([c, a]) => <Badge key={c} tone="danger" label={`${codeLabel(c)} ${a.points}`} />)}
          </Row>
          {Object.entries(rules.rewards ?? {}).map(([c, r]) => (
            <Txt key={c} variant="small" muted>{t('storeSettings.reward', { name: codeLabel(c), cost: r.points_cost, amount: money(r.amount) })}</Txt>
          ))}
        </Card>
      ) : null}
      {dirty ? (
        <Row gap={8}>
          <Button title={t('common.discard')} variant="secondary" style={{ flex: 1 }} onPress={() => setP(policy)} />
          <Button title={t('storeSettings.saveRules')} icon="checkmark" style={{ flex: 1 }} loading={busy === 'save'}
            onPress={() => run('save', () => api.updatePolicy(storeId, {
              employeeLimit: p.employeeLimit, employeeLimitMode: p.employeeLimitMode, minStaff: p.minStaff, optimalStaff: p.optimalStaff,
              maxStaff: p.maxStaff, registrationMode: p.registrationMode, swapApprovalRequired: p.swapApprovalRequired, rules: p.rules,
            }), t('storeSettings.rulesSaved'))} />
        </Row>
      ) : null}
    </Section>
  );
}

/** @param autoDays how far ahead shifts are made automatically, or null when auto-schedule is off */
function TemplateSheet({ visible, onClose, storeId, autoDays }: { visible: boolean; onClose: () => void; storeId: string; autoDays: number | null }) {
  const api = useApi();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const [name, setName] = useState('');
  const [start, setStart] = useState('07:00');
  const [end, setEnd] = useState('12:00');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const valid = name.trim() && /^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end) && days.length > 0;
  const toggle = (d: number) => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d].sort()));
  return (
    <Sheet visible={visible} onClose={onClose} title={t('storeSettings.newTemplate')}>
      <Field label={t('storeSettings.templateName')} value={name} onChangeText={setName} placeholder={t('storeSettings.templatePlaceholder')} />
      <Row gap={10}>
        <View style={{ flex: 1 }}><Field label={t('common.starts')} value={start} onChangeText={setStart} /></View>
        <View style={{ flex: 1 }}><Field label={t('common.ends')} value={end} onChangeText={setEnd} hint={end <= start ? t('common.endsNextDay') : undefined} /></View>
      </Row>
      <Txt variant="small" muted>{t('storeSettings.repeats')}</Txt>
      <Row gap={6} wrap>{isoWeekdays().map((d, i) => <Chip key={d} label={d} selected={days.includes(i + 1)} onPress={() => toggle(i + 1)} />)}</Row>
      <Txt variant="small" muted>{t('storeSettings.usesDefaults')}{autoDays ? ' ' + t('storeSettings.autoNote', { n: autoDays }) : ''}</Txt>
      <Button title={t('storeSettings.saveTemplate')} icon="checkmark" full loading={busy === 't'} disabled={!valid}
        onPress={async () => {
          if (await run('t', () => api.createTemplate({ storeId, name: name.trim(), localStart: start, localEnd: end, weekdays: days }),
            autoDays ? t('storeSettings.templateAddedAuto', { n: autoDays }) : t('storeSettings.templateAdded'))) {
            setName('');
            onClose();
          }
        }} />
    </Sheet>
  );
}

/** Owner edits the store's name, address and business type. Timezone and currency stay fixed: shifts and pay depend on them. */
function EditStoreSheet({ visible, onClose, store }: { visible: boolean; onClose: () => void; store: StoreView }) {
  const api = useApi();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const [name, setName] = useState(store.name);
  const [address, setAddress] = useState(store.address ?? '');
  const [type, setType] = useState<BusinessType>(isBusinessType(store.businessType) ? store.businessType : 'others');
  useEffect(() => {
    if (visible) {
      setName(store.name);
      setAddress(store.address ?? '');
      setType(isBusinessType(store.businessType) ? store.businessType : 'others');
    }
  }, [visible, store]);
  const changed = name.trim() !== store.name || (address.trim() || null) !== (store.address ?? null) || type !== store.businessType;
  return (
    <Sheet visible={visible} onClose={onClose} title={t('storeInfo.editTitle')}>
      <Field label={t('stores.name')} value={name} onChangeText={setName} maxLength={200} />
      <Field label={t('storeInfo.address')} value={address} onChangeText={setAddress} maxLength={300} multiline
        placeholder={t('storeInfo.addressPlaceholder')} hint={t('storeInfo.addressHint')} />
      <Txt variant="small" muted>{t('storeInfo.type')}</Txt>
      <Row gap={8} wrap>
        {BUSINESS_TYPES.map((bt) => (
          <Chip key={bt} icon={BUSINESS_TYPE_ICON[bt]} label={t(`businessType.${bt}`)} selected={type === bt} onPress={() => setType(bt)} />
        ))}
      </Row>
      <Txt variant="small" muted>{t('storeInfo.fixed', { tz: store.timezone, currency: store.currency })}</Txt>
      <Button title={t('common.save')} icon="checkmark" full loading={busy === 'save'} disabled={!name.trim() || !changed}
        onPress={async () => {
          const r = await run('save', () => api.updateStore(store.id, { name: name.trim(), address: address.trim() || null, businessType: type }), t('storeInfo.saved'));
          if (r) onClose();
        }} />
    </Sheet>
  );
}
