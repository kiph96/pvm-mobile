import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { View } from 'react-native';

import { StatusBadge, codeLabel, useStores } from '@/components/domain';
import { useAction } from '@/components/toast';
import { Button, Card, Empty, Loading, Row, Screen, Segmented, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi, useSession } from '@/state/session';
import { ago } from '@/utils/format';

export default function Violations() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { isManager } = useSession();
  const [run, busy] = useAction();
  const { stores } = useStores();
  const [filter, setFilter] = useState<'reported' | 'confirmed' | 'all'>(isManager ? 'reported' : 'all');
  const list = useQuery({ queryKey: ['violations', org, 'list', filter], queryFn: () => api.violations(filter === 'all' ? {} : { status: filter }) });
  const team = useQuery({
    queryKey: ['team-names', org, stores.map((s) => s.id).join()],
    queryFn: async () => (await Promise.all(stores.map((s) => api.employees(s.id)))).flat(),
    enabled: isManager && stores.length > 0,
  });
  const nameOf = (eid: string) => team.data?.find((e) => e.employmentId === eid)?.displayName;

  return (
    <Screen onRefresh={list.refetch} refreshing={list.isRefetching}>
      <View style={{ marginTop: 12, marginBottom: 14 }}>
        <Segmented value={filter} onChange={setFilter} options={[
          { value: 'reported', label: t('violations.toReview') }, { value: 'confirmed', label: t('violations.confirmed') }, { value: 'all', label: t('violations.all') },
        ]} />
      </View>
      <View style={{ gap: 10 }}>
        {list.isLoading ? <Loading /> : (list.data ?? []).length === 0 ? (
          <Empty icon="happy-outline" title={t('violations.none')} message={t('violations.noneMsg')} />
        ) : list.data!.map((v) => (
          <Card key={v.id} style={{ gap: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Txt variant="subheading">{nameOf(v.employmentId) ?? codeLabel(v.code)}</Txt>
                <Txt variant="small" muted>
                  {[codeLabel(v.code), v.points ? t('violations.pts', { n: v.points }) : null, (stores.find((s) => s.id === v.storeId)?.name ?? ''), ago(v.occurredAt)]
                    .filter(Boolean).join(' · ')}
                </Txt>
              </View>
              <StatusBadge status={v.status} />
            </Row>
            <Txt>{v.description}</Txt>
            {isManager && v.status === 'reported' ? (
              <Row gap={8}>
                <Button small title={t('violations.confirm')} icon="checkmark" variant="accent" style={{ flex: 1 }} loading={busy === `c${v.id}`}
                  onPress={() => run(`c${v.id}`, () => api.violationAction(v.id, 'confirm'), t('violations.confirmedToast'))} />
                <Button small title={t('violations.dismiss')} variant="secondary" style={{ flex: 1 }} loading={busy === `d${v.id}`}
                  onPress={() => run(`d${v.id}`, () => api.violationAction(v.id, 'dismiss'), t('violations.dismissed'))} />
              </Row>
            ) : isManager && v.status === 'confirmed' ? (
              <Button small title={t('violations.reverse')} variant="ghost" loading={busy === `r${v.id}`}
                onPress={() => run(`r${v.id}`, () => api.violationAction(v.id, 'reverse'), t('violations.reversed'))} />
            ) : null}
          </Card>
        ))}
      </View>
    </Screen>
  );
}
