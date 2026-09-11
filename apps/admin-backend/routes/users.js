const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');

const router = express.Router();

const { prisma } = require('../lib/prisma');
const { dispatchCMOnboardingCleared } = require('../services/events/account-event.dispatcher');

const SUPPORTED_ONBOARDING_ROLES = new Set([
  'care_companion',
  'field_manager',
  'operations_manager',
  'sales',
  'customer_service',
]);

const SUPPORTED_BACKGROUND_CHECK_TYPES = new Set([
  'police_clearance',
  'address_verification',
  'employment_history',
  'education_verification',
  'identity_verification',
  'reference_check',
]);

const SUPPORTED_SHIFT_PREFERENCES = new Set([
  'any',
  'morning',
  'afternoon',
  'evening',
  'night',
]);

const SUPPORTED_DOCUMENT_TYPES = new Set([
  'aadhaar_front',
  'aadhaar_back',
  'pan_card',
  'nursing_certificate',
  'first_aid_certificate',
  'offer_letter',
  'bgv_report',
  'other',
]);

const REQUIRED_DOCUMENTS_BY_ROLE = {
  care_companion: ['aadhaar_front', 'aadhaar_back', 'nursing_certificate'],
  field_manager: ['aadhaar_front', 'aadhaar_back'],
  operations_manager: ['aadhaar_front', 'aadhaar_back'],
  customer_service: ['aadhaar_front', 'aadhaar_back'],
};

const TRAININGS_BY_ROLE = {
  care_companion: [
    {
      trainingType: 'geriatric_care_orientation',
      title: 'Geriatric care orientation',
    },
    {
      trainingType: 'first_aid_emergency_response',
      title: 'First aid and emergency response',
    },
    {
      trainingType: 'vitals_capture_documentation',
      title: 'Vitals capture and documentation',
    },
  ],
  field_manager: [
    {
      trainingType: 'geriatric_care_orientation',
      title: 'MaiHoonNa field leadership orientation',
    },
  ],
  operations_manager: [
    {
      trainingType: 'geriatric_care_orientation',
      title: 'MaiHoonNa operations leadership orientation',
    },
  ],
  customer_service: [
    {
      trainingType: 'geriatric_care_orientation',
      title: 'Customer service excellence orientation',
    },
  ],
};

const REQUIRED_ONBOARDING_MODELS = [
  'operationsManager',
  'staffProfile',
  'staffDocument',
  'staffBackgroundCheck',
  'staffTraining',
];

function ensureOnboardingModels(res) {
  const missingModels = REQUIRED_ONBOARDING_MODELS.filter(
    (modelName) => typeof prisma[modelName] === 'undefined'
  );

  if (missingModels.length === 0) {
    return true;
  }

  res.status(500).json({
    success: false,
    message: `Prisma client is missing onboarding models: ${missingModels.join(', ')}. Run prisma generate in the main backend before using onboarding APIs.`,
  });
  return false;
}

