import { Request, Response } from 'express';
import { BatchService } from '../services/batch.service';

export class BatchController {
  static async getAll(req: Request, res: Response) {
    try {
      const { productId, status, skip, take } = req.query;
      const batches = await BatchService.getAllBatches({
        productId: productId as string,
        status: status as string,
        skip: skip ? parseInt(skip as string) : 0,
        take: take ? parseInt(take as string) : 200,
      });
      res.json(batches);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getForMedicine(req: Request, res: Response) {
    try {
      const batches = await BatchService.getBatchesForMedicine(req.params.productId);
      res.json(batches);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getFefoCandidate(req: Request, res: Response) {
    try {
      const result = await BatchService.getFefoBatchForMedicine(req.params.productId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const batch = await BatchService.addBatch(req.body);
      res.status(201).json(batch);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const batch = await BatchService.updateBatch(req.params.id, req.body);
      res.json(batch);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async quarantine(req: Request, res: Response) {
    try {
      const batch = await BatchService.quarantineBatch(req.params.id, req.body.reason || '');
      res.json(batch);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getExpiring(req: Request, res: Response) {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 90;
      const batches = await BatchService.getExpiringBatches(days);
      res.json(batches);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
