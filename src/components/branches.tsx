import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { BranchView } from '@/api/types';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';
import { money } from '@/utils/format';
import { wageText, type WageBasis } from '@/utils/pay';
import { useAction } from './toast';
import { Avatar, Badge, Button, Card, Chip, Field, ListItem, Loading, Row, Section, Sheet, Txt } from './ui';

/**
 * Owner, on a person's page: the stores of the business they work at (home store marked), and the others they can be
 * added to with one tap, no access key. Hidden for a single-store business.
 */
export function BranchesSection({ employmentId }: { employmentId: string }) {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const [adding, setAdding] = useState<BranchView | null>(null);
  const q = useQuery({ queryKey: ['branches', org, employmentId], queryFn: () => api.branches(employmentId) });
  const d = q.data;
  if (!d || d.stores.length < 2) return null;
  const working = d.stores.filter((s) => s.employmentId);
  const current = working.find((s) => s.employmentId === employmentId) ?? working[0];

  return (
    <Section title={t('branches.title')}>
      {d.stores.map((s) => (
        <Card key={s.storeId} style={{ gap: 8 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Txt variant="subheading">{s.storeName}</Txt>
              <Txt variant="small" muted>
                {s.employmentId ? wageText(s.currentWage ?? null, s.wageBasis ?? null, s.currency) : t('branches.notHere')}
              </Txt>
            </View>
            {s.home ? <Badge tone="primary" icon="home-outline" label={t('branches.home')} />
              : s.employmentId ? (
                <Button small variant="ghost" title={t('branches.makeHome')} loading={busy === `h${s.storeId}`}
                  onPress={() => run(`h${s.storeId}`, () => api.setHomeStore(employmentId, s.storeId), t('branches.homeSet'))} />
              ) : (
                <Button small variant="secondary" icon="add" title={t('branches.add')} onPress={() => setAdding(s)} />
              )}
          </Row>
        </Card>
      ))}
      <Txt variant="small" muted>{d.homeChosen ? t('branches.homeHint') : `${t('branches.homeAuto')}. ${t('branches.homeHint')}`}</Txt>
      {/* keyed by store: each store starts from "same wage" */}
      <AddSheet key={adding?.storeId ?? 'none'} visible={!!adding} onClose={() => setAdding(null)} employmentId={employmentId} name={d.displayName}
        store={adding} from={current} />
    </Section>
  );
}

function AddSheet({ visible, onClose, employmentId, name, store, from }: {
  visible: boolean; onClose: () => void; employmentId: string; name: string; store: BranchView | null; from?: BranchView;
}) {
  const api = useApi();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const [same, setSame] = useState(true);
  const [value, setValue] = useState('');
  const amount = Number(value.replace(/[^\d]/g, ''));
  const basis = (from?.wageBasis as WageBasis | null) ?? 'hourly';
  const hasWage = from?.currentWage != null;
  if (!store) return null;
  const save = async () => {
    const r = await run('add', () => api.addToBranch(employmentId, store.storeId, same && hasWage ? undefined : amount, same && hasWage ? undefined : basis),
      t('branches.added', { name, store: store.storeName }));
    if (r) onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t('branches.addTitle', { name, store: store.storeName })}>
      <Txt muted>{t('branches.addNote', { name })}</Txt>
      {hasWage ? (
        <Row gap={8} wrap>
          <Chip label={t('branches.sameWage', { wage: wageText(from!.currentWage!, from!.wageBasis ?? null, from!.currency) })}
            selected={same} onPress={() => setSame(true)} />
          <Chip label={t('branches.otherWage')} selected={!same} onPress={() => setSame(false)} />
        </Row>
      ) : null}
      {!same || !hasWage ? (
        <>
          <Field label={t('employee.amount')} value={value} onChangeText={setValue} keyboardType="numeric"
            hint={amount > 0 ? wageText(amount, basis) : undefined} />
          <Row gap={8} wrap>
            {(basis === 'hourly' ? [25000, 28000, 30000, 35000] : [150000, 180000, 200000]).map((v) => (
              <Chip key={v} label={money(v)} selected={amount === v} onPress={() => setValue(String(v))} />
            ))}
          </Row>
        </>
      ) : null}
      <Button title={t('branches.add')} icon="checkmark" full loading={busy === 'add'}
        disabled={(!same || !hasWage) && !(amount > 0)} onPress={save} />
    </Sheet>
  );
}

/** In the owner's assign sheet: people of the business's other stores, to put on this shift in one tap. */
export function BorrowList({ shiftId, visible, onDone }: { shiftId: string; visible: boolean; onDone: () => void }) {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const q = useQuery({ queryKey: ['borrowable', org, shiftId], queryFn: () => api.borrowable(shiftId), enabled: visible });
  if (q.isLoading) return <Loading />;
  if (!q.data?.length) return null;
  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      <Txt variant="subheading">{t('branches.borrowTitle')}</Txt>
      <Txt variant="small" muted>{t('branches.borrowNote')}</Txt>
      {q.data.map((b) => (
        <ListItem key={b.membershipId} title={b.displayName} subtitle={b.fromStoreName} left={<Avatar name={b.displayName} />}
          right={b.busy ? <Badge tone="neutral" label={t('branches.busy')} /> : (
            <Button small variant="secondary" icon="swap-horizontal-outline" title={t('branches.borrow')} loading={busy === b.membershipId}
              onPress={async () => {
                if (await run(b.membershipId, () => api.borrow(shiftId, b.fromEmploymentId),
                  t('branches.borrowed', { name: b.displayName, store: b.fromStoreName }))) onDone();
              }} />
          )} />
      ))}
    </View>
  );
}
