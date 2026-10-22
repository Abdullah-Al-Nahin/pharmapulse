import express, { Express } from 'express';
import posRouter from './routes/posRoutes';
import inventoryRouter from './routes/inventoryRoutes';
import purchaseRouter from './routes/purchaseRoutes';
import customerRouter from './routes/customerRoutes';
import stockAdjustmentRouter from './routes/stockAdjustmentRoutes';
import { rbacRouter, authRouter } from './routes/rbacRoutes';

export function createPharmacyApp(): Express {
  const app = express();

  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'Pharmacy Management & Regulatory Backend',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount RBAC & Core Modules
  app.use('/api/auth', authRouter);
  app.use('/api/rbac', rbacRouter);
  app.use('/api/pos', posRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/purchases', purchaseRouter);
  app.use('/api/customers', customerRouter);
  app.use('/api/adjustments', stockAdjustmentRouter);

  return app;
}

export default createPharmacyApp;
