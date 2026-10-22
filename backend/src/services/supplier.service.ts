import { prisma } from '../server';

export class SupplierService {
  static async getAllSuppliers() {
    return prisma.supplier.findMany();
  }

  static async getSupplierById(id: string) {
    return prisma.supplier.findUnique({
      where: { id },
    });
  }

  static async createSupplier(data: any) {
    return prisma.supplier.create({
      data,
    });
  }

  static async updateSupplier(id: string, data: any) {
    return prisma.supplier.update({
      where: { id },
      data,
    });
  }
}
