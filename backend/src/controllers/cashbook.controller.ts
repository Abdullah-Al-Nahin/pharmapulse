import { Request, Response } from 'express';
import { prisma } from '../server';

export class CashbookController {
  // GET /api/cashbook/vouchers
  static async getVouchers(req: Request, res: Response) {
    try {
      const { date, branchId } = req.query as { date?: string; branchId?: string };
      const where: any = {};
      if (date) where.voucherDate = date;
      if (branchId && branchId !== 'all') where.branchId = branchId;

      const vouchers = await prisma.cashbookVoucher.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      res.json(
        vouchers.map((v) => ({
          ...v,
          amount: Number(v.amount || 0),
        }))
      );
    } catch (error: any) {
      console.error('Failed to fetch cashbook vouchers:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch cashbook vouchers' });
    }
  }

  // POST /api/cashbook/vouchers
  static async createVoucher(req: Request, res: Response) {
    try {
      const {
        id,
        voucherNo,
        voucherDate,
        voucherType,
        direction,
        category,
        amount,
        partyName,
        partyId,
        referenceNo,
        paymentMethod,
        description,
        branchId,
        branchName,
        createdBy,
      } = req.body;

      const numericAmount = Number(amount);
      if (!numericAmount || numericAmount <= 0) {
        return res.status(400).json({ error: 'Voucher amount must be greater than zero' });
      }

      const resolvedId = id || `cbv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const resolvedNo = voucherNo || `VCH-${Date.now().toString().slice(-6)}`;

      const saved = await prisma.cashbookVoucher.upsert({
        where: { voucherNo: resolvedNo },
        create: {
          id: resolvedId,
          voucherNo: resolvedNo,
          voucherDate: voucherDate || new Date().toISOString().split('T')[0],
          voucherType: voucherType || 'SHOP_EXPENSE',
          direction: direction || 'OUT',
          category: category || 'Shop Expense',
          amount: numericAmount,
          partyName: partyName || 'Counter Cash',
          partyId: partyId || null,
          referenceNo: referenceNo || null,
          paymentMethod: paymentMethod || 'CASH',
          description: description || 'Daily cashbook voucher',
          branchId: branchId || 'HQ-MAIN',
          branchName: branchName || 'Main Branch',
          createdBy: createdBy || 'Cashier',
        },
        update: {
          voucherDate: voucherDate || new Date().toISOString().split('T')[0],
          voucherType: voucherType || 'SHOP_EXPENSE',
          direction: direction || 'OUT',
          category: category || 'Shop Expense',
          amount: numericAmount,
          partyName: partyName || 'Counter Cash',
          partyId: partyId || null,
          referenceNo: referenceNo || null,
          paymentMethod: paymentMethod || 'CASH',
          description: description || 'Daily cashbook voucher',
          branchId: branchId || 'HQ-MAIN',
          branchName: branchName || 'Main Branch',
        },
      });

      res.status(201).json({ ...saved, amount: Number(saved.amount) });
    } catch (error: any) {
      console.error('Failed to create cashbook voucher:', error);
      res.status(500).json({ error: error.message || 'Failed to create cashbook voucher' });
    }
  }

  // DELETE /api/cashbook/vouchers/:id
  static async deleteVoucher(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.cashbookVoucher.delete({ where: { id } }).catch(async () => {
        await prisma.cashbookVoucher.delete({ where: { voucherNo: id } });
      });
      res.json({ success: true, id });
    } catch (error: any) {
      console.error('Failed to delete cashbook voucher:', error);
      res.status(500).json({ error: error.message || 'Failed to delete cashbook voucher' });
    }
  }

  // GET /api/cashbook/daily-closings
  static async getDailyClosings(req: Request, res: Response) {
    try {
      const { date, branchId } = req.query as { date?: string; branchId?: string };
      const where: any = {};
      if (date) where.cashbookDate = date;
      if (branchId && branchId !== 'all') where.branchId = branchId;

      const closings = await prisma.cashbookDailyClosing.findMany({
        where,
        orderBy: { cashbookDate: 'desc' },
      });

      res.json(
        closings.map((c) => ({
          ...c,
          openingCash: Number(c.openingCash || 0),
          posCashSales: Number(c.posCashSales || 0),
          dueAndMiscCashIn: Number(c.dueAndMiscCashIn || 0),
          dailyShopExpense: Number(c.dailyShopExpense || 0),
          supplierCashPaid: Number(c.supplierCashPaid || 0),
          expectedClosingCash: Number(c.expectedClosingCash || 0),
          countedPhysicalCash: Number(c.countedPhysicalCash || 0),
          variance: Number(c.variance || 0),
          vaultTransfer: Number(c.vaultTransfer || 0),
          carryForwardFloat: Number(c.carryForwardFloat || 0),
        }))
      );
    } catch (error: any) {
      console.error('Failed to fetch daily closings:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch daily closings' });
    }
  }

  // PUT /api/cashbook/opening-cash
  static async upsertOpeningCash(req: Request, res: Response) {
    try {
      const { cashbookDate, branchId, branchName, openingCash } = req.body;
      const dateStr = cashbookDate || new Date().toISOString().split('T')[0];
      const bId = branchId || 'HQ-MAIN';
      const val = Math.max(0, Number(openingCash ?? 15000));

      const record = await prisma.cashbookDailyClosing.upsert({
        where: {
          cashbookDate_branchId: {
            cashbookDate: dateStr,
            branchId: bId,
          },
        },
        create: {
          id: `cls-${dateStr}-${bId}`,
          cashbookDate: dateStr,
          branchId: bId,
          branchName: branchName || 'Main Branch',
          openingCash: val,
          status: 'OPEN',
        },
        update: {
          openingCash: val,
          ...(branchName ? { branchName } : {}),
        },
      });

      res.json({
        ...record,
        openingCash: Number(record.openingCash),
      });
    } catch (error: any) {
      console.error('Failed to save opening cash:', error);
      res.status(500).json({ error: error.message || 'Failed to save opening cash' });
    }
  }

  // POST /api/cashbook/close-day
  static async closeDailyCashbook(req: Request, res: Response) {
    try {
      const {
        cashbookDate,
        branchId,
        branchName,
        openingCash,
        posCashSales,
        dueAndMiscCashIn,
        dailyShopExpense,
        supplierCashPaid,
        expectedClosingCash,
        countedPhysicalCash,
        variance,
        vaultTransfer,
        carryForwardFloat,
        denominations,
        status,
        closedBy,
        notes,
      } = req.body;

      const dateStr = cashbookDate || new Date().toISOString().split('T')[0];
      const bId = branchId || 'HQ-MAIN';

      const record = await prisma.cashbookDailyClosing.upsert({
        where: {
          cashbookDate_branchId: {
            cashbookDate: dateStr,
            branchId: bId,
          },
        },
        create: {
          id: `cls-${dateStr}-${bId}`,
          cashbookDate: dateStr,
          branchId: bId,
          branchName: branchName || 'Main Branch',
          openingCash: Number(openingCash || 0),
          posCashSales: Number(posCashSales || 0),
          dueAndMiscCashIn: Number(dueAndMiscCashIn || 0),
          dailyShopExpense: Number(dailyShopExpense || 0),
          supplierCashPaid: Number(supplierCashPaid || 0),
          expectedClosingCash: Number(expectedClosingCash || 0),
          countedPhysicalCash: Number(countedPhysicalCash || 0),
          variance: Number(variance || 0),
          vaultTransfer: Number(vaultTransfer || 0),
          carryForwardFloat: Number(carryForwardFloat || 0),
          denominations: denominations || {},
          status: status || 'BALANCED',
          closedBy: closedBy || 'Cashier',
          notes: notes || null,
          closedAt: new Date(),
        },
        update: {
          branchName: branchName || undefined,
          openingCash: Number(openingCash || 0),
          posCashSales: Number(posCashSales || 0),
          dueAndMiscCashIn: Number(dueAndMiscCashIn || 0),
          dailyShopExpense: Number(dailyShopExpense || 0),
          supplierCashPaid: Number(supplierCashPaid || 0),
          expectedClosingCash: Number(expectedClosingCash || 0),
          countedPhysicalCash: Number(countedPhysicalCash || 0),
          variance: Number(variance || 0),
          vaultTransfer: Number(vaultTransfer || 0),
          carryForwardFloat: Number(carryForwardFloat || 0),
          denominations: denominations || {},
          status: status || 'BALANCED',
          closedBy: closedBy || 'Cashier',
          notes: notes || null,
          closedAt: new Date(),
        },
      });

      res.json({
        ...record,
        openingCash: Number(record.openingCash),
        posCashSales: Number(record.posCashSales),
        dueAndMiscCashIn: Number(record.dueAndMiscCashIn),
        dailyShopExpense: Number(record.dailyShopExpense),
        supplierCashPaid: Number(record.supplierCashPaid),
        expectedClosingCash: Number(record.expectedClosingCash),
        countedPhysicalCash: Number(record.countedPhysicalCash),
        variance: Number(record.variance),
        vaultTransfer: Number(record.vaultTransfer),
        carryForwardFloat: Number(record.carryForwardFloat),
      });
    } catch (error: any) {
      console.error('Failed to close daily cashbook:', error);
      res.status(500).json({ error: error.message || 'Failed to close daily cashbook' });
    }
  }
}
