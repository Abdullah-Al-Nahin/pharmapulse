import { Router } from 'express';
import { PurchaseController } from '../controllers/purchaseController';
import { authenticateToken, requirePermission } from '../middleware/rbacMiddleware';

export const purchaseRouter = Router();

// Purchase Order Creation and Retrieval
purchaseRouter.post(
  '/orders',
  authenticateToken,
  requirePermission('purchases:po:create'),
  PurchaseController.createPurchaseOrder
);

purchaseRouter.get(
  '/orders',
  authenticateToken,
  requirePermission('purchases:po:view'),
  PurchaseController.getPurchaseOrders
);

purchaseRouter.get(
  '/orders/:id',
  authenticateToken,
  requirePermission('purchases:po:view'),
  PurchaseController.getPurchaseOrderById
);

// Goods Receive Note (GRN) & Batch Entry Engine
purchaseRouter.post(
  '/orders/:id/grn',
  authenticateToken,
  requirePermission('purchases:grn:receive'),
  PurchaseController.receiveGoodsReceiptNote
);

// Supplier Ledger & Accounts Updating
purchaseRouter.get(
  '/suppliers/:supplierId/ledger',
  authenticateToken,
  requirePermission('accounting:ledger:view'),
  PurchaseController.getSupplierLedger
);

purchaseRouter.post(
  '/suppliers/:supplierId/payments',
  authenticateToken,
  requirePermission('accounting:payment:record'),
  PurchaseController.recordSupplierPayment
);

export default purchaseRouter;
