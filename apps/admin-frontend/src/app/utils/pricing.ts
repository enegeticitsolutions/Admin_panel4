export interface DurationOption {
  value: string;
  label: string;
  months?: number;
  days?: number;
  isTrial?: boolean;
}

// Standard multi-month billing tenures
export const DURATION_OPTIONS: DurationOption[] = [
  { value: 'monthly', label: '1 Month', months: 1 },
  { value: 'two_months', label: '2 Months', months: 2 },
  { value: 'three_months', label: '3 Months', months: 3 },
  { value: 'six_months', label: '6 Months', months: 6 },
  { value: 'annual', label: '12 Months (Annual)', months: 12 },
];

export interface WizardPricingBreakdown {
  months: number;
  days?: number | null;
  isDays?: boolean;
  isTrial?: boolean;
  durationLabel: string;
  baseMonthlyRate: number;
  undiscountedPackageTotal: number;
  packageBasePrice: number;
  packageDiscount: number;
  discountPercent?: number;
  addonsBasePrice: number;
  addonsTax: number;
  addonsBreakdown?: any[];
  addonsFinalTotal?: number;
  totalBaseAmount: number;
  isInterState: boolean;
  customerState?: string;
  gstRate: number;
  taxLabel: string;
  packageTax: number;
  totalTaxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  couponCode?: string | null;
  couponDiscount?: number;
  finalTotalAmount: number;
  benefitsBreakdown?: any[];
}

export function parseDurationDetails(duration: string = 'monthly', pkg?: any): {
  isDays: boolean;
  days: number | null;
  months: number;
  durationLabel: string;
  isTrial: boolean;
} {
  const isPkgConfiguredTrial = Boolean(pkg?.isFreeTrial || pkg?.trialDurationDays);
  const isFree = Number(pkg?.basePrice) === 0;
  const durStr = String(duration || '').trim().toLowerCase();

  // 1. Explicit day pattern (e.g., '2_days', '3_days', '7_days', '10_days', '14_days')
  const dayMatch = durStr.match(/^(\d+)[ _-]?days?$/i);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    return {
      isDays: true,
      days,
      months: Math.max(0.1, Math.round((days / 30) * 100) / 100),
      durationLabel: `${days} Days${isFree ? ' Free Trial' : (isPkgConfiguredTrial || days <= 14 ? ' Trial' : '')}`,
      isTrial: isPkgConfiguredTrial || days <= 14,
    };
  }

  // 2. Generic 'trial' keyword or trial package without explicit month
  if (durStr === 'trial' || durStr === 'free_trial' || (isPkgConfiguredTrial && !durStr.includes('month') && durStr !== 'annual')) {
    const days = Number(pkg?.trialDurationDays) || 7;
    return {
      isDays: true,
      days,
      months: Math.max(0.1, Math.round((days / 30) * 100) / 100),
      durationLabel: `${days} Days${isFree ? ' Free Trial' : ' Trial'}`,
      isTrial: true,
    };
  }

  // 3. Month patterns
  const monthMatch = durStr.match(/^(\d+)[ _-]?months?$/i);
  let months = 1;
  if (monthMatch) {
    months = parseInt(monthMatch[1], 10);
  } else if (durStr === 'two_months' || durStr === '2') {
    months = 2;
  } else if (durStr === 'three_months' || durStr === 'quarterly' || durStr === '3') {
    months = 3;
  } else if (durStr === 'six_months' || durStr === 'half_yearly' || durStr === '6') {
    months = 6;
  } else if (durStr === 'annual' || durStr === 'yearly' || durStr === 'twelve_months' || durStr === '12') {
    months = 12;
  } else {
    months = 1;
  }

  const durationLabel = months === 1 
    ? '1 Month' 
    : months === 12 
    ? '12 Months (Annual)' 
    : `${months} Months`;

  return {
    isDays: false,
    days: null,
    months,
    durationLabel,
    isTrial: false,
  };
}

