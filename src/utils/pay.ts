// Pay rules (store policy rules.pay) and a client-side copy of the backend PayCalculator,
// used for live examples and estimates. The backend is the source of truth for payslips.
import { t } from '@/i18n';
import { money } from './format';

export type WageBasis = 'hourly' | 'per_shift';

export interface PayRulesJson {
  basis: WageBasis;
  hours_source: 'actual' | 'actual_capped' | 'scheduled';
  rounding: { minutes: number; mode: 'nearest' | 'down' | 'up' };
  unpaid_breaks: boolean;
  min_paid_minutes: number;
  overtime: { after_hours: number; multiplier: number } | null;
  night: { start: string; end: string; multiplier: number } | null;
}

/** Defaults for new stores (same as the backend PayRules.DEFAULTS). */
export const DEFAULT_PAY: PayRulesJson = {
  basis: 'hourly', hours_source: 'actual', rounding: { minutes: 0, mode: 'nearest' }, unpaid_breaks: true,
  min_paid_minutes: 0, overtime: null, night: null,
};

/** Values a store starts from when the owner turns overtime / night pay on (both are off for a new store). */
export const OVERTIME_DEFAULT: NonNullable<PayRulesJson['overtime']> = { after_hours: 8, multiplier: 1.5 };
export const NIGHT_DEFAULT: NonNullable<PayRulesJson['night']> = { start: '22:00', end: '06:00', multiplier: 1.3 };

/** Stores created before pay rules existed. */
export const LEGACY_PAY: PayRulesJson = {
  basis: 'per_shift', hours_source: 'actual_capped', rounding: { minutes: 0, mode: 'nearest' }, unpaid_breaks: true,
  min_paid_minutes: 0, overtime: null, night: null,
};

export function payRulesOf(rules: { pay?: PayRulesJson | null } | null | undefined): PayRulesJson {
  return rules?.pay ? { ...LEGACY_PAY, ...rules.pay } : LEGACY_PAY;
}

/** "30.000 ₫ / giờ" or "180.000 ₫ / ca". */
export function wageText(amount: number | null | undefined, basis: string | null | undefined, currency = 'VND') {
  if (amount == null) return '—';
  return t(basis === 'hourly' ? 'pay.perHour' : 'common.perShift', { amount: money(amount, currency) });
}

export interface PayEstimate {
  paidMinutes: number; base: number; overtimeMinutes: number; overtime: number; nightMinutes: number; night: number; total: number;
}

const minutesOfDay = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Minutes of [startMin, endMin) (minutes from local midnight, end may exceed 1440) inside the night window. */
function nightOverlap(startMin: number, endMin: number, night: { start: string; end: string }) {
  const ns = minutesOfDay(night.start);
  let ne = minutesOfDay(night.end);
  if (ne <= ns) ne += 1440;
  let total = 0;
  for (let day = -1440; day <= 2880; day += 1440) {
    const a = Math.max(startMin, ns + day);
    const b = Math.min(endMin, ne + day);
    if (b > a) total += b - a;
  }
  return total;
}

function roundMinutes(m: number, step: number, mode: string) {
  if (step <= 1 || m === 0) return m;
  if (mode === 'down') return Math.floor(m / step) * step;
  if (mode === 'up') return Math.ceil(m / step) * step;
  return Math.round(m / step) * step;
}

/** Same as PayCalculator.overtimeMinutes: shifts over 24 h apply the threshold to each 24-hour block. */
export function overtimeMinutes(paid: number, window: number, after: number) {
  if (window <= 1440 || paid === 0) return Math.max(0, paid - after);
  let overtime = 0;
  let assigned = 0;
  for (let offset = 0; offset < window; offset += 1440) {
    const block = Math.min(1440, window - offset);
    const blockPaid = offset + 1440 >= window ? paid - assigned : Math.round((paid * block) / window);
    assigned += blockPaid;
    overtime += Math.max(0, blockPaid - after);
  }
  return overtime;
}

/**
 * Pay for a shift worked from `start` to `end` (local "HH:mm"; end before start = next day),
 * with `breakMinutes` of recorded breaks. Mirrors PayCalculator for the "actual" / "scheduled" sources.
 */
export function estimatePay(rules: PayRulesJson, basis: WageBasis, rate: number, start: string, end: string, breakMinutes = 0): PayEstimate {
  const s = minutesOfDay(start);
  let e = minutesOfDay(end);
  if (e <= s) e += 1440;
  if (basis !== 'hourly') return { paidMinutes: e - s, base: rate, overtimeMinutes: 0, overtime: 0, nightMinutes: 0, night: 0, total: rate };
  const window = e - s;
  let minutes = Math.max(0, window - (rules.unpaid_breaks ? breakMinutes : 0));
  if (minutes > 0 && minutes < rules.min_paid_minutes) minutes = rules.min_paid_minutes;
  const paid = roundMinutes(minutes, rules.rounding.minutes, rules.rounding.mode);
  const ot = rules.overtime && rules.overtime.after_hours > 0 && rules.overtime.multiplier > 1
    ? overtimeMinutes(paid, window, Math.round(rules.overtime.after_hours * 60)) : 0;
  const nightMin = rules.night && rules.night.multiplier > 1 && window > 0
    ? Math.min(paid, Math.round(nightOverlap(s, e, rules.night) * paid / window)) : 0;
  const base = Math.round((rate * paid) / 60);
  const overtime = rules.overtime ? Math.round((rate * (rules.overtime.multiplier - 1) * ot) / 60) : 0;
  const night = rules.night ? Math.round((rate * (rules.night.multiplier - 1) * nightMin) / 60) : 0;
  return { paidMinutes: paid, base, overtimeMinutes: ot, overtime, nightMinutes: nightMin, night, total: base + overtime + night };
}

/** "6 giờ 30 phút" / "6 h 30 min". */
export function hoursText(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? t('pay.hoursMinutes', { h, m }) : t('pay.hoursOnly', { h });
}
