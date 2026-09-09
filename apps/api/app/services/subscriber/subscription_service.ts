import prisma from '../../core/database';
import { generateUUID } from '../../utils/helpers';
import { validateCoupon, applyCoupon } from '../coupon_service';
import { benefitPeriodManager } from '../benefit/BenefitPeriodManager';
import bcrypt from 'bcryptjs';
import { generateInvoiceNumber, calculateItemizedInvoice, BenefitTaxItem } from '../../utils/invoice_utils';

function normalizeUnit(unitLabel: string | null | undefined): string {
  if (!unitLabel) return 'visits';
  const clean = unitLabel.replace(/^per\s+/i, '').trim().toLowerCase();
  if (clean === 'visit') return 'visits';
  if (clean === 'hour') return 'hours';
  if (clean === 'session') return 'sessions';
  if (clean === 'test') return 'tests';
  if (clean.endsWith('s')) return clean;
  return clean + 's';
}

function parseDob(dobStr: string | null | undefined): Date | null {
  if (!dobStr) return null;
  const parts = dobStr.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      // DD-MM-YYYY or DD/MM/YYYY
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    } else if (parts[0].length === 4) {
      // YYYY-MM-DD or YYYY/MM/DD
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
  }
  const parsed = new Date(dobStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function calculateAge(dob: Date | null | undefined, rawAge?: string | number | null): number {
  if (dob && !isNaN(dob.getTime())) {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return Math.max(0, age);
  }
  if (rawAge !== undefined && rawAge !== null && rawAge !== '') {
    const parsed = parseInt(String(rawAge), 10);
    if (!isNaN(parsed)) return Math.max(0, parsed);
  }
  return 0; // safe non-null default — age MUST be Int in DB
}

async function publishPackageVersion(tx: any, packageId: string): Promise<any> {
  const pkg = await tx.subscriptionPackage.findUnique({
    where: { id: packageId },
    include: {
      packageBenefits: {
        include: {
          benefit: true,
        },
      },
    },
  });

  if (!pkg) {
    throw new Error(`SubscriptionPackage not found with id: ${packageId}`);
  }

  const packageCode = pkg.type;

  const maxVersionRecord = await tx.packageVersion.findFirst({
    where: { packageCode },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const nextVersion = maxVersionRecord ? maxVersionRecord.version + 1 : 1;

  await tx.packageVersion.updateMany({
    where: { packageCode, isLatest: true },
    data: { isLatest: false },
  });

  const newVersion = await tx.packageVersion.create({
    data: {
      packageCode,
      version: nextVersion,
      name: pkg.name,
      tagline: pkg.tagline,
      description: pkg.description,
      basePrice: pkg.basePrice,
      mrp: pkg.mrp,
      currency: pkg.currency,
      billingCycle: pkg.billingCycle,
      durationMonths: pkg.durationMonths,
      isFreeTrial: pkg.isFreeTrial,
      trialDurationDays: pkg.trialDurationDays,
      visitsPerWeek: pkg.visitsPerWeek,
      hoursPerMonth: pkg.hoursPerMonth,
      maxBeneficiaries: pkg.maxBeneficiaries,
      features: pkg.features,
      highlightFeatures: pkg.highlightFeatures,
      color: pkg.color,
      isPopular: pkg.isPopular,
      isLatest: true,
      isActive: pkg.isActive,
      sortOrder: pkg.sortOrder,
      discountPercentage: pkg.discountPercentage,
      miscellaneousCost: pkg.miscellaneousCost,
    },
  });

  if (pkg.packageBenefits.length > 0) {
    await tx.packageVersionBenefit.createMany({
      data: pkg.packageBenefits.map((pb: any) => ({
        packageVersionId: newVersion.id,
        benefitId: pb.benefitId,
        snapshotName: pb.benefit?.name || 'Benefit',
        snapshotUnitLabel: pb.benefit?.unitLabel || 'visits',
        unitsIncluded: pb.unitsIncluded,
        unitsPeriod: pb.unitsPeriod,
        allocationBasis: pb.allocationBasis || 'per_billing_cycle',
        minSubscriptionMonths: pb.minSubscriptionMonths || 1,
        allowRollover: pb.allowRollover || false,
        maxRolloverUnits: pb.maxRolloverUnits || null,
        isUnlimited: pb.isUnlimited,
        displayOrder: pb.displayOrder,
        notes: pb.notes,
      })),
    });
  }

  const versionWithBenefits = await tx.packageVersion.findUnique({
    where: { id: newVersion.id },
    include: { versionBenefits: true }
  });

  return versionWithBenefits!;
}

function getMultiMonthPackagePrice(pkg: any, monthlyBase: number, durationMonths: number): number {
  if (durationMonths === 3) {
    const disc = pkg.discountThreeMonths ?? 5;
    return pkg.priceThreeMonths ? pkg.priceThreeMonths : Math.round(monthlyBase * 3 * (1 - disc / 100));
  } else if (durationMonths === 6) {
    const disc = pkg.discountSixMonths ?? 10;
    return pkg.priceSixMonths ? pkg.priceSixMonths : Math.round(monthlyBase * 6 * (1 - disc / 100));
  } else if (durationMonths === 12) {
    const disc = pkg.discountAnnual ?? 20;
    return pkg.priceTwelveMonths ? pkg.priceTwelveMonths : Math.round(monthlyBase * 12 * (1 - disc / 100));
  }
  return monthlyBase;
}

export const purchaseSubscription = async (
  userId: string,
  packageId: string, // We map this to the package type string
  beneficiaryData?: {
    name: string;
    age: number;
    gender: string;
    address: string;
    flatPlot?: string;
    streetArea?: string;
    landmark?: string;
    city?: string;
    state?: string;
    pincode?: string;
    latitude?: number;
    longitude?: number;
    relationship: string;
    phone: string;
    dob?: string;
    devPassword?: string;
  } | null,
  medicalData?: any,
  emergencyContactsRaw?: any,
  couponCode?: string,
  selectedAddons?: Array<{ benefitId: string; quantity: number }>,
  durationMonths: number = 1,
  paymentDetails?: {
    razorpay_payment_id?: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
  }
) => {
  // Look up the package directly by UUID (id) or by type slug — this works for
  // both global and regional packages, unlike getSubscriptionPackages() which
  // filters to only global packages when no regionId is provided.
  const subPackage = await prisma.subscriptionPackage.findFirst({
    where: {
      OR: [
        { id: packageId },
        { type: packageId.toLowerCase() },
      ],
      isActive: true,
    },
    include: {
      packageRegions: { include: { region: true } },
      packageBenefits: { include: { benefit: { include: { benefitType: true } } } },
    },
  });
  if (!subPackage) {
    throw new Error(`Package id/type "${packageId}" not found or is inactive.`);
  }

  const months = Math.max(1, Math.floor(Number(durationMonths) || 1));
  const packageBasePrice = getMultiMonthPackagePrice(subPackage, subPackage.basePrice, months);

  // 1a. If beneficiaryData is provided, create the beneficiary user
  let newBeneficiaryUser: any = null;
  let dobDate: Date | null = null;

  if (beneficiaryData) {
    let beneficiaryPhone = '';
    if (beneficiaryData.phone) {
      beneficiaryPhone = beneficiaryData.phone.replace(/\D/g, '').slice(-10);
    }
    if (!beneficiaryPhone) {
      throw new Error('Beneficiary phone number is required.');
    }

    dobDate = parseDob(beneficiaryData.dob);

    const existingUser = await prisma.user.findUnique({ where: { phone: beneficiaryPhone } });

    if (existingUser) {
      // Reuse existing user (e.g. subscriber enrolling for self or existing account)
      newBeneficiaryUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: beneficiaryData.name || existingUser.name,
          age: calculateAge(dobDate, beneficiaryData.age) || existingUser.age,
          dateOfBirth: dobDate || existingUser.dateOfBirth,
        }
      });
    } else {
      // Hash devPassword if provided (default '654321' set on frontend)
      let passwordHash: string | undefined = undefined;
      if (beneficiaryData.devPassword) {
        const salt = await bcrypt.genSalt(10);
        passwordHash = await bcrypt.hash(String(beneficiaryData.devPassword), salt);
      }

      newBeneficiaryUser = await prisma.user.create({
        data: {
          id: generateUUID(),
          phone: beneficiaryPhone,
          name: beneficiaryData.name,
          role: 'beneficiary',
          age: calculateAge(dobDate, beneficiaryData.age),
          dateOfBirth: dobDate,
          ...(passwordHash ? { password: passwordHash } : {})
        }
      });
    }
  }

  // Calculate pricing & validate coupon
  let finalAmountPaid = packageBasePrice;
  let discountAmount = Math.max(0, (subPackage.basePrice * months) - packageBasePrice);
  let appliedCouponId: string | null = null;

  if (couponCode) {
    const previousSubscriptionsCount = await prisma.subscription.count({
      where: { subscriberId: userId }
    });
    const isFirstTimeSubscriber = previousSubscriptionsCount === 0;

    const validation = await validateCoupon(
      couponCode,
      userId,
      subPackage.type,
      packageBasePrice,
      isFirstTimeSubscriber
    );

    if (!validation.isValid) {
      throw new Error(`Coupon failed validation: ${validation.message}`);
    }

    finalAmountPaid = validation.finalAmount;
    discountAmount += validation.discountApplied;
    appliedCouponId = validation.couponId || null;
  }

  // --- Start Medical Data Parsing ---
  const conditionIds: string[] = [];
  if (medicalData?.conditions && Array.isArray(medicalData.conditions)) {
      for (const condName of medicalData.conditions) {
          const slug = condName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          try {
              const condition = await prisma.medicalCondition.upsert({
                  where: { slug },
                  update: {},
                  create: {
                      id: generateUUID(),
                      name: condName,
                      slug: slug,
                      category: "General"
                   }
              });
              conditionIds.push(condition.id);
          } catch(e) { console.error("Condition Error", e); }
      }
  }

  const mappedMedications: any[] = [];
  if (medicalData?.medications && Array.isArray(medicalData.medications)) {
      for (const med of medicalData.medications) {
          // Map frequency string to enum (basic fallback)
          let freqEnum = 'once_daily';
          const lowerFreq = String(med.frequency || '').toLowerCase();
          if (lowerFreq.includes('twice') || lowerFreq.includes('2')) freqEnum = 'twice_daily';
          else if (lowerFreq.includes('thrice') || lowerFreq.includes('3')) freqEnum = 'thrice_daily';
          else if (lowerFreq.includes('needed')) freqEnum = 'as_needed';

          mappedMedications.push({
              id: generateUUID(),
              name: med.name || 'Unknown',
              dosage: med.dosage || '',
              frequency: freqEnum as any,
              timeSlots: med.timesPerDay || [],
              setReminders: !!med.setReminders,
              startDate: new Date()
          });
      }
  }
  // --- End Medical Data Parsing ---

  const finalEmergencyContacts: any[] = [];

  // 1. Check direct emergencyContactsRaw object (primary/secondary properties)
  if (emergencyContactsRaw) {
    if (emergencyContactsRaw.primaryName || emergencyContactsRaw.primaryPhone) {
      finalEmergencyContacts.push({
        name: emergencyContactsRaw.primaryName || 'Primary Contact',
        phone: String(emergencyContactsRaw.primaryPhone || '').replace(/\D/g, '').slice(-10) || '0000000000',
        relation: emergencyContactsRaw.primaryRelation || 'Primary Contact',
        email: emergencyContactsRaw.primaryEmail || '',
      });
    }
    if (emergencyContactsRaw.secondaryName || emergencyContactsRaw.secondaryPhone) {
      finalEmergencyContacts.push({
        name: emergencyContactsRaw.secondaryName || 'Secondary Contact',
        phone: String(emergencyContactsRaw.secondaryPhone || '').replace(/\D/g, '').slice(-10) || '0000000000',
        relation: emergencyContactsRaw.secondaryRelation || 'Secondary Contact',
        email: emergencyContactsRaw.secondaryEmail || '',
      });
    }
  }

  // 2. Check beneficiaryData.emergencyContacts array format
  const bDataAny = beneficiaryData as any;
  if (finalEmergencyContacts.length === 0 && bDataAny && bDataAny.emergencyContacts && Array.isArray(bDataAny.emergencyContacts)) {
    for (const ec of bDataAny.emergencyContacts) {
      if (ec.name && ec.phone) {
        finalEmergencyContacts.push({
          name: ec.name,
          phone: String(ec.phone).replace(/\D/g, '').slice(-10),
          relation: ec.relation || 'Emergency',
          email: ec.email || '',
        });
      }
    }
  }

  // 3. Fallback to subscriber contact details if none are supplied
  if (finalEmergencyContacts.length === 0 && medicalData && (medicalData as any).emergencyContacts && Array.isArray((medicalData as any).emergencyContacts)) {
    const rawEC = (medicalData as any).emergencyContacts[0];
    if (rawEC && rawEC.name && rawEC.phone) {
      finalEmergencyContacts.push({
        name: rawEC.name,
        phone: String(rawEC.phone).replace(/\D/g, '').slice(-10),
        relation: rawEC.relation || 'Emergency',
        email: rawEC.secondaryEmail || '',
      });
    }
  }

  // 4. Default fallback: subscriber profile
  if (beneficiaryData && finalEmergencyContacts.length === 0) {
    const subscriberUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    finalEmergencyContacts.push({
      name: subscriberUser?.name || 'Subscriber',
      phone: subscriberUser?.phone || '0000000000',
      relation: beneficiaryData.relationship || 'Subscriber',
    });
  }

  // Map Vitals to model fields
  const vitalsInput = medicalData?.vitals || {};

  // Run the creation flow inside a single database transaction
  // Note: newBeneficiaryUser was already created above (outside the transaction)
  const result = await prisma.$transaction(async (tx) => {
    let beneficiary: any = null;

    if (beneficiaryData && newBeneficiaryUser) {
      // 1b. Create Beneficiary record (only if beneficiary data was provided)
      beneficiary = await tx.beneficiary.create({
        data: {
          id: generateUUID(),
          userId: newBeneficiaryUser.id,
          subscriberId: userId,
          name: beneficiaryData.name,
          age: parseInt(String(beneficiaryData.age || 65), 10),
          dateOfBirth: dobDate,
          gender: (String(beneficiaryData.gender).toLowerCase().includes('male') && !String(beneficiaryData.gender).toLowerCase().includes('female')) ? 'male' : String(beneficiaryData.gender).toLowerCase().includes('female') ? 'female' : 'prefer_not_to_say',
          address: beneficiaryData.address || "Not provided",
          flatPlot: beneficiaryData.flatPlot || null,
          streetArea: beneficiaryData.streetArea || null,
          landmark: beneficiaryData.landmark || null,
          city: beneficiaryData.city || null,
          state: beneficiaryData.state || null,
          pincode: beneficiaryData.pincode || null,
          latitude: beneficiaryData.latitude || null,
          longitude: beneficiaryData.longitude || null,
          relationship: beneficiaryData.relationship || null,
          
          // Hook up parsed medical fields
          primaryPhysicianName: medicalData?.physicianName || null,
          primaryPhysicianPhone: medicalData?.physicianPhone || null,
          hobbiesInterests: medicalData?.hobbies || [],

          emergencyContacts: {
            create: finalEmergencyContacts.map((c: any) => ({
              id: generateUUID(),
              name: c.name,
              phone: c.phone,
              relationship: c.relation || 'Emergency',
              email: c.email || '',
            })),
          },
          conditions: conditionIds.length > 0 ? {
              create: conditionIds.map(cid => ({
                  id: generateUUID(),
                  conditionId: cid,
                  severity: 'moderate' as any
              }))
          } : undefined,
          medicationList: mappedMedications.length > 0 ? {
              create: mappedMedications
          } : undefined
        }
      });

      // 1c. Upsert BeneficiaryVitalConfigs
      const checkedVitalCodes = Object.entries(vitalsInput)
        .filter(([, checked]) => !!checked)
        .map(([code]) => code.trim().toUpperCase());

      if (checkedVitalCodes.length > 0) {
        const vitalDefs = await tx.vitalDefinition.findMany({
          where: { code: { in: checkedVitalCodes }, isActive: true }
        });

        for (const def of vitalDefs) {
          await tx.beneficiaryVitalConfig.upsert({
            where: {
              beneficiaryId_vitalDefinitionId: {
                beneficiaryId: beneficiary.id,
                vitalDefinitionId: def.id,
              }
            },
            update: { isActive: true },
            create: {
              id: generateUUID(),
              beneficiaryId: beneficiary.id,
              vitalDefinitionId: def.id,
              isActive: true,
              frequency: 'every_visit',
            }
          });
        }
      }
    }

    let pVersion = await tx.packageVersion.findFirst({
      where: { packageCode: subPackage.type, isLatest: true },
      include: { versionBenefits: { include: { benefit: true } } },
    });
    if (!pVersion) {
      await publishPackageVersion(tx, subPackage.id);
      pVersion = await tx.packageVersion.findFirst({
        where: { packageCode: subPackage.type, isLatest: true },
        include: { versionBenefits: { include: { benefit: true } } },
      });
    }
    const versionObj = pVersion!;

    // 2b. Compute subscription activation dates (chain from existing unexpired subscription if renewing early)
    const now = new Date();
    let existingActiveSub: any = null;
    if (beneficiary?.id) {
      existingActiveSub = await tx.subscription.findFirst({
        where: {
          beneficiaryId: beneficiary.id,
          isActive: true,
          endDate: { gte: now },
        },
        orderBy: { endDate: 'desc' },
      });
    }

    const startDate = existingActiveSub ? new Date(existingActiveSub.endDate) : now;
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);

    // Create active Subscription record (beneficiaryId is optional now)
    const subscription = await tx.subscription.create({
      data: {
        id: generateUUID(),
        subscriberId: userId,
        beneficiaryId: beneficiary ? beneficiary.id : null,
        packageType: subPackage.type,
        packageVersionId: versionObj.id,
        startDate: startDate,
        endDate: endDate,
        visitsTotal: subPackage.visitsPerWeek * 4 * months,
        hoursTotal: (subPackage.hoursPerMonth || 0) * months,
      },
      include: {
        package: true,
      }
    });

    // Promote user from prospect to subscriber if they are currently a prospect
    await tx.user.updateMany({
      where: { id: userId, role: 'prospect' },
      data: { role: 'subscriber' },
    });

    // 2c. Initialize snapshot benefit balances with frequency & tenure awareness
    if (versionObj.versionBenefits && versionObj.versionBenefits.length > 0) {
      await tx.subscriptionBenefitBalance.createMany({
        data: versionObj.versionBenefits.map((vb: any) => {
          let unitsToGrant = 0;
          if (vb.isUnlimited) {
            unitsToGrant = 999999;
          } else if (vb.unitsPeriod === 'yearly') {
            const minReq = vb.minSubscriptionMonths || 1;
            if (months >= minReq) {
              const years = Math.max(1, Math.floor(months / 12));
              unitsToGrant = vb.unitsIncluded * years;
            } else {
              unitsToGrant = 0;
            }
          } else if (vb.unitsPeriod === 'one_time') {
            unitsToGrant = vb.unitsIncluded;
          } else {
            // Default monthly benefit: scales by months purchased
            unitsToGrant = vb.unitsIncluded * months;
          }

          return {
            id: generateUUID(),
            subscriptionId: subscription.id,
            benefitId: vb.benefitId,
            snapshotBenefitName: vb.snapshotName,
            snapshotUnitLabel: vb.snapshotUnitLabel,
            totalUnits: unitsToGrant,
            availableUnits: unitsToGrant,
            usedUnits: 0,
            unit: vb.snapshotUnitLabel ? normalizeUnit(vb.snapshotUnitLabel) : 'visits',
          };
        }),
        skipDuplicates: true,
      });
    }

    // 2d. Initialize snapshot balances for optional selected Add-ons during package purchase
    if (selectedAddons && Array.isArray(selectedAddons) && selectedAddons.length > 0) {
      for (const addonItem of selectedAddons) {
        if (!addonItem.benefitId) continue;
        const q = Math.max(1, Math.floor(Number(addonItem.quantity) || 1));
        const benefit = await tx.benefit.findUnique({
          where: { id: addonItem.benefitId }
        });
        if (!benefit || !benefit.isAddon || !benefit.isActive) continue;

        const addUnits = (benefit.addonIncludedUnits || 1) * q;

        const existingBal = await tx.subscriptionBenefitBalance.findFirst({
          where: { subscriptionId: subscription.id, benefitId: benefit.id }
        });

        if (existingBal) {
          await tx.subscriptionBenefitBalance.update({
            where: { id: existingBal.id },
            data: {
              totalUnits: existingBal.totalUnits + addUnits,
              availableUnits: (existingBal.availableUnits || 0) + addUnits,
            }
          });
        } else {
          await tx.subscriptionBenefitBalance.create({
            data: {
              id: generateUUID(),
              subscriptionId: subscription.id,
              benefitId: benefit.id,
              snapshotBenefitName: benefit.name,
              snapshotUnitLabel: benefit.unitLabel,
              totalUnits: addUnits,
              availableUnits: addUnits,
              usedUnits: 0,
              reservedUnits: 0,
              unit: benefit.unitLabel ? normalizeUnit(benefit.unitLabel) : 'visits',
            }
          });
        }
      }
    }

    // 2e. Generate discrete monthly BenefitPeriods and initialize Period 1
    if (versionObj.versionBenefits && versionObj.versionBenefits.length > 0) {
      const periodBenefits = versionObj.versionBenefits.map((vb: any) => ({
        benefitId: vb.benefitId,
        name: vb.snapshotName || 'Benefit',
        unitLabel: vb.snapshotUnitLabel || null,
        monthlyUnits: vb.unitsIncluded || 1,
        allowRollover: vb.allowRollover ?? false,
        maxRolloverUnits: vb.maxRolloverUnits ?? null,
      }));

      await benefitPeriodManager.generatePeriodsForSubscription(
        subscription.id,
        months,
        startDate,
        periodBenefits,
        tx
      );

      // Level 2: If renewing an unexpired subscription, carry over eligible unused rollover units
      if (existingActiveSub) {
        await benefitPeriodManager.rolloverFromPreviousSubscription(
          existingActiveSub.id,
          subscription.id,
          tx
        );
      }
    }

    // 3. Generate Invoice for this purchase
    const invoiceNumber = await generateInvoiceNumber(tx);
    
    const customerState = beneficiaryData?.state || 'Haryana';
    
    // Prepare items for tax engine
    const taxItems: BenefitTaxItem[] = [
      {
        benefitId: undefined,
        name: `${subPackage.name}${durationMonths > 1 ? ` (${durationMonths} Months)` : ''}`,
        quantity: 1,
        unitPrice: packageBasePrice,
        gstRate: subPackage.gstRate ?? 18,
        hsnSacCode: subPackage.hsnSacCode || '998399',
        isGstExempt: subPackage.isGstExempt || false,
      }
    ];

    // Add Addons to invoice if any
    if (selectedAddons && Array.isArray(selectedAddons) && selectedAddons.length > 0) {
      for (const addonItem of selectedAddons) {
        if (!addonItem.benefitId) continue;
        const q = Math.max(1, Math.floor(Number(addonItem.quantity) || 1));
        const benefit = await tx.benefit.findUnique({
          where: { id: addonItem.benefitId }
        });
        if (benefit && benefit.isAddon && benefit.addonPrice) {
          taxItems.push({
            benefitId: benefit.id,
            name: `Add-on: ${benefit.name}`,
            quantity: q,
            unitPrice: benefit.addonDiscountPrice ?? benefit.addonPrice,
            gstRate: benefit.gstRate ?? 18,
            hsnSacCode: benefit.hsnSacCode || '998399',
            isGstExempt: benefit.isGstExempt || false,
          });
        }
      }
    }

    // Calculate invoice and tax amounts
    // NOTE: For now, if the total packageBasePrice is different from sum of unit prices, 
    // the invoice engine will handle it via discount logic or we could just trust the sum of unit prices.
    // To ensure exact matching with packageBasePrice + addons, we can adjust the total discount to enforce finalAmountPaid.
    
    const rawTotalBase = taxItems.reduce((acc, curr) => acc + (curr.unitPrice * curr.quantity), 0);
    // Determine how much discount to apply so that (rawTotalBase - actualDiscount) matches the expected base amount?
    // Actually, discountAmount is provided as an argument. Let's just pass it to the engine.
    
    const invoiceCalc = calculateItemizedInvoice(taxItems, discountAmount, customerState, 'Haryana');

    const invoice = await tx.invoice.create({
      data: {
        id: generateUUID(),
        invoiceNumber,
        invoiceType: 'SUBSCRIPTION',
        status: 'PAID',
        subscriberId: userId,
        beneficiaryId: beneficiary ? beneficiary.id : null,
        subscriptionId: subscription.id,
        baseAmount: invoiceCalc.baseAmount,
        discountAmount: invoiceCalc.discountAmount,
        taxAmount: invoiceCalc.taxAmount,
        totalAmount: invoiceCalc.totalAmount,
        placeOfSupply: customerState,
        cgstAmount: invoiceCalc.cgstAmount,
        sgstAmount: invoiceCalc.sgstAmount,
        igstAmount: invoiceCalc.igstAmount,
        issuedAt: new Date(),
        paidAt: new Date(),
        items: {
          create: invoiceCalc.items.map((item) => ({
            id: generateUUID(),
            benefitId: item.benefitId,
            description: item.description,
            hsnSacCode: item.hsnSacCode,
            taxRate: item.taxRate,
            isGstExempt: item.isGstExempt,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
          }))
        }
      }
    });

    // 4. Create a Payment record snapshotting details at enrollment
    const txId = paymentDetails?.razorpay_payment_id || `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const payment = await tx.payment.create({
      data: {
        id: generateUUID(),
        subscriberId: userId,
        beneficiaryId: beneficiary ? beneficiary.id : null,
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
        packageType: subPackage.type,
        packageVersionId: versionObj.id,
        snapshotPackageName: versionObj.name,
        snapshotBasePrice: packageBasePrice,
        snapshotBenefits: (versionObj.versionBenefits || []).map((vb: any) => ({
          name: vb.snapshotName,
          units: vb.unitsIncluded * months,
          unitLabel: vb.snapshotUnitLabel
        })),
        baseAmount: packageBasePrice,
        discountAmount: discountAmount,
        couponCode: couponCode || null,
        amountPaid: finalAmountPaid,
        currency: 'INR',
        paymentMethod: paymentDetails?.razorpay_payment_id ? 'Razorpay' : 'UPI',
        paymentStatus: 'success',
        transactionId: txId,
        gatewayName: paymentDetails?.razorpay_payment_id ? 'Razorpay' : null,
        gatewayOrderId: paymentDetails?.razorpay_order_id || null,
        gatewayPaymentId: paymentDetails?.razorpay_payment_id || null,
        gatewaySignature: paymentDetails?.razorpay_signature || null,
        planStartDate: subscription.startDate,
        planEndDate: subscription.endDate,
        isSubscriptionActive: true,
        enrolledAt: new Date(),
        paidAt: new Date(),
      }
    });

    // 4. Record Coupon Usage (if a coupon was successfully applied)
    if (appliedCouponId && couponCode) {
      const isRegularCoupon = await tx.coupon.findUnique({
        where: { id: appliedCouponId }
      });

      if (isRegularCoupon) {
        await tx.couponUsage.create({
          data: {
            id: generateUUID(),
            couponId: appliedCouponId,
            userId,
            subscriptionId: subscription.id,
            orderAmount: subPackage.basePrice,
            discountApplied: discountAmount
          }
        });

        await tx.coupon.update({
          where: { id: appliedCouponId },
          data: {
            usedCount: { increment: 1 }
          }
        });
      } else {
        // It must be a Volunteer Reward Gift Card Voucher!
        const isGiftCoupon = await tx.volunteerRewardCoupon.findUnique({
          where: { id: appliedCouponId }
        });
        if (isGiftCoupon && isGiftCoupon.status === 'ACTIVE') {
          await tx.volunteerRewardCoupon.update({
            where: { id: appliedCouponId },
            data: {
              status: 'CLAIMED',
              claimedByUserId: userId,
              claimedAt: new Date()
            }
          });
        }
      }
    }

    return {
      subscriptionId: subscription.id,
      packageName: subscription.package.name,
      beneficiaryName: beneficiary?.name || null,
      beneficiaryId: beneficiary?.id || null,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
    };
  });

  return {
    success: true,
    message: 'Subscription purchased successfully!',
    subscriptionId: result.subscriptionId,
    package: result.packageName,
    beneficiaryName: result.beneficiaryName,
    beneficiaryId: result.beneficiaryId,
    invoiceId: result.invoiceId,
    invoiceNumber: result.invoiceNumber,
  };
};

/**
 * Links a beneficiary to an existing unlinked subscription for a subscriber.
 * This is called after checkout when the user is prompted to enroll their first beneficiary.
 */
export const linkBeneficiaryToSubscription = async (
  userId: string,
  beneficiaryData: {
    name: string;
    age: number;
    gender: string;
    address: string;
    flatPlot?: string;
    streetArea?: string;
    landmark?: string;
    city?: string;
    state?: string;
    pincode?: string;
    latitude?: number;
    longitude?: number;
    relationship: string;
    phone?: string;
    dob?: string;
    maritalStatus?: string;
    devPassword?: string;
  },
  medicalData?: any,
  emergencyContactsRaw?: any,
  preferencesData?: any
) => {
  // 1. Find the active unlinked subscription for this subscriber
  const unlinkedSubscription = await prisma.subscription.findFirst({
    where: { subscriberId: userId, isActive: true, beneficiaryId: null },
    orderBy: { createdAt: 'desc' },
    include: { package: true }
  });

  let subIdToLink: string | null = unlinkedSubscription?.id || null;
  if (!subIdToLink) {
    const anyActiveSub = await prisma.subscription.findFirst({
      where: { subscriberId: userId, isActive: true },
      orderBy: { createdAt: 'desc' }
    });
    if (anyActiveSub) {
      subIdToLink = anyActiveSub.id;
    }
  }

  const beneficiaryName = beneficiaryData.name || (beneficiaryData as any).fullName || 'Beneficiary';
  const dobDate = parseDob(beneficiaryData.dob);

  // 2. Find or create beneficiary user
  let beneficiaryUser: any = null;
  let beneficiaryPhone = '';
  if (beneficiaryData.phone) {
    beneficiaryPhone = beneficiaryData.phone.replace(/\D/g, '').slice(-10);
    if (beneficiaryPhone) {
      const existingUser = await prisma.user.findUnique({ where: { phone: beneficiaryPhone } });
      if (existingUser) {
        beneficiaryUser = existingUser;
      }
    }
  }

  if (!beneficiaryPhone) {
    throw new Error('Beneficiary phone number is required.');
  }

  if (!beneficiaryUser) {
    // Hash devPassword if provided (default '654321' set on frontend)
    let passwordHash: string | undefined = undefined;
    if (beneficiaryData.devPassword) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(String(beneficiaryData.devPassword), salt);
    }

    beneficiaryUser = await prisma.user.create({
      data: {
        id: generateUUID(),
        phone: beneficiaryPhone,
        name: beneficiaryName,
        role: 'beneficiary',
        age: calculateAge(dobDate, beneficiaryData.age),
        dateOfBirth: dobDate,
        ...(passwordHash ? { password: passwordHash } : {})
      }
    });
  }

  // 3. Parse medical conditions and medications
  const conditionIds: string[] = [];
  if (medicalData?.conditions && Array.isArray(medicalData.conditions)) {
    for (const condName of medicalData.conditions) {
      const slug = condName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      try {
        const condition = await prisma.medicalCondition.upsert({
          where: { slug },
          update: {},
          create: { id: generateUUID(), name: condName, slug, category: 'General' }
        });
        conditionIds.push(condition.id);
      } catch (e) { console.error('Condition Error', e); }
    }
  }

  const mappedMedications: any[] = [];
  if (medicalData?.medications && Array.isArray(medicalData.medications)) {
    for (const med of medicalData.medications) {
      let freqEnum = 'once_daily';
      const lowerFreq = String(med.frequency || '').toLowerCase();
      if (lowerFreq.includes('twice') || lowerFreq.includes('2')) freqEnum = 'twice_daily';
      else if (lowerFreq.includes('thrice') || lowerFreq.includes('3')) freqEnum = 'thrice_daily';
      else if (lowerFreq.includes('needed')) freqEnum = 'as_needed';
      mappedMedications.push({
        id: generateUUID(),
        name: med.name || 'Unknown',
        dosage: med.dosage || '',
        frequency: freqEnum as any,
        timeSlots: med.timesPerDay || [],
        setReminders: !!med.setReminders,
        startDate: new Date()
      });
    }
  }

  // 4. Parse emergency contacts
  const finalEmergencyContacts: any[] = [];
  if (emergencyContactsRaw) {
    if (emergencyContactsRaw.primaryName || emergencyContactsRaw.primaryPhone) {
      finalEmergencyContacts.push({
        name: emergencyContactsRaw.primaryName || 'Primary Contact',
        phone: String(emergencyContactsRaw.primaryPhone || '').replace(/\D/g, '').slice(-10) || '0000000000',
        relation: emergencyContactsRaw.primaryRelation || 'Primary Contact',
        email: emergencyContactsRaw.primaryEmail || '',
      });
    }
    if (emergencyContactsRaw.secondaryName || emergencyContactsRaw.secondaryPhone) {
      finalEmergencyContacts.push({
        name: emergencyContactsRaw.secondaryName || 'Secondary Contact',
        phone: String(emergencyContactsRaw.secondaryPhone || '').replace(/\D/g, '').slice(-10) || '0000000000',
        relation: emergencyContactsRaw.secondaryRelation || 'Secondary Contact',
        email: emergencyContactsRaw.secondaryEmail || '',
      });
    }
  }

  if (finalEmergencyContacts.length === 0) {
    const subscriberUser = await prisma.user.findUnique({ where: { id: userId } });
    finalEmergencyContacts.push({
      name: subscriberUser?.name || 'Subscriber',
      phone: subscriberUser?.phone || '0000000000',
      relation: beneficiaryData.relationship || 'Subscriber',
    });
  }

  const vitalsInput = medicalData?.vitals || {};

  // 5. Run link operation in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // 5a. Find or create beneficiary record
    let beneficiary = await tx.beneficiary.findUnique({
      where: { userId: beneficiaryUser.id }
    });

    if (!beneficiary) {
      beneficiary = await tx.beneficiary.create({
        data: {
          id: generateUUID(),
          userId: beneficiaryUser.id,
          subscriberId: userId,
          name: beneficiaryName,
          age: calculateAge(dobDate, beneficiaryData.age),
          dateOfBirth: dobDate,
          gender: (String(beneficiaryData.gender).toLowerCase().includes('male') && !String(beneficiaryData.gender).toLowerCase().includes('female')) ? 'male' : String(beneficiaryData.gender).toLowerCase().includes('female') ? 'female' : 'prefer_not_to_say',
          address: beneficiaryData.address || 'Not provided',
          flatPlot: beneficiaryData.flatPlot || null,
          streetArea: beneficiaryData.streetArea || null,
          landmark: beneficiaryData.landmark || null,
          city: beneficiaryData.city || null,
          state: beneficiaryData.state || null,
          pincode: beneficiaryData.pincode || null,
          latitude: beneficiaryData.latitude || null,
          longitude: beneficiaryData.longitude || null,
          relationship: beneficiaryData.relationship || null,
          primaryPhysicianName: medicalData?.physicianName || null,
          primaryPhysicianPhone: medicalData?.physicianPhone || null,
          hobbiesInterests: medicalData?.hobbies || [],
          emergencyContacts: {
            create: finalEmergencyContacts.map((c: any) => ({
              id: generateUUID(),
              name: c.name,
              phone: c.phone,
              relationship: c.relation || 'Emergency',
              email: c.email || '',
            }))
          },
          conditions: conditionIds.length > 0 ? {
            create: conditionIds.map(cid => ({ id: generateUUID(), conditionId: cid, severity: 'moderate' as any }))
          } : undefined,
          medicationList: mappedMedications.length > 0 ? { create: mappedMedications } : undefined
        }
      });
    }

    // 5b. Link subscription and payments to the new beneficiary
    if (subIdToLink) {
      const existingSub = await tx.subscription.findUnique({
        where: { id: subIdToLink },
        include: { 
          package: true, 
          packageVersion: {
            include: {
              versionBenefits: true
            }
          }
        }
      });

      const newStart = new Date();
      const newEnd = new Date(newStart);
      let months = 1;
      if (existingSub?.startDate && existingSub?.endDate) {
        const diffDays = Math.round((new Date(existingSub.endDate).getTime() - new Date(existingSub.startDate).getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 300) months = 12;
        else if (diffDays >= 150) months = 6;
        else if (diffDays >= 70) months = 3;
        else months = 1;
      } else if (existingSub?.duration === 'annual') {
        months = 12;
      } else if (existingSub?.duration === 'six_months') {
        months = 6;
      } else if (existingSub?.packageVersion?.durationMonths || existingSub?.package?.durationMonths) {
        months = existingSub?.packageVersion?.durationMonths || existingSub?.package?.durationMonths || 1;
      }
      newEnd.setMonth(newEnd.getMonth() + months);

      await tx.subscription.update({
        where: { id: subIdToLink },
        data: { 
          beneficiaryId: beneficiary.id,
          startDate: newStart,
          endDate: newEnd,
          isActive: true,
        }
      });

      await tx.payment.updateMany({
        where: { subscriptionId: subIdToLink },
        data: { 
          beneficiaryId: beneficiary.id,
          planStartDate: newStart,
          planEndDate: newEnd
        }
      });

      if (existingSub?.packageVersion?.versionBenefits && existingSub.packageVersion.versionBenefits.length > 0) {
        const periodBenefits = existingSub.packageVersion.versionBenefits.map((vb: any) => ({
          benefitId: vb.benefitId,
          name: vb.snapshotName || 'Benefit',
          unitLabel: vb.snapshotUnitLabel || null,
          monthlyUnits: vb.unitsIncluded || 1,
          allowRollover: vb.allowRollover ?? false,
          maxRolloverUnits: vb.maxRolloverUnits ?? null,
        }));

        await benefitPeriodManager.generatePeriodsForSubscription(
          subIdToLink,
          months,
          newStart,
          periodBenefits,
          tx
        );
      }
    }

    // Promote user from prospect to subscriber if they are currently a prospect
    await tx.user.updateMany({
      where: { id: userId, role: 'prospect' },
      data: { role: 'subscriber' },
    });

    // 5c. Upsert vital configs
    const checkedVitalCodes = Object.entries(vitalsInput)
      .filter(([, checked]) => !!checked)
      .map(([code]) => code.trim().toUpperCase());

    if (checkedVitalCodes.length > 0) {
      const vitalDefs = await tx.vitalDefinition.findMany({
        where: { code: { in: checkedVitalCodes }, isActive: true }
      });
      for (const def of vitalDefs) {
        await tx.beneficiaryVitalConfig.upsert({
          where: { beneficiaryId_vitalDefinitionId: { beneficiaryId: beneficiary.id, vitalDefinitionId: def.id } },
          update: { isActive: true },
          create: { id: generateUUID(), beneficiaryId: beneficiary.id, vitalDefinitionId: def.id, isActive: true, frequency: 'every_visit' }
        });
      }
    }

    // 5d. Save schedule preferences (preferredTiming → preferredSlot)
    if (preferencesData) {
      const preferredSlot = preferencesData.preferredTiming || preferencesData.preferredSlot || 'morning';
      const preferredDays = Array.isArray(preferencesData.preferredDays) ? preferencesData.preferredDays : [];
      const avoidDays = Array.isArray(preferencesData.avoidDays) ? preferencesData.avoidDays : [];
      await tx.schedulePreference.upsert({
        where: { beneficiaryId: beneficiary.id },
        update: {
          preferredSlot,
          preferredDays,
          avoidDays,
          preferredTimeFrom: preferencesData.preferredTimeFrom || null,
          preferredTimeTo: preferencesData.preferredTimeTo || null,
          preferFemaleCc: !!preferencesData.preferFemaleCc,
          languagePreference: preferencesData.languagePreference || null,
          specialNotes: preferencesData.specialNotes || null,
        },
        create: {
          id: generateUUID(),
          beneficiaryId: beneficiary.id,
          preferredSlot,
          preferredDays,
          avoidDays,
          preferredTimeFrom: preferencesData.preferredTimeFrom || null,
          preferredTimeTo: preferencesData.preferredTimeTo || null,
          preferFemaleCc: !!preferencesData.preferFemaleCc,
          languagePreference: preferencesData.languagePreference || null,
          specialNotes: preferencesData.specialNotes || null,
        }
      });
    }

    return { beneficiaryId: beneficiary.id, beneficiaryName: beneficiary.name };
  });

  return {
    success: true,
    message: 'Beneficiary enrolled and linked to subscription successfully!',
    beneficiaryId: result.beneficiaryId,
    beneficiaryName: result.beneficiaryName,
    subscriptionId: subIdToLink
  };
};

export const getUserDashboard = async (userId: string) => {
  // Find all active subscriptions for this specific user
  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      subscriberId: userId,
      isActive: true,
    },
    include: {
      package: true,
    }
  });

  // Find all beneficiaries linked to this user
  const beneficiaries = await prisma.beneficiary.findMany({
    where: {
      subscriberId: userId
    }
  });

  return {
    success: true,
    activeSubscriptions,
    beneficiaries
  };
};

export const activateSubscription = async (
  userId: string,
  beneficiaryId: string,
  beneficiaryData: {
    name: string;
    age: number;
    gender: string;
    address: string;
    flatPlot?: string;
    streetArea?: string;
    landmark?: string;
    city?: string;
    state?: string;
    pincode?: string;
    latitude?: number;
    longitude?: number;
    relationship: string;
    phone: string;
    dob?: string;
    maritalStatus?: string;
  },
  medicalData?: any,
  emergencyContactsRaw?: any
) => {
  // 1. Find subscription for this beneficiary (or any subscription for this subscriber)
  let existingSub = await prisma.subscription.findFirst({
    where: { beneficiaryId, isActive: false },
    orderBy: { createdAt: 'desc' },
    include: {
      package: true,
      packageVersion: {
        include: {
          versionBenefits: true
        }
      }
    }
  });

  if (!existingSub) {
    existingSub = await prisma.subscription.findFirst({
      where: { beneficiaryId },
      orderBy: { createdAt: 'desc' },
      include: {
        package: true,
        packageVersion: {
          include: {
            versionBenefits: true
          }
        }
      }
    });
  }

  if (!existingSub) {
    existingSub = await prisma.subscription.findFirst({
      where: { subscriberId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        package: true,
        packageVersion: {
          include: {
            versionBenefits: true
          }
        }
      }
    });
  }

  const dobDate = parseDob(beneficiaryData.dob);

  // 2. Medical Data Parsing
  const conditionIds: string[] = [];
  if (medicalData?.conditions && Array.isArray(medicalData.conditions)) {
      for (const condName of medicalData.conditions) {
          const slug = condName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          try {
              const condition = await prisma.medicalCondition.upsert({
                  where: { slug },
                  update: {},
                  create: {
                      id: generateUUID(),
                      name: condName,
                      slug: slug,
                      category: "General"
                   }
              });
              conditionIds.push(condition.id);
          } catch(e) { console.error("Condition Error", e); }
      }
  }

  const mappedMedications: any[] = [];
  if (medicalData?.medications && Array.isArray(medicalData.medications)) {
      for (const med of medicalData.medications) {
          let freqEnum = 'once_daily';
          const lowerFreq = String(med.frequency || '').toLowerCase();
          if (lowerFreq.includes('twice') || lowerFreq.includes('2')) freqEnum = 'twice_daily';
          else if (lowerFreq.includes('thrice') || lowerFreq.includes('3')) freqEnum = 'thrice_daily';
          else if (lowerFreq.includes('needed')) freqEnum = 'as_needed';

          mappedMedications.push({
              id: generateUUID(),
              beneficiaryId,
              name: med.name || 'Unknown',
              dosage: med.dosage || '',
              frequency: freqEnum as any,
              timeSlots: med.timesPerDay || [],
              setReminders: !!med.setReminders,
              instructions: med.instructions || null,
              startDate: med.startDate ? (parseDob(med.startDate) || new Date()) : new Date(),
              endDate: med.endDate ? parseDob(med.endDate) : null,
              totalDays: med.totalDays ? parseInt(med.totalDays, 10) : null
          });
      }
  }

  // 3. Emergency Contacts Parsing
  const finalEmergencyContacts: any[] = [];
  if (emergencyContactsRaw) {
    if (emergencyContactsRaw.primaryName || emergencyContactsRaw.primaryPhone) {
      finalEmergencyContacts.push({
        name: emergencyContactsRaw.primaryName || 'Primary Contact',
        phone: String(emergencyContactsRaw.primaryPhone || '').replace(/\D/g, '').slice(-10) || '0000000000',
        relation: emergencyContactsRaw.primaryRelation || 'Primary Contact',
        email: emergencyContactsRaw.primaryEmail || '',
      });
    }
    if (emergencyContactsRaw.secondaryName || emergencyContactsRaw.secondaryPhone) {
      finalEmergencyContacts.push({
        name: emergencyContactsRaw.secondaryName || 'Secondary Contact',
        phone: String(emergencyContactsRaw.secondaryPhone || '').replace(/\D/g, '').slice(-10) || '0000000000',
        relation: emergencyContactsRaw.secondaryRelation || 'Secondary Contact',
        email: emergencyContactsRaw.secondaryEmail || '',
      });
    }
  }

  const bDataAny = beneficiaryData as any;
  if (finalEmergencyContacts.length === 0 && bDataAny.emergencyContacts && Array.isArray(bDataAny.emergencyContacts)) {
    for (const ec of bDataAny.emergencyContacts) {
      if (ec.name && ec.phone) {
        finalEmergencyContacts.push({
          name: ec.name,
          phone: String(ec.phone).replace(/\D/g, '').slice(-10),
          relation: ec.relation || 'Emergency',
          email: ec.email || '',
        });
      }
    }
  }

  if (finalEmergencyContacts.length === 0 && medicalData && (medicalData as any).emergencyContacts && Array.isArray((medicalData as any).emergencyContacts)) {
    const rawEC = (medicalData as any).emergencyContacts[0];
    if (rawEC && rawEC.name && rawEC.phone) {
      finalEmergencyContacts.push({
        name: rawEC.name,
        phone: String(rawEC.phone).replace(/\D/g, '').slice(-10),
        relation: rawEC.relation || 'Emergency',
        email: rawEC.secondaryEmail || '',
      });
    }
  }

  if (finalEmergencyContacts.length === 0) {
    const subscriberUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    finalEmergencyContacts.push({
      name: subscriberUser?.name || 'Subscriber',
      phone: subscriberUser?.phone || '0000000000',
      relation: beneficiaryData.relationship || 'Subscriber',
    });
  }

  const vitalsInput = medicalData?.vitals || {};

  return prisma.$transaction(async (tx) => {
    // A. Update Beneficiary profile
    const beneficiary = await tx.beneficiary.update({
      where: { id: beneficiaryId },
      data: {
        name: beneficiaryData.name,
        age: parseInt(String(beneficiaryData.age || 65), 10),
        dateOfBirth: dobDate,
        gender: (String(beneficiaryData.gender).toLowerCase().includes('male') && !String(beneficiaryData.gender).toLowerCase().includes('female')) ? 'male' : String(beneficiaryData.gender).toLowerCase().includes('female') ? 'female' : 'prefer_not_to_say',
        address: beneficiaryData.address || "Not provided",
        flatPlot: beneficiaryData.flatPlot || null,
        streetArea: beneficiaryData.streetArea || null,
        landmark: beneficiaryData.landmark || null,
        city: beneficiaryData.city || null,
        state: beneficiaryData.state || null,
        pincode: beneficiaryData.pincode || null,
        latitude: beneficiaryData.latitude || null,
        longitude: beneficiaryData.longitude || null,
        relationship: beneficiaryData.relationship || null,
        maritalStatus: beneficiaryData.maritalStatus || null,
        verificationStatus: "verified", // Mark as verified!
        isActive: true,

        primaryPhysicianName: medicalData?.physicianName || null,
        primaryPhysicianPhone: medicalData?.physicianPhone || null,
        hobbiesInterests: medicalData?.hobbies || [],
      }
    });

    // B. Clean and sync medications
    await tx.medication.deleteMany({ where: { beneficiaryId } });
    if (mappedMedications.length > 0) {
      await tx.medication.createMany({ data: mappedMedications });
    }

    // C. Clean and sync conditions
    await tx.beneficiaryCondition.deleteMany({ where: { beneficiaryId } });
    if (conditionIds.length > 0) {
      await tx.beneficiaryCondition.createMany({
        data: conditionIds.map(cid => ({
          id: generateUUID(),
          beneficiaryId,
          conditionId: cid,
          severity: 'moderate' as any
        }))
      });
    }

    // D. Clean and sync emergency contacts
    await tx.emergencyContact.deleteMany({ where: { beneficiaryId } });
    if (finalEmergencyContacts.length > 0) {
      await tx.emergencyContact.createMany({
        data: finalEmergencyContacts.map((c: any) => ({
          id: generateUUID(),
          beneficiaryId,
          name: c.name,
          phone: c.phone,
          relationship: c.relation || 'Emergency',
          email: c.email || '',
        }))
      });
    }

    // E. Sync Vitals Config
    const checkedVitalCodes = Object.entries(vitalsInput)
      .filter(([, checked]) => !!checked)
      .map(([code]) => code.trim().toUpperCase());

    if (checkedVitalCodes.length > 0) {
      const vitalDefs = await tx.vitalDefinition.findMany({
        where: { code: { in: checkedVitalCodes }, isActive: true }
      });

      for (const def of vitalDefs) {
        await tx.beneficiaryVitalConfig.upsert({
          where: {
            beneficiaryId_vitalDefinitionId: {
              beneficiaryId,
              vitalDefinitionId: def.id,
            }
          },
          update: { isActive: true },
          create: {
            id: generateUUID(),
            beneficiaryId,
            vitalDefinitionId: def.id,
            isActive: true,
            frequency: 'every_visit',
          }
        });
      }
    }

    // F. Activate Subscription (or create fallback subscription if none existed)
    let subscription: any = null;
    let pVersion: any = existingSub?.packageVersion || null;
    let start = new Date();
    let end = new Date(start);
    let months = 1;

    if (existingSub) {
      if (!pVersion && existingSub.packageType) {
        pVersion = await tx.packageVersion.findFirst({
          where: { packageCode: existingSub.packageType, isLatest: true },
          include: { versionBenefits: true }
        });
      }

      if (existingSub.startDate && existingSub.endDate) {
        const diffDays = Math.round((new Date(existingSub.endDate).getTime() - new Date(existingSub.startDate).getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 300) months = 12;
        else if (diffDays >= 150) months = 6;
        else if (diffDays >= 70) months = 3;
        else months = 1;
      } else if (existingSub.duration === 'annual') {
        months = 12;
      } else if (existingSub.duration === 'six_months') {
        months = 6;
      } else if (pVersion?.durationMonths || existingSub.packageVersion?.durationMonths || existingSub.package?.durationMonths) {
        months = pVersion?.durationMonths || existingSub.packageVersion?.durationMonths || existingSub.package?.durationMonths || 1;
      }
      end.setMonth(end.getMonth() + months);

      subscription = await tx.subscription.update({
        where: { id: existingSub.id },
        data: {
          beneficiaryId,
          packageVersionId: pVersion?.id || existingSub.packageVersionId || null,
          isActive: true,
          startDate: start,
          endDate: end,
        },
        include: {
          packageVersion: {
            include: { versionBenefits: true }
          }
        }
      });
    } else {
      const defaultPackage = await tx.subscriptionPackage.findFirst({ where: { isActive: true } });
      const pkgType = defaultPackage?.type || 'silver';

      pVersion = await tx.packageVersion.findFirst({
        where: { packageCode: pkgType, isLatest: true },
        include: { versionBenefits: true }
      });

      months = pVersion?.durationMonths || defaultPackage?.durationMonths || 1;
      end.setMonth(end.getMonth() + months);

      subscription = await tx.subscription.create({
        data: {
          id: generateUUID(),
          subscriberId: userId,
          beneficiaryId,
          packageType: pkgType,
          packageVersionId: pVersion?.id || null,
          duration: 'monthly' as any,
          startDate: start,
          endDate: end,
          isActive: true,
          visitsTotal: defaultPackage?.visitsPerWeek ? defaultPackage.visitsPerWeek * 4 : 4,
          hoursTotal: defaultPackage?.hoursPerMonth || 0,
        },
        include: {
          packageVersion: {
            include: { versionBenefits: true }
          }
        }
      });
    }

    const versionObj = pVersion || subscription?.packageVersion || existingSub?.packageVersion;

    // G. Create Benefit Balances if they don't exist
    if (subscription && versionObj?.versionBenefits && versionObj.versionBenefits.length > 0) {
      await tx.subscriptionBenefitBalance.createMany({
        data: versionObj.versionBenefits.map((vb: any) => ({
          subscriptionId: subscription.id,
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

      const periodBenefits = versionObj.versionBenefits.map((vb: any) => ({
        benefitId: vb.benefitId,
        name: vb.snapshotName || 'Benefit',
        unitLabel: vb.snapshotUnitLabel || null,
        monthlyUnits: vb.unitsIncluded || 1,
        allowRollover: vb.allowRollover ?? false,
        maxRolloverUnits: vb.maxRolloverUnits ?? null,
      }));

      await benefitPeriodManager.generatePeriodsForSubscription(
        subscription.id,
        months,
        start,
        periodBenefits,
        tx
      );
    }

    // H. Create Payment record
    let invoiceNumber: string | null = null;
    if (subscription) {
      invoiceNumber = `ADM-ACT-${Date.now()}`;
      await tx.payment.create({
        data: {
          invoiceNumber,
          subscriberId: userId,
          beneficiaryId,
          subscriptionId: subscription.id,
          packageType: subscription.packageType || 'silver',
          packageVersionId: versionObj?.id || subscription.packageVersionId || null,
          snapshotPackageName: versionObj?.name || 'Prepaid Care Package',
          snapshotBasePrice: versionObj?.basePrice || 0,
          snapshotBenefits: versionObj?.versionBenefits?.map((vb: any) => ({
            name: vb.snapshotName,
            units: vb.unitsIncluded,
            unitLabel: vb.snapshotUnitLabel
          })) || [],
          baseAmount: versionObj?.basePrice || 0,
          amountPaid: versionObj?.basePrice || 0,
          discountAmount: 0,
          paymentMethod: 'csa_prepaid',
          paymentStatus: 'success',
          planStartDate: start,
          planEndDate: end,
          paidAt: new Date(),
          enrolledAt: new Date(),
          isSubscriptionActive: true,
          gatewayName: 'csa_consent_activation',
        }
      });
    }

    // I. Log Activity
    await tx.activityLog.create({
      data: {
        id: generateUUID(),
        userId,
        type: 'SUBSCRIPTION',
        action: 'ACTIVATED',
        details: {
          subscriptionId: subscription?.id || null,
          beneficiaryId,
          invoiceNumber
        } as any
      }
    });

    // Promote user from prospect to subscriber if they are currently a prospect
    await tx.user.updateMany({
      where: { id: userId, role: 'prospect' },
      data: { role: 'subscriber' },
    });

    return { subscription, beneficiary };
  });
};

export const getSubscriptionPackages = async (regionId?: string) => {
  let packages = await prisma.subscriptionPackage.findMany({
    where: {
      isActive: true,
      OR: [
        { isGlobal: true },
        regionId ? {
          isGlobal: false,
          packageRegions: {
            some: { regionId }
          }
        } : null
      ].filter(Boolean) as any
    },
    include: {
      packageRegions: {
        include: { region: true }
      },
      packageBenefits: {
        include: {
          benefit: {
            include: {
              benefitType: true
            }
          }
        }
      }
    },
    orderBy: { basePrice: 'asc' }
  });

  // Map Prisma relations to the format expected by Admin Frontend
  const mappedPackages = packages.map((pkg: any) => ({
    ...pkg,
    regions: pkg.packageRegions?.map((pr: any) => pr.region) || [],
    regionIds: pkg.packageRegions?.map((pr: any) => pr.regionId) || [],
    benefits: pkg.packageBenefits?.map((pb: any) => ({
      ...pb,
      benefitId: pb.benefitId,
      monthlyUnits: pb.unitsIncluded,
      unitsIncluded: pb.unitsIncluded,
    })) || []
  }));

  return mappedPackages;
};


