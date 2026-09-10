/**
 * Centralized Dictionary for System-Level Benefit Types & Benefits (Mobile Backend)
 */

export const SYSTEM_BENEFITS = {
  EMERGENCY: {
    TYPE_CODE: 'EMERGENCY',
    TYPE_NAME: 'Emergency',
    BENEFIT_CODE: 'EMR_101',
    BENEFIT_NAME: 'Emergency Button',
    MATCH_PREFIXES: ['EMR_', 'EMERGENCY', 'AMBULANCE']
  },
  SATHI_COMPANION: {
    TYPE_CODE: 'SATHI_COMPANION',
    TYPE_NAME: 'Sathi Companion',
    BENEFIT_CODE: 'SATHI_102',
    BENEFIT_NAME: 'Saathi Visit',
    MATCH_PREFIXES: ['SATHI_', 'SATHI_COMPANION']
  }
};

export function isEmergencyBenefit(benefit: any): boolean {
  if (!benefit) return false;
  const bCode = benefit.code?.toUpperCase() || '';
  const bType = benefit.benefitType;
  const bTypeCode = bType?.code?.toUpperCase() || '';
  const bTypeName = bType?.name?.toLowerCase() || '';

  return (
    SYSTEM_BENEFITS.EMERGENCY.MATCH_PREFIXES.some(prefix => bCode.startsWith(prefix) || bTypeCode === prefix) ||
    bTypeName.includes('emergency') ||
    bTypeName.includes('ambulance')
  );
}

export function isSathiBenefit(benefit: any): boolean {
  if (!benefit) return false;
  const bCode = benefit.code?.toUpperCase() || '';
  const bName = (benefit.name || '').toLowerCase();
  const bType = benefit.benefitType;
  const bTypeCode = bType?.code?.toUpperCase() || '';
  const bTypeName = bType?.name?.toLowerCase() || '';

  return (
    SYSTEM_BENEFITS.SATHI_COMPANION.MATCH_PREFIXES.some(prefix => bCode.startsWith(prefix) || bTypeCode === prefix) ||
    bTypeName.includes('sathi') ||
    bTypeName.includes('saathi') ||
    bName.includes('sathi') ||
    bName.includes('saathi')
  );
}

export function findSathiBenefitBalance(benefitBalances: any[]) {
  if (!benefitBalances || benefitBalances.length === 0) return null;

  // 1. Highest priority: explicit hour-based Sathi benefit
  const hourMatch = benefitBalances.find((b: any) => {
    const bId = (b.benefitId || '').toLowerCase();
    const bName = (b.snapshotBenefitName || b.benefit?.name || '').toLowerCase();
    const unit = (b.snapshotUnitLabel || b.unit || b.benefit?.unitLabel || '').toLowerCase();
    const isSathi = isSathiBenefit(b.benefit) || bId.includes('sathi') || bName.includes('sathi') || bName.includes('companion');
    const isHour = unit.includes('hour') || unit.includes('hr') || bName.includes('hour') || bId.includes('hour');
    return isSathi && isHour;
  });
  if (hourMatch) return hourMatch;

  // 2. Secondary priority: any Sathi benefit
  return benefitBalances.find((b: any) => {
    const bId = (b.benefitId || '').toLowerCase();
    const bName = (b.snapshotBenefitName || b.benefit?.name || '').toLowerCase();
    const typeCode = (b.benefit?.benefitType?.code || '').toLowerCase();
    const typeName = (b.benefit?.benefitType?.name || '').toLowerCase();
    return isSathiBenefit(b.benefit) || bId.includes('sathi') || bName.includes('sathi') || typeCode.includes('sathi') || typeName.includes('sathi') || bName.includes('companion');
  }) || null;
}

