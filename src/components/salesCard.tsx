import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { AssignmentView, SaleView, ShiftView } from '@/api/types';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi, useSession } from '@/state/session';
import { useTheme } from '@/theme';
import { money, pct, time } from '@/utils/format';
import { useAction } from './toast';
import { Badge, Button, Card, Chip, Field, Row, Section, Sheet, Txt, confirm } from './ui';

/**
 * Sales on a shift (stores with "sales & commission" on): staff record what they sell and see the
 * commission they earn; owners see everyone's sales, can record for someone and void mistakes.
 */
export function SalesCard({ shift, assignments }: { shift: ShiftView; assignments: AssignmentView[] }) {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { isManager } = useSession();
  const [run, busy] = useAction();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['sales', org, shift.id], queryFn: () => api.shiftSales(shift.id) });
  const d = q.data;
  if (!d || (!d.enabled && d.sales.length === 0)) return null;
  const cur = d.currency;

  const voidSale = async (s: SaleView) => {
    if (await confirm(t('sales.voidTitle'), t('sales.voidMsg', { amount: money(s.amount, cur) }), t('sales.void'), true)) {
      run(`v${s.id}`, () => api.voidSale(s.id), t('sales.voided'));
    }
  };

  return (
    <Section title={t('sales.title')} action={d.canRecord ? t('sales.record') : undefined} onAction={() => setOpen(true)}>
      <Card style={{ gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Txt variant="small" muted>{isManager ? t('sales.totalAll') : t('sales.totalMine')}</Txt>
            <Txt variant="title">{money(d.totalSales, cur)}</Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt variant="small" muted>{t('sales.commission', { pct: pct(d.commissionPercent) })}</Txt>
            <Txt variant="heading" color={colors.success}>+{money(d.totalCommission, cur)}</Txt>
          </View>
        </Row>
        {!d.enabled ? <Txt variant="small" muted>{t('sales.turnedOff')}</Txt>
          : !d.canRecord && !isManager ? <Txt variant="small" muted>{t('sales.windowNote')}</Txt> : null}
        {d.canRecord ? <Button icon="add-circle-outline" title={t('sales.record')} onPress={() => setOpen(true)} full /> : null}
      </Card>

      {d.sales.length === 0 ? <Txt variant="small" muted>{t('sales.none')}</Txt> : [...d.sales].reverse().map((s) => (
        <Card key={s.id} style={{ gap: 6, opacity: s.status === 'voided' ? 0.55 : 1 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Txt variant="subheading" style={s.status === 'voided' ? { textDecorationLine: 'line-through' } : undefined}>
                {money(s.amount, cur)}
              </Txt>
              <Txt variant="small" muted>
                {[time(s.soldAt, shift.timezone), isManager ? s.displayName : null, s.note].filter(Boolean).join(' · ')}
              </Txt>
            </View>
            {s.status === 'voided' ? <Badge label={t('sales.voidedBadge')} tone="neutral" />
              : <Txt variant="small" color={colors.success}>+{money(s.commissionAmount, cur)} ({pct(s.commissionPercent)}%)</Txt>}
          </Row>
          {s.status === 'voided' && s.voidReason ? <Txt variant="tiny" muted>{s.voidReason}</Txt> : null}
          {s.paid ? <Badge label={t('sales.paid')} tone="success" icon="wallet-outline" /> : null}
          {s.canVoid ? (
            <Row style={{ justifyContent: 'flex-end' }}>
              <Button small variant="ghost" title={t('sales.void')} icon="close-circle-outline" loading={busy === `v${s.id}`} onPress={() => voidSale(s)} />
            </Row>
          ) : null}
        </Card>
      ))}

      <RecordSheet visible={open} onClose={() => setOpen(false)} shift={shift} percent={d.commissionPercent} currency={cur}
        people={isManager ? assignments.filter((a) => a.state !== 'cancelled') : []} />
    </Section>
  );
}

function RecordSheet({ visible, onClose, shift, percent, currency, people }: {
  visible: boolean; onClose: () => void; shift: ShiftView; percent: number; currency: string; people: AssignmentView[];
}) {
  const api = useApi();
  const { t } = useI18n();
  const { colors } = useTheme();
  const [run, busy] = useAction();
  const [raw, setRaw] = useState('');
  const [note, setNote] = useState('');
  const [who, setWho] = useState<string | null>(null);
  const amount = Number(raw.replace(/\D/g, '')) || 0;
  const chosen = people.length ? who ?? people[0]?.employmentId ?? null : null;
  const close = () => { setRaw(''); setNote(''); onClose(); };
  return (
    <Sheet visible={visible} onClose={close} title={t('sales.recordTitle')}>
      {people.length ? (
        <>
          <Txt variant="small" muted>{t('sales.seller')}</Txt>
          <Row gap={8} wrap>{people.map((a) => (
            <Chip key={a.employmentId} label={a.displayName} selected={chosen === a.employmentId} onPress={() => setWho(a.employmentId)} />
          ))}</Row>
        </>
      ) : null}
      {/* digits with thousand separators, no currency sign, so deleting keeps working */}
      <Field label={t('sales.amount', { currency })} value={amount ? money(amount, currency).replace(/\s?(₫|[A-Z]{3})$/, '').replace(/^\$/, '') : ''}
        keyboardType="number-pad"
        onChangeText={(v) => setRaw(v.replace(/\D/g, ''))} placeholder="1.500.000" autoFocus />
      <Field label={t('sales.note')} value={note} onChangeText={setNote} placeholder={t('sales.notePlaceholder')} maxLength={200} />
      {amount > 0 ? (
        <Txt variant="small" color={colors.success}>
          {t('sales.preview', { pct: pct(percent), amount: money(Math.round(amount * percent / 100), currency) })}
        </Txt>
      ) : null}
      <Button title={t('sales.save')} icon="checkmark" full disabled={amount <= 0} loading={busy === 'rec'}
        onPress={async () => {
          const r = await run('rec', () => api.recordSale(shift.id, { amount, note: note.trim() || null, employmentId: chosen }),
            t('sales.saved', { amount: money(amount, currency) }));
          if (r) close();
        }} />
    </Sheet>
  );
}
