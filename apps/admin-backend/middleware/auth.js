const { verifyAccessToken } = require('../utils/jwt');
const { prisma } = require('../lib/prisma');

/**
 * Middleware to verify JWT Access Token and attach live user role
 */
const verifyToken = async (req, res, next) => {
  let token = null;
  const authHeader = req.headers['authorization'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access denied. No valid token provided.' 
    });
  }
  const decoded = verifyAccessToken(token);

  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: 'Token expired or invalid. Please refresh your session.',
      code: 'TOKEN_EXPIRED'
    });
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, phone: true, role: true, isActive: true }
    });

    if (!dbUser || dbUser.isActive === false) {
      return res.status(401).json({
        success: false,
        message: 'Account not found or inactive. Access denied.'
      });
    }

    req.user = {
      ...decoded,
      id: dbUser.id,
      role: dbUser.role,
      name: dbUser.name || decoded.name
    };
    next();
  } catch (err) {
    console.error('[Auth Middleware] Database lookup error:', err);
    return res.status(500).json({
      success: false,
      message: 'Authentication service temporarily unavailable.'
    });
  }
};

/**
 * Middleware to restrict access based on user roles
 * @param {...string} allowedRoles - Roles permitted to access the route
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to perform this action.'
      });
    }
    if (req.user.role === 'master_admin' || allowedRoles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You do not have permission to perform this action.'
    });
  };
};

module.exports = {
  verifyToken,
  authorizeRoles
};
