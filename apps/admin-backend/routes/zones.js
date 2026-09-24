const express = require('express');
const router = express.Router();
const path = require('path');

const { prisma } = require('../lib/prisma');
const { requirePermission, getOmZoneIds } = require('../utils/rbac');

// ── GET /api/zones ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, page, limit } = req.query;

    const filterParams = {};

    // RBAC zone scoping
    const role = req.user?.role;
    if (role === 'operations_manager') {
      const zoneIds = await getOmZoneIds(req.user.id);
      filterParams.id = { in: zoneIds };
    } else if (role === 'field_manager') {
      const fm = await prisma.fieldManager.findUnique({
        where: { userId: req.user.id },
        select: { teams: { select: { zoneId: true } } },
      });
      const zoneIds = [...new Set((fm?.teams || []).map((t) => t.zoneId).filter(Boolean))];
      filterParams.id = { in: zoneIds };
    }

    const searchStr = (typeof search === 'string' && search.trim()) ? search.trim() : null;
    if (searchStr) {
      filterParams.OR = [
        { name: { contains: searchStr, mode: 'insensitive' } },
        { city: { contains: searchStr, mode: 'insensitive' } },
        { pincode: { contains: searchStr } },
      ];
    }

    const listQuery = {
      where: filterParams,
      include: { region: true },
      orderBy: { createdAt: 'desc' },
    };

    if (page && limit) {
      const pageNum = Number(page);
      const limitNum = Number(limit);
      if (pageNum > 0 && limitNum > 0) {
        listQuery.skip = (pageNum - 1) * limitNum;
        listQuery.take = limitNum;
      }
    }

    const [zones, total] = await Promise.all([
      prisma.zone.findMany(listQuery),
      prisma.zone.count({ where: filterParams }),
    ]);

    const response = { success: true, data: zones, total };
    if (page && limit) {
      response.page = Number(page);
      response.totalPages = Math.ceil(total / Number(limit));
    }

    res.json(response);
  } catch (err) {
    console.error('GET /zones error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch zones' });
  }
});

// ── GET /api/zones/check-pincode/:pincode ──────────────────────────────────
router.get('/check-pincode/:pincode', async (req, res) => {
  try {
    const { pincode } = req.params;
    if (!pincode)
      return res.status(400).json({ success: false, message: 'pincode is required' });

    const zone = await prisma.zone.findFirst({
      where: { pincode: pincode, isActive: true },
      select: { id: true, name: true, city: true, state: true },
    });

    res.json({ success: true, data: { serviceable: !!zone, zone: zone || null } });
  } catch (err) {
    console.error('GET /check-pincode error:', err);
    res.status(500).json({ success: false, message: 'Failed to check pincode' });
  }
});

// ── GET /api/zones/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const zone = await prisma.zone.findUnique({
      where: { id: req.params.id },
      include: { region: true },
    });
    if (!zone) return res.status(404).json({ success: false, message: 'Zone not found' });
    res.json({ success: true, data: zone });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch zone' });
  }
});

// ── POST /api/zones ────────────────────────────────────────────────────────
router.post('/', requirePermission('zones.create'), async (req, res) => {
  try {
    const {
      name, city, address, state, pincode,
      latitude, longitude, phone,
      leaseStartDate, leaseEndDate,
      fieldManagerId, operationsManagerId, regionId,
    } = req.body;

    if (!name || !city || !address || !state || !pincode) {
      return res.status(400).json({
        success: false,
        message: 'name, city, address, state, and pincode are required',
      });
    }

    const zone = await prisma.zone.create({
      data: {
        name, city, address, state, pincode,
        phone: phone || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        leaseStartDate: leaseStartDate ? new Date(leaseStartDate) : null,
        leaseEndDate: leaseEndDate ? new Date(leaseEndDate) : null,
        isActive: true,
        fieldManagerId: fieldManagerId || null,
        operationsManagerId: operationsManagerId || null,
        regionId: regionId || null,
      },
      include: { region: true },
    });

    res.status(201).json({ success: true, data: zone });
  } catch (err) {
    console.error('POST /zones error:', JSON.stringify(err, null, 2) || err);
    res.status(500).json({ success: false, message: 'Failed to create zone', error: err.message });
  }
});

// ── PUT /api/zones/:id ─────────────────────────────────────────────────────
router.put('/:id', requirePermission('zones.update'), async (req, res) => {
  try {
    const {
      name, city, address, state, pincode,
      latitude, longitude, phone,
      leaseStartDate, leaseEndDate, isActive,
      fieldManagerId, operationsManagerId, regionId,
    } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (city !== undefined) data.city = city;
    if (address !== undefined) data.address = address;
    if (state !== undefined) data.state = state;
    if (pincode !== undefined) data.pincode = pincode;
    if (phone !== undefined) data.phone = phone;
    if (latitude !== undefined) data.latitude = latitude ? parseFloat(latitude) : null;
    if (longitude !== undefined) data.longitude = longitude ? parseFloat(longitude) : null;
    if (leaseStartDate !== undefined) data.leaseStartDate = leaseStartDate ? new Date(leaseStartDate) : null;
    if (leaseEndDate !== undefined) data.leaseEndDate = leaseEndDate ? new Date(leaseEndDate) : null;
    if (isActive !== undefined) data.isActive = isActive;
    if (fieldManagerId !== undefined) data.fieldManagerId = fieldManagerId || null;
    if (operationsManagerId !== undefined) data.operationsManagerId = operationsManagerId || null;
    if (regionId !== undefined) data.regionId = regionId || null;

    const zone = await prisma.zone.update({
      where: { id: req.params.id },
      data,
      include: { region: true },
    });

    res.json({ success: true, data: zone });
  } catch (err) {
    console.error('PUT /zones/:id error:', err);
    if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Zone not found' });
    res.status(500).json({ success: false, message: 'Failed to update zone' });
  }
});

// ── PUT /api/zones/:id/assign-om ─────────────────────────────────────────
router.put('/:id/assign-om', requirePermission('zones.assign_om'), async (req, res) => {
  try {
    const { operationsManagerId } = req.body;
    const zone = await prisma.zone.update({
      where: { id: req.params.id },
      data: { operationsManagerId: operationsManagerId || null },
    });
    res.json({ success: true, data: zone });
  } catch (err) {
    console.error('PUT /assign-om error:', err);
    res.status(500).json({ success: false, message: 'Failed to assign operations manager' });
  }
});

// ── PATCH /api/zones/:id/toggle ────────────────────────────────────────────
router.patch('/:id/toggle', requirePermission('zones.toggle_active'), async (req, res) => {
  try {
    const existing = await prisma.zone.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Zone not found' });

    const zone = await prisma.zone.update({
      where: { id: req.params.id },
      data: { isActive: !existing.isActive },
    });

    res.json({ success: true, data: zone });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to toggle zone status' });
  }
});

// ── DELETE /api/zones/:id ──────────────────────────────────────────────────
router.delete('/:id', requirePermission('zones.delete'), async (req, res) => {
  try {
    await prisma.zone.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Zone deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Zone not found' });
    res.status(500).json({ success: false, message: 'Failed to delete zone' });
  }
});

module.exports = router;
