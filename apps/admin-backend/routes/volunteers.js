const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const { dispatchSaathiProfileApproved } = require('../services/events/community-event.dispatcher');

// GET /api/volunteers — list volunteers with optional status filter
router.get('/', async (req, res) => {
  const { status } = req.query;
  try {
    const where = {};
    if (status) {
      if (status === 'verified') {
        where.applicationStatus = 'APPROVED';
      } else if (status === 'pending') {
        where.applicationStatus = { in: ['SUBMITTED', 'UNDER_REVIEW'] };
      } else {
        where.applicationStatus = status.toUpperCase();
      }
    }

    const volunteers = await prisma.volunteer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        assignments: {
          where: { isActive: true },
          include: {
            beneficiary: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      }
    });

    res.json({ success: true, data: volunteers });
  } catch (err) {
    console.error('GET /api/volunteers error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/volunteers/:id — detail view with credit ledger history
router.get('/:id', async (req, res) => {
  try {
    const volunteer = await prisma.volunteer.findUnique({
      where: { id: req.params.id },
      include: {
        assignments: {
          where: { isActive: true },
          include: { beneficiary: true }
        },
        visitLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { beneficiary: true }
        },
        creditTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      }
    });

    if (!volunteer) {
      return res.status(404).json({ success: false, message: 'Volunteer not found' });
    }

    res.json({ success: true, data: volunteer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/volunteers/:id/verify — approve application
router.patch('/:id/verify', async (req, res) => {
  try {
    const volunteer = await prisma.volunteer.update({
      where: { id: req.params.id },
      data: {
        applicationStatus: 'APPROVED',
        verifiedAt: new Date(),
        verifiedById: req.user ? req.user.id : null, // req.user is set by verifyToken middleware
      }
    });

    // Zero latency impact: fire notification in background
    setImmediate(() => {
      dispatchSaathiProfileApproved({
        volunteerName: volunteer.name,
        volunteerPhone: volunteer.phone,
        volunteerUserId: volunteer.userId,
      }).catch(err => console.error('[VolunteersRoute] Notification Error:', err.message));
    });

    res.json({ success: true, data: volunteer, message: 'Volunteer profile verified successfully' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Volunteer not found' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/volunteers/:id/reject — reject application
router.patch('/:id/reject', async (req, res) => {
  const { rejectionReason } = req.body;
  if (!rejectionReason) {
    return res.status(400).json({ success: false, message: 'Rejection reason is required' });
  }

  try {
    const volunteer = await prisma.volunteer.update({
      where: { id: req.params.id },
      data: {
        applicationStatus: 'REJECTED',
        rejectionReason,
        rejectedAt: new Date(),
      }
    });

    res.json({ success: true, data: volunteer, message: 'Volunteer application rejected' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Volunteer not found' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

const { getConfigValue } = require('../utils/config');

// Helper for distance calculation (Haversine formula in KM)
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
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

// GET /api/volunteers/match-candidates/:beneficiaryId — Smart matching candidates ranked by score
router.get('/match-candidates/:beneficiaryId', async (req, res) => {
  try {
    const { beneficiaryId } = req.params;
    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      include: {
        volunteerAssignments: { where: { isActive: true } }
      }
    });

    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    }

    const maxPerVolunteer = await getConfigValue('max_beneficiaries_per_volunteer', 3);
    const maxPerBeneficiary = await getConfigValue('max_volunteers_per_beneficiary', 2);
    const searchRadiusKm = await getConfigValue('max_volunteer_search_radius_km', 15);

    const currentBeneficiaryVolCount = beneficiary.volunteerAssignments.length;
    const isBeneficiaryFull = currentBeneficiaryVolCount >= maxPerBeneficiary;

    // ── Rapido-Style Spatial Geo-Bounding Box DB Query ──
    let spatialWhereClause = { applicationStatus: 'APPROVED' };

    if (
      beneficiary.latitude !== null &&
      beneficiary.latitude !== undefined &&
      beneficiary.longitude !== null &&
      beneficiary.longitude !== undefined
    ) {
      const benLat = beneficiary.latitude;
      const benLng = beneficiary.longitude;

      const deltaLat = searchRadiusKm / 111.0;
      const deltaLng = searchRadiusKm / (111.0 * Math.cos((benLat * Math.PI) / 180));

      spatialWhereClause.latitude = {
        gte: benLat - deltaLat,
        lte: benLat + deltaLat,
      };
      spatialWhereClause.longitude = {
        gte: benLng - deltaLng,
        lte: benLng + deltaLng,
      };
    } else if (beneficiary.city) {
      spatialWhereClause.city = { equals: beneficiary.city, mode: 'insensitive' };
    }

    // Query DB for only nearby candidates within the spatial box
    let volunteers = await prisma.volunteer.findMany({
      where: spatialWhereClause,
      include: {
        assignments: {
          where: { isActive: true },
          include: { beneficiary: { select: { id: true, name: true } } }
        }
      }
    });

    // Fallback if no nearby candidates found (or initial setup without GPS)
    if (volunteers.length === 0) {
      volunteers = await prisma.volunteer.findMany({
        where: { applicationStatus: 'APPROVED' },
        include: {
          assignments: {
            where: { isActive: true },
            include: { beneficiary: { select: { id: true, name: true } } }
          }
        },
        take: 50
      });
    }

    const benHobbies = (beneficiary.hobbiesInterests || []).map((h) => h.toLowerCase());

    const candidates = volunteers.map((vol) => {
      const activeCount = vol.assignments.length;
      const isAlreadyAssigned = vol.assignments.some((a) => a.beneficiaryId === beneficiaryId);
      const isVolFull = activeCount >= maxPerVolunteer;

      // 1. Gender Match Score (Max 30)
      let genderScore = 0;
      const volGender = (vol.gender || '').toLowerCase();
      const benGender = (beneficiary.gender || '').toLowerCase();

      if (volGender && benGender && volGender === benGender) {
        genderScore = 30;
      } else if (!volGender || !benGender || volGender.includes('not') || benGender.includes('not')) {
        genderScore = 15;
      } else {
        genderScore = 0;
      }

      // 2. Hobbies / Interest Affinity Score (Max 30)
      let hobbyScore = 0;
      const volInterests = (vol.interests || []).map((i) => i.toLowerCase());
      const commonHobbies = volInterests.filter((interest) =>
        benHobbies.some((h) => h.includes(interest) || interest.includes(h))
      );

      if (benHobbies.length > 0) {
        hobbyScore = Math.min(30, Math.round((commonHobbies.length / Math.max(1, benHobbies.length)) * 30));
      }

      // 3. Proximity / Location Score (Max 25)
      let locationScore = 0;
      let distanceKm = calculateHaversineDistance(
        vol.latitude,
        vol.longitude,
        beneficiary.latitude,
        beneficiary.longitude
      );

      if (distanceKm !== null) {
        if (distanceKm <= 2) locationScore = 25;
        else if (distanceKm <= 5) locationScore = 20;
        else if (distanceKm <= 10) locationScore = 12;
        else if (distanceKm <= 20) locationScore = 5;
        else locationScore = 0;
      } else if (vol.pincode && beneficiary.pincode && vol.pincode === beneficiary.pincode) {
        locationScore = 20;
      } else if (vol.city && beneficiary.city && vol.city.toLowerCase() === beneficiary.city.toLowerCase()) {
        locationScore = 10;
      }

      // 4. Capacity Load Score (Max 15)
      const remainingSlots = Math.max(0, maxPerVolunteer - activeCount);
      const capacityScore = Math.round((remainingSlots / Math.max(1, maxPerVolunteer)) * 15);

      const totalScore = genderScore + hobbyScore + locationScore + capacityScore;

      return {
        volunteer: {
          id: vol.id,
          name: vol.name,
          phone: vol.phone,
          gender: vol.gender,
          city: vol.city,
          pincode: vol.pincode,
          interests: vol.interests,
          assignments: vol.assignments,
          activeCount,
          maxPerVolunteer,
        },
        matchScore: totalScore,
        scoreBreakdown: {
          genderScore,
          hobbyScore,
          locationScore,
          capacityScore,
          commonHobbies,
          distanceKm: distanceKm !== null ? Math.round(distanceKm * 10) / 10 : null,
        },
        isAlreadyAssigned,
        isVolFull,
        isEligible: !isAlreadyAssigned && !isVolFull && !isBeneficiaryFull,
      };
    });

    candidates.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      success: true,
      data: {
        beneficiary: {
          id: beneficiary.id,
          name: beneficiary.name,
          gender: beneficiary.gender,
          city: beneficiary.city,
          pincode: beneficiary.pincode,
          hobbiesInterests: beneficiary.hobbiesInterests,
          assignedVolunteersCount: currentBeneficiaryVolCount,
          maxPerBeneficiary,
          isBeneficiaryFull,
        },
        candidates,
      },
    });
  } catch (err) {
    console.error('GET match-candidates error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/volunteers/:id/assignments — assign a beneficiary (Many-to-Many with capacity caps)
router.post('/:id/assignments', async (req, res) => {
  const volunteerId = req.params.id;
  const { beneficiaryId } = req.body;

  if (!beneficiaryId) {
    return res.status(400).json({ success: false, message: 'beneficiaryId is required' });
  }

  try {
    const maxPerVolunteer = await getConfigValue('max_beneficiaries_per_volunteer', 3);
    const maxPerBeneficiary = await getConfigValue('max_volunteers_per_beneficiary', 2);

    // Check volunteer active assignment capacity
    const volActiveCount = await prisma.volunteerAssignment.count({
      where: { volunteerId, isActive: true }
    });

    const isAlreadyAssigned = await prisma.volunteerAssignment.findUnique({
      where: { volunteerId_beneficiaryId: { volunteerId, beneficiaryId } }
    });

    if (!isAlreadyAssigned?.isActive && volActiveCount >= maxPerVolunteer) {
      return res.status(400).json({
        success: false,
        message: `Volunteer capacity reached (${volActiveCount}/${maxPerVolunteer} max beneficiaries assigned)`
      });
    }

    // Check beneficiary active volunteer capacity
    const benActiveCount = await prisma.volunteerAssignment.count({
      where: { beneficiaryId, isActive: true }
    });

    if (!isAlreadyAssigned?.isActive && benActiveCount >= maxPerBeneficiary) {
      return res.status(400).json({
        success: false,
        message: `Beneficiary volunteer capacity reached (${benActiveCount}/${maxPerBeneficiary} max volunteers assigned)`
      });
    }

    const assignment = await prisma.volunteerAssignment.upsert({
      where: {
        volunteerId_beneficiaryId: { volunteerId, beneficiaryId }
      },
      update: {
        isActive: true,
      },
      create: {
        volunteerId,
        beneficiaryId,
        assignedById: req.user ? req.user.id : null,
        isActive: true,
      },
      include: {
        beneficiary: {
          select: { id: true, name: true }
        }
      }
    });

    res.status(201).json({ success: true, data: assignment, message: 'Beneficiary assigned successfully' });
  } catch (err) {
    console.error('POST assignment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/volunteers/:id/assignments/:beneficiaryId — remove assignment
router.delete('/:id/assignments/:beneficiaryId', async (req, res) => {
  const volunteerId = req.params.id;
  const { beneficiaryId } = req.params;

  try {
    await prisma.volunteerAssignment.update({
      where: {
        volunteerId_beneficiaryId: { volunteerId, beneficiaryId }
      },
      data: {
        isActive: false
      }
    });

    res.json({ success: true, message: 'Assignment removed successfully' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
