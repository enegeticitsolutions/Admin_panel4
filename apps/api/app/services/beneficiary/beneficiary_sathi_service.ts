import prisma from '../../core/database';
import { ApiError } from '../../utils/ApiError';
import { UsageType } from '@prisma/client';
import { isSathiBenefit, findSathiBenefitBalance } from '../../constants/systemBenefits';
import { benefitPeriodManager } from '../benefit/BenefitPeriodManager';
import { benefitLedgerEngine } from '../benefit/BenefitLedgerEngine';

export const getBeneficiarySathiEligibility = async (beneficiaryId: string) => {
  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      beneficiaryId,
      isActive: true
    },
    include: {
      package: {
        include: {
          packageBenefits: {
            include: {
              benefit: {
                include: { benefitType: true }
              }
            }
          }
        }
      },
      packageVersion: {
        include: {
          versionBenefits: {
            include: {
              benefit: {
                include: { benefitType: true }
              }
            }
          }
        }
      },
      benefitBalances: {
        include: {
          benefit: {
            include: { benefitType: true }
          }
        }
      }
    }
  });

  let eligible = false;
  let remainingUnits = 0;
  let sathiBalanceId = null;

  for (const sub of activeSubscriptions) {
    if (sub.benefitBalances && sub.benefitBalances.length > 0) {
      for (const bal of sub.benefitBalances) {
        const isSathi = isSathiBenefit(bal.benefit) ||
          bal.benefitId === 'sathi-companion-benefit' ||
          (bal.snapshotBenefitName && bal.snapshotBenefitName.toLowerCase().includes('sathi')) ||
          (bal.benefit?.name && bal.benefit.name.toLowerCase().includes('sathi')) ||
          (bal.benefit?.code && bal.benefit.code.toUpperCase().includes('SATHI'));

        if (isSathi) {
          eligible = true;
          const remaining = bal.totalUnits - bal.usedUnits;
          const available = (bal.availableUnits !== null && bal.availableUnits !== undefined) ? bal.availableUnits : remaining;
          const balanceValue = available > 0 ? available : remaining;
          if (balanceValue > 0) {
            remainingUnits += balanceValue;
          }
          if (!sathiBalanceId) sathiBalanceId = bal.id;
        }
      }
    }

    if (sub.packageVersion?.versionBenefits) {
      for (const pvb of sub.packageVersion.versionBenefits) {
        const isSathi = isSathiBenefit(pvb.benefit) ||
          pvb.benefitId === 'sathi-companion-benefit' ||
          (pvb.snapshotName && pvb.snapshotName.toLowerCase().includes('sathi')) ||
          (pvb.benefit?.name && pvb.benefit.name.toLowerCase().includes('sathi')) ||
          (pvb.benefit?.code && pvb.benefit.code.toUpperCase().includes('SATHI'));

        if (isSathi) {
          eligible = true;
          if (!sathiBalanceId) {
            const remaining = pvb.unitsIncluded;
            if (remaining > 0 || pvb.isUnlimited) {
              remainingUnits += pvb.isUnlimited ? 999 : remaining;
            }
          }
        }
      }
    }

    if (sub.package?.packageBenefits) {
      for (const pb of sub.package.packageBenefits) {
        const isSathi = isSathiBenefit(pb.benefit) ||
          pb.benefitId === 'sathi-companion-benefit' ||
          (pb.benefit?.name && pb.benefit.name.toLowerCase().includes('sathi')) ||
          (pb.benefit?.code && pb.benefit.code.toUpperCase().includes('SATHI'));

        if (isSathi) {
          eligible = true;
          if (!sathiBalanceId && remainingUnits === 0) {
            const remaining = pb.unitsIncluded;
            if (remaining > 0 || pb.isUnlimited) {
              remainingUnits += pb.isUnlimited ? 999 : remaining;
            }
          }
        }
      }
    }
  }

  // Safety: If the beneficiary has any active or in-progress Sathi requests, they must always be eligible to view the screen
  if (!eligible) {
    const activeRequestsCount = await prisma.sathiVisitRequest.count({
      where: {
        beneficiaryId,
        status: { in: ['IN_PROGRESS', 'ACCEPTED', 'PENDING'] }
      }
    });
    if (activeRequestsCount > 0) {
      eligible = true;
    }
  }

  return { eligible, remainingUnits, sathiBalanceId };
};

