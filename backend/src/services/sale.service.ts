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
    // In a real application, this should be wrapped in a transaction
    // 1. Decrement batch stock
    // 2. Save Sale
    // 3. Post Accounting Entries
    // For now, we simulate the sale creation
    return prisma.$transaction(async (tx) => {
      // Logic for reducing stock...
      const sale = await tx.sale.create({
        data: {
          invoiceNumber: data.invoiceNumber,
          cashierId: data.cashierId,
          subTotal: data.subTotal,
          grandTotal: data.grandTotal,
          status: 'COMPLETED',
          items: {
            create: data.items.map((item: any) => ({
              productId: item.productId,
              batchId: item.batchId,
              quantity: item.quantity,
              unitMrp: item.unitMrp,
              unitSellingPrice: item.unitSellingPrice,
              unitCostPrice: item.unitCostPrice,
              lineTotal: item.lineTotal,
              lineGrossProfit: item.lineGrossProfit,
            }))
          }
        },
        include: { items: true }
      });
      return sale;
    });
  }
}
