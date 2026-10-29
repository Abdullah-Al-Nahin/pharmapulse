import { Request, Response } from 'express';
import { prisma } from '../server';

export type PurgeScope =
  | 'full_database'
  | 'only_transactions'
  | 'only_sales_pos'
  | 'only_purchases_ledgers'
  | 'only_customer_dues'
  | 'only_stock'
  | 'stock_and_catalog'
  | 'expired_and_quarantined_stock'
  | 'stock_transfers_adjustments'
  | 'logs_last_day'
  | 'logs_last_week'
  | 'logs_last_month'
  | 'logs_older_than_30d'
  | 'logs_all'
  | 'transactions_last_day'
  | 'transactions_last_week'
  | 'transactions_last_month'
  | 'only_prescriptions'
  | 'non_admin_users';

export const getDatabaseStats = async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const [
      sales,
      saleReturns,
      heldSales,
      purchaseOrders,
      suppliers,
      products,
      batches,
      expiredBatches,
      quarantinedBatches,
      stockAdjustments,
      stockTransfers,
      prescriptions,
      customers,
      journalEntries,
      auditLogs,
      users,
      branches,
    ] = await Promise.all([
      prisma.sale.count().catch(() => 0),
      prisma.saleReturn.count().catch(() => 0),
      prisma.heldSale.count().catch(() => 0),
      prisma.purchaseOrder.count().catch(() => 0),
      prisma.supplier.count().catch(() => 0),
      prisma.product.count().catch(() => 0),
      prisma.batch.count().catch(() => 0),
      prisma.batch.count({
        where: { OR: [{ status: 'EXPIRED' }, { expiryDate: { lt: now } }] },
      }).catch(() => 0),
      prisma.batch.count({
        where: { status: 'QUARANTINED' },
      }).catch(() => 0),
      prisma.stockAdjustment.count().catch(() => 0),
      prisma.stockTransfer.count().catch(() => 0),
      prisma.prescription.count().catch(() => 0),
      prisma.customer.count().catch(() => 0),
      prisma.journalEntry.count().catch(() => 0),
      prisma.auditLog.count().catch(() => 0),
      prisma.user.count().catch(() => 0),
      prisma.branch.count().catch(() => 0),
    ]);

    res.json({
      sales,
      saleReturns,
      heldSales,
      purchaseOrders,
      suppliers,
      products,
      batches,
      expiredBatches,
      quarantinedBatches,
      stockAdjustments,
      stockTransfers,
      prescriptions,
      customers,
      journalEntries,
      auditLogs,
      users,
      branches,
    });
  } catch (error) {
    console.error('Error fetching database stats:', error);
    res.status(500).json({ error: 'Failed to fetch database stats' });
  }
};

