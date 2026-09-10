import { Router, Response } from 'express';
import { authenticate } from '../shared/deps';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import * as beneficiarySathiService from '../../services/beneficiary/beneficiary_sathi_service';

import prisma from '../../core/database';

const router = Router();

async function resolveBeneficiaryId(idParam: string, authReq: any): Promise<string> {
  const beneficiary = await prisma.beneficiary.findFirst({
    where: {
      OR: [
        { id: idParam },
        { userId: idParam }
      ]
    }
  });
  if (!beneficiary) {
    throw new Error('Beneficiary not found');
  }
  
  const isOwner = beneficiary.userId === authReq.userId || beneficiary.subscriberId === authReq.userId;
  const isAdmin = ['admin', 'super_admin', 'field_manager'].includes(authReq.userRole);
  
  if (!isOwner && !isAdmin) {
    throw new Error('Unauthorized to access this beneficiary\'s Saathi data');
  }

  return beneficiary.id;
}

// Route to check if beneficiary is eligible to request Sathi visits
router.get(
  '/:beneficiaryId/sathi/eligibility',
  authenticate,
  asyncHandler(async (req: any, res: Response) => {
    const resolvedId = await resolveBeneficiaryId(req.params.beneficiaryId, req);
    const eligibility = await beneficiarySathiService.getBeneficiarySathiEligibility(resolvedId);
    res.json(new ApiResponse(200, eligibility));
  })
);

// Route to get all Sathi visit requests made by the beneficiary
router.get(
  '/:beneficiaryId/sathi/my-requests',
  authenticate,
  asyncHandler(async (req: any, res: Response) => {
    const resolvedId = await resolveBeneficiaryId(req.params.beneficiaryId, req);
    const requests = await beneficiarySathiService.getBeneficiarySathiRequests(resolvedId);
    res.json(new ApiResponse(200, requests));
  })
);

// Route to get linked volunteers for the beneficiary
router.get(
  '/:beneficiaryId/sathi/volunteers',
  authenticate,
  asyncHandler(async (req: any, res: Response) => {
    const resolvedId = await resolveBeneficiaryId(req.params.beneficiaryId, req);
    const volunteers = await beneficiarySathiService.getLinkedVolunteers(resolvedId);
    res.json(new ApiResponse(200, volunteers));
  })
);

// Route to get a specific volunteer's detailed profile
router.get(
  '/:beneficiaryId/sathi/volunteers/:volunteerId/profile',
  authenticate,
  asyncHandler(async (req: any, res: Response) => {
    const resolvedId = await resolveBeneficiaryId(req.params.beneficiaryId, req);
    const profile = await beneficiarySathiService.getVolunteerDetailedProfile(resolvedId, req.params.volunteerId);
    res.json(new ApiResponse(200, profile));
  })
);

// Route to update assignment status (Connect/Reject)
router.put(
  '/:beneficiaryId/sathi/volunteers/:volunteerId/status',
  authenticate,
  asyncHandler(async (req: any, res: Response) => {
    const { status } = req.body;
    if (!['CONNECTED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Must be CONNECTED or REJECTED.' });
    }
    const resolvedId = await resolveBeneficiaryId(req.params.beneficiaryId, req);
    const result = await beneficiarySathiService.updateAssignmentStatus(resolvedId, req.params.volunteerId, status);
    res.json(new ApiResponse(200, result));
  })
);

// Route to submit a Sathi visit request
router.post(
  '/:beneficiaryId/sathi/visit-requests',
  authenticate,
  asyncHandler(async (req: any, res: Response) => {
    const { dateTime, reason, targetVolunteerId } = req.body;
    const resolvedId = await resolveBeneficiaryId(req.params.beneficiaryId, req);
    const request = await beneficiarySathiService.createSathiVisitRequest(
      resolvedId,
      dateTime,
      reason,
      targetVolunteerId
    );
    res.status(201).json(new ApiResponse(201, request, 'Sathi visit request submitted successfully.'));
  })
);

// Route to respond to a rescheduled Sathi visit request
router.post(
  '/:beneficiaryId/sathi/visit-requests/:requestId/respond-reschedule',
  authenticate,
  asyncHandler(async (req: any, res: Response) => {
    const { action } = req.body; // 'ACCEPT' | 'REJECT'
    if (!action || !['ACCEPT', 'REJECT'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action.' });
    }
    const resolvedId = await resolveBeneficiaryId(req.params.beneficiaryId, req);
    const request = await beneficiarySathiService.respondToSathiReschedule(
      resolvedId,
      req.params.requestId,
      action
    );
    res.json(new ApiResponse(200, request, `Reschedule ${action === 'ACCEPT' ? 'accepted' : 'declined'} successfully.`));
  })
);

// Route to generate / retrieve OTP for an accepted Sathi visit request
router.post(
  '/:beneficiaryId/sathi/visit-requests/:requestId/generate-otp',
  authenticate,
  asyncHandler(async (req: any, res: Response) => {
    const resolvedId = await resolveBeneficiaryId(req.params.beneficiaryId, req);
    const result = await beneficiarySathiService.generateSathiVisitOtp(resolvedId, req.params.requestId);
    res.json(new ApiResponse(200, result, 'OTP generated successfully.'));
  })
);

// Route to complete a Sathi visit
router.post(
  '/:beneficiaryId/sathi/visit-requests/:requestId/complete',
  authenticate,
  asyncHandler(async (req: any, res: Response) => {
    const resolvedId = await resolveBeneficiaryId(req.params.beneficiaryId, req);
    const result = await beneficiarySathiService.completeSathiVisit(resolvedId, req.params.requestId);
    res.json(new ApiResponse(200, result.request, result.message));
  })
);

// Route to submit feedback for a volunteer
router.post(
  '/:beneficiaryId/sathi/volunteers/:volunteerId/feedback',
  authenticate,
  asyncHandler(async (req: any, res: Response) => {
    const { rating, reviewText } = req.body;
    const resolvedId = await resolveBeneficiaryId(req.params.beneficiaryId, req);
    const review = await beneficiarySathiService.submitVolunteerReview(
      req.params.volunteerId,
      resolvedId,
      rating,
      reviewText
    );
    res.status(201).json(new ApiResponse(201, review, 'Feedback submitted successfully.'));
  })
);

// Route to get reviews for a volunteer
router.get(
  '/:beneficiaryId/sathi/volunteers/:volunteerId/reviews',
  authenticate,
  asyncHandler(async (req: any, res: Response) => {
    const reviews = await beneficiarySathiService.getVolunteerReviews(req.params.volunteerId);
    res.json(new ApiResponse(200, reviews));
  })
);

export default router;
