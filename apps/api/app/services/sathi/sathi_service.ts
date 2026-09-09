import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../../core/database';
import { createToken } from '../../core/security';
import { ApiError } from '../../utils/ApiError';
import { OtpFactory } from '../../core/otp/OtpFactory';
import { getBeneficiarySathiEligibility } from '../beneficiary/beneficiary_sathi_service';
import { benefitPeriodManager } from '../benefit/BenefitPeriodManager';
import { benefitLedgerEngine } from '../benefit/BenefitLedgerEngine';
import { UsageType } from '@prisma/client';

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
  return await provider.send(phone);
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

  return { ...volunteer, totalVisits, rating };
};

export const updateVolunteerProfile = async (id: string, data: any) => {
  const updated = await prisma.volunteer.update({
    where: { id },
    data
  });
  return updated;
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

  return {
    applicationStatus: volunteer.applicationStatus,
    rejectionReason: volunteer.rejectionReason,
    rejectedAt: volunteer.rejectedAt ? volunteer.rejectedAt.toISOString() : null,
    reapplyAllowedAfter,
    cooldownDays,
    name: volunteer.name,
    city: volunteer.city,
    state: volunteer.state,
    profilePhoto: volunteer.profilePhoto,
    totalCreditHours: volunteer.totalCreditHours,
    totalCreditPoints: volunteer.totalCreditPoints,
    monthlyGoalHours: volunteer.monthlyGoalHours,
    visitsThisMonth,
    hoursThisMonth,
    totalVisits,
    beneficiariesCount: volunteer.assignments.length,
    activeVisit: volunteer.visitLogs[0] || null,
    assignedBeneficiaries: volunteer.assignments.map(a => ({
      id: a.beneficiary.id,
      name: a.beneficiary.name,
      photo: a.beneficiary.photo || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      age: a.beneficiary.age,
      location: a.beneficiary.address,
      distance: calculateDistance(volunteer.latitude, volunteer.longitude, a.beneficiary.latitude, a.beneficiary.longitude),
      hobbies: a.beneficiary.hobbiesInterests || [],
      assignedAt: a.createdAt.toISOString()
    })),
    visitRequests: pendingRequests.map(r => {
      const lastVisitTime = r.beneficiary.volunteerVisitLogs?.[0]?.checkInTime;
      const lastVisit = lastVisitTime ? new Date(lastVisitTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
      return {
        id: r.id,
        beneficiaryId: r.beneficiaryId,
        name: r.beneficiary.name,
        photo: r.beneficiary.photo || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120',
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
    }),
    upcomingVisits: upcomingVisits.map(v => {
      const assignment = volunteer.assignments.find(a => a.beneficiaryId === v.beneficiaryId);
      return {
        id: v.id,
        beneficiaryId: v.beneficiaryId,
        assignmentId: assignment ? assignment.id : undefined,
        name: v.beneficiary.name,
        photo: v.beneficiary.photo || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120',
        age: v.beneficiary.age,
        location: v.beneficiary.address,
        distance: calculateDistance(volunteer.latitude, volunteer.longitude, v.beneficiary.latitude, v.beneficiary.longitude),
        dateTime: v.dateTime.toISOString(),
        reason: v.reason,
        visitCount: v.beneficiary._count?.volunteerVisitLogs || 0,
        status: v.status
      };
    })
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

  const sathiBalance = subscription.benefitBalances.find(
    b => b.benefit.benefitType.code === 'SATHI_COMPANION' || b.benefit.benefitType.name.toLowerCase().includes('sathi')
  );

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
  const hoursEarned = billableMinutes / 60;

  if (!visitLog.subscriptionBenefitBalanceId) {
    throw new ApiError(400, 'No linked benefit balance found for this session.');
  }

  const sathiBalance = await prisma.subscriptionBenefitBalance.findUnique({
    where: { id: visitLog.subscriptionBenefitBalanceId }
  });

  if (!sathiBalance) {
    throw new ApiError(404, 'Beneficiary benefit balance not found.');
  }

  const currentRemaining = sathiBalance.totalUnits - sathiBalance.usedUnits;
  if (currentRemaining < hoursEarned) {
    throw new ApiError(400, `Insufficient Sathi benefits remaining. Beneficiary has only ${currentRemaining.toFixed(2)} hours left, visit clocked ${hoursEarned.toFixed(2)} hours.`);
  }

  const creditRateStr = await getSystemConfig('SATHI_CREDIT_RATE', '10');
  const creditRate = parseFloat(creditRateStr);
  
  let pointsEarned = 0;
  if (rawMinutes > 0) {
    pointsEarned = (rawMinutes / 60) * creditRate;
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.subscriptionBenefitBalance.update({
      where: { id: visitLog.subscriptionBenefitBalanceId! },
      data: { usedUnits: { increment: hoursEarned } }
    });

    // Synchronize BenefitPeriodBalance & BenefitUsage ledger
    const unitsToDeduct = Math.max(1, Math.round(hoursEarned));
    if (visitLog.subscriptionId) {
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
              notes: `Sathi Companion Visit Completed (${hoursEarned.toFixed(1)} hrs)`,
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

    // Create PackageHoursLog for audit & activity feeds
    if (visitLog.subscriptionId && visitLog.beneficiaryId) {
      await tx.packageHoursLog.create({
        data: {
          subscriptionId: visitLog.subscriptionId,
          beneficiaryId: visitLog.beneficiaryId,
          hoursConsumed: hoursEarned,
          balanceBefore: currentRemaining,
          balanceAfter: Math.max(0, currentRemaining - hoursEarned),
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
        beneficiaryBalanceAfter: currentRemaining - hoursEarned,
        status: 'completed',
        notes: notes ? `${visitLog.notes || ''}\n\nCheckout Notes: ${notes}`.trim() : visitLog.notes
      }
    });

    return completedLog;
  });

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

  return await prisma.$transaction(async (tx) => {
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
    include: { beneficiary: true }
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

  const sathiBalance = subscription.benefitBalances.find(
    b => b.benefit.benefitType.code === 'SATHI_COMPANION' || b.benefit.benefitType.name.toLowerCase().includes('sathi')
  );

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

  return updated;
};
