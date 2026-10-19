import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import type { StoreView } from '@/api/types';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';
import { useTheme } from '@/theme';
import { Badge, Button, Card, Row, Txt } from './ui';

/**
 * Owner checklist for a new owner: store → shift templates → staff. The schedule then fills itself
 * from the templates (server auto-fill, two weeks ahead).
 * Each step links to where it is done; the card disappears once everything is set up.
 */
export function GettingStarted({ stores, storesLoaded }: { stores: StoreView[]; storesLoaded: boolean }) {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { colors } = useTheme();
  const first = stores[0]?.id ?? null;
  const templates = useQuery({ queryKey: ['templates', org, first], queryFn: () => api.templates(first!), enabled: !!first });
  const team = useQuery({ queryKey: ['employees', org, first], queryFn: () => api.employees(first!), enabled: !!first });

  if (!storesLoaded || (first && (templates.isLoading || team.isLoading))) return null;
  const steps = [
    { key: 'store', done: stores.length > 0, go: () => router.push('/owner/stores?add=1') },
    { key: 'templates', done: (templates.data ?? []).length > 0, go: () => router.push(`/store/${first}`) },
    { key: 'staff', done: (team.data ?? []).some((e) => e.status !== 'ended'), go: () => router.push('/owner/team?invite=1') },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const next = steps.find((s) => !s.done)!;

  return (
    <Card style={{ gap: 14, marginBottom: 16, borderColor: colors.primary, borderWidth: 1.5 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="heading">🚀 {t('onboarding.title')}</Txt>
        <Badge tone="primary" label={t('onboarding.progress', { done: doneCount, total: steps.length })} />
      </Row>
      <Txt variant="small" muted>{t('onboarding.intro')}</Txt>
      {steps.map((s, i) => {
        // later steps need a store first
        const blocked = i > 0 && !first;
        return (
          <Row key={s.key} gap={12} style={{ opacity: blocked ? 0.5 : 1 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
              backgroundColor: s.done ? colors.success : colors.surfaceAlt }}>
              {s.done ? <Ionicons name="checkmark" size={18} color="#fff" /> : <Txt variant="small" muted>{i + 1}</Txt>}
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="subheading" style={s.done ? { textDecorationLine: 'line-through', color: colors.textMuted } : undefined}>
                {t(`onboarding.${s.key}`)}
              </Txt>
              {!s.done ? <Txt variant="small" muted>{t(`onboarding.${s.key}Hint`)}</Txt> : null}
            </View>
            {!s.done && s === next ? <Button small title={t('onboarding.go')} onPress={s.go} /> : null}
          </Row>
        );
      })}
    </Card>
  );
}
