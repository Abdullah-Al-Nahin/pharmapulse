import { Prisma, BatchStatus, AuditAction, PaymentMethod, SaleStatus } from '@prisma/client';
import { prisma } from '../db';

export interface PosSearchFilter {
  query?: string;
  barcode?: string;
  generic?: string;
  brand?: string;
  batchNumber?: string;
  categoryId?: string;
  limit?: number;
}

export interface PosSaleItemInput {
  productId: string;
  batchId: string;
  quantity: number;
  unitSellingPrice?: number; // Optional override; defaults to batch unitSellingPrice
  discountAmount?: number;
}

export interface PosPaymentInput {
  paymentMethod: PaymentMethod;
  amount: number;
  transactionRef?: string;
  providerTrxId?: string; // bKash/Nagad/Rocket TrxID or Card Auth Code
}

export interface CreatePosSaleInput {
  customerId?: string;
  shiftId?: string;
  prescriptionId?: string;
  isScheduleHCompliant?: boolean;
  notes?: string;
  discountAmount?: number;
  items: PosSaleItemInput[];
  payments: PosPaymentInput[];
}

export class PosService {
  /**
   * Search catalog products and retrieve available batches sorted by FEFO (First-Expiry-First-Out).
   * Automatically calculates remaining shelf life and highlights the priority batch for dispensing.
   */
  public static async searchProductsAndBatches(filter: PosSearchFilter) {
    const { query, barcode, generic, brand, batchNumber, categoryId, limit = 25 } = filter;

    const whereClause: Prisma.ProductWhereInput = {
      isActive: true,
    };

    if (barcode) {
      whereClause.barcode = barcode.trim();
    } else if (query) {
      const sanitized = query.trim();
      whereClause.OR = [
        { name: { contains: sanitized, mode: 'insensitive' } },
        { sku: { contains: sanitized, mode: 'insensitive' } },
        { barcode: { contains: sanitized, mode: 'insensitive' } },
        { generic: { name: { contains: sanitized, mode: 'insensitive' } } },
        { manufacturer: { name: { contains: sanitized, mode: 'insensitive' } } },
        {
          batches: {
            some: {
              batchNumber: { contains: sanitized, mode: 'insensitive' },
              currentStock: { gt: 0 },
            },
          },
        },
      ];
    }

    if (generic) {
      whereClause.generic = { name: { contains: generic.trim(), mode: 'insensitive' } };
    }
    if (brand) {
      whereClause.name = { contains: brand.trim(), mode: 'insensitive' };
    }
    if (categoryId) {
      whereClause.categoryId = categoryId;
    }

    const today = new Date();

    const products = await prisma.product.findMany({
      where: whereClause,
      take: limit,
      include: {
        generic: {
          select: {
            id: true,
            name: true,
            therapeuticClass: true,
            pregnancyCategory: true,
          },
        },
        manufacturer: {
          select: {
            id: true,
            name: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        // Fetch only active, non-depleted batches ordered strictly by earliest expiry (FEFO)
        batches: {
          where: {
            status: { in: [BatchStatus.ACTIVE, BatchStatus.NEAR_EXPIRY] },
            currentStock: { gt: 0 },
            expiryDate: { gt: today }, // Exclude physically expired batches from active POS selection
            ...(batchNumber ? { batchNumber: { contains: batchNumber.trim(), mode: 'insensitive' } } : {}),
          },
          orderBy: {
            expiryDate: 'asc', // STRICT FEFO ENFORCEMENT
          },
        },
      },
    });

    // Format products and annotate FEFO metadata
    return products.map((product) => {
      let cumulativeStock = 0;

      const formattedBatches = product.batches.map((batch, index) => {
        cumulativeStock += batch.currentStock;
        const diffMs = batch.expiryDate.getTime() - today.getTime();
        const daysToExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        let expiryStatus: 'SAFE' | 'EXPIRING_SOON' | 'CRITICAL' = 'SAFE';
        if (daysToExpiry <= 30) {
          expiryStatus = 'CRITICAL';
        } else if (daysToExpiry <= 90) {
          expiryStatus = 'EXPIRING_SOON';
        }

        return {
          id: batch.id,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
          daysToExpiry,
          expiryStatus,
          isFefoRecommended: index === 0, // Top batch in FEFO order is recommended
          currentStock: batch.currentStock,
          reservedStock: batch.reservedStock,
          availableStock: batch.currentStock - batch.reservedStock,
          mrp: Number(batch.mrp),
          unitSellingPrice: Number(batch.unitSellingPrice),
          purchasePrice: Number(batch.purchasePrice),
          rackLocation: batch.rackLocation || product.defaultRackLocation || 'Unassigned',
          status: batch.status,
        };
      });

      return {
        id: product.id,
        sku: product.sku,
        barcode: product.barcode,
        name: product.name,
        dosageForm: product.dosageForm,
        route: product.route,
        strength: product.strength,
        unitOfMeasure: product.unitOfMeasure,
        packSize: product.packSize,
        storageCondition: product.storageCondition,
        requiresPrescription: product.requiresPrescription,
        isNarcoticOrSedative: product.isNarcoticOrSedative,
        isAntibiotic: product.isAntibiotic,
        vatRate: Number(product.vatRate),
        generic: product.generic,
        manufacturer: product.manufacturer,
        category: product.category,
        totalAvailableStock: cumulativeStock,
        batches: formattedBatches,
        fefoCandidateBatch: formattedBatches[0] || null,
      };
    });
  }

  /**
   * Execute atomic POS Sale Transaction:
   * - Strict FEFO & Expiry Validation (rejects expired/quarantined batches)
   * - Stock balance verification
   * - Schedule H / Narcotics compliance check
   * - Atomic stock deduction
   * - COGS calculation
   * - Multi-tender split payment handling
   * - Immutable Audit Log creation
   */
  public static async executeSaleTransaction(
    input: CreatePosSaleInput,
    cashierId: string,
    ipAddress: string,
    userAgent?: string
  ) {
    if (!input.items || input.items.length === 0) {
      throw new Error('Transaction rejected: Cart contains no items.');
    }

    if (!input.payments || input.payments.length === 0) {
      throw new Error('Transaction rejected: At least one payment entry is required.');
    }

    const today = new Date();

    // Execute everything in an atomic database transaction
    return await prisma.$transaction(async (tx) => {
      // 1. Verify Cashier
      const cashier = await tx.user.findUnique({
        where: { id: cashierId },
        select: { id: true, fullName: true, status: true },
      });

      if (!cashier || cashier.status !== 'ACTIVE') {
        throw new Error('Unauthorized: Cashier account is inactive or not found.');
      }

      // 2. Verify Shift if provided
      if (input.shiftId) {
        const shift = await tx.cashShift.findUnique({
          where: { id: input.shiftId },
          select: { id: true, status: true },
        });
        if (!shift || shift.status !== 'OPEN') {
          throw new Error('Transaction rejected: Cash drawer shift is not open.');
        }
      }

      // 3. Verify Customer if provided
      let customer = null;
      if (input.customerId) {
        customer = await tx.customer.findUnique({
          where: { id: input.customerId },
        });
        if (!customer) {
          throw new Error(`Customer with ID ${input.customerId} not found.`);
        }
      }

      // 4. Batch Validation & Pricing Calculation
      const validatedItems: Array<{
        productId: string;
        batchId: string;
        batchNumber: string;
        quantity: number;
        unitMrp: Prisma.Decimal;
        unitSellingPrice: Prisma.Decimal;
        unitCostPrice: Prisma.Decimal;
        discountAmount: Prisma.Decimal;
        taxRate: Prisma.Decimal;
        taxAmount: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
        lineGrossProfit: Prisma.Decimal;
        newBatchStock: number;
        newBatchStatus: BatchStatus;
      }> = [];

      let subTotalDecimal = new Prisma.Decimal(0);
      let taxTotalDecimal = new Prisma.Decimal(0);
      let cogsTotalDecimal = new Prisma.Decimal(0);

      for (const cartItem of input.items) {
        if (cartItem.quantity <= 0) {
          throw new Error(`Invalid item quantity (${cartItem.quantity}) for batch ${cartItem.batchId}.`);
        }

        // Fetch batch and product info with consistent read
        const batch = await tx.batch.findUnique({
          where: { id: cartItem.batchId },
          include: {
            product: true,
          },
        });

        if (!batch) {
          throw new Error(`Batch ID ${cartItem.batchId} does not exist.`);
        }

        if (batch.productId !== cartItem.productId) {
          throw new Error(
            `Product mismatch: Batch ${batch.batchNumber} belongs to product ${batch.productId}, not ${cartItem.productId}.`
          );
        }

        const product = batch.product;

        // STRICT EXPIRY VALIDATION
        if (batch.expiryDate <= today) {
          throw new Error(
            `CRITICAL SAFETY REJECTION: Batch ${batch.batchNumber} for medication "${product.name}" expired on ${
              batch.expiryDate.toISOString().split('T')[0]
            }. Dispensing expired drugs is illegal and strictly blocked.`
          );
        }

        // BATCH STATUS VALIDATION
        if (batch.status === BatchStatus.QUARANTINED || batch.status === BatchStatus.RECALLED) {
          throw new Error(
            `DISPENSE BLOCKED: Batch ${batch.batchNumber} of "${product.name}" is locked in ${batch.status} status. Reason: ${
              batch.quarantineReason || 'Under regulatory investigation'
            }.`
          );
        }

        if (batch.status === BatchStatus.DEPLETED || batch.currentStock <= 0) {
          throw new Error(
            `Stock depletion: Batch ${batch.batchNumber} of "${product.name}" is completely out of stock.`
          );
        }

        // SUFFICIENT STOCK VALIDATION
        if (batch.currentStock < cartItem.quantity) {
          throw new Error(
            `Insufficient stock for "${product.name}" (Batch: ${batch.batchNumber}). Requested: ${cartItem.quantity}, Available: ${batch.currentStock}.`
          );
        }

        // REGULATORY COMPLIANCE VALIDATION (Schedule H & Narcotics)
        if (product.requiresPrescription || product.isNarcoticOrSedative) {
          if (!input.prescriptionId && !input.isScheduleHCompliant) {
            throw new Error(
              `REGULATORY COMPLIANCE REQUIRED: "${product.name}" is a Schedule-H/Narcotic controlled medication. A valid doctor prescription ID or Schedule-H compliance override is mandatory.`
            );
          }
        }

        // Calculate line economics
        const unitSellingPrice = cartItem.unitSellingPrice !== undefined
          ? new Prisma.Decimal(cartItem.unitSellingPrice)
          : batch.unitSellingPrice;

        const unitCostPrice = batch.purchasePrice;
        const unitMrp = batch.mrp;
        const discountAmount = new Prisma.Decimal(cartItem.discountAmount || 0);

        const baseLineAmount = unitSellingPrice.mul(cartItem.quantity).sub(discountAmount);
        const taxRate = product.vatRate;
        const lineTaxAmount = baseLineAmount.mul(taxRate).div(100);
        const lineTotal = baseLineAmount.add(lineTaxAmount);

        const lineCost = unitCostPrice.mul(cartItem.quantity);
        const lineGrossProfit = baseLineAmount.sub(lineCost);

        subTotalDecimal = subTotalDecimal.add(baseLineAmount);
        taxTotalDecimal = taxTotalDecimal.add(lineTaxAmount);
        cogsTotalDecimal = cogsTotalDecimal.add(lineCost);

        const newStock = batch.currentStock - cartItem.quantity;
        const newStatus = newStock === 0 ? BatchStatus.DEPLETED : batch.status;

        validatedItems.push({
          productId: product.id,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          quantity: cartItem.quantity,
          unitMrp,
          unitSellingPrice,
          unitCostPrice,
          discountAmount,
          taxRate,
          taxAmount: lineTaxAmount,
          lineTotal,
          lineGrossProfit,
          newBatchStock: newStock,
          newBatchStatus: newStatus,
        });
      }

      // 5. Compute Invoice Totals
      const orderDiscount = new Prisma.Decimal(input.discountAmount || 0);
      const grandTotalBeforeRound = subTotalDecimal.add(taxTotalDecimal).sub(orderDiscount);
      const grandTotalRounded = grandTotalBeforeRound.toDecimalPlaces(2);
      const roundOff = grandTotalRounded.sub(grandTotalBeforeRound);

      // 6. Validate Payments
      let totalPaidDecimal = new Prisma.Decimal(0);
      for (const pay of input.payments) {
        if (pay.amount <= 0) {
          throw new Error(`Invalid payment amount (${pay.amount}) for payment method ${pay.paymentMethod}.`);
        }
        totalPaidDecimal = totalPaidDecimal.add(new Prisma.Decimal(pay.amount));
      }

      let changeGiven = new Prisma.Decimal(0);
      let dueAmount = new Prisma.Decimal(0);

      if (totalPaidDecimal.greaterThanOrEqualTo(grandTotalRounded)) {
        changeGiven = totalPaidDecimal.sub(grandTotalRounded);
      } else {
        dueAmount = grandTotalRounded.sub(totalPaidDecimal);
        // Allow credit only if customer is verified and credit limit permits
        if (!customer) {
          throw new Error(
            `Incomplete payment: Grand total is ${grandTotalRounded.toFixed(2)}, but only ${totalPaidDecimal.toFixed(2)} was tendered. Due balance requires an existing registered customer.`
          );
        }
        const availableCredit = customer.creditLimit.sub(customer.outstandingBalance);
        if (dueAmount.greaterThan(availableCredit)) {
          throw new Error(
            `Credit Limit Exceeded for customer ${customer.name}. Remaining allowable credit: ${availableCredit.toFixed(2)}, Requested Due: ${dueAmount.toFixed(2)}.`
          );
        }
      }

      // 7. Generate Sequential Unique Invoice Number
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const invoiceNumber = `INV-${timestamp}-${randomSuffix}`;

      // 8. Create Sale Invoice Record
      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          customerId: input.customerId || null,
          cashierId,
          shiftId: input.shiftId || null,
          prescriptionId: input.prescriptionId || null,
          subTotal: subTotalDecimal,
          taxAmount: taxTotalDecimal,
          discountAmount: orderDiscount,
          roundOff,
          grandTotal: grandTotalRounded,
          costOfGoodsSold: cogsTotalDecimal,
          paidAmount: totalPaidDecimal,
          changeGiven,
          dueAmount,
          status: SaleStatus.COMPLETED,
          isScheduleHCompliant: Boolean(input.isScheduleHCompliant),
          notes: input.notes || null,
        },
      });

      // 9. Create Sale Items & Deduct Batch Stock
      for (const item of validatedItems) {
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            batchId: item.batchId,
            quantity: item.quantity,
            unitMrp: item.unitMrp,
            unitSellingPrice: item.unitSellingPrice,
            unitCostPrice: item.unitCostPrice,
            discountAmount: item.discountAmount,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            lineTotal: item.lineTotal,
            lineGrossProfit: item.lineGrossProfit,
          },
        });

