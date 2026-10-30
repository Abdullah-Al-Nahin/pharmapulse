import { Router } from 'express';
import { getDatabaseStats, purgeDatabase } from '../controllers/system.controller';

const router = Router();

router.get('/stats', getDatabaseStats);
router.post('/purge', purgeDatabase);

export default router;

