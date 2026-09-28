import { Router, Request, Response } from 'express';
import { validateCoupon } from '../../services/coupon_service';
import { authenticate, AuthRequest } from '../shared/deps';
import prisma from '../../core/database';

const router = Router();

// POST /subscriber/coupons/validate
// Called by checkout before payment to preview the discount.
// Body: { code, packageId, amount }
// Returns: { success, coupon: { discountApplied, finalAmount, couponId, ... } }
router.post('/validate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { code, packageId, amount } = req.body;

    if (!code || !packageId || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: code, packageId, amount'
      });
    }

    const orderAmount = parseFloat(amount);
    if (isNaN(orderAmount) || orderAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    // Resolve packageId → package type string (the coupon's allowedPackages uses type)
    const pkg = await prisma.subscriptionPackage.findFirst({
      where: {
        OR: [
          { id: packageId },
          { type: packageId }
        ]
      },
      select: { id: true, type: true }
    });

    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    // Check first-time subscriber
    const previousSubscriptions = await prisma.subscription.count({
      where: { subscriberId: userId }
    });
    const isFirstTimeSubscriber = previousSubscriptions === 0;

    const result = await validateCoupon(
      code.toUpperCase().trim(),
      userId,
      pkg.type,
      orderAmount,
      isFirstTimeSubscriber
    );

    if (!result.isValid) {
      return res.status(200).json({
        success: false,
        message: result.message || 'Invalid coupon code'
      });
    }

    // Return under data.coupon so checkout.tsx can use data.coupon directly
    return res.json({
      success: true,
      coupon: {
        couponId: result.couponId,
        discountApplied: result.discountApplied,
        finalAmount: result.finalAmount,
      }
    });
  } catch (error: any) {
    console.error('[Coupon Validate Error]:', error);
    res.status(500).json({ success: false, message: 'Internal server error during validation' });
  }
});

// GET /subscriber/coupons/applicable
// Query: ?packageId=pkg_123
router.get('/applicable', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { packageId } = req.query;
    
    // Resolve package type
    let pkg: any = null;
    if (packageId) {
      pkg = await prisma.subscriptionPackage.findFirst({
        where: { OR: [{ id: String(packageId) }, { type: String(packageId) }] }
      });
    }

    const now = new Date();
    
    // Fetch all active and visible coupons
    const coupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
        isVisible: true,
        startDate: { lte: now },
        endDate: { gte: now }
      }
    });

    // Filter coupons that apply to this specific package
    const applicableCoupons = coupons.filter(coupon => {
      if (coupon.allowedPackages && coupon.allowedPackages.length > 0) {
        return pkg && coupon.allowedPackages.includes(pkg.type);
      }
      return true; // If empty, applies to all
    });

    // We can also filter out coupons where global usage limits are already met
    const availableCoupons = applicableCoupons.filter(c => 
      c.usageLimit === null || c.usedCount < c.usageLimit
    );

    res.json({ success: true, data: availableCoupons });
  } catch (error) {
    console.error('[Coupon Applicable Error]:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
