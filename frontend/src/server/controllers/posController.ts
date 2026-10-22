import { Request, Response } from 'express';
import { PosService } from '../services/posService';

/**
 * Controller handling POS Search and FEFO Dispense Operations
 */
export class PosController {
  /**
   * GET /api/pos/search
   * Search available products and their valid batches ordered by FEFO
   */
  public static async searchProducts(req: Request, res: Response): Promise<void> {
    try {
      const { q, barcode, generic, brand, batchNumber, categoryId, limit } = req.query;

      const results = await PosService.searchProductsAndBatches({
        query: q ? String(q) : undefined,
        barcode: barcode ? String(barcode) : undefined,
        generic: generic ? String(generic) : undefined,
        brand: brand ? String(brand) : undefined,
        batchNumber: batchNumber ? String(batchNumber) : undefined,
        categoryId: categoryId ? String(categoryId) : undefined,
        limit: limit ? parseInt(String(limit), 10) : 25,
      });

      res.status(200).json({
        success: true,
        count: results.length,
        data: results,
      });
    } catch (error: any) {
      console.error('[PosController.searchProducts Error]:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to query POS medicine catalog.',
        details: error.message || 'Internal server error',
      });
    }
  }

  /**
   * POST /api/pos/sales
   * Process a complete sale invoice with strict FEFO verification,
   * expiry rejection, stock deduction, and audit log generation.
   */
  public static async processSale(req: Request, res: Response): Promise<void> {
    try {
      const {
        customerId,
        shiftId,
        prescriptionId,
        isScheduleHCompliant,
        notes,
        discountAmount,
        items,
        payments,
      } = req.body;

      // Extract cashier ID from authenticated user context (fallback to header or demo ID)
      const cashierId = (req as any).user?.id || (req.headers['x-user-id'] as string) || req.body.cashierId;

      if (!cashierId) {
        res.status(401).json({
          success: false,
          error: 'Authentication failure: Cashier ID is required to process POS transactions.',
        });
        return;
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Validation error: Cart items array must not be empty.',
        });
        return;
      }

      if (!payments || !Array.isArray(payments) || payments.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Validation error: At least one payment entry is required.',
        });
        return;
      }

      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket.remoteAddress ||
        '127.0.0.1';

      const userAgent = req.headers['user-agent'] || 'POS-Web-Client';

      const result = await PosService.executeSaleTransaction(
        {
          customerId,
          shiftId,
          prescriptionId,
          isScheduleHCompliant,
          notes,
          discountAmount: discountAmount ? Number(discountAmount) : 0,
          items,
          payments,
        },
        cashierId,
        clientIp,
        userAgent
      );

      res.status(201).json({
        success: true,
        message: `Sale invoice ${result.invoiceNumber} successfully created and stock deducted.`,
        data: result,
      });
    } catch (error: any) {
      console.error('[PosController.processSale Error]:', error);

      // Distinguish regulatory/business rule failures from unexpected system errors
      const isBusinessValidationError =
        error.message?.includes('CRITICAL SAFETY REJECTION') ||
        error.message?.includes('REGULATORY COMPLIANCE REQUIRED') ||
        error.message?.includes('Insufficient stock') ||
        error.message?.includes('Credit Limit Exceeded') ||
        error.message?.includes('DISPENSE BLOCKED');

      res.status(isBusinessValidationError ? 422 : 400).json({
        success: false,
        error: error.message || 'Failed to process POS sale transaction.',
      });
    }
  }
}
