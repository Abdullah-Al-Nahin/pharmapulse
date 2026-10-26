import { prisma } from '../server';

export class SaleService {
  static async getAllSales() {
    return prisma.sale.findMany({
      include: {
        items: {
          include: {
            product: true,
            batch: true,
          },
        },
        customer: true,
        cashier: {
          select: { id: true, fullName: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getSaleById(id: string) {
    return prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            batch: true,
          },
        },
        customer: true,
        cashier: {
          select: { id: true, fullName: true, username: true },
        },
      },
    });
  }

  static async completeSale(data: any) {
    return prisma.$transaction(async (tx) => {
      // 1. Resolve valid cashierId (by ID, fullName, or username, with safe fallback)
      let cashierId = data.cashierId;
      const matchedUser = cashierId
        ? await tx.user.findFirst({
            where: {
              OR: [
                { id: String(cashierId) },
                { fullName: { equals: String(cashierId), mode: 'insensitive' } },
                { username: { equals: String(cashierId), mode: 'insensitive' } },
              ],
            },
          })
        : null;

      if (matchedUser) {
        cashierId = matchedUser.id;
      } else {
        const fallbackUser = await tx.user.findFirst();
        if (fallbackUser) cashierId = fallbackUser.id;
      }

      // 2. Resolve valid customerId if provided
      let validCustomerId: string | null = null;
      if (data.customerId) {
        const cust = await tx.customer.findUnique({ where: { id: String(data.customerId) } });
        if (cust) validCustomerId = cust.id;
      }

      // 3. Resolve batches, decrement stock once atomically, and accumulate COGS
      const validSaleItems: any[] = [];
      let totalCogs = 0;

      if (Array.isArray(data.items)) {
        for (const item of data.items) {
          const qty = Number(item.quantity || 0);
          if (qty <= 0) continue;

          let batch =
            item.batchId && item.batchId !== 'unknown-batch'
              ? await tx.batch.findUnique({ where: { id: String(item.batchId) } })
              : null;

          if (!batch && item.productId && item.productId !== 'unknown-med') {
            batch = await tx.batch.findFirst({
              where: {
                productId: String(item.productId),
                currentStock: { gt: 0 },
                status: { not: 'QUARANTINED' },
              },
              orderBy: { expiryDate: 'asc' },
            });
          }

          if (!batch) {
            batch = await tx.batch.findFirst({ orderBy: { expiryDate: 'asc' } });
          }

          if (!batch) continue;

          const newStock = Math.max(0, batch.currentStock - qty);
          await tx.batch.update({
            where: { id: batch.id },
            data: {
              currentStock: newStock,
              status: newStock === 0 ? 'DEPLETED' : batch.status,
            },
          });

          const unitCost = Number(
            item.unitCostPrice || item.unitPurchasePrice || batch.purchasePrice || 0
          );
          const unitSelling = Number(
            item.unitSellingPrice || item.sellingPrice || batch.unitSellingPrice || 0
          );
          const unitMrp = Number(item.unitMrp || item.mrp || batch.mrp || unitSelling);
          const lineTotal = Number(item.lineTotal ?? unitSelling * qty);
          const itemCogs = unitCost * qty;
          totalCogs += itemCogs;

          validSaleItems.push({
            productId: batch.productId,
            batchId: batch.id,
            quantity: qty,
            unitMrp,
            unitSellingPrice: unitSelling,
            unitCostPrice: unitCost,
            discountAmount: Number(item.discountAmount || 0),
            taxRate: Number(item.taxRate || 0),
            taxAmount: Number(item.taxAmount || 0),
            lineTotal,
            lineGrossProfit: lineTotal - itemCogs,
          });
        }
      }

      // 4. Increment Customer outstandingBalance if sale has dueAmount > 0
      const dueAmount = Number(data.dueAmount ?? 0);
      if (validCustomerId && dueAmount > 0) {
        await tx.customer.update({
          where: { id: validCustomerId },
          data: { outstandingBalance: { increment: dueAmount } },
        });
      }

      // 5. Create Sale record with computed costOfGoodsSold
      return tx.sale.create({
        data: {
          invoiceNumber: data.invoiceNumber || `INV-${Date.now()}`,
          cashierId,
          customerId: validCustomerId,
          subTotal: data.subTotal ?? 0,
          discountAmount: data.discountAmount ?? 0,
          taxAmount: data.taxAmount ?? 0,
          roundOff: data.roundOff ?? 0,
          grandTotal: data.grandTotal ?? 0,
          costOfGoodsSold: totalCogs,
          paidAmount: data.paidAmount ?? Math.max(0, Number(data.grandTotal || 0) - dueAmount),
          changeGiven: data.changeGiven ?? 0,
          dueAmount,
          status: 'COMPLETED',
          notes: data.notes || null,
          items: {
            create: validSaleItems,
          },
        },
        include: {
          items: {
            include: {
              product: true,
              batch: true,
            },
          },
          customer: true,
          cashier: {
            select: { id: true, fullName: true, username: true },
          },
        },
      });
    });
  }
}
