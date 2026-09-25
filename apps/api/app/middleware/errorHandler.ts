import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';

/**
 * Production-Safe Global Error Handler
 *
 * This middleware is the LAST line of defence before an error reaches the mobile app.
 * It classifies every error and returns ONLY safe, user-friendly messages in production.
 *
 * Rules:
 *  1. ApiError (thrown intentionally by service code) → pass message through as-is
 *  2. Prisma known errors (P2002, P2025, etc.) → map to friendly messages
 *  3. JWT errors → return 401 with a clean message
 *  4. Validation errors (Zod) → return 400 with field details
 *  5. Everything else in production → generic "Something went wrong" (never leak internals)
 *  6. In development → full error detail + stack trace for debugging
 */
export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isDev = process.env.NODE_ENV === 'development';

  // ── 1. Already a structured ApiError — pass through ─────────────────────────
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors || [],
      ...(isDev && { stack: err.stack }),
    });
    return;
  }

  // ── 2. Prisma Client Known Request Errors ────────────────────────────────────
  if (err?.name === 'PrismaClientKnownRequestError' || err?.code?.startsWith('P')) {
    const prismaMessage = mapPrismaError(err);
    console.error(`[DB Error] Prisma ${err.code}:`, err.message);
    res.status(400).json({
      success: false,
      message: prismaMessage,
      ...(isDev && { prismaCode: err.code, stack: err.stack }),
    });
    return;
  }

  // ── 3. Prisma Validation / Initialization Errors ─────────────────────────────
  if (
    err?.name === 'PrismaClientValidationError' ||
    err?.name === 'PrismaClientInitializationError'
  ) {
    console.error('[DB Error] Prisma validation/init error:', err.message);
    res.status(500).json({
      success: false,
      message: 'A database configuration error occurred. Please try again later.',
      ...(isDev && { stack: err.stack }),
    });
    return;
  }

  // ── 4. JWT Errors ─────────────────────────────────────────────────────────────
  if (err?.name === 'JsonWebTokenError') {
    res.status(401).json({ success: false, message: 'Invalid or malformed session token. Please log in again.' });
    return;
  }
  if (err?.name === 'TokenExpiredError') {
    res.status(401).json({ success: false, message: 'Your session has expired. Please log in again.' });
    return;
  }
  if (err?.name === 'NotBeforeError') {
    res.status(401).json({ success: false, message: 'Session token is not yet active. Please try again.' });
    return;
  }

  // ── 5. Zod / Validation Errors ───────────────────────────────────────────────
  if (err?.name === 'ZodError') {
    const fieldErrors = err.errors?.map((e: any) => ({
      field: e.path?.join('.'),
      message: e.message,
    }));
    res.status(400).json({
      success: false,
      message: 'Invalid request data. Please check your inputs.',
      errors: fieldErrors || [],
    });
    return;
  }

  // ── 6. Express body-parser / payload errors ───────────────────────────────────
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ success: false, message: 'File or request payload is too large.' });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ success: false, message: 'Invalid JSON in request body.' });
    return;
  }

  // ── 7. Multer / File Upload Errors ───────────────────────────────────────────
  if (err?.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ success: false, message: 'Uploaded file exceeds the maximum allowed size.' });
    return;
  }
  if (err?.code === 'LIMIT_UNEXPECTED_FILE') {
    res.status(400).json({ success: false, message: 'Unexpected file field in upload. Please try again.' });
    return;
  }

  // ── 8. Network / DB connection errors ────────────────────────────────────────
  if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND') {
    console.error('[Network Error]', err.code, err.message);
    res.status(503).json({ success: false, message: 'Service temporarily unavailable. Please try again later.' });
    return;
  }

  // ── 9. Plain Error thrown with a user-safe message (from services) ────────────
  //    Only pass through if message doesn't contain internal paths, SQL, or Prisma text
  if (err instanceof Error && isTrustedMessage(err.message)) {
    const statusCode = (err as any).statusCode || 400;
    res.status(statusCode).json({ success: false, message: err.message });
    return;
  }

  // ── 10. Catch-all: unknown / unexpected errors ────────────────────────────────
  //    In PRODUCTION: generic message — NEVER leak internal stack traces to the mobile app
  //    In DEVELOPMENT: full detail for debugging
  console.error('[Unhandled Error]', err);
  res.status(500).json({
    success: false,
    message: isDev
      ? (err?.message || 'Internal server error')
      : 'Something went wrong on our end. Please try again later.',
    ...(isDev && { stack: err?.stack }),
  });
}

// ─── Prisma Error Code → User-Friendly Message Map ───────────────────────────
function mapPrismaError(err: any): string {
  switch (err.code) {
    case 'P2002': {
      const field = err.meta?.target?.[0] || 'value';
      if (field.includes('email')) return 'This email address is already linked to another account.';
      if (field.includes('phone')) return 'This phone number is already registered.';
      return `A record with this ${field} already exists.`;
    }
    case 'P2025':
      return 'The requested record was not found.';
    case 'P2003':
      return 'This action references a related record that does not exist.';
    case 'P2014':
      return 'This action would violate a required relationship. Please check your data.';
    case 'P2016':
      return 'Required data is missing. Please provide all required fields.';
    case 'P2034':
      return 'A conflict occurred due to simultaneous requests. Please try again.';
    default:
      return 'A database error occurred. Please try again.';
  }
}

// ─── Guard: is this error message safe to show the user? ─────────────────────
// Returns false if message contains internal file paths, SQL, Prisma internals, etc.
function isTrustedMessage(message: string): boolean {
  const dangerPatterns = [
    /prisma/i,
    /\bsql\b/i,
    /constraint/i,
    /\/home\//i,
    /\/usr\//i,
    /node_modules/i,
    /\.js:\d+/,        // e.g. "service.js:73:39"
    /stack trace/i,
    /ECONNREFUSED/i,
    /P\d{4}/,          // Prisma error codes like P2002
    /invocation in/i,  // Prisma stack message fragment
  ];
  return !dangerPatterns.some((pattern) => pattern.test(message));
}
