const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_VxZlL5sgNkr9@ep-silent-haze-b33tmzc2-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require'
    }
  }
});

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
