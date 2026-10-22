import { Router } from 'express';
import { PosController } from '../controllers/posController';
import { authenticateToken, requirePermission, enforceMaxDiscount } from '../middleware/rbacMiddleware';

export const posRouter = Router();

// Search medications and active batches with FEFO priority
posRouter.get(
  '/search',
  authenticateToken,
  requirePermission('pos:sale:view'),
  PosController.searchProducts
);

// Process checkout invoice with FEFO stock deduction, expiry prevention, and Cashier discount threshold check
posRouter.post(
  '/sales',
  authenticateToken,
  requirePermission('pos:sale:create'),
  enforceMaxDiscount(),
  PosController.processSale
);

export default posRouter;