// ── POST /api/users/push-token ── Save Expo FCM push token on user record ──
router.post(['/push-token', '/shared/users/push-token'], async (req, res) => {
  try {
    const { token, userId: bodyUserId } = req.body;
    const userId = req.user?.id || bodyUserId;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Push token is required' });
    }

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { fcmToken: token }
    });

    console.log(`[PushToken] Saved FCM token for user ${userId}`);
    res.json({ success: true, message: 'Push token updated successfully' });
  } catch (err) {
    console.error('POST /push-token error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/users/push-token ── Unregister Expo FCM push token on logout ──
router.delete(['/push-token', '/shared/users/push-token'], async (req, res) => {
  try {
    const { userId: bodyUserId } = req.body || {};
    const userId = req.user?.id || bodyUserId;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { fcmToken: null }
    });

    console.log(`[PushToken] Cleared FCM token for user ${userId}`);
    res.json({ success: true, message: 'Push token cleared successfully' });
  } catch (err) {
    console.error('DELETE /push-token error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

function asTrimmedString(value) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).trim();
}

function asNullableString(value) {
  const trimmed = asTrimmedString(value);
  return trimmed ? trimmed : null;
}

function asOptionalInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function asOptionalDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => asTrimmedString(item)).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeRole(role) {
  const value = asTrimmedString(role);
  return SUPPORTED_ONBOARDING_ROLES.has(value) ? value : null;
}

function normalizeDocuments(documents, role) {
  const requiredDocuments = new Set(REQUIRED_DOCUMENTS_BY_ROLE[role] || []);

  if (!Array.isArray(documents)) {
    return [];
  }

  return documents
    .map((document) => {
      const documentType = asTrimmedString(document?.documentType);
      if (!SUPPORTED_DOCUMENT_TYPES.has(documentType)) {
        return null;
      }

      return {
        documentType,
        fileName: asNullableString(document?.fileName),
        // fileUrl is now managed by the backend upload flow exclusively
        mimeType: asNullableString(document?.mimeType),
        fileSizeBytes: asOptionalInt(document?.fileSizeBytes),
        isRequired: requiredDocuments.has(documentType),
        isVerified: false,
        notes: asNullableString(document?.notes),
      };
    })
    .filter(Boolean);
}

function buildEmploymentStatus(role, documents, backgroundCheckType) {
  const requiredDocuments = REQUIRED_DOCUMENTS_BY_ROLE[role] || [];
  const providedDocumentTypes = new Set(
    documents.map((document) => document.documentType)
  );
  const hasAllRequiredDocuments = requiredDocuments.every((documentType) =>
    providedDocumentTypes.has(documentType)
  );

  if (!hasAllRequiredDocuments) {
    return 'pending_documents';
  }

  if (backgroundCheckType) {
    return 'bgv_pending';
  }

  return 'pending_verification';
}

function buildTrainingRows(role, staffProfileId) {
  return (TRAININGS_BY_ROLE[role] || []).map((training) => ({
    staffProfileId,
    trainingType: training.trainingType,
    title: training.title,
    status: 'assigned',
  }));
}

function mapCareCompanion(companion) {
  const staffProfile = companion.user?.staffProfile || null;
  const latestBackgroundCheck = staffProfile?.backgroundChecks?.[0] || null;

  return {
    id: companion.id,
    userId: companion.userId,
    name: companion.user?.name || companion.name,
    phone: companion.user?.phone || '',
    email: companion.user?.email || null,
    photo: companion.user?.profilePhoto || companion.photo || null,
    bio: companion.bio || '',
    zone: companion.zone,
    zoneId: staffProfile?.zoneId || null,
    teamId: companion.teamId || staffProfile?.teamId || null,
    teamName: companion.team?.name || null,
    experience: companion.experience,
    qualifications: companion.qualifications || [],
    skills: companion.specialization || [], // UI uses 'skills'
    languages: companion.languages || [],
    shiftPreference: companion.shiftPreference,
    maxDailyVisits: companion.maxDailyVisits,
    utilization: 0, // Mock for UI; will be calculated from visits later
    isAvailable: Boolean(
      companion.isAvailable && (companion.user?.isActive ?? true)
    ),
    isActive: companion.user?.isActive ?? true,
    employmentStatus: staffProfile?.employmentStatus || 'draft',
    bgvStatus: latestBackgroundCheck?.status || null,
    backgroundVerification: {
      policeVerificationStatus:
        latestBackgroundCheck?.status === 'cleared' ? 'verified' : 'pending',
    },
    bgvVerified: staffProfile?.bgvVerified ?? false,
    kycVerified: staffProfile?.kycVerified ?? false,
    ccType: companion.ccType || 'care_assistant',
    joinedAt:
      companion.joinedAt || staffProfile?.joinedAt || companion.createdAt,
    createdAt: companion.createdAt,
  };
}

function mapFieldManager(manager) {
  const staffProfile = manager.user?.staffProfile || null;

  return {
    id: manager.id,
    userId: manager.userId,
    name: manager.user?.name || manager.name,
    photo: manager.user?.profilePhoto || manager.photo || null,
    phone: manager.user?.phone || manager.phone || '',
    email: manager.user?.email || null,
    zone: manager.zone,
    zoneId: staffProfile?.zoneId || null,
    qualification: manager.qualification,
    experience: manager.experience,
    previousEmployer: manager.previousEmployer,
    maxTeamSize: manager.maxTeamSize,
    canApproveRoster: manager.canApproveRoster,
    canOnboardCCs: manager.canOnboardCCs,
    isAvailable: Boolean(
      manager.isAvailable && (manager.user?.isActive ?? true)
    ),
    isActive: manager.user?.isActive ?? true,
    teamCount: manager.teams?.length || 0,
    teamNames: (manager.teams || []).map((team) => team.name),
    beneficiaryCount: (manager.teams || []).reduce((sum, team) => sum + (team._count?.beneficiaries || 0), 0),
    reportsToUserId:
      manager.reportsToUserId || staffProfile?.reportsToUserId || null,
    specialization: staffProfile?.specialization || manager.specialization || [],
    employmentStatus: staffProfile?.employmentStatus || 'draft',
    bgvVerified: staffProfile?.bgvVerified ?? false,
    kycVerified: staffProfile?.kycVerified ?? false,
    joinedAt: manager.joinedAt || staffProfile?.joinedAt || manager.createdAt,
    createdAt: manager.createdAt,
  };
}

function mapOperationsManager(manager) {
  const staffProfile = manager.user?.staffProfile || null;
  return {
    id: manager.id,
    userId: manager.userId,
    name: manager.user?.name || manager.name,
    photo: manager.user?.profilePhoto || manager.photo || null,
    phone: manager.user?.phone || manager.phone || '',
    email: manager.user?.email || null,
    qualification: manager.qualification,
    experience: manager.experience,
    specialization: staffProfile?.specialization || [],
    isAvailable: Boolean(
      manager.isAvailable && (manager.user?.isActive ?? true)
    ),
    isActive: manager.user?.isActive ?? true,
    assignedZones: (manager.user?.zonesAsOperationsManager || []).map(
      (zone) => ({
        id: zone.id,
        name: zone.name,
        city: zone.city,
        pincode: zone.pincode,
      })
    ),
    bgvVerified: manager.user?.staffProfile?.bgvVerified ?? false,
    kycVerified: manager.user?.staffProfile?.kycVerified ?? false,
    joinedAt: manager.createdAt,
    createdAt: manager.createdAt,
  };
}

async function buildOnboardingMetadata() {
  const [zones, teams, operationsManagers] = await Promise.all([
    prisma.zone.findMany({
      where: { isActive: true },
      orderBy: [{ city: 'asc' }, { name: 'asc' }],
    }),
    prisma.team.findMany({
      include: {
        fieldManager: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            careCompanions: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.operationsManager.findMany({
      where: { user: { isActive: true } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            isActive: true,
            zonesAsOperationsManager: {
              select: {
                id: true,
                name: true,
                city: true,
                pincode: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    zones: zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      city: zone.city,
      state: zone.state,
      pincode: zone.pincode,
      operationsManagerId: zone.operationsManagerId,
      regionId: zone.regionId,
    })),
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      zone: team.zone,
      maxCapacity: team.maxCapacity,
      currentCapacity: team._count?.careCompanions || 0,
      fieldManagerId: team.fieldManagerId,
      fieldManagerName:
        team.fieldManager?.user?.name ||
        team.fieldManager?.name ||
        'Unassigned',
    })),
    operationsManagers: operationsManagers.map(mapOperationsManager),
    specializations: [
      'Elderly Care',
      'Post-Operative Recovery',
      'Diabetes Management',
      'Dementia Support',
      'Physiotherapy Assistance',
      'Palliative Care',
      'Emergency First Aid',
      'Medication Management',
    ],
  };
}

router.get('/field-managers', async (req, res) => {
  try {
    if (!ensureOnboardingModels(res)) return;

    const { search, page, limit } = req.query;
    const filterParams = { user: { isActive: true } };

    const searchStr = (typeof search === 'string' && search.trim()) ? search.trim() : null;
    if (searchStr) {
      filterParams.OR = [
        { name: { contains: searchStr, mode: 'insensitive' } },
        { zone: { contains: searchStr, mode: 'insensitive' } },
      ];
    }

    const listQuery = {
      where: filterParams,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            isActive: true,
            profilePhoto: true,
            staffProfile: {
              select: {
                zoneId: true,
                reportsToUserId: true,
                employmentStatus: true,
                bgvVerified: true,
                kycVerified: true,
                joinedAt: true,
              },
            },
          },
        },
        teams: {
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                beneficiaries: true,
              },
            },
          },
        },
      },
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

    const [managers, total] = await Promise.all([
      prisma.fieldManager.findMany(listQuery),
      prisma.fieldManager.count({ where: filterParams }),
    ]);

    const mapped = managers.map(mapFieldManager);
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
    console.error('GET /field-managers error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch field managers' });
  }
});