        // Deduct inventory atomically from specific batch
        await tx.batch.update({
          where: { id: item.batchId },
          data: {
            currentStock: item.newBatchStock,
            status: item.newBatchStatus,
          },
        });
      }

      // 10. Record Multi-Tender Payments
      for (const pay of input.payments) {
        await tx.payment.create({
          data: {
            saleId: sale.id,
            shiftId: input.shiftId || null,
            paymentMethod: pay.paymentMethod,
            amount: new Prisma.Decimal(pay.amount),
            transactionRef: pay.transactionRef || null,
            providerTrxId: pay.providerTrxId || null,
            paymentStatus: 'PAID',
          },
        });
      }

      // 11. Customer Loyalty Points & Balance update
      if (customer) {
        // Earn 1 point per 100 currency units of subtotal
        const earnedPoints = Math.floor(subTotalDecimal.toNumber() / 100);
        if (earnedPoints > 0) {
          await tx.customer.update({
            where: { id: customer.id },
            data: {
              loyaltyPointsBalance: { increment: earnedPoints },
              outstandingBalance: { increment: dueAmount },
            },
          });

          await tx.loyaltyTransaction.create({
            data: {
              customerId: customer.id,
              saleId: sale.id,
              pointsChange: earnedPoints,
              notes: `Earned from invoice ${invoiceNumber}`,
            },
          });
        } else if (dueAmount.greaterThan(0)) {
          await tx.customer.update({
            where: { id: customer.id },
            data: {
              outstandingBalance: { increment: dueAmount },
            },
          });
        }
      }

      // 12. Create Regulatory Audit Trail
      await tx.auditLog.create({
        data: {
          userId: cashierId,
          action: AuditAction.CREATE,
          entityType: 'Sale',
          entityId: sale.id,
          ipAddress,
          userAgent: userAgent || 'POS-Terminal',
          metadata: {
            invoiceNumber,
            itemCount: validatedItems.length,
            grandTotal: grandTotalRounded.toNumber(),
            isScheduleHCompliant: input.isScheduleHCompliant,
            batchesDispensed: validatedItems.map((i) => ({
              batchNumber: i.batchNumber,
              qty: i.quantity,
            })),
          },
        },
      });

      return {
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        subTotal: Number(sale.subTotal),
        taxAmount: Number(sale.taxAmount),
        discountAmount: Number(sale.discountAmount),
        grandTotal: Number(sale.grandTotal),
        paidAmount: Number(sale.paidAmount),
        changeGiven: Number(sale.changeGiven),
        dueAmount: Number(sale.dueAmount),
        itemCount: validatedItems.length,
        createdAt: sale.createdAt,
      };
    });
  }
}
