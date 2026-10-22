import { prisma } from '../server';

export class MedicineService {
  static async getAllMedicines(opts?: {
    search?: string;
    categoryId?: string;
    isActive?: boolean;
    lowStock?: boolean;
    requiresPrescription?: boolean;
    skip?: number;
    take?: number;
  }) {
    const { search, categoryId, isActive = true, lowStock, requiresPrescription, skip = 0, take = 100 } = opts || {};

    const products = await prisma.product.findMany({
      where: {
        isActive,
        ...(categoryId && { categoryId }),
        ...(requiresPrescription !== undefined && { requiresPrescription }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
            { barcode: { contains: search, mode: 'insensitive' } },
            { strength: { contains: search, mode: 'insensitive' } },
            { generic: { name: { contains: search, mode: 'insensitive' } } },
            { manufacturer: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }),
      },
      include: {
        generic: true,
        manufacturer: true,
        category: true,
        batches: {
          where: { status: { not: 'QUARANTINED' } },
          orderBy: { expiryDate: 'asc' },
          select: {
            id: true,
            batchNumber: true,
            expiryDate: true,
            currentStock: true,
            mrp: true,
            unitSellingPrice: true,
            purchasePrice: true,
            status: true,
            rackLocation: true,
          },
        },
      },
      skip,
      take,
      orderBy: { name: 'asc' },
    });

    // Compute total stock per product, filter low stock if needed
    const result = products.map((p) => {
      const totalStock = p.batches.reduce((sum, b) => sum + b.currentStock, 0);
      const activeBatches = p.batches.filter(
        (b) => b.status !== 'EXPIRED' && b.status !== 'DEPLETED' && b.currentStock > 0
      );
      const fefoExpiryDate = activeBatches.length > 0 ? activeBatches[0].expiryDate : null;
      const isLowStock = totalStock <= p.reorderLevel;
      return { ...p, totalStock, activeBatchCount: activeBatches.length, fefoExpiryDate, isLowStock };
    });

    if (lowStock) return result.filter((p) => p.isLowStock);
    return result;
  }

  static async getMedicineById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        generic: true,
        manufacturer: true,
        category: true,
        batches: {
          orderBy: { expiryDate: 'asc' },
        },
      },
    });
    if (!product) return null;
    const totalStock = product.batches.reduce((sum, b) => sum + b.currentStock, 0);
    return { ...product, totalStock };
  }

  static async createMedicine(data: any) {
    const { genericName, manufacturerName, categoryName, ...productData } = data;
    
    // Default to the first ones if nothing is provided (safeguard)
    let genericId = productData.genericId;
    let manufacturerId = productData.manufacturerId;
    let categoryId = productData.categoryId;

    if (genericName && !genericId) {
      const gen = await prisma.generic.findFirst({ where: { name: genericName } }) 
        || await prisma.generic.create({ data: { name: genericName } });
      genericId = gen.id;
    }

    if (manufacturerName && !manufacturerId) {
      const mfr = await prisma.manufacturer.findFirst({ where: { name: manufacturerName } }) 
        || await prisma.manufacturer.create({ data: { name: manufacturerName } });
      manufacturerId = mfr.id;
    }

    if (categoryName && !categoryId) {
      // Basic slug generation
      const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const cat = await prisma.category.findFirst({ where: { name: categoryName } })
        || await prisma.category.create({ data: { name: categoryName, slug } });
      categoryId = cat.id;
    }

    // fallback in case they weren't provided at all
    if (!genericId) {
      const fallbackGen = await prisma.generic.findFirst() || await prisma.generic.create({ data: { name: 'General Medicine' }});
      genericId = fallbackGen.id;
    }
    if (!manufacturerId) {
      const fallbackMfr = await prisma.manufacturer.findFirst() || await prisma.manufacturer.create({ data: { name: 'General Manufacturer' }});
      manufacturerId = fallbackMfr.id;
    }
    if (!categoryId) {
      const fallbackCat = await prisma.category.findFirst() || await prisma.category.create({ data: { name: 'General Category', slug: 'general-category' }});
      categoryId = fallbackCat.id;
    }

    return prisma.product.create({ 
      data: {
        ...productData,
        genericId,
        manufacturerId,
        categoryId
      } 
    });
  }
  static async updateMedicine(id: string, data: any) {
    return prisma.product.update({ where: { id }, data });
  }

  static async getInventorySummary() {
    const [totalProducts, lowStockProducts, expiringBatches, totalStockValue] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, reorderLevel: true, batches: { select: { currentStock: true, status: true } } },
      }),
      prisma.batch.count({
        where: {
          status: 'NEAR_EXPIRY',
          currentStock: { gt: 0 },
        },
      }),
      prisma.batch.aggregate({
        _sum: { currentStock: true },
        where: { status: { in: ['ACTIVE', 'NEAR_EXPIRY'] } },
      }),
    ]);

    const lowStockCount = lowStockProducts.filter((p) => {
      const stock = p.batches
        .filter((b) => b.status !== 'EXPIRED' && b.status !== 'DEPLETED')
        .reduce((s, b) => s + b.currentStock, 0);
      return stock <= p.reorderLevel;
    }).length;

    return {
      totalProducts,
      lowStockCount,
      expiringBatches,
      totalActiveUnits: totalStockValue._sum.currentStock ?? 0,
    };
  }

  static async getCategories() {
    return prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  static async getManufacturers() {
    return prisma.manufacturer.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }
}
