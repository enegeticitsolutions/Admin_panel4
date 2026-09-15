import { Router } from 'express';
import prisma from '../../core/database';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const [bestPractices, suggestedActivities, faqs, configs] = await Promise.all([
      prisma.saathiBestPractice.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.saathiSuggestedActivity.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.saathiFaq.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.systemConfig.findMany({
        where: {
          key: {
            in: ['SATHI_COORDINATOR_NUMBER', 'EMERGENCY_SERVICES_NUMBER', 'EMERGENCY_HELPLINE_NUMBER']
          }
        }
      })
    ]);

    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }

    res.json({
      success: true,
      data: {
        bestPractices,
        suggestedActivities,
        faqs,
        emergencySupport: {
          coordinatorNumber: configMap['SATHI_COORDINATOR_NUMBER'] || '+91 1244495435',
          emergencyServicesNumber: configMap['EMERGENCY_SERVICES_NUMBER'] || '112',
          helplineNumber: configMap['EMERGENCY_HELPLINE_NUMBER'] || '01142258823',
        }
      },
    });
  } catch (error) {
    console.error('Error fetching guide data:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

export default router;
