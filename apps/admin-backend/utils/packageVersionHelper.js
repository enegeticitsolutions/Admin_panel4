const normalizeUnit = (unitLabel) => {
  if (!unitLabel) return 'visits';
  const clean = unitLabel.replace(/^per\s+/i, '').trim().toLowerCase();
  if (clean === 'visit') return 'visits';
  if (clean === 'hour') return 'hours';
  if (clean === 'session') return 'sessions';
  if (clean === 'test') return 'tests';
  if (clean.endsWith('s')) return clean;
  return clean + 's';
};

/**
 * Creates a new PackageVersion and PackageVersionBenefit records for the given SubscriptionPackage.
 * Marks any previous versions of this package as isLatest = false.
 * Creates or updates a PackageVersion and PackageVersionBenefit records for the given SubscriptionPackage.
 * Only increments the version number when benefit composition (benefits, units) actually changes.
 * Pure pricing/metadata edits update the current latest version without bumping version number.
 * 
 * @param {object} tx - Prisma transaction client
 * @param {string} packageId - The UUID of the SubscriptionPackage
 * @param {object} [options] - Options e.g. { force: true } to force a new version
 * @returns {Promise<object>} The updated or newly created PackageVersion
 */
async function publishPackageVersion(tx, packageId, options = {}) {
  // 1. Fetch SubscriptionPackage with benefits
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

  // 2. Check if a latest version already exists
  const latestVersion = await tx.packageVersion.findFirst({
    where: { packageCode, isLatest: true },
    include: {
      versionBenefits: true,
    },
  });

  if (latestVersion && !options.force) {
    // Compare benefit composition between pkg.packageBenefits and latestVersion.versionBenefits
    const curBenefits = pkg.packageBenefits || [];
    const prevBenefits = latestVersion.versionBenefits || [];

    let benefitsChanged = curBenefits.length !== prevBenefits.length;

    if (!benefitsChanged) {
      const curSorted = [...curBenefits].sort((a, b) => a.benefitId.localeCompare(b.benefitId));
      const prevSorted = [...prevBenefits].sort((a, b) => a.benefitId.localeCompare(b.benefitId));

      for (let i = 0; i < curSorted.length; i++) {
        const c = curSorted[i];
        const p = prevSorted[i];
        if (
          c.benefitId !== p.benefitId ||
          c.unitsIncluded !== p.unitsIncluded ||
          c.unitsPeriod !== p.unitsPeriod ||
          c.allocationBasis !== p.allocationBasis ||
          c.minSubscriptionMonths !== p.minSubscriptionMonths ||
          c.allowRollover !== p.allowRollover ||
          c.maxRolloverUnits !== p.maxRolloverUnits ||
          c.isUnlimited !== p.isUnlimited
        ) {
          benefitsChanged = true;
          break;
        }
      }
    }

    // If benefit composition did NOT change (e.g. only price / mrp / description was edited),
    // update the live metadata on latestVersion without bumping version number!
    if (!benefitsChanged) {
      const updatedLatest = await tx.packageVersion.update({
        where: { id: latestVersion.id },
        data: {
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
          isActive: pkg.isActive,
          sortOrder: pkg.sortOrder,
          discountPercentage: pkg.discountPercentage,
          discountThreeMonths: pkg.discountThreeMonths,
          discountSixMonths: pkg.discountSixMonths,
          discountAnnual: pkg.discountAnnual,
          priceThreeMonths: pkg.priceThreeMonths,
          priceSixMonths: pkg.priceSixMonths,
          priceTwelveMonths: pkg.priceTwelveMonths,
          miscellaneousCost: pkg.miscellaneousCost,
        },
      });
      console.log(`[publishPackageVersion] Benefits unchanged for ${packageCode}. Updated existing version ${latestVersion.version} (id: ${latestVersion.id}) with new pricing/metadata.`);
      return updatedLatest;
    }
  }

  // 3. Benefit composition changed (or first time publication) -> Increment version & publish new snapshot
  const maxVersionRecord = await tx.packageVersion.findFirst({
    where: { packageCode },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const nextVersion = maxVersionRecord ? maxVersionRecord.version + 1 : 1;

  // Mark all previous versions as not latest
  await tx.packageVersion.updateMany({
    where: { packageCode, isLatest: true },
    data: { isLatest: false },
  });

  // Create the new PackageVersion record
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
      discountThreeMonths: pkg.discountThreeMonths,
      discountSixMonths: pkg.discountSixMonths,
      discountAnnual: pkg.discountAnnual,
      priceThreeMonths: pkg.priceThreeMonths,
      priceSixMonths: pkg.priceSixMonths,
      priceTwelveMonths: pkg.priceTwelveMonths,
      miscellaneousCost: pkg.miscellaneousCost,
    },
  });

  // Create PackageVersionBenefit records copying from current package benefits
  if (pkg.packageBenefits.length > 0) {
    await tx.packageVersionBenefit.createMany({
      data: pkg.packageBenefits.map((pb) => ({
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
        showUnit: pb.showUnit !== undefined ? pb.showUnit : true,
        displayOrder: pb.displayOrder,
        notes: pb.notes,
      })),
    });
  }

  console.log(`[publishPackageVersion] Published new ${packageCode} version ${nextVersion} (id: ${newVersion.id}) with ${pkg.packageBenefits.length} benefits (benefit composition changed).`);
  return newVersion;
}

module.exports = {
  publishPackageVersion,
};
