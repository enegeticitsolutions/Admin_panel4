import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../../core/database';
import { resolveFileUrl } from '../storage/urlResolver';
import { createToken } from '../../core/security';
import { ApiError } from '../../utils/ApiError';
import { OtpFactory } from '../../core/otp/OtpFactory';
import { getBeneficiarySathiEligibility } from '../beneficiary/beneficiary_sathi_service';
import { benefitPeriodManager } from '../benefit/BenefitPeriodManager';
import { benefitLedgerEngine } from '../benefit/BenefitLedgerEngine';
import { UsageType } from '@prisma/client';
import { notificationProducer } from '@maihoonna/notifications';
import { findSathiBenefitBalance } from '../../constants/systemBenefits';
import {
  dispatchSaathiOtp,
  dispatchSaathiRegistrationSubmitted,
  dispatchSaathiProfileApproved,
  dispatchSaathiProfileUpdated,
  dispatchSaathiBeneficiaryMatched,
  dispatchSaathiBeneficiaryUnmatched,
  dispatchSaathiVisitRequestReceived,
  dispatchSaathiVisitInactiveNudge,
  dispatchSaathiCheckInConfirmed,
  dispatchSaathiVisitCheckedOut,
  dispatchSaathiFeedbackReminder,
  dispatchSaathiVisitConfirmedByBeneficiary,
  dispatchSaathiMonthlyGoalAchieved,
  dispatchSaathiMonthlyGoalAtRisk,
  dispatchSaathiVisitNotCheckedOut,
  dispatchSaathiCreditsEarned,
  dispatchSaathiRedemptionRequested,
  dispatchSaathiGiftCardDelivered,
  dispatchSaathiCreditBalanceMilestone,
  dispatchSaathiAddressUpdated,
  dispatchSaathiAvailabilityUpdated,
  dispatchSaathiIncompleteProfileNudge,
  dispatchSaathiGuideTipPublished,
  dispatchSaathiEmergencyAcknowledged,
  dispatchSaathiFeedbackConcernFlagged,
  dispatchCoordinatorNewVolunteerRegistered,
  dispatchCoordinatorRedemptionAwaitingApproval,
  dispatchCoordinatorVolunteerInactiveAlert,
} from './sathi-notification.dispatcher';

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

export const getSystemConfig = async (key: string, defaultValue: string): Promise<string> => {
  const config = await prisma.systemConfig.findUnique({ where: { key } });
  return config ? config.value : defaultValue;
};

export const registerVolunteer = async (data: any) => {
  const { phone, name, password } = data;

  const cleanPhone = phone.replace(/\D/g, '').slice(-10);

  const existing = await prisma.volunteer.findFirst({
    where: { phone: cleanPhone }
  });

  if (existing) {
    if (!existing.isActive) {
      throw new ApiError(403, 'This account has been deleted. To reactivate, please contact the Saathi coordinator on aastha@maihoonna.com');
    }
    throw new ApiError(400, 'A volunteer with this phone number is already registered.');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const volunteer = await prisma.volunteer.create({
    data: {
      phone: cleanPhone,
      password: hashedPassword,
      name,
      applicationStatus: 'NOT_APPLIED',
    }
  });

  const token = createToken({ sub: volunteer.id, role: 'volunteer' });

  // ST-002: In-App & Push Notification to Volunteer
  dispatchSaathiRegistrationSubmitted(volunteer.id, volunteer.name).catch((err: any) =>
    console.warn('[Register:ST-002 Error]:', err.message)
  );

  // ST-060: In-App & Push Notification to Coordinator
  prisma.user.findFirst({
    where: { role: { in: ['admin', 'operations_manager', 'master_admin'] } },
    select: { id: true }
  }).then(adminUser => {
    if (adminUser) {
      dispatchCoordinatorNewVolunteerRegistered(adminUser.id, {
        volunteerName: volunteer.name,
        zoneCity: volunteer.city || 'Delhi NCR',
        volunteerId: volunteer.id,
      }).catch(() => {});
    }
  }).catch(() => {});

  if (volunteer.phone) {
    notificationProducer.publish({
      idempotencyKey: `sathi-reg-${volunteer.id}`,
      channel: 'whatsapp',
      event: 'SAATHI_REGISTRATION_SUBMITTED',
      recipient: { phone: volunteer.phone },
      variables: { volunteerName: volunteer.name || 'Volunteer' },
    }).catch((err: any) => console.error('[SathiService:Register] Notification Error:', err.message));
  }

  return {
    token,
    volunteer: {
      id: volunteer.id,
      name: volunteer.name,
      phone: volunteer.phone,
      applicationStatus: volunteer.applicationStatus,
    }
  };
};

export const registerVolunteerWithOtp = async (data: any) => {
  const { phone: rawPhone, name, otp } = data;
  const phone = rawPhone.replace(/\D/g, '').slice(-10);

  const provider = OtpFactory.getProvider();
  const isValid = await provider.verify(phone, otp);
  if (!isValid) {
    throw new ApiError(400, 'Invalid or expired OTP code entered.');
  }

  const existing = await prisma.volunteer.findFirst({
    where: { phone }
  });

  if (existing) {
    if (!existing.isActive) {
      throw new ApiError(403, 'This account has been deleted. To reactivate, please contact the Saathi coordinator on aastha@maihoonna.com');
    }
    throw new ApiError(400, 'A volunteer with this phone number is already registered.');
  }

  const volunteer = await prisma.volunteer.create({
    data: {
      phone,
      password: null,
      name,
      applicationStatus: 'NOT_APPLIED',
    }
  });

  const token = createToken({ sub: volunteer.id, role: 'volunteer' });

  // ST-002: In-App & Push Notification to Volunteer
  dispatchSaathiRegistrationSubmitted(volunteer.id, volunteer.name).catch((err: any) =>
    console.warn('[RegisterOtp:ST-002 Error]:', err.message)
  );

  // ST-060: In-App & Push Notification to Coordinator
  prisma.user.findFirst({
    where: { role: { in: ['admin', 'operations_manager', 'master_admin'] } },
    select: { id: true }
  }).then(adminUser => {
    if (adminUser) {
      dispatchCoordinatorNewVolunteerRegistered(adminUser.id, {
        volunteerName: volunteer.name,
        zoneCity: volunteer.city || 'Delhi NCR',
        volunteerId: volunteer.id,
      }).catch(() => {});
    }
  }).catch(() => {});

  if (volunteer.phone) {
    notificationProducer.publish({
      idempotencyKey: `sathi-reg-${volunteer.id}`,
      channel: 'whatsapp',
      event: 'SAATHI_REGISTRATION_SUBMITTED',
      recipient: { phone: volunteer.phone },
      variables: { volunteerName: volunteer.name || 'Volunteer' },
    }).catch((err: any) => console.error('[SathiService:RegisterOtp] Notification Error:', err.message));
  }

  return {
    token,
    volunteer: {
      id: volunteer.id,
      name: volunteer.name,
      phone: volunteer.phone,
      applicationStatus: volunteer.applicationStatus,
    }
  };
};

export const loginVolunteer = async (phone: string, passwordRaw: string) => {
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);

  const volunteer = await prisma.volunteer.findUnique({
    where: { phone: cleanPhone }
  });

  if (!volunteer) {
    throw new ApiError(404, 'Volunteer profile not found.');
  }

  if (!volunteer.isActive) {
    throw new ApiError(403, 'This account has been deleted. To reactivate, please contact the Saathi coordinator on aastha@maihoonna.com');
  }

  const isMatch = await bcrypt.compare(passwordRaw, volunteer.password || '');
  if (!isMatch) {
    throw new ApiError(401, 'Invalid password.');
  }

  await prisma.volunteer.update({
    where: { id: volunteer.id },
    data: { lastLoginAt: new Date() }
  });

  const token = createToken({ sub: volunteer.id, role: 'volunteer' });

  return {
    token,
    volunteer: {
      id: volunteer.id,
      name: volunteer.name,
      phone: volunteer.phone,
      applicationStatus: volunteer.applicationStatus,
    }
  };
};

