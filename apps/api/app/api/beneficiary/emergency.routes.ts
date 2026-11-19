import { Router, Response } from 'express';
import { authenticate } from '../shared/deps';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import * as emergencyService from '../../services/beneficiary/beneficiary_emergency_service';
import prisma from '../../core/database';

const router = Router();

async function resolveBeneficiaryId(idParam: string): Promise<string> {
  const beneficiary = await prisma.beneficiary.findFirst({
    where: {
      OR: [
        { id: idParam },
        { userId: idParam },
        { subscriberId: idParam }
      ]
    }
  });
  if (!beneficiary) {
    throw new Error('Beneficiary record not found');
  }
  return beneficiary.id;
}

// GET eligibility for emergency support
router.get(
  '/:beneficiaryId/emergency/eligibility',
  authenticate,
  asyncHandler(async (req: any, res: Response) => {
    let targetId = req.params.beneficiaryId;
    try {
      targetId = await resolveBeneficiaryId(req.params.beneficiaryId);
    } catch {
      // Beneficiary record might not exist yet (e.g. prospect or subscriber with no beneficiary record)
    }
    const eligibility = await emergencyService.getBeneficiaryEmergencyEligibility(targetId);
    res.json(new ApiResponse(200, eligibility));
  })
);

// POST trigger emergency alert
router.post(
  '/:beneficiaryId/emergency',
  authenticate,
  asyncHandler(async (req: any, res: Response) => {
    const resolvedId = await resolveBeneficiaryId(req.params.beneficiaryId);
    const { lat, lng, address, description } = req.body || {};
    const result = await emergencyService.triggerEmergencyRequest(
      resolvedId,
      req.user?.id || resolvedId,
      { lat, lng, address, description }
    );
    res.json(new ApiResponse(201, result, 'Emergency alert triggered successfully. Care team notified.'));
  })
);

// GET emergency history for the beneficiary (their own past SOS requests)
router.get(
  '/:beneficiaryId/emergency/history',
  authenticate,
  asyncHandler(async (req: any, res: Response) => {
    const resolvedId = await resolveBeneficiaryId(req.params.beneficiaryId);

    const requests = await prisma.emergencyRequest.findMany({
      where: { beneficiaryId: resolvedId },
      include: {
        requester: { select: { id: true, name: true } },
        assignee:  { select: { id: true, name: true, role: true } },
        beneficiary: {
          include: {
            primaryCC:   { include: { user: { select: { id: true, name: true } } } },
            secondaryCC: { include: { user: { select: { id: true, name: true } } } },
            subscriber:  { select: { id: true, name: true } },
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = requests.map((r) => ({
      id:              r.id,
      ticketNumber:    r.ticketNumber,
      status:          r.status,
      description:     r.description,
      locationAddress: r.locationAddress,
      locationLat:     r.locationLat,
      locationLng:     r.locationLng,
      triggeredAt:     r.createdAt,
      resolvedAt:      r.resolvedAt,
      resolutionNotes: r.resolutionNotes,
      notes:           r.notes,                               // JSON timeline
      notifiedParties: [
        r.beneficiary.subscriber
          ? { role: 'Subscriber (Family)', name: r.beneficiary.subscriber.name }
          : null,
        r.beneficiary.primaryCC?.user
          ? { role: 'Primary Care Companion', name: r.beneficiary.primaryCC.user.name }
          : null,
        r.beneficiary.secondaryCC?.user
          ? { role: 'Secondary Care Companion', name: r.beneficiary.secondaryCC.user.name }
          : null,
      ].filter(Boolean),
      respondedBy: r.assignee
        ? { name: r.assignee.name, role: r.assignee.role }
        : null,
    }));

    res.json(new ApiResponse(200, formatted));
  })
);

export default router;
