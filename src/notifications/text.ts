import type { NotificationView } from '@/api/types';
import { t } from '@/i18n';
import { dayLabel, money, titleCase } from '@/utils/format';

const DATE_PARAMS = ['date', 'week', 'from', 'to'];

/** Translate a server code (LATE, ON_TIME_STREAK_10, ...) when we know it, else show it as sent. */
function codeText(value: string) {
  const r = t(`code.${value}`);
  return r === `code.${value}` ? value : r;
}

/**
 * Text of a notification in the app's language: `notify.<code>` filled from
 * params (dates and amounts formatted here), falling back to the server's
 * English title for codes this build does not know.
 */
export function notificationText(n: Pick<NotificationView, 'eventType' | 'title' | 'code' | 'params'>): string {
  const key = n.code ? `notify.${n.code}` : null;
  if (key && t(key) !== key) {
    const p: Record<string, string | number | null> = { ...(n.params ?? {}) };
    for (const k of DATE_PARAMS) {
      if (typeof p[k] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p[k] as string)) p[k] = dayLabel(p[k] as string);
    }
    if (p.amount != null) p.amount = money(Number(p.amount), (p.currency as string) ?? 'VND');
    if (typeof p.code === 'string') p.code = codeText(p.code);
    if (typeof p.reason === 'string') p.reason = codeText(p.reason);
    if (typeof p.reward === 'string') p.reward = codeText(p.reward);
    return t(key, p);
  }
  return n.title ?? titleCase(n.eventType.replace('alert.', ''));
}
