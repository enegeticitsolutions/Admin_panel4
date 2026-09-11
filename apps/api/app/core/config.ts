import * as dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: (() => {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is missing in production mode!');
    }
    return secret || 'fallback-secret-dev-only';
  })(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  databaseUrl: process.env.DATABASE_URL || '',
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : '*',
  jsonLimit: process.env.JSON_PAYLOAD_LIMIT || '50mb',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10),
  expoPushUrl: process.env.EXPO_PUSH_URL || 'https://exp.host/--/api/v2/push/send',
  pushTokenPrefix: process.env.EXPO_PUSH_TOKEN_PREFIX || 'ExponentPushToken',
  notifications: {
    lookbackDays: parseInt(process.env.NOTIFICATION_LOOKBACK_DAYS || '7', 10),
    checkIntervalMs: parseInt(process.env.NOTIFICATION_CHECK_INTERVAL_MS || '3600000', 10), // 1 hour
    maxCelebrationsDashboard: parseInt(process.env.MAX_CELEBRATIONS_DASHBOARD || '5', 10),
  },
  zohoCrm: {
    xnQsjsdp: process.env.ZOHO_CRM_XNQSJSDP || '',
    xmIwtLD: process.env.ZOHO_CRM_XMIWTLD || '',
    actionType: process.env.ZOHO_CRM_ACTION_TYPE || 'TGVhZHM=',
    returnURL: process.env.ZOHO_CRM_RETURN_URL || 'https://maihoonna.com/thank-you',
  },
};