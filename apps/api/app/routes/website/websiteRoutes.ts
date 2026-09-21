/**
 * Website Routes — Entry Point
 *
 * Mounts all website-facing route modules under /api/website.
 *
 * Structure:
 *  lead.routes.ts        → POST /submit-form        (waitlist lead signup)
 *  enrollment.routes.ts  → POST /saathi-enrollment  (Saathi volunteer form)
 *  content.routes.ts     → GET  /health             (health check)
 *                          GET  /content/sathi       (dynamic CMS + live stats)
 *  utils/mailer.ts       → shared Zoho email transporter helpers
 */
import { Router } from 'express';
import leadRouter from './lead.routes';
import sathiRouter from './sathi.routes';
import contentRouter from './content.routes';

import careerRouter from './career.routes';

const router = Router();

// Waitlist lead signup
router.use('/', leadRouter);

// Saathi volunteer enrollment
router.use('/', sathiRouter);

// Career / Express Interest
router.use('/', careerRouter);

// Health check & CMS content
router.use('/', contentRouter);

export default router;