router.get('/operations-managers', async (req, res) => {
  try {
    if (!ensureOnboardingModels(res)) return;

    const { search, page, limit } = req.query;
    const filterParams = { user: { isActive: true } };

    const searchStr = (typeof search === 'string' && search.trim()) ? search.trim() : null;
    if (searchStr) {
      filterParams.name = { contains: searchStr, mode: 'insensitive' };
    }

    const listQuery = {
      where: filterParams,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            isActive: true,
            profilePhoto: true,
            zonesAsOperationsManager: {
              select: {
                id: true,
                name: true,
                city: true,
                pincode: true,
              },
            },
            staffProfile: {
              select: {
                bgvVerified: true,
                kycVerified: true,
              },
            },
          },
        },
      },
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

    const [managers, total] = await Promise.all([
      prisma.operationsManager.findMany(listQuery),
      prisma.operationsManager.count({ where: filterParams }),
    ]);

    const mapped = managers.map(mapOperationsManager);
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
    console.error('GET /operations-managers error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch operations managers' });
  }
});

router.get('/staff/onboarding-metadata', async (req, res) => {
  try {
    if (!ensureOnboardingModels(res)) return;

    const metadata = await buildOnboardingMetadata();
    res.json({ success: true, data: metadata });
  } catch (err) {
    console.error('GET /staff/onboarding-metadata error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch onboarding metadata' });
  }
});

