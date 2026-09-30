import { Router, Request, Response } from 'express';

const router = Router();

// In production, apps/admin-backend runs on port 5000 (managed by PM2).
// In local dev, it runs on port 3001 or 5000.
const ADMIN_BACKEND_URL = (
  process.env.ADMIN_BACKEND_URL ||
  (process.env.NODE_ENV === 'production' ? 'http://127.0.0.1:5000' : 'http://127.0.0.1:3001')
).replace(/\/+$/, '');

/**
 * Proxy all incoming /api/payments/* requests to the Admin Backend payment service.
 * This preserves the raw request body buffer and cryptographic headers (e.g. x-razorpay-signature)
 * for HMAC-SHA256 verification.
 */
router.all('/*', async (req: Request, res: Response) => {
  const targetUrl = `${ADMIN_BACKEND_URL}/api/payments${req.path}`;

  try {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      // Exclude host header to avoid localhost/virtual host mismatches
      if (key.toLowerCase() !== 'host' && typeof value === 'string') {
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
    console.error(`[Payments Proxy Error] Failed forwarding to ${targetUrl}:`, err.message);
    res.status(502).json({
      success: false,
      message: 'Admin payment service unreachable',
      error: err.message,
    });
  }
});

export default router;
