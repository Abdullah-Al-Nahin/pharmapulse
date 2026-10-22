import { Request, Response } from 'express';
import { TelemetryService } from '../services/telemetry.service';

export class TelemetryController {
  /**
   * GET /api/telemetry/snapshot?from=2026-01-01&to=2026-09-16
   * Called by the Mother ERP to roll up pharmacy branch financials.
   */
  static async getSnapshot(req: Request, res: Response) {
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      const snapshot = await TelemetryService.getSnapshot(from, to);
      res.json(snapshot);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