export const sendVolunteerOtp = async (rawPhone: string) => {
  const phone = rawPhone.replace(/\D/g, '').slice(-10);

  const volunteer = await prisma.volunteer.findUnique({
    where: { phone }
  });

  if (!volunteer) {
    throw new ApiError(404, 'Volunteer profile not found. Please register first.');
  }

  if (!volunteer.isActive) {
    throw new ApiError(403, 'This account has been deleted. To reactivate, please contact the Saathi coordinator on aastha@maihoonna.com');
  }

  const provider = OtpFactory.getProvider();
  const res = await provider.send(phone);

  // ST-001: OTP for login / signup in-app & push notification
  if (volunteer.id) {
    const otpCode = (res as any)?.otp || (res as any)?.code || '******';
    dispatchSaathiOtp(phone, otpCode, volunteer.id).catch((err: any) =>
      console.warn('[sendVolunteerOtp:ST-001 Error]:', err.message)
    );
  }

  return res;
};

export const verifyVolunteerOtp = async (rawPhone: string, otpCode: string) => {
  const phone = rawPhone.replace(/\D/g, '').slice(-10);
  const provider = OtpFactory.getProvider();

  const isValid = await provider.verify(phone, otpCode);
  if (!isValid) {
    throw new ApiError(400, 'Invalid or expired OTP code entered.');
  }

  const volunteer = await prisma.volunteer.findUnique({
    where: { phone }
  });

  if (!volunteer) {
    throw new ApiError(404, 'Volunteer profile not found.');
  }

  if (!volunteer.isActive) {
    throw new ApiError(403, 'This account has been deleted. To reactivate, please contact the Saathi coordinator on aastha@maihoonna.com');
  }

  const token = createToken({ sub: volunteer.id, role: 'volunteer' });

  return {
    token,
    volunteer: {
      id: volunteer.id,
      name: volunteer.name,
      phone: volunteer.phone,
      applicationStatus: volunteer.applicationStatus,
    }
  };
};

export const deleteVolunteer = async (volunteerId: string) => {
  const volunteer = await prisma.volunteer.findUnique({
    where: { id: volunteerId }
  });

  if (!volunteer) {
    throw new ApiError(404, 'Volunteer not found.');
  }

  await prisma.volunteer.update({
    where: { id: volunteerId },
    data: { 
      isActive: false,
      fcmToken: null
    }
  });

  return { success: true, message: 'Account deleted successfully.' };
};

export const getVolunteerProfile = async (id: string) => {
  const volunteer = await prisma.volunteer.findUnique({
    where: { id }
  });

  if (!volunteer) {
    throw new ApiError(404, 'Volunteer profile not found.');
  }

  const totalVisits = await prisma.volunteerVisitLog.count({
    where: { volunteerId: id, status: 'completed' }
  });

  const ratingAggregate = await prisma.volunteerReview.aggregate({
    _avg: { rating: true },
    where: { volunteerId: id }
  });

  const rating = ratingAggregate._avg.rating ? Number(ratingAggregate._avg.rating.toFixed(1)) : 0;
  const resolvedPhoto = volunteer.profilePhoto ? await resolveFileUrl(volunteer.profilePhoto) : volunteer.profilePhoto;

  return { ...volunteer, profilePhoto: resolvedPhoto, totalVisits, rating };
};

export const updateVolunteerProfile = async (id: string, data: any) => {
  if (data.email !== undefined) {
    const cleanEmail = typeof data.email === 'string' ? data.email.trim().toLowerCase() : null;
    if (!cleanEmail) {
      data.email = null;
    } else {
      data.email = cleanEmail;
      const existing = await prisma.volunteer.findFirst({
        where: {
          email: cleanEmail,
          id: { not: id }
        }
      });
      if (existing) {
        throw new ApiError(400, 'This email address is already registered with another Saathi account. Please enter a different email.');
      }
    }
  }

  const updated = await prisma.volunteer.update({
    where: { id },
    data
  });

  // ST-040, ST-041, ST-005: In-App & Push Notification based on updated attributes
  if (data.address || data.city || data.flatPlot || data.streetArea) {
    const newAddr = [data.flatPlot, data.streetArea, data.city, data.pincode].filter(Boolean).join(', ') || data.address || 'Updated Address';
    dispatchSaathiAddressUpdated(id, { volunteerName: updated.name, newAddress: newAddr }).catch(() => {});
  } else if (data.availability && data.availability.length > 0) {
    const availSummary = Array.isArray(data.availability) ? data.availability.join(', ') : String(data.availability);
    dispatchSaathiAvailabilityUpdated(id, { volunteerName: updated.name, availabilitySummary: availSummary }).catch(() => {});
  } else if (!data.lastLoginAt && !data.fcmToken && !data.refreshToken && !data.verifiedAt && !data.verifiedById) {
    dispatchSaathiProfileUpdated(id, updated.name).catch(() => {});
  }

  const resolvedPhoto = updated.profilePhoto ? await resolveFileUrl(updated.profilePhoto, 1800) : updated.profilePhoto;
  return { ...updated, profilePhoto: resolvedPhoto };
};

