// In-memory implementation of the API used by "Explore demo" mode.
// It mirrors the backend rules closely enough to try every screen offline:
// two businesses (K Coffee House, Lan Tea Corner), three stores, shifts
// generated around today, requests, swaps, attendance, points and payroll.
import { t } from '@/i18n';
import { DEFAULT_PAY, estimatePay, payRulesOf, type WageBasis } from '@/utils/pay';

import { ApiError, type Actor, type Api } from './http';
import type * as T from './types';

const TZ = 'Asia/Ho_Chi_Minh';
const OFFSET = '+07:00';
const DAY = 86_400_000;

let seq = 1000;
const id = (prefix = 'f') => `${prefix}${(seq++).toString(16).padStart(7, '0')}-0000-4000-8000-${Date.now().toString(16).slice(-12).padStart(12, '0')}`;
const nowIso = () => new Date().toISOString();
const localDate = (offsetDays: number) => new Date(Date.now() + 7 * 3600_000 + offsetDays * DAY).toISOString().slice(0, 10);
const at = (date: string, time: string, plusDays = 0) => {
  const d = plusDays ? new Date(Date.parse(`${date}T00:00:00Z`) + plusDays * DAY).toISOString().slice(0, 10) : date;
  return `${d}T${time.slice(0, 5)}:00${OFFSET}`;
};
const isoWeekday = (date: string) => ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

// --------------------------------------------------------------------- data
interface User { id: string; displayName: string; email: string }
interface Membership { id: string; org: string; userId: string; role: T.OrgRole }
interface Employment { id: string; org: string; storeId: string; membershipId: string; status: string; startedAt: string; endedAt: string | null }
interface Rate { id: string; employmentId: string; amount: number; basis: WageBasis; validFrom: string; validTo: string | null }
interface Shift extends Omit<T.ShiftView, 'assignedCount' | 'belowMinimum' | 'openSlots' | 'registrationOpensAt' | 'registrationClosesAt'> { org: string }
interface Assignment { id: string; org: string; shiftId: string; employmentId: string; state: T.AssignmentView['state']; wage: number; basis: WageBasis; replaces: string | null }
interface Request { id: string; org: string; shiftId: string; employmentId: string; status: T.RequestView['status']; requestedAt: string; decidedAt: string | null; assignmentId: string | null }
interface Swap { id: string; org: string; from: string; to: string; status: T.SwapView['status']; requestedBy: string; acceptedBy: string | null; approvedBy: string | null; expiresAt: string; acceptedAt: string | null; decidedAt: string | null; newFrom: string | null; newTo: string | null }
interface Enrollment { id: string; org: string; storeId: string; userId: string; status: string; requestedAt: string; decidedAt: string | null; employmentId: string | null }
interface Violation extends T.ViolationView { org: string }
interface Points { id: string; employmentId: string; delta: number; kind: string; reason: string; effectiveAt: string }
/** title is a function so it is rendered in the language chosen when the feed is read. */
interface Notice { id: string; org: string; to: string; eventType: string; title: () => string; availableAt: string; deliveredAt: string | null }

const U = (n: number) => `10000000-0000-4000-8000-00000000000${n}`;
const ORG1 = 'a0000000-0000-4000-8000-000000000001';
const ORG2 = 'a0000000-0000-4000-8000-000000000002';
const D1 = 'b0000000-0000-4000-8000-000000000001';
const D3 = 'b0000000-0000-4000-8000-000000000002';
const TD = 'b0000000-0000-4000-8000-000000000003';

export const DEMO_USERS = [
  { id: U(1), displayName: 'Nguyen Van Minh', hintKey: 'hintOwner1' },
  { id: U(2), displayName: 'Tran Thi Lan', hintKey: 'hintOwner2' },
  { id: U(3), displayName: 'Le Hoang An', hintKey: 'hintAn' },
  { id: U(5), displayName: 'Vo Thi Chi', hintKey: 'hintChi' },
  { id: U(6), displayName: 'Do Minh Dung', hintKey: 'hintDung' },
] as const;

