require('./backend/node_modules/dotenv').config({ path: './backend/.env' });
const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Ensuring tables for full cross-platform cloud sync in Neon DB...');

  // 1. Alter users table to add branchId and branchName if not present
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "users" 
    ADD COLUMN IF NOT EXISTS "branchId" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "branchName" VARCHAR(150);
  `);
  console.log('✓ users table updated');

  // 2. Create branches table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "branches" (
      "id" VARCHAR(100) PRIMARY KEY,
      "name" VARCHAR(150) NOT NULL,
      "bnName" VARCHAR(150),
      "code" VARCHAR(50) NOT NULL UNIQUE,
      "type" VARCHAR(50) DEFAULT 'retail_branch',
      "address" TEXT,
      "phone" VARCHAR(50),
      "managerName" VARCHAR(100),
      "licenseNo" VARCHAR(100),
      "color" VARCHAR(50),
      "metrics" JSONB DEFAULT '{}',
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  console.log('✓ branches table created');

  // 3. Create stock_transfers table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "stock_transfers" (
      "id" VARCHAR(100) PRIMARY KEY,
      "transferNumber" VARCHAR(100) NOT NULL UNIQUE,
      "transferType" VARCHAR(50) DEFAULT 'branch_to_branch',
      "fromBranchId" VARCHAR(100),
      "fromBranchName" VARCHAR(150),
      "toBranchId" VARCHAR(100),
      "toBranchName" VARCHAR(150),
      "status" VARCHAR(50) DEFAULT 'pending',
      "totalUnits" INT DEFAULT 0,
      "totalValue" DECIMAL(14, 2) DEFAULT 0.00,
      "isColdChain" BOOLEAN DEFAULT FALSE,
      "transitTemperature" VARCHAR(100),
      "challanNumber" VARCHAR(100),
      "requestedBy" VARCHAR(100),
      "dispatchedBy" VARCHAR(100),
      "receivedBy" VARCHAR(100),
      "items" JSONB DEFAULT '[]',
      "notes" TEXT,
      "requestedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      "dispatchedAt" TIMESTAMP WITH TIME ZONE,
      "receivedAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  console.log('✓ stock_transfers table created');

  // 4. Create rack_locations table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "rack_locations" (
      "id" VARCHAR(100) PRIMARY KEY,
      "aisle" VARCHAR(100),
      "rack" VARCHAR(100),
      "shelf" VARCHAR(100),
      "bin" VARCHAR(100),
      "zone" VARCHAR(50),
      "capacityUnits" INT DEFAULT 500,
      "currentOccupancy" INT DEFAULT 0,
      "temperatureRange" VARCHAR(100),
      "notes" TEXT,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  console.log('✓ rack_locations table created');

  // 5. Ensure master pricing columns on products and invoice tracking columns on batches
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
  console.log('✓ products pricing, batches invoice, & sales branch columns ensured');

  // 6. Create cashbook_vouchers & cashbook_daily_closings tables
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
  console.log('✓ cashbook_vouchers & cashbook_daily_closings tables ensured');
}

main().catch(console.error).finally(() => prisma.$disconnect());
