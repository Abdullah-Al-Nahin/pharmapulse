import { Prisma, BatchStatus, AdjustmentType, AdjustmentStatus, AuditAction, PurchaseOrderStatus, PaymentStatus, PaymentMethod } from '@prisma/client';
import { prisma } from '../db';

export interface PurchaseOrderItemInput {
  productId: string;
  batchNumber: string;
  manufacturingDate: string | Date;
  expiryDate: string | Date;
  orderedQuantity: number;
  receivedQuantity: number;
  freeQuantity?: number;
  unitPurchasePrice: number;
  mrp: number;
  sellingPrice: number;
  rackLocation?: string;
  taxRate?: number;
}

export interface ReceivePurchaseOrderInput {
  supplierId: string;
  invoiceNumber: string; // Supplier's bill/invoice number
  notes?: string;
  items: PurchaseOrderItemInput[];
  paidAmount?: number;
  paymentMethod?: PaymentMethod;
}

export interface StockAdjustmentInput {
  batchId: string;
  type: AdjustmentType;
  quantityChange: number; // Positive for count addition, negative for damage/loss/disposal
  reason: string;
  notes?: string;
  quarantineBatch?: boolean;
}

export interface ExpiryAlertFilter {
  categoryId?: string;
  search?: string;
  statusFilter?: 'ALL' | 'EXPIRED' | 'CRITICAL_30' | 'ALERT_60' | 'WARNING_90' | 'SAFE';
}