function seed() {
  const users: User[] = [
    { id: U(1), displayName: 'Nguyen Van Minh', email: 'minh.kcoffee@gmail.com' },
    { id: U(2), displayName: 'Tran Thi Lan', email: 'lan.teacorner@gmail.com' },
    { id: U(3), displayName: 'Le Hoang An', email: 'an.le.parttime@gmail.com' },
    { id: U(4), displayName: 'Pham Quoc Binh', email: 'binh.pham@gmail.com' },
    { id: U(5), displayName: 'Vo Thi Chi', email: 'chi.vo@gmail.com' },
    { id: U(6), displayName: 'Do Minh Dung', email: 'dung.do@gmail.com' },
    { id: U(7), displayName: 'Hoang Thu Em', email: 'em.hoang@gmail.com' },
  ];
  const orgs = [
    { id: ORG1, name: 'K Coffee House', billingTimezone: TZ },
    { id: ORG2, name: 'Lan Tea Corner', billingTimezone: TZ },
  ];
  const M = (n: number) => `a1000000-0000-4000-8000-00000000000${n}`;
  const memberships: Membership[] = [
    { id: M(1), org: ORG1, userId: U(1), role: 'owner' },
    { id: M(2), org: ORG1, userId: U(3), role: 'employee' },
    { id: M(3), org: ORG1, userId: U(4), role: 'employee' },
    { id: M(4), org: ORG1, userId: U(5), role: 'employee' },
    { id: M(5), org: ORG1, userId: U(6), role: 'employee' },
    { id: M(6), org: ORG2, userId: U(2), role: 'owner' },
    { id: M(7), org: ORG2, userId: U(6), role: 'employee' },
  ];
  const stores: (T.StoreView & { org: string })[] = [
    { id: D1, org: ORG1, name: 'K Coffee - District 1', timezone: TZ, currency: 'VND', status: 'active', openedAt: '2025-12-15T06:00:00+07:00' },
    { id: D3, org: ORG1, name: 'K Coffee - District 3', timezone: TZ, currency: 'VND', status: 'active', openedAt: '2026-02-20T06:00:00+07:00' },
    { id: TD, org: ORG2, name: 'Lan Tea - Thu Duc', timezone: TZ, currency: 'VND', status: 'active', openedAt: '2026-01-15T06:00:00+07:00' },
  ];
  const E = (n: number) => `b1000000-0000-4000-8000-00000000000${n}`;
  const employments: Employment[] = [
    { id: E(1), org: ORG1, storeId: D1, membershipId: M(2), status: 'active', startedAt: '2026-01-05T00:00:00+07:00', endedAt: null },
    { id: E(2), org: ORG1, storeId: D3, membershipId: M(2), status: 'active', startedAt: '2026-03-01T00:00:00+07:00', endedAt: null },
    { id: E(3), org: ORG1, storeId: D1, membershipId: M(3), status: 'active', startedAt: '2026-02-01T00:00:00+07:00', endedAt: null },
    { id: E(4), org: ORG1, storeId: D1, membershipId: M(4), status: 'active', startedAt: '2026-02-01T00:00:00+07:00', endedAt: null },
    { id: E(5), org: ORG1, storeId: D3, membershipId: M(5), status: 'active', startedAt: '2026-04-01T00:00:00+07:00', endedAt: null },
    { id: E(6), org: ORG2, storeId: TD, membershipId: M(7), status: 'active', startedAt: '2026-03-15T00:00:00+07:00', endedAt: null },
  ];
  const rates: Rate[] = [
    { id: id('b2'), employmentId: E(1), amount: 30000, basis: 'hourly', validFrom: '2026-01-05T00:00:00+07:00', validTo: null },
    { id: id('b2'), employmentId: E(2), amount: 32000, basis: 'hourly', validFrom: '2026-03-01T00:00:00+07:00', validTo: null },
    { id: id('b2'), employmentId: E(3), amount: 28000, basis: 'hourly', validFrom: '2026-02-01T00:00:00+07:00', validTo: '2026-10-01T00:00:00+07:00' },
    { id: id('b2'), employmentId: E(3), amount: 29000, basis: 'hourly', validFrom: '2026-10-01T00:00:00+07:00', validTo: null },
    { id: id('b2'), employmentId: E(4), amount: 27000, basis: 'hourly', validFrom: '2026-02-01T00:00:00+07:00', validTo: null },
    { id: id('b2'), employmentId: E(5), amount: 31000, basis: 'hourly', validFrom: '2026-04-01T00:00:00+07:00', validTo: null },
    { id: id('b2'), employmentId: E(6), amount: 26000, basis: 'hourly', validFrom: '2026-03-15T00:00:00+07:00', validTo: null },
  ];
  const baseRules: T.PolicyRules = {
    registration: { opens_days_before: 14, closes_hours_before: 12 },
    attendance: { late_grace_minutes: 5, early_leave_grace_minutes: 5 },
    points: { allow_negative_balance: true },
    violations: { LATE: { points: -5 }, NO_SHOW: { points: -20 }, EARLY_LEAVE: { points: -3 }, MISSED_CLOCK_OUT: { points: -2 } },
    awards: { PERFECT_SHIFT: { points: 2 }, ON_TIME_STREAK_10: { points: 10 } },
    rewards: { MONTHLY_BONUS: { min_points: 10, points_cost: 10, amount: 50000, window: 'calendar_month' } },
    pay: DEFAULT_PAY,
  };
  const policies: Record<string, T.PolicyView> = {
    [D1]: { id: id('c2'), version: 1, effectiveFrom: '2025-12-15T00:00:00+07:00', employeeLimit: 10, employeeLimitMode: 'advisory', minStaff: 1, optimalStaff: 2, maxStaff: 4, registrationMode: 'owner_approval', swapApprovalRequired: true, rules: baseRules },
    [D3]: { id: id('c2'), version: 1, effectiveFrom: '2026-02-20T00:00:00+07:00', employeeLimit: 10, employeeLimitMode: 'advisory', minStaff: 1, optimalStaff: 2, maxStaff: 4, registrationMode: 'owner_approval', swapApprovalRequired: true, rules: baseRules },
    [TD]: { id: id('c2'), version: 1, effectiveFrom: '2026-01-15T00:00:00+07:00', employeeLimit: 5, employeeLimitMode: 'hard', minStaff: 1, optimalStaff: 1, maxStaff: 2, registrationMode: 'automatic', swapApprovalRequired: false, rules: { ...baseRules, violations: { LATE: { points: -3 }, NO_SHOW: { points: -15 } } } },
  };
  const all = [1, 2, 3, 4, 5, 6, 7];
  const templates: T.TemplateView[] = [
    { id: id('d0'), storeId: D1, name: 'Morning', localStart: '06:00', localEnd: '12:00', overnight: false, weekdays: all, minStaff: 2, optimalStaff: 3, maxStaff: 3, status: 'active' },
    { id: id('d0'), storeId: D1, name: 'Afternoon', localStart: '12:00', localEnd: '18:00', overnight: false, weekdays: all, minStaff: null, optimalStaff: null, maxStaff: null, status: 'active' },
    { id: id('d0'), storeId: D1, name: 'Evening', localStart: '18:00', localEnd: '22:30', overnight: false, weekdays: all, minStaff: null, optimalStaff: null, maxStaff: null, status: 'active' },
    { id: id('d0'), storeId: D3, name: 'Morning', localStart: '07:00', localEnd: '13:00', overnight: false, weekdays: [1, 2, 3, 4, 5], minStaff: null, optimalStaff: null, maxStaff: null, status: 'active' },
    { id: id('d0'), storeId: D3, name: 'Afternoon', localStart: '13:00', localEnd: '19:00', overnight: false, weekdays: all, minStaff: null, optimalStaff: null, maxStaff: null, status: 'active' },
    { id: id('d0'), storeId: TD, name: 'Night Owl', localStart: '22:00', localEnd: '06:00', overnight: true, weekdays: [5, 6], minStaff: 1, optimalStaff: 1, maxStaff: 2, status: 'active' },
  ];
  return { users, orgs, memberships, stores, employments, rates, policies, templates,
    shifts: [] as Shift[], assignments: [] as Assignment[], requests: [] as Request[], swaps: [] as Swap[],
    enrollments: [] as Enrollment[], violations: [] as Violation[], points: [] as Points[], notices: [] as Notice[],
    attendance: [] as (T.AttendanceView & { org: string })[], periods: [] as (T.PeriodView & { org: string })[],
    runs: [] as T.RunView[], accessKeys: {} as Record<string, T.AccessKeyView>,
    digest: {} as Record<string, { enabled: boolean; sendAt: string; language: 'vi' | 'en' }> };
}

type Db = ReturnType<typeof seed>;

