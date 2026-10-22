import { Request, Response } from 'express';
import { prisma } from '../server';

export class BranchController {
  static async getAllBranches(_req: Request, res: Response) {
    try {
      const branches: any = await prisma.$queryRaw`
        SELECT * FROM "branches" ORDER BY "createdAt" ASC
      `;

      // Map to frontend BranchInfo
      const mapped = branches.map((b: any) => ({
        id: b.id,
        name: b.name,
        bnName: b.bnName,
        code: b.code,
        type: b.type || 'retail_branch',
        address: b.address || '',
        phone: b.phone || '',
        managerName: b.managerName || '',
        licenseNo: b.licenseNo || '',
        color: b.color || '#10b981',
        metrics: typeof b.metrics === 'string' ? JSON.parse(b.metrics) : (b.metrics || {
          stockCount: 0,
          stockValue: 0,
          todaySales: 0,
          monthSales: 0,
          monthlyPurchase: 0,
          cashBalance: 0,
          monthlyExpense: 0,
          monthlyProfit: 0,
          profitMargin: 0,
          staffCount: 1,
          activeSuppliers: 5,
          registeredCustomers: 10,
        })
      }));

      res.json(mapped);
    } catch (error: any) {
      console.error('Error fetching branches:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async createBranch(req: Request, res: Response) {
    try {
      const { name, bnName, code, type, address, phone, managerName, licenseNo, color } = req.body;
      const newId = `br-${Date.now()}`;

      const defaultMetrics = JSON.stringify({
        stockCount: 0,
        stockValue: 0,
        todaySales: 0,
        monthSales: 0,
        monthlyPurchase: 0,
        cashBalance: 0,
        monthlyExpense: 0,
        monthlyProfit: 0,
        profitMargin: 0,
        staffCount: 1,
        activeSuppliers: 0,
        registeredCustomers: 0,
      });

      await prisma.$executeRawUnsafe(`
        INSERT INTO "branches" ("id", "name", "bnName", "code", "type", "address", "phone", "managerName", "licenseNo", "color", "metrics", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW())
      `, newId, name, bnName || name, code, type || 'retail_branch', address || '', phone || '', managerName || '', licenseNo || '', color || '#10b981', defaultMetrics);

      res.status(201).json({
        id: newId,
        name,
        bnName,
        code,
        type,
        address,
        phone,
        managerName,
        licenseNo,
        color
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateBranch(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, bnName, code, address, phone, managerName, licenseNo, metrics } = req.body;

      await prisma.$executeRawUnsafe(`
        UPDATE "branches"
        SET
          "name" = COALESCE($2, "name"),
          "bnName" = COALESCE($3, "bnName"),
          "code" = COALESCE($4, "code"),
          "address" = COALESCE($5, "address"),
          "phone" = COALESCE($6, "phone"),
          "managerName" = COALESCE($7, "managerName"),
          "licenseNo" = COALESCE($8, "licenseNo"),
          "metrics" = COALESCE($9::jsonb, "metrics"),
          "updatedAt" = NOW()
        WHERE "id" = $1
      `, id, name, bnName, code, address, phone, managerName, licenseNo, metrics ? JSON.stringify(metrics) : null);

      res.json({ success: true, message: 'Branch updated in database' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteBranch(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.$executeRawUnsafe(`DELETE FROM "branches" WHERE "id" = $1`, id);
      res.json({ success: true, message: 'Branch deleted from database' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
