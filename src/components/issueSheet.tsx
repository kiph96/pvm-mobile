import React, { useState } from 'react';

import { useI18n } from '@/i18n';
import { useApi } from '@/state/session';
import { money } from '@/utils/format';
import { codeLabel } from './domain';
import { useAction } from './toast';
import { Button, Chip, Field, Row, Sheet, Stepper, Txt } from './ui';

/**
 * Report a violation (owner, or a store manager): the store's codes, this case's points (the same violation can weigh
 * more one time than another) and, for damaged property, its value. Pass `people` to pick who it is about.
 */
export function IssueSheet({ visible, onClose, employmentId, people, codes }: {
  visible: boolean; onClose: () => void; codes: Record<string, { points: number }>;
  employmentId?: string; people?: { employmentId: string; displayName: string }[];
}) {
  const api = useApi();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const [who, setWho] = useState<string | null>(employmentId ?? null);
  const [code, setCode] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState(1);
  const [damage, setDamage] = useState('');
  const damageAmount = Number(damage.replace(/[^\d]/g, ''));
  const target = employmentId ?? who;
  const pick = (c: string) => { setCode(c); setPoints(Math.max(1, -(codes[c]?.points ?? -1))); };
  const report = () => api.reportViolation({
    employmentId: target!, code: code!, description,
    points: code && points !== -(codes[code]?.points ?? 0) ? -points : undefined,
    damageAmount: damageAmount > 0 ? damageAmount : undefined,
  });
  return (
    <Sheet visible={visible} onClose={onClose} title={t('employee.reportTitle')}>
      {people ? (
        <Row gap={8} wrap>
          {people.map((p) => <Chip key={p.employmentId} label={p.displayName} selected={who === p.employmentId} onPress={() => setWho(p.employmentId)} />)}
        </Row>
      ) : null}
      <Row gap={8} wrap>
        {Object.entries(codes).map(([c, v]) => <Chip key={c} label={`${codeLabel(c)} (${v.points})`} selected={code === c} onPress={() => pick(c)} />)}
      </Row>
      {code ? <Stepper label={t('bonus.customPoints')} value={points} min={1} max={20} onChange={setPoints} /> : null}
      <Field label={t('employee.whatHappened')} value={description} onChangeText={setDescription} multiline style={{ minHeight: 80 }} />
      {code === 'DAMAGE' ? (
        <Field label={t('bonus.damageAmount')} value={damage} onChangeText={setDamage} keyboardType="numeric"
          hint={damageAmount > 0 ? money(damageAmount) : t('bonus.damageHint')} />
      ) : null}
      <Txt variant="small" muted>{t('employee.reportNote')}</Txt>
      <Button title={t('employee.report')} icon="flag-outline" full loading={busy === 'v'} disabled={!target || !code || !description.trim()}
        onPress={async () => { if (await run('v', report, t('employee.reported'))) onClose(); }} />
    </Sheet>
  );
}
