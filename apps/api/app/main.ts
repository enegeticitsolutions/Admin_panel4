import 'express-async-errors';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './core/config';
import { ApiError } from './utils/ApiError';
import { checkRedisHealth } from '@maihoonna/notifications';

// Auth Routes
import authRouter from './api/auth/auth.routes';

// Subscriber Routes
import dashboardRouter from './api/subscriber/dashboard.routes';
import subscriptionsRouter from './api/subscriber/subscriptions.routes';
import beneficiariesRouter from './api/subscriber/beneficiaries.routes';
import couponsRouter from './api/subscriber/coupons.routes';
import subscriberRouter from './api/subscriber/subscriber.routes';
import serviceRequestsRouter from './api/subscriber/service-requests.routes';
import addressesRouter from './api/subscriber/addresses.routes';
import subscriberVitalsRouter from './api/subscriber/vitals.routes';
import invoicesRouter from './api/subscriber/invoices.routes';

// Care Companion Routes
import visitsRouter from './api/care_companion/visits.routes';
import profileRouter from './api/care_companion/profile.routes';
import dashboardCcRouter from './api/care_companion/dashboard.routes';
import scheduleCcRouter from './api/care_companion/schedule.routes';
import visitImagesRouter from './api/care_companion/visit-images.routes';

// Admin Routes
import usersRouter from './api/admin/users.routes';

// Shared Routes
import medicationsRouter from './api/shared/medications.routes';
import profilePhotoRouter from './api/shared/profile-photo.routes';
import fileAccessRouter from './api/shared/file-access.routes';
import emergencyRouter from './api/shared/emergency.routes';
import callbackRouter from './api/shared/callback.routes';
import utilizationRouter from './api/shared/utilization.routes';
import sharedUsersRouter from './api/shared/users.routes';

// File Resource Registry — OOP presigned URL system
import { fileResourceRegistry } from './services/file-access/FileResourceRegistry';
import { MedicalRecordResource } from './services/file-access/resources/MedicalRecordResource';
import { VisitImageResource } from './services/file-access/resources/VisitImageResource';
import { ProfilePhotoResource } from './services/file-access/resources/ProfilePhotoResource';
import { BeneficiaryPhotoResource } from './services/file-access/resources/BeneficiaryPhotoResource';

// Beneficiary Routes
import beneficiaryDashboardRouter from './api/beneficiary/dashboard.routes';
import beneficiaryInteractionsRouter from './api/beneficiary/interactions.routes';
import beneficiarySathiRequestsRouter from './api/beneficiary/sathi-requests.routes';
import beneficiaryEmergencyRouter from './api/beneficiary/emergency.routes';

// Subscriber Visits (rating)
import subscriberVisitsRouter from './api/subscriber/visits.routes';

// Public Routes
import publicVitalsRouter from './api/public/vitals.routes';
import publicZonesRouter from './api/public/zones.routes';
import companyRouter from './api/public/company.routes';
import publicEnrollmentRouter from './api/public/enrollment.routes';
import publicLocationRouter from './api/public/location.routes';
import publicHobbiesRouter from './api/public/hobbies.routes';
import publicGuideRouter from './api/public/guide.routes';
// Sathi Network Routes
import sathiRouter from './api/sathi/sathi.routes';

// Website-specific Internal Routes
import websiteRouter from './routes/website/websiteRoutes';

// ⚠️ DEV-ONLY — Remove this import + route registration below when done testing
import devRouter from './api/dev/dev.routes';

const app = express();

// Trust proxy is required if the API is behind a load balancer (Nginx, AWS, Cloudflare, etc.)
// Without this, rate limiting will block the load balancer's IP for everyone!
app.set('trust proxy', 1);
app.set('etag', false);

// Prevent 304 Not Modified caching on dynamic mobile API routes
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ─── Middleware ────────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet());
app.use(globalLimiter as unknown as express.RequestHandler);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, native HTTP clients, curl, etc.)
      if (!origin) return callback(null, true);

      // In development mode, allow local dev servers (localhost, 127.0.0.1, 192.168.x)
      const isDev = process.env.NODE_ENV !== 'production';
      if (isDev && (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('192.168.'))) {
        return callback(null, origin);
      }

      // Check configured origins from CORS_ORIGIN environment variable
      if (config.corsOrigin === '*' || (Array.isArray(config.corsOrigin) && config.corsOrigin.includes('*'))) {
        return callback(null, origin);
      }

      if (Array.isArray(config.corsOrigin) && config.corsOrigin.includes(origin)) {
        return callback(null, origin);
      }

      if (config.corsOrigin === origin) return callback(null, origin);

      // Strictly reject unauthorized origins in production
      return callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(express.json({ limit: config.jsonLimit }));