export function createMockApi(actor: () => Actor): Api {
  const db: Db = seed();
  populate(db);

  // ------------------------------------------------------------ helpers
  const wait = <R>(value: R | (() => R)): Promise<R> =>
    new Promise((resolve, reject) =>
      setTimeout(() => {
        try {
          resolve(typeof value === 'function' ? (value as () => R)() : value);
        } catch (e) {
          reject(e);
        }
      }, 180 + Math.random() * 200));
  const fail = (status: number, message: string, code = 'demo'): never => {
    throw new ApiError(status, code, message);
  };
  const me = () => actor().userId ?? fail(401, t('mock.notSignedIn'));
  const org = () => actor().organizationId ?? fail(400, t('mock.chooseBusiness'));
  const member = () => db.memberships.find((m) => m.org === org() && m.userId === me()) ?? fail(403, t('mock.notMember'));
  const manager = () => {
    const m = member();
    if (m.role !== 'owner' && m.role !== 'admin') fail(403, t('mock.ownersOnly'));
    return m;
  };
  const userName = (uid: string) => db.users.find((u) => u.id === uid)?.displayName ?? 'Unknown';
  const memberOf = (e: Employment) => db.memberships.find((m) => m.id === e.membershipId)!;
  const emp = (eid: string) => db.employments.find((e) => e.id === eid) ?? fail(404, t('mock.notFound'));
  const shiftOf = (sid: string) => db.shifts.find((s) => s.id === sid && s.org === org()) ?? fail(404, t('mock.notFound'));
  const rateNow = (eid: string) => db.rates.filter((r) => r.employmentId === eid && !r.validTo).at(-1);
  const live = (a: Assignment) => a.state !== 'cancelled';

  const shiftView = (s: Shift): T.ShiftView => {
    const assigned = db.assignments.filter((a) => a.shiftId === s.id && live(a)).length;
    const { org: _o, ...rest } = s;
    const reg = db.policies[s.storeId]?.rules?.registration;
    const start = Date.parse(s.startsAt);
    return { ...rest, assignedCount: assigned, belowMinimum: assigned < s.minStaff, openSlots: s.maxStaff - assigned,
      registrationOpensAt: new Date(start - (reg?.opens_days_before ?? 14) * DAY).toISOString(),
      registrationClosesAt: new Date(start - (reg?.closes_hours_before ?? 12) * 3_600_000).toISOString() };
  };
  const assignmentView = (a: Assignment, showWage = true): T.AssignmentView => {
    const s = db.shifts.find((x) => x.id === a.shiftId)!;
    const e = emp(a.employmentId);
    const m = memberOf(e);
    return {
      id: a.id, shiftId: a.shiftId, storeId: s.storeId, employmentId: e.id, userId: m.userId, displayName: userName(m.userId),
      state: a.state, wageAmount: showWage ? a.wage : null, currency: 'VND', startsAt: s.startsAt, endsAt: s.endsAt,
      replacesAssignmentId: a.replaces, wageBasis: showWage ? a.basis : null,
    };
  };
  const requestView = (r: Request): T.RequestView => {
    const e = emp(r.employmentId);
    const m = memberOf(e);
    return { id: r.id, shiftId: r.shiftId, storeId: e.storeId, employmentId: e.id, userId: m.userId, displayName: userName(m.userId),
      status: r.status, requestedAt: r.requestedAt, decidedAt: r.decidedAt, assignmentId: r.assignmentId };
  };
  const swapView = (s: Swap): T.SwapView => ({
    id: s.id, status: s.status,
    from: assignmentView(db.assignments.find((a) => a.id === s.from)!, false),
    to: assignmentView(db.assignments.find((a) => a.id === s.to)!, false),
    requestedByUserId: s.requestedBy, acceptedByUserId: s.acceptedBy, approvedByUserId: s.approvedBy, expiresAt: s.expiresAt,
    acceptedAt: s.acceptedAt, decidedAt: s.decidedAt, newFromAssignmentId: s.newFrom, newToAssignmentId: s.newTo,
  });
  const employeeView = (e: Employment): T.EmployeeView => {
    const r = rateNow(e.id);
    const m = memberOf(e);
    return { employmentId: e.id, organizationId: e.org, storeId: e.storeId, userId: m.userId, displayName: userName(m.userId),
      role: 'employee', status: e.status, startedAt: e.startedAt, endedAt: e.endedAt, currentWage: r?.amount ?? null,
      wageBasis: r?.basis ?? null, currency: 'VND' };
  };
  const enrollmentView = (x: Enrollment): T.EnrollmentView => ({
    id: x.id, organizationId: x.org, storeId: x.storeId, userId: x.userId, displayName: userName(x.userId), status: x.status,
    requestedAt: x.requestedAt, decidedAt: x.decidedAt, employmentId: x.employmentId, warning: null,
  });
  const balance = (eid: string) => db.points.filter((p) => p.employmentId === eid).reduce((n, p) => n + p.delta, 0);
  const pointsView = (eid: string): T.PointsView => ({
    employmentId: eid, balance: balance(eid),
    entries: db.points.filter((p) => p.employmentId === eid).map(({ employmentId: _e, ...p }) => p),
  });
  const notify = (to: string, eventType: string, title: () => string) =>
    db.notices.unshift({ id: id('27'), org: org(), to, eventType, title, availableAt: nowIso(), deliveredAt: null });
  const ownerOf = (o: string) => db.memberships.find((m) => m.org === o && m.role === 'owner')!.userId;
  const overlaps = (membershipId: string, s: Shift) =>
    db.assignments.some((a) => {
      if (!live(a) || memberOf(emp(a.employmentId)).id !== membershipId) return false;
      const o = db.shifts.find((x) => x.id === a.shiftId)!;
      return Date.parse(o.startsAt) < Date.parse(s.endsAt) && Date.parse(s.startsAt) < Date.parse(o.endsAt);
    });
  const book = (s: Shift, e: Employment, replaces: string | null = null): Assignment => {
    if (s.status !== 'published') fail(409, t('mock.publishFirst'));
    const count = db.assignments.filter((a) => a.shiftId === s.id && live(a)).length;
    if (count >= s.maxStaff) fail(409, t('mock.shiftFull', { n: s.maxStaff }));
    if (overlaps(e.membershipId, s)) fail(409, t('mock.busy'));
    const a: Assignment = { id: id('d3'), org: s.org, shiftId: s.id, employmentId: e.id, state: 'assigned', wage: rateNow(e.id)?.amount ?? 0, basis: rateNow(e.id)?.basis ?? 'hourly', replaces };
    db.assignments.push(a);
    return a;
  };
  const makeShift = (storeId: string, date: string, start: string, end: string, templateId: string | null,
    staff: { min: number; opt: number; max: number }, status: T.ShiftStatus): Shift => {
    const overnight = end <= start;
    return {
      id: id('d1'), org: db.stores.find((x) => x.id === storeId)!.org, storeId, templateId, localDate: date, timezone: TZ,
      startsAt: at(date, start), endsAt: at(date, end, overnight ? 1 : 0), minStaff: staff.min, optimalStaff: staff.opt,
      maxStaff: staff.max, status,
    };
  };

  /** Same as the server's auto-fill: every active template, today .. today + days_ahead, published. */
  const autoFill = (storeId: string) => {
    const p = db.policies[storeId];
    const rules = p.rules?.schedule;
    if (rules?.auto_generate === false) return;
    const first = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    for (let i = 0; i <= (rules?.days_ahead ?? 14); i++) {
      const d = new Date(Date.parse(`${first}T00:00:00Z`) + i * DAY).toISOString().slice(0, 10);
      for (const tp of db.templates.filter((x) => x.storeId === storeId && x.status === 'active' && x.weekdays.includes(isoWeekday(d)))) {
        if (db.shifts.some((s) => s.templateId === tp.id && s.localDate === d)) continue;
        const s = makeShift(storeId, d, tp.localStart, tp.localEnd, tp.id,
          { min: tp.minStaff ?? p.minStaff, opt: tp.optimalStaff ?? p.optimalStaff, max: tp.maxStaff ?? p.maxStaff },
          rules?.auto_publish === false ? 'draft' : 'published');
        if (Date.parse(s.startsAt) > Date.now()) db.shifts.push(s);
      }
    }
  };

  // ---------------------------------------------------------- endpoints
  const api: Api = {
    createUser: (displayName, contactEmail) => wait(() => {
      const u = { id: id('10'), displayName, email: contactEmail ?? '' };
      db.users.push(u);
      return { id: u.id, displayName, status: 'active' };
    }),
    me: () => wait(() => {
      const u = db.users.find((x) => x.id === me()) ?? fail(404, t('mock.notFound'));
      return { id: u.id, displayName: u.displayName, status: 'active' };
    }),
    myOrganizations: () => wait(() => db.memberships.filter((m) => m.userId === me())
      .map((m) => ({ organizationId: m.org, name: db.orgs.find((o) => o.id === m.org)!.name, role: m.role }))),
    createOrganization: (name, billingTimezone) => wait(() => {
      const o = { id: id('a0'), name, billingTimezone };
      db.orgs.push(o);
      db.memberships.push({ id: id('a1'), org: o.id, userId: me(), role: 'owner' });
      return { id: o.id, name, status: 'active', billingTimezone, myRole: 'owner' as const, stores: [] };
    }),
    organization: () => wait(() => {
      const o = db.orgs.find((x) => x.id === org())!;
      return { id: o.id, name: o.name, status: 'active', billingTimezone: o.billingTimezone, myRole: member().role,
        stores: db.stores.filter((s) => s.org === o.id).map(({ org: _o, ...s }) => s) };
    }),
    stores: () => wait(() => {
      member();
      return db.stores.filter((s) => s.org === org()).map(({ org: _o, ...s }) => s);
    }),
    createStore: (req) => wait(() => {
      manager();
      const store = { id: id('b0'), org: org(), name: req.name, timezone: req.timezone, currency: req.currency, status: 'active', openedAt: nowIso() };
      db.stores.push(store);
      db.policies[store.id] = { ...db.policies[D1], id: id('c2'), version: 1, effectiveFrom: nowIso() };
      const key = newKey(store.id, 1);
      const { org: _o, ...view } = store;
      return { store: view, policy: db.policies[store.id], accessKey: key };
    }),
    rotateAccessKey: (storeId) => wait(() => {
      manager();
      return newKey(storeId, (db.accessKeys[storeId]?.version ?? 1) + 1);
    }),
    policy: (storeId) => wait(() => {
      member();
      return db.policies[storeId] ?? fail(404, t('mock.notFound'));
    }),
    updatePolicy: (storeId, req) => wait(() => {
      manager();
      if (!(req.minStaff <= req.optimalStaff && req.optimalStaff <= req.maxStaff)) fail(400, t('mock.staffingOrder'));
      const prev = db.policies[storeId];
      db.policies[storeId] = { ...prev, ...req, rules: req.rules ?? prev.rules, id: id('c2'), version: prev.version + 1, effectiveFrom: nowIso() };
      autoFill(storeId);
      return db.policies[storeId];
    }),

    joinStore: (accessKey) => wait(() => {
      const key = Object.values(db.accessKeys).find((k) => k.accessKey === accessKey.trim().toUpperCase())
        ?? fail(404, t('mock.badKey'));
      const store = db.stores.find((s) => s.id === key.storeId)!;
      const x: Enrollment = { id: id('c1'), org: store.org, storeId: store.id, userId: me(), status: 'pending', requestedAt: nowIso(), decidedAt: null, employmentId: null };
      db.enrollments.push(x);
      db.notices.unshift({ id: id('27'), org: store.org, to: ownerOf(store.org), eventType: 'alert.enrollment.pending',
        title: () => t('mock.nWantsJoin', { name: userName(x.userId), store: store.name }), availableAt: nowIso(), deliveredAt: null });
      return enrollmentView(x);
    }),
    myEnrollments: () => wait(() => db.enrollments
      .filter((x) => x.userId === me() && (x.status === 'pending' || Date.now() - Date.parse(x.decidedAt ?? '') < 14 * 86_400_000))
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
      .map((x) => ({ id: x.id, organizationId: x.org, organizationName: db.orgs.find((o) => o.id === x.org)!.name,
        storeId: x.storeId, storeName: db.stores.find((s) => s.id === x.storeId)!.name,
        status: x.status as T.MyEnrollmentView['status'], requestedAt: x.requestedAt, decidedAt: x.decidedAt }))),
    enrollments: (storeId, status) => wait(() => {
      manager();
      return db.enrollments.filter((x) => x.org === org() && (!storeId || x.storeId === storeId) && (!status || x.status === status)).map(enrollmentView);
    }),
    approveEnrollment: (eid) => wait(() => {
      manager();
      const x = db.enrollments.find((e) => e.id === eid) ?? fail(404, t('mock.notFound'));
      let m = db.memberships.find((mm) => mm.org === x.org && mm.userId === x.userId);
      if (!m) {
        m = { id: id('a1'), org: x.org, userId: x.userId, role: 'employee' };
        db.memberships.push(m);
      }
      const e: Employment = { id: id('b1'), org: x.org, storeId: x.storeId, membershipId: m.id, status: 'active', startedAt: nowIso(), endedAt: null };
      db.employments.push(e);
      Object.assign(x, { status: 'approved', decidedAt: nowIso(), employmentId: e.id });
      const storeName = db.stores.find((s) => s.id === x.storeId)!.name;
      notify(x.userId, 'alert.enrollment.approved', () => t('mock.nCanPick', { store: storeName }));
      return enrollmentView(x);
    }),
    rejectEnrollment: (eid) => wait(() => {
      manager();
      const x = db.enrollments.find((e) => e.id === eid) ?? fail(404, t('mock.notFound'));
      Object.assign(x, { status: 'rejected', decidedAt: nowIso() });
      return enrollmentView(x);
    }),
    employees: (storeId) => wait(() => {
      manager();
      return db.employments.filter((e) => e.org === org() && e.storeId === storeId).map(employeeView);
    }),
    myEmployments: () => wait(() => {
      const m = member();
      return db.employments.filter((e) => e.membershipId === m.id && e.status === 'active').map((e) => {
        const s = db.stores.find((x) => x.id === e.storeId)!;
        const r = rateNow(e.id);
        return { employmentId: e.id, storeId: s.id, storeName: s.name, storeTimeZone: s.timezone, role: 'employee', status: e.status,
          startedAt: e.startedAt, currentWage: r?.amount ?? null, wageBasis: r?.basis ?? null, currency: s.currency };
      });
    }),
    setRate: (employmentId, amount, basis) => wait(() => {
      manager();
      const now = nowIso();
      const prev = rateNow(employmentId);
      if (prev) prev.validTo = now;
      const b: WageBasis = basis ?? payRulesOf(db.policies[emp(employmentId).storeId].rules).basis;
      const r: Rate = { id: id('b2'), employmentId, amount, basis: b, validFrom: now, validTo: null };
      db.rates.push(r);
      return { id: r.id, employmentId, basis: b, amount, currency: 'VND', validFrom: now, validTo: null };
    }),
    rates: (employmentId) => wait(() => db.rates.filter((r) => r.employmentId === employmentId)
      .map((r) => ({ id: r.id, employmentId, basis: r.basis, amount: r.amount, currency: 'VND', validFrom: r.validFrom, validTo: r.validTo }))
      .reverse()),
    endEmployment: (employmentId) => wait(() => {
      manager();
      const e = emp(employmentId);
      Object.assign(e, { status: 'ended', endedAt: nowIso() });
      return employeeView(e);
    }),

    templates: (storeId) => wait(() => db.templates.filter((t) => t.storeId === storeId && t.status === 'active')),
    createTemplate: (req) => wait(() => {
      manager();
      const t: T.TemplateView = { id: id('d0'), storeId: req.storeId, name: req.name, localStart: req.localStart, localEnd: req.localEnd,
        overnight: req.localEnd <= req.localStart, weekdays: req.weekdays, minStaff: req.minStaff ?? null,
        optimalStaff: req.optimalStaff ?? null, maxStaff: req.maxStaff ?? null, status: 'active' };
      db.templates.push(t);
      autoFill(req.storeId);
      return t;
    }),
    archiveTemplate: (tid) => wait(() => {
      manager();
      const tpl = db.templates.find((x) => x.id === tid) ?? fail(404, t('mock.notFound'));
      tpl.status = 'archived';
      // like the server: upcoming shifts from this template that nobody took or asked for go away
      for (const s of db.shifts) {
        if (s.templateId === tid && (s.status === 'draft' || s.status === 'published') && Date.parse(s.startsAt) > Date.now()
          && !db.assignments.some((a) => a.shiftId === s.id && live(a))
          && !db.requests.some((r) => r.shiftId === s.id && (r.status === 'pending' || r.status === 'waitlisted'))) {
          s.status = 'cancelled';
        }
      }
      return tpl;
    }),
    generateShifts: (storeId, from, to, publish) => wait(() => {
      manager();
      const created: T.ShiftView[] = [];
      let existing = 0;
      let past = 0;
      const p = db.policies[storeId];
      for (let d = from; d <= to; d = new Date(Date.parse(`${d}T00:00:00Z`) + DAY).toISOString().slice(0, 10)) {
        for (const t of db.templates.filter((x) => x.storeId === storeId && x.status === 'active' && x.weekdays.includes(isoWeekday(d)))) {
          if (db.shifts.some((s) => s.templateId === t.id && s.localDate === d)) {
            existing++;
            continue;
          }
          const s = makeShift(storeId, d, t.localStart, t.localEnd, t.id,
            { min: t.minStaff ?? p.minStaff, opt: t.optimalStaff ?? p.optimalStaff, max: t.maxStaff ?? p.maxStaff }, publish ? 'published' : 'draft');
          if (Date.parse(s.startsAt) <= Date.now()) {
            past++;
            continue;
          }
          db.shifts.push(s);
          created.push(shiftView(s));
        }
      }
      return { created, alreadyExisting: existing, skippedPast: past, warnings: [] };
    }),
    createShift: (req) => wait(() => {
      manager();
      const p = db.policies[req.storeId];
      const s = makeShift(req.storeId, req.localDate, req.localStart, req.localEnd, null,
        { min: req.minStaff ?? p.minStaff, opt: req.optimalStaff ?? p.optimalStaff, max: req.maxStaff ?? p.maxStaff }, req.publish ? 'published' : 'draft');
      db.shifts.push(s);
      return shiftView(s);
    }),
    shifts: (storeId, from, to) => wait(() => {
      const m = member();
      const isMgr = m.role === 'owner' || m.role === 'admin';
      return db.shifts.filter((s) => s.org === org() && s.storeId === storeId && s.localDate >= from && s.localDate <= to && (isMgr || s.status !== 'draft'))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map(shiftView);
    }),
    shift: (sid) => wait(() => {
      const m = member();
      const isMgr = m.role === 'owner' || m.role === 'admin';
      const s = shiftOf(sid);
      if (!isMgr && s.status === 'draft') fail(404, t('mock.notFound'));
      return {
        shift: shiftView(s),
        assignments: db.assignments.filter((a) => a.shiftId === sid && live(a)).map((a) => assignmentView(a, isMgr || memberOf(emp(a.employmentId)).id === m.id)),
        requests: db.requests.filter((r) => r.shiftId === sid && (isMgr || memberOf(emp(r.employmentId)).id === m.id)).map(requestView),
      };
    }),
    publishShift: (sid) => wait(() => {
      manager();
      const s = shiftOf(sid);
      if (s.status !== 'draft') fail(409, t('mock.onlyDraft'));
      s.status = 'published';
      return shiftView(s);
    }),
    cancelShift: (sid) => wait(() => {
      manager();
      const s = shiftOf(sid);
      if (s.status === 'closed' || s.status === 'cancelled') fail(409, t('mock.alreadyState', { s: t(`status.${s.status}`) }));
      s.status = 'cancelled';
      db.assignments.filter((a) => a.shiftId === sid && a.state === 'assigned').forEach((a) => {
        a.state = 'cancelled';
        notify(memberOf(emp(a.employmentId)).userId, 'alert.shift.cancelled', () => t('mock.nShiftCancelled', { date: s.localDate }));
      });
      return shiftView(s);
    }),
    updateStaffing: (sid, minStaff, optimalStaff, maxStaff) => wait(() => {
      manager();
      const s = shiftOf(sid);
      if (!(minStaff <= optimalStaff && optimalStaff <= maxStaff)) fail(400, t('mock.staffingOrder'));
      const count = db.assignments.filter((a) => a.shiftId === sid && live(a)).length;
      if (maxStaff < count) fail(409, t('mock.alreadyBooked', { n: count }));
      Object.assign(s, { minStaff, optimalStaff, maxStaff });
      return shiftView(s);
    }),
    registerForShift: (sid) => wait(() => {
      const m = member();
      const s = shiftOf(sid);
      const e = db.employments.find((x) => x.membershipId === m.id && x.storeId === s.storeId && x.status === 'active') ?? fail(403, t('mock.notAtStore'));
      if (s.status !== 'published') fail(409, t('mock.closed'));
      if (db.requests.some((r) => r.shiftId === sid && r.employmentId === e.id && (r.status === 'pending' || r.status === 'waitlisted'))) fail(409, t('mock.alreadyAsked'));
      if (db.assignments.some((a) => a.shiftId === sid && a.employmentId === e.id && live(a))) fail(409, t('mock.alreadyOn'));
      const r: Request = { id: id('d2'), org: s.org, shiftId: sid, employmentId: e.id, status: 'pending', requestedAt: nowIso(), decidedAt: null, assignmentId: null };
      const full = db.assignments.filter((a) => a.shiftId === sid && live(a)).length >= s.maxStaff;
      if (full) r.status = 'waitlisted';
      else if (db.policies[s.storeId].registrationMode === 'automatic') {
        const a = book(s, e);
        Object.assign(r, { status: 'approved', decidedAt: nowIso(), assignmentId: a.id });
      } else {
        const who = userName(me());
        notify(ownerOf(s.org), 'alert.shift_request.pending', () => t('mock.nAskedShift', { name: who, date: s.localDate }));
      }
      db.requests.push(r);
      return requestView(r);
    }),
    openRequests: (storeId) => wait(() => {
      manager();
      return db.requests.filter((r) => r.org === org() && (r.status === 'pending' || r.status === 'waitlisted') && (!storeId || emp(r.employmentId).storeId === storeId))
        .map(requestView);
    }),
    approveRequest: (rid) => wait(() => {
      manager();
      const r = db.requests.find((x) => x.id === rid) ?? fail(404, t('mock.notFound'));
      const a = book(shiftOf(r.shiftId), emp(r.employmentId));
      Object.assign(r, { status: 'approved', decidedAt: nowIso(), assignmentId: a.id });
      const date = shiftOf(r.shiftId).localDate;
      notify(memberOf(emp(r.employmentId)).userId, 'alert.shift_request.approved', () => t('mock.nGotShift', { date }));
      return requestView(r);
    }),
    rejectRequest: (rid) => wait(() => {
      manager();
      const r = db.requests.find((x) => x.id === rid) ?? fail(404, t('mock.notFound'));
      Object.assign(r, { status: 'rejected', decidedAt: nowIso() });
      return requestView(r);
    }),
    cancelRequest: (rid) => wait(() => {
      const r = db.requests.find((x) => x.id === rid) ?? fail(404, t('mock.notFound'));
      Object.assign(r, { status: 'cancelled', decidedAt: nowIso() });
      return requestView(r);
    }),
    assign: (sid, employmentId) => wait(() => {
      manager();
      return assignmentView(book(shiftOf(sid), emp(employmentId)));
    }),
    cancelAssignment: (aid) => wait(() => {
      manager();
      const a = db.assignments.find((x) => x.id === aid) ?? fail(404, t('mock.notFound'));
      if (a.state !== 'assigned') fail(409, t('mock.onlyUpcoming'));
      a.state = 'cancelled';
      return assignmentView(a);
    }),
    mySchedule: (from, to) => wait(() => {
      const m = member();
      return db.assignments.filter((a) => live(a) && memberOf(emp(a.employmentId)).id === m.id)
        .map((a) => ({ a, s: db.shifts.find((x) => x.id === a.shiftId)! }))
        .filter(({ s }) => s.localDate >= from && s.localDate <= to)
        .sort((x, y) => x.s.startsAt.localeCompare(y.s.startsAt))
        .map(({ a }) => assignmentView(a));
    }),
    myRequests: () => wait(() => {
      const m = member();
      return db.requests.filter((r) => memberOf(emp(r.employmentId)).id === m.id).map(requestView).reverse();
    }),
    proposeSwap: (fromId, toId) => wait(() => {
      const m = member();
      const from = db.assignments.find((a) => a.id === fromId) ?? fail(404, t('mock.notFound'));
      const to = db.assignments.find((a) => a.id === toId) ?? fail(404, t('mock.notFound'));
      if (memberOf(emp(from.employmentId)).id !== m.id) fail(403, t('mock.ownShift'));
      if (memberOf(emp(to.employmentId)).id === m.id) fail(400, t('mock.colleague'));
      const s: Swap = { id: id('d4'), org: org(), from: fromId, to: toId, status: 'requested', requestedBy: me(), acceptedBy: null, approvedBy: null,
        expiresAt: db.shifts.find((x) => x.id === from.shiftId)!.startsAt, acceptedAt: null, decidedAt: null, newFrom: null, newTo: null };
      db.swaps.unshift(s);
      const who = userName(me());
      notify(memberOf(emp(to.employmentId)).userId, 'alert.swap.requested', () => t('mock.nSwapAsk', { name: who }));
      return swapView(s);
    }),
    swaps: (status) => wait(() => {
      const m = member();
      const isMgr = m.role === 'owner' || m.role === 'admin';
      return db.swaps.filter((s) => s.org === org() && (!status || s.status === status) &&
        (isMgr || [s.from, s.to].some((aid) => memberOf(emp(db.assignments.find((a) => a.id === aid)!.employmentId)).id === m.id)))
        .map(swapView);
    }),
    swapAction: (sid, action) => wait(() => {
      const s = db.swaps.find((x) => x.id === sid) ?? fail(404, t('mock.notFound'));
      const from = db.assignments.find((a) => a.id === s.from)!;
      const to = db.assignments.find((a) => a.id === s.to)!;
      const exchange = () => {
        from.state = 'cancelled';
        to.state = 'cancelled';
        const nf = book(db.shifts.find((x) => x.id === from.shiftId)!, emp(to.employmentId), from.id);
        const nt = book(db.shifts.find((x) => x.id === to.shiftId)!, emp(from.employmentId), to.id);
        Object.assign(s, { status: 'approved', decidedAt: nowIso(), newFrom: nf.id, newTo: nt.id });
      };
      switch (action) {
        case 'accept':
          Object.assign(s, { status: 'accepted', acceptedBy: me(), acceptedAt: nowIso() });
          const storeId = db.shifts.find((x) => x.id === from.shiftId)!.storeId;
          if (!db.policies[storeId].swapApprovalRequired) exchange();
          else notify(ownerOf(s.org), 'alert.swap.accepted', () => t('mock.nSwapWaiting'));
          break;
        case 'approve':
          manager();
          s.approvedBy = me();
          exchange();
          notify(s.requestedBy, 'alert.swap.approved', () => t('mock.nSwapApproved'));
          break;
        case 'decline':
        case 'reject':
          Object.assign(s, { status: 'rejected', decidedAt: nowIso() });
          break;
        case 'cancel':
          Object.assign(s, { status: 'cancelled', decidedAt: nowIso() });
          break;
      }
      return swapView(s);
    }),

    clock: (assignmentId, type) => wait(() => {
      const a = db.assignments.find((x) => x.id === assignmentId) ?? fail(404, t('mock.notFound'));
      const ev = { id: id('e0'), org: org(), assignmentId, type, occurredAt: nowIso(), receivedAt: nowIso(), source: 'employee' };
      db.attendance.push(ev);
      if (type === 'clock_out') a.state = 'completed';
      const { org: _o, ...view } = ev;
      return view;
    }),
    attendance: (assignmentId) => wait(() => db.attendance.filter((x) => x.assignmentId === assignmentId).map(({ org: _o, ...v }) => v)),
    approveTimesheet: (assignmentId) => wait(() => {
      manager();
      const a = db.assignments.find((x) => x.id === assignmentId) ?? fail(404, t('mock.notFound'));
      if (a.state === 'assigned') a.state = 'completed';
      return {};
    }),
    reportViolation: (req) => wait(() => {
      manager();
      const e = emp(req.employmentId);
      const pts = db.policies[e.storeId].rules?.violations?.[req.code]?.points ?? null;
      const v: Violation = { id: id('20'), org: org(), employmentId: e.id, storeId: e.storeId, assignmentId: req.assignmentId ?? null, code: req.code,
        occurredAt: req.occurredAt ?? nowIso(), status: 'reported', description: req.description, points: pts, decidedAt: null };
      db.violations.unshift(v);
      return v;
    }),
    violations: (params = {}) => wait(() => {
      const m = member();
      const isMgr = m.role === 'owner' || m.role === 'admin';
      return db.violations.filter((v) => v.org === org() && (!params.storeId || v.storeId === params.storeId) && (!params.status || v.status === params.status)
        && (!params.employmentId || v.employmentId === params.employmentId) && (isMgr || memberOf(emp(v.employmentId)).id === m.id))
        .map(({ org: _o, ...v }) => v);
    }),
    violationAction: (vid, action) => wait(() => {
      manager();
      const v = db.violations.find((x) => x.id === vid) ?? fail(404, t('mock.notFound'));
      const status = action === 'confirm' ? 'confirmed' : action === 'dismiss' ? 'dismissed' : 'reversed';
      if (action === 'confirm' && v.points) {
        db.points.push({ id: id('21'), employmentId: v.employmentId, delta: v.points, kind: 'violation', reason: `${v.code}: ${v.description}`, effectiveAt: nowIso() });
        const { code, points } = v;
        notify(memberOf(emp(v.employmentId)).userId, 'alert.violation.confirmed', () => t('mock.nViolation', { code: t(`code.${code}`), n: points }));
      }
      if (action === 'reverse' && v.points) {
        db.points.push({ id: id('21'), employmentId: v.employmentId, delta: -v.points, kind: 'reversal', reason: `Reversed ${v.code}`, effectiveAt: nowIso() });
      }
      Object.assign(v, { status, decidedAt: nowIso() });
      const { org: _o, ...view } = v;
      return view;
    }),
    points: (employmentId) => wait(() => pointsView(employmentId)),
    awardPoints: (employmentId, req) => wait(() => {
      manager();
      const e = emp(employmentId);
      const delta = req.points ?? db.policies[e.storeId].rules?.awards?.[req.code ?? '']?.points ?? fail(400, t('mock.unknownAward'));
      db.points.push({ id: id('21'), employmentId, delta, kind: 'award', reason: req.reason, effectiveAt: nowIso() });
      notify(memberOf(e).userId, 'alert.points.awarded', () => t('mock.nPoints', { n: delta, reason: req.reason }));
      return pointsView(employmentId);
    }),

    payrollPeriods: () => wait(() => db.periods.filter((p) => p.org === org()).map(({ org: _o, ...p }) => p)),
    createPeriod: (currency, from, to, label) => wait(() => {
      manager();
      const p = { id: id('23'), org: org(), currency, startsAt: at(from, '00:00'), endsAt: at(to, '00:00', 1), label: label || `${from} – ${to}`, status: 'open', closedAt: null };
      db.periods.unshift(p);
      const { org: _o, ...view } = p;
      return view;
    }),
    payrollRuns: (periodId) => wait(() => db.runs.filter((r) => r.periodId === periodId)),
    runPayroll: (periodId) => wait(() => {
      manager();
      const p = db.periods.find((x) => x.id === periodId) ?? fail(404, t('mock.notFound'));
      const slips = payslipsFor(p.startsAt, p.endsAt, org());
      const r: T.RunView = { id: id('24'), periodId, runNumber: db.runs.filter((x) => x.periodId === periodId).length + 1, kind: 'regular', status: 'finalized',
        finalizedAt: nowIso(), lineCount: slips.reduce((n, s) => n + s.lines.length, 0), totalGross: slips.reduce((n, s) => n + s.gross, 0), currency: 'VND', unresolvedTimesheets: 0 };
      db.runs.unshift(r);
      Object.assign(p, { status: 'closed', closedAt: nowIso() });
      return r;
    }),
    payslips: (runId) => wait(() => {
      const r = db.runs.find((x) => x.id === runId) ?? fail(404, t('mock.notFound'));
      const p = db.periods.find((x) => x.id === r.periodId)!;
      return payslipsFor(p.startsAt, p.endsAt, org()).map((s) => ({ ...s, lines: s.lines.map((l) => ({ ...l, runId })) }));
    }),
    myPayslips: () => wait(() => {
      const m = member();
      const closed = db.periods.filter((p) => p.org === org() && p.status === 'closed');
      return closed.flatMap((p) => payslipsFor(p.startsAt, p.endsAt, org())).filter((s) => memberOf(emp(s.employmentId)).id === m.id);
    }),
    estimate: () => wait(() => {
      manager();
      const stores = db.stores.filter((s) => s.org === org() && s.status === 'active').length;
      const people = new Set(db.employments.filter((e) => e.org === org() && e.status === 'active').map((e) => e.membershipId)).size;
      return { planCode: 'standard', currency: 'VND', activeStores: stores, activeEmployees: people, baseFee: 99000,
        storeFees: stores * 49000, employeeFees: people * 15000, total: 99000 + stores * 49000 + people * 15000 };
    }),
    invoices: () => wait(() => {
      manager();
      const month = localDate(-30).slice(0, 7);
      return [{ id: id('25'), invoiceNumber: `PVM-${month}`, kind: 'charge', currency: 'VND', periodStart: `${month}-01T00:00:00+07:00`,
        periodEnd: `${localDate(0).slice(0, 7)}-01T00:00:00+07:00`, peakStores: 2, peakEmployees: 4, total: 257000,
        issuedAt: `${localDate(0).slice(0, 7)}-01T09:00:00+07:00`, dueAt: `${localDate(0).slice(0, 7)}-15T23:59:00+07:00`,
        lines: [
          { code: 'base', quantity: 1, unitAmount: 99000, amount: 99000, description: t('mock.plan') },
          { code: 'stores', quantity: 2, unitAmount: 49000, amount: 98000, description: t('mock.planStores') },
          { code: 'employees', quantity: 4, unitAmount: 15000, amount: 60000, description: t('mock.planPeople') },
        ] }];
    }),
    notifications: () => wait(() => db.notices.filter((n) => n.org === org() && n.to === me())
      .map((n) => ({ id: n.id, eventType: n.eventType, title: n.title(), payload: {}, availableAt: n.availableAt, deliveredAt: n.deliveredAt }))),

    digestSettings: () => wait(() => digestView(manager().id)),
    updateDigestSettings: (enabled, sendAt, language) => wait(() => {
      const m = manager();
      db.digest[m.id] = { ...digestPref(m.id), enabled, sendAt, language };
      return digestView(m.id);
    }),
    previewDigest: () => wait(() => buildDigest(digestPref(manager().id).language)),
    sendDigestNow: () => wait(() => {
      const m = manager();
      const lang = digestPref(m.id).language;
      const d = buildDigest(lang);
      db.notices.unshift({ id: id('27'), org: org(), to: me(), eventType: 'digest.daily_staffing', title: () => d.title,
        availableAt: nowIso(), deliveredAt: null });
      return d;
    }),
    registerDevice: () => wait(() => ({ active: 1 })),
    unregisterDevice: () => wait(() => undefined),
    devices: () => wait(() => ({ active: 0 })),
  };

  // ------------------------------------------------- daily digest (demo)
  function digestPref(membershipId: string) {
    return db.digest[membershipId] ?? { enabled: member().role === 'owner', sendAt: '22:00', language: 'vi' as const };
  }

  function digestView(membershipId: string): T.DigestSettings {
    const p = digestPref(membershipId);
    const todayAt = new Date(`${localDate(0)}T${p.sendAt}:00${OFFSET}`);
    const next = todayAt.getTime() > Date.now() ? todayAt : new Date(todayAt.getTime() + DAY);
    return { ...p, timezone: TZ, lastSentFor: null, nextSendAt: p.enabled ? next.toISOString() : null };
  }

  /** Same wording rules as the backend's DigestBuilder. */
  function buildDigest(language: 'vi' | 'en'): T.StaffingDigest {
    const vi = language === 'vi';
    const date = localDate(1);
    const day = new Date(`${date}T00:00:00Z`);
    const dow = (day.getUTCDay() + 6) % 7;
    const dayLabel = vi ? `${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][dow]}, ${day.getUTCDate()}/${day.getUTCMonth() + 1}`
      : `${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dow]} ${day.getUTCDate()}/${day.getUTCMonth() + 1}`;
    const lines: T.DigestShiftLine[] = db.shifts
      .filter((s) => s.org === org() && s.localDate === date && (s.status === 'draft' || s.status === 'published'))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((s) => ({
        shiftId: s.id, storeId: s.storeId, storeName: db.stores.find((x) => x.id === s.storeId)!.name,
        name: db.templates.find((x) => x.id === s.templateId)?.name ?? null, startsAt: s.startsAt, endsAt: s.endsAt,
        timezone: TZ, status: s.status, assigned: db.assignments.filter((a) => a.shiftId === s.id && live(a)).length,
        minStaff: s.minStaff, optimalStaff: s.optimalStaff, maxStaff: s.maxStaff,
        pendingRequests: db.requests.filter((r) => r.shiftId === s.id && (r.status === 'pending' || r.status === 'waitlisted')).length,
      }));
    const short = (l: T.DigestShiftLine) => Math.max(0, l.minStaff - l.assigned);
    const stores = [...new Set(lines.map((l) => l.storeId))].map((storeId) => {
      const list = lines.filter((l) => l.storeId === storeId);
      const problems = list.filter((l) => short(l) > 0);
      return { storeId, storeName: list[0].storeName, shifts: list.length, peopleMissing: problems.reduce((n, l) => n + short(l), 0), problems };
    });
    const totals = {
      shifts: lines.length, understaffedShifts: lines.filter((l) => short(l) > 0).length,
      peopleMissing: lines.reduce((n, l) => n + short(l), 0),
      belowIdealShifts: lines.filter((l) => short(l) === 0 && l.assigned < l.optimalStaff).length,
      drafts: lines.filter((l) => l.status === 'draft').length, pendingRequests: lines.reduce((n, l) => n + l.pendingRequests, 0),
    };
    const title = totals.shifts === 0 ? (vi ? `📅 Ngày mai (${dayLabel}) chưa có ca nào` : `📅 No shifts scheduled for tomorrow (${dayLabel})`)
      : totals.understaffedShifts === 0 ? (vi ? `✅ Ngày mai (${dayLabel}): đủ người cho ${totals.shifts} ca` : `✅ Tomorrow (${dayLabel}): all ${totals.shifts} shifts are staffed`)
        : vi ? `⚠️ Ngày mai (${dayLabel}): ${totals.understaffedShifts}/${totals.shifts} ca thiếu người, cần thêm ${totals.peopleMissing} người`
          : `⚠️ Tomorrow (${dayLabel}): ${totals.understaffedShifts} of ${totals.shifts} shifts short, ${totals.peopleMissing} more needed`;
    const body = stores.map((s) => {
      const name = s.storeName.includes(' - ') ? s.storeName.split(' - ')[1] : s.storeName;
      if (!s.problems.length) return vi ? `${name}: ${s.shifts} ca, đủ người` : `${name}: ${s.shifts} shifts, all staffed`;
      return `${name}: ${s.problems.slice(0, 3).map((l) => `${l.name ?? ''} ${l.startsAt.slice(11, 16)} ${vi ? 'thiếu' : 'needs'} ${short(l)} (${l.assigned}/${l.minStaff})`.trim()).join(', ')}`;
    }).join('\n');
    return { date, language, title, body, totals, stores };
  }

  function newKey(storeId: string, version: number): T.AccessKeyView {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const k = { storeId, version, accessKey: `${part()}-${part()}-${part()}`, expiresAt: new Date(Date.now() + 365 * DAY).toISOString() };
    db.accessKeys[storeId] = k;
    return k;
  }

  function payslipsFor(start: string, end: string, o: string): T.Payslip[] {
    const byEmp = new Map<string, T.Payslip>();
    for (const a of db.assignments.filter((x) => x.org === o && x.state === 'completed')) {
      const s = db.shifts.find((x) => x.id === a.shiftId)!;
      if (s.startsAt < start || s.startsAt >= end) continue;
      const e = emp(a.employmentId);
      const m = memberOf(e);
      const store = db.stores.find((x) => x.id === e.storeId)!;
      const slip = byEmp.get(e.id) ?? { employmentId: e.id, userId: m.userId, displayName: userName(m.userId), storeId: store.id, storeName: store.name,
        currency: 'VND', wages: 0, bonuses: 0, adjustments: 0, gross: 0, lines: [] };
      // same rules as the backend PayCalculator (demo: worked exactly the scheduled time)
      const pay = estimatePay(payRulesOf(db.policies[s.storeId].rules), a.basis, a.wage, s.startsAt.slice(11, 16), s.endsAt.slice(11, 16));
      slip.wages += pay.total;
      slip.gross += pay.total;
      slip.lines.push({ lineId: id('25'), runId: '', kind: 'shift', assignmentId: a.id, amount: pay.total, details: {
        shift_date: s.localDate, wage_basis: a.basis, wage_amount: a.wage, paid_minutes: pay.paidMinutes,
        overtime_premium: pay.overtime, night_premium: pay.night } });
      byEmp.set(e.id, slip);
    }
    return [...byEmp.values()];
  }

  return api;
}

