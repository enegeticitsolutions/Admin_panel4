const express = require('express');
const router = express.Router();
const path = require('path');

const { prisma } = require('../lib/prisma');
const { calculateAge } = require('../utils/age');
const { resolveFileUrl } = require('../services/storage/urlResolver');

// ── GET /api/subscribers ─────────────────────────────────────────────────────
// Fetches all users with role = 'subscriber' and their linked beneficiaries
router.get('/', async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const filterParams = { role: 'subscriber' };

    const searchStr = (typeof search === 'string' && search.trim()) ? search.trim() : null;
    if (searchStr) {
      filterParams.AND = [
        {
          OR: [
            { name: { contains: searchStr, mode: 'insensitive' } },
            { phone: { contains: searchStr } },
            { email: { contains: searchStr, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const listQuery = {
      where: filterParams,
      orderBy: { createdAt: 'desc' },
      include: {
        subscriberBeneficiaries: {
          select: { id: true, name: true, age: true },
        },
      },
    };

    if (page && limit) {
      const pageNum = Number(page);
      const limitNum = Number(limit);
      if (pageNum > 0 && limitNum > 0) {
        listQuery.skip = (pageNum - 1) * limitNum;
        listQuery.take = limitNum;
      }
    }

    const subscribers = await prisma.user.findMany(listQuery);
    const total = await prisma.user.count({ where: filterParams });

    // Fetch subscriptions separately mapped by subscriber
    const subscriberIds = subscribers.map((s) => s.id);
    const subscriptions = await prisma.subscription.findMany({
      where: { subscriberId: { in: subscriberIds }, isActive: true },
      include: { package: { select: { name: true, type: true } } },
    });

    const subMap = {};
    subscriptions.forEach((s) => {
      if (!subMap[s.subscriberId]) subMap[s.subscriberId] = s;
    });

    const mapped = await Promise.all(subscribers.map(async (s) => {
      const activeSub = subMap[s.id];
      return {
        id: s.id,
        name: s.name,
        profilePhoto: s.profilePhoto ? await resolveFileUrl(s.profilePhoto) : null,
        phone: s.phone,
        email: s.email || null,
        address: s.address || null,
        dateOfBirth: s.dateOfBirth || null,
        age: s.dateOfBirth ? (calculateAge(s.dateOfBirth) ?? s.age) : s.age,
        isActive: s.isActive,
        createdAt: s.createdAt,
        beneficiaryCount: s.subscriberBeneficiaries?.length || 0,
        beneficiaries: s.subscriberBeneficiaries || [],
        activePackage: activeSub?.package?.name || null,
        subscriptionType: activeSub?.package?.type || null,
      };
    }));

    if (page && limit) {
      res.json({
        success: true,
        data: {
          data: mapped,
          total,
          page: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } else {
      res.json({ success: true, data: mapped });
    }
  } catch (err) {
    console.error('GET /subscribers error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch subscribers' });
  }
});

// ── GET /api/subscribers/:id ─────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const s = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        subscriberBeneficiaries: {
          include: {
            primaryCC: true,
            secondaryCC: true,
            team: {
              include: { fieldManager: true }
            },
          },
        },
      },
    });
    if (!s || s.role !== 'subscriber')
      return res
        .status(404)
        .json({ success: false, message: 'Subscriber not found' });

    // Fetch all subscriptions for this subscriber
    const subs = await prisma.subscription.findMany({
      where: { subscriberId: s.id },
      include: {
        package: true,
        beneficiary: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (s.profilePhoto) {
      s.profilePhoto = await resolveFileUrl(s.profilePhoto);
    }

    res.json({
      success: true,
      data: {
        ...s,
        dateOfBirth: s.dateOfBirth || null,
        age: s.dateOfBirth ? (calculateAge(s.dateOfBirth) ?? s.age) : s.age,
        beneficiaries: s.subscriberBeneficiaries,
        subscriptions: subs,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/subscribers/:id ─────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { 
      name, phone, email, age, location, latitude, longitude, 
      profilePhoto, isActive, dateOfBirth 
    } = req.body;

    const s = await prisma.user.findUnique({ where: { id } });
    if (!s || s.role !== 'subscriber') return res.status(404).json({ success: false, message: 'Subscriber not found' });

    let parsedAge = age !== undefined ? Number(age) : undefined;
    if (parsedAge !== undefined && isNaN(parsedAge)) parsedAge = s.age;

    // If a new dateOfBirth is provided, recompute age from it
    if (dateOfBirth !== undefined && dateOfBirth !== null && dateOfBirth !== '') {
      const computedAge = calculateAge(dateOfBirth);
      if (computedAge !== null) parsedAge = computedAge;
    }

    // Build update object securely
    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (phone !== undefined) {
      // Check if another user has this phone
      if (phone !== s.phone) {
        const existingPhones = await prisma.user.findUnique({ where: { phone } });
        if (existingPhones) return res.status(400).json({ success: false, message: 'Phone number already in use by another user' });
      }
      dataToUpdate.phone = phone;
    }
    if (email !== undefined) {
      if (email !== s.email && email !== '') {
        const existingEmails = await prisma.user.findUnique({ where: { email } });
        if (existingEmails) return res.status(400).json({ success: false, message: 'Email already in use by another user' });
      }
      dataToUpdate.email = email === '' ? null : email;
    }
    if (parsedAge !== undefined) dataToUpdate.age = parsedAge;
    if (dateOfBirth !== undefined) dataToUpdate.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (location !== undefined) dataToUpdate.location = location;
    if (latitude !== undefined) dataToUpdate.latitude = latitude !== null ? Number(latitude) : null;
    if (longitude !== undefined) dataToUpdate.longitude = longitude !== null ? Number(longitude) : null;
    if (profilePhoto !== undefined) dataToUpdate.profilePhoto = profilePhoto;
    if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive);

    const updated = await prisma.user.update({
      where: { id },
      data: dataToUpdate
    });

    const changedFields = Object.keys(dataToUpdate).filter(key => s[key] !== dataToUpdate[key]);

    if (changedFields.length > 0) {
      await prisma.activityLog.create({
        data: {
          userId: id,
          type: 'PROFILE',
          action: 'PROFILE_UPDATED',
          details: {
            entity: 'subscriber',
            entityId: id,
            entityName: updated.name,
            fieldsChanged: changedFields,
            updatedByRole: req.user?.role || 'system',
            updatedByName: req.user?.name || 'Admin',
          }
        }
      });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(`PUT /subscribers/:id error:`, err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/subscribers/:id/utilization-summary ─────────────────────────────
// Returns all beneficiaries under a subscriber with their package utilization summary
router.get('/:id/utilization-summary', async (req, res) => {
  try {
    const { id: subscriberId } = req.params;

    // Get all active beneficiaries for this subscriber
    const beneficiaries = await prisma.beneficiary.findMany({
      where: { subscriberId, isActive: true },
      select: {
        id: true,
        name: true,
        age: true,
        gender: true,
        photo: true,
        primaryCC: { select: { id: true, name: true, ccType: true } },
        subscriptions: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            package: { select: { id: true, name: true, type: true } },
            benefitBalances: {
              include: {
                benefit: { select: { id: true, name: true, unitLabel: true } },
              },
            },
          },
        },
      },
    });

    const summary = beneficiaries.map((b) => {
      const activeSub = b.subscriptions?.[0] || null;
      const benefits = (activeSub?.benefitBalances || []).map((bal) => {
        const remaining = Math.max(0, bal.totalUnits - bal.usedUnits);
        const usagePercent = bal.totalUnits > 0 ? Math.round((bal.usedUnits / bal.totalUnits) * 100) : 0;
        return {
          benefitId: bal.benefitId,
          benefitName: bal.benefit?.name,
          unitLabel: bal.benefit?.unitLabel || 'units',
          totalUnits: bal.totalUnits,
          usedUnits: bal.usedUnits,
          remainingUnits: remaining,
          usagePercent,
          isLowBalance: bal.totalUnits > 0 && remaining / bal.totalUnits < 0.2,
          isExhausted: bal.totalUnits > 0 && remaining === 0,
        };
      });

      return {
        beneficiaryId: b.id,
        beneficiaryName: b.name,
        age: b.age,
        gender: b.gender,
        photo: b.photo || null,
        primaryCCName: b.primaryCC?.name || null,
        activePackage: activeSub?.package?.name || null,
        subscriptionId: activeSub?.id || null,
        subscriptionEndDate: activeSub?.endDate || null,
        benefits,
        overallUsagePercent:
          benefits.length > 0
            ? Math.round(benefits.reduce((sum, x) => sum + x.usagePercent, 0) / benefits.length)
            : 0,
        hasLowBalance: benefits.some((x) => x.isLowBalance),
        hasExhausted: benefits.some((x) => x.isExhausted),
      };
    });

    res.json({ success: true, data: summary });
  } catch (err) {
    console.error('GET /subscribers/:id/utilization-summary error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

