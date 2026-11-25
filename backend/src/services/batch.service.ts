import { prisma } from '../server';

export class BatchService {
  static async getAllBatches(opts?: { productId?: string; status?: string; skip?: number; take?: number }) {
    const { productId, status, skip = 0, take = 200 } = opts || {};
    return prisma.batch.findMany({
      where: {
        ...(productId && { productId }),
        ...(status && { status: status as any }),
      },
      include: {
        product: { include: { generic: true, manufacturer: true, category: true } },
        supplier: { select: { id: true, name: true, companyName: true } },
      },
      orderBy: { expiryDate: 'asc' },
      skip,
      take,
    });
  }

  static async getBatchesForMedicine(productId: string) {
    return prisma.batch.findMany({
      where: { productId },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        supplier: { select: { id: true, name: true, companyName: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });
  }

  static async getFefoBatchForMedicine(productId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const withStock = await prisma.batch.findMany({
      where: {
        productId,
        currentStock: { gt: 0 },
        status: { notIn: ['QUARANTINED', 'RECALLED'] },
      },
      orderBy: { expiryDate: 'asc' },
    });

    if (withStock.length === 0) {
      return { batch: null, hasStock: false, allStockExpired: false, expiredBatchesCount: 0, nearestExpiryDays: null };
    }

    const unexpired = withStock.filter((b) => b.expiryDate > today && b.status !== 'EXPIRED');
    const expiredCount = withStock.length - unexpired.length;

    if (unexpired.length === 0) {
      return { batch: null, hasStock: true, allStockExpired: true, expiredBatchesCount: expiredCount, nearestExpiryDays: null };
    }

    const fefo = unexpired[0]; // already sorted by expiryDate asc
    const diffDays = Math.ceil((fefo.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    return { batch: fefo, hasStock: true, allStockExpired: false, expiredBatchesCount: expiredCount, nearestExpiryDays: diffDays };
  }

  static async addBatch(data: any) {
    const {
      productId,
      batchNumber,
      invoiceNumber,
      invoiceDate,
      supplierId,
      supplierName,
      manufacturingDate,
      expiryDate,
      purchasePrice,
      mrp,
      unitSellingPrice,
      initialQuantity,
      currentStock,
      rackLocation,
      branchId,
      branchName,
      status,
      updateMasterPrices,
      createInvoiceRecord,
    } = data;

    if (!productId || !batchNumber || !expiryDate) {
      throw new Error('productId, batchNumber, and expiryDate are required.');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(expiryDate);
    if (isNaN(expDate.getTime()) || expDate <= today) {
      throw new Error(
        `REGULATORY REJECTION: Batch "${batchNumber}" has an invalid or expired date (${expiryDate}). Expired pharmaceuticals cannot be received.`
      );
    }

    const mfgDate = manufacturingDate ? new Date(manufacturingDate) : new Date();
    const invDate = invoiceDate ? new Date(invoiceDate) : new Date();
    const qty = Math.max(0, Number(initialQuantity) || 0);
    const stockQty = currentStock !== undefined ? Math.max(0, Number(currentStock) || 0) : qty;
    const cost = Math.max(0, Number(purchasePrice) || 0);
    const mrpVal = Math.max(0, Number(mrp) || 0);
    const sellVal = Math.max(0, Number(unitSellingPrice) || 0);
    const cleanBatchNo = String(batchNumber).trim();
    const cleanInvoiceNo = invoiceNumber && String(invoiceNumber).trim() !== '' ? String(invoiceNumber).trim() : null;

    return prisma.$transaction(async (tx) => {
      // 1. Resolve Supplier
      let resolvedSupplierId: string | null = null;
      if (supplierId) {
        const existingSup = await tx.supplier.findUnique({ where: { id: supplierId } });
        if (existingSup) resolvedSupplierId = existingSup.id;
      }
      if (!resolvedSupplierId && supplierName && String(supplierName).trim() !== '') {
        const trimmedName = String(supplierName).trim();
        const foundSup =
          (await tx.supplier.findFirst({
            where: {
              OR: [
                { name: { equals: trimmedName, mode: 'insensitive' } },
                { companyName: { equals: trimmedName, mode: 'insensitive' } },
              ],
            },
          })) ||
          (await tx.supplier.create({
            data: {
              name: trimmedName,
              companyName: trimmedName,
              phone: 'N/A',
            },
          }));
        resolvedSupplierId = foundSup.id;
      }

      // 2. Create or Append Invoice (PurchaseOrder + PurchaseOrderItem) when invoiceNumber & supplierId exist
      let createdPoItemId: string | null = null;
      if (cleanInvoiceNo && resolvedSupplierId && createInvoiceRecord !== false) {
        const lineTotal = Number((qty * cost).toFixed(2));
        let po = await tx.purchaseOrder.findFirst({
          where: {
            invoiceNumber: cleanInvoiceNo,
            supplierId: resolvedSupplierId,
          },
        });

        if (po) {
          po = await tx.purchaseOrder.update({
            where: { id: po.id },
            data: {
              subTotal: { increment: lineTotal },
              grandTotal: { increment: lineTotal },
              paidAmount: { increment: lineTotal },
            },
          });
        } else {
          const poNumber = `PO-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 89)}`;
          po = await tx.purchaseOrder.create({
            data: {
              poNumber,
              invoiceNumber: cleanInvoiceNo,
              supplierId: resolvedSupplierId,
              orderDate: invDate,
              receivedDate: invDate,
              status: 'RECEIVED',
              paymentStatus: 'PAID',
              subTotal: lineTotal,
              grandTotal: lineTotal,
              paidAmount: lineTotal,
              dueAmount: 0,
              notes: 'Invoice-Wise Inward Batch Entry',
            },
          });
        }

        const poItem = await tx.purchaseOrderItem.create({
          data: {
            purchaseOrderId: po.id,
            productId,
            batchNumber: cleanBatchNo,
            manufacturingDate: mfgDate,
            expiryDate: expDate,
            orderedQuantity: qty,
            receivedQuantity: qty,
            freeQuantity: 0,
            unitPurchasePrice: cost,
            mrp: mrpVal,
            sellingPrice: sellVal,
            taxRate: 0,
            taxAmount: 0,
            lineTotal,
          },
        });
        createdPoItemId = poItem.id;
      }

      // 3. Create or Increment Batch
      const existingBatch = await tx.batch.findFirst({
        where: {
          productId,
          batchNumber: { equals: cleanBatchNo, mode: 'insensitive' },
        },
      });

      let savedBatch;
      if (existingBatch) {
        savedBatch = await tx.batch.update({
          where: { id: existingBatch.id },
          data: {
            currentStock: { increment: stockQty },
            initialQuantity: { increment: qty },
            purchasePrice: cost,
            mrp: mrpVal,
            unitSellingPrice: sellVal,
            invoiceNumber: cleanInvoiceNo || existingBatch.invoiceNumber,
            invoiceDate: cleanInvoiceNo ? invDate : existingBatch.invoiceDate,
            supplierId: resolvedSupplierId || existingBatch.supplierId,
            rackLocation: rackLocation || existingBatch.rackLocation,
          },
          include: {
            product: { include: { generic: true, manufacturer: true, category: true } },
            supplier: { select: { id: true, name: true, companyName: true } },
          },
        });
      } else {
        savedBatch = await tx.batch.create({
          data: {
            productId,
            batchNumber: cleanBatchNo,
            supplierId: resolvedSupplierId,
            purchaseOrderItemId: createdPoItemId,
            invoiceNumber: cleanInvoiceNo,
            invoiceDate: cleanInvoiceNo ? invDate : null,
            manufacturingDate: mfgDate,
            expiryDate: expDate,
            purchasePrice: cost,
            mrp: mrpVal,
            unitSellingPrice: sellVal,
            initialQuantity: qty,
            currentStock: stockQty,
            rackLocation: rackLocation || null,
            branchId: branchId || null,
            branchName: branchName || null,
            status: (String(status || 'ACTIVE').toUpperCase()) as any,
          },
          include: {
            product: { include: { generic: true, manufacturer: true, category: true } },
            supplier: { select: { id: true, name: true, companyName: true } },
          },
        });
      }

      // 4. Auto-Sync Product Master Unit Prices
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (
        product &&
        (updateMasterPrices === true ||
          (Number(product.purchasePrice) === 0 && Number(product.sellingPrice) === 0)) &&
        (cost > 0 || mrpVal > 0 || sellVal > 0)
      ) {
        await tx.product.update({
          where: { id: productId },
          data: {
            purchasePrice: cost,
            mrp: mrpVal,
            sellingPrice: sellVal,
          },
        });
      }

      return savedBatch;
    });
  }

  static async updateBatch(id: string, data: any) {
    return prisma.batch.update({ where: { id }, data });
  }

  static async quarantineBatch(id: string, reason: string) {
    return prisma.batch.update({
      where: { id },
      data: { status: 'QUARANTINED', quarantineReason: reason },
    });
  }

  static async getExpiringBatches(withinDays = 90) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + withinDays);

    return prisma.batch.findMany({
      where: {
        expiryDate: { gte: today, lte: future },
        currentStock: { gt: 0 },
        status: { notIn: ['QUARANTINED', 'RECALLED', 'DEPLETED'] },
      },
      include: {
        product: { include: { manufacturer: true, category: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });
  }
}
