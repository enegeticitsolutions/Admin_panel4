import { Router, Request, Response, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, optionalAuthenticate, AuthRequest } from '../shared/deps';
import * as subscriptionService from '../../services/subscriber/subscription_service';
import { validateCoupon } from '../../services/coupon_service';
import prisma from '../../core/database';
import { createOrder, verifyPaymentSignature } from '../../services/razorpay_service';
import { config } from '../../core/config';
import { sendAddonPurchaseNotifications } from '../../services/notification_service';
import { generateUUID } from '../../utils/helpers';
import { generateInvoiceNumber, calculateItemizedInvoice, BenefitTaxItem } from '../../utils/invoice_utils';
import { notificationProducer } from '@maihoonna/notifications';

const router = Router();

// Payment & Order Rate Limiter (max 30 requests per 15 mins per IP)
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many payment requests from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── GST rate used everywhere in checkout (server-side source of truth) ───────
const GST_RATE = 0.18; // 18% fallback

// ─────────────────────────────────────────────────────────────────────────────
// Helper to resolve multi-month package price
// ─────────────────────────────────────────────────────────────────────────────
function getMultiMonthPackagePrice(pkg: any, monthlyBase: number, months: number): number {
  if (months === 3) {
    if (pkg.priceThreeMonths) return Number(pkg.priceThreeMonths);
    const disc = Number(pkg.discountThreeMonths ?? 5);
    return Math.round(monthlyBase * 3 * (1 - disc / 100));
  }
  if (months === 6) {
    if (pkg.priceSixMonths) return Number(pkg.priceSixMonths);
    const disc = Number(pkg.discountSixMonths ?? 10);
    return Math.round(monthlyBase * 6 * (1 - disc / 100));
  }
  if (months >= 12) {
    if (pkg.priceTwelveMonths) return Number(pkg.priceTwelveMonths);
    const disc = Number(pkg.discountAnnual ?? 20);
    return Math.round(monthlyBase * 12 * (1 - disc / 100));
  }
  // Default: 1 month = monthly base
  return monthlyBase;
}

