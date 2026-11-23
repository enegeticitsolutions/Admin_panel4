import { Router, Request, Response } from 'express';
import prisma from '../../core/database';
import { getActiveVitalTemplates } from '../../services/shared/vitals_template_service';

const router = Router();

// GET /api/public/vitals/templates
// Returns active care templates/categories with bundled vitals for Step 3 selection
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const packageType = req.query.packageType as string | undefined;
    const templates = await getActiveVitalTemplates(packageType);
    res.json({ success: true, data: templates });
  } catch (error: any) {
    console.error('Error fetching vital templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vital templates',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// GET /api/public/vitals
// Public endpoint for the mobile app onboarding flow to fetch available vitals
router.get('/', async (req: Request, res: Response) => {
  const { activeOnly } = req.query;
  
  try {
    const where: any = { isLatestVersion: true };
    if (activeOnly === 'true') {
      where.isActive = true;
    }

    const vitals = await prisma.vitalDefinition.findMany({
      where,
      orderBy: { displayOrder: 'asc' },
    });
    
    res.json({ success: true, data: vitals });
  } catch (error: any) {
    console.error('Error fetching vitals in api:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch vitals',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