router.post('/staff/onboard', async (req, res) => {
  try {
    if (!ensureOnboardingModels(res)) return;

    const role = normalizeRole(req.body?.role);
    const personal = (req.body?.personal && typeof req.body.personal === 'object' && !Array.isArray(req.body.personal)) ? req.body.personal : {};
    const professional = (req.body?.professional && typeof req.body.professional === 'object' && !Array.isArray(req.body.professional)) ? req.body.professional : {};
    const assignment = (req.body?.assignment && typeof req.body.assignment === 'object' && !Array.isArray(req.body.assignment)) ? req.body.assignment : {};
    const documents = normalizeDocuments(req.body?.documents, role);

    if (!role) {
      return res
        .status(400)
        .json({ success: false, message: 'A valid staff role is required' });
    }

    const fullName = asTrimmedString(personal.fullName);
    const mobileNumber = asTrimmedString(personal.mobileNumber);
    const email = asNullableString(personal.email)?.toLowerCase() || null;
    const preferredName = asNullableString(personal.preferredName);
    const aadhaarNumber = asNullableString(personal.aadhaarNumber);
    const panNumber =
      asNullableString(personal.panNumber)?.toUpperCase() || null;
    const languageList = asStringArray(professional.languages);

    if (!fullName || !mobileNumber || !aadhaarNumber) {
      return res.status(400).json({
        success: false,
        message: 'Full name, mobile number, and Aadhaar number are required',
      });
    }

    if (mobileNumber.length < 10) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Mobile number should be at least 10 digits',
        });
    }

    const zoneIds =
      role === 'operations_manager'
        ? asStringArray(assignment.zoneIds)
        : [asTrimmedString(assignment.zoneId)].filter(Boolean);
    const primaryZoneId = zoneIds[0] || null;
    const teamId =
      role === 'care_companion' ? asNullableString(assignment.teamId) : null;
    const reportsToUserId =
      role === 'field_manager'
        ? asNullableString(assignment.reportsToUserId)
        : null;
    const backgroundCheckType = asTrimmedString(assignment.bgvType);
    const backgroundCheckAgency = asNullableString(assignment.bgvAgency);

    console.log('[DEBUG] Onboarding:', { role, zoneIdsLength: zoneIds.length });
    if (!zoneIds.length && role !== 'customer_service') {
      return res
        .status(400)
        .json({
          success: false,
          message: 'At least one zone must be selected',
        });
    }

    if (
      backgroundCheckType &&
      !SUPPORTED_BACKGROUND_CHECK_TYPES.has(backgroundCheckType)
    ) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid BGV type selected' });
    }

    if (
      role === 'care_companion' &&
      !asTrimmedString(professional.qualification)
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Qualification is required for care companions',
        });
    }

    if (
      role === 'field_manager' &&
      !asTrimmedString(professional.qualification)
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Qualification is required for field managers',
        });
    }

    if (
      role === 'operations_manager' &&
      !asTrimmedString(professional.qualification)
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Qualification is required for operations managers',
        });
    }

    const [existingUser, zones, selectedTeam, reportsToUser] =
      await Promise.all([
        prisma.user.findFirst({
          where: {
            OR: [{ phone: mobileNumber }, ...(email ? [{ email }] : [])],
          },
          select: { id: true, phone: true, email: true },
        }),
        prisma.zone.findMany({
          where: { id: { in: zoneIds } },
          orderBy: { name: 'asc' },
        }),
        teamId
          ? prisma.team.findUnique({
              where: { id: teamId },
              include: {
                _count: {
                  select: {
                    careCompanions: true,
                  },
                },
              },
            })
          : Promise.resolve(null),
        reportsToUserId
          ? prisma.user.findUnique({
              where: { id: reportsToUserId },
              select: { id: true, role: true, name: true },
            })
          : Promise.resolve(null),
      ]);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user with the same phone number or email already exists',
      });
    }

    if (zones.length !== zoneIds.length) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'One or more selected zones are invalid',
        });
    }

    if (selectedTeam && primaryZoneId) {
      const selectedZone = zones.find((zone) => zone.id === primaryZoneId);
      const teamMatchesZone =
        selectedZone &&
        (selectedTeam.zone === selectedZone.id ||
          selectedTeam.zone === selectedZone.name);
      if (!teamMatchesZone) {
        return res
          .status(400)
          .json({
            success: false,
            message: 'Selected team does not belong to the chosen zone',
          });
      }

      const { getConfigValue } = require('../utils/config');
      const maxCc = await getConfigValue('max_cc_per_team', 15);
      if (selectedTeam._count?.careCompanions >= maxCc) {
        return res
          .status(400)
          .json({
            success: false,
            message: `Selected team is already at full capacity (${maxCc} Care Companions)`,
          });
      }
    }

    if (
      reportsToUserId &&
      (!reportsToUser || reportsToUser.role !== 'operations_manager')
    ) {
      return res.status(400).json({
        success: false,
        message: 'Reports-to user must be an operations manager',
      });
    }

    if (role === 'operations_manager') {
      const occupiedZones = zones.filter((zone) => zone.operationsManagerId);
      if (occupiedZones.length) {
        return res.status(409).json({
          success: false,
          message: `The following zones already have an operations manager assigned: ${occupiedZones.map((zone) => zone.name).join(', ')}`,
        });
      }
    }

    const normalizedShiftPreference =
      asTrimmedString(professional.preferredShift) || 'any';
    const shiftPreference = SUPPORTED_SHIFT_PREFERENCES.has(
      normalizedShiftPreference
    )
      ? normalizedShiftPreference
      : 'any';

    const employmentStatus = buildEmploymentStatus(
      role,
      documents,
      backgroundCheckType
    );
    const primaryZone = zones.find((zone) => zone.id === primaryZoneId) || null;

    const created = await prisma.$transaction(async (tx) => {
      const userData = {
        name: fullName,
        phone: mobileNumber,
        email,
        role,
        isActive: true,
        isVerified: false,
        profilePhoto: asNullableString(personal.photoUrl),
      };

      if (typeof personal?.newPassword === 'string' && personal.newPassword.trim().length >= 6) {
        const salt = await bcrypt.genSalt(10);
        userData.password = await bcrypt.hash(
          personal.newPassword.trim(),
          salt
        );
      }

      const user = await tx.user.create({
        data: userData,
      });

      const staffProfile = await tx.staffProfile.create({
        data: {
          userId: user.id,
          role,
          preferredName,
          dateOfBirth: asOptionalDate(personal.dateOfBirth),
          gender: asTrimmedString(personal.gender) || 'prefer_not_to_say',
          whatsappPhone: asNullableString(personal.whatsappNumber),
          alternatePhone: asNullableString(personal.alternatePhone),
          addressLine1: asNullableString(personal.addressLine1),
          addressLine2: asNullableString(personal.addressLine2),
          city: asNullableString(personal.city),
          state: asNullableString(personal.state),
          pincode: asNullableString(personal.pincode),
          aadhaarNumberEncrypted: aadhaarNumber,
          panNumberEncrypted: panNumber,
          languages: languageList,
          specialization: asStringArray(professional.specialization),
          zoneId: primaryZoneId,
          teamId,
          reportsToUserId,
          bgvType: backgroundCheckType,
          bgvAgency: backgroundCheckAgency,
          bgvVerified: Boolean(assignment.bgvVerified),
          kycVerified: Boolean(assignment.kycVerified),
          employmentStatus,
          joinedAt: new Date(),
          notes: asNullableString(req.body?.notes),
        },
      });

      let roleRecord = null;

      if (role === 'care_companion') {
        roleRecord = await tx.careCompanion.create({
          data: {
            userId: user.id,
            name: fullName,
            bio: asTrimmedString(professional.bio) || '',
            zone: primaryZone?.name || '',
            experience: asOptionalInt(professional.experience),
            qualifications: [
              asTrimmedString(professional.qualification),
            ].filter(Boolean),
            languages: languageList,
            nursingRegistrationNumber: asNullableString(
              professional.nursingRegistrationNumber
            ),
            nursingCouncil: asNullableString(professional.nursingCouncil),
            ccType: asTrimmedString(professional.ccType) || 'care_assistant',
            shiftPreference,
            maxDailyVisits: asOptionalInt(professional.maxDailyVisits),
            willingClinicVisits: Boolean(professional.willingClinicVisits),
            hasTwoWheeler: Boolean(professional.hasTwoWheeler),
            teamId,
            joinedAt: new Date(),
            isAvailable: true,
          },
        });
      }

      if (role === 'field_manager') {
        roleRecord = await tx.fieldManager.create({
          data: {
            userId: user.id,
            name: fullName,
            bio: asTrimmedString(professional.bio) || '',
            zone: primaryZone?.name || '',
            phone: mobileNumber,
            qualification: asNullableString(professional.qualification),
            experience: asOptionalInt(professional.experience),
            previousEmployer: asNullableString(professional.previousEmployer),
            maxTeamSize: asOptionalInt(professional.maxTeamSize) || 15,
            canApproveRoster: professional.canApproveRoster !== false,
            canOnboardCCs: Boolean(professional.canOnboardCCs),
            reportsToUserId,
            joinedAt: new Date(),
            isAvailable: true,
          },
        });
      }

      if (role === 'operations_manager') {
        roleRecord = await tx.operationsManager.create({
          data: {
            userId: user.id,
            name: fullName,
            bio: asTrimmedString(professional.bio) || '',
            phone: mobileNumber,
            qualification: asNullableString(professional.qualification),
            experience: asOptionalInt(professional.experience),
            isAvailable: true,
          },
        });

        for (const zoneId of zoneIds) {
          await tx.zone.update({
            where: { id: zoneId },
            data: {
              operationsManagerId: user.id,
            },
          });
        }
      }

      if (role === 'customer_service') {
        roleRecord = await tx.customerServiceAgent.create({
          data: {
            userId: user.id,
            name: fullName,
            bio: asTrimmedString(professional.bio) || '',
            phone: mobileNumber,
            qualification: asNullableString(professional.qualification),
            experience: asOptionalInt(professional.experience),
            isAvailable: true,
          },
        });
      }

      if (documents.length) {
        await tx.staffDocument.createMany({
          data: documents.map((document) => ({
            staffProfileId: staffProfile.id,
            documentType: document.documentType,
            fileName: document.fileName,
            // fileUrl removed, populated via separate upload route
            mimeType: document.mimeType,
            fileSizeBytes: document.fileSizeBytes,
            isRequired: document.isRequired,
            isVerified: document.isVerified,
            notes: document.notes,
          })),
        });
      }

      if (backgroundCheckType) {
        await tx.staffBackgroundCheck.create({
          data: {
            staffProfileId: staffProfile.id,
            backgroundCheckType,
            status: 'pending',
            agency: backgroundCheckAgency,
            initiatedAt: new Date(),
            notes: 'Initiated during admin onboarding',
          },
        });
      }

      const trainings = buildTrainingRows(role, staffProfile.id);
      if (trainings.length) {
        await tx.staffTraining.createMany({ data: trainings });
      }

      return {
        user,
        staffProfile,
        roleRecord,
      };
    });

    if (role === 'care_companion' && created.user) {
      (async () => {
        try {
          let fmName = 'Care Operations Team';
          if (teamId) {
            const team = await prisma.team.findUnique({
              where: { id: teamId },
              include: { fieldManager: true },
            });
            if (team?.fieldManager?.name) {
              fmName = team.fieldManager.name;
            }
          }
          await dispatchCMOnboardingCleared({
            ccUserId: created.user.id,
            ccName: created.user.name || fullName,
            fmName,
          });
        } catch (dispatchErr) {
          console.error('[StaffOnboard:Notify] Notification error:', dispatchErr.message);
        }
      })();
    }

    res.status(201).json({
      success: true,
      message: 'Staff member onboarded successfully',
      data: created,
    });
  } catch (err) {
    console.error('POST /staff/onboard error:', err);
    res.status(500).json({
      success: false,
      message: err?.message || 'Failed to onboard staff member',
    });
  }
});

