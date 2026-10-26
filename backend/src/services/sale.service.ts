import { prisma } from '../server';
import { Prisma } from '@prisma/client';

export class SaleService {
  static async getAllSales() {
    return prisma.sale.findMany({
      include: {
        items: true,
        customer: true,
      }
    });
  }

  static async getSaleById(id: string) {
    return prisma.sale.findUnique({
      where: { id },
      include: { items: true, customer: true }
    });
  }

  static async completeSale(data: any) {
    return prisma.$transaction(async (tx) => {
      // 1. Resolve cashierId
      let cashierId = data.cashierId;
      if (cashierId) {
        const userExists = await tx.user.findUnique({ where: { id: cashierId } });
        if (!userExists) {
          const fallbackUser = await tx.user.findFirst();
          cashierId = fallbackUser ? fallbackUser.id : cashierId;
        }
      } else {
        const fallbackUser = await tx.user.findFirst();
        if (fallbackUser) cashierId = fallbackUser.id;
      }

      // 2. Decrement currentStock on tx.batch
      if (Array.isArray(data.items)) {
        for (const item of data.items) {
          if (item.batchId) {
            const batch = await tx.batch.findUnique({ where: { id: item.batchId } });
            if (batch) {
              const newStock = Math.max(0, batch.currentStock - Number(item.quantity || 0));
              await tx.batch.update({
                where: { id: item.batchId },
                data: {
                  currentStock: newStock,
                  status: newStock === 0 ? 'DEPLETED' : batch.status
                }
              });
            }
          }
        }
      }

      // 3. Create sale record with items
      const sale = await tx.sale.create({
        data: {
          invoiceNumber: data.invoiceNumber || `INV-${Date.now()}`,
          cashierId,
          customerId: data.customerId || null,
          subTotal: data.subTotal ?? 0,
          discountAmount: data.discountAmount ?? 0,
          taxAmount: data.taxAmount ?? 0,
          roundOff: data.roundOff ?? 0,
          grandTotal: data.grandTotal ?? 0,
          paidAmount: data.paidAmount ?? data.grandTotal ?? 0,
          changeGiven: data.changeGiven ?? 0,
          dueAmount: data.dueAmount ?? 0,
          status: 'COMPLETED',
          notes: data.notes || null,
          items: {
            create: (data.items || []).map((item: any) => ({
              productId: item.productId,
              batchId: item.batchId,
              quantity: Number(item.quantity || 0),
              unitMrp: Number(item.unitMrp || item.mrp || 0),
              unitSellingPrice: Number(item.unitSellingPrice || item.sellingPrice || item.unitMrp || 0),
              unitCostPrice: Number(item.unitCostPrice || item.unitPurchasePrice || 0),
              discountAmount: Number(item.discountAmount || 0),
              taxRate: Number(item.taxRate || 0),
              taxAmount: Number(item.taxAmount || 0),
              lineTotal: Number(item.lineTotal || 0),
              lineGrossProfit: Number(item.lineGrossProfit || 0),
            }))
          }
        },
        include: { items: true, customer: true }
      });

      return sale;
    });
  }
}

