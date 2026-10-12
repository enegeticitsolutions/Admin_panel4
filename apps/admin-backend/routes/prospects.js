const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const { resolveFileUrl } = require('../services/storage/urlResolver');

// ─── GET /api/prospects ────────────────────────────────────────────────────────
// Fetches users who downloaded the app / signed up but have NOT purchased a package
router.get('/', async (req, res) => {
  try {
    const {
      search,
      page = 1,
      limit = 12,
      filter = 'all', // 'all' | 'high_intent' | 'no_beneficiary' | 'recent_7_days' | 'app_active'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    // Base prospect condition:
    // 1. User has role 'subscriber' or 'prospect'
    // 2. User has NEVER bought an active package (or has 0 subscriptions)
    const baseWhere = {
      role: { in: ['subscriber', 'prospect'] },
      isActive: true,
      subscriberSubscriptions: {
        none: {
          isActive: true,
        },
      },
    };

    // Text search (name, phone, email, city)
    const searchConditions = [];
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      searchConditions.push(
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } }
      );
    }

    const where = { ...baseWhere };
    if (searchConditions.length > 0) {
      where.OR = searchConditions;
    }

    // Specific intent / lifecycle filters
    if (filter === 'high_intent') {
      // User created at least 1 beneficiary but stopped before purchasing
      where.subscriberBeneficiaries = { some: {} };
    } else if (filter === 'no_beneficiary') {
      // User registered but hasn't added any family member yet
      where.subscriberBeneficiaries = { none: {} };
    } else if (filter === 'recent_7_days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      where.createdAt = { gte: sevenDaysAgo };
    } else if (filter === 'app_active') {
      // App is active on device (has FCM token or logged in within last 30 days)
      where.fcmToken = { not: null };
    }

    // Execute paginated query and stats in parallel
    const [prospects, totalCount, totalLoggedIn, totalWithBeneficiary, totalAppActive] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [
          { lastLoginAt: 'desc' },
          { createdAt: 'desc' },
        ],
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          profilePhoto: true,
          city: true,
          state: true,
          pincode: true,
          fcmToken: true,
          lastLoginAt: true,
          createdAt: true,
          role: true,
          subscriberBeneficiaries: {
            select: {
              id: true,
              name: true,
              relationship: true,
              age: true,
              gender: true,
              city: true,
            },
          },
          subscriberCallbackRequests: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              status: true,
              notes: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              subscriberBeneficiaries: true,
              subscriberCallbackRequests: true,
              couponAttemptLogs: true,
            },
          },
        },
      }),

      // Total count matching current query
      prisma.user.count({ where }),

      // KPI Metric 1: Logged-in Users without package
      prisma.user.count({
        where: {
          ...baseWhere,
          lastLoginAt: { not: null },
        },
      }),

      // KPI Metric 2: Added Beneficiaries without package
      prisma.user.count({
        where: {
          ...baseWhere,
          subscriberBeneficiaries: { some: {} },
        },
      }),

      // KPI Metric 3: Active Mobile App (Device Token Registered)
      prisma.user.count({
        where: {
          ...baseWhere,
          fcmToken: { not: null },
        },
      }),
    ]);

    // Format prospects response and resolve profile photo URLs
    const formatted = await Promise.all(
      prospects.map(async (p) => {
        const hasBeneficiary = (p.subscriberBeneficiaries?.length || 0) > 0;
        const latestCallback = p.subscriberCallbackRequests?.[0] || null;

        return {
          id: p.id,
          name: p.name || 'Unnamed App User',
          phone: p.phone,
          email: p.email || null,
          city: p.city || null,
          state: p.state || null,
          pincode: p.pincode || null,
          profilePhoto: p.profilePhoto ? await resolveFileUrl(p.profilePhoto) : null,
          isAppInstalled: !!p.fcmToken,
          lastLoginAt: p.lastLoginAt,
          signupDate: p.createdAt,
          intentLevel: hasBeneficiary ? 'HIGH' : 'MEDIUM',
          beneficiaryCount: p.subscriberBeneficiaries?.length || 0,
          beneficiaries: p.subscriberBeneficiaries || [],
          couponAttempts: p._count.couponAttemptLogs || 0,
          latestCallback: latestCallback
            ? {
                id: latestCallback.id,
                status: latestCallback.status,
                notes: latestCallback.notes,
                date: latestCallback.createdAt,
              }
            : null,
        };
      })
    );

    res.json({
      success: true,
      data: formatted,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum) || 1,
      },
      stats: {
        totalProspects: totalCount,
        loggedInCount: totalLoggedIn,
        withBeneficiaryCount: totalWithBeneficiary,
        appActive: totalAppActive,
      },
    });
  } catch (err) {
    console.error('GET /api/prospects error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch prospects' });
  }
});

// ─── POST /api/prospects/:id/log-callback ──────────────────────────────────────
// Sales/operations agent can record a follow-up or callback request for this prospect
router.post('/:id/log-callback', async (req, res) => {
  const { id } = req.params;
  const { notes, status = 'pending', scheduledAt } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, phone: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Prospect not found' });
    }

    const callback = await prisma.callbackRequest.create({
      data: {
        subscriberId: user.id,
        name: user.name || 'Prospect User',
        phone: user.phone,
        message: 'Outreach to prospect who downloaded app without package',
        notes: notes || null,
        status: status || 'pending',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        calledAt: status === 'completed' ? new Date() : null,
      },
    });

    res.status(201).json({ success: true, data: callback });
  } catch (err) {
    console.error('POST /api/prospects/:id/log-callback error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to log callback' });
  }
});

module.exports = router;
