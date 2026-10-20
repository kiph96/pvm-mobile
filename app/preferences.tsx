import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import type { PrefSlot } from '@/api/types';
import { StorePicker } from '@/components/domain';
import { useAction } from '@/components/toast';
import { Button, Card, Chip, Empty, Loading, Row, Screen, Stepper, Toggle, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';
import { useMyEmployments } from '@/state/staff';
import { isoWeekdays } from '@/utils/format';

const key = (s: PrefSlot) => `${s.weekday}:${s.templateId}`;

/**
 * "Ca mong muốn": the shifts I can usually work (shift template × weekday) and at most how many a week.
 * Used to ask for all of next week in one tap, and by the store's automatic weekly staffing.
 */
export default function Preferences() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const employments = useMyEmployments();
  const stores = (employments.data ?? []).map((e) => ({ id: e.storeId, name: e.storeName }));
  const [storeId, setStoreId] = useState<string | null>(null);
  const selected = storeId ?? stores[0]?.id ?? null;
  const prefs = useQuery({ queryKey: ['preferences', org, selected], queryFn: () => api.preferences(selected!), enabled: !!selected });
  const days = isoWeekdays();

  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState<number | null>(null);
  useEffect(() => {
    if (prefs.data) {
      setChosen(new Set(prefs.data.slots.map(key)));
      setLimit(prefs.data.maxShiftsPerWeek ?? null);
    }
  }, [prefs.data]);
  const saved = prefs.data ? JSON.stringify([[...prefs.data.slots.map(key)].sort(), prefs.data.maxShiftsPerWeek ?? null]) : '';
  const dirty = !!prefs.data && JSON.stringify([[...chosen].sort(), limit]) !== saved;

  const toggle = (k: string) => setChosen((x) => {
    const next = new Set(x);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });
  const setMany = (keys: string[], on: boolean) => setChosen((x) => {
    const next = new Set(x);
    keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
    return next;
  });

  const save = () => run('save', () => api.savePreferences({
    storeId: selected!, maxShiftsPerWeek: limit,
    slots: [...chosen].map((k) => { const [w, id] = k.split(':'); return { weekday: Number(w), templateId: id }; }),
  }), t('prefs.saved'));

  return (
    <Screen onRefresh={prefs.refetch} refreshing={false}>
      <StorePicker stores={stores} value={selected} onChange={setStoreId} />
      <Txt muted style={{ marginTop: 8 }}>{t('prefs.intro')}</Txt>
      {!prefs.data ? <Loading /> : prefs.data.templates.length === 0 ? (
        <Empty icon="time-outline" title={t('prefs.noTemplates')} message={t('prefs.noTemplatesMsg')} />
      ) : (
        <View style={{ gap: 12, marginTop: 14 }}>
          {prefs.data.templates.map((tp) => {
            const runs = tp.weekdays;   // days this shift exists
            const keys = runs.map((d) => `${d}:${tp.id}`);
            const all = keys.every((k) => chosen.has(k));
            return (
              <Card key={tp.id} style={{ gap: 12 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="subheading">{tp.name}</Txt>
                    <Txt variant="small" muted>{tp.localStart.slice(0, 5)} – {tp.localEnd.slice(0, 5)}</Txt>
                  </View>
                  <Button small variant="ghost" title={all ? t('prefs.clear') : t('prefs.allWeek')} onPress={() => setMany(keys, !all)} />
                </Row>
                <Row gap={6} wrap>
                  {runs.map((d) => (
                    <Chip key={d} label={days[d - 1]} selected={chosen.has(`${d}:${tp.id}`)} onPress={() => toggle(`${d}:${tp.id}`)} />
                  ))}
                </Row>
              </Card>
            );
          })}

          <Card style={{ gap: 14 }}>
            <Toggle label={t('prefs.perWeek')} hint={t('prefs.perWeekHint')} value={limit != null}
              onChange={(on) => setLimit(on ? Math.max(1, Math.min(5, chosen.size || 5)) : null)} />
            {limit != null ? <Stepper label={t('prefs.max')} value={limit} min={1} max={21} onChange={setLimit} /> : null}
          </Card>

          <Txt variant="small" muted center>{t('prefs.chosen', { n: chosen.size })}</Txt>
          <Button title={t('prefs.save')} icon="checkmark" full loading={busy === 'save'} disabled={!dirty} onPress={save} />
        </View>
      )}
    </Screen>
  );
}