function formatUnitType(unitLabel: string | null | undefined, units: number = 1): string {
  if (!unitLabel) return units === 1 ? 'Unit' : 'Units';
  const clean = String(unitLabel).replace(/^per\s+/i, '').trim().toLowerCase();
  if (clean === 'hour') return units === 1 ? 'Hour' : 'Hours';
  if (clean === 'visit') return units === 1 ? 'Visit' : 'Visits';
  if (clean === 'session') return units === 1 ? 'Session' : 'Sessions';
  if (clean === 'test') return units === 1 ? 'Test' : 'Tests';
  if (clean === 'day') return units === 1 ? 'Day' : 'Days';
  if (clean === 'month') return units === 1 ? 'Month' : 'Months';
  const cap = clean.charAt(0).toUpperCase() + clean.slice(1);
  return (units > 1 && !cap.endsWith('s')) ? `${cap}s` : cap;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper to calculate exact pricing using benefit-level database GST rates
// (Excel Spreadsheet model: Benefit Price + Benefit GST = Final Price,
// Package Gross Total = sum of benefit final prices, Final Payable = Gross - Discount)
// ─────────────────────────────────────────────────────────────────────────────
async function calculatePricing(
  packageId: string, 
  couponCode: string | undefined, 
  userId: string,
  selectedAddons?: Array<{ benefitId: string; quantity: number }>,
  durationMonths: number = 1
) {
  const pkg: any = await prisma.subscriptionPackage.findFirst({
    where: {
      OR: [{ id: packageId }, { type: packageId }],
      isActive: true,
    },
    include: {
      packageBenefits: {
        orderBy: { displayOrder: 'asc' },
        include: {
          benefit: true,
        },
      },
    } as any,
  });

  if (!pkg) {
    throw new Error('Package not found or inactive');
  }

  const months = Math.max(1, Math.floor(Number(durationMonths) || 1));
  const baseMonthlyRate = Number(pkg.basePrice) || 0;

  // Tenure / duration discount percentage
  let durationDiscountPct = 0;
  if (months === 3) durationDiscountPct = Number(pkg.discountThreeMonths ?? 5);
  else if (months === 6) durationDiscountPct = Number(pkg.discountSixMonths ?? 10);
  else if (months >= 12) durationDiscountPct = Number(pkg.discountAnnual ?? 20);

  // 1. Calculate each benefit's base price and GST using its database GST %
  const packageBenefits = pkg.packageBenefits || [];
  let catalogTotal = 0;
  packageBenefits.forEach((pb: any) => {
    const uCost = Number(pb.benefit?.unitCost) || 0;
    const uCount = pb.unitsIncluded || 1;
    catalogTotal += uCost * uCount;
  });

  const benefitsBreakdown: any[] = [];
  let totalPackageBase = 0;
  let totalPackageTax = 0;

  if (packageBenefits.length > 0) {
    packageBenefits.forEach((pb: any) => {
      const b = pb.benefit;
      if (!b) return;

      const uCost = Number(b.unitCost) || 0;
      const uCount = pb.unitsIncluded || 1;
      const lineCatalog = uCost * uCount;

      let benefitMonthlyBase = 0;
      if (catalogTotal > 0) {
        benefitMonthlyBase = (baseMonthlyRate * lineCatalog) / catalogTotal;
      } else {
        benefitMonthlyBase = baseMonthlyRate / packageBenefits.length;
      }

      const benefitTermBase = Math.round(benefitMonthlyBase * months * 100) / 100;
      const gstRate = b.isGstExempt ? 0 : Number(b.gstRate !== null && b.gstRate !== undefined ? b.gstRate : 18);
      const gstAmount = Math.round((benefitTermBase * gstRate) / 100 * 100) / 100;
      const finalPrice = Math.round((benefitTermBase + gstAmount) * 100) / 100;

      totalPackageBase += benefitTermBase;
      totalPackageTax += gstAmount;

      const count = uCount * months;
      const unitType = formatUnitType(b.unitLabel, count);

      benefitsBreakdown.push({
        benefitId: b.id,
        name: b.name,
        units: count,
        unitLabel: b.unitLabel || 'units',
        unitType,
        unitDisplay: `Units: ${count} ${unitType}`,
        price: benefitTermBase,
        gstRate,
        gstAmount,
        finalPrice,
        isGstExempt: b.isGstExempt || false,
        hsnSacCode: b.hsnSacCode || '',
      });
    });
  } else {
    const gstRate = Number(pkg.gstRate ?? 18);
    const benefitTermBase = Math.round(baseMonthlyRate * months * 100) / 100;
    const gstAmount = Math.round((benefitTermBase * gstRate) / 100 * 100) / 100;
    const finalPrice = benefitTermBase + gstAmount;

    totalPackageBase = benefitTermBase;
    totalPackageTax = gstAmount;

    benefitsBreakdown.push({
      name: pkg.name,
      units: 1,
      unitLabel: 'package',
      unitType: 'Package',
      unitDisplay: 'Units: 1 Package',
      price: benefitTermBase,
      gstRate,
      gstAmount,
      finalPrice,
      isGstExempt: false,
      hsnSacCode: '998399',
    });
  }

  totalPackageBase = Math.round(totalPackageBase * 100) / 100;
  totalPackageTax = Math.round(totalPackageTax * 100) / 100;
  const packageGrossPrice = Math.round((totalPackageBase + totalPackageTax) * 100) / 100;

  // Tenure / duration discount on gross price (e.g. 10% on 17400 -> 1740)
  const durationDiscount = Math.round((packageGrossPrice * durationDiscountPct) / 100 * 100) / 100;
  const packageFinalPayable = Math.round((packageGrossPrice - durationDiscount) * 100) / 100;

  // 2. Add-ons breakdown
  let addonsTotalPrice = 0;
  let addonsTax = 0;
  const addonsBreakdown: any[] = [];

  if (selectedAddons && Array.isArray(selectedAddons) && selectedAddons.length > 0) {
    for (const addonItem of selectedAddons) {
      if (!addonItem.benefitId) continue;
      const q = Math.max(1, Math.floor(Number(addonItem.quantity) || 1));
      const benefit = await prisma.benefit.findUnique({
        where: { id: addonItem.benefitId },
        select: { id: true, name: true, unitLabel: true, addonPrice: true, addonDiscountPrice: true, addonIncludedUnits: true, taxCategory: true, gstRate: true, hsnSacCode: true, isGstExempt: true }
      });
      if (benefit && benefit.addonPrice) {
        const unitP = benefit.addonDiscountPrice ?? benefit.addonPrice;
        const itemTotal = unitP * q;
        const effectiveGstRate = benefit.isGstExempt ? 0 : (benefit.gstRate !== null && benefit.gstRate !== undefined ? benefit.gstRate : 18);
        const itemTax = Math.round((itemTotal * effectiveGstRate) / 100 * 100) / 100;
        addonsTotalPrice += itemTotal;
        addonsTax += itemTax;

        const unitType = formatUnitType(benefit.unitLabel, q);

        addonsBreakdown.push({
          benefitId: benefit.id,
          name: benefit.name,
          unitLabel: benefit.unitLabel,
          unitType,
          unitDisplay: `Units: ${q} ${unitType}`,
          quantity: q,
          includedUnits: (benefit.addonIncludedUnits || 1) * q,
          unitPrice: unitP,
          totalPrice: itemTotal,
          taxCategory: benefit.taxCategory,
          gstRate: effectiveGstRate,
          hsnSacCode: benefit.hsnSacCode,
          isGstExempt: benefit.isGstExempt || false,
          taxAmount: itemTax,
          totalWithTax: Math.round((itemTotal + itemTax) * 100) / 100,
        });
      }
    }
  }

  const addonsFinalTotal = Math.round((addonsTotalPrice + addonsTax) * 100) / 100;
  let subtotalPayable = Math.round((packageFinalPayable + addonsFinalTotal) * 100) / 100;

  // 3. Coupon validation
  let couponDiscount = 0;
  let couponValid = false;
  let couponId: string | null = null;
  let couponMessage: string | undefined;

  if (couponCode && couponCode.trim()) {
    const code = couponCode.trim().toUpperCase();
    let isFirstTime = true;
    if (userId && userId !== 'guest') {
      const previousSubs = await prisma.subscription.count({
        where: { subscriberId: userId }
      });
      isFirstTime = previousSubs === 0;
    }

    const validation = await validateCoupon(code, userId || 'guest', (pkg as any).type, subtotalPayable, isFirstTime);

    if (validation.isValid) {
      couponDiscount = validation.discountApplied;
      subtotalPayable = validation.finalAmount;
      couponValid = true;
      couponId = validation.couponId || null;
    } else {
      couponMessage = validation.message;
    }
  }

  const totalTaxAmount = Math.round((totalPackageTax + addonsTax) * 100) / 100;
  const tax = totalTaxAmount;
  const total = Math.round(subtotalPayable * 100) / 100;

  // Dates
  const now = new Date();
  const projectedStartDate = now.toISOString().split('T')[0];
  const projectedEnd = new Date(now);
  projectedEnd.setMonth(projectedEnd.getMonth() + months);
  const projectedEndDate = projectedEnd.toISOString().split('T')[0];

  return {
    pkg,
    durationMonths: months,
    durationDiscountPct,
    durationDiscount,
    packageBasePrice: totalPackageBase,
    packageGrossPrice,
    packageFinalPayable,
    benefitsBreakdown,
    addonsTotalPrice,
    addonsTax,
    addonsFinalTotal,
    addonsBreakdown,
    basePrice: Math.round((totalPackageBase + addonsTotalPrice) * 100) / 100,
    totalTaxAmount: Math.round((totalPackageTax + addonsTax) * 100) / 100,
    couponDiscount,
    couponValid,
    couponId,
    couponMessage,
    total,
    projectedStartDate,
    projectedEndDate,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /subscriber/subscriptions/checkout/preview
// Server-side benefit-by-benefit pricing & GST calculation
// Body: { packageId, couponCode?, selectedAddons?, durationMonths? }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/checkout/preview', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId || 'guest';
    const { packageId, couponCode, selectedAddons, durationMonths } = req.body;

    if (!packageId) {
      return res.status(400).json({ success: false, message: 'packageId is required' });
    }

    const months = Math.max(1, Math.floor(Number(durationMonths) || 1));
    const pricing = await calculatePricing(packageId, couponCode, userId, selectedAddons, months);

    return res.json({
      success: true,
      data: {
        packageId: pricing.pkg.id,
        packageName: pricing.pkg.name,
        durationMonths: pricing.durationMonths,
        durationDiscountPct: pricing.durationDiscountPct,
        durationDiscount: pricing.durationDiscount,
        packageBasePrice: pricing.packageBasePrice,
        packageGrossPrice: pricing.packageGrossPrice,
        packageFinalPayable: pricing.packageFinalPayable,
        benefitsBreakdown: pricing.benefitsBreakdown,
        addonsTotalPrice: pricing.addonsTotalPrice,
        addonsTax: pricing.addonsTax,
        addonsFinalTotal: pricing.addonsFinalTotal,
        addonsBreakdown: pricing.addonsBreakdown,
        basePrice: pricing.basePrice,
        totalTaxAmount: pricing.totalTaxAmount,
        couponDiscount: pricing.couponDiscount,
        couponValid: pricing.couponValid,
        couponId: pricing.couponId,
        couponMessage: pricing.couponMessage,
        total: pricing.total,
        projectedStartDate: pricing.projectedStartDate,
        projectedEndDate: pricing.projectedEndDate,
      },
    });
  } catch (error: any) {
    console.error('[Checkout Preview Error]:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to calculate checkout pricing' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /subscriber/subscriptions/create-order
// Server-side calculation -> create razorpay order
// Body: { packageId, couponCode?, selectedAddons?, durationMonths? }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/create-order', paymentLimiter as unknown as RequestHandler, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { packageId, couponCode, selectedAddons, durationMonths } = req.body;

    if (!packageId) {
      return res.status(400).json({ success: false, message: 'packageId is required' });
    }

    const months = Math.max(1, Math.floor(Number(durationMonths) || 1));
    const pricing = await calculatePricing(packageId, couponCode, userId, selectedAddons, months);
    
    // Receipt ID must be max 40 chars. 
    // Format: rcpt_ + first 8 chars of userId + _ + timestamp (total ~27 chars)
    const shortUserId = userId.substring(0, 8);
    const receiptId = `rcpt_${shortUserId}_${Date.now()}`.substring(0, 40);
    
    // Create the Razorpay Order
    const order = await createOrder(pricing.total, receiptId);
    
    res.json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        key_id: order.key_id
      }
    });

  } catch (error: any) {
    console.error('[Razorpay Create Order Error]:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create order' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /subscriber/subscriptions/:subscriptionId/link-beneficiary
// Links an existing beneficiary to an unlinked care plan.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:subscriptionId/link-beneficiary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { subscriptionId } = req.params;
    const { beneficiaryId } = req.body;

    if (!beneficiaryId) {
      return res.status(400).json({ success: false, message: 'beneficiaryId is required' });
    }

    // 1. Verify subscription ownership and ensure it's unlinked
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }
    if (subscription.subscriberId !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (subscription.beneficiaryId) {
      return res.status(400).json({ success: false, message: 'Subscription is already linked to a beneficiary' });
    }

    // 2. Verify beneficiary ownership
    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: beneficiaryId }
    });

    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    }
    if (beneficiary.subscriberId !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // 3. Link them in a transaction (Update Subscription and reset dates from activation moment)
    await prisma.$transaction(async (tx) => {
      const newStart = new Date();
      const newEnd = new Date(newStart);
      let months = 1;
      if (subscription.startDate && subscription.endDate) {
        const diffDays = Math.round((new Date(subscription.endDate).getTime() - new Date(subscription.startDate).getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 300) months = 12;
        else if (diffDays >= 150) months = 6;
        else if (diffDays >= 70) months = 3;
        else months = 1;
      } else if (subscription.duration === 'annual') {
        months = 12;
      } else if (subscription.duration === 'six_months') {
        months = 6;
      }
      newEnd.setMonth(newEnd.getMonth() + months);

      await tx.subscription.update({
        where: { id: subscriptionId },
        data: { 
          beneficiaryId: beneficiaryId,
          startDate: newStart,
          endDate: newEnd,
          isActive: true,
        }
      });

      await tx.payment.updateMany({
        where: { subscriptionId: subscriptionId },
        data: { 
          beneficiaryId: beneficiaryId,
          planStartDate: newStart,
          planEndDate: newEnd,
        }
      });
    });

    res.json({
      success: true,
      message: 'Successfully linked beneficiary to care plan',
    });

  } catch (error: any) {
    console.error('[Link Beneficiary Error]:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to link beneficiary' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /subscriber/subscriptions/purchase
// ─────────────────────────────────────────────────────────────────────────────
router.post('/purchase', paymentLimiter as unknown as RequestHandler, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!; // Use authenticated userId
    const { 
      packageId, 
      beneficiaryData, 
      medicalData, 
      emergencyContacts, 
      couponCode,
      selectedAddons,
      durationMonths,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature
    } = req.body;

    if (!packageId) {
      throw new Error("Missing required payload field: packageId is required.");
    }

    // Check duplicate payment claim / replay prevention
    if (razorpay_payment_id && !razorpay_payment_id.startsWith('DEV_MOCK_PAYMENT_')) {
      const existingPayment = await prisma.payment.findFirst({
        where: {
          OR: [
            { gatewayPaymentId: razorpay_payment_id },
            { transactionId: razorpay_payment_id }
          ]
        }
      });
      if (existingPayment) {
        return res.status(409).json({
          success: false,
          message: 'This payment transaction has already been processed and claimed.'
        });
      }
    }

    // Verify Payment Signature
    const isDevMockAllowed = config.nodeEnv === 'development' && process.env.ENABLE_MOCK_PAYMENTS === 'true';
    if (razorpay_signature === 'DEV_MOCK_SIGNATURE') {
      if (!isDevMockAllowed) {
        return res.status(403).json({ success: false, message: 'Mock payment signatures are not permitted in this environment.' });
      }
      console.log("⚠️ DEV MODE: Bypassing Razorpay Signature Verification using mock signature.");
    } else {
      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Payment verification details (payment_id, order_id, signature) are required.' });
      }
      const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
      if (!isValid) {
        throw new Error("Invalid payment signature. Payment verification failed.");
      }
    }

    const result = await subscriptionService.purchaseSubscription(
      userId,
      packageId,
      beneficiaryData,
      medicalData,
      emergencyContacts,
      couponCode,
      selectedAddons,
      durationMonths,
      {
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature
      }
    );

    // Generate new token containing the updated subscriber role
    const { createToken } = require('../../core/security');
    const newToken = createToken({ sub: userId, role: 'subscriber' });
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, name: true, age: true, role: true }
    });

    const responseData = result as any;
    if (responseData.success) {
      responseData.token = newToken;
      responseData.user = updatedUser;

      // NT-044: PAYMENT_SUCCESS & NT-004: SUBSCRIPTION_ACTIVATED (Decoupled Redis Streams)
      (async () => {
        try {
          const subscriberPhone = updatedUser?.phone;
          if (subscriberPhone) {
            const paidAmount = responseData.amount || responseData.total || 'Paid';
            const benefName = (beneficiaryData as any)?.fullName || (beneficiaryData as any)?.name || 'Beneficiary';
            const pkgName = responseData.packageName || packageId;

            // NT-044: Payment successful
            await notificationProducer.publish({
              idempotencyKey: `payment-${razorpay_payment_id || userId}-success`,
              channel: 'whatsapp',
              event: 'PAYMENT_SUCCESS',
              recipient: { phone: subscriberPhone },
              variables: {
                subscriberName: updatedUser?.name || 'Subscriber',
                amount: String(paidAmount),
                transactionId: razorpay_payment_id || userId,
              },
            });

            // NT-004: Subscription activated
            await notificationProducer.publish({
              idempotencyKey: `sub-${userId}-${packageId}-activated`,
              channel: 'whatsapp',
              event: 'SUBSCRIPTION_ACTIVATED',
              recipient: { phone: subscriberPhone },
              variables: {
                subscriberName: updatedUser?.name || 'Subscriber',
                packageName: pkgName,
                beneficiaryName: benefName,
                startDate: new Date().toLocaleDateString('en-IN'),
              },
            });
          }
        } catch (notifErr: any) {
          console.error('[Purchase Notification Error]:', notifErr.message);
        }
      })();
    }

    res.json(responseData);
  } catch (error: any) {
    console.error('[Purchase Error]:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /subscriber/subscriptions/activate
// ─────────────────────────────────────────────────────────────────────────────
router.post('/activate', authenticate, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.userId;
    const { beneficiaryId, beneficiaryData, medicalData, emergencyContacts } = req.body;

    if (!beneficiaryId) {
      return res.status(400).json({
        success: false,
        message: 'beneficiaryId is required'
      });
    }

    const result = await subscriptionService.activateSubscription(
      userId as string,
      beneficiaryId,
      beneficiaryData || {},
      medicalData,
      emergencyContacts
    );

    // Generate new token containing the updated subscriber role
    const { createToken } = require('../../core/security');
    const newToken = createToken({ sub: userId as string, role: 'subscriber' });
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId as string },
      select: { id: true, phone: true, name: true, age: true, role: true }
    });

    res.json({
      success: true,
      message: 'Subscription activated successfully',
      data: {
        ...result,
        token: newToken,
        user: updatedUser
      }
    });
  } catch (error: any) {
    console.error('[Activate Subscription Error]:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /subscriber/subscriptions/unlinked-check
// Check if the authenticated user has an active subscription with no beneficiary
// ─────────────────────────────────────────────────────────────────────────────
router.get('/unlinked-check', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const unlinkedSub = await prisma.subscription.findFirst({
      where: { subscriberId: userId, isActive: true, beneficiaryId: null },
      include: { package: true }
    });

    res.json({
      success: true,
      hasUnlinkedSubscription: !!unlinkedSub,
      subscription: unlinkedSub ? {
        id: unlinkedSub.id,
        packageType: unlinkedSub.packageType,
        packageName: (unlinkedSub.package as any)?.name || unlinkedSub.packageType,
        startDate: unlinkedSub.startDate,
        endDate: unlinkedSub.endDate
      } : null
    });
  } catch (error: any) {
    console.error('[Unlinked Check Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /subscriber/subscriptions/link-beneficiary
// Link a beneficiary to an existing unlinked subscription
// Body: { beneficiaryData, medicalData?, emergencyContacts?, preferencesData? }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/link-beneficiary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { beneficiaryData, medicalData, emergencyContacts, preferencesData } = req.body;

    if (!beneficiaryData) {
      return res.status(400).json({ success: false, message: 'beneficiaryData is required' });
    }

    const result = await subscriptionService.linkBeneficiaryToSubscription(
      userId,
      beneficiaryData,
      medicalData,
      emergencyContacts,
      preferencesData
    );

    // Generate new token containing the updated subscriber role
    const { createToken } = require('../../core/security');
    const newToken = createToken({ sub: userId, role: 'subscriber' });
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, name: true, age: true, role: true }
    });

    res.json({
      success: true,
      message: 'Beneficiary linked successfully',
      beneficiaryId: result.beneficiaryId,
      beneficiaryName: result.beneficiaryName,
      token: newToken,
      user: updatedUser
    });
  } catch (error: any) {
    console.error('[Link Beneficiary Error]:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /subscriber/subscriptions/packages
// ─────────────────────────────────────────────────────────────────────────────
router.get('/packages', async (req: Request, res: Response) => {
  try {
    const regionId = req.query.regionId as string | undefined;
    const packages = await subscriptionService.getSubscriptionPackages(regionId);
    res.json({ success: true, data: packages });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

function formatAddonUnitText(count: number, rawLabel?: string | null): string {
  if (!rawLabel) return count === 1 ? '1 unit' : `${count} units`;
  let clean = rawLabel.trim().replace(/^per\s+/i, '');
  const lower = clean.toLowerCase();

  if (lower === 'visit') clean = count === 1 ? 'visit' : 'visits';
  else if (lower === 'hour' || lower === 'hr' || lower === 'hours' || lower === 'hrs') clean = count === 1 ? 'hour' : 'hours';
  else if (lower === 'session') clean = count === 1 ? 'session' : 'sessions';
  else if (lower === 'test') clean = count === 1 ? 'test' : 'tests';
  else if (lower === 'trip') clean = count === 1 ? 'trip' : 'trips';
  else if (lower === 'consult' || lower === 'consultation') clean = count === 1 ? 'consult' : 'consults';
  else if (lower === 'order') clean = count === 1 ? 'order' : 'orders';
  else if (lower === 'request') clean = count === 1 ? 'request' : 'requests';
  else if (lower === 'day') clean = count === 1 ? 'day' : 'days';
  else if (lower === 'month') clean = count === 1 ? 'month' : 'months';
  else {
    if (count !== 1 && !lower.endsWith('s')) {
      clean = clean + 's';
    }
  }

  return `${count} ${clean}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Calculate add-on pricing (same GST_RATE as main checkout)
// ─────────────────────────────────────────────────────────────────────────────
async function calculateAddonPricing(benefitId: string, subscriptionId: string, userId: string, quantity: number = 1) {
  const q = Math.max(1, Math.floor(Number(quantity) || 1));

  // 1. Fetch the benefit (includes tax fields — all from DB, not hardcoded)
  const benefit = await prisma.benefit.findUnique({
    where: { id: benefitId },
    include: { benefitType: { select: { name: true } } }
  });

  if (!benefit) throw new Error('Benefit not found');
  if (!benefit.isAddon) throw new Error('This benefit is not available as an add-on');
  if (!benefit.isActive) throw new Error('This benefit is not currently active');
  if (benefit.addonPrice === null || benefit.addonPrice === undefined) throw new Error('Add-on price is not configured for this benefit');

  // 2. Verify subscription ownership and load beneficiary state for place-of-supply
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, subscriberId: userId, isActive: true },
    include: {
      beneficiary: { select: { id: true, name: true, userId: true, state: true } },
    }
  });
  if (!subscription) throw new Error('Active subscription not found or access denied');

  // 3. Resolve GST rate from DB (priority: exempt → benefit.gstRate → TaxCategory → system default)
  let resolvedGstRate = 18; // absolute last resort
  let resolvedHsnSac = benefit.hsnSacCode || '998399';

  if (benefit.isGstExempt) {
    resolvedGstRate = 0;
    resolvedHsnSac = benefit.hsnSacCode || '999312';
  } else if (benefit.gstRate !== null && benefit.gstRate !== undefined) {
    resolvedGstRate = parseFloat(benefit.gstRate as any);
  } else if (benefit.taxCategory) {
    // Look up TaxCategory table — the real source of truth
    const category = await prisma.taxCategory.findUnique({ where: { code: benefit.taxCategory } });
    if (category && category.isActive) {
      resolvedGstRate = parseFloat(category.gstRate as any);
      resolvedHsnSac = benefit.hsnSacCode || category.hsnSacCode || '998399';
    } else {
      // Try system_configs DEFAULT_GST_RATE as last DB-driven fallback
      const sysConfig = await prisma.systemConfig.findUnique({ where: { key: 'DEFAULT_GST_RATE' } }).catch(() => null);
      if (sysConfig?.value) resolvedGstRate = parseFloat(sysConfig.value) || 18;
    }
  }

  // 4. Calculate pricing
  const singleBasePrice = benefit.addonDiscountPrice ?? benefit.addonPrice;
  const singleOriginalPrice = benefit.addonPrice;
  const singleUnits = benefit.addonIncludedUnits ?? 1;

  const basePrice = parseFloat((singleBasePrice * q).toFixed(2));
  const originalPrice = parseFloat((singleOriginalPrice * q).toFixed(2));
  const tax = parseFloat((basePrice * resolvedGstRate / 100).toFixed(2));
  const total = parseFloat((basePrice + tax).toFixed(2));
  const includedUnits = singleUnits * q;

  // Place of supply from beneficiary state (not hardcoded)
  const placeOfSupply = (subscription as any).beneficiary?.state || 'Haryana';

  return {
    benefit,
    subscription,
    quantity: q,
    unitPrice: singleBasePrice,
    unitIncludedUnits: singleUnits,
    basePrice,
    originalPrice,
    hasDiscount: !!(benefit.addonDiscountPrice && benefit.addonDiscountPrice < benefit.addonPrice),
    taxRate: resolvedGstRate,
    taxCategory: benefit.taxCategory,
    hsnSacCode: resolvedHsnSac,
    isGstExempt: benefit.isGstExempt || false,
    tax,
    total,
    includedUnits,
    placeOfSupply,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /subscriber/subscriptions/addons/available
// Returns all active benefits marked as add-ons
// ─────────────────────────────────────────────────────────────────────────────
router.get('/addons/available', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const regionId = req.query.regionId as string | undefined;

    const addons = await prisma.benefit.findMany({
      where: {
        isAddon: true,
        isActive: true,
        OR: [
          { isGlobal: true },
          regionId ? {
            isGlobal: false,
            benefitRegions: {
              some: { regionId }
            }
          } : null
        ].filter(Boolean) as any
      },
      include: { benefitType: { select: { id: true, name: true, iconCode: true } } },
      orderBy: [{ benefitType: { displayOrder: 'asc' } }, { displayOrder: 'asc' }]
    });

    return res.json({ success: true, data: addons });
  } catch (error: any) {
    console.error('[Addon Available Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /subscriber/subscriptions/addon/preview
// Returns pricing breakdown for an add-on before payment.
// Body: { subscriptionId, benefitId, quantity? }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/addon/preview', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { subscriptionId, benefitId, quantity } = req.body;

    if (!subscriptionId || !benefitId) {
      return res.status(400).json({ success: false, message: 'subscriptionId and benefitId are required' });
    }

    const p = await calculateAddonPricing(benefitId, subscriptionId, userId, quantity);

    return res.json({
      success: true,
      data: {
        benefitId: p.benefit.id,
        benefitName: p.benefit.name,
        benefitTypeName: p.benefit.benefitType?.name,
        unitLabel: p.benefit.unitLabel,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        unitIncludedUnits: p.unitIncludedUnits,
        includedUnits: p.includedUnits,
        originalPrice: p.originalPrice,
        basePrice: p.basePrice,
        hasDiscount: p.hasDiscount,
        gstRate: GST_RATE,
        tax: p.tax,
        total: p.total,
      }
    });
  } catch (error: any) {
    console.error('[Addon Preview Error]:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /subscriber/subscriptions/addon/create-order
// Creates a Razorpay order for an add-on purchase.
// Body: { subscriptionId, benefitId, quantity? }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/addon/create-order', paymentLimiter as unknown as RequestHandler, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { subscriptionId, benefitId, quantity } = req.body;

    if (!subscriptionId || !benefitId) {
      return res.status(400).json({ success: false, message: 'subscriptionId and benefitId are required' });
    }

    const p = await calculateAddonPricing(benefitId, subscriptionId, userId, quantity);

    const shortUserId = userId.substring(0, 8);
    const receiptId = `rcpt_ao_${shortUserId}_${Date.now()}`.substring(0, 40);

    const order = await createOrder(p.total, receiptId);

    return res.json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        key_id: order.key_id,
        benefitName: p.benefit.name,
        total: p.total,
        quantity: p.quantity,
        includedUnits: p.includedUnits,
      }
    });
  } catch (error: any) {
    console.error('[Addon Create Order Error]:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /subscriber/subscriptions/addon/purchase
// Verifies payment and credits the benefit units to the subscription.
// Body: { subscriptionId, benefitId, quantity?, razorpay_payment_id, razorpay_order_id, razorpay_signature }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/addon/purchase', paymentLimiter as unknown as RequestHandler, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { subscriptionId, benefitId, quantity, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!subscriptionId || !benefitId) {
      return res.status(400).json({ success: false, message: 'subscriptionId and benefitId are required' });
    }

    // Check duplicate payment claim / replay prevention
    if (razorpay_payment_id && !razorpay_payment_id.startsWith('DEV_MOCK_PAYMENT_')) {
      const existingPayment = await prisma.payment.findFirst({
        where: {
          OR: [
            { gatewayPaymentId: razorpay_payment_id },
            { transactionId: razorpay_payment_id }
          ]
        }
      });
      if (existingPayment) {
        return res.status(409).json({
          success: false,
          message: 'This payment transaction has already been processed and claimed.'
        });
      }
    }

    // 1. Verify payment signature (same pattern as /purchase)
    const isDevMockAllowed = config.nodeEnv === 'development' && process.env.ENABLE_MOCK_PAYMENTS === 'true';
    if (razorpay_signature === 'DEV_MOCK_SIGNATURE') {
      if (!isDevMockAllowed) {
        return res.status(403).json({ success: false, message: 'Mock payment signatures are not permitted in this environment.' });
      }
      console.log('⚠️ DEV MODE: Bypassing Razorpay Signature Verification for addon purchase.');
    } else {
      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Payment verification details (payment_id, order_id, signature) are required.' });
      }
      const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
      if (!isValid) {
        return res.status(400).json({ success: false, message: 'Invalid payment signature. Payment verification failed.' });
      }
    }

    // 2. Validate pricing again server-side (never trust client)
    const p = await calculateAddonPricing(benefitId, subscriptionId, userId, quantity);

    // 3. Credit units in a transaction
    const updatedBalance = await prisma.$transaction(async (tx) => {
      // Upsert the SubscriptionBenefitBalance (create if this benefit wasn't in the original package)
      const existingBalance = await tx.subscriptionBenefitBalance.findFirst({
        where: { subscriptionId, benefitId }
      });

      let balance;
      if (existingBalance) {
        // Top up existing balance
        balance = await tx.subscriptionBenefitBalance.update({
          where: { id: existingBalance.id },
          data: {
            totalUnits: existingBalance.totalUnits + p.includedUnits,
            availableUnits: existingBalance.availableUnits + p.includedUnits,
          }
        });

        // Write audit transaction
        await tx.benefitTransaction.create({
          data: {
            balanceId: balance.id,
            transactionType: 'ALLOCATED',
            units: p.includedUnits,
            totalBefore: existingBalance.totalUnits,
            totalAfter: balance.totalUnits,
            reservedBefore: existingBalance.reservedUnits,
            reservedAfter: existingBalance.reservedUnits,
            usedBefore: existingBalance.usedUnits,
            usedAfter: existingBalance.usedUnits,
            availableBefore: existingBalance.availableUnits,
            availableAfter: balance.availableUnits,
            reason: `Add-on purchase: ${p.benefit.name} × ${p.includedUnits} units | ${razorpay_payment_id || 'DEV'}`,
          }
        });
      } else {
        // Create a fresh balance row for this benefit (wasn't in the original package)
        balance = await tx.subscriptionBenefitBalance.create({
          data: {
            subscriptionId,
            benefitId,
            snapshotBenefitName: p.benefit.name,
            snapshotUnitLabel: p.benefit.unitLabel,
            totalUnits: p.includedUnits,
            availableUnits: p.includedUnits,
            usedUnits: 0,
            reservedUnits: 0,
            unit: p.benefit.unitLabel,
          }
        });

        await tx.benefitTransaction.create({
          data: {
            balanceId: balance.id,
            transactionType: 'ALLOCATED',
            units: p.includedUnits,
            totalBefore: 0,
            totalAfter: p.includedUnits,
            reservedBefore: 0,
            reservedAfter: 0,
            usedBefore: 0,
            usedAfter: 0,
            availableBefore: 0,
            availableAfter: p.includedUnits,
            reason: `Add-on purchase (new benefit): ${p.benefit.name} × ${p.includedUnits} units | ${razorpay_payment_id || 'DEV'}`,
          }
        });
      }

      // Generate invoice
      const invoiceNumber = await generateInvoiceNumber(tx as any);
      
      const taxItems: BenefitTaxItem[] = [{
        benefitId: p.benefit.id,
        name: `Add-on: ${p.benefit.name}`,
        quantity: p.quantity || 1,
        unitPrice: p.unitPrice,
        gstRate: p.taxRate,                     // Resolved from DB (not hardcoded)
        hsnSacCode: p.hsnSacCode,               // Resolved from DB
        isGstExempt: p.isGstExempt || false,
      }];

      // placeOfSupply from beneficiary state — not hardcoded
      const customerState = p.placeOfSupply || 'Haryana';
      const invoiceCalc = calculateItemizedInvoice(taxItems, 0, customerState, 'Haryana');
      
      const invoiceId = generateUUID();
      const beneficiaryId = p.subscription.beneficiaryId || null;

      await tx.invoice.create({
        data: {
          id: invoiceId,
          invoiceNumber,
          invoiceType: 'SERVICE',
          status: 'PAID',
          subscriberId: userId,
          beneficiaryId,
          subscriptionId: subscriptionId,
          baseAmount: invoiceCalc.baseAmount,
          discountAmount: 0,
          taxAmount: invoiceCalc.taxAmount,
          totalAmount: invoiceCalc.totalAmount,
          placeOfSupply: customerState,          // From beneficiary state — not hardcoded
          cgstAmount: invoiceCalc.cgstAmount,
          sgstAmount: invoiceCalc.sgstAmount,
          igstAmount: invoiceCalc.igstAmount,
          issuedAt: new Date(),
          paidAt: new Date(),
          items: {
            create: invoiceCalc.items.map(item => ({
              id: generateUUID(),
              benefitId: item.benefitId || benefitId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.amount,
              taxRate: item.taxRate,
              hsnSacCode: item.hsnSacCode,
              isGstExempt: item.isGstExempt
            }))
          }
        }
      });

      // Create Payment Record
      const txId = razorpay_payment_id || `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      await tx.payment.create({
        data: {
          id: generateUUID(),
          subscriberId: userId,
          beneficiaryId,
          subscriptionId: subscriptionId,
          invoiceId: invoiceId,
          packageType: 'ADD_ON',
          baseAmount: p.basePrice,
          taxAmount: invoiceCalc.taxAmount,
          amountPaid: p.total,
          currency: 'INR',
          paymentStatus: 'success',
          transactionId: txId,
          gatewayName: 'RAZORPAY',
          gatewayOrderId: razorpay_order_id,
          gatewayPaymentId: razorpay_payment_id,
          gatewaySignature: razorpay_signature,
          planStartDate: new Date(),
          planEndDate: p.subscription.endDate || new Date(),
          isSubscriptionActive: true,
          paidAt: new Date()
        }
      });

      return balance;
    });

    // 4. Dispatch Push Notifications & In-App DB Notifications (via Central Service)
    sendAddonPurchaseNotifications({
      subscriberId: userId,
      beneficiaryUserId: p.subscription.beneficiary?.userId,
      beneficiaryName: p.subscription.beneficiary?.name || 'care plan',
      benefitName: p.benefit.name,
      unitsText: formatAddonUnitText(p.includedUnits, p.benefit.unitLabel),
      subscriptionId,
      benefitId,
    });

    return res.json({
      success: true,
      message: `${p.benefit.name} add-on successfully activated! ${p.includedUnits} ${p.benefit.unitLabel || 'units'} added.`,
      data: {
        benefitName: p.benefit.name,
        unitsAdded: p.includedUnits,
        newTotal: updatedBalance.totalUnits,
        newAvailable: updatedBalance.availableUnits,
      }
    });
  } catch (error: any) {
    console.error('[Addon Purchase Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;