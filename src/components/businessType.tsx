import { t } from '@/i18n';
import type { IconName } from './ui';

/** The six business types the system defines (owners do not create or name Businesses). */
export const BUSINESS_TYPES = ['food_beverage', 'retail_fashion', 'education', 'finance_services', 'manufacturing', 'others'] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_TYPE_ICON: Record<BusinessType, IconName> = {
  food_beverage: 'cafe-outline',
  retail_fashion: 'shirt-outline',
  education: 'school-outline',
  finance_services: 'briefcase-outline',
  manufacturing: 'construct-outline',
  others: 'apps-outline',
};

export const isBusinessType = (v: unknown): v is BusinessType => BUSINESS_TYPES.includes(v as BusinessType);

/** Display name of a Business: its translated type ("Ẩm thực (F&B)"), falling back to the stored name. */
export function businessName(b: { businessType?: string | null; name?: string | null } | null | undefined) {
  if (!b) return '';
  return isBusinessType(b.businessType) ? t(`businessType.${b.businessType}`) : b.name ?? '';
}

export function businessIcon(type: string | null | undefined): IconName {
  return isBusinessType(type) ? BUSINESS_TYPE_ICON[type] : 'business-outline';
}