app.use(express.urlencoded({ extended: true, limit: config.jsonLimit }));

// ─── Routes ───────────────────────────────────────────────────────────────────
const API = '/api';

// ─── File Resource Registry Setup (Presigned URL system) ─────────────────────
// Register all file resource types here. Each type maps to a subclass of FileResource
// that defines its own authorization logic.
// To add a new file type: extend FileResource, register one line below. Done.
fileResourceRegistry.register(new MedicalRecordResource());
fileResourceRegistry.register(new VisitImageResource());
fileResourceRegistry.register(new ProfilePhotoResource());
fileResourceRegistry.register(new BeneficiaryPhotoResource());

app.get(`${API}`, (_req, res) => {
  res.json({ message: 'MaiHoonNa Role-Based API', version: '2.0.0', status: 'active' });
});

app.get(`${API}/health/redis`, async (_req, res) => {
  const isHealthy = await checkRedisHealth();
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'redis',
    connected: isHealthy,
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    mode: isHealthy ? 'redis_streams' : 'in_process_fallback',
  });
});

// Auth Route
app.use(`${API}/auth`, authRouter);

// Role: Subscriber endpoints
app.use(`${API}/subscriber/dashboard`, dashboardRouter);
app.use(`${API}/subscriber/subscriptions`, subscriptionsRouter);
app.use(`${API}/subscriber/beneficiaries`, beneficiariesRouter);
app.use(`${API}/subscriber/coupons`, couponsRouter);
app.use(`${API}/subscriber/service-requests`, serviceRequestsRouter);
app.use(`${API}/subscriber/addresses`, addressesRouter);
app.use(`${API}/subscriber/vitals`, subscriberVitalsRouter);
app.use(`${API}/subscriber/invoices`, invoicesRouter);
app.use(`${API}/subscriber`, subscriberRouter);

// Role: Care Companion endpoints
app.use(`${API}/care-companion/visits`, visitsRouter);
app.use(`${API}/care-companion/profile`, profileRouter);
app.use(`${API}/care-companion/dashboard`, dashboardCcRouter);
app.use(`${API}/care-companion/schedule`, scheduleCcRouter);
app.use(`${API}/care-companion/visit-images`, visitImagesRouter); // visit photo upload/list/delete

// Role: Admin endpoints
app.use(`${API}/admin/users`, usersRouter);

// Role: Beneficiary endpoints
app.use(`${API}/beneficiary/dashboard`, beneficiaryDashboardRouter);
app.use(`${API}/beneficiary/interactions`, beneficiaryInteractionsRouter);
app.use(`${API}/beneficiary/sathi-requests`, beneficiarySathiRequestsRouter);
app.use(`${API}/beneficiary`, beneficiaryEmergencyRouter);
app.use(`${API}/beneficiary`, beneficiaryDashboardRouter);

// Subscriber Visits rating
app.use(`${API}/subscriber/visits`, subscriberVisitsRouter);

// Shared endpoints
app.use(`${API}/shared/medications`, medicationsRouter);
app.use(`${API}/shared/emergency`, emergencyRouter);
app.use(`${API}/shared/callbacks`, callbackRouter);
app.use(`${API}/shared/utilization`, utilizationRouter);
app.use(`${API}/shared/users`, sharedUsersRouter);
app.use(`${API}/notifications`, sharedUsersRouter);

// Profile Photo Upload (all roles)
app.use(`${API}/profile-photo`, profilePhotoRouter);

// Secure File Access — Presigned URL endpoint (all authenticated roles)
app.use(`${API}/files`, fileAccessRouter);
app.use('/app-api/files', fileAccessRouter);

// Public endpoints
app.use(`${API}/public/vitals`, publicVitalsRouter);
app.use(`${API}/public/sathi-guide`, publicGuideRouter);
app.use(`${API}/public/hobbies`, publicHobbiesRouter);
app.use(`${API}/public/zones`, publicZonesRouter);
app.use(`${API}/public/location`, publicLocationRouter);
app.use(`${API}/public/company`, companyRouter);
app.use(`${API}/public`, publicEnrollmentRouter);

// Sathi Network endpoints
app.use(`${API}/sathi`, sathiRouter);

// Website-specific Internal endpoints
app.use(`${API}/website`, websiteRouter);

// ⚠️ DEV-ONLY — Only enabled in development environment
if (config.nodeEnv === 'development') {
  app.use(`${API}/dev`, devRouter);
}

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  next(new ApiError(404, 'Route not found'));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors || [],
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
  });
});

export default app;