import {
  dispatchSaathiVisitRequestReceived,
  dispatchSaathiVisitConfirmedByBeneficiary,
  dispatchSaathiBeneficiaryMatched,
  dispatchSaathiBeneficiaryUnmatched,
} from '../sathi/sathi-notification.dispatcher';

export const createSathiVisitRequest = async (beneficiaryId: string, dateTime: string, reason: string, targetVolunteerId?: string) => {
  const { eligible, remainingUnits } = await getBeneficiarySathiEligibility(beneficiaryId);
  if (!eligible) {
    throw new ApiError(400, 'Your active subscription does not include Sathi Companion hours/benefits.');
  }
  if (remainingUnits <= 0) {
    throw new ApiError(400, 'You have 0 remaining Sathi hours. Please contact your coordinator to renew or top up.');
  }

  const request = await prisma.sathiVisitRequest.create({
    data: {
      beneficiaryId,
      dateTime: new Date(dateTime),
      reason,
      status: 'PENDING',
      volunteerId: targetVolunteerId || null
    },
    include: {
      beneficiary: true
    }
  });

  // ST-012: Dispatch New Visit Request in-app & push notification to target volunteer
  if (targetVolunteerId) {
    dispatchSaathiVisitRequestReceived(targetVolunteerId, {
      beneficiaryName: request.beneficiary?.name || 'Beneficiary',
      requestId: request.id
    }).catch(err => console.warn('[createSathiVisitRequest:Notification Error]:', err.message));
  } else {
    // Notify connected volunteers for this beneficiary
    prisma.volunteerAssignment.findMany({
      where: { beneficiaryId, isActive: true },
      select: { volunteerId: true }
    }).then(assignments => {
      for (const a of assignments) {
        dispatchSaathiVisitRequestReceived(a.volunteerId, {
          beneficiaryName: request.beneficiary?.name || 'Beneficiary',
          requestId: request.id
        }).catch(err => console.warn('[createSathiVisitRequest:Notification Error]:', err.message));
      }
    }).catch(() => {});
  }

  return request;
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;  
  const dLon = (lon2 - lon1) * Math.PI / 180; 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; 
  return d;
}

export const getLinkedVolunteers = async (beneficiaryId: string) => {
  const beneficiary = await prisma.beneficiary.findUnique({
    where: { id: beneficiaryId },
    select: { latitude: true, longitude: true }
  });

  const assignments = await prisma.volunteerAssignment.findMany({
    where: { beneficiaryId, isActive: true },
    include: {
      volunteer: {
        include: {
          reviews: true,
          _count: {
            select: {
              visitLogs: { where: { status: 'completed' } }
            }
          }
        }
      }
    }
  });

  const mapVolunteer = (a: any) => {
    const v = a.volunteer;
    
    let rating = 0;
    let reviewCount = 0;
    if (v.reviews && v.reviews.length > 0) {
      const sum = v.reviews.reduce((acc: any, rev: any) => acc + rev.rating, 0);
      rating = sum / v.reviews.length;
      reviewCount = v.reviews.length;
    } else {
      rating = Math.min(5, Math.max(3, 3 + (v.totalCreditPoints / 100)));
    }
    
    let distanceStr = v.city ? `${v.city}${v.state ? `, ${v.state}` : ''}` : (v.address || 'Nearby');
    if (beneficiary?.latitude && beneficiary?.longitude && v.latitude && v.longitude) {
      const dist = calculateDistance(beneficiary.latitude, beneficiary.longitude, v.latitude, v.longitude);
      distanceStr = `${dist.toFixed(1)} km`;
    }

    return {
      id: v.id,
      name: v.name,
      photo: v.profilePhoto || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120',
      rating: rating.toFixed(1),
      reviewCount: reviewCount,
      distance: distanceStr, 
      location: v.city ? `${v.city}${v.state ? `, ${v.state}` : ''}` : (v.address || 'Nearby'),
      hours: v.totalCreditHours.toFixed(1),
      visits: v._count?.visitLogs || 0,
      bio: v.previousExperience || v.whyJoin || 'Volunteer passionate about community support.',
      availability: (v as any).availability || [],
      languages: (v as any).languages || [],
      interests: (v as any).interests || []
    };
  };

  const pending = assignments
    .filter(a => a.status === 'PENDING')
    .map(mapVolunteer);

  const connected = assignments
    .filter(a => a.status === 'CONNECTED' || a.status === null || a.status === undefined)
    .map(mapVolunteer);

  return { pending, connected };
};

