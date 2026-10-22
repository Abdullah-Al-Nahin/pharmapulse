import { Request, Response } from 'express';
import { SupplierService } from '../services/supplier.service';

export class SupplierController {
  static async getAll(req: Request, res: Response) {
    try {
      const suppliers = await SupplierService.getAllSuppliers();
      res.json(suppliers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const supplier = await SupplierService.getSupplierById(req.params.id);
      if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
      res.json(supplier);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const supplier = await SupplierService.createSupplier(req.body);
      res.status(201).json(supplier);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const supplier = await SupplierService.updateSupplier(req.params.id, req.body);
      res.json(supplier);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
