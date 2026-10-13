import { Router } from 'express';
import authRouter from './auth.routes';
import profileRouter from './profile.routes';
import matchesRouter from './matches.routes';
import visitsRouter from './visits.routes';
import visitRequestsRouter from './visit-requests.routes';
import redemptionsRouter from './redemptions.routes';

const router = Router();

router.use('/', authRouter);
router.use('/', profileRouter);
router.use('/', matchesRouter);
router.use('/', visitsRouter);
router.use('/', visitRequestsRouter);
router.use('/', redemptionsRouter);

export default router;
// trigger restart 
// restart 
