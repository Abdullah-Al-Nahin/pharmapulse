import { prisma } from '../server';

export class BatchService {
  static async getAllBatches(opts?: { productId?: string; status?: string; skip?: number; take?: number }) {
    const { productId, status, skip = 0, take = 200 } = opts || {};
    return prisma.batch.findMany({
      where: {
        ...(productId && { productId }),
        ...(status && { status: status as any }),
      },
      include: {
        product: { include: { generic: true, manufacturer: true, category: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { expiryDate: 'asc' },
      skip,
      take,
    });
  }

  static async getBatchesForMedicine(productId: string) {
    return prisma.batch.findMany({
      where: { productId },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });
  }

  static async getFefoBatchForMedicine(productId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const withStock = await prisma.batch.findMany({
      where: {
        productId,
        currentStock: { gt: 0 },
        status: { notIn: ['QUARANTINED', 'RECALLED'] },
      },
      orderBy: { expiryDate: 'asc' },
    });

    if (withStock.length === 0) {
      return { batch: null, hasStock: false, allStockExpired: false, expiredBatchesCount: 0, nearestExpiryDays: null };
    }

    const unexpired = withStock.filter((b) => b.expiryDate > today && b.status !== 'EXPIRED');
    const expiredCount = withStock.length - unexpired.length;

    if (unexpired.length === 0) {
      return { batch: null, hasStock: true, allStockExpired: true, expiredBatchesCount: expiredCount, nearestExpiryDays: null };
    }

    const fefo = unexpired[0]; // already sorted by expiryDate asc
    const diffDays = Math.ceil((fefo.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    return { batch: fefo, hasStock: true, allStockExpired: false, expiredBatchesCount: expiredCount, nearestExpiryDays: diffDays };
  }

  static async addBatch(data: any) {
    return prisma.batch.create({ data });
  }

  static async updateBatch(id: string, data: any) {
    return prisma.batch.update({ where: { id }, data });
  }

  static async quarantineBatch(id: string, reason: string) {
    return prisma.batch.update({
      where: { id },
      data: { status: 'QUARANTINED', quarantineReason: reason },
    });
  }

  static async getExpiringBatches(withinDays = 90) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + withinDays);

    return prisma.batch.findMany({
      where: {
        expiryDate: { gte: today, lte: future },
        currentStock: { gt: 0 },
        status: { notIn: ['QUARANTINED', 'RECALLED', 'DEPLETED'] },
      },
      include: {
        product: { include: { manufacturer: true, category: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });
  }
}
