import { Router, Request, Response } from 'express';
import { authenticateToken, requirePermission } from '../middleware/rbacMiddleware';
import { auditLoggingMiddleware, getAuditLogsEndpoint, preventAuditLogDeletion } from '../middleware/auditMiddleware';

const router = Router();

// In-memory adjustment storage for backend testing
const adjustmentsStore: any[] = [];

/**
 * GET /api/inventory/adjustments
 * List all adjustments
 */
router.get(
  '/',
  authenticateToken,
  requirePermission('inventory:stock:view'),
  (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: adjustmentsStore
    });
  }
);

/**
 * POST /api/inventory/adjustments
 * Create a new stock adjustment with audit logging
 */
router.post(
  '/',
  authenticateToken,
  requirePermission('inventory:stock:adjust'),
  auditLoggingMiddleware({
    moduleName: 'stock_adjustment',
    entityType: 'StockAdjustment',
  }),
  (req: Request, res: Response) => {
    const { batchId, medicineId, type, direction, quantityAdjusted, reason, notes, unitCost = 1.0 } = req.body;

    if (!batchId || !quantityAdjusted || !type || !reason) {
      res.status(400).json({ error: 'Missing required fields for stock adjustment' });
      return;
    }

    const totalMonetaryValue = quantityAdjusted * unitCost;
    const requiresApproval = totalMonetaryValue > 100.0; // Manager approval threshold

    const adjustment = {
      id: `adj-${Date.now()}`,
      adjustmentNumber: `ADJ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
      batchId,
      medicineId,
      type,
      direction,
      quantityAdjusted,
      quantityChange: direction === 'increase' ? quantityAdjusted : -quantityAdjusted,
      unitCost,
      totalMonetaryValue,
      reason,
      notes,
      status: requiresApproval ? 'pending_approval' : 'approved',
      requiresApproval,
      requestedBy: {
        userId: req.user?.userId,
        userName: req.user?.name,
        userRole: req.user?.roleCode
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    adjustmentsStore.unshift(adjustment);

    res.status(201).json({
      success: true,
      data: adjustment,
      message: requiresApproval 
        ? 'High-value adjustment submitted for Pharmacy Manager approval' 
        : 'Adjustment approved and stock deducted'
    });
  }
);

/**
 * POST /api/inventory/adjustments/:id/approve
 * Manager / Admin approval
 */
router.post(
  '/:id/approve',
  authenticateToken,
  requirePermission('inventory:stock:adjust'),
  auditLoggingMiddleware({
    moduleName: 'stock_adjustment',
    entityType: 'StockAdjustment',
  }),
  (req: Request, res: Response) => {
    const adj = adjustmentsStore.find(a => a.id === req.params.id);
    if (!adj) {
      res.status(404).json({ error: 'Adjustment not found' });
      return;
    }

    if (adj.status !== 'pending_approval') {
      res.status(400).json({ error: `Cannot approve adjustment in ${adj.status} status` });
      return;
    }

    adj.status = 'approved';
    adj.approvedBy = {
      userId: req.user?.userId,
      userName: req.user?.name,
      userRole: req.user?.roleCode,
      approvedAt: new Date().toISOString()
    };
    adj.updatedAt = new Date().toISOString();

    res.json({
      success: true,
      data: adj,
      message: 'Stock adjustment successfully approved'
    });
  }
);

/**
 * GET /api/inventory/adjustments/audit-logs
 * Immutable Audit Logs Viewer Endpoint
 */
router.get('/audit-logs', authenticateToken, getAuditLogsEndpoint);

/**
 * DELETE /api/inventory/adjustments/audit-logs/*
 * Immutable Audit Log Hard Delete Protection
 */
router.delete('/audit-logs/:id', authenticateToken, preventAuditLogDeletion);
router.delete('/audit-logs', authenticateToken, preventAuditLogDeletion);

export default router;