router.post('/staff', async (req, res) => {
  try {
    const { name, phone, role, zoneId, bio, specialization } = req.body;

    const user = await prisma.user.create({
      data: {
        name,
        phone,
        role: role || 'care_companion',
        isActive: true,
      },
    });

    if (user.role === 'care_companion') {
      await prisma.careCompanion.create({
        data: {
          userId: user.id,
          name,
          zone: zoneId || 'Unassigned',
          bio: bio || 'Professional Care Companion',
          specialization: specialization || ['General Care'],
          isAvailable: true,
        },
      });
    } else if (user.role === 'field_manager') {
      await prisma.fieldManager.create({
        data: {
          userId: user.id,
          name,
          zone: zoneId || 'Unassigned',
          isAvailable: true,
        },
      });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    console.error('POST /staff error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to create staff member' });
  }
});

router.get('/care-companions', async (req, res) => {
  try {
    if (!ensureOnboardingModels(res)) return;

    const { search, searchBy, page, limit, ccType } = req.query;
    const filterParams = { user: { isActive: true } };

    if (ccType && ccType !== 'all') {
      filterParams.ccType = ccType;
    }

    const searchStr = (typeof search === 'string' && search.trim()) ? search.trim() : null;
    if (searchStr) {
      if (searchBy === 'name') {
        filterParams.name = { contains: searchStr, mode: 'insensitive' };
      } else if (searchBy === 'zone') {
        filterParams.zone = { contains: searchStr, mode: 'insensitive' };
      } else {
        filterParams.OR = [
          { name: { contains: searchStr, mode: 'insensitive' } },
          { zone: { contains: searchStr, mode: 'insensitive' } },
        ];
      }
    }

    // RBAC: Field Manager only sees CCs in their team(s)
    if (req.user && req.user.role === 'field_manager') {
      const fm = await prisma.fieldManager.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (fm) {
        const teams = await prisma.team.findMany({
          where: { fieldManagerId: fm.id },
          select: { id: true },
        });
        const teamIds = teams.map((t) => t.id);
        filterParams.user = {
          isActive: true,
          staffProfile: { teamId: { in: teamIds } },
        };
      } else {
        // FM has no profile, return empty
        return res.json({ success: true, data: [] });
      }
    }

    const listQuery = {
      where: filterParams,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            isActive: true,
            profilePhoto: true,
            staffProfile: {
              select: {
                zoneId: true,
                teamId: true,
                employmentStatus: true,
                bgvVerified: true,
                kycVerified: true,
                joinedAt: true,
                documents: {
                  select: {
                    documentType: true,
                    isVerified: true,
                  },
                },
                backgroundChecks: {
                  select: {
                    backgroundCheckType: true,
                    status: true,
                    createdAt: true,
                  },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
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

    const [companions, total] = await Promise.all([
      prisma.careCompanion.findMany(listQuery),
      prisma.careCompanion.count({ where: filterParams }),
    ]);

    const mapped = companions.map(mapCareCompanion);
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
    console.error('GET /care-companions error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch care companions' });
  }
});

router.get('/customer-service-agents', async (req, res) => {
  try {
    if (!ensureOnboardingModels(res)) return;

    const { search, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {
      role: 'customer_service',
      isActive: true,
    };

    const searchStr = (typeof search === 'string' && search.trim()) ? search.trim() : null;
    if (searchStr) {
      where.name = { contains: searchStr, mode: 'insensitive' };
    }

    const [agents, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          staffProfile: true,
          customerServiceProfile: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ]);

    const mapped = agents.map((user) => ({
      id: user.customerServiceProfile?.id || `temp-csa-${user.id}`,
      userId: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      qualification: user.customerServiceProfile?.qualification || 'N/A',
      experience: user.customerServiceProfile?.experience || 0,
      isAvailable: user.isActive,
      bgvVerified: user.staffProfile?.bgvVerified || false,
      kycVerified: user.staffProfile?.kycVerified || false,
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
    console.error('GET /customer-service-agents error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch customer service agents' });
  }
});

router.get('/staff/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    if (!ensureOnboardingModels(res)) return;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        staffProfile: {
          include: {
            documents: true,
            backgroundChecks: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
        careCompanionProfile: true,
        fieldManagerProfile: {
          include: { teams: true },
        },
        operationsManagerProfile: true,
        customerServiceProfile: true,
        zonesAsOperationsManager: {
          select: {
            id: true,
            name: true,
            city: true,
            pincode: true,
          },
        },
      },
    });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: 'Staff member not found' });

    const responseData = {
      role: user.role,
      personal: {
        fullName: user.name || '',
        photoUrl: user.profilePhoto || null,
        preferredName: user.staffProfile?.preferredName || '',
        dateOfBirth: user.staffProfile?.dateOfBirth
          ? user.staffProfile.dateOfBirth.toISOString().split('T')[0]
          : '',
        gender: user.staffProfile?.gender || 'female',
        mobileNumber: user.phone || '',
        whatsappNumber: user.staffProfile?.whatsappPhone || '',
        email: user.email || '',
        alternatePhone: user.staffProfile?.alternatePhone || '',
        addressLine1: user.staffProfile?.addressLine1 || '',
        addressLine2: user.staffProfile?.addressLine2 || '',
        city: user.staffProfile?.city || '',
        state: user.staffProfile?.state || '',
        pincode: user.staffProfile?.pincode || '',
        aadhaarNumber: user.staffProfile?.aadhaarNumberEncrypted || '',
        panNumber: user.staffProfile?.panNumberEncrypted || '',
      },
      professional: {
        qualification:
          user.careCompanionProfile?.qualifications?.[0] ||
          user.fieldManagerProfile?.qualification ||
          user.operationsManagerProfile?.qualification ||
          user.customerServiceProfile?.qualification ||
          '',
        bio:
          user.careCompanionProfile?.bio ||
          user.fieldManagerProfile?.bio ||
          user.operationsManagerProfile?.bio ||
          user.customerServiceProfile?.bio ||
          '',
        experience: String(
          user.careCompanionProfile?.experience ||
            user.fieldManagerProfile?.experience ||
            user.operationsManagerProfile?.experience ||
            user.customerServiceProfile?.experience ||
            ''
        ),
        nursingRegistrationNumber:
          user.careCompanionProfile?.nursingRegistrationNumber || '',
        nursingCouncil: user.careCompanionProfile?.nursingCouncil || '',
        previousEmployer: user.fieldManagerProfile?.previousEmployer || '',
        maxTeamSize: String(user.fieldManagerProfile?.maxTeamSize || 15),
        languages: user.staffProfile?.languages || [],
        preferredShift: user.careCompanionProfile?.shiftPreference || 'any',
        maxDailyVisits: String(user.careCompanionProfile?.maxDailyVisits || 4),
        willingClinicVisits:
          user.careCompanionProfile?.willingClinicVisits || false,
        hasTwoWheeler: user.careCompanionProfile?.hasTwoWheeler || false,
        canApproveRoster: user.fieldManagerProfile?.canApproveRoster !== false,
        canOnboardCCs: user.fieldManagerProfile?.canOnboardCCs || false,
        ccType: user.careCompanionProfile?.ccType || 'care_assistant',
        specialization:
          user.staffProfile?.specialization ||
          user.careCompanionProfile?.specialization ||
          [],
      },
      assignment: {
        zoneId: user.staffProfile?.zoneId || '',
        zoneIds: user.zonesAsOperationsManager?.map((z) => z.id) || [],
        teamId: user.careCompanionProfile?.teamId || '',
        reportsToUserId:
          user.fieldManagerProfile?.reportsToUserId ||
          user.staffProfile?.reportsToUserId ||
          '',
        bgvType: user.staffProfile?.bgvType || 'police_clearance',
        bgvAgency: user.staffProfile?.bgvAgency || '',
        bgvVerified: user.staffProfile?.bgvVerified ?? false,
        kycVerified: user.staffProfile?.kycVerified ?? false,
      },
      notes: user.staffProfile?.notes || '',
    };

    res.json({ success: true, data: responseData });
  } catch (err) {
    console.error('[DEBUG] GET /staff/:id CRASH:', userId, err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff details',
      error: err.message,
    });
  }
});

