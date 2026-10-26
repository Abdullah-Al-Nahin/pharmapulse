import { Request, Response } from 'express';
import { prisma } from '../server';

export class AdjustmentController {
  static async getAllAdjustments(_req: Request, res: Response) {
    try {
      const adjustments = await prisma.stockAdjustment.findMany({
        include: {
          batch: {
            include: {
              product: true
            }
          },
          user: true
        },
        orderBy: { createdAt: 'desc' }
      });

      // Map to frontend StockAdjustment model
      const mapped = adjustments.map((a: any) => ({
        id: a.id,
        adjustmentNumber: a.adjustmentNumber,
        medicineId: a.batch?.productId,
        medicineName: a.batch?.product?.name || 'Unknown Medicine',
        genericName: 'Formulation',
        batchId: a.batchId,
        batchNumber: a.batch?.batchNumber || 'N/A',
        expiryDate: a.batch?.expiryDate ? a.batch.expiryDate.toISOString().split('T')[0] : 'N/A',
        rackLocation: a.batch?.rackLocation || 'Rack A-01',
        type: a.type.toLowerCase(),
        direction: a.direction,
        quantityAdjusted: a.quantityAdjusted,
        quantityChange: a.quantityChange,
        previousStock: a.previousStock,
        newStock: a.newStock,
        unitCost: Number(a.unitCost),
        totalMonetaryValue: Number(a.totalMonetaryValue),
        reason: a.reason,
        notes: a.notes,
        status: a.status.toLowerCase(),
        requiresApproval: a.requiresApproval,
        requestedBy: {
          userId: a.userId,
          userName: a.user?.fullName || a.user?.username || 'Staff',
          userRole: 'Staff'
        },
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString()
      }));

      res.json(mapped);
    } catch (error: any) {
      console.error('Error fetching adjustments:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async createAdjustment(req: Request, res: Response) {
    try {
      const { batchId, type, direction, quantityAdjusted, reason, notes, userId } = req.body;
      const batch = await prisma.batch.findUnique({ where: { id: batchId } });
      if (!batch) {
        res.status(404).json({ error: 'Batch not found' });
        return;
      }

      const count = await prisma.stockAdjustment.count();
      const adjustmentNumber = `ADJ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(3, '0')}`;
      const prevStock = batch.currentStock;
      const qtyChange = direction === 'increase' ? Math.abs(quantityAdjusted) : -Math.abs(quantityAdjusted);
      const newStock = Math.max(0, prevStock + qtyChange);
      const unitCost = Number(batch.purchasePrice || 0);
      const totalMonetaryValue = unitCost * Math.abs(quantityAdjusted);

      // Resolve user
      let validUserId = userId;
      if (!validUserId) {
        const u = await prisma.user.findFirst();
        validUserId = u?.id;
      }

      const isPending = Boolean(req.body.requiresApproval);

      const adj = await prisma.stockAdjustment.create({
        data: {
          adjustmentNumber,
          batchId,
          userId: validUserId,
          type: (type || 'PHYSICAL_DAMAGE').toUpperCase(),
          direction: direction || 'decrease',
          quantityAdjusted: Math.abs(quantityAdjusted),
          quantityChange: qtyChange,
          previousStock: prevStock,
          newStock,
          unitCost,
          totalMonetaryValue,
          status: isPending ? 'PENDING_APPROVAL' : 'APPROVED',
          requiresApproval: isPending,
          reason: reason || 'Routine inventory audit',
          notes: notes || null
        }
      });

      // Update active batch stock only if not pending approval
      if (!isPending) {
        await prisma.batch.update({
          where: { id: batchId },
          data: { currentStock: newStock }
        });
      }

      res.status(201).json(adj);
    } catch (error: any) {
      console.error('Error creating adjustment:', error);
      res.status(500).json({ error: error.message });
    }
  }
}