export const getVolunteerDetailedProfile = async (beneficiaryId: string, volunteerId: string) => {
  const beneficiary = await prisma.beneficiary.findUnique({
    where: { id: beneficiaryId },
    select: { latitude: true, longitude: true }
  });

  const v = await prisma.volunteer.findUnique({
    where: { id: volunteerId },
    include: {
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    }
  });

  if (!v) {
    throw new ApiError(404, 'Volunteer not found.');
  }

  let rating = 0;
  let reviewCount = 0;
  if (v.reviews && v.reviews.length > 0) {
    const sum = v.reviews.reduce((acc: any, rev: any) => acc + rev.rating, 0);
    rating = sum / v.reviews.length;
    reviewCount = v.reviews.length;
  } else {
    rating = Math.min(5, Math.max(3, 3 + (v.totalCreditPoints / 100)));
  }
  
  let distanceStr = v.city ? `${v.city}${v.state ? `, ${v.state}` : ''}` : (v.address || 'Nearby');
  if (beneficiary?.latitude && beneficiary?.longitude && v.latitude && v.longitude) {
    const dist = calculateDistance(beneficiary.latitude, beneficiary.longitude, v.latitude, v.longitude);
    distanceStr = `${dist.toFixed(1)} km`;
  }

  const visitsCount = await prisma.volunteerVisitLog.count({
    where: { volunteerId: v.id, status: 'completed' }
  });

  return {
    id: v.id,
    name: v.name,
    phone: v.phone,
    photo: v.profilePhoto || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120',
    rating: rating.toFixed(1),
    reviewCount: reviewCount,
    distance: distanceStr, 
    location: v.city ? `${v.city}${v.state ? `, ${v.state}` : ''}` : (v.address || 'Nearby'),
    hours: v.totalCreditHours.toFixed(1),
    visits: visitsCount,
    age: (v as any).age || 35,
    bio: v.previousExperience || v.whyJoin || 'Experienced care companion with a passion for providing companionship and emotional support to seniors.',
    availability: (v as any).availability || [],
    languages: (v as any).languages || ['Hindi', 'English'],
    interests: (v as any).interests || ['Gardening', 'Cooking', 'Temple visits'],
    reviews: v.reviews || []
  };
};

export const getBeneficiarySathiRequests = async (beneficiaryId: string) => {
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
  await prisma.sathiVisitRequest.updateMany({
    where: {
      beneficiaryId,
      status: { in: ['PENDING', 'ACCEPTED'] },
      dateTime: { lt: threeHoursAgo }
    },
    data: {
      status: 'REJECTED',
      rejectionReason: 'Automatically marked as not completed due to timeout.'
    }
  });

  const requests = await prisma.sathiVisitRequest.findMany({
    where: { beneficiaryId },
    include: {
      volunteer: {
        select: {
          name: true,
          profilePhoto: true
        }
      }
    },
    orderBy: { dateTime: 'desc' }
  });

  const now = Date.now();
  const thirtyMinutesMs = 30 * 60 * 1000;

  const sanitizedRequests = requests.map(req => {
    const timeUntilVisitMs = new Date(req.dateTime).getTime() - now;
    if (timeUntilVisitMs > thirtyMinutesMs) {
      return {
        ...req,
        otpCode: null
      };
    }
    return req;
  });

  return sanitizedRequests;
};

