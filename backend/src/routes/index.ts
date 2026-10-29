import { Router } from 'express';
import medicineRoutes from './medicine.routes';
import batchRoutes from './batch.routes';
import supplierRoutes from './supplier.routes';
import saleRoutes from './sale.routes';
import purchaseOrderRoutes from './purchaseOrder.routes';
import telemetryRoutes from './telemetry.routes';
import userRoutes from './user.routes';
import branchRoutes from './branch.routes';
import customerRoutes from './customer.routes';
import adjustmentRoutes from './adjustment.routes';
import transferRoutes from './transfer.routes';
import systemRoutes from './system.routes';

const router = Router();

router.use('/medicines', medicineRoutes);
router.use('/batches', batchRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/sales', saleRoutes);
router.use('/purchase-orders', purchaseOrderRoutes);
router.use('/telemetry', telemetryRoutes);
router.use('/users', userRoutes);
router.use('/branches', branchRoutes);
router.use('/customers', customerRoutes);
router.use('/adjustments', adjustmentRoutes);
router.use('/transfers', transferRoutes);
router.use('/system', systemRoutes);

export default router;
