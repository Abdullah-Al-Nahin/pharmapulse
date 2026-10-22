import { Prisma, PurchaseOrderStatus, PaymentStatus, PaymentMethod, BatchStatus, AuditAction, AdjustmentType, AdjustmentStatus } from '@prisma/client';
import { prisma } from '../db';

export interface CreatePurchaseOrderItemInput {
  productId: string;
  unitType?: 'Box' | 'Strip' | 'Piece';
  packSize?: number; // Conversion factor: e.g. 1 Box = 10 Strips
  unitPurchasePrice: number; // Price per order unit
  orderedQuantity: number;
  freeQuantity?: number; // Bonus Stock from vendor
  expectedMrp: number;
  sellingPrice?: number;
  discountPercentage?: number;
  taxRate?: number;
  rackLocation?: string;
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  paymentTerms: string; // e.g., 'Net 30', 'Net 15', 'Advance', 'Cash on Delivery'
  expectedDeliveryDate: string | Date;
  orderDate?: string | Date;
  invoiceNumber?: string;
  notes?: string;
  items: CreatePurchaseOrderItemInput[];
}

export interface ReceiveGRNItemInput {
  purchaseOrderItemId?: string;
  productId: string;
  batchNumber: string;
  manufacturingDate: string | Date;
  expiryDate: string | Date; // Must be strictly in the future!
  orderedQuantity: number;
  receivedQuantity: number; // Handled units
  freeQuantity?: number; // Bonus units received
  damagedQuantity?: number; // Rejected/damaged units
  unitPurchasePrice: number;
  mrp: number;
  sellingPrice: number;
  taxRate?: number;
  rackLocation?: string;
  warehouse?: string; // Receiving Warehouse
}

export interface ReceiveGoodsReceiptNoteInput {
  purchaseOrderId: string;
  vendorInvoiceNumber: string;
  receivedDate: string | Date;
  receivingWarehouse: string; // e.g. "Main Pharmacy Central Depot", "Cold Storage Safe"
  receiveMode: 'FULL' | 'PARTIAL' | 'DAMAGED';
  notes?: string;
  paidAmount?: number;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  items: ReceiveGRNItemInput[];
}

export interface SupplierPaymentInput {
  supplierId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  notes?: string;
}

