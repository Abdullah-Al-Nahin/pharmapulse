import { Router } from 'express';
import { TelemetryController } from '../controllers/telemetry.controller';

const router = Router();

// GET /api/telemetry/snapshot?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/snapshot', TelemetryController.getSnapshot);

export default router;
