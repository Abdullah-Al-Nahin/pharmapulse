import { Request, Response } from 'express';
import { prisma } from '../server';

export class BranchController {
  static async getAllBranches(_req: Request, res: Response) {
    try {
      const branches = await prisma.branch.findMany({
        orderBy: { createdAt: 'asc' }
      });

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

      const defaultMetrics = {
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
      };

      const branch = await prisma.branch.create({
        data: {
          id: newId,
          name,
          bnName: bnName || name,
          code,
          type: type || 'retail_branch',
          address: address || '',
          phone: phone || '',
          managerName: managerName || '',
          licenseNo: licenseNo || '',
          color: color || '#10b981',
          metrics: defaultMetrics,
        }
      });

      res.status(201).json(branch);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateBranch(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, bnName, code, address, phone, managerName, licenseNo, metrics } = req.body;

      await prisma.branch.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(bnName !== undefined && { bnName }),
          ...(code !== undefined && { code }),
          ...(address !== undefined && { address }),
          ...(phone !== undefined && { phone }),
          ...(managerName !== undefined && { managerName }),
          ...(licenseNo !== undefined && { licenseNo }),
          ...(metrics !== undefined && { metrics }),
        }
      });

      res.json({ success: true, message: 'Branch updated in database' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteBranch(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.branch.delete({ where: { id } });
      res.json({ success: true, message: 'Branch deleted from database' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
