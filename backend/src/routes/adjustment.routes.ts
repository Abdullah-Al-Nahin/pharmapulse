import { Router } from 'express';
import { AdjustmentController } from '../controllers/adjustment.controller';

const router = Router();

router.get('/', AdjustmentController.getAllAdjustments);
router.post('/', AdjustmentController.createAdjustment);

export default router;
