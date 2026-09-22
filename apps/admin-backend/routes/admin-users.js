const express = require('express');
const { prisma } = require('../lib/prisma');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { hashPassword } = require('../utils/password');

const router = express.Router();

/**
 * Get staff members eligible for admin portal access
 * Must have completed BGV and don't have an admin login yet (or we can re-configure)
 */
router.get(
  '/eligible-staff',
  asyncHandler(async (req, res) => {
    const staff = await prisma.staffProfile.findMany({
      where: {
        bgvVerified: true,
        user: {
          isActive: true
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            role: true,
            password: true
          }
        }
      }
    });

    // Map to a cleaner format
    const eligibleStaff = staff.map(s => ({
      id: s.user.id,
      staffProfileId: s.id,
      name: s.user.name || s.preferredName,
      phone: s.user.phone,
      email: s.user.email,
      currentRole: s.user.role,
      hasPassword: !!s.user.password
    }));

    return res.json(new ApiResponse(200, eligibleStaff, 'Eligible staff fetched successfully'));
  })
);

/**
 * List all users with administrative access
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const adminRoles = [
      'admin',
      'master_admin',
      'operations_manager',
      'field_manager',
      'care_companion',
      'customer_service_manager',
      'customer_service',
      'saathi_coordinator',
      'command_center',
      'emergency_coordinator'
    ];

    const users = await prisma.user.findMany({
      where: {
        role: {
          in: adminRoles
        }
      },
      include: {
        staffProfile: {
          select: {
            id: true,
            bgvVerified: true,
            employmentStatus: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.json(new ApiResponse(200, users, 'Admin users fetched successfully'));
  })
);

/**
 * Create/Enable admin access for a user
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { userId, role, password } = req.body;

    if (!userId || !role || !password) {
      throw new ApiError(400, 'User ID, role, and password are required');
    }

    const hashedPassword = await hashPassword(password);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role,
        password: hashedPassword,
        isActive: true
      }
    });

    await prisma.activityLog.create({
      data: {
        userId,
        type: 'SECURITY',
        action: 'ADMIN_ACCESS_GRANTED',
        details: { role, grantedBy: req.user?.id }
      }
    });

    // Remove password from response
    delete updatedUser.password;

    return res.json(new ApiResponse(200, updatedUser, 'Admin access granted successfully'));
  })
);

/**
 * Reset password for an admin user
 */
router.patch(
  '/:id/password',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      throw new ApiError(400, 'New password is required');
    }

    const hashedPassword = await hashPassword(password);

    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: id,
        type: 'SECURITY',
        action: 'PASSWORD_RESET',
        details: { resetBy: req.user?.id }
      }
    });

    return res.json(new ApiResponse(200, null, 'Password reset successfully'));
  })
);

/**
 * Toggle user active status
 */
router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      throw new ApiError(400, 'isActive status must be a boolean');
    }

    await prisma.user.update({
      where: { id },
      data: {
        isActive
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: id,
        type: 'SECURITY',
        action: isActive ? 'ACCESS_OPENED' : 'ACCESS_CLOSED',
        details: { updatedBy: req.user?.id }
      }
    });

    return res.json(new ApiResponse(200, null, `User access ${isActive ? 'opened' : 'closed'} successfully`));
  })
);

module.exports = router;
