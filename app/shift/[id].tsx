import { useQueries, useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { AttendanceView } from '@/api/types';
import { SHIFT_TONE, StatusBadge, useStores } from '@/components/domain';
import { SalesCard } from '@/components/salesCard';
import { BorrowList } from '@/components/branches';
import { useAction } from '@/components/toast';
import {
  Avatar, Badge, Button, Card, Empty, ErrorState, ListItem, Loading, Row, Screen, Section, Sheet, StaffingBar, Stepper, Txt, confirm,
} from '@/components/ui';
import { tv, useI18n } from '@/i18n';
import { useOrgKey, useTemplateNames } from '@/state/queries';
import { useApi, useSession } from '@/state/session';
import { ago, dateTime, dayLabel, hoursBetween, money, signupState, time, timeRange } from '@/utils/format';
import { wageText } from '@/utils/pay';

export default function ShiftScreen() {
  const { id, swapFrom } = useLocalSearchParams<{ id: string; swapFrom?: string }>();
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const { isManager, session } = useSession();
  const [run, busy] = useAction();
  const { stores } = useStores();
  const [assignOpen, setAssignOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const q = useQuery({ queryKey: ['shift', org, id], queryFn: () => api.shift(id) });
  const names = useTemplateNames(q.data?.shift.storeId ?? null);
  // stores with clock in / out: the owner sees when each person clocked, once the shift has started
  const storeId = q.data?.shift.storeId;
  const policy = useQuery({ queryKey: ['policy', org, storeId], queryFn: () => api.policy(storeId!), enabled: isManager && !!storeId });
  const clocked = isManager && !!q.data && Date.parse(q.data.shift.startsAt) <= Date.now() && !!policy.data?.rules?.attendance?.enabled;
  const clockQueries = useQueries({
    queries: (clocked ? q.data!.assignments : []).map((a) => ({ queryKey: ['attendance', org, a.id], queryFn: () => api.attendance(a.id) })),
  });
  const clockLine = (assignmentId: string) => {
    if (!clocked) return null;
    const events = clockQueries[q.data!.assignments.findIndex((a) => a.id === assignmentId)]?.data;
    return events ? clockText(events, t) : null;
  };

  if (q.isLoading) return <Screen><Loading /></Screen>;
  if (q.error || !q.data) return <Screen><ErrorState error={q.error} onRetry={q.refetch} /></Screen>;
  const { shift, assignments, requests } = q.data;
  const tz = shift.timezone;
  const store = stores.find((s) => s.id === shift.storeId);
  const editable = shift.status === 'draft' || shift.status === 'published';
  const upcoming = Date.parse(shift.startsAt) > Date.now();
  const mine = assignments.find((a) => a.userId === session?.userId);
  const myRequest = requests.find((r) => r.userId === session?.userId && (r.status === 'pending' || r.status === 'waitlisted'));
  const title = shift.templateId ? names[shift.templateId] ?? t('screens.shift') : t('schedule.extraShift');
  const openRequests = requests.filter((r) => r.status === 'pending' || r.status === 'waitlisted').length;

  return (
    <Screen onRefresh={q.refetch} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: dayLabel(shift.localDate) }} />
      <Card style={{ gap: 14, marginTop: 12 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Txt variant="small" muted>{store ? store.name : ''} · {dayLabel(shift.localDate)}</Txt>
            <Txt variant="title">{timeRange(shift.startsAt, shift.endsAt, tz)}</Txt>
            <Txt muted>{title} · {hoursBetween(shift.startsAt, shift.endsAt)}</Txt>
          </View>
          <Badge label={tv('status', shift.status)} tone={SHIFT_TONE[shift.status]} />
        </Row>
        {shift.status !== 'cancelled' ? <StaffingBar assigned={shift.assignedCount} min={shift.minStaff} optimal={shift.optimalStaff} max={shift.maxStaff} /> : null}
        {isManager && editable ? (
          <Row gap={8} wrap>
            {shift.status === 'draft' ? (
              <Button small title={t('shift.publish')} icon="megaphone-outline" loading={busy === 'publish'}
                onPress={() => run('publish', () => api.publishShift(shift.id), t('shift.publishedToast'))} />
            ) : null}
            {shift.status === 'published' && shift.openSlots > 0 ? (
              <Button small title={t('shift.assign')} icon="person-add-outline" onPress={() => setAssignOpen(true)} />
            ) : null}
            <Button small title={t('shift.staffing')} icon="options-outline" variant="secondary" onPress={() => setStaffOpen(true)} />
            <Button small title={t('shift.cancelShift')} icon="close-circle-outline" variant="danger" loading={busy === 'cancel'}
              onPress={async () => {
                if (await confirm(t('shift.cancelTitle'), t('shift.cancelMsg'), t('shift.cancelShift'), true)) {
                  run('cancel', () => api.cancelShift(shift.id), t('shift.cancelled'));
                }
              }} />
          </Row>
        ) : null}
        {!isManager && shift.status === 'published' && upcoming && !mine && !myRequest && !swapFrom && signupState(shift) !== 'open' ? (
          <Badge label={signupState(shift) === 'closed' ? t('find.closed') : t('find.opensAt', { when: dateTime(shift.registrationOpensAt, shift.timezone) })}
            tone={signupState(shift) === 'closed' ? 'neutral' : 'info'} icon={signupState(shift) === 'closed' ? 'lock-closed-outline' : 'time-outline'} />
        ) : !isManager && shift.status === 'published' && upcoming && !mine && !myRequest && !swapFrom ? (
          <Button title={shift.openSlots > 0 ? t('shift.want') : t('shift.waitlist')} icon="hand-right-outline" full loading={busy === 'register'}
            onPress={() => run('register', () => api.registerForShift(shift.id),
              (r) => r.status === 'approved' ? t('shift.booked') : r.status === 'waitlisted' ? t('shift.onWaitlist') : t('shift.requestSent'))} />
        ) : null}
        {mine ? <Badge label={t('shift.youWork')} tone="success" icon="checkmark-circle" /> : null}
        {myRequest ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <Badge label={myRequest.status === 'waitlisted' ? t('shift.onWaitlistBadge') : t('shift.waitingApproval')} tone="warning" icon="hourglass-outline" />
            <Button small variant="ghost" title={t('shift.withdraw')} loading={busy === 'withdraw'}
              onPress={() => run('withdraw', () => api.cancelRequest(myRequest.id), t('shift.withdrawn'))} />
          </Row>
        ) : null}
      </Card>

      <Section title={t('shift.who', { n: assignments.length })}>
        {assignments.length === 0 ? <Empty icon="person-outline" title={t('shift.nobody')} message={isManager ? t('shift.nobodyMgr') : t('shift.nobodyStaff')} />
          : assignments.map((a) => (
            <ListItem key={a.id} title={a.displayName}
              subtitle={[a.wageAmount != null ? wageText(a.wageAmount, a.wageBasis, a.currency) : null, a.replacesAssignmentId ? t('common.viaSwap') : null,
                clockLine(a.id)]
                .filter(Boolean).join(' · ') || undefined}
              left={<Avatar name={a.displayName} />}
              right={swapFrom && a.userId !== session?.userId ? (
                <Button small title={t('shift.offerSwap')} icon="swap-horizontal" loading={busy === `sw${a.id}`}
                  onPress={async () => {
                    const r = await run(`sw${a.id}`, () => api.proposeSwap(swapFrom, a.id), t('shift.swapOffered', { name: a.displayName }));
                    if (r) router.back();
                  }} />
              ) : isManager && !upcoming && shift.status !== 'cancelled' && ['assigned', 'completed', 'no_show'].includes(a.state) ? (
                a.state === 'no_show' ? (
                  <Row gap={6}>
                    <StatusBadge status={a.state} />
                    <Button small variant="ghost" title={t('shift.present')} loading={busy === `at${a.id}`}
                      onPress={() => run(`at${a.id}`, () => api.markAttendance(a.id, 'worked', t('shift.presentReason')), t('shift.markedPresent', { name: a.displayName }))} />
                  </Row>
                ) : (
                  <Button small variant="ghost" title={t('shift.absent')} loading={busy === `at${a.id}`}
                    onPress={async () => {
                      if (await confirm(t('shift.absentTitle', { name: a.displayName }), t('shift.absentMsg'), t('shift.absent'), true)) {
                        run(`at${a.id}`, () => api.markAttendance(a.id, 'no_show', t('shift.absentReason')), t('shift.markedAbsent', { name: a.displayName }));
                      }
                    }} />
                )
              ) : isManager && a.state === 'assigned' && upcoming ? (
                <Button small variant="ghost" title={t('common.remove')} loading={busy === `rm${a.id}`}
                  onPress={async () => {
                    if (await confirm(t('shift.removeTitle'), t('shift.removeMsg', { name: a.displayName }), t('common.remove'), true)) {
                      run(`rm${a.id}`, () => api.cancelAssignment(a.id), t('shift.removed'));
                    }
                  }} />
              ) : <StatusBadge status={a.state} />} />
          ))}
      </Section>

      <SalesCard shift={shift} assignments={assignments} />

      {isManager ? (
        <Section title={t('shift.requests', { n: openRequests })}>
          {requests.length === 0 ? <Txt muted>{t('shift.noRequests')}</Txt> : requests.map((r) => (
            <Card key={r.id} style={{ gap: 10 }}>
              <Row>
                <Avatar name={r.displayName} size={36} />
                <View style={{ flex: 1 }}>
                  <Txt variant="subheading">{r.displayName}</Txt>
                  <Txt variant="small" muted>{t('shift.asked', { ago: ago(r.requestedAt) })}</Txt>
                </View>
                <StatusBadge status={r.status} />
              </Row>
              {(r.status === 'pending' || r.status === 'waitlisted') ? (
                <Row gap={8}>
                  <Button small title={t('common.approve')} icon="checkmark" style={{ flex: 1 }} loading={busy === `a${r.id}`} disabled={shift.openSlots <= 0}
                    onPress={() => run(`a${r.id}`, () => api.approveRequest(r.id), t('shift.isBooked', { name: r.displayName }))} />
                  <Button small title={t('common.decline')} variant="secondary" style={{ flex: 1 }} loading={busy === `r${r.id}`}
                    onPress={() => run(`r${r.id}`, () => api.rejectRequest(r.id), t('owner.requestDeclined'))} />
                </Row>
              ) : null}
            </Card>
          ))}
        </Section>
      ) : null}

      {isManager ? (
        <>
          <AssignSheet visible={assignOpen} onClose={() => setAssignOpen(false)} shiftId={shift.id} storeId={shift.storeId}
            booked={assignments.map((a) => a.employmentId)} />
          <StaffingSheet visible={staffOpen} onClose={() => setStaffOpen(false)} shiftId={shift.id}
            initial={{ min: shift.minStaff, opt: shift.optimalStaff, max: shift.maxStaff }} />
        </>
      ) : null}
    </Screen>
  );
}

function AssignSheet({ visible, onClose, shiftId, storeId, booked }: { visible: boolean; onClose: () => void; shiftId: string; storeId: string; booked: string[] }) {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const team = useQuery({ queryKey: ['employees', org, storeId], queryFn: () => api.employees(storeId), enabled: visible });
  const free = (team.data ?? []).filter((e) => e.status === 'active' && !booked.includes(e.employmentId));
  return (
    <Sheet visible={visible} onClose={onClose} title={t('shift.assign')}>
      {team.isLoading ? <Loading /> : free.length === 0 ? <Txt muted>{t('shift.everyoneOn')}</Txt> : free.map((e) => (
        <ListItem key={e.employmentId} title={e.displayName} subtitle={wageText(e.currentWage, e.wageBasis, e.currency)} left={<Avatar name={e.displayName} />}
          right={<Button small title={t('shift.assign')} loading={busy === e.employmentId}
            onPress={async () => { if (await run(e.employmentId, () => api.assign(shiftId, e.employmentId), t('shift.assigned', { name: e.displayName }))) onClose(); }} />} />
      ))}
      <BorrowList shiftId={shiftId} visible={visible} onDone={onClose} />
    </Sheet>
  );
}

function StaffingSheet({ visible, onClose, shiftId, initial }: { visible: boolean; onClose: () => void; shiftId: string; initial: { min: number; opt: number; max: number } }) {
  const api = useApi();
  const { t } = useI18n();
  const [run, busy] = useAction();
  const [min, setMin] = useState(initial.min);
  const [opt, setOpt] = useState(initial.opt);
  const [max, setMax] = useState(initial.max);
  return (
    <Sheet visible={visible} onClose={onClose} title={t('shift.staffingTitle')}>
      <Stepper label={t('shift.minimum')} value={min} onChange={(v) => { setMin(v); if (v > opt) setOpt(v); if (v > max) setMax(v); }} />
      <Stepper label={t('shift.ideal')} value={opt} onChange={(v) => { setOpt(v); if (v < min) setMin(v); if (v > max) setMax(v); }} />
      <Stepper label={t('shift.maximum')} value={max} min={1} onChange={(v) => { setMax(v); if (v < opt) setOpt(v); if (v < min) setMin(v); }} />
      <Button title={t('common.save')} icon="checkmark" full loading={busy === 'save'}
        onPress={async () => { if (await run('save', () => api.updateStaffing(shiftId, min, opt, max), t('shift.staffingSaved'))) onClose(); }} />
    </Sheet>
  );
}

/** "In 08:03 · Out 13:01" from a person's clock events on a shift. */
function clockText(events: AttendanceView[], t: (key: string, params?: Record<string, string | number>) => string) {
  const clockIn = events.find((e) => e.type === 'clock_in');
  const clockOut = [...events].reverse().find((e) => e.type === 'clock_out');
  if (!clockIn) return t('attendance.none');
  return clockOut ? t('attendance.times', { in: time(clockIn.occurredAt), out: time(clockOut.occurredAt) })
    : t('attendance.inOnly', { in: time(clockIn.occurredAt) });
}
