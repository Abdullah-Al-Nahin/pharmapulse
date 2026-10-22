import { Router } from 'express';
import medicineRoutes from './medicine.routes';
import batchRoutes from './batch.routes';
import supplierRoutes from './supplier.routes';
import saleRoutes from './sale.routes';
import purchaseOrderRoutes from './purchaseOrder.routes';
import telemetryRoutes from './telemetry.routes';

const router = Router();

router.use('/medicines', medicineRoutes);
router.use('/batches', batchRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/sales', saleRoutes);
router.use('/purchase-orders', purchaseOrderRoutes);
router.use('/telemetry', telemetryRoutes);

export default router;
