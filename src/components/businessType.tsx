import { t } from '@/i18n';
import type { IconName } from './ui';

/** The six business types the system defines; every store has one. */
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

/** Translated name of a business type ("Ẩm thực (F&B)"). */
export function typeName(type: string | null | undefined) {
  return isBusinessType(type) ? t(`businessType.${type}`) : '';
}

export function businessIcon(type: string | null | undefined): IconName {
  return isBusinessType(type) ? BUSINESS_TYPE_ICON[type] : 'business-outline';
}
