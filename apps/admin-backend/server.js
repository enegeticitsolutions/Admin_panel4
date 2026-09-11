require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const ApiError = require('./utils/ApiError');
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || '';
const ALLOWED_ORIGINS = FRONTEND_URL.split(',').filter(Boolean).map((s) => s.trim());

const { verifyToken, authorizeRoles } = require('./middleware/auth');
const { verifyAccessToken } = require('./utils/jwt');

// ─── Middleware ───────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '2000', 10),
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for authenticated staff/admin users
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyAccessToken(token);
      return !!decoded;
    }
    return false;
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet());
app.use(globalLimiter);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin || ALLOWED_ORIGINS.includes(origin))
        return callback(null, true);
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

const payloadLimit = process.env.JSON_PAYLOAD_LIMIT || '2mb';
app.use(express.json({
  limit: payloadLimit,
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true, limit: payloadLimit }));

// ─── Routes ───────────────────────────────────────────────────────────────────
// Public routes
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pincode', require('./routes/pincode'));

// Protected routes (Staff/Admin)
const STAFF_ROLES = [
  'master_admin',
  'admin',
  'field_manager',
  'operations_manager',
  'customer_service',
  'sales',
  'care_coordinator'
];
const staffOnly = [verifyToken, authorizeRoles(...STAFF_ROLES)];
const adminsOnly = [verifyToken, authorizeRoles('admin', 'master_admin')];
const mastersOnly = [verifyToken, authorizeRoles('master_admin')];

app.use('/api/zones', staffOnly, require('./routes/zones'));
app.use('/api/users', staffOnly, require('./routes/users'));
app.use('/api/admin-users', mastersOnly, require('./routes/admin-users'));
app.use('/api/upload-document', staffOnly, require('./routes/upload'));
app.use('/api/callbacks', staffOnly, require('./routes/callbacks'));
app.use('/api/teams', adminsOnly, require('./routes/teams'));
app.use('/api/subscribers', staffOnly, require('./routes/subscribers'));
app.use('/api/beneficiaries', staffOnly, require('./routes/beneficiaries'));
app.use('/api/volunteers', staffOnly, require('./routes/volunteers'));
app.use('/api/emergency', staffOnly, require('./routes/emergency'));

// ─── Subscription & Benefits ──────────────────────────────────────────────────
app.use('/api/benefit-types', adminsOnly, require('./routes/benefitTypes'));
app.use('/api/benefits', adminsOnly, require('./routes/benefits'));
app.use('/api/tax-categories', staffOnly, require('./routes/taxCategories'));
app.use('/api/packages', adminsOnly, require('./routes/packages'));
app.use('/api/subscriptions', staffOnly, require('./routes/subscriptions'));
app.use('/api/visits', staffOnly, require('./routes/visits'));
app.use('/api/vitals', staffOnly, require('./routes/vitals'));
app.use('/api/hobbies', staffOnly, require('./routes/hobbies'));
app.use('/api/coupons', adminsOnly, require('./routes/coupons'));
app.use('/api/field-manager', adminsOnly, require('./routes/field-manager'));
app.use('/api/activity-logs', adminsOnly, require('./routes/activity-logs'));
app.use('/api/location', staffOnly, require('./routes/location'));
app.use('/api/regions', adminsOnly, require('./routes/regions'));
app.use('/api/config', mastersOnly, require('./routes/config'));
app.use('/api/saathi-guide', adminsOnly, require('./routes/saathi-guide'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/invoices', staffOnly, require('./modules/invoices/invoice.routes'));

// ─── Secure File Access — Presigned URL (all authenticated staff) ─────────────────
// Route never changes. New file types are registered in the block below.
app.use('/api/files', staffOnly, require('./routes/file-access'));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/ping', (req, res) => res.json({ message: 'pong' }));
app.get('/health', (req, res) => {
  res.json({
    status: 'Admin Panel Backend running',
    port: PORT,
    time: new Date(),
  });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found`));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors || [],
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const { ensureEmergencyBenefit } = require('./utils/initEmergencyBenefit');

// ─── File Resource Registry Setup (Presigned URL OOP system) ─────────────────
// To add a new file type: extend FileResource, register one line here. Done.
const fileRegistry = require('./services/file-access/FileResourceRegistry');
const StaffDocumentResource = require('./services/file-access/resources/StaffDocumentResource');
const AdminProfilePhotoResource = require('./services/file-access/resources/AdminProfilePhotoResource');
const MedicalRecordResource = require('./services/file-access/resources/MedicalRecordResource');
fileRegistry.register(new StaffDocumentResource());
fileRegistry.register(new AdminProfilePhotoResource());
fileRegistry.register(new MedicalRecordResource());

const server = app
  .listen(PORT, async () => {
    console.log(`🚀 Admin Panel Backend running on port ${PORT}`);
    console.log(`📌 Zones API: /api/zones`);
    console.log(`🌐 CORS origin: ${FRONTEND_URL}`);
    await ensureEmergencyBenefit();
  })
  .on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `❌ Port ${PORT} is already in use. Please kill the process or use a different port.`
      );
      process.exit(1);
    } else {
      console.error('❌ Server startup error:', err);
    }
  });

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
const { prisma, pool } = require('./lib/prisma');

async function handleShutdown(signal) {
  console.log(`${signal} signal received: closing database connection...`);
  try {
    await prisma.$disconnect();
    if (pool) await pool.end(); // Ensure the pool is closed to release the port
    console.log('✅ Database connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during disconnect:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