/** Fill the demo database with shifts around today plus a realistic history. */
function populate(db: Db) {
  const live = (a: Assignment) => a.state !== 'cancelled';
  const memberOfEmp = (eid: string) => db.employments.find((e) => e.id === eid)!.membershipId;
  const overlaps = (membershipId: string, s: Shift) => db.assignments.some((a) => {
    if (!live(a) || memberOfEmp(a.employmentId) !== membershipId) return false;
    const o = db.shifts.find((x) => x.id === a.shiftId)!;
    return o.startsAt < s.endsAt && s.startsAt < o.endsAt;
  });

  // shifts: 21 days back to 13 days ahead
  for (let offset = -21; offset <= 13; offset++) {
    const date = localDate(offset);
    for (const t of db.templates.filter((x) => x.weekdays.includes(isoWeekday(date)))) {
      const p = db.policies[t.storeId];
      const overnight = t.localEnd <= t.localStart;
      const s: Shift = {
        id: id('d1'), org: db.stores.find((x) => x.id === t.storeId)!.org, storeId: t.storeId, templateId: t.id, localDate: date, timezone: TZ,
        startsAt: at(date, t.localStart), endsAt: at(date, t.localEnd, overnight ? 1 : 0),
        minStaff: t.minStaff ?? p.minStaff, optimalStaff: t.optimalStaff ?? p.optimalStaff, maxStaff: t.maxStaff ?? p.maxStaff,
        status: offset < 0 ? 'closed' : offset <= 7 ? 'published' : 'draft',
      };
      db.shifts.push(s);
    }
  }
  // assignments: rotate staff deterministically, leave some gaps so alerts show up
  let turn = 0;
  for (const s of db.shifts.filter((x) => x.status !== 'draft')) {
    const staff = db.employments.filter((e) => e.storeId === s.storeId);
    const target = (turn++ % 5 === 0) ? s.minStaff - 1 : s.optimalStaff;
    for (let i = 0; i < staff.length && db.assignments.filter((a) => a.shiftId === s.id).length < target; i++) {
      const e = staff[(turn + i) % staff.length];
      if (overlaps(e.membershipId, s)) continue;
      const rate = db.rates.filter((r) => r.employmentId === e.id && r.validFrom <= s.startsAt && (!r.validTo || r.validTo > s.startsAt)).at(-1);
      db.assignments.push({ id: id('d3'), org: s.org, shiftId: s.id, employmentId: e.id, state: s.status === 'closed' ? 'completed' : 'assigned', wage: rate?.amount ?? 0, basis: rate?.basis ?? 'hourly', replaces: null });
    }
  }
  const E = (n: number) => `b1000000-0000-4000-8000-00000000000${n}`;
  const futureOpen = db.shifts.filter((s) => s.status === 'published' && s.org === ORG1 && db.assignments.filter((a) => a.shiftId === s.id).length < s.maxStaff);
  // pending shift requests for the owner to approve
  for (const [i, eid] of [E(3), E(4)].entries()) {
    const s = futureOpen.find((x) => x.storeId === D1 && !db.assignments.some((a) => a.shiftId === x.id && a.employmentId === eid) && !overlaps(memberOfEmp(eid), x) && futureOpen.indexOf(x) > i * 3);
    if (s) db.requests.push({ id: id('d2'), org: ORG1, shiftId: s.id, employmentId: eid, status: 'pending', requestedAt: new Date(Date.now() - (i + 1) * 3600_000).toISOString(), decidedAt: null, assignmentId: null });
  }
  // a swap accepted by both employees, waiting for the owner
  const binh = db.assignments.find((a) => a.employmentId === E(3) && a.state === 'assigned');
  const chi = db.assignments.find((a) => a.employmentId === E(4) && a.state === 'assigned' && binh && a.shiftId !== binh.shiftId);
  if (binh && chi) db.swaps.push({ id: id('d4'), org: ORG1, from: binh.id, to: chi.id, status: 'accepted', requestedBy: U(4), acceptedBy: U(5), approvedBy: null,
    expiresAt: db.shifts.find((s) => s.id === binh.shiftId)!.startsAt, acceptedAt: new Date(Date.now() - 2 * 3600_000).toISOString(), decidedAt: null, newFrom: null, newTo: null });
  // enrollment waiting for approval
  db.enrollments.push({ id: id('c1'), org: ORG1, storeId: D1, userId: U(7), status: 'pending', requestedAt: new Date(Date.now() - 5 * 3600_000).toISOString(), decidedAt: null, employmentId: null });
  // access keys (demo values, shown in the store screen)
  db.accessKeys[D1] = { storeId: D1, version: 2, accessKey: 'KCOF-D1V2-2026', expiresAt: '2026-12-31T23:59:00+07:00' };
  db.accessKeys[D3] = { storeId: D3, version: 1, accessKey: 'KCOF-D3V1-2026', expiresAt: '2026-12-31T23:59:00+07:00' };
  db.accessKeys[TD] = { storeId: TD, version: 1, accessKey: 'LANT-TDV1-2026', expiresAt: '2026-12-31T23:59:00+07:00' };
  // performance history
  const pastChi = db.assignments.find((a) => a.employmentId === E(4) && a.state === 'completed');
  db.violations.push(
    { id: id('20'), org: ORG1, employmentId: E(4), storeId: D1, assignmentId: pastChi?.id ?? null, code: 'LATE', occurredAt: new Date(Date.now() - 6 * DAY).toISOString(),
      status: 'confirmed', description: 'Chấm công vào trễ 17 phút', points: -5, decidedAt: new Date(Date.now() - 6 * DAY).toISOString() },
    { id: id('20'), org: ORG1, employmentId: E(3), storeId: D1, assignmentId: null, code: 'MISSED_CLOCK_OUT', occurredAt: new Date(Date.now() - DAY).toISOString(),
      status: 'reported', description: 'Không chấm công ra sau ca sáng', points: -2, decidedAt: null },
  );
  const award = (eid: string, delta: number, kind: string, reason: string, daysAgo: number) =>
    db.points.push({ id: id('21'), employmentId: eid, delta, kind, reason, effectiveAt: new Date(Date.now() - daysAgo * DAY).toISOString() });
  award(E(1), 2, 'award', 'Ca hoàn hảo', 12); award(E(1), 10, 'award', 'Đúng giờ 10 ca liên tiếp', 4); award(E(1), 2, 'award', 'Ca hoàn hảo', 2);
  award(E(3), 2, 'award', 'Ca hoàn hảo', 9); award(E(4), 2, 'award', 'Ca hoàn hảo', 10); award(E(4), -5, 'violation', 'Đi trễ: chấm công vào trễ 17 phút', 6);
  award(E(5), 2, 'award', 'Ca hoàn hảo', 3); award(E(2), 2, 'award', 'Hỗ trợ đóng cửa hàng', 5); award(E(6), 2, 'award', 'Ca hoàn hảo', 7);
  // payroll: last month, finalised
  const start = localDate(-21);
  const end = localDate(-1);
  const period = { id: id('23'), org: ORG1, currency: 'VND', startsAt: at(start, '00:00'), endsAt: at(end, '00:00', 1), label: `${start.slice(5)} → ${end.slice(5)}`, status: 'closed', closedAt: new Date().toISOString() };
  db.periods.push(period);
  const done = db.assignments.filter((a) => a.org === ORG1 && a.state === 'completed');
  db.runs.push({ id: id('24'), periodId: period.id, runNumber: 1, kind: 'regular', status: 'finalized', finalizedAt: new Date().toISOString(),
    lineCount: done.length, totalGross: done.reduce((n, a) => {
      const sh = db.shifts.find((x) => x.id === a.shiftId)!;
      return n + estimatePay(payRulesOf(db.policies[sh.storeId].rules), a.basis, a.wage, sh.startsAt.slice(11, 16), sh.endsAt.slice(11, 16)).total;
    }, 0), currency: 'VND', unresolvedTimesheets: 0 });
  // notifications
  const n = (org: string, to: string, eventType: string, title: () => string, hoursAgo: number) =>
    db.notices.push({ id: id('27'), org, to, eventType, title, availableAt: new Date(Date.now() - hoursAgo * 3600_000).toISOString(), deliveredAt: null });
  n(ORG1, U(1), 'alert.enrollment.pending', () => t('mock.nWantsJoin', { name: 'Hoang Thu Em', store: 'K Coffee - District 1' }), 5);
  n(ORG1, U(1), 'alert.swap.accepted', () => t('mock.nBinhChi'), 2);
  n(ORG1, U(1), 'alert.shift.understaffed', () => t('mock.nUnderstaffed'), 1);
  n(ORG1, U(3), 'alert.points.awarded', () => t('mock.nPoints', { n: 10, reason: t('code.ON_TIME_STREAK_10') }), 96);
  n(ORG1, U(5), 'alert.violation.confirmed', () => t('mock.nViolation', { code: t('code.LATE'), n: -5 }), 144);
  n(ORG1, U(5), 'alert.swap.requested', () => t('mock.nSwapAsk', { name: 'Pham Quoc Binh' }), 3);
  n(ORG2, U(6), 'alert.schedule.published', () => t('mock.nPublished'), 20);
}
