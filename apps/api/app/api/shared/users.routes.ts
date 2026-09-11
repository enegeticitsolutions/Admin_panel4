import { Router } from 'express';
import { authenticate, AuthRequest } from './deps';
import prisma from '../../core/database';

const router = Router();

// POST /api/users/push-token
router.post('/push-token', authenticate, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const { token } = authReq.body;
    
    if (!token) {
      return res.status(400).json({ success: false, message: 'Push token is required' });
    }

    const userId = authReq.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // 1. If user is volunteer, sync to Volunteer model
    if (authReq.userRole === 'volunteer') {
      await prisma.volunteer.updateMany({
        where: { id: userId },
        data: { fcmToken: token },
      });
    }

    // 2. Sync to User model (if exists) or create shadow user
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (existingUser) {
      await prisma.user.update({
        where: { id: userId },
        data: { fcmToken: token },
      });
    } else if (authReq.userRole === 'volunteer') {
      const vol = await prisma.volunteer.findUnique({ where: { id: userId } });
      if (vol) {
        await prisma.user.upsert({
          where: { id: vol.id },
          update: { fcmToken: token },
          create: {
            id: vol.id,
            phone: vol.phone,
            name: vol.name,
            role: 'volunteer',
            fcmToken: token,
            isActive: vol.isActive,
          },
        });
      }
    }

    res.json({ success: true, message: 'Push token synced successfully' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/push-token (Unregister token on logout)
router.delete('/push-token', authenticate, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    await prisma.user.updateMany({
      where: { id: userId },
      data: { fcmToken: null },
    });

    if (authReq.userRole === 'volunteer') {
      await prisma.volunteer.updateMany({
        where: { id: userId },
        data: { fcmToken: null },
      });
    }

    res.json({ success: true, message: 'Push token cleared successfully' });
  } catch (error) {
    next(error);
  }
});

// Helper handler for notification list
const getNotificationsHandler = async (req: any, res: any, next: any) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
};

// Helper handler for mark single as read
const markReadHandler = async (req: any, res: any, next: any) => {
  try {
    const authReq = req as AuthRequest;
    const id = authReq.params.id as string;
    const userId = authReq.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
};

// Helper handler for mark all as read
const markAllReadHandler = async (req: any, res: any, next: any) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

// Helper handler for unread count
const getUnreadCountHandler = async (req: any, res: any, next: any) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    res.json({ success: true, count });
  } catch (error) {
    next(error);
  }
};

// Mount handlers for both /notifications and /
router.get('/', authenticate, getNotificationsHandler);
router.get('/notifications', authenticate, getNotificationsHandler);

router.patch('/read-all', authenticate, markAllReadHandler);
router.patch('/notifications/read-all', authenticate, markAllReadHandler);

router.get('/unread-count', authenticate, getUnreadCountHandler);
router.get('/notifications/unread-count', authenticate, getUnreadCountHandler);

router.patch('/:id/read', authenticate, markReadHandler);
router.patch('/notifications/:id/read', authenticate, markReadHandler);

export default router;
