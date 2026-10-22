import { Request, Response } from 'express';
import { SaleService } from '../services/sale.service';

export class SaleController {
  static async getAll(req: Request, res: Response) {
    try {
      const sales = await SaleService.getAllSales();
      res.json(sales);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const sale = await SaleService.getSaleById(req.params.id);
      if (!sale) return res.status(404).json({ error: 'Sale not found' });
      res.json(sale);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const sale = await SaleService.completeSale(req.body);
      res.status(201).json(sale);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
