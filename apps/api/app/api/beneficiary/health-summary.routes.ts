import { Router, Response } from 'express';
import prisma from '../../core/database';
import { authenticate, AuthRequest } from '../shared/deps';
import { HealthSummaryService } from '../../services/shared/health_summary_service';

const router = Router();

/**
 * GET /api/beneficiary/health-summary
 * Returns the consolidated health, medical conditions, allergies, vitals,
 * medication schedule, adherence, and care overview for the authenticated senior.
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as string;

    const beneficiary = await prisma.beneficiary.findFirst({
      where: {
        OR: [
          { id: userId },
          { userId: userId }
        ]
      },
      select: { id: true }
    });

    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
    }

    const summary = await HealthSummaryService.getBeneficiaryHealthSummary(beneficiary.id);
    return res.json({ success: true, data: summary });
  } catch (error: any) {
    console.error('Error fetching beneficiary health summary:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

export default router;