export class InventoryService {
  /**
   * Receive Goods / Purchase Inward (GRN) with automatic Batch Creation & FEFO setup:
   * - Validates supplier & date boundaries
   * - Creates PurchaseOrder & PurchaseOrderItems
   * - Creates or updates Batch inventory
   * - Updates supplier balance for credit purchases
   * - Generates immutable GRN and Audit records
   */
  public static async receivePurchaseOrder(
    input: ReceivePurchaseOrderInput,
    userId: string,
    ipAddress: string
  ) {
    if (!input.items || input.items.length === 0) {
      throw new Error('GRN Rejection: No items provided in purchase receipt.');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Verify Supplier
      const supplier = await tx.supplier.findUnique({
        where: { id: input.supplierId },
      });
      if (!supplier || !supplier.isActive) {
        throw new Error(`Supplier with ID ${input.supplierId} not found or inactive.`);
      }

      // 2. Compute Lines & Grand Totals
      let subTotalDecimal = new Prisma.Decimal(0);
      let taxTotalDecimal = new Prisma.Decimal(0);

      const validatedLines: Array<{
        productId: string;
        batchNumber: string;
        manufacturingDate: Date;
        expiryDate: Date;
        orderedQuantity: number;
        receivedQuantity: number;
        freeQuantity: number;
        unitPurchasePrice: Prisma.Decimal;
        mrp: Prisma.Decimal;
        sellingPrice: Prisma.Decimal;
        taxRate: Prisma.Decimal;
        taxAmount: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
        rackLocation?: string;
      }> = [];

      const today = new Date();

      for (const item of input.items) {
        if (item.receivedQuantity < 0) {
          throw new Error(`Invalid received quantity (${item.receivedQuantity}) for batch ${item.batchNumber}.`);
        }

        const mfgDate = new Date(item.manufacturingDate);
        const expDate = new Date(item.expiryDate);

        if (isNaN(mfgDate.getTime()) || isNaN(expDate.getTime())) {
          throw new Error(`Invalid date format for batch ${item.batchNumber}.`);
        }

        if (expDate <= mfgDate) {
          throw new Error(
            `Chronological error for batch ${item.batchNumber}: Expiry date must be strictly after manufacturing date.`
          );
        }

        if (expDate <= today) {
          throw new Error(
            `RECEPTION BLOCKED: Batch ${item.batchNumber} has already expired on ${expDate.toISOString().split('T')[0]}. Expired goods cannot be received.`
          );
        }

        // Verify product exists
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });
        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found.`);
        }

        const unitCost = new Prisma.Decimal(item.unitPurchasePrice);
        const mrp = new Prisma.Decimal(item.mrp);
        const selling = new Prisma.Decimal(item.sellingPrice);
        const freeQty = item.freeQuantity || 0;
        const totalStockUnits = item.receivedQuantity + freeQty;

        if (selling.greaterThan(mrp)) {
          throw new Error(
            `Regulatory pricing breach: Selling price (${selling.toFixed(2)}) cannot exceed Maximum Retail Price MRP (${mrp.toFixed(2)}) on batch ${item.batchNumber}.`
          );
        }

        const lineAmount = unitCost.mul(item.receivedQuantity);
        const taxRate = new Prisma.Decimal(item.taxRate || 0);
        const taxAmount = lineAmount.mul(taxRate).div(100);
        const lineTotal = lineAmount.add(taxAmount);

        subTotalDecimal = subTotalDecimal.add(lineAmount);
        taxTotalDecimal = taxTotalDecimal.add(taxAmount);

        validatedLines.push({
          productId: item.productId,
          batchNumber: item.batchNumber.trim().toUpperCase(),
          manufacturingDate: mfgDate,
          expiryDate: expDate,
          orderedQuantity: item.orderedQuantity,
          receivedQuantity: item.receivedQuantity,
          freeQuantity: freeQty,
          unitPurchasePrice: unitCost,
          mrp,
          sellingPrice: selling,
          taxRate,
          taxAmount,
          lineTotal,
          rackLocation: item.rackLocation || product.defaultRackLocation || 'Warehouse-A',
        });
      }

      const grandTotal = subTotalDecimal.add(taxTotalDecimal);
      const paidAmount = new Prisma.Decimal(input.paidAmount || 0);
      const dueAmount = grandTotal.sub(paidAmount);

      // 3. Generate Unique PO / GRN Number
      const datePart = today.toISOString().replace(/[-:T]/g, '').slice(0, 8);
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const poNumber = `GRN-${datePart}-${randomSuffix}`;

      let paymentStatus: PaymentStatus = PaymentStatus.UNPAID;
      if (paidAmount.greaterThanOrEqualTo(grandTotal)) {
        paymentStatus = PaymentStatus.PAID;
      } else if (paidAmount.greaterThan(0)) {
        paymentStatus = PaymentStatus.PARTIALLY_PAID;
      }

      // 4. Create Purchase Order Master
      const purchaseOrder = await tx.purchaseOrder.create({
        data: {
          poNumber,
          invoiceNumber: input.invoiceNumber,
          supplierId: input.supplierId,
          orderDate: today,
          receivedDate: today,
          status: PurchaseOrderStatus.RECEIVED,
          paymentStatus,
          subTotal: subTotalDecimal,
          taxAmount: taxTotalDecimal,
          grandTotal,
          paidAmount,
          dueAmount: dueAmount.greaterThan(0) ? dueAmount : new Prisma.Decimal(0),
          notes: input.notes || null,
        },
      });

      // 5. Create PO Items and Create/Update Batches
      const createdBatches = [];

      for (const line of validatedLines) {
        const poItem = await tx.purchaseOrderItem.create({
          data: {
            purchaseOrderId: purchaseOrder.id,
            productId: line.productId,
            batchNumber: line.batchNumber,
            manufacturingDate: line.manufacturingDate,
            expiryDate: line.expiryDate,
            orderedQuantity: line.orderedQuantity,
            receivedQuantity: line.receivedQuantity,
            freeQuantity: line.freeQuantity,
            unitPurchasePrice: line.unitPurchasePrice,
            mrp: line.mrp,
            sellingPrice: line.sellingPrice,
            taxRate: line.taxRate,
            taxAmount: line.taxAmount,
            lineTotal: line.lineTotal,
          },
        });

        const totalInwardUnits = line.receivedQuantity + line.freeQuantity;

        // Check shelf-life for initial status
        const daysToExpiry = Math.ceil((line.expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const initialStatus = daysToExpiry <= 90 ? BatchStatus.NEAR_EXPIRY : BatchStatus.ACTIVE;

        // Create new Batch record linked to GRN item
        const batch = await tx.batch.create({
          data: {
            batchNumber: line.batchNumber,
            productId: line.productId,
            supplierId: input.supplierId,
            purchaseOrderItemId: poItem.id,
            manufacturingDate: line.manufacturingDate,
            expiryDate: line.expiryDate,
            purchasePrice: line.unitPurchasePrice,
            mrp: line.mrp,
            unitSellingPrice: line.sellingPrice,
            initialQuantity: totalInwardUnits,
            currentStock: totalInwardUnits,
            rackLocation: line.rackLocation,
            status: initialStatus,
          },
        });

        createdBatches.push(batch);
      }

      // 6. Update Supplier Payable Balance if there is an outstanding amount
      if (dueAmount.greaterThan(0)) {
        await tx.supplier.update({
          where: { id: input.supplierId },
          data: {
            balancePayable: { increment: dueAmount },
          },
        });
      }

      // 7. Record Payment if paid
      if (paidAmount.greaterThan(0)) {
        await tx.payment.create({
          data: {
            purchaseOrderId: purchaseOrder.id,
            paymentMethod: input.paymentMethod || PaymentMethod.BANK_TRANSFER,
            amount: paidAmount,
            paymentStatus: PaymentStatus.PAID,
          },
        });
      }

      // 8. Immutable Audit Log
      await tx.auditLog.create({
        data: {
          userId,
          action: AuditAction.CREATE,
          entityType: 'PurchaseOrder',
          entityId: purchaseOrder.id,
          ipAddress,
          metadata: {
            poNumber,
            supplierName: supplier.name,
            invoiceNumber: input.invoiceNumber,
            totalItems: validatedLines.length,
            grandTotal: grandTotal.toNumber(),
          },
        },
      });

      return {
        purchaseOrderId: purchaseOrder.id,
        poNumber: purchaseOrder.poNumber,
        invoiceNumber: purchaseOrder.invoiceNumber,
        grandTotal: Number(purchaseOrder.grandTotal),
        paidAmount: Number(purchaseOrder.paidAmount),
        dueAmount: Number(purchaseOrder.dueAmount),
        batchesCreated: createdBatches.length,
        receivedDate: purchaseOrder.receivedDate,
      };
    });
  }

  /**
   * Expiry Alert Engine:
   * Categorizes active pharmacy inventory into risk tiers:
   * - Expired (immediate quarantine required)
   * - Critical (< 30 days)
   * - Alert (< 60 days)
   * - Warning (< 90 days)
   * - Safe Stock (> 90 days)
   * Calculates financial valuation at risk and recommended actions.
   */
  public static async getExpiryAlertReport(filter?: ExpiryAlertFilter) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const day30 = new Date(today);
    day30.setDate(day30.getDate() + 30);

    const day60 = new Date(today);
    day60.setDate(day60.getDate() + 60);

    const day90 = new Date(today);
    day90.setDate(day90.getDate() + 90);

    const whereClause: Prisma.BatchWhereInput = {
      currentStock: { gt: 0 },
      status: { notIn: [BatchStatus.DEPLETED] },
    };

    if (filter?.categoryId) {
      whereClause.product = { categoryId: filter.categoryId };
    }

    if (filter?.search) {
      const sanitized = filter.search.trim();
      whereClause.OR = [
        { batchNumber: { contains: sanitized, mode: 'insensitive' } },
        { product: { name: { contains: sanitized, mode: 'insensitive' } } },
        { product: { generic: { name: { contains: sanitized, mode: 'insensitive' } } } },
      ];
    }

    const batches = await prisma.batch.findMany({
      where: whereClause,
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            dosageForm: true,
            strength: true,
            storageCondition: true,
            unitOfMeasure: true,
            category: { select: { id: true, name: true } },
            generic: { select: { id: true, name: true } },
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: {
        expiryDate: 'asc', // Earliest expiry first
      },
    });

    // Bucket initialization
    const summary = {
      expired: { count: 0, totalUnits: 0, costAtRisk: 0, retailAtRisk: 0 },
      critical30: { count: 0, totalUnits: 0, costAtRisk: 0, retailAtRisk: 0 },
      alert60: { count: 0, totalUnits: 0, costAtRisk: 0, retailAtRisk: 0 },
      warning90: { count: 0, totalUnits: 0, costAtRisk: 0, retailAtRisk: 0 },
      safe: { count: 0, totalUnits: 0, costAtRisk: 0, retailAtRisk: 0 },
    };

    const categorizedItems: Array<{
      batchId: string;
      batchNumber: string;
      productId: string;
      productName: string;
      genericName: string;
      categoryName: string;
      rackLocation: string;
      currentStock: number;
      expiryDate: Date;
      daysRemaining: number;
      purchasePrice: number;
      mrp: number;
      totalCostValue: number;
      totalRetailValue: number;
      alertTier: 'EXPIRED' | 'CRITICAL_30_DAYS' | 'ALERT_60_DAYS' | 'WARNING_90_DAYS' | 'SAFE_STOCK';
      recommendedAction: string;
    }> = [];

    for (const b of batches) {
      const diffMs = b.expiryDate.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const costValue = Number(b.purchasePrice) * b.currentStock;
      const retailValue = Number(b.mrp) * b.currentStock;

      let alertTier: 'EXPIRED' | 'CRITICAL_30_DAYS' | 'ALERT_60_DAYS' | 'WARNING_90_DAYS' | 'SAFE_STOCK';
      let recommendedAction = '';

      if (daysRemaining <= 0) {
        alertTier = 'EXPIRED';
        recommendedAction = 'MANDATORY: Move to Quarantine Vault & Initiate Destruction / Supplier Return';
        summary.expired.count += 1;
        summary.expired.totalUnits += b.currentStock;
        summary.expired.costAtRisk += costValue;
        summary.expired.retailAtRisk += retailValue;
      } else if (daysRemaining <= 30) {
        alertTier = 'CRITICAL_30_DAYS';
        recommendedAction = 'HIGH PRIORITY: Flag for Fast-track FEFO Dispensing or Return to Distributor';
        summary.critical30.count += 1;
        summary.critical30.totalUnits += b.currentStock;
        summary.critical30.costAtRisk += costValue;
        summary.critical30.retailAtRisk += retailValue;
      } else if (daysRemaining <= 60) {
        alertTier = 'ALERT_60_DAYS';
        recommendedAction = 'ALERT: Restrict new inbound POs for this item; review daily dispensing velocity';
        summary.alert60.count += 1;
        summary.alert60.totalUnits += b.currentStock;
        summary.alert60.costAtRisk += costValue;
        summary.alert60.retailAtRisk += retailValue;
      } else if (daysRemaining <= 90) {
        alertTier = 'WARNING_90_DAYS';
        recommendedAction = 'WATCH: Monitor consumption rate against batch shelf-life';
        summary.warning90.count += 1;
        summary.warning90.totalUnits += b.currentStock;
        summary.warning90.costAtRisk += costValue;
        summary.warning90.retailAtRisk += retailValue;
      } else {
        alertTier = 'SAFE_STOCK';
        recommendedAction = 'NORMAL: Standard inventory rotation';
        summary.safe.count += 1;
        summary.safe.totalUnits += b.currentStock;
        summary.safe.costAtRisk += costValue;
        summary.safe.retailAtRisk += retailValue;
      }

      // Filter by requested tier if specified
      if (filter?.statusFilter && filter.statusFilter !== 'ALL') {
        const matchesFilter =
          (filter.statusFilter === 'EXPIRED' && alertTier === 'EXPIRED') ||
          (filter.statusFilter === 'CRITICAL_30' && alertTier === 'CRITICAL_30_DAYS') ||
          (filter.statusFilter === 'ALERT_60' && alertTier === 'ALERT_60_DAYS') ||
          (filter.statusFilter === 'WARNING_90' && alertTier === 'WARNING_90_DAYS') ||
          (filter.statusFilter === 'SAFE' && alertTier === 'SAFE_STOCK');

        if (!matchesFilter) continue;
      }

      categorizedItems.push({
        batchId: b.id,
        batchNumber: b.batchNumber,
        productId: b.product.id,
        productName: b.product.name,
        genericName: b.product.generic?.name || 'N/A',
        categoryName: b.product.category?.name || 'N/A',
        rackLocation: b.rackLocation || 'Unassigned',
        currentStock: b.currentStock,
        expiryDate: b.expiryDate,
        daysRemaining,
        purchasePrice: Number(b.purchasePrice),
        mrp: Number(b.mrp),
        totalCostValue: Number(costValue.toFixed(2)),
        totalRetailValue: Number(retailValue.toFixed(2)),
        alertTier,
        recommendedAction,
      });
    }

    return {
      generatedAt: new Date(),
      metrics: {
        totalBatchesAudited: batches.length,
        summary: {
          expired: { ...summary.expired, costAtRisk: Number(summary.expired.costAtRisk.toFixed(2)) },
          critical30: { ...summary.critical30, costAtRisk: Number(summary.critical30.costAtRisk.toFixed(2)) },
          alert60: { ...summary.alert60, costAtRisk: Number(summary.alert60.costAtRisk.toFixed(2)) },
          warning90: { ...summary.warning90, costAtRisk: Number(summary.warning90.costAtRisk.toFixed(2)) },
          safe: { ...summary.safe, costAtRisk: Number(summary.safe.costAtRisk.toFixed(2)) },
        },
      },
      items: categorizedItems,
    };
  }

  /**
   * Stock Adjustment & Damage Logging:
   * - Records inventory loss/damage/breakage/expired disposal
   * - Atomically updates Batch currentStock and status
   * - Enforces zero-floor constraints (no negative inventory)
   * - Writes immutable StockAdjustment log & AuditLog
   */
  public static async adjustStockAndRecordDamage(
    input: StockAdjustmentInput,
    userId: string,
    ipAddress: string,
    userAgent?: string
  ) {
    if (input.quantityChange === 0) {
      throw new Error('Adjustment quantity change cannot be zero.');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Fetch current batch
      const batch = await tx.batch.findUnique({
        where: { id: input.batchId },
        include: { product: true },
      });

      if (!batch) {
        throw new Error(`Batch ID ${input.batchId} not found.`);
      }

      const previousStock = batch.currentStock;
      const newStock = previousStock + input.quantityChange;

      if (newStock < 0) {
        throw new Error(
          `Stock underflow: Cannot reduce ${Math.abs(input.quantityChange)} units from batch ${batch.batchNumber}. Current available stock is only ${previousStock}.`
        );
      }

      // Determine updated status
      let updatedStatus: BatchStatus = batch.status;

      if (input.quarantineBatch || input.type === AdjustmentType.EXPIRED_CLEARANCE) {
        updatedStatus = newStock === 0 ? BatchStatus.DEPLETED : BatchStatus.QUARANTINED;
      } else if (newStock === 0) {
        updatedStatus = BatchStatus.DEPLETED;
      } else if (batch.status === BatchStatus.DEPLETED && newStock > 0) {
        updatedStatus = BatchStatus.ACTIVE;
      }

      // 2. Update Batch
      const updatedBatch = await tx.batch.update({
        where: { id: batch.id },
        data: {
          currentStock: newStock,
          status: updatedStatus,
          quarantineReason: input.quarantineBatch ? input.reason : batch.quarantineReason,
        },
      });

      // 3. Create Immutable Stock Adjustment Record
      const stockAdjustment = await tx.stockAdjustment.create({
        data: {
          adjustmentNumber: `ADJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          batch: { connect: { id: batch.id } },
          user: { connect: { id: userId } },
          type: input.type,
          direction: input.quantityChange < 0 ? 'decrease' : 'increase',
          quantityAdjusted: Math.abs(input.quantityChange),
          quantityChange: input.quantityChange,
          previousStock,
          newStock,
          unitCost: batch.purchasePrice,
          totalMonetaryValue: Math.abs(input.quantityChange) * Number(batch.purchasePrice),
          status: AdjustmentStatus.APPROVED,
          reason: input.reason,
          notes: input.notes || null,
        },
      });

      // 4. Create Detailed Audit Log
      await tx.auditLog.create({
        data: {
          userId,
          action: AuditAction.STOCK_ADJUSTMENT,
          entityType: 'Batch',
          entityId: batch.id,
          ipAddress,
          userAgent: userAgent || 'Inventory-Module',
          oldValues: {
            currentStock: previousStock,
            status: batch.status,
          },
          newValues: {
            currentStock: newStock,
            status: updatedStatus,
          },
          metadata: {
            batchNumber: batch.batchNumber,
            productName: batch.product.name,
            adjustmentType: input.type,
            quantityChange: input.quantityChange,
            reason: input.reason,
          },
        },
      });

      return {
        adjustmentId: stockAdjustment.id,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        productName: batch.product.name,
        type: stockAdjustment.type,
        quantityChange: stockAdjustment.quantityChange,
        previousStock,
        newStock,
        updatedStatus,
        adjustedAt: stockAdjustment.createdAt,
      };
    });
  }
}
