import { prisma } from '../server';
import { Decimal } from '@prisma/client/runtime/library';

function toNumber(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

/**
 * Telemetry API for Mother ERP rollup.
 * Returns aggregated financial KPIs for cross-branch economic dashboards.
 */
export class TelemetryService {
  static async getSnapshot(dateFrom?: string, dateTo?: string) {
    const from = dateFrom ? new Date(dateFrom) : new Date(new Date().setDate(1)); // MTD default
    const to = dateTo ? new Date(dateTo) : new Date();

    const [salesAgg, purchasesAgg, lowStockCount, expiringCount, pendingPOCount] = await Promise.all([
      // Total Revenue & COGS for date range
      prisma.sale.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: from, lte: to }
        },
        _sum: {
          grandTotal: true,
          costOfGoodsSold: true,
          discountAmount: true,
          taxAmount: true,
        },
        _count: { id: true }
      }),

      // Total Purchases for date range
      prisma.purchaseOrder.aggregate({
        where: {
          status: 'RECEIVED',
          receivedDate: { gte: from, lte: to }
        },
        _sum: { grandTotal: true },
        _count: { id: true }
      }),

      // Low Stock Alert Count
      prisma.batch.count({
        where: {
          status: 'ACTIVE',
          currentStock: { lt: 20 }
        }
      }),

      // Near-Expiry Batches (next 90 days)
      prisma.batch.count({
        where: {
          status: 'ACTIVE',
          expiryDate: {
            lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            gte: new Date()
          }
        }
      }),

      // Pending Supplier Payables
      prisma.purchaseOrder.count({
        where: { paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] } }
      }),
    ]);

    const revenue = toNumber(salesAgg._sum.grandTotal);
    const cogs = toNumber(salesAgg._sum.costOfGoodsSold);
    const grossProfit = revenue - cogs;
    const grossProfitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const totalPurchases = toNumber(purchasesAgg._sum.grandTotal);

    return {
      module: 'pharmacy',
      currency: 'BDT',
      period: {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
      },
      financials: {
        revenue: Math.round(revenue * 100) / 100,
        cogs: Math.round(cogs * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        grossProfitMargin: Math.round(grossProfitMargin * 100) / 100,
        totalPurchases: Math.round(totalPurchases * 100) / 100,
        netIncome: Math.round((grossProfit - totalPurchases) * 100) / 100,
        totalDiscountsGiven: Math.round(toNumber(salesAgg._sum.discountAmount) * 100) / 100,
        totalTaxCollected: Math.round(toNumber(salesAgg._sum.taxAmount) * 100) / 100,
      },
      operations: {
        totalSalesCount: salesAgg._count.id,
        totalPurchaseOrdersCount: purchasesAgg._count.id,
        lowStockAlerts: lowStockCount,
        nearExpiryBatches: expiringCount,
        pendingSupplierPayables: pendingPOCount,
      },
    };
  }
}