export function calculateWizardPricing(
  pkg: any | undefined,
  duration: string = 'monthly',
  addons: any[] = [],
  customerState: string = '',
  companyState: string = 'Haryana',
  couponDiscount: number = 0
): WizardPricingBreakdown {
  const durDetails = parseDurationDetails(duration, pkg);
  const isDays = durDetails.isDays;
  const days = durDetails.days;
  const months = durDetails.months;
  const isFree = !pkg || Number(pkg.basePrice) === 0;
  const isTrial = durDetails.isTrial || Boolean(pkg?.isFreeTrial);

  if (!pkg) {
    return {
      months: isDays ? 1 : months,
      days,
      isDays,
      isTrial,
      durationLabel: durDetails.durationLabel,
      baseMonthlyRate: 0,
      undiscountedPackageTotal: 0,
      packageBasePrice: 0,
      packageDiscount: 0,
      discountPercent: 0,
      addonsBasePrice: 0,
      addonsTax: 0,
      totalBaseAmount: 0,
      isInterState: false,
      gstRate: 18,
      taxLabel: 'GST (18%)',
      packageTax: 0,
      totalTaxAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      finalTotalAmount: 0,
    };
  }

  const baseRate = Number(pkg.basePrice) || 0;
  let undiscountedPackageTotal = 0;
  let packageBasePrice = 0;
  let discountPercent = 0;

  if (isFree) {
    undiscountedPackageTotal = 0;
    packageBasePrice = 0;
    discountPercent = 0;
  } else if (isDays && days) {
    // If the package is configured for fixed trial days and days match, charge base rate directly!
    if (pkg.trialDurationDays && days === pkg.trialDurationDays) {
      undiscountedPackageTotal = baseRate;
      packageBasePrice = baseRate;
    } else if (pkg.trialDurationDays) {
      const dailyRate = baseRate / pkg.trialDurationDays;
      undiscountedPackageTotal = Math.round(dailyRate * days);
      packageBasePrice = undiscountedPackageTotal;
    } else {
      // Standard monthly package prorated by 30 days
      const dailyRate = baseRate / 30;
      undiscountedPackageTotal = Math.round(dailyRate * days);
      packageBasePrice = undiscountedPackageTotal;
    }
    discountPercent = 0;
  } else {
    // Multi-month duration (1, 2, 3, 6, 12 months)
    undiscountedPackageTotal = baseRate * months;
    if (months === 3) {
      discountPercent = Number(pkg.discountThreeMonths ?? 5);
      packageBasePrice = pkg.priceThreeMonths ? Number(pkg.priceThreeMonths) : Math.round(undiscountedPackageTotal * (1 - discountPercent / 100));
    } else if (months === 6) {
      discountPercent = Number(pkg.discountSixMonths ?? 10);
      packageBasePrice = pkg.priceSixMonths ? Number(pkg.priceSixMonths) : Math.round(undiscountedPackageTotal * (1 - discountPercent / 100));
    } else if (months >= 12) {
      discountPercent = Number(pkg.discountAnnual ?? 20);
      packageBasePrice = pkg.priceTwelveMonths ? Number(pkg.priceTwelveMonths) : Math.round(undiscountedPackageTotal * (1 - discountPercent / 100));
    } else if (months === 2) {
      packageBasePrice = undiscountedPackageTotal;
      discountPercent = 0;
    } else {
      packageBasePrice = baseRate;
      discountPercent = 0;
    }
  }

  const packageDiscount = Math.max(0, undiscountedPackageTotal - packageBasePrice);
  const addonsBasePrice = (addons || []).reduce((sum, a) => sum + (Number(a.totalAmount) || 0), 0);
  const totalBaseAmount = packageBasePrice + addonsBasePrice;

  // Inter-state determination (Haryana is company POS)
  const isInterState = Boolean(customerState) && (customerState || '').trim().toLowerCase() !== (companyState || 'Haryana').trim().toLowerCase();
  const pkgGstRate = isFree ? 0 : Number(pkg.gstRate ?? 18);
  const packageTax = isFree ? 0 : Math.round((packageBasePrice * pkgGstRate) / 100);

  let addonsTax = 0;
  for (const a of (addons || [])) {
    const rate = (a.benefit?.isGstExempt || a.benefit?.gstRate === 0) ? 0 : Number(a.benefit?.gstRate ?? 18);
    addonsTax += Math.round(((Number(a.totalAmount) || 0) * rate) / 100);
  }

  const totalTaxAmount = packageTax + addonsTax;
  const cgstAmount = isInterState ? 0 : Math.round(totalTaxAmount / 2);
  const sgstAmount = isInterState ? 0 : Math.round(totalTaxAmount / 2);
  const igstAmount = isInterState ? totalTaxAmount : 0;
  const finalTotalAmount = Math.max(0, totalBaseAmount + totalTaxAmount - couponDiscount);

  const taxLabel = isInterState ? `IGST (${pkgGstRate}%)` : `CGST (${pkgGstRate / 2}%) + SGST (${pkgGstRate / 2}%)`;

  return {
    months: isDays ? 1 : months,
    days,
    isDays,
    isTrial,
    durationLabel: durDetails.durationLabel,
    baseMonthlyRate: baseRate,
    undiscountedPackageTotal,
    packageBasePrice,
    packageDiscount,
    discountPercent,
    addonsBasePrice,
    addonsTax,
    totalBaseAmount,
    isInterState,
    customerState,
    gstRate: pkgGstRate,
    taxLabel,
    packageTax,
    totalTaxAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    couponDiscount,
    finalTotalAmount,
  };
}
