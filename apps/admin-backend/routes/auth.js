const express = require('express');
const { prisma } = require('../lib/prisma');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { 
  signAccessToken, 
  signRefreshToken, 
  verifyRefreshToken 
} = require('../utils/jwt');
const { comparePassword } = require('../utils/password');
const { verifyToken } = require('../middleware/auth');
const { verifyTurnstileToken } = require('../utils/turnstile');

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get tokens
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { phone, password, turnstileToken } = req.body;

    // Verify Cloudflare Turnstile captcha before checking credentials
    const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip;
    await verifyTurnstileToken(turnstileToken, clientIp);

    if (!phone || !password) {
      throw new ApiError(400, 'Phone number and password are required');
    }

    const cleanedPhone = phone.toString().trim().replace(/[\s-]/g, '');
    const plainPhone = cleanedPhone.replace(/^\+91/, '');

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: cleanedPhone },
          { phone: plainPhone },
          { phone: `+91${plainPhone}` },
        ],
      },
      include: { staffProfile: true },
    });

    if (!user || !user.isActive) {
      throw new ApiError(401, 'Invalid credentials or inactive account');
    }

    if (!user.password) {
      throw new ApiError(401, 'Password not set. Please contact support.');
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      throw new ApiError(401, 'Invalid phone number or password');
    }

    // Generate Tokens
    const payload = {
      id: user.id,
      name: user.name || user.staffProfile?.preferredName || '',
      role: user.role,
      phone: user.phone,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken({ id: user.id });

    // Store Refresh Token in DB
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        refreshToken,
        lastLoginAt: new Date() 
      }
    });

    // Log Activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        type: 'SECURITY',
        action: 'LOGGED_IN',
        details: { role: user.role, method: 'password' }
      }
    });

    res.json(
      new ApiResponse(
        200,
        {
          user: {
            id: user.id,
            name: user.name || user.staffProfile?.preferredName || '',
            role: user.role,
            phone: user.phone,
            zoneId: user.staffProfile?.zoneId || null,
          },
          accessToken,
          refreshToken
        },
        'Login successful'
      )
    );
  })
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh Access Token
 */
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ApiError(400, 'Refresh token is required');
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw new ApiError(401, 'Invalid or expired refresh token');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user || user.refreshToken !== refreshToken) {
      throw new ApiError(401, 'Invalid refresh token session');
    }

    // Rotate Tokens
    const payload = {
      id: user.id,
      name: user.name,
      role: user.role,
      phone: user.phone
    };

    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken({ id: user.id });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken }
    });

    res.json(
      new ApiResponse(
        200,
        { accessToken: newAccessToken, refreshToken: newRefreshToken },
        'Token refreshed successfully'
      )
    );
  })
);

/**
 * @route   POST /api/auth/logout
 * @desc    Invalidate Refresh Token
 */
router.post(
  '/logout',
  verifyToken,
  asyncHandler(async (req, res) => {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { refreshToken: null }
    });

    res.json(new ApiResponse(200, null, 'Logged out successfully'));
  })
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 */
router.get(
  '/me',
  verifyToken,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        staffProfile: {
          select: { zoneId: true }
        }
      }
    });

    if (!user) throw new ApiError(404, 'User not found');

    res.json(new ApiResponse(200, user, 'User profile fetched'));
  })
);

module.exports = router;
