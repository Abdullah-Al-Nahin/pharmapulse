import { Request, Response } from 'express';
import { MedicineService } from '../services/medicine.service';

export class MedicineController {
  static async getAll(req: Request, res: Response) {
    try {
      const { search, categoryId, lowStock, requiresPrescription, skip, take } = req.query;
      const medicines = await MedicineService.getAllMedicines({
        search: search as string,
        categoryId: categoryId as string,
        lowStock: lowStock === 'true',
        requiresPrescription: requiresPrescription === 'true' ? true : requiresPrescription === 'false' ? false : undefined,
        skip: skip ? parseInt(skip as string) : 0,
        take: take ? parseInt(take as string) : 100,
      });
      res.json(medicines);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const medicine = await MedicineService.getMedicineById(req.params.id);
      if (!medicine) return res.status(404).json({ error: 'Medicine not found' });
      res.json(medicine);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const medicine = await MedicineService.createMedicine(req.body);
      res.status(201).json(medicine);
    } catch (error: any) {
      console.error('Create Medicine Error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const medicine = await MedicineService.updateMedicine(req.params.id, req.body);
      res.json(medicine);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getSummary(req: Request, res: Response) {
    try {
      const summary = await MedicineService.getInventorySummary();
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getCategories(req: Request, res: Response) {
    try {
      const cats = await MedicineService.getCategories();
      res.json(cats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getManufacturers(req: Request, res: Response) {
    try {
      const mfrs = await MedicineService.getManufacturers();
      res.json(mfrs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
