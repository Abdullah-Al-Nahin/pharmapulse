import { Router } from 'express';
import { BatchController } from '../controllers/batch.controller';

const router = Router();

router.get('/expiring', BatchController.getExpiring);
router.get('/', BatchController.getAll);
router.get('/medicine/:productId', BatchController.getForMedicine);
router.get('/fefo/:productId', BatchController.getFefoCandidate);
router.post('/', BatchController.create);
router.put('/:id', BatchController.update);
router.post('/:id/quarantine', BatchController.quarantine);

export default router;
