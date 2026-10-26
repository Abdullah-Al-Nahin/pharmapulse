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
}

main().catch(console.error).finally(() => prisma.$disconnect());
