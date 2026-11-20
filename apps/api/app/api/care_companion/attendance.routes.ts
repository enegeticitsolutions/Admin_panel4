import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../shared/deps';
import prisma from '../../core/database';

const router = Router();

// Helper to get normalized start of today (UTC midnight or local midnight)
const getStartOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * GET /api/care-companion/attendance/status
 * Returns current shift attendance state for the authenticated Care Companion.
 */
router.get('/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const cc = await prisma.careCompanion.findUnique({
      where: { userId },
      select: { id: true, name: true, isAvailable: true },
    });

    if (!cc) {
      return res.status(404).json({ success: false, message: 'Care Companion profile not found' });
    }

    const today = getStartOfToday();

    // Check for an active ongoing shift
    const activeAttendance = await prisma.staffAttendance.findFirst({
      where: {
        careCompanionId: cc.id,
        status: 'WORKING',
      },
      orderBy: {
        loginTime: 'desc',
      },
    });

    // Calculate total minutes worked today across all closed sessions
    const todayAttendances = await prisma.staffAttendance.findMany({
      where: {
        careCompanionId: cc.id,
        date: today,
      },
    });

    let todayMinutesWorked = 0;
    const now = new Date();

    for (const att of todayAttendances) {
      if (att.status === 'WORKING') {
        const elapsed = Math.max(0, Math.round((now.getTime() - new Date(att.loginTime).getTime()) / 60000));
        todayMinutesWorked += elapsed;
      } else if (att.durationMinutes) {
        todayMinutesWorked += att.durationMinutes;
      }
    }

    const isWorking = Boolean(activeAttendance);
    const elapsedSeconds = activeAttendance
      ? Math.max(0, Math.floor((now.getTime() - new Date(activeAttendance.loginTime).getTime()) / 1000))
      : 0;

    return res.json({
      success: true,
      data: {
        isWorking,
        activeAttendance: activeAttendance
          ? {
              id: activeAttendance.id,
              loginTime: activeAttendance.loginTime.toISOString(),
              loginLat: activeAttendance.loginLat,
              loginLng: activeAttendance.loginLng,
              loginAddress: activeAttendance.loginAddress,
              lastLocationLat: activeAttendance.lastLocationLat,
              lastLocationLng: activeAttendance.lastLocationLng,
              lastLocationTime: activeAttendance.lastLocationTime?.toISOString() || null,
              elapsedSeconds,
            }
          : null,
        todaySummary: {
          totalMinutesWorked: todayMinutesWorked,
          totalHoursWorked: Math.round((todayMinutesWorked / 60) * 10) / 10,
          sessionsCount: todayAttendances.length,
        },
      },
    });
  } catch (error: any) {
    console.error('[attendance/status] Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/care-companion/attendance/login
 * Clock in / Start Duty for Care Companion.
 */
router.post('/login', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const cc = await prisma.careCompanion.findUnique({
      where: { userId },
      select: { id: true, name: true, isAvailable: true },
    });

    if (!cc) {
      return res.status(404).json({ success: false, message: 'Care Companion profile not found' });
    }

    const { latitude, longitude, address, batteryLevel } = req.body || {};
    const lat = typeof latitude === 'number' && !isNaN(latitude) ? latitude : null;
    const lng = typeof longitude === 'number' && !isNaN(longitude) ? longitude : null;
    const now = new Date();
    const today = getStartOfToday();

    // Idempotency: Check if already clocked in
    const existingActive = await prisma.staffAttendance.findFirst({
      where: {
        careCompanionId: cc.id,
        status: 'WORKING',
      },
      orderBy: {
        loginTime: 'desc',
      },
    });

    if (existingActive) {
      // Update telemetry if coordinates were passed
      if (lat && lng) {
        await prisma.staffAttendance.update({
          where: { id: existingActive.id },
          data: {
            lastLocationLat: lat,
            lastLocationLng: lng,
            lastLocationTime: now,
            isGpsActive: true,
          },
        });
      }

      return res.json({
        success: true,
        message: 'Already clocked in',
        data: {
          isWorking: true,
          attendance: existingActive,
        },
      });
    }

    // Create new attendance record
    const attendance = await prisma.staffAttendance.create({
      data: {
        userId,
        careCompanionId: cc.id,
        date: today,
        status: 'WORKING',
        loginTime: now,
        loginLat: lat,
        loginLng: lng,
        loginAddress: typeof address === 'string' ? address.trim() : null,
        lastLocationLat: lat,
        lastLocationLng: lng,
        lastLocationTime: now,
        batteryLevel: typeof batteryLevel === 'number' ? batteryLevel : null,
        isGpsActive: true,
      },
    });

    // Mark companion as available
    await prisma.careCompanion.update({
      where: { id: cc.id },
      data: { isAvailable: true },
    });

    return res.status(201).json({
      success: true,
      message: 'Clocked in successfully. Real-time location tracking active.',
      data: {
        isWorking: true,
        attendance,
      },
    });
  } catch (error: any) {
    console.error('[attendance/login] Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/care-companion/attendance/logout
 * Clock out / End Duty for Care Companion.
 */
router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const cc = await prisma.careCompanion.findUnique({
      where: { userId },
      select: { id: true, name: true, isAvailable: true },
    });

    if (!cc) {
      return res.status(404).json({ success: false, message: 'Care Companion profile not found' });
    }

    const { latitude, longitude, address } = req.body || {};
    const lat = typeof latitude === 'number' && !isNaN(latitude) ? latitude : null;
    const lng = typeof longitude === 'number' && !isNaN(longitude) ? longitude : null;
    const now = new Date();

    // Find active working session
    const activeAttendance = await prisma.staffAttendance.findFirst({
      where: {
        careCompanionId: cc.id,
        status: 'WORKING',
      },
      orderBy: {
        loginTime: 'desc',
      },
    });

    if (!activeAttendance) {
      return res.json({
        success: true,
        message: 'Already clocked out',
        data: {
          isWorking: false,
          durationMinutes: 0,
        },
      });
    }

    const loginTime = new Date(activeAttendance.loginTime);
    const durationMinutes = Math.max(1, Math.round((now.getTime() - loginTime.getTime()) / 60000));

    const updated = await prisma.staffAttendance.update({
      where: { id: activeAttendance.id },
      data: {
        status: 'LOGGED_OUT',
        logoutTime: now,
        logoutLat: lat || activeAttendance.lastLocationLat || null,
        logoutLng: lng || activeAttendance.lastLocationLng || null,
        logoutAddress: typeof address === 'string' ? address.trim() : null,
        durationMinutes,
        isGpsActive: false,
      },
    });

    // Mark companion as unavailable / off duty
    await prisma.careCompanion.update({
      where: { id: cc.id },
      data: { isAvailable: false },
    });

    return res.json({
      success: true,
      message: 'Clocked out successfully.',
      data: {
        isWorking: false,
        durationMinutes,
        totalHours: Math.round((durationMinutes / 60) * 10) / 10,
        attendance: updated,
      },
    });
  } catch (error: any) {
    console.error('[attendance/logout] Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/care-companion/attendance/location-ping
 * Real-time telemetry heartbeat sent periodically while companion is on duty.
 */
router.post('/location-ping', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { latitude, longitude, batteryLevel, isGpsActive = true } = req.body || {};
    const lat = typeof latitude === 'number' && !isNaN(latitude) ? latitude : null;
    const lng = typeof longitude === 'number' && !isNaN(longitude) ? longitude : null;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'Valid latitude and longitude required' });
    }

    // Update active attendance session if one exists
    const activeSession = await prisma.staffAttendance.findFirst({
      where: {
        userId,
        status: 'WORKING',
      },
      orderBy: {
        loginTime: 'desc',
      },
    });

    if (activeSession) {
      await prisma.staffAttendance.update({
        where: { id: activeSession.id },
        data: {
          lastLocationLat: lat,
          lastLocationLng: lng,
          lastLocationTime: new Date(),
          batteryLevel: typeof batteryLevel === 'number' ? batteryLevel : activeSession.batteryLevel,
          isGpsActive: Boolean(isGpsActive),
        },
      });
    }

    return res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error('[attendance/location-ping] Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

export default router;
