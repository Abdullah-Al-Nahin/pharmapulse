import { prisma } from '../server';

export class PurchaseOrderService {
  static async getAllPurchaseOrders() {
    return prisma.purchaseOrder.findMany({
      include: {
        supplier: true,
        items: {
          include: { product: true }
        },
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getPurchaseOrderById(id: string) {
    return prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: { product: true }
        },
      }
    });
  }

  /**
   * Creates a Purchase Order in the database.
   */
  static async createPurchaseOrder(data: {
    supplierId: string;
    invoiceNumber: string;
    notes?: string;
    items: Array<{
      productId: string;
      batchNumber: string;
      manufacturingDate: string;
      expiryDate: string;
      orderedQuantity: number;
      receivedQuantity: number;
      freeQuantity?: number;
      unitPurchasePrice: number;
      mrp: number;
      sellingPrice: number;
      taxRate?: number;
      taxAmount?: number;
      lineTotal: number;
    }>;
    subTotal: number;
    taxAmount: number;
    discountAmount: number;
    grandTotal: number;
  }) {
    const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
    if (!supplier) throw new Error('Supplier not found.');

    const dateNum = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const suffix = Math.floor(100 + Math.random() * 900);
    const poNumber = `PO-${dateNum}-${suffix}`;

    return prisma.purchaseOrder.create({
      data: {
        poNumber,
        invoiceNumber: data.invoiceNumber,
        supplierId: data.supplierId,
        subTotal: data.subTotal,
        taxAmount: data.taxAmount,
        discountAmount: data.discountAmount,
        grandTotal: data.grandTotal,
        notes: data.notes,
        items: {
          create: data.items.map(item => ({
            productId: item.productId,
            batchNumber: item.batchNumber,
            manufacturingDate: new Date(item.manufacturingDate),
            expiryDate: new Date(item.expiryDate),
            orderedQuantity: item.orderedQuantity,
            receivedQuantity: item.receivedQuantity,
            freeQuantity: item.freeQuantity ?? 0,
            unitPurchasePrice: item.unitPurchasePrice,
            mrp: item.mrp,
            sellingPrice: item.sellingPrice,
            taxRate: item.taxRate ?? 0,
            taxAmount: item.taxAmount ?? 0,
            lineTotal: item.lineTotal,
          }))
        }
      },
      include: {
        supplier: true,
        items: true,
      }
    });
  }

  /**
   * GRN: Receive goods, validate expiry, create/update batches, update supplier payable.
   */
  static async receiveGRN(poId: string, data: {
    vendorInvoiceNumber: string;
    receivedDate: string;
    paidAmount?: number;
    notes?: string;
    items: Array<{
      purchaseOrderItemId: string;
      productId: string;
      batchNumber: string;
      manufacturingDate: string;
      expiryDate: string;
      receivedQuantity: number;
      freeQuantity?: number;
      unitPurchasePrice: number;
      mrp: number;
      sellingPrice: number;
      taxRate?: number;
      rackLocation?: string;
    }>;
  }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Validate all expiry dates
    for (const item of data.items) {
      const exp = new Date(item.expiryDate);
      if (exp <= today) {
        throw new Error(
          `REGULATORY REJECTION: Batch "${item.batchNumber}" has an expiry date in the past (${item.expiryDate}). Expired pharmaceuticals cannot be received!`
        );
      }
    }

    return prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: { supplier: true } });
      if (!po) throw new Error('Purchase Order not found.');

      let calculatedSubtotal = 0;
      let calculatedTax = 0;

      for (const item of data.items) {
        const receivedQty = item.receivedQuantity;
        const freeQty = item.freeQuantity ?? 0;
        const totalInward = receivedQty + freeQty;

        const lineSub = item.unitPurchasePrice * receivedQty;
        const tax = lineSub * ((item.taxRate ?? 0) / 100);
        calculatedSubtotal += lineSub;
        calculatedTax += tax;

        // Check existing batch (same product + batchNumber)
        const existingBatch = await tx.batch.findFirst({
          where: {
            productId: item.productId,
            batchNumber: { equals: item.batchNumber.toUpperCase(), mode: 'insensitive' },
          }
        });

        if (existingBatch) {
          await tx.batch.update({
            where: { id: existingBatch.id },
            data: {
              currentStock: { increment: totalInward },
              purchasePrice: item.unitPurchasePrice,
              unitSellingPrice: item.sellingPrice,
              mrp: item.mrp,
              rackLocation: item.rackLocation,
            }
          });
        } else {
          await tx.batch.create({
            data: {
              batchNumber: item.batchNumber.toUpperCase(),
              productId: item.productId,
              supplierId: po.supplierId,
              purchaseOrderItemId: item.purchaseOrderItemId,
              manufacturingDate: new Date(item.manufacturingDate),
              expiryDate: new Date(item.expiryDate),
              purchasePrice: item.unitPurchasePrice,
              mrp: item.mrp,
              unitSellingPrice: item.sellingPrice,
              initialQuantity: totalInward,
              currentStock: totalInward,
              rackLocation: item.rackLocation,
              status: 'ACTIVE',
            }
          });
        }
      }

      const grandTotal = calculatedSubtotal + calculatedTax;
      const paidAmount = data.paidAmount ?? 0;
      const dueAmount = Math.max(0, grandTotal - paidAmount);
      const paymentStatus = paidAmount >= grandTotal ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

      // Update Supplier balance payable
      if (dueAmount > 0) {
        await tx.supplier.update({
          where: { id: po.supplierId },
          data: { balancePayable: { increment: dueAmount } }
        });
      }

      // Update PO status
      const updatedPO = await tx.purchaseOrder.update({
        where: { id: poId },
        data: {
          invoiceNumber: data.vendorInvoiceNumber,
          receivedDate: new Date(data.receivedDate),
          status: 'RECEIVED',
          paymentStatus: paymentStatus as any,
          paidAmount,
          dueAmount,
          notes: data.notes,
        }
      });

      return { po: updatedPO, grandTotal, paidAmount, dueAmount };
    });
  }
}
