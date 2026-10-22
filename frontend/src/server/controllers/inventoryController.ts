import { Request, Response } from 'express';
import { InventoryService } from '../services/inventoryService';

/**
 * Controller handling Goods Receiving (GRN), Expiry Alerts, and Stock Adjustments
 */
export class InventoryController {
  /**
   * POST /api/inventory/purchases/receive
   * Receive Goods Received Note (GRN) from vendor and initialize batches
   */
  public static async receiveGoods(req: Request, res: Response): Promise<void> {
    try {
      const { supplierId, invoiceNumber, notes, items, paidAmount, paymentMethod } = req.body;

      const userId = (req as any).user?.id || (req.headers['x-user-id'] as string) || req.body.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication failure: User ID required for inventory operations.',
        });
        return;
      }

      if (!supplierId || !invoiceNumber) {
        res.status(400).json({
          success: false,
          error: 'Validation error: Both supplierId and invoiceNumber are required.',
        });
        return;
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Validation error: Items array cannot be empty.',
        });
        return;
      }

      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket.remoteAddress ||
        '127.0.0.1';

      const result = await InventoryService.receivePurchaseOrder(
        {
          supplierId,
          invoiceNumber,
          notes,
          items,
          paidAmount: paidAmount ? Number(paidAmount) : 0,
          paymentMethod,
        },
        userId,
        clientIp
      );

      res.status(201).json({
        success: true,
        message: `Goods Received Note ${result.poNumber} successfully processed.`,
        data: result,
      });
    } catch (error: any) {
      console.error('[InventoryController.receiveGoods Error]:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to process goods receipt.',
      });
    }
  }

  /**
   * GET /api/inventory/expiry-alerts
   * Return real-time audit of batches categorized by risk tiers:
   * (Expired, <30 days, <60 days, <90 days, Safe Stock)
   */
  public static async getExpiryAlertReport(req: Request, res: Response): Promise<void> {
    try {
      const { categoryId, search, statusFilter } = req.query;

      const report = await InventoryService.getExpiryAlertReport({
        categoryId: categoryId ? String(categoryId) : undefined,
        search: search ? String(search) : undefined,
        statusFilter: statusFilter as any,
      });

      res.status(200).json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      console.error('[InventoryController.getExpiryAlertReport Error]:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate inventory expiry alert report.',
        details: error.message || 'Internal server error',
      });
    }
  }

  /**
   * POST /api/inventory/adjustments
   * Record inventory shrinkage, breakage, damage, or expiry disposal
   */
  public static async adjustStock(req: Request, res: Response): Promise<void> {
    try {
      const { batchId, type, quantityChange, reason, notes, quarantineBatch } = req.body;

      const userId = (req as any).user?.id || (req.headers['x-user-id'] as string) || req.body.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication failure: User ID required for stock adjustment logging.',
        });
        return;
      }

      if (!batchId || !type || quantityChange === undefined || !reason) {
        res.status(400).json({
          success: false,
          error: 'Validation error: batchId, type, quantityChange, and reason are mandatory.',
        });
        return;
      }

      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket.remoteAddress ||
        '127.0.0.1';

      const userAgent = req.headers['user-agent'] || 'Inventory-Module';

      const result = await InventoryService.adjustStockAndRecordDamage(
        {
          batchId,
          type,
          quantityChange: Number(quantityChange),
          reason,
          notes,
          quarantineBatch: Boolean(quarantineBatch),
        },
        userId,
        clientIp,
        userAgent
      );

      res.status(200).json({
        success: true,
        message: `Stock adjustment for batch ${result.batchNumber} successfully recorded.`,
        data: result,
      });
    } catch (error: any) {
      console.error('[InventoryController.adjustStock Error]:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to apply stock adjustment.',
      });
    }
  }
}
