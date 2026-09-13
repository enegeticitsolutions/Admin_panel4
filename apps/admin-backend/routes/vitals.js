/**
 * Vitals API Routes — wired to the live Prisma schema
 *
 * Schema field reference:
 *   VitalDefinition:        id, code, name, description, unit, dataType,
 *                           normalMin, normalMax, isSystemVital, displayOrder,
 *                           iconCode, isActive
 *   VitalConfigTemplate:    id, name, description, isDefault, isActive
 *   VitalTemplateItem:      templateId, vitalDefinitionId, isMandatory,
 *                           frequency, displayOrder
 *   BeneficiaryVitalConfig: beneficiaryId, vitalDefinitionId, templateId,
 *                           isActive, isMandatory, frequency
 *   VitalReading:           beneficiaryId, vitalDefinitionId, capturedById,
 *                           valueNumeric, valueNumeric2, valueText, isAbnormal
 *
 * IMPORTANT: Named sub-routes (/templates, /readings, /beneficiary-configs)
 *            are declared BEFORE /:id to prevent Express shadowing.
 */
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');

// ─── GET /api/vitals ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { activeOnly } = req.query;
  try {
    const where = { isLatestVersion: true };
    if (activeOnly === 'true') where.isActive = true;
    const vitals = await prisma.vitalDefinition.findMany({
      where,
      orderBy: { displayOrder: 'asc' },
    });
    res.json({ success: true, data: vitals });
  } catch (err) {
    console.error('GET /vitals error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/vitals ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    code, name, category, unit, dataType, normalMin, normalMax, description, displayOrder,
    inputMin, inputMax,
    value1Label, value2Label, normalMin2, normalMax2,
    textOptions, alertOptions,
    booleanTrueLabel, booleanFalseLabel, booleanAlertValue
  } = req.body;
  if (!code || !name || !dataType) {
    return res.status(400).json({ success: false, message: 'code, name, and dataType are required' });
  }
  try {
    const vital = await prisma.vitalDefinition.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        category: category || null,
        unit: unit || null,
        dataType,
        inputMin: inputMin != null && inputMin !== '' ? parseFloat(inputMin) : null,
        inputMax: inputMax != null && inputMax !== '' ? parseFloat(inputMax) : null,
        normalMin: normalMin != null && normalMin !== '' ? parseFloat(normalMin) : null,
        normalMax: normalMax != null && normalMax !== '' ? parseFloat(normalMax) : null,
        description: description || null,
        displayOrder: parseInt(displayOrder) || 0,
        // Dual numeric
        value1Label: value1Label || null,
        value2Label: value2Label || null,
        normalMin2: normalMin2 != null && normalMin2 !== '' ? parseFloat(normalMin2) : null,
        normalMax2: normalMax2 != null && normalMax2 !== '' ? parseFloat(normalMax2) : null,
        // Text
        textOptions: Array.isArray(textOptions) ? textOptions : [],
        alertOptions: Array.isArray(alertOptions) ? alertOptions : [],
        // Boolean
        booleanTrueLabel: booleanTrueLabel || null,
        booleanFalseLabel: booleanFalseLabel || null,
        booleanAlertValue: booleanAlertValue != null ? Boolean(booleanAlertValue) : null,
        isActive: true,
        isSystemVital: false,
        version: 1,
        isLatestVersion: true,
      },
    });
    // Normalize response field name for frontend
    res.status(201).json({ success: true, data: { ...vital, isSystem: vital.isSystemVital } });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: `A vital with code "${code}" already exists` });
    }
    console.error('POST /vitals error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/vitals/templates ──────────────────────────────────────────────
router.get('/templates', async (req, res) => {
  try {
    const templates = await prisma.vitalConfigTemplate.findMany({
      orderBy: { name: 'asc' },
      include: {
        items: {
          orderBy: { displayOrder: 'asc' },
          include: { vitalDefinition: true },
        },
        appliedConfigs: { select: { id: true } },
      },
    });

    const transformed = templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      isDefault: t.isDefault,
      isActive: t.isActive,
      beneficiaryCount: t.appliedConfigs.length,
      items: t.items.map(i => ({
        vitalCode: i.vitalDefinition.code,
        vitalName: i.vitalDefinition.name,
        frequency: i.frequency || 'every_visit',
        isMandatory: i.isMandatory,
      })),
    }));

    res.json({ success: true, data: transformed });
  } catch (err) {
    console.error('GET /vitals/templates error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/vitals/templates ─────────────────────────────────────────────
router.post('/templates', async (req, res) => {
  const { name, description, isDefault, items } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'name is required' });
  try {
    const template = await prisma.vitalConfigTemplate.create({
      data: {
        name,
        description: description || null,
        isDefault: !!isDefault,
        isActive: true,
        items: items
          ? {
              create: items.map((item, idx) => ({
                vitalDefinitionId: item.vitalDefinitionId,
                frequency: item.frequency || 'every_visit',
                isMandatory: !!item.isMandatory,
                displayOrder: idx,
              })),
            }
          : undefined,
      },
    });
    res.status(201).json({ success: true, data: template });
  } catch (err) {
    console.error('POST /vitals/templates error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/vitals/beneficiary-configs ────────────────────────────────────
router.get('/beneficiary-configs', async (req, res) => {
  try {
    const configs = await prisma.beneficiaryVitalConfig.findMany({
      include: {
        beneficiary: true,
        vitalDefinition: true,
        template: true,
      },
      orderBy: { beneficiaryId: 'asc' },
    });

    // Group by beneficiary
    const grouped = {};
    configs.forEach(c => {
      if (!grouped[c.beneficiaryId]) {
        grouped[c.beneficiaryId] = {
          id: c.beneficiaryId,
          name: c.beneficiary.name,
          age: 0,
          zoneName: 'Default Zone',
          templateName: c.template?.name || 'Standard care',
          vitals: [],
        };
      }
      grouped[c.beneficiaryId].vitals.push({
        vitalCode: c.vitalDefinition.code,
        vitalName: c.vitalDefinition.name,
        frequency: c.frequency,
        isEnabled: c.isActive,
        isOverridden: !c.templateId,
      });
    });

    res.json({ success: true, data: Object.values(grouped) });
  } catch (err) {
    console.error('GET /vitals/beneficiary-configs error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/vitals/readings ────────────────────────────────────────────────
router.get('/readings', async (req, res) => {
  const { beneficiaryId, status } = req.query;
  try {
    const where = {};
    if (beneficiaryId) where.beneficiaryId = beneficiaryId;
    if (status === 'abnormal') where.isAbnormal = true;

    const readings = await prisma.vitalReading.findMany({
      where,
      include: {
        beneficiary: true,
        capturedBy: true,
        vitalDefinition: true,
      },
      orderBy: { capturedAt: 'desc' },
      take: 100,
    });

    const transformed = readings.map(r => {
      // Build display value from the appropriate value field
      let readingValue = '—';
      if (r.valueNumeric !== null && r.valueNumeric2 !== null) {
        readingValue = `${r.valueNumeric}/${r.valueNumeric2}`;
      } else if (r.valueNumeric !== null) {
        readingValue = String(r.valueNumeric);
      } else if (r.valueText) {
        readingValue = r.valueText;
      }

      return {
        id: r.id,
        beneficiaryName: r.beneficiary?.name || 'Unknown',
        careCompanionName: r.capturedBy?.name || 'Unknown',
        vitalCode: r.vitalDefinition?.code || '',
        vitalName: r.vitalDefinition?.name || '',
        readingValue,
        unit: r.unit || r.vitalDefinition?.unit || null,
        status: r.isAbnormal ? 'abnormal' : 'normal',
        capturedAt: r.capturedAt,
        method: r.captureMethod || 'manual',
      };
    });

    res.json({ success: true, data: transformed });
  } catch (err) {
    console.error('GET /vitals/readings error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/vitals/trends/:beneficiaryId ─────────────────────────────────
router.get('/trends/:beneficiaryId', async (req, res) => {
  try {
    const { beneficiaryId } = req.params;
    let days = parseInt(req.query.days) || 30;
    if (days <= 0 || days > 365) days = 30;

    const limitPoints = req.query.limit ? parseInt(req.query.limit) : null;

    let fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    // Fetch vital readings for this beneficiary
    let readings = await prisma.vitalReading.findMany({
      where: {
        beneficiaryId,
        capturedAt: { gte: fromDate },
      },
      include: {
        vitalDefinition: {
          select: {
            code: true,
            name: true,
            unit: true,
            dataType: true,
            normalMax: true,
            normalMin: true,
            normalMax2: true,
            normalMin2: true,
            displayOrder: true,
          },
        },
        capturedBy: { select: { name: true, role: true } },
      },
      orderBy: { capturedAt: 'asc' },
    });

    // Fallback: If no readings in the last N days, fetch the most recent 50 readings overall
    if (readings.length === 0) {
      readings = await prisma.vitalReading.findMany({
        where: { beneficiaryId },
        include: {
          vitalDefinition: {
            select: {
              code: true,
              name: true,
              unit: true,
              dataType: true,
              normalMax: true,
              normalMin: true,
              normalMax2: true,
              normalMin2: true,
              displayOrder: true,
            },
          },
          capturedBy: { select: { name: true, role: true } },
        },
        orderBy: { capturedAt: 'desc' },
        take: 50,
      });
      readings.reverse(); // chronological
    }

    const grouped = new Map();

    for (const r of readings) {
      const def = r.vitalDefinition;
      if (!def) continue;
      const code = def.code.toUpperCase();

      if (!grouped.has(code)) {
        grouped.set(code, {
          name: def.name,
          code: code,
          unit: r.unit || def.unit || '',
          dataType: def.dataType,
          normalMin: def.normalMin,
          normalMax: def.normalMax,
          normalMin2: def.normalMin2,
          normalMax2: def.normalMax2,
          displayOrder: def.displayOrder || 0,
          v1: [],
          v2: [],
        });
      }

      const group = grouped.get(code);
      const dateStr = r.capturedAt.toISOString().split('T')[0];
      const shortDate = r.capturedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const timeStr = r.capturedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const src = r.source || 'care_companion';
      const recName = src === 'beneficiary'
        ? 'Self'
        : (r.capturedBy ? r.capturedBy.name || 'Care Companion' : 'Care Companion');

      if (def.dataType === 'numeric' || def.dataType === 'dual_numeric') {
        if (r.valueNumeric !== null && r.valueNumeric !== undefined) {
          group.v1.push({
            date: shortDate,
            time: timeStr,
            fullDate: dateStr,
            timestamp: r.capturedAt,
            value: r.valueNumeric,
            source: src,
            recorder: recName,
          });
        }
        if (def.dataType === 'dual_numeric' && r.valueNumeric2 !== null && r.valueNumeric2 !== undefined) {
          group.v2.push({
            date: shortDate,
            time: timeStr,
            fullDate: dateStr,
            timestamp: r.capturedAt,
            value: r.valueNumeric2,
            source: src,
            recorder: recName,
          });
        }
      }
    }

    const trends = Array.from(grouped.values()).map(g => {
      // Apply point limit if specified (default 7 for trend card matching mobile)
      const maxPts = limitPoints || 7;
      if (maxPts > 0) {
        g.v1 = g.v1.slice(-maxPts);
        if (g.v2) g.v2 = g.v2.slice(-maxPts);
      }

      let maxVal = 0;
      g.v1.forEach(pt => { if (pt.value > maxVal) maxVal = pt.value; });
      if (g.v2) g.v2.forEach(pt => { if (pt.value > maxVal) maxVal = pt.value; });

      if (maxVal > 0) {
        g.gridMax = Math.ceil(maxVal * 1.2);
      } else {
        g.gridMax = g.normalMax ? Math.ceil(g.normalMax * 1.2) : 200;
      }

      g.gridValues = [];
      const step = Math.max(1, Math.ceil(g.gridMax / 4));
      for (let i = 0; i <= 4; i++) {
        g.gridValues.push(i * step);
      }
      g.gridMax = g.gridValues[4];

      // Curated distinct colors
      const code = g.code;
      if (code === 'BP' || code === 'BLOOD_PRESSURE') {
        g.color = '#EF4444'; // Red (Systolic)
        g.color2 = '#4B5563'; // Slate / Gray (Diastolic)
      } else if (code === 'PULSE' || code === 'HEART_RATE') {
        g.color = '#F43F5E'; // Rose
      } else if (code === 'SPO2' || code === 'OXYGEN_LEVEL') {
        g.color = '#3B82F6'; // Blue
      } else if (code === 'TEMP' || code === 'TEMPERATURE') {
        g.color = '#F59E0B'; // Amber
      } else if (code === 'WEIGHT') {
        g.color = '#10B981'; // Emerald
      } else if (code.includes('GLUCOSE') || code.includes('SUGAR')) {
        g.color = '#8B5CF6'; // Violet
      } else {
        g.color = '#6366F1'; // Indigo
      }

      return g;
    });

    // Sort by vital definition display order
    trends.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    res.json({ success: true, data: trends });
  } catch (error) {
    console.error('GET /vitals/trends error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/vitals/beneficiary/:beneficiaryId/config ─────────────────────
router.get('/beneficiary/:beneficiaryId/config', async (req, res) => {
  try {
    const { beneficiaryId } = req.params;

    // 1. Fetch all latest active vital definitions
    const allDefinitions = await prisma.vitalDefinition.findMany({
      where: { isLatestVersion: true, isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    // 2. Fetch beneficiary's existing vital configurations
    const userConfigs = await prisma.beneficiaryVitalConfig.findMany({
      where: { beneficiaryId },
      include: { vitalDefinition: true },
    });

    const configMap = new Map();
    userConfigs.forEach(c => {
      configMap.set(c.vitalDefinitionId, c);
      if (c.vitalDefinition?.code) {
        configMap.set(c.vitalDefinition.code.toUpperCase(), c);
      }
    });

    // 3. Merge: each vital definition with its enabled status
    const merged = allDefinitions.map(def => {
      const config = configMap.get(def.id) || configMap.get(def.code.toUpperCase());
      const isEnabled = config ? Boolean(config.isActive) : false;
      const frequency = config?.frequency || (def.isSystemVital ? 'daily' : 'every_visit');

      return {
        vitalDefinitionId: def.id,
        code: def.code,
        name: def.name,
        category: def.category || 'General',
        dataType: def.dataType,
        unit: def.unit || null,
        isSystemVital: def.isSystemVital,
        displayOrder: def.displayOrder || 0,
        isEnabled,
        frequency,
        configId: config?.id || null,
        selectedBySubscriber: config ? Boolean(config.selectedBySubscriberId) : false,
      };
    });

    res.json({ success: true, data: merged });
  } catch (err) {
    console.error('GET /vitals/beneficiary/:beneficiaryId/config error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/vitals/beneficiary/:beneficiaryId/config ─────────────────────
router.put('/beneficiary/:beneficiaryId/config', async (req, res) => {
  try {
    const { beneficiaryId } = req.params;
    const { vitalDefinitionId, isEnabled, frequency } = req.body;

    if (!vitalDefinitionId) {
      return res.status(400).json({ success: false, message: 'vitalDefinitionId is required' });
    }

    // Upsert config in database
    const config = await prisma.beneficiaryVitalConfig.upsert({
      where: {
        beneficiaryId_vitalDefinitionId: {
          beneficiaryId,
          vitalDefinitionId,
        }
      },
      update: {
        isActive: Boolean(isEnabled),
        ...(frequency ? { frequency } : {}),
        updatedAt: new Date(),
      },
      create: {
        beneficiaryId,
        vitalDefinitionId,
        isActive: Boolean(isEnabled),
        frequency: frequency || 'every_visit',
      },
      include: { vitalDefinition: true }
    });

    // Create activity log
    try {
      await prisma.activityLog.create({
        data: {
          userId: req.user?.id || null,
          type: 'CLINICAL',
          action: 'VITAL_CONFIG_UPDATED',
          details: {
            beneficiaryId,
            vitalCode: config.vitalDefinition?.code,
            vitalName: config.vitalDefinition?.name,
            isEnabled: Boolean(isEnabled),
            frequency: config.frequency,
            updatedByName: req.user?.name || 'Administrator',
          }
        }
      });
    } catch (e) {}

    res.json({ success: true, data: config });
  } catch (err) {
    console.error('PUT /vitals/beneficiary/:beneficiaryId/config error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/vitals/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const vital = await prisma.vitalDefinition.findUnique({ where: { id: req.params.id } });
    if (!vital) return res.status(404).json({ success: false, message: 'Vital not found' });
    res.json({ success: true, data: { ...vital, isSystem: vital.isSystemVital } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/vitals/:id ───────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  // Strip non-updatable fields
  const { id: _id, createdAt, updatedAt, isSystem, ...rest } = req.body;
  // Map isSystem → isSystemVital if passed
  const data = { ...rest };
  if (req.body.isSystem !== undefined) data.isSystemVital = req.body.isSystem;

  // Parse numeric fields safely
  const numericFields = ['inputMin', 'inputMax', 'normalMin', 'normalMax', 'normalMin2', 'normalMax2'];
  numericFields.forEach(f => {
    if (data[f] !== undefined) {
      data[f] = (data[f] != null && data[f] !== '') ? parseFloat(data[f]) : null;
    }
  });

  // Parse array fields
  if (data.textOptions !== undefined && !Array.isArray(data.textOptions)) {
    data.textOptions = [];
  }
  if (data.alertOptions !== undefined && !Array.isArray(data.alertOptions)) {
    data.alertOptions = [];
  }

  // Parse boolean alert value
  if (data.booleanAlertValue !== undefined) {
    data.booleanAlertValue = data.booleanAlertValue != null ? Boolean(data.booleanAlertValue) : null;
  }

  if (data.displayOrder !== undefined) data.displayOrder = parseInt(data.displayOrder) || 0;

  try {
    const existing = await prisma.vitalDefinition.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Vital not found' });
    
    const newVital = await prisma.$transaction(async (tx) => {
      // 1. Mark existing as not latest
      await tx.vitalDefinition.update({
        where: { id },
        data: { isLatestVersion: false }
      });
      
      // 2. Find max version for this code
      const maxVersionVital = await tx.vitalDefinition.findFirst({
        where: { code: existing.code },
        orderBy: { version: 'desc' }
      });
      
      const newVersion = (maxVersionVital?.version || existing.version || 1) + 1;
      
      // 3. Create new row
      const parentId = existing.parentDefinitionId || existing.id; // anchor to original
      
      // construct new data merging existing and updates
      const newRowData = { ...existing, ...data };
      delete newRowData.id;
      delete newRowData.createdAt;
      delete newRowData.updatedAt;
      
      newRowData.version = newVersion;
      newRowData.isLatestVersion = true;
      newRowData.parentDefinitionId = parentId;
      
      return await tx.vitalDefinition.create({
        data: newRowData
      });
    });

    res.json({ success: true, data: { ...newVital, isSystem: newVital.isSystemVital } });
  } catch (err) {
    console.error('PATCH /vitals/:id error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/vitals/:id (soft delete) ───────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await prisma.vitalDefinition.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'Vital deactivated' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Vital not found' });
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