export class PurchaseService {
  /**
   * 1. CREATE PURCHASE ORDER (PO)
   * Validates supplier, converts pack sizes/units, auto-calculates Subtotal, Discount, Tax & Net Payable.
   * Generates unique PO Number and persists draft or ordered purchase order.
   */
  public static async createPurchaseOrder(
    input: CreatePurchaseOrderInput,
    userId: string,
    ipAddress: string
  ) {
    if (!input.items || input.items.length === 0) {
      throw new Error('PO Creation Error: At least one medicine item is required.');
    }

    return await prisma.$transaction(async (tx) => {
      // Validate Supplier
      const supplier = await tx.supplier.findUnique({
        where: { id: input.supplierId },
      });
      if (!supplier || !supplier.isActive) {
        throw new Error(`Supplier with ID ${input.supplierId} is not active or does not exist.`);
      }

      const today = new Date();
      const orderDate = input.orderDate ? new Date(input.orderDate) : today;
      const expectedDeliveryDate = new Date(input.expectedDeliveryDate);

      let subTotal = new Prisma.Decimal(0);
      let totalDiscount = new Prisma.Decimal(0);
      let totalTax = new Prisma.Decimal(0);

      // Validate products and compute mathematical totals
      const validatedLines: Array<{
        productId: string;
        orderedQuantity: number;
        freeQuantity: number;
        unitPurchasePrice: Prisma.Decimal;
        mrp: Prisma.Decimal;
        sellingPrice: Prisma.Decimal;
        taxRate: Prisma.Decimal;
        taxAmount: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
        rackLocation: string;
      }> = [];

      for (const item of input.items) {
        if (item.orderedQuantity <= 0) {
          throw new Error(`Invalid order quantity (${item.orderedQuantity}) for product ID ${item.productId}.`);
        }

        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });
        if (!product) {
          throw new Error(`Product with ID ${item.productId} was not found in catalog.`);
        }

        const packMultiplier = item.packSize && item.packSize > 1 ? item.packSize : 1;
        const totalOrderedBaseUnits = item.orderedQuantity * packMultiplier;
        const totalFreeBaseUnits = (item.freeQuantity || 0) * packMultiplier;

        // Base price calculation
        const unitCost = new Prisma.Decimal(item.unitPurchasePrice);
        const mrp = new Prisma.Decimal(item.expectedMrp || Number(product.vatRate) * 2);
        const sellingPrice = new Prisma.Decimal(item.sellingPrice || item.expectedMrp || unitCost.mul(1.2).toNumber());

        const rawLineAmount = unitCost.mul(item.orderedQuantity);
        const discountRate = new Prisma.Decimal(item.discountPercentage || 0);
        const discountAmount = rawLineAmount.mul(discountRate).div(100);
        const discountedLineAmount = rawLineAmount.sub(discountAmount);

        const taxRate = new Prisma.Decimal(item.taxRate !== undefined ? item.taxRate : Number(product.vatRate));
        const taxAmount = discountedLineAmount.mul(taxRate).div(100);
        const lineTotal = discountedLineAmount.add(taxAmount);

        subTotal = subTotal.add(rawLineAmount);
        totalDiscount = totalDiscount.add(discountAmount);
        totalTax = totalTax.add(taxAmount);

        validatedLines.push({
          productId: item.productId,
          orderedQuantity: totalOrderedBaseUnits,
          freeQuantity: totalFreeBaseUnits,
          unitPurchasePrice: unitCost,
          mrp,
          sellingPrice,
          taxRate,
          taxAmount,
          lineTotal,
          rackLocation: item.rackLocation || product.defaultRackLocation || 'General Storage',
        });
      }

      const grandTotal = subTotal.sub(totalDiscount).add(totalTax);

      // Generate unique PO sequence
      const dateKey = orderDate.toISOString().replace(/[-:T]/g, '').slice(0, 8);
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const poNumber = `PO-${dateKey}-${randomSuffix}`;
      const tempInvoiceNumber = input.invoiceNumber?.trim() || `PROFORMA-${poNumber}`;

      // Persist PurchaseOrder header
      const purchaseOrder = await tx.purchaseOrder.create({
        data: {
          poNumber,
          invoiceNumber: tempInvoiceNumber,
          supplierId: input.supplierId,
          orderDate,
          status: PurchaseOrderStatus.ORDERED,
          paymentStatus: PaymentStatus.UNPAID,
          subTotal,
          discountAmount: totalDiscount,
          taxAmount: totalTax,
          grandTotal,
          paidAmount: new Prisma.Decimal(0),
          dueAmount: grandTotal,
          notes: `Terms: ${input.paymentTerms}. Expected Delivery: ${expectedDeliveryDate.toISOString().split('T')[0]}. ${input.notes || ''}`.trim(),
        },
      });

      // Persist PurchaseOrder items (Placeholders until GRN arrival assigns final batch/mfg/expiry)
      const futureDefaultExpiry = new Date();
      futureDefaultExpiry.setFullYear(futureDefaultExpiry.getFullYear() + 2);

      for (const line of validatedLines) {
        await tx.purchaseOrderItem.create({
          data: {
            purchaseOrderId: purchaseOrder.id,
            productId: line.productId,
            batchNumber: `PENDING-${poNumber.slice(-4)}`,
            manufacturingDate: today,
            expiryDate: futureDefaultExpiry,
            orderedQuantity: line.orderedQuantity,
            receivedQuantity: 0,
            freeQuantity: line.freeQuantity,
            unitPurchasePrice: line.unitPurchasePrice,
            mrp: line.mrp,
            sellingPrice: line.sellingPrice,
            taxRate: line.taxRate,
            taxAmount: line.taxAmount,
            lineTotal: line.lineTotal,
          },
        });
      }

      // Log Audit Trail
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
            totalLines: validatedLines.length,
            grandTotal: grandTotal.toNumber(),
            paymentTerms: input.paymentTerms,
          },
        },
      });

      return {
        id: purchaseOrder.id,
        poNumber: purchaseOrder.poNumber,
        invoiceNumber: purchaseOrder.invoiceNumber,
        supplierName: supplier.name,
        orderDate: purchaseOrder.orderDate,
        subTotal: Number(purchaseOrder.subTotal),
        discountAmount: Number(purchaseOrder.discountAmount),
        taxAmount: Number(purchaseOrder.taxAmount),
        grandTotal: Number(purchaseOrder.grandTotal),
        status: purchaseOrder.status,
      };
    });
  }

  /**
   * 2. GOODS RECEIVE NOTE (GRN) & BATCH ENTRY ENGINE
   * - Converts PO to Received Status (Full Receive, Partial Receive, Damaged Receive).
   * - Batch Data Entry for each received medicine: Batch Number, Mfg Date, Expiry Date, Rack Location, Warehouse.
   * - REGULATORY SAFETY ENFORCEMENT: Strictly validates that Expiry Date is in the FUTURE.
   * - Automatically updates Batch inventory, Supplier Payable ledger, and logs double-entry Accounting.
   */
  public static async receiveGoodsReceiptNote(
    input: ReceiveGoodsReceiptNoteInput,
    userId: string,
    ipAddress: string
  ) {
    if (!input.items || input.items.length === 0) {
      throw new Error('GRN Rejection: No received line items specified for Goods Receipt.');
    }

    if (!input.vendorInvoiceNumber?.trim()) {
      throw new Error('GRN Validation: Official Vendor Invoice / Bill Number is mandatory for Goods Receipt.');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await prisma.$transaction(async (tx) => {
      // 1. Fetch Existing Purchase Order
      const purchaseOrder = await tx.purchaseOrder.findUnique({
        where: { id: input.purchaseOrderId },
        include: {
          supplier: true,
          items: true,
        },
      });

      if (!purchaseOrder) {
        throw new Error(`Purchase Order with ID ${input.purchaseOrderId} does not exist.`);
      }

      if (purchaseOrder.status === PurchaseOrderStatus.CANCELLED) {
        throw new Error(`Cannot process GRN: Purchase Order ${purchaseOrder.poNumber} was cancelled.`);
      }

      // 2. Validate Items & Regulatory Expiry Dates
      let calculatedSubtotal = new Prisma.Decimal(0);
      let calculatedTax = new Prisma.Decimal(0);
      const createdBatches = [];
      let totalReceivedUnits = 0;
      let totalOrderedUnits = 0;

      for (const item of input.items) {
        const batchNumber = item.batchNumber?.trim().toUpperCase();
        if (!batchNumber) {
          throw new Error('Batch Data Entry Error: Batch Number cannot be blank.');
        }

        const mfgDate = new Date(item.manufacturingDate);
        const expDate = new Date(item.expiryDate);

        if (isNaN(mfgDate.getTime()) || isNaN(expDate.getTime())) {
          throw new Error(`Invalid date format for batch ${batchNumber}.`);
        }

        // --- STRICT REGULATORY EXPIRY VALIDATION ---
        if (expDate <= today) {
          throw new Error(
            `REGULATORY SAFETY BREACH: Expiry Date (${expDate.toISOString().split('T')[0]}) for batch "${batchNumber}" is in the past. Expired pharmaceuticals cannot be received into active hospital stock.`
          );
        }

        if (expDate <= mfgDate) {
          throw new Error(
            `Chronological Sequence Error: Expiry date (${expDate.toISOString().split('T')[0]}) must be strictly after Manufacturing date (${mfgDate.toISOString().split('T')[0]}) for batch ${batchNumber}.`
          );
        }

        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });
        if (!product) {
          throw new Error(`Product ${item.productId} does not exist.`);
        }

        const receivedQty = Math.max(0, item.receivedQuantity || 0);
        const freeQty = Math.max(0, item.freeQuantity || 0);
        const damagedQty = Math.max(0, item.damagedQuantity || 0);

        totalReceivedUnits += receivedQty;
        totalOrderedUnits += item.orderedQuantity;

        const effectiveInwardStock = receivedQty + freeQty;

        const unitCost = new Prisma.Decimal(item.unitPurchasePrice);
        const mrp = new Prisma.Decimal(item.mrp);
        const sellingPrice = new Prisma.Decimal(item.sellingPrice);

        if (sellingPrice.greaterThan(mrp)) {
          throw new Error(
            `Pricing Violation: Selling price (${sellingPrice.toFixed(2)}) cannot exceed Maximum Retail Price (${mrp.toFixed(2)}) on batch ${batchNumber}.`
          );
        }

        // Financial line calculation
        const lineAmount = unitCost.mul(receivedQty);
        const taxRate = new Prisma.Decimal(item.taxRate !== undefined ? item.taxRate : Number(product.vatRate));
        const taxAmount = lineAmount.mul(taxRate).div(100);
        const lineTotal = lineAmount.add(taxAmount);

        calculatedSubtotal = calculatedSubtotal.add(lineAmount);
        calculatedTax = calculatedTax.add(taxAmount);

        // Days remaining for FEFO tiering
        const daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const batchStatus: BatchStatus = daysLeft <= 90 ? BatchStatus.NEAR_EXPIRY : BatchStatus.ACTIVE;

        const rackLocation = `${input.receivingWarehouse} - ${item.rackLocation || product.defaultRackLocation || 'Shelf-01'}`;

        // Create active Batch record
        const batch = await tx.batch.create({
          data: {
            batchNumber,
            productId: item.productId,
            supplierId: purchaseOrder.supplierId,
            purchaseOrderItemId: item.purchaseOrderItemId || undefined,
            manufacturingDate: mfgDate,
            expiryDate: expDate,
            purchasePrice: unitCost,
            mrp,
            unitSellingPrice: sellingPrice,
            initialQuantity: effectiveInwardStock,
            currentStock: effectiveInwardStock,
            rackLocation,
            status: batchStatus,
          },
        });

        createdBatches.push(batch);

        // Record damage adjustment if vendor stock had damaged units
        if (damagedQty > 0) {
          const quarantinedBatch = await tx.batch.create({
            data: {
              batchNumber: `${batchNumber}-DMG`,
              productId: item.productId,
              supplierId: purchaseOrder.supplierId,
              manufacturingDate: mfgDate,
              expiryDate: expDate,
              purchasePrice: unitCost,
              mrp,
              unitSellingPrice: sellingPrice,
              initialQuantity: damagedQty,
              currentStock: 0,
              rackLocation: `${input.receivingWarehouse} - Quarantine Bay`,
              status: BatchStatus.QUARANTINED,
              quarantineReason: `Vendor transit damage reported during GRN ${purchaseOrder.poNumber}.`,
            },
          });

          await tx.stockAdjustment.create({
            data: {
              adjustmentNumber: `ADJ-GRN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              batch: { connect: { id: quarantinedBatch.id } },
              user: { connect: { id: userId } },
              type: AdjustmentType.PHYSICAL_DAMAGE,
              direction: 'decrease',
              quantityAdjusted: damagedQty,
              quantityChange: -damagedQty,
              previousStock: damagedQty,
              newStock: 0,
              unitCost,
              totalMonetaryValue: damagedQty * Number(unitCost),
              status: AdjustmentStatus.APPROVED,
              reason: `Vendor transit damage upon GRN receipt: ${damagedQty} units compromised.`,
            },
          });
        }

        // Update purchase order item row if exists
        if (item.purchaseOrderItemId) {
          await tx.purchaseOrderItem.update({
            where: { id: item.purchaseOrderItemId },
            data: {
              batchNumber,
              manufacturingDate: mfgDate,
              expiryDate: expDate,
              receivedQuantity: receivedQty,
              freeQuantity: freeQty,
              unitPurchasePrice: unitCost,
              mrp,
              sellingPrice,
              taxRate,
              taxAmount,
              lineTotal,
            },
          });
        }
      }

      // 3. Compute Final GRN Bill Totals
      const finalGrandTotal = calculatedSubtotal.add(calculatedTax);
      const paidAmount = new Prisma.Decimal(input.paidAmount || 0);
      const netPayableDue = finalGrandTotal.sub(paidAmount);

      // Determine PO status based on received quantity ratio
      let finalStatus: PurchaseOrderStatus = PurchaseOrderStatus.RECEIVED;
      if (input.receiveMode === 'PARTIAL' || (totalReceivedUnits < totalOrderedUnits && totalReceivedUnits > 0)) {
        finalStatus = PurchaseOrderStatus.PARTIALLY_RECEIVED;
      }

      let paymentStatus: PaymentStatus = PaymentStatus.UNPAID;
      if (paidAmount.greaterThanOrEqualTo(finalGrandTotal)) {
        paymentStatus = PaymentStatus.PAID;
      } else if (paidAmount.greaterThan(0)) {
        paymentStatus = PaymentStatus.PARTIALLY_PAID;
      }

      const receivedDate = new Date(input.receivedDate || today);

      // 4. Update Purchase Order Master with Vendor Invoice and Status
      const updatedPO = await tx.purchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: {
          invoiceNumber: input.vendorInvoiceNumber.trim(),
          receivedDate,
          status: finalStatus,
          paymentStatus,
          subTotal: calculatedSubtotal,
          taxAmount: calculatedTax,
          grandTotal: finalGrandTotal,
          paidAmount,
          dueAmount: netPayableDue.greaterThan(0) ? netPayableDue : new Prisma.Decimal(0),
          notes: `${purchaseOrder.notes || ''} | GRN Received in ${input.receivingWarehouse}. ${input.notes || ''}`.trim(),
        },
      });

      // 5. SUPPLIER LEDGER & ACCOUNT UPDATING
      // If there is an unpaid balance, increment Supplier's balancePayable
      if (netPayableDue.greaterThan(0)) {
        await tx.supplier.update({
          where: { id: purchaseOrder.supplierId },
          data: {
            balancePayable: { increment: netPayableDue },
          },
        });
      }

      // Record payment if paid amount was disbursed
      if (paidAmount.greaterThan(0)) {
        await tx.payment.create({
          data: {
            purchaseOrderId: purchaseOrder.id,
            paymentMethod: input.paymentMethod || PaymentMethod.BANK_TRANSFER,
            amount: paidAmount,
            transactionRef: input.paymentReference || `VOUCHER-${purchaseOrder.poNumber}`,
            paymentStatus: PaymentStatus.PAID,
          },
        });
      }

      // 6. Double-Entry General Ledger Integration
      const jvSequence = Math.floor(1000 + Math.random() * 9000);
      const entryNumber = `JV-GRN-${today.getFullYear()}-${jvSequence}`;

      // Create journal entry for purchase receipt
      const inventoryAssetAccount = await tx.account.findFirst({
        where: { accountCode: '1200-INVENTORY' },
      });
      const accountsPayableAccount = await tx.account.findFirst({
        where: { accountCode: '2010-ACCOUNTS-PAYABLE' },
      });

      if (inventoryAssetAccount && accountsPayableAccount) {
        const journal = await tx.journalEntry.create({
          data: {
            entryNumber,
            entryDate: receivedDate,
            reference: updatedPO.invoiceNumber,
            description: `GRN Inward Receipt from ${purchaseOrder.supplier.name} (PO: ${purchaseOrder.poNumber}, Inv: ${updatedPO.invoiceNumber})`,
          },
        });

        // Debit Inventory Asset
        await tx.journalLine.create({
          data: {
            journalEntryId: journal.id,
            accountId: inventoryAssetAccount.id,
            entryType: 'DEBIT',
            amount: finalGrandTotal,
            description: `Inventory stock addition for GRN ${purchaseOrder.poNumber}`,
          },
        });

        // Credit Accounts Payable
        await tx.journalLine.create({
          data: {
            journalEntryId: journal.id,
            accountId: accountsPayableAccount.id,
            entryType: 'CREDIT',
            amount: finalGrandTotal,
            description: `Payable liability to ${purchaseOrder.supplier.name}`,
          },
        });

        // Update account balances
        await tx.account.update({
          where: { id: inventoryAssetAccount.id },
          data: { currentBalance: { increment: finalGrandTotal } },
        });

        await tx.account.update({
          where: { id: accountsPayableAccount.id },
          data: { currentBalance: { increment: finalGrandTotal } },
        });
      }

      // 7. Audit Trail Logging
      await tx.auditLog.create({
        data: {
          userId,
          action: AuditAction.UPDATE,
          entityType: 'PurchaseOrder',
          entityId: purchaseOrder.id,
          ipAddress,
          metadata: {
            event: 'GRN_CONFIRMATION',
            poNumber: purchaseOrder.poNumber,
            vendorInvoice: input.vendorInvoiceNumber,
            warehouse: input.receivingWarehouse,
            batchesCreatedCount: createdBatches.length,
            grandTotal: finalGrandTotal.toNumber(),
            paidAmount: paidAmount.toNumber(),
            dueAmount: netPayableDue.toNumber(),
          },
        },
      });

      return {
        purchaseOrderId: updatedPO.id,
        poNumber: updatedPO.poNumber,
        invoiceNumber: updatedPO.invoiceNumber,
        status: updatedPO.status,
        paymentStatus: updatedPO.paymentStatus,
        grandTotal: Number(updatedPO.grandTotal),
        paidAmount: Number(updatedPO.paidAmount),
        dueAmount: Number(updatedPO.dueAmount),
        batchesCreated: createdBatches.length,
        receivingWarehouse: input.receivingWarehouse,
        receivedDate: updatedPO.receivedDate,
      };
    });
  }

  /**
   * 3. GET PURCHASE ORDERS (With filter and search)
   */
  public static async getPurchaseOrders(params?: {
    status?: PurchaseOrderStatus;
    supplierId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.PurchaseOrderWhereInput = {};

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.supplierId) {
      where.supplierId = params.supplierId;
    }

    if (params?.search) {
      where.OR = [
        { poNumber: { contains: params.search, mode: 'insensitive' } },
        { invoiceNumber: { contains: params.search, mode: 'insensitive' } },
        { supplier: { name: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    return await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            companyName: true,
            phone: true,
            email: true,
            paymentTermsDays: true,
            balancePayable: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                strength: true,
                unitOfMeasure: true,
                packSize: true,
              },
            },
          },
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      take: params?.limit || 50,
      skip: params?.offset || 0,
    });
  }

  /**
   * 4. GET SINGLE PURCHASE ORDER DETAIL
   */
  public static async getPurchaseOrderById(id: string) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
            createdBatch: true,
          },
        },
        payments: true,
      },
    });

    if (!po) {
      throw new Error(`Purchase Order with ID ${id} not found.`);
    }

    return po;
  }

  /**
   * 5. GET SUPPLIER LEDGER & ACCOUNTS
   */
  public static async getSupplierLedger(supplierId: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        purchaseOrders: {
          include: {
            payments: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!supplier) {
      throw new Error(`Supplier with ID ${supplierId} not found.`);
    }

    // Build timeline ledger entries
    interface LedgerItem {
      date: Date;
      type: 'INVOICE' | 'PAYMENT';
      reference: string;
      description: string;
      debit: number;
      credit: number;
      runningBalance: number;
    }

    const ledger: LedgerItem[] = [];
    let runningBalance = 0;

    for (const po of supplier.purchaseOrders) {
      const invoiceAmt = Number(po.grandTotal);
      runningBalance += invoiceAmt;

      ledger.push({
        date: po.receivedDate || po.orderDate,
        type: 'INVOICE',
        reference: po.invoiceNumber,
        description: `GRN Purchase Invoice #${po.invoiceNumber} (PO #${po.poNumber})`,
        debit: 0,
        credit: invoiceAmt,
        runningBalance,
      });

      for (const pay of po.payments) {
        const payAmt = Number(pay.amount);
        runningBalance -= payAmt;

        ledger.push({
          date: pay.paidAt,
          type: 'PAYMENT',
          reference: pay.transactionRef || `PAY-${po.invoiceNumber}`,
          description: `Supplier settlement via ${pay.paymentMethod}`,
          debit: payAmt,
          credit: 0,
          runningBalance,
        });
      }
    }

    return {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        companyName: supplier.companyName,
        phone: supplier.phone,
        email: supplier.email,
        paymentTermsDays: supplier.paymentTermsDays,
        balancePayable: Number(supplier.balancePayable),
      },
      currentBalancePayable: Number(supplier.balancePayable),
      ledger: ledger.reverse(), // Most recent first for display
    };
  }

  /**
   * 6. RECORD SUPPLIER PAYMENT
   */
  public static async recordSupplierPayment(
    input: SupplierPaymentInput,
    userId: string,
    ipAddress: string
  ) {
    if (input.amount <= 0) {
      throw new Error('Payment error: Amount must be greater than zero.');
    }

    return await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({
        where: { id: input.supplierId },
      });

      if (!supplier) {
        throw new Error(`Supplier with ID ${input.supplierId} not found.`);
      }

      const payAmt = new Prisma.Decimal(input.amount);

      // Decrement Supplier balancePayable
      const updatedSupplier = await tx.supplier.update({
        where: { id: input.supplierId },
        data: {
          balancePayable: { decrement: payAmt },
        },
      });

      // Create Payment entry
      const payment = await tx.payment.create({
        data: {
          paymentMethod: input.paymentMethod,
          amount: payAmt,
          transactionRef: input.referenceNumber,
          paymentStatus: PaymentStatus.PAID,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          userId,
          action: AuditAction.CREATE,
          entityType: 'SupplierPayment',
          entityId: payment.id,
          ipAddress,
          metadata: {
            supplierId: supplier.id,
            supplierName: supplier.name,
            amount: input.amount,
            method: input.paymentMethod,
            newBalancePayable: Number(updatedSupplier.balancePayable),
          },
        },
      });

      return {
        paymentId: payment.id,
        supplierName: supplier.name,
        amountPaid: input.amount,
        remainingBalancePayable: Number(updatedSupplier.balancePayable),
        paidAt: payment.paidAt,
      };
    });
  }
}