router.put('/staff/:userId', async (req, res) => {
  const { userId } = req.params;
  const personal = (req.body?.personal && typeof req.body.personal === 'object' && !Array.isArray(req.body.personal)) ? req.body.personal : {};
  const professional = (req.body?.professional && typeof req.body.professional === 'object' && !Array.isArray(req.body.professional)) ? req.body.professional : {};
  const assignment = (req.body?.assignment && typeof req.body.assignment === 'object' && !Array.isArray(req.body.assignment)) ? req.body.assignment : {};
  const notes = (req.body?.notes && typeof req.body.notes === 'object' && !Array.isArray(req.body.notes)) ? req.body.notes : {};
  const role = normalizeRole(req.body?.role);

  if (!role) {
    return res
      .status(400)
      .json({ success: false, message: 'Valid staff role is required' });
  }

  try {
    if (!ensureOnboardingModels(res)) return;

    await prisma.$transaction(async (tx) => {
      // 1. Update Core User Info
      const userDataToUpdate = {
        name: asTrimmedString(personal.fullName),
        phone: asTrimmedString(personal.mobileNumber),
        email: asNullableString(personal.email)?.toLowerCase(),
        profilePhoto: asNullableString(personal.photoUrl),
      };

      if (typeof personal?.newPassword === 'string' && personal.newPassword.trim().length >= 6) {
        const salt = await bcrypt.genSalt(10);
        userDataToUpdate.password = await bcrypt.hash(
          personal.newPassword.trim(),
          salt
        );
      }

      await tx.user.update({
        where: { id: userId },
        data: userDataToUpdate,
      });

      // 2. Update Staff Profile
      await tx.staffProfile.update({
        where: { userId },
        data: {
          preferredName: asNullableString(personal.preferredName),
          dateOfBirth: asOptionalDate(personal.dateOfBirth),
          gender: asTrimmedString(personal.gender) || 'prefer_not_to_say',
          whatsappPhone: asNullableString(personal.whatsappNumber),
          alternatePhone: asNullableString(personal.alternatePhone),
          addressLine1: asNullableString(personal.addressLine1),
          addressLine2: asNullableString(personal.addressLine2),
          city: asNullableString(personal.city),
          state: asNullableString(personal.state),
          pincode: asNullableString(personal.pincode),
          aadhaarNumberEncrypted: asNullableString(personal.aadhaarNumber),
          panNumberEncrypted: asNullableString(
            personal.panNumber
          )?.toUpperCase(),
          languages: asStringArray(professional.languages),
          specialization: asStringArray(professional.specialization),
          zone:
            role === 'operations_manager' ||
            !asNullableString(assignment.zoneId)
              ? { disconnect: true }
              : { connect: { id: asNullableString(assignment.zoneId) } },
          team:
            role === 'care_companion' && asNullableString(assignment.teamId)
              ? { connect: { id: asNullableString(assignment.teamId) } }
              : { disconnect: true },
          reportsToUser: asNullableString(assignment.reportsToUserId)
            ? {
                connect: { id: asNullableString(assignment.reportsToUserId) },
              }
            : { disconnect: true },
          bgvType: asTrimmedString(assignment.bgvType),
          bgvAgency: asNullableString(assignment.bgvAgency),
          bgvVerified: Boolean(assignment.bgvVerified),
          kycVerified: Boolean(assignment.kycVerified),
          notes: asNullableString(notes),
        },
      });

      // 3. Update Role-Specific Record
      if (role === 'care_companion') {
        const primaryZone = await tx.zone.findUnique({
          where: { id: assignment.zoneId || '' },
        });
        await tx.careCompanion.update({
          where: { userId },
          data: {
            name: asTrimmedString(personal.fullName),
            bio: asTrimmedString(professional.bio) || '',
            zone: primaryZone?.name || '',
            experience: asOptionalInt(professional.experience),
            qualifications: [
              asTrimmedString(professional.qualification),
            ].filter(Boolean),
            languages: asStringArray(professional.languages),
            specialization: asStringArray(professional.specialization),
            nursingRegistrationNumber: asNullableString(
              professional.nursingRegistrationNumber
            ),
            nursingCouncil: asNullableString(professional.nursingCouncil),
            ccType: asTrimmedString(professional.ccType) || 'care_assistant',
            shiftPreference:
              asTrimmedString(professional.preferredShift) || 'any',
            maxDailyVisits: asOptionalInt(professional.maxDailyVisits),
            willingClinicVisits: Boolean(professional.willingClinicVisits),
            hasTwoWheeler: Boolean(professional.hasTwoWheeler),
            team: asNullableString(assignment.teamId)
              ? { connect: { id: asNullableString(assignment.teamId) } }
              : { disconnect: true },
          },
        });
      } else if (role === 'field_manager') {
        const primaryZone = await tx.zone.findUnique({
          where: { id: assignment.zoneId || '' },
        });
        await tx.fieldManager.update({
          where: { userId },
          data: {
            name: asTrimmedString(personal.fullName),
            bio: asTrimmedString(professional.bio) || '',
            phone: asTrimmedString(personal.mobileNumber),
            zone: primaryZone?.name || '',
            qualification: asNullableString(professional.qualification),
            experience: asOptionalInt(professional.experience),
            previousEmployer: asNullableString(professional.previousEmployer),
            maxTeamSize: asOptionalInt(professional.maxTeamSize) || 15,
            canApproveRoster: professional.canApproveRoster !== false,
            canOnboardCCs: Boolean(professional.canOnboardCCs),
            reportsToUserId: asNullableString(assignment.reportsToUserId),
          },
        });
      } else if (role === 'operations_manager') {
        await tx.operationsManager.update({
          where: { userId },
          data: {
            name: asTrimmedString(personal.fullName),
            bio: asTrimmedString(professional.bio) || '',
            phone: asTrimmedString(personal.mobileNumber),
            qualification: asNullableString(professional.qualification),
            experience: asOptionalInt(professional.experience),
          },
        });

        // Manager zone re-assignments
        const newZoneIds = asStringArray(assignment.zoneIds);

        // Remove from old zones
        await tx.zone.updateMany({
          where: { operationsManagerId: userId },
          data: { operationsManagerId: null },
        });

        // Assign to new ones
        if (newZoneIds.length > 0) {
          for (const zoneId of newZoneIds) {
            await tx.zone.update({
              where: { id: zoneId },
              data: { operationsManagerId: userId },
            });
          }
        }
      } else if (role === 'customer_service') {
        await tx.customerServiceAgent.update({
          where: { userId },
          data: {
            name: asTrimmedString(personal.fullName),
            bio: asTrimmedString(professional.bio) || '',
            phone: asTrimmedString(personal.mobileNumber),
            qualification: asNullableString(professional.qualification),
            experience: asOptionalInt(professional.experience),
          },
        });
      }
    });

    res.json({ success: true, message: 'Staff member updated successfully' });
  } catch (err) {
    console.error('PUT /staff/:id error:', userId, err);
    res
      .status(500)
      .json({
        success: false,
        message: err?.message || 'Failed to update staff member',
      });
  }
});

