import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';

import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';
import { useAction } from './toast';
import { useStores } from './domain';
import { Button, Card, Chip, Row, Section, Txt } from './ui';

/**
 * Owner, on a staff member's page: the stores they manage ("Quản lý"). Managers approve shifts, swaps, timesheets and
 * violations and move staff at those stores; no wages, payroll or store settings.
 */
export function ManagerStoresSection({ employmentId }: { employmentId: string }) {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const { stores } = useStores();
  const q = useQuery({ queryKey: ['managerStores', org, employmentId], queryFn: () => api.managerStores(employmentId) });
  const [chosen, setChosen] = useState<string[]>([]);
  useEffect(() => { if (q.data) setChosen(q.data.storeIds); }, [q.data]);
  if (!q.data) return null;
  const dirty = JSON.stringify([...chosen].sort()) !== JSON.stringify([...q.data.storeIds].sort());
  const toggle = (id: string) => setChosen((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  return (
    <Section title={t('managers.title')}>
      <Card style={{ gap: 12 }}>
        <Txt variant="small" muted>{t('managers.hint')}</Txt>
        <Row gap={8} wrap>
          {stores.map((s) => <Chip key={s.id} icon={chosen.includes(s.id) ? 'briefcase' : 'briefcase-outline'} label={s.name}
            selected={chosen.includes(s.id)} onPress={() => toggle(s.id)} />)}
        </Row>
        {!chosen.length ? <Txt variant="small" muted>{t('managers.none')}</Txt> : null}
        {dirty ? <Button title={t('managers.save')} icon="checkmark" full loading={busy === 'mgr'}
          onPress={() => run('mgr', () => api.setManagerStores(employmentId, chosen), t('managers.saved'))} /> : null}
      </Card>
    </Section>
  );
}
