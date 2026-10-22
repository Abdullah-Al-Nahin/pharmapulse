import { Router } from 'express';
import { InventoryController } from '../controllers/inventoryController';
import { authenticateToken, requirePermission } from '../middleware/rbacMiddleware';

export const inventoryRouter = Router();

// Inward GRN reception and automated batch registration
inventoryRouter.post(
  '/purchases/receive',
  authenticateToken,
  requirePermission('purchases:grn:receive'),
  InventoryController.receiveGoods
);

// Expiry Alert Engine analytics (<30, <60, <90 days, Expired, Safe)
inventoryRouter.get(
  '/expiry-alerts',
  authenticateToken,
  requirePermission('reports:expiry:view'),
  InventoryController.getExpiryAlertReport
);

// Damage, shrinkage, and expiry disposal stock adjustments
inventoryRouter.post(
  '/adjustments',
  authenticateToken,
  requirePermission('inventory:stock:adjust'),
  InventoryController.adjustStock
);

export default inventoryRouter;
