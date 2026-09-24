const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const { requirePermission } = require('../utils/rbac');


// Haversine formula to calculate distance in km between two lat/lng coordinates
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── GET /api/regions/detect ──────────────────────────────────────────────────
router.get('/detect', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        message: 'Valid latitude (lat) and longitude (lng) are required',
      });
    }

    const regions = await prisma.region.findMany({
      where: { isActive: true },
    });

    const matchingRegions = regions
      .map((region) => {
        const distance = haversineDistance(
          lat,
          lng,
          region.latitude,
          region.longitude
        );
        return { ...region, distance };
      })
      .filter((region) => region.distance <= region.radiusKm)
      .sort((a, b) => a.distance - b.distance);

    res.json({
      success: true,
      data: matchingRegions,
    });
  } catch (err) {
    console.error('GET /regions/detect error:', err);
    res.status(500).json({ success: false, message: 'Failed to detect regions' });
  }
});

// ── GET /api/regions ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const regions = await prisma.region.findMany({
      include: {
        _count: {
          select: { zones: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Normalize response to return zoneCount
    const normalized = regions.map((r) => ({
      ...r,
      zoneCount: r._count?.zones || 0,
    }));

    res.json({ success: true, data: normalized });
  } catch (err) {
    console.error('GET /regions error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch regions' });
  }
});

// ── POST /api/regions ────────────────────────────────────────────────────────
router.post('/', requirePermission('regions.create'), async (req, res) => {
  try {
    const { name, city, state, latitude, longitude, radiusKm } = req.body;

    if (!name || !city || !state || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'name, city, state, latitude, and longitude are required',
      });
    }

    const existing = await prisma.region.findUnique({
      where: { name },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A region with this name already exists',
      });
    }

    const region = await prisma.region.create({
      data: {
        name,
        city,
        state,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radiusKm: radiusKm !== undefined ? parseFloat(radiusKm) : 30.0,
      },
    });

    res.json({ success: true, data: region });
  } catch (err) {
    console.error('POST /regions error:', err);
    res.status(500).json({ success: false, message: 'Failed to create region' });
  }
});

// ── PUT /api/regions/:id ─────────────────────────────────────────────────────
router.put('/:id', requirePermission('regions.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, city, state, latitude, longitude, radiusKm, isActive } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (city !== undefined) data.city = city;
    if (state !== undefined) data.state = state;
    if (latitude !== undefined) data.latitude = parseFloat(latitude);
    if (longitude !== undefined) data.longitude = parseFloat(longitude);
    if (radiusKm !== undefined) data.radiusKm = parseFloat(radiusKm);
    if (isActive !== undefined) data.isActive = !!isActive;

    const updated = await prisma.region.update({
      where: { id },
      data,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('PUT /regions/:id error:', req.params.id, err);
    res.status(500).json({ success: false, message: 'Failed to update region' });
  }
});

// ── DELETE /api/regions/:id ──────────────────────────────────────────────────
router.delete('/:id', requirePermission('regions.delete'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if any zone is associated with this region
    const zoneCount = await prisma.zone.count({
      where: { regionId: id },
    });

    if (zoneCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete region: ${zoneCount} zone(s) are associated with it`,
      });
    }

    await prisma.region.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Region deleted successfully' });
  } catch (err) {
    console.error('DELETE /regions/:id error:', req.params.id, err);
    res.status(500).json({ success: false, message: 'Failed to delete region' });
  }
});

module.exports = router;
