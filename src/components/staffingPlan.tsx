import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { PlanCell, StaffingPlan, StaffingProfile, StaffingSuggestion, TemplatePlan } from '@/api/types';
import { useAction, useToast } from '@/components/toast';
import { Button, Card, Chip, Loading, Row, Section, Sheet, Stepper, Toggle, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';
import { useTheme } from '@/theme';
import { isoWeekdays, money } from '@/utils/format';

const key = (templateId: string, weekday: number) => `${templateId}:${weekday}`;
const PEAKS = [15, 30, 45, 60, 80, 120];

/**
 * "Số người theo ca": people needed per shift template and weekday (replaces the store-wide numbers), what that
 * asks of the team and costs, and a suggestion from a few questions. Edits stay local until saved; capacity and
 * cost follow the edits live.
 */
export function StaffingPlanSection({ storeId }: { storeId: string }) {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const toast = useToast();
  const [run, busy] = useAction();
  const q = useQuery({ queryKey: ['staffing-plan', org, storeId], queryFn: () => api.staffingPlan(storeId) });
  const [draft, setDraft] = useState<Record<string, PlanCell>>({});
  const [editing, setEditing] = useState<{ tp: TemplatePlan; weekday: number } | null>(null);
  const [asking, setAsking] = useState(false);

  const savedJson = JSON.stringify((q.data?.templates ?? []).flatMap((tp) => tp.cells));
  const saved = useMemo(() => Object.fromEntries((JSON.parse(savedJson) as PlanCell[]).map((c) => [key(c.templateId, c.weekday), c])), [savedJson]);
  // keyed on the numbers, not the response object: other saves on this page refetch the plan and must not wipe edits
  useEffect(() => setDraft(saved), [saved]);
  const cells = Object.values(draft);
  const changed = cells.filter((c) => { const s = saved[key(c.templateId, c.weekday)]; return !s || s.min !== c.min || s.ideal !== c.ideal || s.max !== c.max; });

  if (q.isLoading || !q.data) return <Section title={t('staffingPlan.title')}><Loading /></Section>;
  const plan = q.data;
  if (plan.templates.length === 0) return <Section title={t('staffingPlan.title')}><Txt muted>{t('staffingPlan.noTemplates')}</Txt></Section>;

  const save = () => run('save', () => api.saveStaffingPlan(storeId, changed),
    (r) => r.updatedShifts ? t('staffingPlan.savedShifts', { n: r.updatedShifts }) : t('staffingPlan.saved'));

  return (
    <Section title={t('staffingPlan.title')} action={t('staffingPlan.suggest')} onAction={() => setAsking(true)}>
      <Card style={{ gap: 14 }}>
        <Txt variant="small" muted>{t('staffingPlan.intro')}</Txt>
        <Grid plan={plan} draft={draft} onPress={(tp, weekday) => setEditing({ tp, weekday })} />
        <Capacity plan={plan} cells={cells} />
        {changed.length ? (
          <Row gap={8}>
            <Button title={t('common.discard')} variant="secondary" style={{ flex: 1 }} onPress={() => setDraft(saved)} />
            <Button title={t('staffingPlan.save')} icon="checkmark" style={{ flex: 1 }} loading={busy === 'save'} onPress={save} />
          </Row>
        ) : null}
      </Card>
      {editing ? (
        <CellSheet tp={editing.tp} weekday={editing.weekday} cell={draft[key(editing.tp.templateId, editing.weekday)]}
          onClose={() => setEditing(null)}
          onDone={(c, allDays) => {
            setDraft((d) => {
              const next = { ...d };
              (allDays ? editing.tp.weekdays : [editing.weekday]).forEach((w) => { next[key(c.templateId, w)] = { ...c, weekday: w }; });
              return next;
            });
            setEditing(null);
          }} />
      ) : null}
      {asking ? (
        <SuggestSheet plan={plan} storeId={storeId} onClose={() => setAsking(false)}
          onUse={(s) => {
            setDraft(Object.fromEntries(s.cells.map((c) => [key(c.templateId, c.weekday), c])));
            setAsking(false);
            toast(t('staffingPlan.review'));
          }} />
      ) : null}
    </Section>
  );
}

function Grid({ plan, draft, onPress }: { plan: StaffingPlan; draft: Record<string, PlanCell>; onPress: (tp: TemplatePlan, weekday: number) => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const days = isoWeekdays();
  // "few volunteers" only means something once people have set preferred shifts
  const anyPrefs = plan.capacity.people > plan.capacity.peopleWithoutPreferences;
  const few = (tp: TemplatePlan, d: number) => {
    const c = draft[key(tp.templateId, d)];
    return anyPrefs && !!c && (tp.volunteers[String(d)] ?? 0) < c.ideal;
  };
  const anyFew = plan.templates.some((tp) => tp.weekdays.some((d) => few(tp, d)));
  const rows = plan.templates.map((tp) => (
    <Row key={tp.templateId} gap={4} style={{ alignItems: 'stretch' }}>
      <View style={{ width: 64, justifyContent: 'center' }}>
        <Txt variant="small" numberOfLines={1}>{tp.name}</Txt>
        <Txt variant="tiny" muted>{tp.localStart.slice(0, 5)}</Txt>
      </View>
      {[1, 2, 3, 4, 5, 6, 7].map((d) => {
        const c = draft[key(tp.templateId, d)];
        if (!tp.weekdays.includes(d) || !c) return <View key={d} style={{ flex: 1, borderRadius: 8, backgroundColor: colors.surfaceAlt, opacity: 0.4 }} />;
        const short = few(tp, d);
        return (
          <Pressable key={d} onPress={() => onPress(tp, d)} accessibilityRole="button"
            accessibilityLabel={`${tp.name} ${days[d - 1]}: ${c.ideal} (${c.min}–${c.max})`}
            style={({ pressed }) => ({
              flex: 1, borderRadius: 8, paddingVertical: 6, alignItems: 'center', opacity: pressed ? 0.7 : 1,
              backgroundColor: short ? colors.warningSoft : colors.primarySoft, borderWidth: 1, borderColor: short ? colors.warning : 'transparent',
            })}>
            <Txt variant="subheading" color={short ? colors.warning : colors.primary}>{c.ideal}</Txt>
            <Txt variant="tiny" muted>{c.min}–{c.max}</Txt>
          </Pressable>
        );
      })}
    </Row>
  ));
  return (
    <View style={{ gap: 6 }}>
      <Row gap={4}>
        <View style={{ width: 64 }} />
        {days.map((d) => <Txt key={d} variant="tiny" muted center style={{ flex: 1 }}>{d}</Txt>)}
      </Row>
      {rows}
      <Txt variant="tiny" muted>{t('staffingPlan.cellHint')}{anyFew ? ` · ${t('staffingPlan.fewVolunteers')}` : ''}</Txt>
    </View>
  );
}

/** Needs vs. what the team offers, and the wage bill, recomputed from the cells being edited. */
function Capacity({ plan, cells }: { plan: StaffingPlan; cells: PlanCell[] }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const c = plan.capacity;
  const needed = cells.reduce((n, x) => n + x.ideal, 0);
  const minimum = cells.reduce((n, x) => n + x.min, 0);
  const shortfall = Math.max(0, needed - c.offeredSlots);
  const hires = Math.ceil(shortfall / Math.max(1, c.typicalShiftsPerPerson));
  const pay = Object.fromEntries(plan.templates.map((tp) => [tp.templateId, tp.payPerShift ?? 0]));
  const weekly = cells.reduce((sum, x) => sum + x.ideal * (pay[x.templateId] ?? 0), 0);
  return (
    <View style={{ gap: 8, backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 12 }}>
      <Txt variant="small">{t('staffingPlan.needed', { n: needed, min: minimum })}</Txt>
      <Txt variant="small">{t('staffingPlan.offered', { people: c.people, n: c.offeredSlots })}</Txt>
      {c.peopleWithoutPreferences ? <Txt variant="tiny" muted>{t('staffingPlan.noPrefs', { n: c.peopleWithoutPreferences })}</Txt> : null}
      <Txt variant="small" color={shortfall ? colors.danger : colors.success} style={{ fontWeight: '600' }}>
        {shortfall ? t('staffingPlan.short', { n: shortfall, hires, per: c.typicalShiftsPerPerson }) : t('staffingPlan.enough', { n: c.offeredSlots - needed })}
      </Txt>
      <Txt variant="small" muted>{plan.cost.peopleWithWage
        ? t('staffingPlan.cost', { amount: money(weekly, plan.cost.currency), n: plan.cost.peopleWithWage }) : t('staffingPlan.noWages')}</Txt>
    </View>
  );
}

function CellSheet({ tp, weekday, cell, onClose, onDone }: {
  tp: TemplatePlan; weekday: number; cell: PlanCell; onClose: () => void; onDone: (c: PlanCell, allDays: boolean) => void;
}) {
  const { t } = useI18n();
  const [c, setC] = useState(cell);
  const [allDays, setAllDays] = useState(false);
  const day = isoWeekdays()[weekday - 1];
  return (
    <Sheet visible onClose={onClose} title={t('staffingPlan.cellTitle', { name: tp.name, day })}>
      <Txt variant="small" muted>{t('staffingPlan.volunteers', { n: tp.volunteers[String(weekday)] ?? 0 })}</Txt>
      <Stepper label={t('shift.minimum')} value={c.min} max={50}
        onChange={(v) => setC((x) => ({ ...x, min: v, ideal: Math.max(v, x.ideal), max: Math.max(v, x.max, 1) }))} />
      <Stepper label={t('shift.ideal')} value={c.ideal} max={50}
        onChange={(v) => setC((x) => ({ ...x, ideal: v, min: Math.min(v, x.min), max: Math.max(v, x.max, 1) }))} />
      <Stepper label={t('shift.maximum')} value={c.max} min={1} max={50}
        onChange={(v) => setC((x) => ({ ...x, max: v, ideal: Math.min(v, x.ideal), min: Math.min(v, x.min) }))} />
      {tp.weekdays.length > 1 ? <Toggle label={t('staffingPlan.allDays')} value={allDays} onChange={setAllDays} /> : null}
      <Button title={t('staffingPlan.done')} icon="checkmark" full onPress={() => onDone(c, allDays)} />
    </Sheet>
  );
}

function SuggestSheet({ plan, storeId, onClose, onUse }: {
  plan: StaffingPlan; storeId: string; onClose: () => void; onUse: (s: StaffingSuggestion) => void;
}) {
  const api = useApi();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const days = isoWeekdays();
  const [p, setP] = useState<StaffingProfile>(plan.profile ?? { peakGuests: 30, kitchen: false, busyDays: [6, 7], busyTemplateIds: [] });
  const [suggestion, setSuggestion] = useState<StaffingSuggestion | null>(null);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const current = Object.fromEntries(plan.templates.flatMap((tp) => tp.cells.map((c) => [key(c.templateId, c.weekday), c.ideal])));
  const diff = suggestion?.cells.filter((c) => current[key(c.templateId, c.weekday)] !== c.ideal).length ?? 0;

  return (
    <Sheet visible onClose={onClose} title={t('staffingPlan.askTitle')}>
      <Txt variant="small" muted>{t('staffingPlan.askIntro')}</Txt>
      <View style={{ gap: 8 }}>
        <Txt variant="small">{t('staffingPlan.peak')}</Txt>
        <Row gap={6} wrap>
          {PEAKS.map((n) => <Chip key={n} label={String(n)} selected={p.peakGuests === n} onPress={() => setP({ ...p, peakGuests: n })} />)}
        </Row>
        <Stepper label={t('staffingPlan.guests')} value={p.peakGuests} min={1} max={2000}
          onChange={(v) => setP({ ...p, peakGuests: v })} />
      </View>
      {plan.businessType === 'food_beverage' ? <Toggle label={t('staffingPlan.kitchen')} value={p.kitchen} onChange={(v) => setP({ ...p, kitchen: v })} /> : null}
      <View style={{ gap: 8 }}>
        <Txt variant="small">{t('staffingPlan.busyDays')}</Txt>
        <Row gap={6} wrap>
          {days.map((d, i) => <Chip key={d} label={d} selected={p.busyDays.includes(i + 1)} onPress={() => setP({ ...p, busyDays: toggle(p.busyDays, i + 1) })} />)}
        </Row>
      </View>
      <View style={{ gap: 8 }}>
        <Txt variant="small">{t('staffingPlan.busyShifts')}</Txt>
        <Row gap={6} wrap>
          {plan.templates.map((tp) => <Chip key={tp.templateId} label={tp.name} selected={p.busyTemplateIds.includes(tp.templateId)}
            onPress={() => setP({ ...p, busyTemplateIds: toggle(p.busyTemplateIds, tp.templateId) })} />)}
        </Row>
      </View>
      {suggestion ? (
        <Card tone="primary" style={{ gap: 4 }}>
          <Txt variant="small">{t('staffingPlan.suggestionLine', { n: suggestion.capacity.neededSlots, offered: suggestion.capacity.offeredSlots })}</Txt>
          <Txt variant="tiny" muted>{t('staffingPlan.changedCells', { n: diff })}</Txt>
        </Card>
      ) : null}
      {suggestion ? <Button title={t('staffingPlan.use')} icon="checkmark" full onPress={() => onUse(suggestion)} />
        : <Button title={t('staffingPlan.preview')} icon="sparkles-outline" full loading={busy === 'suggest'}
          onPress={async () => { const s = await run('suggest', () => api.suggestStaffing(storeId, p)); if (s) setSuggestion(s); }} />}
    </Sheet>
  );
}
