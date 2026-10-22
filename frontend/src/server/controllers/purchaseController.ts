import { Request, Response } from 'express';
import { PurchaseService } from '../services/purchaseService';

export class PurchaseController {
  /**
   * POST /api/purchases/orders
   * Create a new Purchase Order (PO) with medicine grid, unit pricing, discounts, tax, and delivery terms.
   */
  public static async createPurchaseOrder(req: Request, res: Response): Promise<void> {
    try {
      const { supplierId, paymentTerms, expectedDeliveryDate, orderDate, invoiceNumber, notes, items } = req.body;

      const userId = (req as any).user?.id || (req.headers['x-user-id'] as string) || 'system-admin';
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';

      if (!supplierId) {
        res.status(400).json({ success: false, error: 'Validation Error: supplierId is required.' });
        return;
      }

      if (!expectedDeliveryDate) {
        res.status(400).json({ success: false, error: 'Validation Error: expectedDeliveryDate is required.' });
        return;
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ success: false, error: 'Validation Error: At least one medicine item row is required in product grid.' });
        return;
      }

      const result = await PurchaseService.createPurchaseOrder(
        {
          supplierId,
          paymentTerms: paymentTerms || 'Net 30',
          expectedDeliveryDate,
          orderDate,
          invoiceNumber,
          notes,
          items,
        },
        userId,
        clientIp
      );

      res.status(201).json({
        success: true,
        message: `Purchase Order ${result.poNumber} created successfully.`,
        data: result,
      });
    } catch (error: any) {
      console.error('[PurchaseController.createPurchaseOrder Error]:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to create purchase order.',
      });
    }
  }

  /**
   * POST /api/purchases/orders/:id/grn
   * Goods Receive Note (GRN) & Batch Entry Engine:
   * - Converts PO to Received (Partial / Full / Damaged)
   * - Validates future expiry date strictly
   * - Updates Batch inventory, Supplier Balance, and Ledger
   */
  public static async receiveGoodsReceiptNote(req: Request, res: Response): Promise<void> {
    try {
      const { id: purchaseOrderId } = req.params;
      const {
        vendorInvoiceNumber,
        receivedDate,
        receivingWarehouse,
        receiveMode,
        notes,
        paidAmount,
        paymentMethod,
        paymentReference,
        items,
      } = req.body;

      const userId = (req as any).user?.id || (req.headers['x-user-id'] as string) || 'system-admin';
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';

      if (!vendorInvoiceNumber?.trim()) {
        res.status(400).json({
          success: false,
          error: 'GRN Validation Error: Official vendor invoice / bill number is required.',
        });
        return;
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          error: 'GRN Validation Error: Items array with batch data is required.',
        });
        return;
      }

      const result = await PurchaseService.receiveGoodsReceiptNote(
        {
          purchaseOrderId,
          vendorInvoiceNumber,
          receivedDate: receivedDate || new Date(),
          receivingWarehouse: receivingWarehouse || 'Main Pharmacy Central Depot',
          receiveMode: receiveMode || 'FULL',
          notes,
          paidAmount: paidAmount ? Number(paidAmount) : 0,
          paymentMethod,
          paymentReference,
          items,
        },
        userId,
        clientIp
      );

      res.status(200).json({
        success: true,
        message: `GRN confirmed for PO ${result.poNumber}. ${result.batchesCreated} batch(es) committed to inventory.`,
        data: result,
      });
    } catch (error: any) {
      console.error('[PurchaseController.receiveGoodsReceiptNote Error]:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to process goods receipt note.',
      });
    }
  }

  /**
   * GET /api/purchases/orders
   * Retrieve list of purchase orders with optional status/supplier/search filters
   */
  public static async getPurchaseOrders(req: Request, res: Response): Promise<void> {
    try {
      const { status, supplierId, search, limit, offset } = req.query;

      const orders = await PurchaseService.getPurchaseOrders({
        status: status as any,
        supplierId: supplierId as string,
        search: search as string,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      res.status(200).json({
        success: true,
        data: orders,
        count: orders.length,
      });
    } catch (error: any) {
      console.error('[PurchaseController.getPurchaseOrders Error]:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to retrieve purchase orders.',
      });
    }
  }

  /**
   * GET /api/purchases/orders/:id
   * Get purchase order by ID with line items and batch assignments
   */
  public static async getPurchaseOrderById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const order = await PurchaseService.getPurchaseOrderById(id);

      res.status(200).json({
        success: true,
        data: order,
      });
    } catch (error: any) {
      console.error('[PurchaseController.getPurchaseOrderById Error]:', error);
      res.status(404).json({
        success: false,
        error: error.message || 'Purchase order not found.',
      });
    }
  }

  /**
   * GET /api/purchases/suppliers/:supplierId/ledger
   * Retrieve supplier account statement, running balance, and invoice/payment ledger
   */
  public static async getSupplierLedger(req: Request, res: Response): Promise<void> {
    try {
      const { supplierId } = req.params;
      const ledgerData = await PurchaseService.getSupplierLedger(supplierId);

      res.status(200).json({
        success: true,
        data: ledgerData,
      });
    } catch (error: any) {
      console.error('[PurchaseController.getSupplierLedger Error]:', error);
      res.status(404).json({
        success: false,
        error: error.message || 'Supplier ledger not found.',
      });
    }
  }

  /**
   * POST /api/purchases/suppliers/:supplierId/payments
   * Record a settlement payment to supplier, reducing accounts payable
   */
  public static async recordSupplierPayment(req: Request, res: Response): Promise<void> {
    try {
      const { supplierId } = req.params;
      const { amount, paymentMethod, referenceNumber, notes } = req.body;

      const userId = (req as any).user?.id || (req.headers['x-user-id'] as string) || 'system-admin';
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';

      if (!amount || Number(amount) <= 0) {
        res.status(400).json({
          success: false,
          error: 'Validation Error: Payment amount must be greater than zero.',
        });
        return;
      }

      const result = await PurchaseService.recordSupplierPayment(
        {
          supplierId,
          amount: Number(amount),
          paymentMethod: paymentMethod || 'BANK_TRANSFER',
          referenceNumber: referenceNumber || `PAY-${Date.now()}`,
          notes,
        },
        userId,
        clientIp
      );

      res.status(200).json({
        success: true,
        message: `Payment of $${result.amountPaid} recorded for ${result.supplierName}. Remaining balance: $${result.remainingBalancePayable}.`,
        data: result,
      });
    } catch (error: any) {
      console.error('[PurchaseController.recordSupplierPayment Error]:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to record supplier payment.',
      });
    }
  }
}
