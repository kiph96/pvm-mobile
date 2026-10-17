import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import type { AccessKeyView, PolicyView } from '@/api/types';
import { AccessKeyCard } from '@/components/accessKey';
import { codeLabel, useStores } from '@/components/domain';
import { PayRulesEditor } from '@/components/payRules';
import { useAction } from '@/components/toast';
import { Badge, Button, Card, Chip, Field, IconBubble, ListItem, Loading, Row, Screen, Section, Sheet, Stepper, Toggle, Txt, confirm } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';
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

      <Section title={t('storeSettings.invite')} style={{ marginTop: 12 }}>
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
        {templates.isLoading ? <Loading /> : (templates.data ?? []).length === 0 ? <Txt muted>{t('storeSettings.noTemplates')}</Txt>
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
      <TemplateSheet visible={templateOpen} onClose={() => setTemplateOpen(false)} storeId={id} />
    </Screen>
  );
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
        <Txt variant="subheading">{t('storeSettings.signups')}</Txt>
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

function TemplateSheet({ visible, onClose, storeId }: { visible: boolean; onClose: () => void; storeId: string }) {
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
      <Field label={t('storeSettings.templateName')} value={name} onChangeText={setName} placeholder="Ca sáng" />
      <Row gap={10}>
        <View style={{ flex: 1 }}><Field label={t('common.starts')} value={start} onChangeText={setStart} /></View>
        <View style={{ flex: 1 }}><Field label={t('common.ends')} value={end} onChangeText={setEnd} hint={end <= start ? t('common.endsNextDay') : undefined} /></View>
      </Row>
      <Txt variant="small" muted>{t('storeSettings.repeats')}</Txt>
      <Row gap={6} wrap>{isoWeekdays().map((d, i) => <Chip key={d} label={d} selected={days.includes(i + 1)} onPress={() => toggle(i + 1)} />)}</Row>
      <Txt variant="small" muted>{t('storeSettings.usesDefaults')}</Txt>
      <Button title={t('storeSettings.saveTemplate')} icon="checkmark" full loading={busy === 't'} disabled={!valid}
        onPress={async () => {
          if (await run('t', () => api.createTemplate({ storeId, name: name.trim(), localStart: start, localEnd: end, weekdays: days }), t('storeSettings.templateAdded'))) {
            setName('');
            onClose();
          }
        }} />
    </Sheet>
  );
}
