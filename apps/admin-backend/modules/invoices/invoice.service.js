const { prisma } = require('../../lib/prisma');
const { InvoiceEngine, InvoiceCalculator, TaxResolver, currentIndianFinancialYear } = require('./invoice.engine');

class InvoiceService {
  constructor(prismaClient = prisma) {
    this.prisma = prismaClient;
    this.engine = new InvoiceEngine(prismaClient);
    this.taxResolver = new TaxResolver(prismaClient);
  }

  /**
   * Generates a statutory invoice for a package subscription (Enrollment / Purchase).
   * Dynamically loads tax settings for every included benefit version.
   */
  async generateSubscriptionInvoice(tx, {
    subscription,
    subPackage,
    packageVersion,
    durationMonths = 1,
    customerState = 'Haryana',
    discountAmount = 0,
    subscriberId,
    beneficiaryId = null,
    status = 'PAID',
  }) {
    const months = Math.max(1, parseInt(durationMonths, 10) || 1);
    const taxItems = [];

    // Package display label used in line item descriptions to ensure consistent naming
    const packageLabel = subPackage?.name || packageVersion?.name || 'Care Package';
    const versionLabel = packageVersion?.version ? ` v${packageVersion.version}` : '';
    const durationLabel = months > 1 ? ` (${months} Months)` : '';

    // 1. Resolve tax for each benefit in the package version (live DB records = source of truth)
    if (packageVersion && Array.isArray(packageVersion.versionBenefits) && packageVersion.versionBenefits.length > 0) {
      for (const vb of packageVersion.versionBenefits) {
        // Always load the live benefit for unit cost and tax resolution
        const benefit = vb.benefit || (await tx.benefit.findUnique({ where: { id: vb.benefitId } }));
        const taxMeta = await this.taxResolver.resolveBenefitTax(benefit || vb.benefitId, tx);

        // Unit cost: prefer benefit.unitCost → benefit.cost → proportional split of package price
        const unitCost =
          benefit?.unitCost ||
          benefit?.cost ||
          Math.round((packageVersion.basePrice / packageVersion.versionBenefits.length) * 100) / 100;

        // Use snapshotName (frozen at subscription time) for legal accuracy;
        // fall back to live benefit name only as last resort
        const benefitLabel = vb.snapshotName || benefit?.name || 'Included Benefit';

        taxItems.push({
          benefitId: vb.benefitId,
          // Description carries package + version + benefit — all from DB, never hardcoded
          name: `${packageLabel}${versionLabel} — ${benefitLabel}${durationLabel}`,
          quantity: (vb.unitsIncluded || 1) * months,
          unitPrice: Math.round(unitCost * 100) / 100,
          gstRate: taxMeta.gstRate,
          hsnSacCode: taxMeta.hsnSacCode,
          isExempt: taxMeta.isExempt,
        });
      }
    }

    // Fallback: package has no itemized version benefits — treat entire package as single line
    if (taxItems.length === 0) {
      const pkgTaxMeta = await this.taxResolver.resolvePackageTax(subPackage, tx);
      taxItems.push({
        benefitId: null,
        name: `${packageLabel}${versionLabel}${durationLabel}`,
        quantity: 1,
        unitPrice: packageVersion?.basePrice || subPackage?.basePrice || 0,
        gstRate: pkgTaxMeta.gstRate,
        hsnSacCode: pkgTaxMeta.hsnSacCode,
        isExempt: pkgTaxMeta.isExempt,
      });
    }

    // 2. Compute GST & proportional discounts (pure math, no DB)
    const calculationResult = InvoiceCalculator.calculate({
      items: taxItems,
      totalDiscount: discountAmount,
      customerState,
      companyState: 'Haryana',
    });

    // 3. Persist Invoice + Line Items atomically in DB
    return await this.engine.createInvoiceRecord(tx, {
      invoiceType: 'SUBSCRIPTION',
      subscriberId,
      beneficiaryId,
      subscriptionId: subscription?.id || null,
      status,
      calculationResult,
    });
  }

  /**
   * Generates a statutory invoice for Add-on Top-ups.
   * Dynamically loads tax rate (e.g. 17% or custom) and HSN/SAC from Benefit / TaxCategory.
   */
  async generateAddonInvoice(tx, {
    subscriptionId,
    benefit,
    units = 1,
    unitPrice,
    customerState = 'Haryana',
    discountAmount = 0,
    subscriberId,
    beneficiaryId = null,
    status = 'PAID',
  }) {
    const taxMeta = await this.taxResolver.resolveBenefitTax(benefit, tx);
    const qty = Math.max(1, parseInt(units, 10) || 1);
    const price = unitPrice !== undefined ? unitPrice : (benefit.addonDiscountPrice ?? benefit.addonPrice ?? 0);

    const taxItems = [
      {
        benefitId: benefit.id,
        name: `Add-on: ${benefit.name}`,
        quantity: qty,
        unitPrice: price,
        gstRate: taxMeta.gstRate,
        hsnSacCode: taxMeta.hsnSacCode,
        isExempt: taxMeta.isExempt,
      },
    ];

    const calculationResult = InvoiceCalculator.calculate({
      items: taxItems,
      totalDiscount: discountAmount,
      customerState,
      companyState: 'Haryana',
    });

    return await this.engine.createInvoiceRecord(tx, {
      invoiceType: 'SERVICE',
      subscriberId,
      beneficiaryId,
      subscriptionId,
      status,
      calculationResult,
    });
  }

