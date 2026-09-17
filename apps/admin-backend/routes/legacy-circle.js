const express = require('express');
const router = express.Router();

const { prisma } = require('../lib/prisma');
const { resolveFileUrl } = require('../services/storage/urlResolver');
const { dispatchLegacyCircleBioPublished } = require('../services/events/community-event.dispatcher');

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function enrichProfile(profile) {
  const b = profile.beneficiary;
  const resolvedPhoto = b.photo ? await resolveFileUrl(b.photo) : null;

  return {
    id: profile.id,
    status: profile.status,
    title: profile.title,
    headline: profile.headline,
    industry: profile.industry,
    yearsOfExperience: profile.yearsOfExperience,
    email: profile.email,
    connectRequests: profile.connectRequests,
    profileStrength: profile.profileStrength,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    beneficiaryId: b.id,
    name: b.name,
    age: b.age,
    dateOfBirth: b.dateOfBirth,
    gender: b.gender,
    address: b.address,
    city: b.city,
    state: b.state,
    pincode: b.pincode,
    photo: resolvedPhoto,
  };
}

const BENEFICIARY_INCLUDE = {
  beneficiary: {
    select: {
      id: true,
      name: true,
      photo: true,
      age: true,
      dateOfBirth: true,
      gender: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
    },
  },
};

// ─── GET /api/legacy-circle?status=pending|approved ──────────────────────────
router.get('/', async (req, res) => {
  try {
    const status = req.query.status || 'pending';

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status filter "${status}". Must be pending, approved, or rejected.`,
      });
    }

    const profiles = await prisma.legacyCircleProfile.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: BENEFICIARY_INCLUDE,
    });

    const enriched = await Promise.all(profiles.map(enrichProfile));

    return res.json({ success: true, data: enriched });
  } catch (err) {
    console.error('[legacy-circle] GET error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/legacy-circle/:id/approve ────────────────────────────────────
router.patch('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const profile = await prisma.legacyCircleProfile.findUnique({
      where: { id },
      include: BENEFICIARY_INCLUDE,
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: `Legacy Circle profile "${id}" not found.`,
      });
    }

    // Idempotency: already approved
    if (profile.status === 'approved') {
      const enriched = await enrichProfile(profile);
      return res.json({
        success: true,
        message: 'Profile was already approved.',
        data: enriched,
      });
    }

    const updated = await prisma.legacyCircleProfile.update({
      where: { id },
      data: { status: 'approved' },
      include: BENEFICIARY_INCLUDE,
    });

    // Fire notification (non-blocking)
    dispatchLegacyCircleBioPublished({ beneficiaryId: updated.beneficiaryId }).catch((err) => {
      console.error('[legacy-circle] dispatchLegacyCircleBioPublished error:', err.message);
    });

    const enriched = await enrichProfile(updated);

    return res.json({
      success: true,
      message: 'Legacy Circle profile approved successfully.',
      data: enriched,
    });
  } catch (err) {
    console.error('[legacy-circle] PATCH /:id/approve error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
