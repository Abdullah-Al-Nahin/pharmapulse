require('./backend/node_modules/dotenv').config({ path: './backend/.env' });
const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const [userCount, roleCount, customerCount, adjCount, productCount, batchCount, supplierCount] = await Promise.all([
    prisma.user.count(),
    prisma.role.count(),
    prisma.customer.count(),
    prisma.stockAdjustment.count(),
    prisma.product.count(),
    prisma.batch.count(),
    prisma.supplier.count()
  ]);

  console.log('ROW COUNTS:');
  console.log({ userCount, roleCount, customerCount, adjCount, productCount, batchCount, supplierCount });

  const users = await prisma.user.findMany({ select: { id: true, username: true, fullName: true, email: true } });
  console.log('USERS IN DB:', users);

  const roles = await prisma.role.findMany({ select: { id: true, name: true, slug: true } });
  console.log('ROLES IN DB:', roles);
}

main().catch(console.error).finally(() => prisma.$disconnect());
