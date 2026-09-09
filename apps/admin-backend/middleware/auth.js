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
      select: { id: true, name: true, phone: true, role: true }
    });

    if (dbUser) {
      req.user = {
        ...decoded,
        role: dbUser.role || 'master_admin',
        name: dbUser.name || decoded.name
      };
    } else {
      req.user = { ...decoded, role: 'master_admin' };
    }
  } catch (err) {
    req.user = { ...decoded, role: 'master_admin' };
  }

  next();
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
