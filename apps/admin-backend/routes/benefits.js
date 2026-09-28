const express = require('express');
const router = express.Router();
const path = require('path');
const { prisma } = require('../lib/prisma');

// GET /api/benefits — list all benefits (with type info & region targeting)
router.get('/', async (req, res) => {
  const { activeOnly } = req.query;
  try {
    const where = {};
    if (activeOnly === 'true') where.isActive = true;

    const benefits = await prisma.benefit.findMany({
      where,
      orderBy: [{ benefitTypeId: 'asc' }, { displayOrder: 'asc' }],
      include: {
        benefitType: { select: { id: true, name: true, iconCode: true } },
        benefitRegions: { include: { region: true } },
      },
    });

    const formatted = benefits.map(b => ({
      ...b,
      regionIds: (b.benefitRegions || []).map(br => br.regionId),
      regions: (b.benefitRegions || []).map(br => br.region),
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('GET benefits error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/benefits/:id
router.get('/:id', async (req, res) => {
  try {
    const benefit = await prisma.benefit.findUnique({
      where: { id: req.params.id },
      include: {
        benefitType: true,
        benefitRegions: { include: { region: true } },
      },
    });
    if (!benefit)
      return res
        .status(404)
        .json({ success: false, message: 'Benefit not found' });

    const formatted = {
      ...benefit,
      regionIds: (benefit.benefitRegions || []).map(br => br.regionId),
      regions: (benefit.benefitRegions || []).map(br => br.region),
    };

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/benefits — create
router.post('/', async (req, res) => {
  const {
    benefitTypeId,
    code,
    name,
    description,
    isChargeable,
    unitCost,
    cost,
    unitLabel,
    defaultUnits,
    displayOrder,
    isAddon,
    addonPrice,
    addonDiscountPrice,
    addonIncludedUnits,
    isGlobal = true,
    regionIds = [],
    taxCategory,
    gstRate,
    hsnSacCode,
    isGstExempt,
  } = req.body;
  if (!benefitTypeId || !name) {
    return res
      .status(400)
      .json({ success: false, message: 'benefitTypeId and name are required' });
  }
  try {
    const benefit = await prisma.$transaction(async (tx) => {
      const created = await tx.benefit.create({
        data: {
          benefitTypeId,
          code: code ? code.trim().toUpperCase() : null,
          name,
          description,
          isChargeable: isChargeable ?? false,
          unitCost: isChargeable ? (unitCost ?? null) : null,
          cost: isChargeable ? (cost ?? null) : null,
          unitLabel,
          defaultUnits: defaultUnits ?? 1,
          displayOrder: displayOrder ?? 0,
          isAddon: isAddon ?? false,
          addonPrice: addonPrice ?? null,
          addonDiscountPrice: addonDiscountPrice ?? null,
          addonIncludedUnits: addonIncludedUnits ?? 1,
          isGlobal: isGlobal ?? true,
          taxCategory: taxCategory ?? 'GST_18',
          gstRate: gstRate !== undefined && gstRate !== null ? parseFloat(gstRate) : 18,
          hsnSacCode: hsnSacCode ?? null,
          isGstExempt: isGstExempt ?? false,
        },
      });

      if (!created.isGlobal && regionIds && regionIds.length > 0) {
        await tx.benefitRegion.createMany({
          data: regionIds.map((rId) => ({
            benefitId: created.id,
            regionId: rId,
          })),
        });
      }

      return tx.benefit.findUnique({
        where: { id: created.id },
        include: {
          benefitType: { select: { id: true, name: true } },
          benefitRegions: { include: { region: true } },
        },
      });
    });

    const formatted = {
      ...benefit,
      regionIds: (benefit.benefitRegions || []).map(br => br.regionId),
      regions: (benefit.benefitRegions || []).map(br => br.region),
    };

    res.status(201).json({ success: true, data: formatted });
  } catch (err) {
    console.error('POST benefits error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/benefits/:id — update
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    benefitTypeId,
    code,
    name,
    description,
    isChargeable,
    unitCost,
    cost,
    unitLabel,
    defaultUnits,
    displayOrder,
    isActive,
    isAddon,
    addonPrice,
    addonDiscountPrice,
    addonIncludedUnits,
    isGlobal,
    regionIds,
    taxCategory,
    gstRate,
    hsnSacCode,
    isGstExempt,
  } = req.body;
  try {
    const dataToUpdate = {};
    if (benefitTypeId !== undefined) dataToUpdate.benefitTypeId = benefitTypeId;
    if (code !== undefined) dataToUpdate.code = code ? code.trim().toUpperCase() : null;
    if (name !== undefined) dataToUpdate.name = name;
    if (description !== undefined) dataToUpdate.description = description;
    if (isChargeable !== undefined) {
      dataToUpdate.isChargeable = isChargeable;
      if (!isChargeable) {
        dataToUpdate.unitCost = null;
        dataToUpdate.cost = null;
      }
    }
    if (unitCost !== undefined) dataToUpdate.unitCost = isChargeable === false ? null : unitCost;
    if (cost !== undefined) dataToUpdate.cost = isChargeable === false ? null : cost;
    if (unitLabel !== undefined) dataToUpdate.unitLabel = unitLabel;
    if (defaultUnits !== undefined) dataToUpdate.defaultUnits = defaultUnits;
    if (displayOrder !== undefined) dataToUpdate.displayOrder = displayOrder;
    if (isActive !== undefined) dataToUpdate.isActive = isActive;
    if (isAddon !== undefined) dataToUpdate.isAddon = isAddon;
    if (addonPrice !== undefined) dataToUpdate.addonPrice = addonPrice;
    if (addonDiscountPrice !== undefined) dataToUpdate.addonDiscountPrice = addonDiscountPrice;
    if (addonIncludedUnits !== undefined) dataToUpdate.addonIncludedUnits = addonIncludedUnits;
    if (isGlobal !== undefined) dataToUpdate.isGlobal = isGlobal;
    if (taxCategory !== undefined) dataToUpdate.taxCategory = taxCategory;
    if (gstRate !== undefined) dataToUpdate.gstRate = gstRate !== null ? parseFloat(gstRate) : null;
    if (hsnSacCode !== undefined) dataToUpdate.hsnSacCode = hsnSacCode;
    if (isGstExempt !== undefined) dataToUpdate.isGstExempt = isGstExempt;

    const benefit = await prisma.$transaction(async (tx) => {
      const updated = await tx.benefit.update({
        where: { id },
        data: dataToUpdate,
      });

      if (regionIds !== undefined) {
        await tx.benefitRegion.deleteMany({ where: { benefitId: id } });
        if (!updated.isGlobal && regionIds.length > 0) {
          await tx.benefitRegion.createMany({
            data: regionIds.map((rId) => ({
              benefitId: id,
              regionId: rId,
            })),
          });
        }
      }

      return tx.benefit.findUnique({
        where: { id },
        include: {
          benefitType: { select: { id: true, name: true } },
          benefitRegions: { include: { region: true } },
        },
      });
    });

    const formatted = {
      ...benefit,
      regionIds: (benefit.benefitRegions || []).map(br => br.regionId),
      regions: (benefit.benefitRegions || []).map(br => br.region),
    };

    res.json({ success: true, data: formatted });
  } catch (err) {
    if (err.code === 'P2025')
      return res
        .status(404)
        .json({ success: false, message: 'Benefit not found' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/benefits/:id — soft delete
router.delete('/:id', async (req, res) => {
  try {
    await prisma.benefit.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'Benefit deactivated' });
  } catch (err) {
    if (err.code === 'P2025')
      return res
        .status(404)
        .json({ success: false, message: 'Benefit not found' });
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
