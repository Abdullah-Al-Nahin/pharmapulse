import { Request, Response } from 'express';
import { prisma } from '../server';

export class TransferController {
  static async getAllTransfers(_req: Request, res: Response) {
    try {
      const transfers = await prisma.stockTransfer.findMany({
        orderBy: { createdAt: 'desc' }
      });

      const mapped = transfers.map((t) => ({
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

      await prisma.stockTransfer.create({
        data: {
          id: newId,
          transferNumber,
          transferType: transferType || 'branch_to_branch',
          fromBranchId: fromBranchId || null,
          fromBranchName: fromBranchName || null,
          toBranchId: toBranchId || null,
          toBranchName: toBranchName || null,
          status: 'received',
          totalUnits: Number(totalUnits || 0),
          totalValue: Number(totalValue || 0),
          isColdChain: Boolean(isColdChain),
          challanNumber: challanNumber || `CH-${Date.now().toString().slice(-4)}`,
          requestedBy: requestedBy || 'Pharmacist',
          items: items || [],
          notes: notes || ''
        }
      });

      res.status(201).json({
        id: newId,
        transferNumber,
        status: 'received'
      });
    } catch (error: any) {
      console.error('Error creating transfer:', error);
      res.status(500).json({ error: error.message });
    }
  }
}