  /**
   * Generates a statutory invoice for Subscription Renewals.
   */
  async generateRenewalInvoice(tx, {
    newSubscription,
    pkg,
    packageVersion,
    durationMonths = 1,
    customerState = 'Haryana',
    discountAmount = 0,
    subscriberId,
    beneficiaryId = null,
    status = 'PAID',
  }) {
    return await this.generateSubscriptionInvoice(tx, {
      subscription: newSubscription,
      subPackage: pkg,
      packageVersion,
      durationMonths,
      customerState,
      discountAmount,
      subscriberId,
      beneficiaryId,
      status,
    });
  }

  /**
   * Universal Payment Invoice Dispatcher:
   * Can be called whenever any payment completes to ensure a statutory invoice exists.
   */
  async ensurePaymentInvoice(tx, payment) {
    try {
      if (payment.invoiceId) {
        return await tx.invoice.findUnique({
          where: { id: payment.invoiceId },
          include: { items: true },
        });
      }

      // If subscription exists, create subscription invoice
      if (payment.subscriptionId) {
        let sub = await tx.subscription.findUnique({
          where: { id: payment.subscriptionId },
          include: {
            package: true,
            packageVersion: { include: { versionBenefits: true } },
            beneficiary: true,
          },
        });

        if (sub) {
          let pkg = sub.package;
          if (!pkg && sub.packageType) {
            pkg = await tx.subscriptionPackage.findUnique({ where: { type: sub.packageType } }).catch(() => null);
          }
          const customerState = sub.beneficiary?.state || 'Haryana';
          const invoice = await this.generateSubscriptionInvoice(tx, {
            subscription: sub,
            subPackage: pkg,
            packageVersion: sub.packageVersion,
            durationMonths: sub.duration === 'yearly' ? 12 : sub.duration === 'quarterly' ? 3 : 1,
            customerState,
            discountAmount: payment.discountAmount || 0,
            subscriberId: payment.subscriberId,
            beneficiaryId: payment.beneficiaryId || sub.beneficiaryId,
            status: payment.paymentStatus === 'success' ? 'PAID' : 'ISSUED',
          });

          await tx.payment.update({
            where: { id: payment.id },
            data: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
          });

          return invoice;
        }
      }

      // If payment is for a package directly (e.g. website checkout or direct link)
      if (payment.packageType) {
        const pkg = await tx.subscriptionPackage.findUnique({ where: { type: payment.packageType } }).catch(() => null);
        const subscriber = await tx.user.findUnique({ where: { id: payment.subscriberId } }).catch(() => null);
        const customerState = subscriber?.state || 'Haryana';
        const basePrice = payment.baseAmount || payment.amountPaid || pkg?.basePrice || 0;
        const discountAmount = payment.discountAmount || 0;

        const taxMeta = await this.taxResolver.resolvePackageTax(pkg || { type: payment.packageType }, tx);

        // Build line items using live DB data — snapshotPackageName is stored on payment at purchase time
        const pkgLabel = payment.snapshotPackageName || pkg?.name || payment.packageType;
        const items = [{
          benefitId: null,
          name: `Subscription Package: ${pkgLabel}`,
          unitPrice: Math.max(0, basePrice),
          quantity: 1,
          gstRate: taxMeta.gstRate,
          hsnSacCode: taxMeta.hsnSacCode,
          isExempt: taxMeta.isExempt,
        }];

        // Pure math — no DB involvement at this stage
        const calculationResult = InvoiceCalculator.calculate({
          items,
          totalDiscount: discountAmount,
          customerState,
          companyState: 'Haryana',
        });

        const invoice = await this.engine.generateAndPersist(tx, {
          invoiceType: 'SUBSCRIPTION',
          subscriberId: payment.subscriberId,
          beneficiaryId: payment.beneficiaryId || null,
          subscriptionId: payment.subscriptionId || null,
          status: payment.paymentStatus === 'success' ? 'PAID' : 'ISSUED',
          calculationResult,
        });

        await tx.payment.update({
          where: { id: payment.id },
          data: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
        });

        return invoice;
      }

      return null;
    } catch (err) {
      console.error('[InvoiceService.ensurePaymentInvoice Error]:', err);
      return null;
    }
  }
}

// Singleton export
const invoiceService = new InvoiceService();

module.exports = {
  InvoiceService,
  invoiceService,
};
