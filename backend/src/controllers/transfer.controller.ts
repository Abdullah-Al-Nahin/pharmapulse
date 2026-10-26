import { Request, Response } from 'express';
import { prisma } from '../server';

export class TransferController {
  static async getAllTransfers(_req: Request, res: Response) {
    try {
      const transfers = await prisma.stockTransfer.findMany({
        orderBy: { createdAt: 'desc' }
      });

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

      const transferResult = await prisma.$transaction(async (tx) => {
        // 1. Create StockTransfer record
        const createdTransfer = await tx.stockTransfer.create({
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

        // 2. Decrement source batch and increment/create destination batch
        if (Array.isArray(items)) {
          for (const item of items) {
            const transferQty = Number(item.quantity || item.requestedQty || item.units || item.approvedQty || 0);
            if (transferQty <= 0) continue;

            const batchId = item.batchId;
            const batchNo = item.batchNumber;
            const prodId = item.productId || item.medicineId;

            // Find source batch
            let sourceBatch = null;
            if (batchId) {
              sourceBatch = await tx.batch.findUnique({ where: { id: batchId } });
            }
            if (!sourceBatch && prodId && batchNo) {
              sourceBatch = await tx.batch.findFirst({
                where: {
                  productId: prodId,
                  batchNumber: batchNo
                }
              });
            }
            if (!sourceBatch && batchNo) {
              sourceBatch = await tx.batch.findFirst({
                where: {
                  batchNumber: batchNo
                }
              });
            }

            if (sourceBatch) {
              // Decrement currentStock on source
              const newSourceStock = Math.max(0, sourceBatch.currentStock - transferQty);
              await tx.batch.update({
                where: { id: sourceBatch.id },
                data: {
                  currentStock: newSourceStock,
                  status: newSourceStock === 0 ? 'DEPLETED' : sourceBatch.status
                }
              });

              // Increment or create on destination branch
              const destBranchCondition = toBranchId ? { branchId: toBranchId } : { branchName: toBranchName || '' };
              const destBatch = await tx.batch.findFirst({
                where: {
                  productId: sourceBatch.productId,
                  batchNumber: sourceBatch.batchNumber,
                  ...destBranchCondition
                }
              });

              if (destBatch) {
                await tx.batch.update({
                  where: { id: destBatch.id },
                  data: {
                    currentStock: destBatch.currentStock + transferQty,
                    status: 'ACTIVE'
                  }
                });
              } else {
                await tx.batch.create({
                  data: {
                    id: `bat-dest-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    productId: sourceBatch.productId,
                    batchNumber: sourceBatch.batchNumber,
                    manufacturingDate: sourceBatch.manufacturingDate,
                    expiryDate: sourceBatch.expiryDate,
                    purchasePrice: sourceBatch.purchasePrice,
                    mrp: sourceBatch.mrp,
                    unitSellingPrice: sourceBatch.unitSellingPrice,
                    wholesalePrice: sourceBatch.wholesalePrice,
                    initialQuantity: transferQty,
                    currentStock: transferQty,
                    status: 'ACTIVE',
                    branchId: toBranchId || null,
                    branchName: toBranchName || null,
                    rackLocation: sourceBatch.rackLocation,
                    supplierId: sourceBatch.supplierId
                  }
                });
              }
            }
          }
        }

        return createdTransfer;
      });

      res.status(201).json({
        id: transferResult.id,
        transferNumber: transferResult.transferNumber,
        status: transferResult.status
      });
    } catch (error: any) {
      console.error('Error creating transfer:', error);
      res.status(500).json({ error: error.message });
    }
  }

}
