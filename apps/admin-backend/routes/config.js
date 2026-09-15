const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');

// ── GET /api/config ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    // Ensure default benefit rollover configs exist
    const defaultConfigs = [
      {
        key: 'benefit_rollover_default_cap_months',
        value: '1.0',
        description: 'Maximum multiplier of monthly base quota that can roll forward into the next month (Default: 1.0 = 1 Month quota cap)',
        group: 'BENEFITS'
      },
      {
        key: 'benefit_rollover_enabled',
        value: 'true',
        description: 'Enable automatic monthly period refresh and 1-month rollover for multi-month care plans',
        group: 'BENEFITS'
      },
      {
        key: 'EMERGENCY_HELPLINE_NUMBER',
        value: '01142258823',
        description: '24/7 Emergency Helpline dialed by Beneficiary SOS and emergency support modals',
        group: 'EMERGENCY'
      },
      {
        key: 'SATHI_COORDINATOR_NUMBER',
        value: '+91 1244495435',
        description: 'Saathi Coordinator phone number shown in Saathi App Guide and Support',
        group: 'SUPPORT'
      },
      {
        key: 'EMERGENCY_SERVICES_NUMBER',
        value: '112',
        description: 'National Emergency Services helpline (112)',
        group: 'EMERGENCY'
      }
    ];

    for (const def of defaultConfigs) {
      const existing = await prisma.systemConfig.findUnique({ where: { key: def.key } });
      if (!existing) {
        await prisma.systemConfig.create({ data: def });
      }
    }

    const configs = await prisma.systemConfig.findMany({
      orderBy: { key: 'asc' }
    });
    res.json({ success: true, data: configs });
  } catch (err) {
    console.error('GET /api/config error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch system configurations' });
  }
});

// ── PUT /api/config/:key ─────────────────────────────────────────────────────
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description, group } = req.body;

    const updated = await prisma.systemConfig.update({
      where: { key },
      data: {
        value: String(value),
        ...(description !== undefined ? { description } : {}),
        ...(group !== undefined ? { group } : {})
      }
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('PUT /api/config/:key error:', req.params.key, err);
    res.status(500).json({ success: false, message: 'Failed to update system configuration' });
  }
});

// ── POST /api/config ─────────────────────────────────────────────────────────
// Upsert: creates if not exists, updates if it does
router.post('/', async (req, res) => {
  try {
    const { key, value, description, group } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ success: false, message: 'key and value are required' });
    }

    const upserted = await prisma.systemConfig.upsert({
      where: { key },
      update: {
        value: String(value),
        ...(description !== undefined ? { description } : {}),
        ...(group !== undefined ? { group } : {}),
      },
      create: {
        key,
        value: String(value),
        description: description || null,
        group: group || null,
      },
    });

    res.status(201).json({ success: true, data: upserted });
  } catch (err) {
    console.error('POST /api/config error:', err);
    res.status(500).json({ success: false, message: 'Failed to upsert configuration' });
  }
});

module.exports = router;