export const purgeDatabase = async (req: Request, res: Response) => {
  try {
    const { scope, requesterRole } = req.body as {
      scope: PurgeScope;
      requesterRole?: string;
    };

    if (requesterRole && requesterRole !== 'super_admin' && requesterRole !== 'Super Admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only Super Admin can execute database purge operations.',
      });
    }

    const now = Date.now();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    let summary = '';

    switch (scope) {
      case 'full_database': {
        await prisma.$transaction([
          prisma.journalLine.deleteMany({}),
          prisma.journalEntry.deleteMany({}),
          prisma.payment.deleteMany({}),
          prisma.expense.deleteMany({}),
          prisma.cashShift.deleteMany({}),
          prisma.saleReturnItem.deleteMany({}),
          prisma.saleReturn.deleteMany({}),
          prisma.saleItem.deleteMany({}),
          prisma.sale.deleteMany({}),
          prisma.heldSale.deleteMany({}),
          prisma.loyaltyTransaction.deleteMany({}),
          prisma.prescriptionItem.deleteMany({}),
          prisma.prescription.deleteMany({}),
          prisma.purchaseOrderItem.deleteMany({}),
          prisma.purchaseOrder.deleteMany({}),
          prisma.stockAdjustment.deleteMany({}),
          prisma.stockTransfer.deleteMany({}),
          prisma.batch.deleteMany({}),
          prisma.unitConversion.deleteMany({}),
          prisma.product.deleteMany({}),
          prisma.supplier.deleteMany({}),
          prisma.customer.deleteMany({}),
          prisma.auditLog.deleteMany({}),
        ]);
        summary = 'Full database cleared (all transactions, stock, batches, catalog, customers, suppliers, prescriptions, and logs wiped). Super Admin preserved.';
        break;
      }

      case 'only_transactions': {
        await prisma.$transaction([
          prisma.journalLine.deleteMany({}),
          prisma.journalEntry.deleteMany({}),
          prisma.payment.deleteMany({}),
          prisma.expense.deleteMany({}),
          prisma.cashShift.deleteMany({}),
          prisma.saleReturnItem.deleteMany({}),
          prisma.saleReturn.deleteMany({}),
          prisma.saleItem.deleteMany({}),
          prisma.sale.deleteMany({}),
          prisma.heldSale.deleteMany({}),
          prisma.loyaltyTransaction.deleteMany({}),
          prisma.purchaseOrderItem.deleteMany({}),
          prisma.purchaseOrder.deleteMany({}),
          prisma.customer.updateMany({
            data: { currentBalance: 0, loyaltyPoints: 0 },
          }),
          prisma.supplier.updateMany({
            data: { currentBalance: 0 },
          }),
        ]);
        summary = 'All financial transactions, POS sales, returns, purchase orders, and ledger balances cleared. Stock and catalog preserved.';
        break;
      }

      case 'only_sales_pos': {
        await prisma.$transaction([
          prisma.payment.deleteMany({}),
          prisma.saleReturnItem.deleteMany({}),
          prisma.saleReturn.deleteMany({}),
          prisma.saleItem.deleteMany({}),
          prisma.sale.deleteMany({}),
          prisma.heldSale.deleteMany({}),
        ]);
        summary = 'All POS sales invoices, held orders, and sales returns cleared.';
        break;
      }

      case 'only_purchases_ledgers': {
        await prisma.$transaction([
          prisma.purchaseOrderItem.deleteMany({}),
          prisma.purchaseOrder.deleteMany({}),
          prisma.supplier.updateMany({
            data: { currentBalance: 0 },
          }),
        ]);
        summary = 'All purchase orders, GRN records, and supplier payable balances cleared.';
        break;
      }

      case 'only_customer_dues': {
        await prisma.$transaction([
          prisma.loyaltyTransaction.deleteMany({}),
          prisma.customer.updateMany({
            data: { currentBalance: 0, loyaltyPoints: 0 },
          }),
        ]);
        summary = 'All customer due balances and loyalty points reset to zero.';
        break;
      }

      case 'only_stock': {
        await prisma.$transaction([
          prisma.stockAdjustment.deleteMany({}),
          prisma.stockTransfer.deleteMany({}),
          prisma.saleReturnItem.deleteMany({}),
          prisma.saleItem.deleteMany({}),
          prisma.purchaseOrderItem.deleteMany({}),
          prisma.batch.deleteMany({}),
        ]);
        summary = 'All batch stock, FEFO lots, adjustments, and transfers cleared. Product master catalog preserved.';
        break;
      }

      case 'stock_and_catalog': {
        await prisma.$transaction([
          prisma.stockAdjustment.deleteMany({}),
          prisma.stockTransfer.deleteMany({}),
          prisma.saleReturnItem.deleteMany({}),
          prisma.saleItem.deleteMany({}),
          prisma.purchaseOrderItem.deleteMany({}),
          prisma.prescriptionItem.deleteMany({}),
          prisma.batch.deleteMany({}),
          prisma.unitConversion.deleteMany({}),
          prisma.product.deleteMany({}),
        ]);
        summary = 'All batch stock and medicine master catalog completely cleared.';
        break;
      }

      case 'expired_and_quarantined_stock': {
        const nowDate = new Date();
        const expiredOrQuarantined = await prisma.batch.findMany({
          where: {
            OR: [
              { status: 'EXPIRED' },
              { status: 'QUARANTINED' },
              { expiryDate: { lt: nowDate } },
            ],
          },
          select: { id: true },
        });
        const batchIds = expiredOrQuarantined.map((b: { id: string }) => b.id);
        if (batchIds.length > 0) {
          await prisma.$transaction([
            prisma.stockAdjustment.deleteMany({ where: { batchId: { in: batchIds } } }),
            prisma.saleReturnItem.deleteMany({ where: { batchId: { in: batchIds } } }),
            prisma.saleItem.deleteMany({ where: { batchId: { in: batchIds } } }),
            prisma.purchaseOrderItem.deleteMany({ where: { batchId: { in: batchIds } } }),
            prisma.batch.deleteMany({ where: { id: { in: batchIds } } }),
          ]);
        }
        summary = `Purged ${batchIds.length} expired/quarantined batch(es) from database.`;
        break;
      }

      case 'stock_transfers_adjustments': {
        await prisma.$transaction([
          prisma.stockAdjustment.deleteMany({}),
          prisma.stockTransfer.deleteMany({}),
        ]);
        summary = 'All inter-branch transfers (IBT) and stock adjustment records cleared.';
        break;
      }

      case 'logs_last_day': {
        const deleted = await prisma.auditLog.deleteMany({
          where: { createdAt: { gte: oneDayAgo } },
        });
        summary = `Cleared ${deleted.count} audit log(s) from the last 24 hours.`;
        break;
      }

      case 'logs_last_week': {
        const deleted = await prisma.auditLog.deleteMany({
          where: { createdAt: { gte: oneWeekAgo } },
        });
        summary = `Cleared ${deleted.count} audit log(s) from the last 7 days.`;
        break;
      }

      case 'logs_last_month': {
        const deleted = await prisma.auditLog.deleteMany({
          where: { createdAt: { gte: oneMonthAgo } },
        });
        summary = `Cleared ${deleted.count} audit log(s) from the last 30 days.`;
        break;
      }

      case 'logs_older_than_30d': {
        const deleted = await prisma.auditLog.deleteMany({
          where: { createdAt: { lt: oneMonthAgo } },
        });
        summary = `Cleared ${deleted.count} archived audit log(s) older than 30 days.`;
        break;
      }

      case 'logs_all': {
        const deleted = await prisma.auditLog.deleteMany({});
        summary = `Cleared all ${deleted.count} audit log(s) from database.`;
        break;
      }

      case 'transactions_last_day':
      case 'transactions_last_week':
      case 'transactions_last_month': {
        const cutoff =
          scope === 'transactions_last_day'
            ? oneDayAgo
            : scope === 'transactions_last_week'
            ? oneWeekAgo
            : oneMonthAgo;

        const targetSales = await prisma.sale.findMany({
          where: { createdAt: { gte: cutoff } },
          select: { id: true },
        });
        const saleIds = targetSales.map((s: { id: string }) => s.id);

        const targetReturns = await prisma.saleReturn.findMany({
          where: { createdAt: { gte: cutoff } },
          select: { id: true },
        });
        const returnIds = targetReturns.map((r: { id: string }) => r.id);

        await prisma.$transaction([
          ...(saleIds.length > 0
            ? [
                prisma.payment.deleteMany({ where: { saleId: { in: saleIds } } }),
                prisma.saleReturnItem.deleteMany({ where: { saleReturn: { originalSaleId: { in: saleIds } } } }),
                prisma.saleReturn.deleteMany({ where: { originalSaleId: { in: saleIds } } }),
                prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } }),
                prisma.sale.deleteMany({ where: { id: { in: saleIds } } }),
              ]
            : []),
          ...(returnIds.length > 0
            ? [
                prisma.saleReturnItem.deleteMany({ where: { saleReturnId: { in: returnIds } } }),
                prisma.saleReturn.deleteMany({ where: { id: { in: returnIds } } }),
              ]
            : []),
          prisma.expense.deleteMany({ where: { createdAt: { gte: cutoff } } }),
        ]);
        summary = `Cleared ${saleIds.length} sale(s) and ${returnIds.length} return(s) within selected time window.`;
        break;
      }

      case 'only_prescriptions': {
        await prisma.$transaction([
          prisma.prescriptionItem.deleteMany({}),
          prisma.prescription.deleteMany({}),
        ]);
        summary = 'All digital prescriptions and Rx queue records cleared.';
        break;
      }

      case 'non_admin_users': {
        const deleted = await prisma.user.deleteMany({
          where: {
            NOT: [
              { username: 'admin' },
              { email: 'admin' },
              { role: { name: 'super_admin' } },
            ],
          },
        });
        summary = `Removed ${deleted.count} non-Super-Admin staff account(s). Super Admin preserved.`;
        break;
      }

      default:
        return res.status(400).json({
          success: false,
          message: `Unknown purge scope: ${scope}`,
        });
    }

    res.json({
      success: true,
      scope,
      message: summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Database purge error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute database purge operation',
      details: error?.message,
    });
  }
};
