const months = 3;
const subPackage = { basePrice: 5000, discountThreeMonths: 5 };
const packageBasePrice = 14250;
const durationDiscountPct = 5;

// Tax Items calculation
const taxItems = [
  { name: 'Package', unitPrice: 15000, quantity: 1, gstRate: 18 },
  { name: 'Add-on: Evening visit', unitPrice: 498, quantity: 1, gstRate: 18 } // just package for now
];

const rawTotalBase = 15000;
const invoiceTotalBeforeDiscount = 17700; 
const packageGrossPrice = 17700;
const durationDiscount = Math.round((packageGrossPrice * durationDiscountPct) / 100 * 100) / 100;

// Earlier we did:
const discountAmount = 750 + 300; // preTaxDuration + preTaxCoupon

const preTaxDuration = Math.max(0, (subPackage.basePrice * months) - packageBasePrice);
const couponDiscount = Math.max(0, discountAmount - preTaxDuration);
const finalDiscountAmount = durationDiscount + couponDiscount;

console.log({ durationDiscount, couponDiscount, finalDiscountAmount });