export const respondToSathiReschedule = async (beneficiaryId: string, requestId: string, action: 'ACCEPT' | 'REJECT') => {
  const request = await prisma.sathiVisitRequest.findUnique({
    where: { id: requestId }
  });

  if (!request || request.beneficiaryId !== beneficiaryId) {
    throw new ApiError(404, 'Sathi visit request not found.');
  }

  if (request.status !== 'RESCHEDULE_PROPOSED') {
    throw new ApiError(400, 'Request is not in a rescheduled state.');
  }

  if (action === 'ACCEPT') {
    if (!request.proposedDateTime) {
      throw new ApiError(400, 'No proposed date time available to accept.');
    }
    const otpCode = request.otpCode || Math.floor(1000 + Math.random() * 9000).toString();
    const updatedRequest = await prisma.sathiVisitRequest.update({
      where: { id: requestId },
      data: {
        status: 'ACCEPTED',
        dateTime: request.proposedDateTime,
        otpCode,
        rejectionReason: null
      }
    });
    return updatedRequest;
  } else {
    const updatedRequest = await prisma.sathiVisitRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectionReason: 'Beneficiary declined the reschedule proposal.'
      }
    });
    return updatedRequest;
  }
};

export const completeSathiVisit = async (beneficiaryId: string, requestId: string) => {
  const request = await prisma.sathiVisitRequest.findUnique({
    where: { id: requestId }
  });

  if (!request) {
    throw new ApiError(404, 'Sathi visit request not found.');
  }

  if (request.beneficiaryId !== beneficiaryId) {
    throw new ApiError(403, 'You do not have permission to modify this visit request.');
  }

  if (request.status !== 'IN_PROGRESS') {
    throw new ApiError(400, 'This visit is not in progress and cannot be completed.');
  }

  // Find the in_progress log session
  let activeLog = await prisma.volunteerVisitLog.findFirst({
    where: {
      beneficiaryId,
      ...(request.volunteerId ? { volunteerId: request.volunteerId } : {}),
      status: 'in_progress'
    },
    orderBy: { createdAt: 'desc' }
  });

  const checkOutTime = new Date();
  let rawMinutes = 40;
  if (activeLog?.checkInTime) {
    rawMinutes = Math.max(1, (checkOutTime.getTime() - activeLog.checkInTime.getTime()) / 60000);
  } else if (request.updatedAt) {
    rawMinutes = Math.max(1, (checkOutTime.getTime() - new Date(request.updatedAt).getTime()) / 60000);
  }
  // If visit is less than 1 hr (60 min), credit and hours worth 1 hr are added.
  // If greater than 1 hr (60 min), credit and hours accrue per minute (rawMinutes / 60).
  const hoursEarned = rawMinutes < 60 ? 1 : rawMinutes / 60;

  // Find active subscription & Sathi benefit balance to deduct from
  const activeSubscription = await prisma.subscription.findFirst({
    where: { beneficiaryId, isActive: true },
    include: {
      benefitBalances: {
        include: { benefit: { include: { benefitType: true } } }
      }
    }
  });

  let sathiBalance: any = null;
  if (activeLog?.subscriptionBenefitBalanceId) {
    sathiBalance = activeSubscription?.benefitBalances.find(b => b.id === activeLog.subscriptionBenefitBalanceId);
  }
  const hourSpecificBalance = findSathiBenefitBalance(activeSubscription?.benefitBalances || []);
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

  const config = await prisma.systemConfig.findUnique({ where: { key: 'SATHI_CREDIT_RATE' } });
  const creditRate = parseFloat(config ? config.value : '10');
  const pointsEarned = hoursEarned * creditRate;
  const targetVolId = request.volunteerId || activeLog?.volunteerId;

  const updatedRequest = await prisma.$transaction(async (tx) => {
    // 1. Update SathiVisitRequest to COMPLETED
    const completedReq = await tx.sathiVisitRequest.update({
      where: { id: requestId },
      data: {
        status: 'COMPLETED',
        actualDurationMinutes: Math.round(rawMinutes)
      }
    });

    // 2. Update SubscriptionBenefitBalance & Ledger if Sathi balance exists
    if (sathiBalance && activeSubscription) {
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
          performedByUserId: request.volunteerId || beneficiaryId,
        }
      });

      // Sync BenefitPeriodBalance & BenefitLedgerEngine
      try {
        const activePeriod = await benefitPeriodManager.evaluateAndTransitionJIT(activeSubscription.id);
        if (activePeriod) {
          try {
            await benefitLedgerEngine.deductUnits({
              subscriptionId: activeSubscription.id,
              periodId: activePeriod.id,
              benefitId: sathiBalance.benefitId,
              quantity: unitsToDeduct,
              usageType: UsageType.SATHI_HOURS,
              referenceId: activeLog?.id || requestId,
              notes: `Sathi Companion Visit Completed (${Math.round(rawMinutes)} mins)`,
              performedByUserId: request.volunteerId || beneficiaryId,
            }, tx);
          } catch (deductErr) {
            console.error('[Beneficiary Sathi Complete] BenefitLedger deduction warning:', deductErr);
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
        console.error('[Beneficiary Sathi Complete] Period evaluation warning:', periodErr);
      }
    }


    // 3. Update volunteer points & credit transaction
    if (targetVolId) {
      const volunteer = await tx.volunteer.findUnique({
        where: { id: targetVolId }
      });

      if (volunteer) {
        const newHoursTotal = volunteer.totalCreditHours + hoursEarned;
        const newPointsTotal = volunteer.totalCreditPoints + pointsEarned;

        await tx.volunteer.update({
          where: { id: targetVolId },
          data: {
            totalCreditHours: newHoursTotal,
            totalCreditPoints: newPointsTotal
          }
        });

        await tx.volunteerCreditTransaction.create({
          data: {
            volunteerId: targetVolId,
            visitLogId: activeLog?.id || requestId,
            type: 'earned',
            minutesDelta: rawMinutes,
            pointsDelta: pointsEarned,
            balanceAfter: newPointsTotal,
            description: `Visit Verified (${Math.round(rawMinutes)}m)`
          }
        });
      }
    }

    // 4. Update or create volunteer visit log
    if (activeLog) {
      await tx.volunteerVisitLog.update({
        where: { id: activeLog.id },
        data: {
          checkOutTime,
          minutesLogged: rawMinutes,
          hoursEarned,
          creditPointsEarned: pointsEarned,
          beneficiaryBalanceBefore: currentRemaining,
          beneficiaryBalanceAfter: newRemaining,
          subscriptionBenefitBalanceId: sathiBalance?.id || activeLog.subscriptionBenefitBalanceId,
          status: 'completed'
        }
      });
    } else if (targetVolId) {
      const assignment = await tx.volunteerAssignment.findFirst({
        where: { volunteerId: targetVolId, beneficiaryId }
      });
      if (assignment) {
        await tx.volunteerVisitLog.create({
          data: {
            volunteerId: targetVolId,
            beneficiaryId,
            assignmentId: assignment.id,
            subscriptionId: activeSubscription?.id,
            subscriptionBenefitBalanceId: sathiBalance?.id,
            checkInTime: new Date(Date.now() - rawMinutes * 60000),
            checkOutTime,
            minutesLogged: rawMinutes,
            hoursEarned,
            creditPointsEarned: pointsEarned,
            beneficiaryBalanceBefore: currentRemaining,
            beneficiaryBalanceAfter: newRemaining,
            status: 'completed'
          }
        });
      }
    }

    return completedReq;
  });

  // ST-023: Beneficiary confirmed visit completion push & in-app notification
  if (targetVolId) {
    prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      select: { name: true }
    }).then(b => {
      dispatchSaathiVisitConfirmedByBeneficiary(targetVolId, {
        beneficiaryName: b?.name || 'Beneficiary',
        points: pointsEarned.toFixed(0),
        visitId: activeLog?.id || requestId,
      }).catch(err => console.warn('[completeSathiVisit:ST-023 Error]:', err.message));
    }).catch(() => {});
  }

  return { request: updatedRequest, message: `Visit marked as completed successfully. Logged ${hoursEarned.toFixed(1)} hours.` };
};

