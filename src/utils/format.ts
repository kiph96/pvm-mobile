import { currentLang, t } from '@/i18n';

// Formatting helpers. Times are shown in the store's IANA timezone so a
// shift reads the same for everyone regardless of the phone's timezone.

const pad = (n: number) => String(n).padStart(2, '0');

/** Wall-clock parts of an instant in a timezone (falls back to UTC+7 math if Intl lacks tz data). */
function parts(iso: string, timeZone = 'Asia/Ho_Chi_Minh') {
  const d = new Date(iso);
  try {
    const f = new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
    return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute };
  } catch {
    const t = new Date(d.getTime() + 7 * 3600_000);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), min: t.getUTCMinutes() };
  }
}

const weekdays = () => t('time.weekdays').split(',');
const months = () => t('time.months').split(',');
/** Mon..Sun labels in ISO order (1 = Monday). */
export const isoWeekdays = () => { const w = weekdays(); return [...w.slice(1), w[0]]; };

export function time(iso: string, tz?: string) {
  const p = parts(iso, tz);
  return `${pad(p.h)}:${pad(p.min)}`;
}

export function timeRange(start: string, end: string, tz?: string) {
  return `${time(start, tz)} – ${time(end, tz)}`;
}

/** yyyy-MM-dd of an instant in a timezone. */
export function localDateOf(iso: string, tz?: string) {
  const p = parts(iso, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** Today (or today + n days) as yyyy-MM-dd in the given timezone. */
export function today(offsetDays = 0, tz?: string) {
  return localDateOf(new Date(Date.now() + offsetDays * 86_400_000).toISOString(), tz);
}

export function addDays(date: string, n: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Monday of the week containing the date. */
export function startOfWeek(date: string) {
  const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(date, -dow);
}

/** "17/10/2027" (vi) or "17 Oct 2027" (en): use when the year matters, e.g. expiry dates. */
export function fullDate(iso: string, tz?: string) {
  const [y, m, d] = localDateOf(iso, tz).split('-').map(Number);
  return currentLang() === 'vi' ? `${d}/${m}/${y}` : `${d} ${months()[m - 1]} ${y}`;
}

/** "Mon 12 Oct" / "T2, 12 thg 10" for a yyyy-MM-dd. */
export function dayLabel(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const wd = weekdays()[d.getUTCDay()];
  const mo = months()[d.getUTCMonth()];
  return currentLang() === 'vi' ? `${wd}, ${d.getUTCDate()} ${mo}` : `${wd} ${d.getUTCDate()} ${mo}`;
}

export function weekdayShort(date: string) {
  return weekdays()[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export function dayOfMonth(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDate();
}

/** "Today", "Tomorrow", "Yesterday" or "Mon 12 Oct". */
export function relativeDay(date: string, tz?: string) {
  if (date === today(0, tz)) return t('time.today');
  if (date === today(1, tz)) return t('time.tomorrow');
  if (date === today(-1, tz)) return t('time.yesterday');
  return dayLabel(date);
}

export function dateTime(iso: string, tz?: string) {
  return `${relativeDay(localDateOf(iso, tz), tz)}, ${time(iso, tz)}`;
}

export function ago(iso: string) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return t('time.justNow');
  if (s < 3600) return t('time.minAgo', { n: Math.floor(s / 60) });
  if (s < 86_400) return t('time.hAgo', { n: Math.floor(s / 3600) });
  if (s < 7 * 86_400) return t('time.dAgo', { n: Math.floor(s / 86_400) });
  return dayLabel(localDateOf(iso));
}

export function money(amount: number | null | undefined, currency = 'VND') {
  if (amount == null) return '—';
  const digits = currency === 'VND' ? 0 : 2;
  const sep = currentLang() === 'vi' ? '.' : ',';
  const [int, frac] = Number(amount).toFixed(digits).split('.');
  const n = int.replace(/\B(?=(\d{3})+(?!\d))/g, sep) + (frac ? (sep === '.' ? ',' : '.') + frac : '');
  return currency === 'VND' ? `${n} ₫` : `${n} ${currency}`;
}

export function hoursBetween(start: string, end: string) {
  const h = (Date.parse(end) - Date.parse(start)) / 3_600_000;
  return t('time.hours', { n: Number.isInteger(h) ? h : h.toFixed(1) });
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]!.toUpperCase()).join('');
}

export function titleCase(s: string) {
  return s.replace(/[_.]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** User-facing error text: a translated message for known backend codes, otherwise the server's own text. */
export function errorMessage(e: unknown) {
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && code) {
    const key = `errors.${code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return e instanceof Error ? e.message : t('common.somethingWrong');
}
