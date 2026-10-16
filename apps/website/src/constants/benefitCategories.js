export const BENEFIT_CATEGORIES_CONFIG = [
  {
    id: 'included',
    label: 'Included',
    tagline: 'Core Plan Inclusions',
    explanation: 'Part of your plan, up to the limits shown.',
    badgeBg: '#ECFDF5',
    badgeText: '#065F46',
    badgeBorder: '#A7F3D0',
    dotBg: '#10B981',
  },
  {
    id: 'addon',
    label: 'Add-on · Member rate',
    tagline: 'On-Demand Member Perk',
    explanation: 'Available whenever you need it, at member-discounted rates for MaiHoonNa subscribers.',
    badgeBg: '#EFF6FF',
    badgeText: '#1E40AF',
    badgeBorder: '#BFDBFE',
    dotBg: '#3B82F6',
  },
  {
    id: 'arranged',
    label: 'We arrange it · Partner discount',
    tagline: 'Partner Booking & Coordination',
    explanation: 'We book and coordinate with trusted partners. You pay the partner directly, at a discounted member price.',
    badgeBg: '#FAF5FF',
    badgeText: '#6B21A8',
    badgeBorder: '#E9D5FF',
    dotBg: '#A855F7',
  },
];

export function detectDefaultBenefitCategory(benefit) {
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

  // Explicit member rate keywords
  if (
    name.includes('member rate') ||
    name.includes('on-demand')
  ) {
    return 'addon';
  }

  // Default core plan inclusion
  return 'included';
}
