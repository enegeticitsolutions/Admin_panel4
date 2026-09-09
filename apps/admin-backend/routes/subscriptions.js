const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const { calculateAge } = require('../utils/age');
const { publishPackageVersion } = require('../utils/packageVersionHelper');
const { invoiceService } = require('../modules/invoices/invoice.service');

function normalizeUnit(unitLabel) {
  if (!unitLabel) return 'visits';
  const clean = unitLabel.replace(/^per\s+/i, '').trim().toLowerCase();
  if (clean === 'visit') return 'visits';
  if (clean === 'hour') return 'hours';
  if (clean === 'session') return 'sessions';
  if (clean === 'test') return 'tests';
  if (clean.endsWith('s')) return clean;
  return clean + 's';
}

function formatUnitType(unitLabel, units = 1) {
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

// ── GET /api/subscriptions/check-phone ────────────────────────────────────────
// Pre-check if a phone already has a user record + their beneficiaries
router.get('/check-phone', async (req, res) => {
  const { phone } = req.query;
  if (!phone)
    return res
      .status(400)
      .json({ success: false, message: 'phone is required' });

  try {
    const user = await prisma.user.findUnique({
      where: { phone: String(phone) },
      select: {
        id: true,
        name: true,
        role: true,
        isActive: true,
        subscriberBeneficiaries: {
          select: {
            id: true,
            name: true,
            age: true,
            gender: true,
            subscriptions: {
              where: { isActive: true },
              select: {
                id: true,
                packageType: true,
                startDate: true,
                endDate: true,
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!user) return res.json({ success: true, data: { exists: false } });

    res.json({
      success: true,
      data: {
        exists: true,
        id: user.id,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        beneficiaries: user.subscriberBeneficiaries,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/subscriptions/calculate-price ──────────────────────────────────
// Authoritative benefit-level pricing & GST calculation engine
// Takes each benefit's exact GST % from the database and computes itemized GST
// matching Excel spreadsheet model:
//   Benefit Price + (Benefit Price * GST%) = Benefit Final Price
//   Package Gross Price = Sum of Benefit Final Prices
//   Final Payable = Package Gross Price - Duration Discount
// ─────────────────────────────────────────────────────────────────────────────
router.post('/calculate-price', async (req, res) => {
  try {
    const { packageId, duration = 'monthly', addons = [], customerState = 'Haryana' } = req.body;

    if (!packageId) {
      return res.status(400).json({ success: false, message: 'packageId is required' });
    }

    const pkg = await prisma.subscriptionPackage.findUnique({
      where: { id: packageId },
      include: {
        packageBenefits: {
          orderBy: { displayOrder: 'asc' },
          include: {
            benefit: true,
          },
        },
      },
    });

    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    const DURATION_MONTHS_MAP = {
      monthly: 1,
      three_months: 3,
      six_months: 6,
      annual: 12,
    };
    const DURATION_DISCOUNT_PERCENT_MAP = {
      monthly: 0,
      three_months: Number(pkg.discountThreeMonths ?? 5),
      six_months: Number(pkg.discountSixMonths ?? 10),
      annual: Number(pkg.discountAnnual ?? 20),
    };

    const months = DURATION_MONTHS_MAP[duration] || 1;
    const discountPercent = DURATION_DISCOUNT_PERCENT_MAP[duration] || 0;
    const baseMonthlyRate = Number(pkg.basePrice) || 0;

    // 1. Calculate each benefit's base price and GST using its database GST %
    const packageBenefits = pkg.packageBenefits || [];
    let catalogTotal = 0;
    packageBenefits.forEach((pb) => {
      const uCost = Number(pb.benefit?.unitCost) || 0;
      const uCount = pb.unitsIncluded || 1;
      catalogTotal += uCost * uCount;
    });

    const benefitsBreakdown = [];
    let totalPackageBase = 0;
    let totalPackageTax = 0;

    if (packageBenefits.length > 0) {
      packageBenefits.forEach((pb) => {
        const b = pb.benefit;
        if (!b) return;

        const uCost = Number(b.unitCost) || 0;
        const uCount = pb.unitsIncluded || 1;
        const lineCatalog = uCost * uCount;

        // Proportional share of the package monthly base rate
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

    // Multi-month duration discount applied on package gross price
    const packageDiscount = Math.round((packageGrossPrice * discountPercent) / 100 * 100) / 100;
    const packageFinalPayable = Math.round((packageGrossPrice - packageDiscount) * 100) / 100;

    // 2. Add-ons breakdown with their own database-configured GST rates
    let addonsBasePrice = 0;
    let addonsTax = 0;
    const addonsBreakdown = [];

    if (Array.isArray(addons) && addons.length > 0) {
      for (const item of addons) {
        const bId = item.benefitId || item.benefit?.id;
        if (!bId) continue;
        const benefit = await prisma.benefit.findUnique({
          where: { id: bId },
          select: { id: true, name: true, unitLabel: true, addonPrice: true, addonDiscountPrice: true, gstRate: true, isGstExempt: true, hsnSacCode: true }
        });
        if (benefit) {
          const q = Math.max(1, Number(item.units) || 1);
          const unitPrice = benefit.addonDiscountPrice ?? benefit.addonPrice ?? 0;
          const lineTotal = Number(item.totalAmount) || (unitPrice * q);
          const rate = benefit.isGstExempt ? 0 : Number(benefit.gstRate !== null && benefit.gstRate !== undefined ? benefit.gstRate : 18);
          const lineTax = Math.round((lineTotal * rate) / 100 * 100) / 100;
          const finalPrice = Math.round((lineTotal + lineTax) * 100) / 100;

          addonsBasePrice += lineTotal;
          addonsTax += lineTax;

          const unitType = formatUnitType(benefit.unitLabel, q);

          addonsBreakdown.push({
            benefitId: benefit.id,
            name: benefit.name,
            units: q,
            unitLabel: benefit.unitLabel || 'units',
            unitType,
            unitDisplay: `Units: ${q} ${unitType}`,
            price: lineTotal,
            gstRate: rate,
            gstAmount: lineTax,
            finalPrice,
            isGstExempt: benefit.isGstExempt || false,
            hsnSacCode: benefit.hsnSacCode || '',
          });
        }
      }
    }

    addonsBasePrice = Math.round(addonsBasePrice * 100) / 100;
    addonsTax = Math.round(addonsTax * 100) / 100;
    const addonsFinalTotal = Math.round((addonsBasePrice + addonsTax) * 100) / 100;

    // 3. Overall Totals
    const totalBaseAmount = Math.round((totalPackageBase + addonsBasePrice) * 100) / 100;
    const totalTaxAmount = Math.round((totalPackageTax + addonsTax) * 100) / 100;
    const finalTotalAmount = Math.round((packageFinalPayable + addonsFinalTotal) * 100) / 100;

    // POS Split (Haryana vs Inter-state)
    const companyState = 'Haryana';
    const isInterState = (customerState || '').trim().toLowerCase() !== companyState.toLowerCase();
    const cgstAmount = isInterState ? 0 : Math.round((totalTaxAmount / 2) * 100) / 100;
    const sgstAmount = isInterState ? 0 : Math.round((totalTaxAmount / 2) * 100) / 100;
    const igstAmount = isInterState ? totalTaxAmount : 0;

    return res.json({
      success: true,
      data: {
        packageId: pkg.id,
        packageName: pkg.name,
        duration,
        months,
        baseMonthlyRate,
        benefitsBreakdown,
        addonsBreakdown,
        totalPackageBase,
        totalPackageTax,
        packageGrossPrice,
        discountPercent,
        packageDiscount,
        packageFinalPayable,
        addonsBasePrice,
        addonsTax,
        addonsFinalTotal,
        totalBaseAmount,
        totalTaxAmount,
        isInterState,
        customerState,
        taxLabel: isInterState ? 'IGST' : 'CGST + SGST',
        cgstAmount,
        sgstAmount,
        igstAmount,
        finalTotalAmount,
      }
    });
  } catch (err) {
    console.error('POST /subscriptions/calculate-price error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/subscriptions/admin-enroll ─────────────────────────────────────
// Full enrollment: create/upsert subscriber + beneficiary + subscription + payment
router.post('/admin-enroll', async (req, res) => {
  const {
    // Subscriber
    subscriberPhone,
    subscriberName,
    subscriberEmail,
    subscriberAddress,
    subscriberPincode,
    subscriberCity,
    subscriberState,
    // Beneficiary
    sameAsSubscriber = false,
    beneficiaryPhone,
    beneficiaryName,
    beneficiaryAge,
    beneficiaryDob,
    beneficiaryGender = 'prefer_not_to_say',
    beneficiaryAddress = '',
    beneficiaryPincode = '',
    beneficiaryCity = '',
    beneficiaryState = '',
    relationship = '',
    maritalStatus = '',
    profilePhoto = '',
    // Medical & Vitals
    medicalConditions = [], // array of { slug, name, severity }
    medications = [], // array of { name, dosage, frequency, instructions, startDate }
    primaryPhysicianName = '',
    primaryPhysicianPhone = '',
    hobbiesInterests = [],
    vitalsToTrack = {}, // { bloodPressure: true, heartRate: true, ... }
    // Emergency contact
    emergencyContactName,
    emergencyContactPhone,
    emergencyContactRelationship = 'Family',
    emergencyContactEmail = '',
    secondaryContactName,
    secondaryContactPhone,
    secondaryContactRelationship = '',
    secondaryContactEmail = '',
    // Schedule
    preferredSlot = 'Morning',
    // Package
    packageId,
    duration = 'monthly',
    startDate,
    // Payment
    amountPaid,
    paymentMethod = 'Cash',
    paymentNote = '',
    csaMode = false,
    subscriberPassword = '',
  } = req.body;

  if (!subscriberPhone || typeof subscriberPhone !== 'string' || !subscriberName || typeof subscriberName !== 'string' || !packageId) {
    return res
      .status(400)
      .json({
        success: false,
        message: 'subscriberPhone, subscriberName, and packageId are required and must be valid strings',
      });
  }

  // If beneficiary is different, we generate a placeholder phone if not provided

  try {
    // Fetch package
    const pkg = await prisma.subscriptionPackage.findUnique({
      where: { id: packageId },
      include: { packageBenefits: { include: { benefit: true } } },
    });
    if (!pkg)
      return res
        .status(404)
        .json({ success: false, message: 'Package not found' });

    // Compute dates
    const start = startDate ? new Date(startDate) : new Date();
    const end = new Date(start);
    if (duration === 'six_months') end.setMonth(end.getMonth() + 6);
    else if (duration === 'annual') end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);

    // Use provided password for testing, otherwise OTP-only placeholder
    const passwordToHash = subscriberPassword || ('otp-only-' + subscriberPhone);
    const dummyHash = await bcrypt.hash(passwordToHash, 8);

    const result = await prisma.$transaction(async (tx) => {
      // ──────────────────────────────────────────────────────────────────
      // 1. Find or create Subscriber (User with role: subscriber)
      // ──────────────────────────────────────────────────────────────────
      let subscriberUser = await tx.user.findUnique({
        where: { phone: subscriberPhone },
      });
      if (!subscriberUser) {
        subscriberUser = await tx.user.create({
          data: {
            phone: subscriberPhone,
            name: subscriberName,
            role: 'subscriber',
            password: dummyHash,
            isActive: true,
            location: subscriberAddress
              ? `${subscriberAddress}, ${subscriberCity || ''}, ${subscriberState || ''} - ${subscriberPincode || ''}`.trim()
              : '',
          },
        });
      } else {
        // Update name if provided and different, and promote to subscriber if currently prospect
        const newLocation = subscriberAddress
          ? `${subscriberAddress}, ${subscriberCity || ''}, ${subscriberState || ''} - ${subscriberPincode || ''}`.trim()
          : subscriberUser.location;

        const updateData = {};
        if (subscriberUser.name !== subscriberName) updateData.name = subscriberName;
        if (subscriberUser.location !== newLocation) updateData.location = newLocation;
        
        if (subscriberUser.role === 'prospect') {
          updateData.role = 'subscriber';
        }

        if (Object.keys(updateData).length > 0) {
          subscriberUser = await tx.user.update({
            where: { id: subscriberUser.id },
            data: updateData,
          });
        }
      }

      // ──────────────────────────────────────────────────────────────────
      // 2. Find or create Beneficiary User
      // ──────────────────────────────────────────────────────────────────
      let beneficiaryUser;
      if (sameAsSubscriber) {
        beneficiaryUser = subscriberUser;
      } else {
        // If no beneficiary phone given, generate a placeholder (BEN- prefix + subscriber phone suffix)
        const safeSubPhone = typeof subscriberPhone === 'string' ? subscriberPhone : String(subscriberPhone || '');
        const benPhone = (typeof beneficiaryPhone === 'string' && beneficiaryPhone) || (safeSubPhone ? `BEN${safeSubPhone.slice(-8)}` : 'BEN-UNKNOWN');
        const benHash = await bcrypt.hash('otp-only-' + benPhone, 8);
        beneficiaryUser = await tx.user.findUnique({
          where: { phone: benPhone },
        });
        if (!beneficiaryUser) {
          beneficiaryUser = await tx.user.create({
            data: {
              phone: benPhone,
              name: beneficiaryName || subscriberName,
              role: 'beneficiary',
              password: benHash,
              isActive: true,
            },
          });
        }
      }

      // ──────────────────────────────────────────────────────────────────
      // 3. Find or create Beneficiary profile
      // ──────────────────────────────────────────────────────────────────
      let beneficiary = await tx.beneficiary.findUnique({
        where: { userId: beneficiaryUser.id },
      });
      if (!beneficiary) {
        beneficiary = await tx.beneficiary.create({
          data: {
            userId: beneficiaryUser.id,
            subscriberId: subscriberUser.id,
            name: beneficiaryName || subscriberName,
            dateOfBirth: beneficiaryDob ? new Date(beneficiaryDob) : undefined,
            age: beneficiaryDob ? (calculateAge(beneficiaryDob) ?? (beneficiaryAge ? parseInt(beneficiaryAge) : 0)) : (beneficiaryAge ? parseInt(beneficiaryAge) : 0),
            gender: beneficiaryGender,
            maritalStatus: maritalStatus,
            photo: profilePhoto,
            address: beneficiaryAddress,
            pincode: beneficiaryPincode,
            city: beneficiaryCity,
            state: beneficiaryState,
            relationship: sameAsSubscriber ? 'Self' : (relationship || 'Family'),
            primaryPhysicianName: primaryPhysicianName,
            primaryPhysicianPhone: primaryPhysicianPhone,
            hobbiesInterests: hobbiesInterests,
            isActive: csaMode ? false : true,
            createdBy: csaMode ? 'csa' : 'subscriber',
            verificationStatus: csaMode ? 'pending' : 'verified',
            // Nested creates
            emergencyContacts: {
              create: [
                ...(emergencyContactName
                  ? [
                      {
                        name: emergencyContactName,
                        phone:
                          (typeof emergencyContactPhone === 'string' && emergencyContactPhone) ||
                          (typeof subscriberPhone === 'string' ? subscriberPhone.replace('+91', '') : String(subscriberPhone || '')),
                        relationship: emergencyContactRelationship,
                        email: emergencyContactEmail,
                        isPrimary: true,
                      },
                    ]
                  : []),
                ...(secondaryContactName
                  ? [
                      {
                        name: secondaryContactName,
                        phone: secondaryContactPhone,
                        relationship: secondaryContactRelationship,
                        email: secondaryContactEmail,
                        isPrimary: false,
                      },
                    ]
                  : []),
              ],
            },
            schedulePreference: preferredSlot
              ? {
                  create: {
                    preferredSlot: preferredSlot,
                    preferredDays: [
                      'Monday',
                      'Tuesday',
                      'Wednesday',
                      'Thursday',
                      'Friday',
                      'Saturday',
                      'Sunday',
                    ],
                  },
                }
              : undefined,
            // Medications
            medicationList:
              medications.length > 0
                ? {
                    create: medications.map((m) => ({
                      name: m.name,
                      dosage: m.dosage || '1 unit',
                      frequency: m.frequency || 'once_daily',
                      instructions: m.instructions,
                      timeSlots: m.timeSlots || [],
                      setReminders: !!m.setReminders,
                      startDate: m.startDate ? new Date(m.startDate) : new Date(),
                      endDate: m.endDate ? new Date(m.endDate) : null,
                    })),
                  }
                : undefined,
          },
        });

        // ──────────────────────────────────────────────────────────────
        // 3b. Medical Conditions
        // ──────────────────────────────────────────────────────────────
        if (medicalConditions && medicalConditions.length > 0) {
          for (const conditionName of medicalConditions) {
            if (!conditionName) continue;
            const normalizedName = conditionName.trim();
            const slug = normalizedName
              .toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^\w-]/g, '');
            // Find or create the condition checking both name and slug
            let cond = await tx.medicalCondition.findFirst({
              where: {
                OR: [
                  { name: { equals: normalizedName, mode: 'insensitive' } },
                  { slug: slug }
                ]
              }
            });
            if (!cond) {
              cond = await tx.medicalCondition.create({
                data: {
                  name: normalizedName,
                  slug: slug,
                  category: 'General',
                  isCommon: false,
                },
              });
            }

            // Link to beneficiary
            await tx.beneficiaryCondition.upsert({
              where: {
                beneficiaryId_conditionId: {
                  beneficiaryId: beneficiary.id,
                  conditionId: cond.id,
                },
              },
              update: { isActive: true },
              create: {
                beneficiaryId: beneficiary.id,
                conditionId: cond.id,
                severity: 'moderate',
                isActive: true,
              },
            });
          }
        }
      }

      // ──────────────────────────────────────────────────────────────────
      // 3c. Vitals Configuration (New Relational System)
      // ──────────────────────────────────────────────────────────────────
      if (vitalsToTrack && Object.keys(vitalsToTrack).length > 0) {
        const vitalCodes = Object.keys(vitalsToTrack).filter(code => vitalsToTrack[code]);
        if (vitalCodes.length > 0) {
          const vitalDefs = await tx.vitalDefinition.findMany({
            where: { code: { in: vitalCodes } }
          });

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          // Create configs for selected vitals
          for (const def of vitalDefs) {
            await tx.beneficiaryVitalConfig.upsert({
              where: {
                beneficiaryId_vitalDefinitionId: {
                  beneficiaryId: beneficiary.id,
                  vitalDefinitionId: def.id
                }
              },
              update: { isActive: true },
              create: {
                beneficiaryId: beneficiary.id,
                vitalDefinitionId: def.id,
                isActive: true,
                frequency: 'every_visit'
              }
            });
          }
        }
      }

      // 4. Deactivate existing active subscriptions for this beneficiary
      // ──────────────────────────────────────────────────────────────────
      await tx.subscription.updateMany({
        where: { beneficiaryId: beneficiary.id, isActive: true },
        data: { isActive: false },
      });

      // 4b. Find or publish latest PackageVersion
      let pVersion = await tx.packageVersion.findFirst({
        where: { packageCode: pkg.type, isLatest: true },
        include: { versionBenefits: true },
      });

      if (!pVersion) {
        const createdVer = await publishPackageVersion(tx, pkg.id);
        pVersion = await tx.packageVersion.findUnique({
          where: { id: createdVer.id },
          include: { versionBenefits: true },
        });
      }

      // ──────────────────────────────────────────────────────────────────
      // 5. Create new Subscription
      // ──────────────────────────────────────────────────────────────────
      const sub = await tx.subscription.create({
        data: {
          subscriberId: subscriberUser.id,
          beneficiaryId: beneficiary.id,
          packageType: pkg.type,
          packageVersionId: pVersion.id,
          duration,
          startDate: start,
          endDate: end,
          visitsTotal: pkg.visitsPerWeek * 4,
          hoursTotal: pkg.hoursPerMonth || 0,
          // In CSA mode, subscription starts inactive until subscriber activates via mobile app
          isActive: csaMode ? false : true,
        },
      });

      // ──────────────────────────────────────────────────────────────────
      // 6. Initialize benefit balances
      // ──────────────────────────────────────────────────────────────────
      if (pVersion.versionBenefits && pVersion.versionBenefits.length > 0) {
        await tx.subscriptionBenefitBalance.createMany({
          data: pVersion.versionBenefits.map((vb) => ({
            subscriptionId: sub.id,
            benefitId: vb.benefitId,
            packageVersionBenefitId: vb.id,
            snapshotBenefitName: vb.snapshotName,
            snapshotUnitLabel: vb.snapshotUnitLabel,
            totalUnits: vb.unitsIncluded,
            usedUnits: 0,
            unit: vb.snapshotUnitLabel ? normalizeUnit(vb.snapshotUnitLabel) : 'visits',
          })),
          skipDuplicates: true,
        });
      }

      // ──────────────────────────────────────────────────────────────────
      // 7. Create Invoice & Payment record (offline / admin-enrolled)
      // In CSA mode, payment is deferred until subscriber activates the plan.
      // ──────────────────────────────────────────────────────────────────
      let invoice = null;
      let invoiceNumber = null;
      if (!csaMode) {
        const paid = parseFloat(amountPaid) || pkg.basePrice;
        const discount = pkg.basePrice - paid > 0 ? pkg.basePrice - paid : 0;
        const customerState = beneficiary.state || 'Haryana';

        invoice = await invoiceService.generateSubscriptionInvoice(tx, {
          subscription: sub,
          subPackage: pkg,
          packageVersion: pVersion,
          durationMonths: 1,
          customerState,
          discountAmount: discount,
          subscriberId: subscriberUser.id,
          beneficiaryId: beneficiary.id,
          status: 'PAID',
        });
        invoiceNumber = invoice.invoiceNumber;

        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            subscriberId: subscriberUser.id,
            beneficiaryId: beneficiary.id,
            subscriptionId: sub.id,
            packageType: pkg.type,
            packageVersionId: pVersion.id,
            snapshotPackageName: pVersion.name,
            snapshotBasePrice: pVersion.basePrice,
            snapshotBenefits: pVersion.versionBenefits.map(vb => ({
              name: vb.snapshotName,
              units: vb.unitsIncluded,
              unitLabel: vb.snapshotUnitLabel
            })),
            baseAmount: pkg.basePrice,
            amountPaid: paid,
            discountAmount: discount,
            paymentMethod: paymentMethod,
            paymentStatus: 'success',
            planStartDate: start,
            planEndDate: end,
            paidAt: new Date(),
            enrolledAt: new Date(),
            isSubscriptionActive: true,
            gatewayName: 'admin_offline',
            failureReason: paymentNote || null,
          },
        });
      }

      await tx.activityLog.create({
        data: {
          userId: subscriberUser.id,
          type: 'SUBSCRIPTION',
          action: 'ENROLLED',
          details: {
            entity: 'subscription',
            entityId: sub.id,
            packageId: pkg.id,
            beneficiaryId: beneficiary.id,
            updatedByRole: req.user?.role || 'system',
            updatedByName: req.user?.name || 'Admin',
          }
        }
      });

      return {
        subscription: sub,
        subscriber: {
          id: subscriberUser.id,
          name: subscriberUser.name,
          phone: subscriberUser.phone,
        },
        beneficiary: { id: beneficiary.id, name: beneficiary.name },
        package: { 
          name: pkg.name, 
          type: pkg.type, 
          basePrice: pkg.basePrice,
          isGlobal: pkg.isGlobal
        },
        invoiceId: invoice?.id || null,
        invoiceNumber: invoiceNumber || null,
      };
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error('Admin Enrollment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/subscriptions/:id/balances ──────────────────────────────────────
router.get('/:id/balances', async (req, res) => {
  try {
    const balances = await prisma.subscriptionBenefitBalance.findMany({
      where: { subscriptionId: req.params.id },
      include: { benefit: true },
    });
    res.json({ success: true, data: balances });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/subscriptions/:id/initialize-balances ──────────────────────────
// Backfills missing SubscriptionBenefitBalance rows for an existing subscription.
// Safe to call multiple times — uses skipDuplicates.
router.post('/:id/initialize-balances', async (req, res) => {
  const { id } = req.params;
  try {
    // Fetch subscription + its package benefits
    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: {
        package: {
          include: {
            packageBenefits: {
              include: { benefit: true },
            },
          },
        },
        benefitBalances: true,
      },
    });

    if (!sub) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    const packageBenefits = sub.package?.packageBenefits || [];

    if (packageBenefits.length === 0) {
      return res.json({
        success: true,
        message: 'This package has no defined benefits — nothing to initialize.',
        created: 0,
      });
    }

    // Find which benefitIds are already tracked
    const existingBenefitIds = new Set(sub.benefitBalances.map((bb) => bb.benefitId));

    // Only create missing ones
    const toCreate = packageBenefits
      .filter((pb) => !existingBenefitIds.has(pb.benefitId))
      .map((pb) => ({
        subscriptionId: id,
        benefitId: pb.benefitId,
        totalUnits: pb.unitsIncluded,
        usedUnits: 0,
        unit: pb.unit || (pb.benefit?.unitLabel ? normalizeUnit(pb.benefit.unitLabel) : 'visits'),
      }));

    if (toCreate.length === 0) {
      return res.json({
        success: true,
        message: 'All benefit balances are already initialized.',
        created: 0,
      });
    }

    await prisma.subscriptionBenefitBalance.createMany({
      data: toCreate,
      skipDuplicates: true,
    });

    console.log(`[InitBalances] Created ${toCreate.length} balances for subscription ${id}`);

    res.json({
      success: true,
      message: `Successfully initialized ${toCreate.length} benefit balance(s).`,
      created: toCreate.length,
      benefits: toCreate.map((b) => {
        const pb = packageBenefits.find((p) => p.benefitId === b.benefitId);
        return { benefitId: b.benefitId, name: pb?.benefit?.name, totalUnits: b.totalUnits };
      }),
    });
  } catch (err) {
    console.error('[InitBalances] Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/subscriptions/enroll ────────────────────────────────────────────
// Legacy enroll route (requires existing user IDs)
router.post('/enroll', async (req, res) => {
  const {
    subscriberId,
    beneficiaryId,
    packageId,
    duration = 'monthly',
    startDate = new Date(),
  } = req.body;
  if (!subscriberId || !beneficiaryId || !packageId) {
    return res
      .status(400)
      .json({ success: false, message: 'Missing required fields' });
  }
  try {
    const pkg = await prisma.subscriptionPackage.findUnique({
      where: { id: packageId },
      include: { packageBenefits: { include: { benefit: true } } },
    });
    if (!pkg)
      return res
        .status(404)
        .json({ success: false, message: 'Package not found' });

    const start = new Date(startDate);
    const end = new Date(start);
    if (duration === 'six_months') end.setMonth(end.getMonth() + 6);
    else if (duration === 'annual') end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);

    const subscription = await prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: { beneficiaryId, isActive: true },
        data: { isActive: false },
      });

      // Find or publish latest PackageVersion
      let pVersion = await tx.packageVersion.findFirst({
        where: { packageCode: pkg.type, isLatest: true },
        include: { versionBenefits: true },
      });

      if (!pVersion) {
        const createdVer = await publishPackageVersion(tx, pkg.id);
        pVersion = await tx.packageVersion.findUnique({
          where: { id: createdVer.id },
          include: { versionBenefits: true },
        });
      }

      const sub = await tx.subscription.create({
        data: {
          subscriberId,
          beneficiaryId,
          packageType: pkg.type,
          packageVersionId: pVersion.id,
          duration,
          startDate: start,
          endDate: end,
          visitsTotal: pkg.visitsPerWeek * 4,
          hoursTotal: pkg.hoursPerMonth || 0,
          isActive: true,
        },
      });

      if (pVersion.versionBenefits && pVersion.versionBenefits.length > 0) {
        await tx.subscriptionBenefitBalance.createMany({
          data: pVersion.versionBenefits.map((vb) => ({
            subscriptionId: sub.id,
            benefitId: vb.benefitId,
            packageVersionBenefitId: vb.id,
            snapshotBenefitName: vb.snapshotName,
            snapshotUnitLabel: vb.snapshotUnitLabel,
            totalUnits: vb.unitsIncluded,
            usedUnits: 0,
            unit: vb.snapshotUnitLabel ? normalizeUnit(vb.snapshotUnitLabel) : 'visits',
          })),
        });
      }
      
      await tx.activityLog.create({
        data: {
          userId: subscriberId,
          type: 'SUBSCRIPTION',
          action: 'ENROLLED',
          details: {
            entity: 'subscription',
            entityId: sub.id,
            packageId,
            beneficiaryId,
            updatedByRole: req.user?.role || 'system',
            updatedByName: req.user?.name || 'Admin',
          }
        }
      });

      return sub;
    });
    res.status(201).json({ success: true, data: subscription });
  } catch (err) {
    console.error('Enrollment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/subscriptions/:id/consume ──────────────────────────────────────
router.post('/:id/consume', async (req, res) => {
  const { benefitId, units = 1, notes } = req.body;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const balance = await tx.subscriptionBenefitBalance.findUnique({
        where: {
          subscriptionId_benefitId: {
            subscriptionId: req.params.id,
            benefitId,
          },
        },
      });
      if (!balance)
        throw new Error('No balance found for this benefit in subscription');
      if (balance.totalUnits < balance.usedUnits + units) {
        throw new Error('Insufficient balance for this benefit');
      }
      return tx.subscriptionBenefitBalance.update({
        where: { id: balance.id },
        data: { usedUnits: { increment: units } },
      });
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── POST /api/subscriptions/:id/addons/allocate ──────────────────────────────
router.post('/:id/addons/allocate', async (req, res) => {
  const { benefitId, units = 1, amountPaid = 0, paymentMethod = 'Cash', transactionId, paymentNote } = req.body;
  try {
    if (!benefitId) {
      return res.status(400).json({ success: false, message: 'benefitId is required' });
    }

    let subscriptionId = req.params.id;

    // Check if subscription exists by ID or if this was passed a beneficiary ID
    let subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { subscriber: true, beneficiary: true }
    });

    if (!subscription) {
      // Try resolving as beneficiaryId
      subscription = await prisma.subscription.findFirst({
        where: { beneficiaryId: subscriptionId, isActive: true },
        orderBy: { createdAt: 'desc' },
        include: { subscriber: true, beneficiary: true }
      });
      if (subscription) {
        subscriptionId = subscription.id;
      }
    }

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Active subscription not found' });
    }

    const benefit = await prisma.benefit.findUnique({
      where: { id: benefitId }
    });

    if (!benefit) {
      return res.status(404).json({ success: false, message: 'Benefit not found' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Upsert SubscriptionBenefitBalance
      let balance = await tx.subscriptionBenefitBalance.findUnique({
        where: {
          subscriptionId_benefitId: {
            subscriptionId,
            benefitId,
          },
        },
      });

      if (balance) {
        balance = await tx.subscriptionBenefitBalance.update({
          where: { id: balance.id },
          data: { totalUnits: { increment: Number(units) || 1 } },
        });
      } else {
        balance = await tx.subscriptionBenefitBalance.create({
          data: {
            subscriptionId,
            benefitId,
            totalUnits: Number(units) || 1,
            usedUnits: 0,
            reservedUnits: 0,
          },
        });
      }

      // 2. Record Invoice and Payment if amountPaid > 0
      const numericAmount = parseFloat(amountPaid);
      let invoice = null;
      if (numericAmount > 0) {
        const customerState = subscription.beneficiary?.state || 'Haryana';
        invoice = await invoiceService.generateAddonInvoice(tx, {
          subscriptionId,
          benefit,
          units: Number(units) || 1,
          unitPrice: numericAmount / (Number(units) || 1),
          customerState,
          subscriberId: subscription.subscriberId,
          beneficiaryId: subscription.beneficiaryId || undefined,
          status: 'PAID',
        });

        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            subscriptionId,
            subscriberId: subscription.subscriberId,
            beneficiaryId: subscription.beneficiaryId || undefined,
            packageType: subscription.packageType || 'addon',
            baseAmount: numericAmount,
            amountPaid: numericAmount,
            paymentMethod: paymentMethod || 'Cash',
            paymentStatus: 'success',
            paidAt: new Date(),
            planStartDate: subscription.startDate || new Date(),
            planEndDate: subscription.endDate || new Date(),
            transactionId: transactionId || `ADDON-TXN-${Date.now()}`,
            gatewayName: 'admin_addon',
            failureReason: paymentNote || `Add-on Purchase: ${benefit.name} (${units} units)`,
            isSubscriptionActive: true,
          },
        }).catch(err => {
          console.warn('[Addon Payment Record Warning]:', err.message);
        });
      }

      return {
        ...balance,
        invoiceNumber: invoice?.invoiceNumber || null,
        invoiceId: invoice?.id || null,
      };
    });

    res.json({
      success: true,
      data: result,
      message: `Successfully allocated ${units} units of "${benefit.name}"`,
    });
  } catch (err) {
    console.error('Addon allocate error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── GET /api/subscriptions/beneficiary/:id/utilization ────────────────────────
// Returns active subscription + benefit balances + recent hours log for a beneficiary
router.get('/beneficiary/:id/utilization', async (req, res) => {
  try {
    const { id: beneficiaryId } = req.params;

    // Get active subscription with package + benefit balances
    const subscription = await prisma.subscription.findFirst({
      where: { beneficiaryId, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        package: {
          select: {
            id: true,
            name: true,
            type: true,
            basePrice: true,
          },
        },
        packageVersion: {
          select: {
            id: true,
            name: true,
            basePrice: true,
          }
        },
        benefitBalances: {
          include: {
            benefit: {
              select: {
                id: true,
                name: true,
                unitLabel: true,
                description: true,
                benefitType: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!subscription) {
      return res.json({
        success: true,
        data: { subscription: null, benefits: [], recentLogs: [] },
      });
    }

    // Get recent package hours logs (last 30 entries)
    const recentLogs = await prisma.packageHoursLog.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { loggedAt: 'desc' },
      take: 30,
      include: {
        visit: {
          select: {
            encounterId: true,
            status: true,
            scheduledTime: true,
            checkInTime: true,
            checkOutTime: true,
            durationMinutes: true,
            careCompanion: { select: { name: true, ccType: true } },
          },
        },
      },
    });

    const benefits = subscription.benefitBalances.map((b) => {
      const remainingUnits = Math.max(0, b.totalUnits - b.usedUnits);
      const usagePercent = b.totalUnits > 0 ? Math.round((b.usedUnits / b.totalUnits) * 100) : 0;
      const isLowBalance = b.totalUnits > 0 && remainingUnits / b.totalUnits < 0.2;
      const isExhausted = b.totalUnits > 0 && remainingUnits === 0;

      return {
        benefitId: b.benefitId,
        benefitName: b.snapshotBenefitName || b.benefit?.name,
        unitLabel: b.snapshotUnitLabel || b.benefit?.unitLabel || 'units',
        benefitTypeName: b.benefit?.benefitType?.name || null,
        description: b.benefit?.description || null,
        totalUnits: b.totalUnits,
        usedUnits: b.usedUnits,
        remainingUnits,
        usagePercent,
        isLowBalance,
        isExhausted,
      };
    });

    const logs = recentLogs.map((l) => ({
      id: l.id,
      visitId: l.visitId || null,
      encounterId: l.visit?.encounterId || null,
      hoursConsumed: l.hoursConsumed,
      balanceBefore: l.balanceBefore,
      balanceAfter: l.balanceAfter,
      description: l.description,
      loggedAt: l.loggedAt,
      careCompanionName: l.visit?.careCompanion?.name || 'System',
      ccType: l.visit?.careCompanion?.ccType || null,
      visitStatus: l.visit?.status || null,
      scheduledTime: l.visit?.scheduledTime || null,
      actualMinutes: l.visit?.durationMinutes || null,
    }));

    res.json({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          packageId: subscription.package?.id,
          packageName: subscription.packageVersion?.name || subscription.package?.name,
          packageType: subscription.packageType,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          isActive: subscription.isActive,
          hoursTotal: subscription.hoursTotal,
          hoursUsed: subscription.hoursUsed,
          hoursRemaining: Math.max(0, subscription.hoursTotal - subscription.hoursUsed),
          visitsTotal: subscription.visitsTotal,
          visitsCompleted: subscription.visitsCompleted,
        },
        benefits,
        recentLogs: logs,
      },
    });
  } catch (err) {
    console.error('GET /subscriptions/beneficiary/:id/utilization error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/subscriptions/expiring ──────────────────────────────────────────
// Returns active subscriptions expiring within next N days
router.get('/expiring', async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + days);

  try {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        isActive: true,
        endDate: {
          lte: targetDate,
        },
      },
      orderBy: { endDate: 'asc' },
      include: {
        subscriber: {
          select: { id: true, name: true, phone: true, email: true, location: true, city: true, state: true, pincode: true },
        },
        beneficiary: {
          select: {
            id: true,
            name: true,
            age: true,
            dateOfBirth: true,
            gender: true,
            maritalStatus: true,
            relationship: true,
            address: true,
            city: true,
            state: true,
            pincode: true,
            primaryPhysicianName: true,
            primaryPhysicianPhone: true,
            hobbiesInterests: true,
            emergencyContacts: { select: { id: true, name: true, phone: true, relationship: true, email: true } },
            user: { select: { phone: true } },
          },
        },
        package: true,
        packageVersion: true,
      },
    });

    res.json({ success: true, data: subscriptions });
  } catch (err) {
    console.error('GET /subscriptions/expiring error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/subscriptions/terminated ──────────────────────────────────────────
// List all terminated subscriptions with cancellation notes / reasons
router.get('/terminated', async (req, res) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        cancellationNote: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        subscriber: {
          select: { id: true, name: true, phone: true, email: true },
        },
        beneficiary: {
          select: { id: true, name: true, relationship: true, user: { select: { phone: true } } },
        },
        package: true,
        packageVersion: true,
      },
    });

    res.json({ success: true, data: subscriptions });
  } catch (err) {
    console.error('GET /subscriptions/terminated error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/subscriptions/:id/terminate ──────────────────────────────────────
// Cancel subscription early with reason
router.post('/:id/terminate', async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ success: false, message: 'Reason is required' });
  }

  try {
    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        isActive: false,
        cancelledAt: new Date(),
        cancellationNote: reason,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: updated.subscriberId,
        type: 'SUBSCRIPTION',
        action: 'TERMINATED',
        details: {
          entity: 'subscription',
          entityId: id,
          reason,
          terminatedBy: req.user?.name || 'Admin',
        },
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('POST /subscriptions/:id/terminate error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/subscriptions/:id/renewal ─────────────────────────────────────────
// Complete renewal information context for an enterprise subscription
router.get('/:id/renewal', async (req, res) => {
  const { id } = req.params;
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: {
        subscriber: true,
        beneficiary: {
          include: {
            emergencyContacts: true,
            conditions: { include: { condition: true } },
            medicationList: { where: { isActive: true } },
            schedulePreference: true,
            vitalConfigs: { where: { isActive: true }, include: { vitalDefinition: true } },
          },
        },
        package: true,
        packageVersion: { include: { versionBenefits: { include: { benefit: true } } } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!sub) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    // Past subscription versions / history for this beneficiary
    let subscriptionHistory = [];
    if (sub.beneficiaryId) {
      subscriptionHistory = await prisma.subscription.findMany({
        where: { beneficiaryId: sub.beneficiaryId },
        orderBy: { createdAt: 'asc' },
        include: {
          package: { select: { id: true, name: true, type: true } },
          packageVersion: { select: { id: true, name: true } },
          payments: { select: { invoiceNumber: true, amountPaid: true, paymentMethod: true, paidAt: true } },
        },
      });
    }

    // Available packages for plan upgrade / downgrade
    const availablePackages = await prisma.subscriptionPackage.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        packageBenefits: { include: { benefit: true } },
      },
    });

    // Audit logs for activity
    const auditLogs = await prisma.activityLog.findMany({
      where: {
        OR: [
          { userId: sub.subscriberId },
          { details: { path: ['entityId'], equals: sub.id } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Map active vitals to track object { [vitalCode]: true }
    const vitalsToTrackMap = {};
    if (sub.beneficiary?.vitalConfigs) {
      sub.beneficiary.vitalConfigs.forEach((vc) => {
        if (vc.vitalDefinition?.code && vc.isActive) {
          vitalsToTrackMap[vc.vitalDefinition.code] = true;
        }
      });
    }

    res.json({
      success: true,
      data: {
        subscription: sub,
        subscriber: sub.subscriber,
        beneficiary: sub.beneficiary,
        medicalConditions: sub.beneficiary?.conditions?.map((bc) => ({
          id: bc.condition.id,
          name: bc.condition.name,
          slug: bc.condition.slug,
          severity: bc.severity,
        })) || [],
        medications: sub.beneficiary?.medicationList || [],
        emergencyContacts: sub.beneficiary?.emergencyContacts || [],
        vitalsToTrack: vitalsToTrackMap,
        currentPackage: sub.packageVersion || sub.package,
        paymentHistory: sub.payments,
        subscriptionHistory,
        availablePackages,
        auditLogs,
      },
    });
  } catch (err) {
    console.error('GET /subscriptions/:id/renewal error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/subscriptions/:id/renew ──────────────────────────────────────────
// Creates a new SubscriptionVersion and new Payment, deactivating the old one
router.post('/:id/renew', async (req, res) => {
  const { id } = req.params;
  const {
    changedFields = {},
    vitalsToTrack = null,
    packageId,
    duration = 'monthly',
    renewalMode = 'from_expiry', // 'from_expiry' | 'today'
    customStartDate,
    payment = {},
  } = req.body;

  try {
    const currentSub = await prisma.subscription.findUnique({
      where: { id },
      include: {
        subscriber: true,
        beneficiary: true,
        package: true,
      },
    });

    if (!currentSub) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    if (currentSub.cancellationNote && !currentSub.isActive) {
      return res.status(400).json({ success: false, message: 'Cannot renew a terminated subscription.' });
    }

    // Determine target package
    const selectedPkgId = packageId || currentSub.package?.id;
    const pkg = await prisma.subscriptionPackage.findUnique({
      where: { id: selectedPkgId },
      include: { packageBenefits: { include: { benefit: true } } },
    });

    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Selected package not found' });
    }

    // Determine new start & end dates
    const now = new Date();
    let newStartDate;
    if (customStartDate) {
      newStartDate = new Date(customStartDate);
    } else if (renewalMode === 'today') {
      newStartDate = now;
    } else {
      // from_expiry
      const curEndDate = new Date(currentSub.endDate);
      newStartDate = curEndDate > now ? curEndDate : now;
    }

    const newEndDate = new Date(newStartDate);
    if (duration === 'six_months') newEndDate.setMonth(newEndDate.getMonth() + 6);
    else if (duration === 'annual') newEndDate.setFullYear(newEndDate.getFullYear() + 1);
    else newEndDate.setMonth(newEndDate.getMonth() + 1);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update subscriber / beneficiary fields if changed
      if (changedFields.subscriber && Object.keys(changedFields.subscriber).length > 0) {
        await tx.user.update({
          where: { id: currentSub.subscriberId },
          data: changedFields.subscriber,
        });
      }

      if (changedFields.beneficiary && currentSub.beneficiaryId && Object.keys(changedFields.beneficiary).length > 0) {
        await tx.beneficiary.update({
          where: { id: currentSub.beneficiaryId },
          data: changedFields.beneficiary,
        });
      }

      // 1b. Update vitals configuration if vitalsToTrack provided
      if (vitalsToTrack && currentSub.beneficiaryId) {
        const vitalCodes = Object.keys(vitalsToTrack);
        const activeVitalCodes = vitalCodes.filter((code) => vitalsToTrack[code]);
        const vitalDefs = await tx.vitalDefinition.findMany();

        for (const def of vitalDefs) {
          const isSelected = activeVitalCodes.includes(def.code);
          await tx.beneficiaryVitalConfig.upsert({
            where: {
              beneficiaryId_vitalDefinitionId: {
                beneficiaryId: currentSub.beneficiaryId,
                vitalDefinitionId: def.id,
              },
            },
            update: { isActive: isSelected },
            create: {
              beneficiaryId: currentSub.beneficiaryId,
              vitalDefinitionId: def.id,
              isActive: isSelected,
              frequency: 'every_visit',
            },
          });
        }
      }

      // 2. Deactivate previous subscription only if renewing immediately or if already expired
      const isEarlyRenewal = renewalMode === 'from_expiry' && new Date(currentSub.endDate) > now;
      if (!isEarlyRenewal) {
        await tx.subscription.update({
          where: { id: currentSub.id },
          data: {
            isActive: false,
            cancellationNote: renewalMode === 'today' ? 'Terminated early for immediate renewal' : undefined,
          },
        });
      }

      // 3. Find or publish package version
      let pVersion = await tx.packageVersion.findFirst({
        where: { packageCode: pkg.type, isLatest: true },
        include: { versionBenefits: true },
      });

      if (!pVersion) {
        const createdVer = await publishPackageVersion(tx, pkg.id);
        pVersion = await tx.packageVersion.findUnique({
          where: { id: createdVer.id },
          include: { versionBenefits: true },
        });
      }

      // 4. Create new Subscription Version
      const newSub = await tx.subscription.create({
        data: {
          subscriberId: currentSub.subscriberId,
          beneficiaryId: currentSub.beneficiaryId,
          packageType: pkg.type,
          packageVersionId: pVersion.id,
          duration,
          startDate: newStartDate,
          endDate: newEndDate,
          visitsTotal: pkg.visitsPerWeek * 4,
          hoursTotal: pkg.hoursPerMonth || 0,
          isActive: true,
        },
      });

      // Fetch previous subscription benefit balances to compute rollover
      const prevBalances = await tx.subscriptionBenefitBalance.findMany({
        where: { subscriptionId: currentSub.id },
      });

      // 5. Create Subscription Benefit Balances with Rollover for new subscription
      const durationMonths = duration === 'annual' || duration === 'YEARLY' ? 12 : duration === 'six_months' ? 6 : duration === 'QUARTERLY' ? 3 : 1;

      if (pVersion.versionBenefits && pVersion.versionBenefits.length > 0) {
        for (const vb of pVersion.versionBenefits) {
          let rolloverUnits = 0;
          if (vb.allowRollover) {
            const prevBal = prevBalances.find((b) => b.benefitId === vb.benefitId);
            if (prevBal) {
              const unusedUnits = Math.max(0, (prevBal.totalUnits || 0) - (prevBal.usedUnits || 0) - (prevBal.reservedUnits || 0));
              const cap = vb.maxRolloverUnits != null ? vb.maxRolloverUnits : vb.unitsIncluded;
              rolloverUnits = Math.min(unusedUnits, cap);
            }
          }

          const totalUnits = (vb.unitsIncluded || 1) + rolloverUnits;

          const createdBalance = await tx.subscriptionBenefitBalance.create({
            data: {
              subscriptionId: newSub.id,
              benefitId: vb.benefitId,
              packageVersionBenefitId: vb.id,
              snapshotBenefitName: vb.snapshotName,
              snapshotUnitLabel: vb.snapshotUnitLabel,
              totalUnits,
              usedUnits: 0,
              reservedUnits: 0,
              availableUnits: totalUnits,
              unit: vb.snapshotUnitLabel ? normalizeUnit(vb.snapshotUnitLabel) : 'visits',
            },
          });

          if (rolloverUnits > 0) {
            await tx.benefitTransaction.create({
              data: {
                balanceId: createdBalance.id,
                transactionType: 'RENEWED',
                units: rolloverUnits,
                totalBefore: vb.unitsIncluded,
                totalAfter: totalUnits,
                reservedBefore: 0,
                reservedAfter: 0,
                usedBefore: 0,
                usedAfter: 0,
                availableBefore: vb.unitsIncluded,
                availableAfter: totalUnits,
                reason: `Rolled over ${rolloverUnits} unused units from previous subscription`,
                performedByUserId: req.user?.id || null,
              },
            });
          }
        }

        // Generate Benefit Periods and balances for multi-month tracking
        for (let i = 1; i <= durationMonths; i++) {
          const pStart = new Date(newStartDate);
          pStart.setMonth(pStart.getMonth() + (i - 1));
          const pEnd = new Date(pStart);
          pEnd.setMonth(pEnd.getMonth() + 1);

          const period = await tx.benefitPeriod.create({
            data: {
              subscriptionId: newSub.id,
              periodNumber: i,
              startDate: pStart,
              endDate: pEnd,
              status: i === 1 ? 'ACTIVE' : 'UPCOMING',
            },
          });

          if (i === 1) {
            for (const vb of pVersion.versionBenefits) {
              const base = vb.unitsIncluded || 1;
              let rolloverUnits = 0;
              if (vb.allowRollover) {
                const prevBal = prevBalances.find((b) => b.benefitId === vb.benefitId);
                if (prevBal) {
                  const unusedUnits = Math.max(0, (prevBal.totalUnits || 0) - (prevBal.usedUnits || 0) - (prevBal.reservedUnits || 0));
                  const cap = vb.maxRolloverUnits != null ? vb.maxRolloverUnits : base;
                  rolloverUnits = Math.min(unusedUnits, cap);
                }
              }
              const total = base + rolloverUnits;
              const cap = vb.allowRollover ? (vb.maxRolloverUnits != null ? vb.maxRolloverUnits : base) : 0;

              await tx.benefitPeriodBalance.create({
                data: {
                  periodId: period.id,
                  benefitId: vb.benefitId,
                  snapshotName: vb.snapshotName,
                  snapshotUnitLabel: vb.snapshotUnitLabel || null,
                  baseAllocation: base,
                  rolloverAllocation: rolloverUnits,
                  totalAllocation: total,
                  usedQuantity: 0,
                  reservedQuantity: 0,
                  remainingQuantity: total,
                  rolloverCap: cap,
                },
              });
            }
          }
        }
      }

      // 6. Create new Payment & Invoice
      const amountPaid = parseFloat(payment.amountPaid) || pkg.basePrice;
      const discount = pkg.basePrice - amountPaid > 0 ? pkg.basePrice - amountPaid : 0;
      const customerState = currentSub.beneficiary?.state || 'Haryana';

      const invoice = await invoiceService.generateRenewalInvoice(tx, {
        newSubscription: newSub,
        pkg,
        packageVersion: pVersion,
        durationMonths,
        customerState,
        discountAmount: discount,
        subscriberId: currentSub.subscriberId,
        beneficiaryId: currentSub.beneficiaryId,
        status: 'PAID',
      });
      const invoiceNumber = invoice.invoiceNumber;

      const newPayment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          invoiceNumber,
          subscriberId: currentSub.subscriberId,
          beneficiaryId: currentSub.beneficiaryId,
          subscriptionId: newSub.id,
          packageType: pkg.type,
          packageVersionId: pVersion.id,
          snapshotPackageName: pVersion.name,
          snapshotBasePrice: pVersion.basePrice,
          snapshotBenefits: pVersion.versionBenefits.map((vb) => ({
            name: vb.snapshotName,
            units: vb.unitsIncluded,
            unitLabel: vb.snapshotUnitLabel,
          })),
          baseAmount: pkg.basePrice,
          amountPaid,
          discountAmount: discount,
          paymentMethod: payment.paymentMethod || 'Cash',
          paymentStatus: 'success',
          transactionId: payment.transactionId || `TXN-${Date.now()}`,
          planStartDate: newStartDate,
          planEndDate: newEndDate,
          isSubscriptionActive: true,
          gatewayName: 'admin_renewal',
          failureReason: payment.paymentNote || null,
        },
      });

      // 7. Record Audit Log
      await tx.activityLog.create({
        data: {
          userId: currentSub.subscriberId,
          type: 'SUBSCRIPTION',
          action: 'RENEWED',
          details: {
            previousSubId: currentSub.id,
            newSubId: newSub.id,
            packageId: pkg.id,
            packageName: pkg.name,
            renewalMode,
            changedFields,
            amountPaid,
            invoiceId: invoice.id,
            invoiceNumber,
            renewedBy: req.user?.name || 'Admin',
            ip: req.ip,
          },
        },
      });

      return {
        newSubscription: newSub,
        invoiceId: invoice.id,
        invoiceNumber,
        payment: newPayment,
        package: pkg,
        subscriber: currentSub.subscriber,
        beneficiary: currentSub.beneficiary,
        startDate: newStartDate,
        endDate: newEndDate,
      };
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error('POST /subscriptions/:id/renew error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
