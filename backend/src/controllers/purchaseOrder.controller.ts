import { Request, Response } from 'express';
import { PurchaseOrderService } from '../services/purchaseOrder.service';

export class PurchaseOrderController {
  static async getAll(req: Request, res: Response) {
    try {
      const orders = await PurchaseOrderService.getAllPurchaseOrders();
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const order = await PurchaseOrderService.getPurchaseOrderById(req.params.id);
      if (!order) return res.status(404).json({ error: 'Purchase Order not found' });
      res.json(order);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const order = await PurchaseOrderService.createPurchaseOrder(req.body);
      res.status(201).json(order);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async receiveGRN(req: Request, res: Response) {
    try {
      const result = await PurchaseOrderService.receiveGRN(req.params.id, req.body);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