export const getVolunteerReviews = async (id: string) => {
  const reviews = await prisma.volunteerReview.findMany({
    where: { volunteerId: id },
    include: {
      beneficiary: {
        select: {
          subscriber: {
            select: { name: true, profilePhoto: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  return reviews;
};

function calculateDistance(lat1?: number | null, lon1?: number | null, lat2?: number | null, lon2?: number | null): string | null {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return (R * c).toFixed(1) + ' km';
}

export const getVolunteerDashboard = async (id: string) => {
  const volunteer = await prisma.volunteer.findUnique({
    where: { id },
    include: {
      assignments: {
        where: { isActive: true, status: 'CONNECTED' },
        include: {
          beneficiary: true
        }
      },
      visitLogs: {
        where: { status: 'in_progress' }
      }
    }
  });

  if (!volunteer) {
    throw new ApiError(404, 'Volunteer profile not found.');
  }

  const beneficiaryIds = volunteer.assignments.map(a => a.beneficiaryId);

  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
  await prisma.sathiVisitRequest.updateMany({
    where: {
      OR: [
        { volunteerId: id },
        { beneficiaryId: { in: beneficiaryIds } }
      ],
      status: { in: ['PENDING', 'ACCEPTED'] },
      dateTime: { lt: threeHoursAgo }
    },
    data: {
      status: 'REJECTED',
      rejectionReason: 'Automatically marked as not completed due to timeout.'
    }
  });

  // Fetch pending visit requests (where not rejected by this volunteer)
  const pendingRequests = await prisma.sathiVisitRequest.findMany({
    where: {
      beneficiaryId: { in: beneficiaryIds },
      status: 'PENDING',
      NOT: {
        rejectedBy: { has: id }
      }
    },
    include: {
      beneficiary: {
        select: {
          id: true,
          name: true,
          photo: true,
          age: true,
          address: true,
          latitude: true,
          longitude: true,
          hobbiesInterests: true,
          _count: {
            select: { volunteerVisitLogs: true }
          },
          volunteerVisitLogs: {
            select: { checkInTime: true },
            orderBy: { checkInTime: 'desc' },
            take: 1
          }
        }
      }
    },
    orderBy: { dateTime: 'asc' }
  });

  // Fetch upcoming accepted and in-progress visits for this volunteer
  const upcomingVisits = await prisma.sathiVisitRequest.findMany({
    where: {
      volunteerId: id,
      status: { in: ['ACCEPTED', 'IN_PROGRESS'] }
    },
    include: {
      beneficiary: {
        select: {
          id: true,
          name: true,
          photo: true,
          age: true,
          address: true,
          latitude: true,
          longitude: true,
          hobbiesInterests: true,
          _count: {
            select: { volunteerVisitLogs: true }
          }
        }
      }
    },
    orderBy: { dateTime: 'asc' }
  });

  const cooldownDays = parseInt(await getSystemConfig('sathi_reapply_cooldown_days', '30'), 10);
  let reapplyAllowedAfter: string | null = null;
  if (volunteer.applicationStatus === 'REJECTED' && volunteer.rejectedAt) {
    const allowedDate = new Date(volunteer.rejectedAt);
    allowedDate.setDate(allowedDate.getDate() + cooldownDays);
    reapplyAllowedAfter = allowedDate.toISOString();
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const monthLogs = await prisma.volunteerVisitLog.findMany({
    where: {
      volunteerId: id,
      status: 'completed',
      checkInTime: {
        gte: startOfMonth
      }
    }
  });

  const visitsThisMonth = monthLogs.length;
  const hoursThisMonth = monthLogs.reduce((acc, log) => acc + (log.hoursEarned || 0), 0);

  const totalVisits = await prisma.volunteerVisitLog.count({
    where: {
      volunteerId: id,
      status: 'completed'
    }
  });

  const resolvedVolunteerPhoto = volunteer.profilePhoto ? await resolveFileUrl(volunteer.profilePhoto, 1800) : null;

  const assignedBeneficiaries = await Promise.all(volunteer.assignments.map(async a => ({
    id: a.beneficiary.id,
    name: a.beneficiary.name,
    photo: a.beneficiary.photo ? await resolveFileUrl(a.beneficiary.photo, 1800) : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    age: a.beneficiary.age,
    location: a.beneficiary.address,
    distance: calculateDistance(volunteer.latitude, volunteer.longitude, a.beneficiary.latitude, a.beneficiary.longitude),
    hobbies: a.beneficiary.hobbiesInterests || [],
    assignedAt: a.createdAt.toISOString()
  })));

  const resolvedVisitRequests = await Promise.all(pendingRequests.map(async r => {
    const lastVisitTime = r.beneficiary.volunteerVisitLogs?.[0]?.checkInTime;
    const lastVisit = lastVisitTime ? new Date(lastVisitTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
    return {
      id: r.id,
      beneficiaryId: r.beneficiaryId,
      name: r.beneficiary.name,
      photo: r.beneficiary.photo ? await resolveFileUrl(r.beneficiary.photo, 1800) : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120',
      age: r.beneficiary.age,
      location: r.beneficiary.address,
      distance: calculateDistance(volunteer.latitude, volunteer.longitude, r.beneficiary.latitude, r.beneficiary.longitude),
      dateTime: r.dateTime.toISOString(),
      reason: r.reason,
      bio: '', // Beneficiary has no bio field in Prisma schema
      hobbies: r.beneficiary.hobbiesInterests || [],
      totalVisits: r.beneficiary._count?.volunteerVisitLogs || 0,
      lastVisit: lastVisit
    };
  }));

  const resolvedUpcomingVisits = await Promise.all(upcomingVisits.map(async v => {
    const assignment = volunteer.assignments.find(a => a.beneficiaryId === v.beneficiaryId);
    return {
      id: v.id,
      beneficiaryId: v.beneficiaryId,
      assignmentId: assignment ? assignment.id : undefined,
      name: v.beneficiary.name,
      photo: v.beneficiary.photo ? await resolveFileUrl(v.beneficiary.photo, 1800) : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120',
      age: v.beneficiary.age,
      location: v.beneficiary.address,
      distance: calculateDistance(volunteer.latitude, volunteer.longitude, v.beneficiary.latitude, v.beneficiary.longitude),
      dateTime: v.dateTime.toISOString(),
      reason: v.reason,
      visitCount: v.beneficiary._count?.volunteerVisitLogs || 0,
      hobbies: v.beneficiary.hobbiesInterests || [],
      status: v.status
    };
  }));

  return {
    applicationStatus: volunteer.applicationStatus,
    rejectionReason: volunteer.rejectionReason,
    rejectedAt: volunteer.rejectedAt ? volunteer.rejectedAt.toISOString() : null,
    reapplyAllowedAfter,
    cooldownDays,
    name: volunteer.name,
    city: volunteer.city,
    state: volunteer.state,
    profilePhoto: resolvedVolunteerPhoto,
    totalCreditHours: volunteer.totalCreditHours,
    totalCreditPoints: volunteer.totalCreditPoints,
    monthlyGoalHours: volunteer.monthlyGoalHours,
    visitsThisMonth,
    hoursThisMonth,
    totalVisits,
    beneficiariesCount: volunteer.assignments.length,
    activeVisit: volunteer.visitLogs[0] || null,
    assignedBeneficiaries,
    visitRequests: resolvedVisitRequests,
    upcomingVisits: resolvedUpcomingVisits
  };
};

export const getVolunteerMatches = async (id: string) => {
  const volunteer = await prisma.volunteer.findUnique({
    where: { id }
  });

  if (!volunteer || volunteer.applicationStatus !== 'APPROVED') {
    return [];
  }

  const assignments = await prisma.volunteerAssignment.findMany({
    where: { volunteerId: id, isActive: true, status: 'CONNECTED' },
    include: {
      beneficiary: {
        select: {
          id: true,
          name: true,
          photo: true,
          age: true,
          gender: true,
          address: true,
          hobbiesInterests: true,
          latitude: true,
          longitude: true,
          user: {
            select: { phone: true }
          }
        }
      },
      visitLogs: {
        where: { status: 'completed' },
        orderBy: { checkInTime: 'desc' },
        select: { checkInTime: true }
      }
    }
  });

  return assignments.map(a => {
    const totalVisits = a.visitLogs.length;
    const lastVisitDate = a.visitLogs.length > 0 ? a.visitLogs[0].checkInTime : null;
    
    let distanceStr = 'Unknown';
    if (volunteer.latitude && volunteer.longitude && a.beneficiary.latitude && a.beneficiary.longitude) {
      const d = getDistance(volunteer.latitude, volunteer.longitude, a.beneficiary.latitude, a.beneficiary.longitude);
      distanceStr = d.toFixed(1) + ' km';
    } else {
      // Dummy fallback if coordinates are missing, just for display
      distanceStr = (Math.random() * 2 + 0.5).toFixed(1) + ' km'; 
    }
    
    return {
      assignmentId: a.id,
      beneficiary: {
        ...a.beneficiary,
        distance: distanceStr
      },
      assignedAt: a.createdAt,
      totalVisits: totalVisits,
      lastVisit: lastVisitDate ? new Date(lastVisitDate).toLocaleDateString('en-US') : null,
    };
  });
};

export const getVolunteerMatchDetail = async (volunteerId: string, beneficiaryId: string) => {
  const assignment = await prisma.volunteerAssignment.findFirst({
    where: {
      volunteerId,
      beneficiaryId,
      isActive: true,
      status: 'CONNECTED'
    },
    include: {
      beneficiary: true
    }
  });

  if (!assignment) {
    throw new ApiError(404, 'No active companion assignment found for this beneficiary.');
  }

  return assignment.beneficiary;
};

export const checkinVolunteerVisit = async (volunteerId: string, data: any) => {
  const volunteer = await prisma.volunteer.findUnique({ where: { id: volunteerId } });
  if (!volunteer || volunteer.applicationStatus !== 'APPROVED') {
    throw new ApiError(403, 'Your profile is not verified. Check-in is disabled.');
  }

  const { beneficiaryId, assignmentId, notes, visitRequestId, otpCode } = data;

  if (!visitRequestId || !otpCode) {
    throw new ApiError(400, 'Visit Request ID and OTP are required to start a visit.');
  }

  const activeCheckin = await prisma.volunteerVisitLog.findFirst({
    where: { volunteerId, status: 'in_progress' }
  });

  if (activeCheckin) {
    throw new ApiError(400, 'You already have an active check-in session. Please check-out first.');
  }

  const visitRequest = await prisma.sathiVisitRequest.findFirst({
    where: { id: visitRequestId, volunteerId, beneficiaryId, status: 'ACCEPTED' }
  });

  if (!visitRequest) {
    throw new ApiError(404, 'Accepted visit request not found.');
  }

  if (visitRequest.otpCode !== otpCode) {
    throw new ApiError(400, 'Invalid OTP code.');
  }

  const assignment = await prisma.volunteerAssignment.findFirst({
    where: { id: assignmentId, volunteerId, beneficiaryId, isActive: true }
  });

  if (!assignment) {
    throw new ApiError(404, 'Assignment not found or inactive.');
  }

  const subscription = await prisma.subscription.findFirst({
    where: {
      beneficiaryId,
      isActive: true,
      benefitBalances: {
        some: {
          benefit: {
            benefitType: { name: 'Sathi Companion' }
          }
        }
      }
    },
    include: {
      benefitBalances: {
        include: { benefit: { include: { benefitType: true } } }
      }
    }
  });

  if (!subscription) {
    throw new ApiError(400, 'Beneficiary does not have an active subscription with Sathi Companion benefits.');
  }

  const sathiBalance = findSathiBenefitBalance(subscription.benefitBalances);

  if (!sathiBalance || (sathiBalance.totalUnits - sathiBalance.usedUnits) <= 0) {
    throw new ApiError(400, 'Beneficiary has exhausted their Sathi Companion benefit hours.');
  }

  // Use a transaction to create the log and update the request status
  const visitLog = await prisma.$transaction(async (tx) => {
    const log = await tx.volunteerVisitLog.create({
      data: {
        volunteerId,
        beneficiaryId,
        assignmentId,
        subscriptionId: subscription.id,
        subscriptionBenefitBalanceId: sathiBalance.id,
        checkInTime: new Date(),
        status: 'in_progress',
        notes: notes || null,
      }
    });

    await tx.sathiVisitRequest.update({
      where: { id: visitRequestId },
      data: { status: 'IN_PROGRESS' }
    });

    return log;
  });

  // ST-020: Check-In Confirmed push & in-app notification
  prisma.beneficiary.findUnique({
    where: { id: beneficiaryId },
    select: { name: true }
  }).then(b => {
    const checkInTimeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    dispatchSaathiCheckInConfirmed(volunteerId, {
      beneficiaryName: b?.name || 'Beneficiary',
      checkInTime: checkInTimeStr,
      visitId: visitLog.id,
    }).catch(err => console.warn('[checkinVolunteerVisit:ST-020 Error]:', err.message));
  }).catch(() => {});

  return visitLog;
};

export const checkoutVolunteerVisit = async (volunteerId: string, visitLogId: string, notes?: string) => {
  const visitLog = await prisma.volunteerVisitLog.findFirst({
    where: { id: visitLogId, volunteerId, status: 'in_progress' }
  });

  if (!visitLog) {
    throw new ApiError(404, 'Active visit log session not found.');
  }

  const checkOutTime = new Date();
  const rawMinutes = (checkOutTime.getTime() - visitLog.checkInTime.getTime()) / 60000;

  const billableMinutes = rawMinutes;
  // If visit is less than 1 hr (60 min), credit and hours worth 1 hr are added.
  // If greater than 1 hr (60 min), credit and hours accrue per minute (rawMinutes / 60).
  const hoursEarned = rawMinutes < 60 ? 1 : rawMinutes / 60;

  let sathiBalance: any = null;
  if (visitLog.subscriptionBenefitBalanceId) {
    sathiBalance = await prisma.subscriptionBenefitBalance.findUnique({
      where: { id: visitLog.subscriptionBenefitBalanceId }
    });
  }

  const activeSub = await prisma.subscription.findFirst({
    where: { beneficiaryId: visitLog.beneficiaryId, isActive: true },
    include: {
      benefitBalances: {
        include: { benefit: { include: { benefitType: true } } }
      }
    }
  });

  // Prefer hour-specific Sathi benefit if present
  const hourSpecificBalance = findSathiBenefitBalance(activeSub?.benefitBalances || []);
  if (hourSpecificBalance && (!sathiBalance || !((sathiBalance.snapshotUnitLabel || sathiBalance.unit || '').toLowerCase().includes('hour')))) {
    sathiBalance = hourSpecificBalance;
  } else if (!sathiBalance) {
    sathiBalance = hourSpecificBalance;
  }

  const label = (sathiBalance?.snapshotUnitLabel || sathiBalance?.unit || sathiBalance?.benefit?.unitLabel || '').toLowerCase();
  const isHourBenefit = label.includes('hour') || label.includes('hr');
  const unitsToDeduct = isHourBenefit ? Math.max(1, Math.ceil(hoursEarned)) : 1;

  const currentRemaining = sathiBalance ? Math.max(0, sathiBalance.totalUnits - sathiBalance.usedUnits) : 0;
  const newRemaining = sathiBalance ? Math.max(0, currentRemaining - unitsToDeduct) : 0;

  const creditRateStr = await getSystemConfig('SATHI_CREDIT_RATE', '10');
  const creditRate = parseFloat(creditRateStr);
  
  let pointsEarned = 0;
  if (rawMinutes > 0) {
    pointsEarned = hoursEarned * creditRate;
  }

  const result = await prisma.$transaction(async (tx) => {
    if (sathiBalance) {
      const updatedUsed = sathiBalance.usedUnits + unitsToDeduct;
      const updatedAvailable = Math.max(0, sathiBalance.totalUnits - sathiBalance.reservedUnits - updatedUsed);

      await tx.subscriptionBenefitBalance.update({
        where: { id: sathiBalance.id },
        data: {
          usedUnits: updatedUsed,
          availableUnits: updatedAvailable
        }
      });

      // Immutable benefit transaction ledger
      await tx.benefitTransaction.create({
        data: {
          balanceId: sathiBalance.id,
          transactionType: 'CONSUMED',
          units: unitsToDeduct,
          totalBefore: sathiBalance.totalUnits,
          totalAfter: sathiBalance.totalUnits,
          reservedBefore: sathiBalance.reservedUnits,
          reservedAfter: sathiBalance.reservedUnits,
          usedBefore: sathiBalance.usedUnits,
          usedAfter: updatedUsed,
          availableBefore: currentRemaining,
          availableAfter: newRemaining,
          reason: `Sathi Companion Visit Completed (${Math.round(rawMinutes)} mins)`,
          performedByUserId: volunteerId,
        }
      });
    }

    // Synchronize BenefitPeriodBalance & BenefitUsage ledger
    if (visitLog.subscriptionId && sathiBalance) {
      try {
        const activePeriod = await benefitPeriodManager.evaluateAndTransitionJIT(visitLog.subscriptionId);
        if (activePeriod) {
          try {
            await benefitLedgerEngine.deductUnits({
              subscriptionId: visitLog.subscriptionId,
              periodId: activePeriod.id,
              benefitId: sathiBalance.benefitId,
              quantity: unitsToDeduct,
              usageType: UsageType.SATHI_HOURS,
              referenceId: visitLog.id,
              notes: `Sathi Companion Visit Completed (${Math.round(rawMinutes)} mins)`,
              performedByUserId: volunteerId,
            }, tx);
          } catch (deductErr) {
            console.error('[Sathi Checkout] BenefitLedger deduction warning:', deductErr);
            const pb = await tx.benefitPeriodBalance.findUnique({
              where: {
                periodId_benefitId: {
                  periodId: activePeriod.id,
                  benefitId: sathiBalance.benefitId,
                }
              }
            });
            if (pb) {
              const qty = Math.min(unitsToDeduct, pb.remainingQuantity);
              await tx.benefitPeriodBalance.update({
                where: { id: pb.id },
                data: {
                  usedQuantity: pb.usedQuantity + qty,
                  remainingQuantity: Math.max(0, pb.remainingQuantity - qty)
                }
              });
            }
          }
        }
      } catch (periodErr) {
        console.error('[Sathi Checkout] Period evaluation warning:', periodErr);
      }
    }

    // Create PackageHoursLog for audit & activity feeds (preserved for analytics)
    if (visitLog.subscriptionId && visitLog.beneficiaryId) {
      await tx.packageHoursLog.create({
        data: {
          subscriptionId: visitLog.subscriptionId,
          beneficiaryId: visitLog.beneficiaryId,
          hoursConsumed: hoursEarned,
          balanceBefore: currentRemaining,
          balanceAfter: newRemaining,
          description: `Sathi companion visit completed (${hoursEarned.toFixed(1)} hrs). Notes: ${notes || 'Completed'}`
        }
      });
    }

    const volunteer = await tx.volunteer.findUnique({
      where: { id: volunteerId }
    });

    if (!volunteer) {
      throw new Error('Volunteer record not found inside transaction.');
    }

    const newHoursTotal = volunteer.totalCreditHours + hoursEarned;
    const newPointsTotal = volunteer.totalCreditPoints + pointsEarned;

    await tx.volunteer.update({
      where: { id: volunteerId },
      data: {
        totalCreditHours: newHoursTotal,
        totalCreditPoints: newPointsTotal
      }
    });

    await tx.volunteerCreditTransaction.create({
      data: {
        volunteerId,
        visitLogId: visitLog.id,
        type: 'earned',
        minutesDelta: rawMinutes,
        pointsDelta: pointsEarned,
        balanceAfter: newPointsTotal,
        description: `Visit Completed`
      }
    });

    const completedLog = await tx.volunteerVisitLog.update({
      where: { id: visitLog.id },
      data: {
        checkOutTime,
        minutesLogged: rawMinutes,
        hoursEarned,
        creditPointsEarned: pointsEarned,
        beneficiaryBalanceBefore: currentRemaining,
        beneficiaryBalanceAfter: newRemaining,
        subscriptionBenefitBalanceId: sathiBalance?.id || visitLog.subscriptionBenefitBalanceId,
        status: 'completed',
        notes: notes ? `${visitLog.notes || ''}\n\nCheckout Notes: ${notes}`.trim() : visitLog.notes
      }
    });

    return completedLog;
  });

  // ST-021, ST-030, ST-024: In-App & Push notifications on visit checkout
  prisma.volunteer.findUnique({
    where: { id: volunteerId },
    select: { name: true, monthlyGoalHours: true, totalCreditPoints: true, totalCreditHours: true }
  }).then(vol => {
    prisma.beneficiary.findUnique({
      where: { id: visitLog.beneficiaryId },
      select: { name: true }
    }).then(b => {
      const volName = vol?.name || 'Volunteer';
      const benName = b?.name || 'Beneficiary';
      const hours = Math.floor(rawMinutes / 60);
      const mins = Math.round(rawMinutes % 60);
      const durationStr = `${hours > 0 ? `${hours}h ` : ''}${mins}m`;

      // ST-021: Visit Completed
      dispatchSaathiVisitCheckedOut(volunteerId, {
        volunteerName: volName,
        beneficiaryName: benName,
        duration: durationStr,
        points: pointsEarned.toFixed(0),
        visitId: result.id,
      }).catch(err => console.warn('[checkoutVolunteerVisit:ST-021 Error]:', err.message));

      // ST-030: Credits Earned
      const totalPts = vol?.totalCreditPoints || pointsEarned;
      dispatchSaathiCreditsEarned(volunteerId, {
        points: pointsEarned.toFixed(0),
        beneficiaryName: benName,
        totalBalance: totalPts.toFixed(0),
        visitId: result.id,
      }).catch(err => console.warn('[checkoutVolunteerVisit:ST-030 Error]:', err.message));

      // ST-024: Monthly Goal Achieved (100%)
      const monthlyGoal = vol?.monthlyGoalHours || 10;
      if (vol && vol.totalCreditHours >= monthlyGoal) {
        dispatchSaathiMonthlyGoalAchieved(volunteerId, {
          volunteerName: volName,
          hoursLogged: vol.totalCreditHours.toFixed(1),
          goalHours: monthlyGoal.toFixed(0),
        }).catch(err => console.warn('[checkoutVolunteerVisit:ST-024 Error]:', err.message));
      }
    }).catch(() => {});
  }).catch(() => {});

  return {
    result,
    message: `Checked out successfully. Earned ${hoursEarned.toFixed(1)} credit hours / ${pointsEarned.toFixed(0)} points.`
  };
};

export const getVolunteerVisitLogs = async (volunteerId: string) => {
  const logs = await prisma.volunteerVisitLog.findMany({
    where: { volunteerId, status: 'completed' },
    include: {
      beneficiary: {
        select: {
          id: true,
          name: true,
          photo: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  return logs;
};

export const getVolunteerCreditTransactions = async (volunteerId: string) => {
  const txs = await prisma.volunteerCreditTransaction.findMany({
    where: { volunteerId },
    orderBy: { createdAt: 'desc' }
  });
  return txs;
};

export const getVolunteerCreditSummary = async (volunteerId: string) => {
  const volunteer = await prisma.volunteer.findUnique({
    where: { id: volunteerId }
  });
  if (!volunteer) throw new ApiError(404, 'Volunteer profile not found');

  let txs = await prisma.volunteerCreditTransaction.findMany({
    where: { volunteerId },
    orderBy: { createdAt: 'desc' }
  });


  let totalEarned = 0;
  let totalRedeemed = 0;
  for (const tx of txs) {
    if (tx.type === 'earned' || tx.pointsDelta > 0) {
      totalEarned += tx.pointsDelta;
    } else if (tx.type === 'redeemed' || tx.pointsDelta < 0) {
      totalRedeemed += Math.abs(tx.pointsDelta);
    }
  }

  // Dynamic conversion rate from SystemConfig
  const configRate = await prisma.systemConfig.findUnique({ where: { key: 'VOLUNTEER_CREDIT_CONVERSION_RATE' } });
  const conversionRate = configRate ? parseFloat(configRate.value) || 10 : 10;
  if (!configRate) {
    await prisma.systemConfig.upsert({
      where: { key: 'VOLUNTEER_CREDIT_CONVERSION_RATE' },
      update: {},
      create: { key: 'VOLUNTEER_CREDIT_CONVERSION_RATE', value: '10', description: 'Conversion rate from volunteer credits to Rupees (1 credit = X Rs)' }
    }).catch(() => {});
  }

  // Dynamic reward options from VolunteerRewardOption table
  let rewardOptions = await prisma.volunteerRewardOption.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' }
  });
  if (rewardOptions.length === 0) {
    await prisma.volunteerRewardOption.createMany({
      data: [
        { title: 'MHN Gift Card ₹500', rewardType: 'GIFT_CARD', pointsRequired: 50, valueRs: 500, description: 'Valid across MaiHoonNa health packages and consultations', displayOrder: 1 },
        { title: 'MHN Gift Card ₹1,000', rewardType: 'GIFT_CARD', pointsRequired: 100, valueRs: 1000, description: 'Valid across MaiHoonNa health packages and consultations', displayOrder: 2 },
        { title: 'MHN Gift Card ₹1,500', rewardType: 'GIFT_CARD', pointsRequired: 150, valueRs: 1500, description: 'Valid across MaiHoonNa health packages and consultations', displayOrder: 3 }
      ]
    }).catch(() => {});
    rewardOptions = await prisma.volunteerRewardOption.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' }
    });
  }

  // Fetch all generated unique reward coupons for this volunteer
  const coupons = await prisma.volunteerRewardCoupon.findMany({
    where: { volunteerId },
    orderBy: { createdAt: 'desc' }
  });

  return {
    availableCredits: volunteer.totalCreditPoints,
    totalCreditHours: volunteer.totalCreditHours,
    totalEarned,
    totalRedeemed,
    conversionRate,
    rewardOptions,
    coupons,
    transactions: txs
  };
};

export const redeemVolunteerCredits = async (
  volunteerId: string,
  options: { points: number; redeemType: string; details: any }
) => {
  const { points, redeemType, details } = options;

  if (points <= 0) {
    throw new ApiError(400, 'Please enter a positive number of credits to redeem.');
  }

  const result = await prisma.$transaction(async (tx) => {
    const volunteer = await tx.volunteer.findUnique({
      where: { id: volunteerId }
    });
    if (!volunteer) throw new ApiError(404, 'Volunteer profile not found');

    if (volunteer.totalCreditPoints < points) {
      throw new ApiError(400, `Insufficient credits balance. You have ${volunteer.totalCreditPoints.toFixed(0)} points available.`);
    }

    const newBalance = volunteer.totalCreditPoints - points;

    await tx.volunteer.update({
      where: { id: volunteerId },
      data: { totalCreditPoints: newBalance }
    });

    // Fetch conversion rate
    const configRate = await tx.systemConfig.findUnique({ where: { key: 'VOLUNTEER_CREDIT_CONVERSION_RATE' } });
    const conversionRate = configRate ? parseFloat(configRate.value) || 10 : 10;

    let targetDesc = '';
    let generatedCoupon: any = null;

    if (redeemType === 'UPI_TRANSFER') {
      targetDesc = `UPI ID: ${details?.upiId || 'Direct Transfer'}`;
    } else if (redeemType === 'GIFT_CARD' || redeemType === 'MHN_GIFT_CARD') {
      const code = `MHN-GIFT-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      generatedCoupon = await tx.volunteerRewardCoupon.create({
        data: {
          code,
          volunteerId,
          rewardOptionId: details?.optionId || null,
          pointsRedeemed: points,
          valueRs: points * conversionRate,
          status: 'ACTIVE'
        }
      });
      targetDesc = `MHN Gift Card (Code: ${code})`;
    } else if (redeemType === 'DISCOUNT_COUPON') {
      targetDesc = `${details?.couponType || 'MHN Care Discount Coupon'}`;
    } else {
      targetDesc = details?.target ? `Target: ${details.target}` : 'Showcase Redemption';
    }

    const transaction = await tx.volunteerCreditTransaction.create({
      data: {
        volunteerId,
        type: 'redeemed',
        minutesDelta: 0,
        pointsDelta: -points,
        balanceAfter: newBalance,
        description: redeemType === 'GIFT_CARD' 
          ? 'Gift Card Claimed' 
          : `UPI Withdrawal\nID: ${targetDesc}`,
      }
    });

    return {
      success: true,
      balance: newBalance,
      message: generatedCoupon
        ? `Successfully redeemed ${points} credits (₹${points * conversionRate} value) for MHN Gift Card.\n\nYour Unique Voucher Code: ${generatedCoupon.code}`
        : `Successfully redeemed ${points} credits (₹${points * conversionRate} value) for ${redeemType.replace(/_/g, ' ')}.`,
      transaction,
      coupon: generatedCoupon
    };
  });

  // ST-031, ST-032, ST-061: Dual In-App & Push Notifications on Redemption
  prisma.volunteer.findUnique({
    where: { id: volunteerId },
    select: { name: true, phone: true }
  }).then(vol => {
    if (vol) {
      // ST-031: Redemption Received
      dispatchSaathiRedemptionRequested(volunteerId, {
        volunteerName: vol.name,
        credits: points,
        giftCardBrand: details?.brand || 'MaiHoonNa',
      }).catch(err => console.warn('[redeemVolunteerCredits:ST-031 Error]:', err.message));

      // ST-032: Gift Card Delivered (if coupon was generated)
      if (result.coupon) {
        dispatchSaathiGiftCardDelivered(volunteerId, {
          amount: points * 10,
          giftCardBrand: details?.brand || 'MaiHoonNa',
          recipientContact: vol.phone,
          code: result.coupon.code,
        }).catch(err => console.warn('[redeemVolunteerCredits:ST-032 Error]:', err.message));
      }

      // ST-061: Coordinator Alert: Redemption Awaiting Approval
      prisma.user.findFirst({
        where: { role: { in: ['admin', 'operations_manager', 'master_admin'] } },
        select: { id: true }
      }).then(adminUser => {
        if (adminUser) {
          dispatchCoordinatorRedemptionAwaitingApproval(adminUser.id, {
            volunteerName: vol.name,
            credits: points,
            estimatedValue: points * 10,
            giftCardBrand: details?.brand || 'MaiHoonNa',
            redemptionId: result.coupon?.id || result.transaction?.id,
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  }).catch(() => {});

  return result;
};

export const validateVolunteerCoupon = async (code: string) => {
  const coupon = await prisma.volunteerRewardCoupon.findUnique({ where: { code } });
  if (!coupon) throw new ApiError(404, 'Invalid voucher code.');
  if (coupon.status === 'CLAIMED') throw new ApiError(400, 'This gift voucher has already been claimed.');
  if (coupon.status !== 'ACTIVE') throw new ApiError(400, `This gift voucher is currently ${coupon.status.toLowerCase()}.`);
  return { valid: true, coupon, message: `Valid ₹${coupon.valueRs} MHN Gift Voucher!` };
};

export const claimVolunteerCoupon = async (code: string, userId?: string) => {
  return await prisma.$transaction(async (tx) => {
    const coupon = await tx.volunteerRewardCoupon.findUnique({ where: { code } });
    if (!coupon) throw new ApiError(404, 'Invalid voucher code.');
    if (coupon.status === 'CLAIMED') throw new ApiError(400, 'This gift voucher has already been claimed.');
    if (coupon.status !== 'ACTIVE') throw new ApiError(400, `This gift voucher is currently ${coupon.status.toLowerCase()}.`);

    const updated = await tx.volunteerRewardCoupon.update({
      where: { code },
      data: {
        status: 'CLAIMED',
        claimedAt: new Date(),
        claimedByUserId: userId || null
      }
    });
    return { success: true, coupon: updated, message: `Successfully claimed ₹${updated.valueRs} MHN Gift Voucher!` };
  });
};

export const proposeRescheduleForSathiRequest = async (
  volunteerId: string,
  requestId: string,
  proposedDateTime: string,
  message?: string
) => {
  const request = await prisma.sathiVisitRequest.findUnique({
    where: { id: requestId },
    include: { beneficiary: true }
  });

  if (!request) {
    throw new ApiError(404, 'Sathi visit request not found.');
  }

  const assignment = await prisma.volunteerAssignment.findFirst({
    where: { volunteerId, beneficiaryId: request.beneficiaryId, isActive: true }
  });

  if (!assignment) {
    throw new ApiError(403, 'You are not assigned as a companion to this beneficiary.');
  }

  if (!['PENDING', 'RESCHEDULE_PROPOSED'].includes(request.status)) {
    throw new ApiError(400, `Cannot propose reschedule for a request with status: ${request.status}.`);
  }

  const proposed = new Date(proposedDateTime);
  if (isNaN(proposed.getTime())) {
    throw new ApiError(400, 'Invalid proposed date/time.');
  }

  const updatedRequest = await prisma.sathiVisitRequest.update({
    where: { id: requestId },
    data: {
      status: 'RESCHEDULE_PROPOSED',
      proposedDateTime: proposed,
      proposedBy: volunteerId,
      rejectionReason: message || null
    },
    include: { beneficiary: { include: { user: true, subscriber: true } } }
  });

  // Asynchronous fire-and-forget notification (runs in background to prevent API latency)
  setImmediate(async () => {
    try {
      let volName = 'Saathi companion';
      const vol = await prisma.volunteer.findUnique({
        where: { id: volunteerId },
        select: { name: true }
      });
      if (vol?.name) {
        volName = vol.name;
      } else {
        const u = await prisma.user.findUnique({
          where: { id: volunteerId },
          select: { name: true }
        });
        if (u?.name) volName = u.name;
      }
      const recipientPhone = updatedRequest.beneficiary?.user?.phone || updatedRequest.beneficiary?.subscriber?.phone;
      if (recipientPhone) {
        const formattedDate = proposed.toLocaleDateString('en-IN', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
        });
        await notificationProducer.publish({
          idempotencyKey: `sathi-reschedule-${requestId}-${Date.now()}`,
          channel: 'whatsapp',
          event: 'APPOINTMENT_RESCHEDULED_CANCELLED',
          recipient: { phone: recipientPhone },
          variables: {
            appointmentType: 'Saathi visit',
            status: `rescheduled by ${volName}`,
            newDetails: `Proposed for ${formattedDate}. Tap your app to confirm or pick another slot.`
          }
        });
      }
    } catch (notifErr: any) {
      console.error('[SathiService] Background WhatsApp notification error:', notifErr.message);
    }
  });

  return { request: updatedRequest, message: 'Reschedule proposal sent to beneficiary.' };
};

export const getVolunteerSathiRequests = async (volunteerId: string) => {
  const assignments = await prisma.volunteerAssignment.findMany({
    where: { volunteerId, isActive: true },
    select: { beneficiaryId: true }
  });

  const beneficiaryIds = assignments.map(a => a.beneficiaryId);

  const requests = await prisma.sathiVisitRequest.findMany({
    where: {
      beneficiaryId: { in: beneficiaryIds },
      status: 'PENDING',
      OR: [
        { volunteerId: null },
        { volunteerId: volunteerId }
      ],
      NOT: {
        rejectedBy: { has: volunteerId }
      }
    },
    include: {
      beneficiary: {
        select: {
          id: true,
          name: true,
          photo: true,
          age: true,
          address: true
        }
      }
    },
    orderBy: { dateTime: 'asc' }
  });

  return requests;
};



export const respondToSathiVisitRequest = async (
  volunteerId: string,
  requestId: string,
  action: 'ACCEPT' | 'REJECT',
  rejectionReason?: string
) => {
  const request = await prisma.sathiVisitRequest.findUnique({
    where: { id: requestId },
    include: { beneficiary: true }
  });

  if (!request) {
    throw new ApiError(404, 'Sathi visit request not found.');
  }

  const assignment = await prisma.volunteerAssignment.findFirst({
    where: { volunteerId, beneficiaryId: request.beneficiaryId, isActive: true }
  });

  if (!assignment) {
    throw new ApiError(403, 'You are not assigned as a companion to this beneficiary.');
  }

  if (request.status !== 'PENDING') {
    throw new ApiError(400, `This request has already been ${request.status.toLowerCase()}.`);
  }

  if (action === 'ACCEPT') {
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

    const updatedRequest = await prisma.sathiVisitRequest.update({
      where: { id: requestId },
      data: {
        status: 'ACCEPTED',
        volunteerId,
        otpCode
      },
      include: { beneficiary: true }
    });

    return { request: updatedRequest, message: 'Visit request accepted successfully.' };
  } else {
    const updatedRejectedBy = [...request.rejectedBy, volunteerId];

    const allAssignments = await prisma.volunteerAssignment.findMany({
      where: { beneficiaryId: request.beneficiaryId, isActive: true },
      select: { volunteerId: true }
    });
    const allVolunteerIds = allAssignments.map(a => a.volunteerId);

    const allRejected = allVolunteerIds.every(vid => updatedRejectedBy.includes(vid));

    const updatedRequest = await prisma.sathiVisitRequest.update({
      where: { id: requestId },
      data: {
        rejectedBy: updatedRejectedBy,
        status: allRejected ? 'REJECTED' : 'PENDING',
        rejectionReason: allRejected ? (rejectionReason || 'Rejected by all assigned companions') : undefined
      },
      include: { beneficiary: true }
    });

    return { request: updatedRequest, message: 'Visit request rejected.' };
  }
};

export const verifySathiVisitOtp = async (volunteerId: string, requestId: string, otpCode: string) => {
  const request = await prisma.sathiVisitRequest.findUnique({
    where: { id: requestId }
  });

  if (!request) {
    throw new ApiError(404, 'Sathi visit request not found.');
  }

  if (request.volunteerId !== volunteerId) {
    throw new ApiError(403, 'You are not the assigned Sathi for this visit.');
  }

  const activeCheckin = await prisma.volunteerVisitLog.findFirst({
    where: { volunteerId, status: 'in_progress' }
  });

  if (activeCheckin) {
    throw new ApiError(400, 'You already have an active visit in progress. Please check out of your current visit before starting a new one.');
  }

  if (request.status !== 'ACCEPTED') {
    throw new ApiError(400, 'This visit is not in an accepted state.');
  }

  if (request.otpCode !== otpCode) {
    throw new ApiError(400, 'Invalid OTP. Please check the code with the beneficiary and try again.');
  }

  const assignment = await prisma.volunteerAssignment.findFirst({
    where: { volunteerId, beneficiaryId: request.beneficiaryId, isActive: true }
  });

  if (!assignment) {
    throw new ApiError(404, 'Assignment not found or inactive.');
  }

  const subscription = await prisma.subscription.findFirst({
    where: {
      beneficiaryId: request.beneficiaryId,
      isActive: true
    },
    include: {
      benefitBalances: {
        include: { benefit: { include: { benefitType: true } } }
      }
    }
  });

  if (!subscription) {
    throw new ApiError(400, 'Beneficiary does not have an active subscription.');
  }

  const sathiBalance = findSathiBenefitBalance(subscription.benefitBalances);

  if (!sathiBalance || (sathiBalance.totalUnits - sathiBalance.usedUnits) <= 0) {
    throw new ApiError(400, 'Beneficiary has exhausted their Sathi Companion benefit hours.');
  }

  const updatedRequest = await prisma.sathiVisitRequest.update({
    where: { id: requestId },
    data: {
      status: 'IN_PROGRESS'
    }
  });

  // Start the timer session
  await prisma.volunteerVisitLog.create({
    data: {
      volunteerId,
      beneficiaryId: request.beneficiaryId,
      assignmentId: assignment.id,
      subscriptionId: subscription.id,
      subscriptionBenefitBalanceId: sathiBalance.id,
      checkInTime: new Date(),
      status: 'in_progress',
    }
  });

  return { request: updatedRequest, message: 'OTP verified. Visit timer started.' };
};

export const submitSathiVisitFeedback = async (
  volunteerId: string, 
  requestId: string, 
  feedbackNotes: string, 
  feedbackRating: number
) => {
  const request = await prisma.sathiVisitRequest.findUnique({
    where: { id: requestId }
  });

  if (!request) {
    throw new ApiError(404, 'Sathi visit request not found.');
  }

  if (request.volunteerId !== volunteerId) {
    throw new ApiError(403, 'You are not the assigned Sathi for this visit.');
  }

  if (request.status !== 'COMPLETED') {
    throw new ApiError(400, 'You can only submit feedback for completed visits.');
  }

  if (request.feedbackRating) {
    throw new ApiError(400, 'Feedback has already been submitted for this visit.');
  }

  const updatedRequest = await prisma.sathiVisitRequest.update({
    where: { id: requestId },
    data: {
      feedbackNotes,
      feedbackRating
    }
  });

  // ST-052: Visit feedback flags a concern
  const isConcern = (feedbackRating && feedbackRating <= 2) ||
    (feedbackNotes && /(concern|issue|problem|uncomfortable|difficult|emergency|complaint)/i.test(feedbackNotes));

  if (isConcern) {
    prisma.user.findFirst({
      where: { role: { in: ['admin', 'operations_manager', 'master_admin'] } },
      select: { id: true }
    }).then(async (adminUser) => {
      if (adminUser) {
        const vol = await prisma.volunteer.findUnique({ where: { id: volunteerId }, select: { name: true } });
        const ben = await prisma.beneficiary.findUnique({ where: { id: request.beneficiaryId }, select: { name: true } });
        dispatchSaathiFeedbackConcernFlagged(adminUser.id, {
          volunteerName: vol?.name || 'Volunteer',
          beneficiaryName: ben?.name || 'Beneficiary',
          feedbackExcerpt: feedbackNotes.slice(0, 100),
          visitId: requestId,
        }).catch(() => {});
      }
    }).catch(() => {});
  }

  return { request: updatedRequest, message: 'Feedback submitted successfully.' };
};

export const updateVolunteerVisitFeedback = async (volunteerId: string, visitId: string, feedback: string) => {
  const visit = await prisma.volunteerVisitLog.findFirst({
    where: { id: visitId, volunteerId }
  });

  if (!visit) {
    throw new ApiError(404, 'Visit log not found');
  }

  if (visit.status !== 'completed') {
    throw new ApiError(400, 'You can only add feedback to completed visits');
  }

  const updated = await prisma.volunteerVisitLog.update({
    where: { id: visitId },
    data: { feedback }
  });

  // ST-052: Flag concern if feedback text indicates an issue
  if (feedback && /(concern|issue|problem|uncomfortable|difficult|emergency|complaint)/i.test(feedback)) {
    prisma.user.findFirst({
      where: { role: { in: ['admin', 'operations_manager', 'master_admin'] } },
      select: { id: true }
    }).then(async (adminUser) => {
      if (adminUser) {
        const vol = await prisma.volunteer.findUnique({ where: { id: volunteerId }, select: { name: true } });
        const ben = await prisma.beneficiary.findUnique({ where: { id: visit.beneficiaryId }, select: { name: true } });
        dispatchSaathiFeedbackConcernFlagged(adminUser.id, {
          volunteerName: vol?.name || 'Volunteer',
          beneficiaryName: ben?.name || 'Beneficiary',
          feedbackExcerpt: feedback.slice(0, 100),
          visitId,
        }).catch(() => {});
      }
    }).catch(() => {});
  }

  return updated;
};

// ─── Automated Reminders, Nudges & Coordinator Alert Helpers ───────────────────

/**
 * ST-013: No visits logged in 14 days — nudge
 */
export const triggerSaathiInactive14DaysNudge = async (volunteerId: string) => {
  const vol = await prisma.volunteer.findUnique({
    where: { id: volunteerId },
    include: {
      assignments: {
        where: { isActive: true },
        include: { beneficiary: { select: { name: true } } },
        take: 1
      }
    }
  });
  if (!vol) return;
  const benName = vol.assignments[0]?.beneficiary?.name || 'your beneficiaries';
  return dispatchSaathiVisitInactiveNudge(volunteerId, {
    volunteerName: vol.name,
    beneficiaryName: benName
  });
};

/**
 * ST-022: Feedback not yet submitted — reminder
 */
export const triggerSaathiFeedbackReminder = async (volunteerId: string, visitLogId: string) => {
  const log = await prisma.volunteerVisitLog.findUnique({
    where: { id: visitLogId },
    include: {
      volunteer: { select: { name: true } },
      beneficiary: { select: { name: true } }
    }
  });
  if (!log) return;
  const visitDateStr = new Date(log.checkInTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return dispatchSaathiFeedbackReminder(volunteerId, {
    volunteerName: log.volunteer.name,
    beneficiaryName: log.beneficiary.name,
    visitDate: visitDateStr,
    visitId: visitLogId
  });
};

/**
 * ST-025: Monthly goal at-risk — mid-month reminder
 */
export const triggerSaathiMonthlyGoalAtRiskReminder = async (volunteerId: string) => {
  const vol = await prisma.volunteer.findUnique({ where: { id: volunteerId } });
  if (!vol) return;
  return dispatchSaathiMonthlyGoalAtRisk(volunteerId, {
    volunteerName: vol.name,
    hoursLogged: vol.totalCreditHours.toFixed(1),
    goalHours: vol.monthlyGoalHours.toFixed(0)
  });
};

/**
 * ST-026: Visit checked in but never checked out
 */
export const triggerSaathiVisitNotCheckedOutAlert = async (volunteerId: string, visitLogId: string) => {
  const log = await prisma.volunteerVisitLog.findUnique({
    where: { id: visitLogId },
    include: {
      volunteer: { select: { name: true } },
      beneficiary: { select: { name: true } }
    }
  });
  if (!log) return;
  const visitDateStr = new Date(log.checkInTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return dispatchSaathiVisitNotCheckedOut(volunteerId, {
    volunteerName: log.volunteer.name,
    beneficiaryName: log.beneficiary.name,
    visitDate: visitDateStr,
    visitId: visitLogId
  });
};

/**
 * ST-033: Credit balance milestone / low-balance nudge
 */
export const triggerSaathiCreditMilestoneNudge = async (volunteerId: string) => {
  const vol = await prisma.volunteer.findUnique({ where: { id: volunteerId } });
  if (!vol) return;
  const estValue = vol.totalCreditPoints * 10;
  return dispatchSaathiCreditBalanceMilestone(volunteerId, {
    volunteerName: vol.name,
    credits: vol.totalCreditPoints.toFixed(0),
    estimatedValue: estValue.toFixed(0)
  });
};

/**
 * ST-042: Incomplete profile nudge
 */
export const triggerSaathiIncompleteProfileNudge = async (volunteerId: string) => {
  const vol = await prisma.volunteer.findUnique({ where: { id: volunteerId } });
  if (!vol) return;
  return dispatchSaathiIncompleteProfileNudge(volunteerId, {
    volunteerName: vol.name
  });
};

/**
 * ST-050: New guide tip / best practice published
 */
export const triggerSaathiGuideTipPublished = async (volunteerId: string, tipTitle: string, tipId?: string) => {
  const vol = await prisma.volunteer.findUnique({ where: { id: volunteerId } });
  if (!vol) return;
  return dispatchSaathiGuideTipPublished(volunteerId, {
    volunteerName: vol.name,
    tipTitle,
    tipId
  });
};

/**
 * ST-051: Emergency support alert acknowledged
 */
export const triggerSaathiEmergencyAcknowledged = async (
  volunteerId: string,
  beneficiaryName: string,
  coordinatorName: string = 'Aastha'
) => {
  return dispatchSaathiEmergencyAcknowledged(volunteerId, {
    beneficiaryName,
    coordinatorName
  });
};

/**
 * ST-062: Volunteer inactive 30+ days (Coordinator alert)
 */
export const triggerCoordinatorVolunteerInactive30dAlert = async (volunteerId: string) => {
  const vol = await prisma.volunteer.findUnique({ where: { id: volunteerId } });
  if (!vol) return;
  const adminUser = await prisma.user.findFirst({
    where: { role: { in: ['admin', 'operations_manager', 'master_admin'] } },
    select: { id: true }
  });
  if (!adminUser) return;
  return dispatchCoordinatorVolunteerInactiveAlert(adminUser.id, {
    volunteerName: vol.name,
    volunteerId
  });
};