router.put('/staff/:userId/deactivate', async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        staffProfile: true,
        careCompanionProfile: true,
        fieldManagerProfile: true,
        operationsManagerProfile: true,
      },
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'Staff member not found' });
    }

    const startDate =
      user.staffProfile?.activatedAt ||
      user.staffProfile?.joinedAt ||
      user.createdAt;
    const endDate = new Date();
    const diffTime = Math.abs(endDate - startDate);
    const workingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    await prisma.$transaction(async (tx) => {
      // 1. Deactivate User
      await tx.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      // 2. Update Staff Profile
      await tx.staffProfile.update({
        where: { userId },
        data: {
          employmentStatus: 'inactive',
          deactivatedAt: endDate,
        },
      });

      // 3. Update Role Specific Availability
      if (user.role === 'care_companion' && user.careCompanionProfile) {
        await tx.careCompanion.update({
          where: { userId },
          data: { isAvailable: false },
        });
      } else if (user.role === 'field_manager' && user.fieldManagerProfile) {
        await tx.fieldManager.update({
          where: { userId },
          data: { isAvailable: false },
        });
      } else if (
        user.role === 'operations_manager' &&
        user.operationsManagerProfile
      ) {
        await tx.operationsManager.update({
          where: { userId },
          data: { isAvailable: false },
        });
      } else if (
        user.role === 'customer_service' &&
        user.customerServiceProfile
      ) {
        await tx.customerServiceAgent.update({
          where: { userId },
          data: { isAvailable: false },
        });
      }
    });

    res.json({
      success: true,
      message: 'Staff member deactivated successfully',
      data: {
        name: user.name,
        startDate,
        endDate,
        workingDays,
      },
    });
  } catch (err) {
    console.error('PUT /staff/:id/deactivate error:', userId, err);
    res
      .status(500)
      .json({
        success: false,
        message: err?.message || 'Failed to deactivate staff member',
      });
  }
});


// ── POST /api/users/push-token ────────────────────────────────────────────────
// Called by mobile app on launch to register or refresh the Expo push token.
// Stores it in User.fcmToken — the backend uses this field for sending pushes.
router.post('/push-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'token is required' });
    }

    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { fcmToken: token },
    });

    res.json({ success: true, message: 'Push token registered' });
  } catch (err) {
    console.error('POST /users/push-token error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

