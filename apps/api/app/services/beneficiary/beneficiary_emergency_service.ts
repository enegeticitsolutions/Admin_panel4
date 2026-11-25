import prisma from '../../core/database';
import { ApiError } from '../../utils/ApiError';

export const getBeneficiaryEmergencyEligibility = async (beneficiaryId: string) => {
  const activeSubscription = await prisma.subscription.findFirst({
    where: {
      isActive: true,
      isQueued: false,
      endDate: { gte: new Date() },
      OR: [
        { beneficiaryId },
        { subscriberId: beneficiaryId },
        { beneficiary: { userId: beneficiaryId } },
        { beneficiary: { id: beneficiaryId } },
      ],
    },
    select: { id: true },
  });

  if (activeSubscription) {
    return {
      eligible: true,
      benefitName: 'Emergency Support',
      balanceId: null,
      remaining: null,
      unlimited: true,
    };
  }

  return {
    eligible: false,
    benefitName: '',
    balanceId: null,
    remaining: 0,
    unlimited: false,
  };
};

export const triggerEmergencyRequest = async (
  beneficiaryId: string,
  requestedByUserId: string,
  locationDetails?: { lat?: number; lng?: number; address?: string; description?: string }
) => {
  // Emergency Support is free and unlimited for all users with an active subscription
  const { eligible } = await getBeneficiaryEmergencyEligibility(beneficiaryId);
  if (!eligible) {
    throw new ApiError(403, 'An active subscription is required to use Emergency Support. Please subscribe or renew your plan.');
  }

  // Fetch full beneficiary details to assemble complete location and emergency contacts
  const beneficiary = await prisma.beneficiary.findUnique({
    where: { id: beneficiaryId },
    include: {
      user: true,
      subscriber: true,
      primaryCC: {
        include: { user: true }
      },
      secondaryCC: {
        include: { user: true }
      }
    }
  });

  if (!beneficiary) {
    throw new ApiError(404, 'Beneficiary record not found');
  }

  // Format location address from beneficiary record if not passed
  const fullAddress = locationDetails?.address || [
    beneficiary.user?.flatPlot,
    beneficiary.user?.streetArea,
    beneficiary.user?.landmark,
    beneficiary.user?.city,
    beneficiary.user?.state,
    beneficiary.user?.pincode
  ].filter(Boolean).join(', ') || beneficiary.user?.location || 'Address not registered';

  const ticketNumber = `EMG-${Math.floor(100000 + Math.random() * 900000)}`;

  const emergencyReq = await prisma.emergencyRequest.create({
    data: {
      ticketNumber,
      beneficiaryId,
      requestedBy: beneficiary.userId,  // always use the beneficiary's actual user FK
      status: 'open',
      type: 'EMERGENCY_SUPPORT',
      description: locationDetails?.description || 'SOS Emergency Alert triggered from mobile app',
      locationLat: locationDetails?.lat || beneficiary.user?.latitude || null,
      locationLng: locationDetails?.lng || beneficiary.user?.longitude || null,
      locationAddress: fullAddress,
      notes: [
        {
          timestamp: new Date().toISOString(),
          note: `🚨 Emergency alert triggered by ${beneficiary.name}`
        }
      ]
    },
    include: {
      beneficiary: {
        include: {
          user: true,
          subscriber: true,
          primaryCC: { include: { user: true } },
          secondaryCC: { include: { user: true } }
        }
      }
    }
  });


  // Dispatch notifications to Subscriber, Primary CC, and Secondary CC
  const notificationTargets = [
    { userId: beneficiary.subscriberId, title: `🚨 Emergency Alert: ${beneficiary.name}`, message: `Emergency triggered for ${beneficiary.name} at ${fullAddress}. Ticket: ${ticketNumber}` },
    ...(beneficiary.primaryCC?.userId ? [{ userId: beneficiary.primaryCC.userId, title: `🚨 Emergency Alert: ${beneficiary.name}`, message: `Assigned Beneficiary ${beneficiary.name} triggered SOS Emergency! Ticket: ${ticketNumber}` }] : []),
    ...(beneficiary.secondaryCC?.userId ? [{ userId: beneficiary.secondaryCC.userId, title: `🚨 Emergency Alert: ${beneficiary.name}`, message: `Assigned Beneficiary ${beneficiary.name} triggered SOS Emergency! Ticket: ${ticketNumber}` }] : [])
  ];

  for (const target of notificationTargets) {
    if (target.userId) {
      try {
        await prisma.notification.create({
          data: {
            userId: target.userId,
            title: target.title,
            body: target.message,
            type: 'emergency_alert'
          }
        });
      } catch (err) {
        console.error('Failed to create emergency notification:', err);
      }
    }
  }

  return emergencyReq;
};
