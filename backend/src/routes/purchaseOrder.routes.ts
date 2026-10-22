import { Router } from 'express';
import { PurchaseOrderController } from '../controllers/purchaseOrder.controller';

const router = Router();

router.get('/', PurchaseOrderController.getAll);
router.get('/:id', PurchaseOrderController.getById);
router.post('/', PurchaseOrderController.create);
router.post('/:id/grn', PurchaseOrderController.receiveGRN);

export default router;
