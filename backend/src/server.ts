import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import apiRoutes from './routes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Global Prisma Client (singleton)
export const prisma = new PrismaClient();

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    try {
      const hostname = new URL(origin).hostname;
      if (
        allowedOrigins.includes(origin) ||
        hostname.endsWith('.vercel.app') ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1'
      ) {
        return callback(null, true);
      }
    } catch {
      return callback(new Error('Invalid Origin header'));
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(helmet());
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()');
  next();
});
app.use(express.json());

// Health Check
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', database: 'connected', version: '2.0.0', capabilities: ['users', 'branches', 'customers', 'adjustments', 'transfers', 'system'] });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: String(error) });
  }
});

// API Routes
app.use('/api', apiRoutes);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

async function ensureInvoiceAndPricingColumns() {
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "purchasePrice" DECIMAL(12, 2) DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS "mrp" DECIMAL(12, 2) DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS "sellingPrice" DECIMAL(12, 2) DEFAULT 0.00;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "batches"
        ADD COLUMN IF NOT EXISTS "invoiceNumber" VARCHAR(60),
        ADD COLUMN IF NOT EXISTS "invoiceDate" DATE;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "sales"
        ADD COLUMN IF NOT EXISTS "branchId" VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "branchName" VARCHAR(150);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "cashbook_vouchers" (
        "id" VARCHAR(100) PRIMARY KEY,
        "voucherNo" VARCHAR(60) NOT NULL UNIQUE,
        "voucherDate" VARCHAR(20) NOT NULL,
        "voucherType" VARCHAR(40) NOT NULL,
        "direction" VARCHAR(10) NOT NULL,
        "category" VARCHAR(100) NOT NULL,
        "amount" DECIMAL(12, 2) NOT NULL,
        "partyName" VARCHAR(150) NOT NULL,
        "partyId" VARCHAR(100),
        "referenceNo" VARCHAR(100),
        "paymentMethod" VARCHAR(30) DEFAULT 'CASH',
        "description" TEXT NOT NULL,
        "branchId" VARCHAR(100),
        "branchName" VARCHAR(150),
        "createdBy" VARCHAR(100),
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "cashbook_vouchers_voucherDate_idx" ON "cashbook_vouchers" ("voucherDate");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "cashbook_vouchers_branchId_idx" ON "cashbook_vouchers" ("branchId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "cashbook_daily_closings" (
        "id" VARCHAR(100) PRIMARY KEY,
        "cashbookDate" VARCHAR(20) NOT NULL,
        "branchId" VARCHAR(100) NOT NULL DEFAULT 'HQ-MAIN',
        "branchName" VARCHAR(150),
        "openingCash" DECIMAL(12, 2) DEFAULT 15000.00,
        "posCashSales" DECIMAL(12, 2) DEFAULT 0.00,
        "dueAndMiscCashIn" DECIMAL(12, 2) DEFAULT 0.00,
        "dailyShopExpense" DECIMAL(12, 2) DEFAULT 0.00,
        "supplierCashPaid" DECIMAL(12, 2) DEFAULT 0.00,
        "expectedClosingCash" DECIMAL(12, 2) DEFAULT 0.00,
        "countedPhysicalCash" DECIMAL(12, 2) DEFAULT 0.00,
        "variance" DECIMAL(12, 2) DEFAULT 0.00,
        "vaultTransfer" DECIMAL(12, 2) DEFAULT 0.00,
        "carryForwardFloat" DECIMAL(12, 2) DEFAULT 0.00,
        "denominations" JSONB DEFAULT '{}',
        "status" VARCHAR(30) DEFAULT 'OPEN',
        "closedBy" VARCHAR(100),
        "notes" TEXT,
        "closedAt" TIMESTAMP WITH TIME ZONE,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE ("cashbookDate", "branchId")
      );
    `);
  } catch (err) {
    console.warn('[server]: Column auto-migration skipped or failed:', err);
  }
}

// Start Server
ensureInvoiceAndPricingColumns().finally(() => {
  app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
    console.log(`[server]: Health check at http://localhost:${port}/health`);
    console.log(`[server]: Telemetry API at http://localhost:${port}/api/telemetry/snapshot`);
  });
});
