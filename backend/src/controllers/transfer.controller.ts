import { Request, Response } from 'express';
import { prisma } from '../server';

export class TransferController {
  static async getAllTransfers(_req: Request, res: Response) {
    try {
      const transfers: any = await prisma.$queryRaw`
        SELECT * FROM "stock_transfers" ORDER BY "createdAt" DESC
      `;

      const mapped = transfers.map((t: any) => ({
        id: t.id,
        transferNumber: t.transferNumber,
        transferType: t.transferType || 'branch_to_branch',
        fromBranchId: t.fromBranchId,
        fromBranchName: t.fromBranchName,
        toBranchId: t.toBranchId,
        toBranchName: t.toBranchName,
        status: t.status || 'received',
        totalUnits: Number(t.totalUnits || 0),
        totalValue: Number(t.totalValue || 0),
        isColdChain: Boolean(t.isColdChain),
        transitTemperature: t.transitTemperature || 'Ambient',
        challanNumber: t.challanNumber || '',
        requestedBy: t.requestedBy || 'Branch In-Charge',
        dispatchedBy: t.dispatchedBy || 'Central Logistics',
        receivedBy: t.receivedBy || 'Pharmacist',
        requestedAt: t.requestedAt ? new Date(t.requestedAt).toISOString() : new Date().toISOString(),
        dispatchedAt: t.dispatchedAt ? new Date(t.dispatchedAt).toISOString() : null,
        receivedAt: t.receivedAt ? new Date(t.receivedAt).toISOString() : null,
        items: typeof t.items === 'string' ? JSON.parse(t.items) : (t.items || []),
        notes: t.notes || ''
      }));

      res.json(mapped);
    } catch (error: any) {
      console.error('Error fetching transfers:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async createTransfer(req: Request, res: Response) {
    try {
      const {
        transferType,
        fromBranchId,
        fromBranchName,
        toBranchId,
        toBranchName,
        totalUnits,
        totalValue,
        isColdChain,
        challanNumber,
        requestedBy,
        items,
        notes
      } = req.body;

      const newId = `trf-${Date.now()}`;
      const transferNumber = `TRF-${new Date().toISOString().slice(0, 4)}-${String(Math.floor(1000 + Math.random() * 9000))}`;

      await prisma.$executeRawUnsafe(`
        INSERT INTO "stock_transfers" (
          "id", "transferNumber", "transferType", "fromBranchId", "fromBranchName",
          "toBranchId", "toBranchName", "status", "totalUnits", "totalValue",
          "isColdChain", "challanNumber", "requestedBy", "items", "notes", "createdAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 'received', $8, $9, $10, $11, $12, $13::jsonb, $14, NOW()
        )
      `, newId, transferNumber, transferType || 'branch_to_branch', fromBranchId, fromBranchName, toBranchId, toBranchName, Number(totalUnits || 0), Number(totalValue || 0), Boolean(isColdChain), challanNumber || `CH-${Date.now().toString().slice(-4)}`, requestedBy || 'Pharmacist', JSON.stringify(items || []), notes || '');

      res.status(201).json({
        id: newId,
        transferNumber,
        status: 'received'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
