import { Router, Request, Response } from 'express';
import http from 'http';

const router = Router();

// apps/admin-backend listens on port 3001
const ADMIN_BACKEND_URL = (
  process.env.ADMIN_BACKEND_URL || 'http://127.0.0.1:3001'
).replace(/\/+$/, '');

const parsedUrl = new URL(ADMIN_BACKEND_URL);
const targetHost = parsedUrl.hostname || '127.0.0.1';
const targetPort = parseInt(parsedUrl.port, 10) || 3001;

/**
 * Foolproof App-Level Proxy to Admin Backend payment service.
 * Uses native Node.js core 'http.request' (instead of WHATWG fetch) to:
 * 1. Safely stream raw body buffers preserving cryptographic HMAC signatures.
 * 2. Avoid all fetch-level forbidden header restrictions (connection, upgrade, etc.).
 * 3. Guarantee zero-latency forwarding across loopback (127.0.0.1).
 */
router.use((req: Request, res: Response) => {
  const targetPath = `/api/payments${req.path}`;

  // Copy incoming headers but clean out hop-by-hop headers that shouldn't cross proxies
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers.upgrade;

  const rawBody: Buffer | undefined =
    (req as any).rawBody ||
    (req.body
      ? Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
      : undefined);

  if (rawBody && rawBody.length > 0) {
    headers['content-length'] = String(rawBody.length);
  } else {
    delete headers['content-length'];
  }

  const proxyReq = http.request(
    {
      hostname: targetHost,
      port: targetPort,
      path: targetPath,
      method: req.method,
      headers: headers,
    },
    (proxyRes) => {
      res.status(proxyRes.statusCode || 200);
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (value) {
          res.setHeader(key, value);
        }
      }
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err: any) => {
    console.error(`[Payments Proxy Error] Failed forwarding to ${targetHost}:${targetPort}${targetPath}:`, err.message);
    if (!res.headersSent) {
      res.status(502).json({
        success: false,
        message: 'Admin payment service unreachable',
        target: `${targetHost}:${targetPort}${targetPath}`,
        error: err.message,
      });
    }
  });

  if (rawBody && rawBody.length > 0) {
    proxyReq.write(rawBody);
  }
  proxyReq.end();
});

export default router;
