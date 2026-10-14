import type { Benefit } from '../../../../types';

export type BenefitTierCategory = 'included' | 'addon' | 'arranged';

export interface BenefitSetting {
  quantity: number;
  frequency: 'monthly' | '3_months' | '6_months' | 'yearly' | 'one_time' | 'unlimited';
  allocationBasis: 'per_billing_cycle' | 'per_subscription_term' | 'min_tenure_required';
  minSubscriptionMonths: number;
  allowRollover: boolean;
  maxRolloverUnits?: number;
  isUnlimited: boolean;
  showUnit?: boolean;
  category: BenefitTierCategory;
}

export type WizardStep = 'define' | 'benefits' | 'units' | 'review';

export interface CategoryConfig {
  id: BenefitTierCategory;
  label: string;
  tagline: string;
  explanation: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  dotBg: string;
  headerBg: string;
}

export const BENEFIT_CATEGORIES_CONFIG: CategoryConfig[] = [
  {
    id: 'included',
    label: 'Included',
    tagline: 'Core Plan Inclusions',
    explanation: 'Part of your plan, up to the limits shown.',
    badgeBg: 'bg-emerald-50',
    badgeBorder: 'border-emerald-200',
    badgeText: 'text-emerald-800',
    dotBg: 'bg-emerald-500',
    headerBg: 'bg-emerald-50/70',
  },
  {
    id: 'addon',
    label: 'Add-on · Member rate',
    tagline: 'On-Demand Member Perk',
    explanation: 'Available whenever you need it, at a lower rate for MaiHoonNa members.',
    badgeBg: 'bg-blue-50',
    badgeBorder: 'border-blue-200',
    badgeText: 'text-blue-800',
    dotBg: 'bg-blue-500',
    headerBg: 'bg-blue-50/70',
  },
  {
    id: 'arranged',
    label: 'We arrange it · Partner discount',
    tagline: 'Partner Booking & Coordination',
    explanation: 'We book and coordinate with trusted partners. You pay the partner directly, at a discounted member price.',
    badgeBg: 'bg-purple-50',
    badgeBorder: 'border-purple-200',
    badgeText: 'text-purple-800',
    dotBg: 'bg-purple-500',
    headerBg: 'bg-purple-50/70',
  },
];

export function detectDefaultBenefitCategory(benefit?: Partial<Benefit> | null): BenefitTierCategory {
  if (!benefit) return 'included';
  const name = (benefit.name || '').toLowerCase();
  const desc = (benefit.description || '').toLowerCase();

  // "We arrange it" / Partner discount / Facilitation keywords
  if (
    name.includes('facilitation') ||
    name.includes('coordination') ||
    name.includes('referral') ||
    name.includes('dentist home visit') ||
    name.includes('doctor at home') ||
    name.includes('ambulance support') ||
    name.includes('pharmacy assist') ||
    name.includes('travel made easy') ||
    desc.includes('facilitation') ||
    desc.includes('trusted partners') ||
    desc.includes('pay the partner directly')
  ) {
    return 'arranged';
  }

  // "Add-on · Member rate" keywords
  if (
    name.includes('add-on') ||
    name.includes('addon') ||
    name.includes('member rate') ||
    name.includes('on-demand') ||
    name.includes('discount on medicines') ||
    name.includes('lab test discount') ||
    (benefit as any).isAddon === true
  ) {
    return 'addon';
  }

  // Default core plan inclusion
  return 'included';
}
