import { Router, Request, Response } from 'express';

const router = Router();

// apps/admin-backend listens on port 3001
const ADMIN_BACKEND_URL = (
  process.env.ADMIN_BACKEND_URL || 'http://127.0.0.1:3001'
).replace(/\/+$/, '');

/**
 * Proxy all incoming /api/payments/* requests to the Admin Backend payment service.
 * This preserves the raw request body buffer and cryptographic headers (e.g. x-razorpay-signature)
 * for HMAC-SHA256 verification.
 * Note: Express 5 syntax uses router.use for wildcard routing to avoid path-to-regexp PathError.
 */
router.use(async (req: Request, res: Response) => {
  const targetUrl = `${ADMIN_BACKEND_URL}/api/payments${req.path}`;

  try {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      // Exclude host and content-length to let fetch compute correct length and avoid mismatches
      if (lower !== 'host' && lower !== 'content-length' && typeof value === 'string') {
        headers[key] = value;
      }
    }

    // Use rawBody buffer if available to ensure exact byte-for-byte HMAC match
    const rawBody: Buffer | string | undefined =
      (req as any).rawBody ||
      (req.body ? (typeof req.body === 'string' ? Buffer.from(req.body) : Buffer.from(JSON.stringify(req.body))) : undefined);

    const backendRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? (rawBody as any) : undefined,
    });

    const responseData = await backendRes.text();
    const contentType = backendRes.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    res.status(backendRes.status).send(responseData);
  } catch (err: any) {
    const errorDetails = err.cause ? `${err.message} (${err.cause.message || err.cause})` : err.message;
    console.error(`[Payments Proxy Error] Failed forwarding to ${targetUrl}:`, errorDetails);
    res.status(502).json({
      success: false,
      message: 'Admin payment service unreachable',
      targetUrl,
      error: errorDetails,
    });
  }
});

export default router;
