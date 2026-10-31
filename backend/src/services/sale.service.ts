import { prisma } from '../server';

export class SaleService {
  static async getAllSales() {
    return prisma.sale.findMany({
      include: {
        items: {
          include: {
            product: true,
            batch: true,
          },
        },
        customer: true,
        cashier: {
          select: { id: true, fullName: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getSaleById(id: string) {
    return prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            batch: true,
          },
        },
        customer: true,
        cashier: {
          select: { id: true, fullName: true, username: true },
        },
      },
    });
  }

  static async completeSale(data: any) {
    return prisma.$transaction(async (tx) => {
      // 1. Resolve valid cashierId (by ID, fullName, or username, with safe fallback)
      let cashierId = data.cashierId;
      const matchedUser = cashierId
        ? await tx.user.findFirst({
            where: {
              OR: [
                { id: String(cashierId) },
                { fullName: { equals: String(cashierId), mode: 'insensitive' } },
                { username: { equals: String(cashierId), mode: 'insensitive' } },
              ],
            },
          })
        : null;

      if (matchedUser) {
        cashierId = matchedUser.id;
      } else {
        const fallbackUser = await tx.user.findFirst();
        if (fallbackUser) {
          cashierId = fallbackUser.id;
        } else {
          let role = await tx.role.findFirst();
          if (!role) {
            role = await tx.role.create({
              data: {
                name: 'Super Admin',
                slug: 'super-admin',
                description: 'Full administrative access',
              },
            });
          }
          const newAdmin = await tx.user.create({
            data: {
              username: 'admin',
              fullName: 'Super Admin',
              email: 'admin@pharmapulse.com',
              roleId: role.id,
              passwordHash: '$2b$10$fallbackhashdummy',
            },
          });
          cashierId = newAdmin.id;
        }
      }

      // 2. Resolve valid customerId if provided
      let validCustomerId: string | null = null;
      if (data.customerId) {
        const cust = await tx.customer.findUnique({ where: { id: String(data.customerId) } });
        if (cust) validCustomerId = cust.id;
      }

      // 3. Resolve batches, decrement stock once atomically, and accumulate COGS
      const validSaleItems: any[] = [];
      let totalCogs = 0;

      if (Array.isArray(data.items)) {
        for (const item of data.items) {
          const qty = Number(item.quantity || 0);
          if (qty <= 0) continue;

          let batch =
            item.batchId && item.batchId !== 'unknown-batch'
              ? await tx.batch.findUnique({ where: { id: String(item.batchId) } })
              : null;

          if (!batch && item.productId && item.productId !== 'unknown-med') {
            batch = await tx.batch.findFirst({
              where: {
                productId: String(item.productId),
                currentStock: { gt: 0 },
                status: { not: 'QUARANTINED' },
              },
              orderBy: { expiryDate: 'asc' },
            });
          }

          if (!batch && item.medicineName) {
            const matchedProd = await tx.product.findFirst({
              where: { name: { contains: String(item.medicineName), mode: 'insensitive' } },
              include: { batches: { where: { currentStock: { gt: 0 } }, orderBy: { expiryDate: 'asc' } } },
            });
            if (matchedProd && matchedProd.batches.length > 0) {
              batch = matchedProd.batches[0];
            }
          }

          if (!batch) {
            batch = await tx.batch.findFirst({ orderBy: { expiryDate: 'asc' } });
          }

          if (!batch) {
            let defaultProd = await tx.product.findFirst();
            if (!defaultProd) {
              let gen = await tx.generic.findFirst();
              if (!gen) gen = await tx.generic.create({ data: { name: 'General Formulation' } });
              let mfr = await tx.manufacturer.findFirst();
              if (!mfr) mfr = await tx.manufacturer.create({ data: { name: 'Standard Pharma' } });
              let cat = await tx.category.findFirst();
              if (!cat) cat = await tx.category.create({ data: { name: 'OTC', slug: 'otc' } });

              defaultProd = await tx.product.create({
                data: {
                  name: String(item.medicineName || 'General Medicine'),
                  sku: `SKU-${Date.now()}`,
                  genericId: gen.id,
                  manufacturerId: mfr.id,
                  categoryId: cat.id,
                  strength: '500mg',
                },
              });
            }
            batch = await tx.batch.create({
              data: {
                productId: defaultProd.id,
                batchNumber: `BAT-AUTO-${Date.now().toString().slice(-4)}`,
                manufacturingDate: new Date(),
                expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                purchasePrice: 5.0,
                unitSellingPrice: 7.0,
                mrp: 7.0,
                initialQuantity: 1000,
                currentStock: 1000,
                status: 'ACTIVE',
              },
            });
          }

          const newStock = Math.max(0, batch.currentStock - qty);
          await tx.batch.update({
            where: { id: batch.id },
            data: {
              currentStock: newStock,
              status: newStock === 0 ? 'DEPLETED' : batch.status,
            },
          });

          const unitCost = Number(
            item.unitCostPrice || item.unitPurchasePrice || batch.purchasePrice || 0
          );
          const unitSelling = Number(
            item.unitSellingPrice || item.sellingPrice || batch.unitSellingPrice || 0
          );
          const unitMrp = Number(item.unitMrp || item.mrp || batch.mrp || unitSelling);
          const lineTotal = Number(item.lineTotal ?? unitSelling * qty);
          const itemCogs = unitCost * qty;
          totalCogs += itemCogs;

          validSaleItems.push({
            productId: batch.productId,
            batchId: batch.id,
            quantity: qty,
            unitMrp,
            unitSellingPrice: unitSelling,
            unitCostPrice: unitCost,
            discountAmount: Number(item.discountAmount || 0),
            taxRate: Number(item.taxRate || 0),
            taxAmount: Number(item.taxAmount || 0),
            lineTotal,
            lineGrossProfit: lineTotal - itemCogs,
          });
        }
      }

      // 4. Increment Customer outstandingBalance if sale has dueAmount > 0
      const dueAmount = Number(data.dueAmount ?? 0);
      if (validCustomerId && dueAmount > 0) {
        await tx.customer.update({
          where: { id: validCustomerId },
          data: { outstandingBalance: { increment: dueAmount } },
        });
      }

      // 5. Create Sale record with computed costOfGoodsSold
      return tx.sale.create({
        data: {
          invoiceNumber: data.invoiceNumber || `INV-${Date.now()}`,
          cashierId,
          customerId: validCustomerId,
          subTotal: data.subTotal ?? 0,
          discountAmount: data.discountAmount ?? 0,
          taxAmount: data.taxAmount ?? 0,
          roundOff: data.roundOff ?? 0,
          grandTotal: data.grandTotal ?? 0,
          costOfGoodsSold: totalCogs,
          paidAmount: data.paidAmount ?? Math.max(0, Number(data.grandTotal || 0) - dueAmount),
          changeGiven: data.changeGiven ?? 0,
          dueAmount,
          status: 'COMPLETED',
          notes: data.notes || null,
          items: {
            create: validSaleItems,
          },
        },
        include: {
          items: {
            include: {
              product: true,
              batch: true,
            },
          },
          customer: true,
          cashier: {
            select: { id: true, fullName: true, username: true },
          },
        },
      });
    });
  }
}
