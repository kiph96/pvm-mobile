import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { AttendanceBonusBoard } from '@/api/types';
import { codeLabel } from '@/components/domain';
import { PeriodPicker, usePeriodRange } from '@/components/periodPicker';
import { Badge, Card, Empty, ErrorState, Loading, Row, Screen, Sheet, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi } from '@/state/session';
import { useTheme } from '@/theme';
import { dayLabel, localDateOf, money } from '@/utils/format';

type Row = AttendanceBonusBoard['rows'][number];

/**
 * "Bảng điểm chuyên cần", like the owner's sheet: everyone starts the period with the store's attendance bonus;
 * confirmed penalty points and damaged property come off it; what is left is paid with their pay.
 */
export default function AttendanceBonus() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { colors, radius } = useTheme();
  const picker = usePeriodRange();
  const { from, to } = picker.range;
  const [open, setOpen] = useState<Row | null>(null);
  const board = useQuery({ queryKey: ['attendanceBonus', org, from, to], queryFn: () => api.attendanceBonus(from, to) });
  const rows = board.data?.rows ?? [];
  const cur = rows[0]?.currency ?? 'VND';
  const amt = (v: number) => money(v, cur).replace(/\s*₫$/, '');
  const unit = money(0, cur).replace(/^[\d.,\s]+/, '') || cur;
  const line = { borderBottomWidth: 1, borderColor: colors.border };
  const row = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 10, minHeight: 48 };
  const num = { width: 72, alignItems: 'flex-end' as const };
  const left = { width: 96, alignItems: 'flex-end' as const };
  const bold = { fontWeight: '700' as const };

  return (
    <Screen onRefresh={board.refetch} refreshing={board.isRefetching}>
      <PeriodPicker p={picker} />
      {board.isLoading ? <Loading /> : board.error ? <ErrorState error={board.error} onRetry={board.refetch} />
        : rows.length === 0 ? <Empty icon="ribbon-outline" title={t('bonus.off')} message={t('bonus.offMsg')} /> : (
          <View style={{ gap: 8 }}>
            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden' }}>
              <View style={[row, line, { minHeight: 36 }]}>
                <Txt variant="tiny" color={colors.textMuted} style={{ flex: 1 }}>{t('summary.name').toUpperCase()}</Txt>
                <View style={num}><Txt variant="tiny" color={colors.textMuted}>{t('bonus.points').toUpperCase()}</Txt></View>
                <View style={left}><Txt variant="tiny" color={colors.textMuted}>{t('bonus.remaining').toUpperCase()}</Txt></View>
              </View>
              {rows.map((r) => {
                const cut = r.remaining < r.base;
                return (
                  <Pressable key={r.employmentId} onPress={() => setOpen(r)} accessibilityRole="button" accessibilityLabel={r.displayName}
                    style={({ pressed }) => [row, line, pressed && { backgroundColor: colors.surfaceAlt }]}>
                    <View style={{ flex: 1 }}>
                      <Txt variant="small" style={bold} numberOfLines={1}>{r.displayName}</Txt>
                      {r.pending ? <Txt variant="tiny" color={colors.warning}>{t('bonus.pending', { n: r.pending })}</Txt> : null}
                    </View>
                    <View style={num}><Txt variant="small" color={r.points ? colors.danger : colors.textMuted}>{r.points ? -r.points : 0}</Txt></View>
                    <View style={left}><Txt variant="small" style={bold} color={cut ? colors.danger : undefined}>{amt(r.remaining)}</Txt></View>
                  </Pressable>
                );
              })}
              <View style={[row, { backgroundColor: colors.surfaceAlt }]}>
                <Txt variant="small" style={[bold, { flex: 1 }]}>{t('summary.all')}</Txt>
                <View style={num}><Txt variant="small" style={bold}>{-rows.reduce((n, r) => n + r.points, 0)}</Txt></View>
                <View style={left}><Txt variant="small" style={bold}>{amt(rows.reduce((n, r) => n + r.remaining, 0))}</Txt></View>
              </View>
            </View>
            <Txt variant="small" muted>{t('bonus.tapHint', { unit })}</Txt>
          </View>
        )}
      <DetailSheet row={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}

/** One person: each violation of the period, and how the bonus left is worked out. */
function DetailSheet({ row: r, onClose }: { row: Row | null; onClose: () => void }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  if (!r) return <Sheet visible={false} onClose={onClose} title="">{null}</Sheet>;
  const cur = r.currency;
  return (
    <Sheet visible={!!r} onClose={onClose} title={r.displayName}>
      <Txt variant="small" muted>{r.storeName}</Txt>
      {r.items.length === 0 ? <Txt muted>{t('bonus.none')}</Txt> : r.items.map((v) => (
        <Card key={v.violationId} style={{ gap: 4, opacity: v.status === 'reported' ? 0.7 : 1 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="subheading" style={{ flex: 1 }}>{codeLabel(v.code)}</Txt>
            <Txt variant="subheading" color={colors.danger}>{v.points ?? 0}</Txt>
          </Row>
          <Txt variant="small" muted>{dayLabel(localDateOf(v.occurredAt))} · {v.description}</Txt>
          {v.damageAmount ? <Txt variant="small" color={colors.danger}>{t('bonus.damage')}: −{money(v.damageAmount, cur)}</Txt> : null}
          {v.status === 'reported' ? <Badge tone="warning" icon="hourglass-outline" label={t('bonus.pendingNote')} /> : null}
        </Card>
      ))}
      <Card style={{ gap: 6 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt muted>{t('bonus.base')}</Txt><Txt>{money(r.base, cur)}</Txt>
        </Row>
        <Txt variant="small" muted>
          {t('bonus.calc', { base: money(r.base, cur), points: r.points, per: money(r.perPoint, cur), damages: money(r.damages, cur),
            left: money(r.remaining, cur) })}
        </Txt>
        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt style={{ fontWeight: '700' }}>{t('bonus.remaining')}</Txt>
          <Txt style={{ fontWeight: '700' }}>{money(r.remaining, cur)}</Txt>
        </Row>
      </Card>
    </Sheet>
  );
}