export const submitVolunteerReview = async (volunteerId: string, beneficiaryId: string, rating: number, reviewText?: string) => {
  if (!rating || rating < 1 || rating > 5) {
    throw new ApiError(400, 'Rating must be between 1 and 5');
  }

  const review = await prisma.volunteerReview.create({
    data: {
      volunteerId,
      beneficiaryId,
      rating,
      reviewText: reviewText || null
    }
  });

  return review;
};

export const getVolunteerReviews = async (volunteerId: string) => {
  const reviews = await prisma.volunteerReview.findMany({
    where: { volunteerId },
    include: {
      beneficiary: {
        select: {
          name: true,
          photo: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  return reviews;
};


export const updateAssignmentStatus = async (beneficiaryId: string, volunteerId: string, status: any) => {
  const assignment = await prisma.volunteerAssignment.findUnique({
    where: {
      volunteerId_beneficiaryId: {
        volunteerId,
        beneficiaryId,
      },
    },
    include: {
      beneficiary: {
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
          user: {
            select: { latitude: true, longitude: true },
          },
        },
      },
      volunteer: {
        select: { id: true, name: true, latitude: true, longitude: true },
      },
    },
  });

  if (!assignment) {
    throw new ApiError(404, 'Assignment not found');
  }

  await prisma.volunteerAssignment.update({
    where: { id: assignment.id },
    data: { status },
  });

  const b = assignment.beneficiary;
  const v = assignment.volunteer;

  // ST-010: Trigger notification ONLY when beneficiary connects with volunteer
  if (status === 'CONNECTED') {
    const bLat = b?.latitude ?? b?.user?.latitude;
    const bLon = b?.longitude ?? b?.user?.longitude;
    const vLat = v?.latitude;
    const vLon = v?.longitude;

    let distanceStr = '1.0';
    if (bLat && bLon && vLat && vLon) {
      const dist = calculateDistance(Number(bLat), Number(bLon), Number(vLat), Number(vLon));
      distanceStr = dist < 0.1 ? '0.1' : dist.toFixed(1);
    }

    dispatchSaathiBeneficiaryMatched(volunteerId, {
      volunteerName: v?.name || 'Volunteer',
      beneficiaryName: b?.name || 'Beneficiary',
      distanceKm: distanceStr,
    }).catch(err => console.warn('[updateAssignmentStatus:ST-010 Error]:', err.message));
  } else if (status === 'REJECTED') {
    // ST-011: Trigger notification if beneficiary rejects / removes match
    dispatchSaathiBeneficiaryUnmatched(volunteerId, {
      volunteerName: v?.name || 'Volunteer',
      beneficiaryName: b?.name || 'Beneficiary',
    }).catch(err => console.warn('[updateAssignmentStatus:ST-011 Error]:', err.message));
  }

  return { success: true };
};

export const generateSathiVisitOtp = async (beneficiaryId: string, requestId: string) => {
  const request = await prisma.sathiVisitRequest.findUnique({
    where: { id: requestId },
    include: {
      volunteer: {
        select: {
          id: true,
          name: true,
          profilePhoto: true
        }
      }
    }
  });

  if (!request) {
    throw new ApiError(404, 'Sathi visit request not found.');
  }

  if (request.beneficiaryId !== beneficiaryId) {
    throw new ApiError(403, 'You do not have permission to access this visit request.');
  }

  if (request.status !== 'ACCEPTED') {
    throw new ApiError(400, 'OTP can only be generated for accepted visit requests.');
  }

  const now = Date.now();
  const visitTime = new Date(request.dateTime).getTime();
  const timeUntilVisitMs = visitTime - now;
  const thirtyMinutesMs = 30 * 60 * 1000;

  if (timeUntilVisitMs > thirtyMinutesMs) {
    const minutesLeft = Math.ceil(timeUntilVisitMs / (60 * 1000));
    throw new ApiError(400, `OTP will only be available 30 minutes before the scheduled visit time (in approx ${minutesLeft} mins).`);
  }

  let otpCode = request.otpCode;
  if (!otpCode) {
    otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    await prisma.sathiVisitRequest.update({
      where: { id: requestId },
      data: { otpCode }
    });
  }

  return {
    requestId: request.id,
    otpCode,
    status: request.status,
    dateTime: request.dateTime,
    volunteer: request.volunteer
  };
};
