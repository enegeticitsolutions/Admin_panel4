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
    packageTotalBasePrice,
    customerState = '',
    discountAmount = 0,
    amountPaid,
    subscriberId,
    beneficiaryId = null,
    status = 'PAID',
    addons = [],
  }) {
    const months = Math.max(1, parseInt(durationMonths, 10) || 1);
    const taxItems = [];

    // Package display label used in line item descriptions to ensure consistent naming
    const packageLabel = subPackage?.name || packageVersion?.name || 'Care Package';
    const versionLabel = packageVersion?.version ? ` v${packageVersion.version}` : '';
    const durationLabel = months > 1 ? ` (${months} Months)` : '';

    const targetPackagePrice = packageTotalBasePrice !== undefined
      ? packageTotalBasePrice
      : (packageVersion?.basePrice || subPackage?.basePrice || 0) * months;

    const pkgTaxMeta = await this.taxResolver.resolvePackageTax(subPackage, tx);

    // 1. Add the main package as a single line item
    taxItems.push({
      benefitId: null,
      name: `${packageLabel}${versionLabel}${durationLabel}`,
      quantity: 1,
      unitPrice: targetPackagePrice,
      nominalCost: targetPackagePrice,
      gstRate: pkgTaxMeta.gstRate,
      hsnSacCode: pkgTaxMeta.hsnSacCode,
      isExempt: pkgTaxMeta.isExempt,
    });

    // 2. Add any addon items
    if (Array.isArray(addons) && addons.length > 0) {
      for (const addon of addons) {
        const unitPrice = addon.units > 0 ? (addon.price / addon.units) : addon.price;
        const rawName = addon.name || 'Care Service';
        const displayName = rawName.startsWith('Add-on') ? rawName : `Add-on: ${rawName}`;
        taxItems.push({
          benefitId: addon.benefitId || null,
          name: displayName,
          quantity: addon.units || 1,
          unitPrice: unitPrice,
          nominalCost: unitPrice,
          gstRate: addon.gstRate ?? 18,
          hsnSacCode: addon.hsnSacCode || '998399',
          isExempt: Boolean(addon.isExempt ?? addon.isGstExempt),
        });
      }
    }

    // 2. Compute GST, pro-rata package base price allocation, and proportional discounts via @maihoonna/billing
    const calculationResult = InvoiceCalculator.calculate({
      items: taxItems,
      totalDiscount: discountAmount, // Properly allocate the pre-tax discount
      customerState,
      companyState: process.env.COMPANY_STATE || 'Haryana',
    });

    // 2b. We no longer apply Post-Tax Discount manually.
    // The exact discount is already allocated proportionally to the pre-tax line items by the calculator.
    // However, if there's a tiny 1 paisa rounding mismatch between the calculated total and `amountPaid`, 
    // we can strictly sync the final total amount for reconciliation.
    if (amountPaid !== undefined && amountPaid !== null && Math.abs(calculationResult.totalAmount - amountPaid) <= 0.1) {
      calculationResult.totalAmount = amountPaid;
    }

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
    items: inputItems,
    customerState = '',
    discountAmount = 0,
    subscriberId,
    beneficiaryId = null,
    status = 'PAID',
  }) {
    let taxItems = [];

    if (Array.isArray(inputItems) && inputItems.length > 0) {
      for (const item of inputItems) {
        const itemBenefit = item.benefit || (item.benefitId ? await tx.benefit.findUnique({ where: { id: item.benefitId } }) : null);
        const taxMeta = itemBenefit ? await this.taxResolver.resolveBenefitTax(itemBenefit, tx) : { gstRate: 18, hsnSacCode: '998311', isExempt: false };
        taxItems.push({
          benefitId: itemBenefit?.id || item.benefitId || null,
          name: `Add-on: ${item.name || itemBenefit?.name || 'Care Service'}`,
          quantity: Math.max(1, parseInt(item.units, 10) || 1),
          unitPrice: item.unitPrice !== undefined ? Number(item.unitPrice) : (itemBenefit?.addonDiscountPrice ?? itemBenefit?.addonPrice ?? 0),
          gstRate: taxMeta.gstRate,
          hsnSacCode: taxMeta.hsnSacCode,
          isExempt: taxMeta.isExempt,
        });
      }
    } else if (benefit) {
      const taxMeta = await this.taxResolver.resolveBenefitTax(benefit, tx);
      const qty = Math.max(1, parseInt(units, 10) || 1);
      const price = unitPrice !== undefined ? unitPrice : (benefit.addonDiscountPrice ?? benefit.addonPrice ?? 0);
      taxItems.push({
        benefitId: benefit.id,
        name: `Add-on: ${benefit.name}`,
        quantity: qty,
        unitPrice: price,
        gstRate: taxMeta.gstRate,
        hsnSacCode: taxMeta.hsnSacCode,
        isExempt: taxMeta.isExempt,
      });
    }

    const calculationResult = InvoiceCalculator.calculate({
      items: taxItems,
      totalDiscount: discountAmount,
      customerState,
      companyState: process.env.COMPANY_STATE || 'Haryana',
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
    packageTotalBasePrice,
    customerState = '',
    discountAmount = 0,
    amountPaid,
    subscriberId,
    beneficiaryId = null,
    status = 'PAID',
    addons = [],
  }) {
    return await this.generateSubscriptionInvoice(tx, {
      subscription: newSubscription,
      subPackage: pkg,
      packageVersion,
      durationMonths,
      packageTotalBasePrice,
      customerState,
      discountAmount,
      amountPaid,
      subscriberId,
      beneficiaryId,
      status,
      addons,
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

      // 1. If payment is for an add-on benefit:
      const rawNotes = payment.gatewayResponse?.notes || payment.gatewayResponse?.payload?.payment?.entity?.notes || {};
      const isAddonPayment =
        payment.packageType === 'addon' ||
        rawNotes.packageType === 'addon' ||
        (payment.failureReason && String(payment.failureReason).startsWith('Add-on')) ||
        (rawNotes.packageName && String(rawNotes.packageName).startsWith('Add-on'));

      if (isAddonPayment) {
        let sub = payment.subscriptionId ? await tx.subscription.findUnique({
          where: { id: payment.subscriptionId },
          include: { beneficiary: true, subscriber: true },
        }) : null;

        const customerState = sub?.beneficiary?.state || sub?.subscriber?.state || payment.beneficiary?.state || payment.subscriber?.state || '';

        // Check if multi-item addonItems exists
        let addonItems = null;
        if (rawNotes.addonItems) {
          try {
            addonItems = typeof rawNotes.addonItems === 'string' ? JSON.parse(rawNotes.addonItems) : rawNotes.addonItems;
          } catch (_) { }
        }

        if (Array.isArray(addonItems) && addonItems.length > 0) {
          const invoice = await this.generateAddonInvoice(tx, {
            subscriptionId: sub?.id || payment.subscriptionId || null,
            items: addonItems,
            customerState,
            discountAmount: payment.discountAmount || 0,
            subscriberId: payment.subscriberId,
            beneficiaryId: payment.beneficiaryId || sub?.beneficiaryId || null,
            status: payment.paymentStatus === 'success' ? 'PAID' : 'ISSUED',
          });

          await tx.payment.update({
            where: { id: payment.id },
            data: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
          });

          return invoice;
        }

        // Single add-on fallback
        let benefit = null;
        if (rawNotes.benefitId) {
          benefit = await tx.benefit.findUnique({ where: { id: rawNotes.benefitId } });
        }
        if (!benefit) {
          const targetName = rawNotes.packageName || payment.snapshotPackageName || payment.failureReason || '';
          const cleanedName = targetName.replace(/^Add-on(s)?:\s*/i, '').trim();
          if (cleanedName) {
            benefit = await tx.benefit.findFirst({
              where: { name: { contains: cleanedName, mode: 'insensitive' } }
            });
          }
        }

        if (benefit) {
          let units = parseInt(rawNotes.units, 10);
          const totalPaid = Number(payment.amountPaid || payment.baseAmount || 0);
          if (!units || isNaN(units) || units <= 0) {
            const unitPrice = benefit.addonDiscountPrice || benefit.addonPrice || 0;
            if (unitPrice > 0 && totalPaid > 0) {
              units = Math.max(1, Math.round(totalPaid / unitPrice));
            } else {
              units = benefit.addonIncludedUnits || 1;
            }
          }
          const unitPrice = units > 0 ? (totalPaid / units) : totalPaid;

          const invoice = await this.generateAddonInvoice(tx, {
            subscriptionId: sub?.id || payment.subscriptionId || null,
            benefit,
            units,
            unitPrice,
            customerState,
            discountAmount: payment.discountAmount || 0,
            subscriberId: payment.subscriberId,
            beneficiaryId: payment.beneficiaryId || sub?.beneficiaryId || null,
            status: payment.paymentStatus === 'success' ? 'PAID' : 'ISSUED',
          });

          await tx.payment.update({
            where: { id: payment.id },
            data: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
          });

          return invoice;
        }
      }

      // If subscription exists, create subscription invoice
      if (payment.subscriptionId) {
        let sub = await tx.subscription.findUnique({
          where: { id: payment.subscriptionId },
          include: {
            package: true,
            packageVersion: { include: { versionBenefits: true } },
            beneficiary: true,
            subscriber: true,
          },
        });

        if (sub) {
          let pkg = sub.package;
          if (!pkg && sub.packageType) {
            pkg = await tx.subscriptionPackage.findUnique({ where: { type: sub.packageType } }).catch(() => null);
          }
          const customerState = sub.beneficiary?.state || sub.subscriber?.state || payment.beneficiary?.state || payment.subscriber?.state || '';
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
        const customerState = subscriber?.state || payment.beneficiary?.state || '';
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
          companyState: process.env.COMPANY_STATE || 'Haryana',
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
