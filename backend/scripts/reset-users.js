const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetUsers() {
  console.log('--- Cleaning users and inserting single super_admin account ---');

  // 1. Get or create super_admin role
  let superAdminRole = await prisma.role.findFirst({
    where: { slug: 'super_admin' }
  });

  if (!superAdminRole) {
    superAdminRole = await prisma.role.create({
      data: {
        id: '82ef9503-65bd-42c6-a4ab-a304b69e69fa',
        slug: 'super_admin',
        name: 'Super Admin',
        description: 'Root system administrator with unrestricted system access, role customization, and financial oversight.',
        isSystem: true
      }
    });
    console.log('Created super_admin role');
  } else {
    console.log('Found existing super_admin role:', superAdminRole.id);
  }

  // 2. Clear all existing users from users table
  const deleteResult = await prisma.$executeRawUnsafe('DELETE FROM "users"');
  console.log('Deleted existing users. Rows affected:', deleteResult);

  // 3. Insert the ONLY Super Admin user
  const newUserId = 'user-super-admin-01';
  const username = 'admin';
  const fullName = 'Super Admin';
  const email = 'admin@1';
  const phone = '+880 1700-000000';
  const passwordHash = '1800';
  const branchId = 'all';
  const branchName = 'Headquarters & All Branches';
  const licenseNumber = 'DGDA-SUPER-ADMIN-01';

  await prisma.$executeRawUnsafe(`
    INSERT INTO "users" (
      "id",
      "username",
      "fullName",
      "email",
      "phone",
      "passwordHash",
      "roleId",
      "branchId",
      "branchName",
      "licenseNumber",
      "status",
      "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE', NOW()
    )
  `, newUserId, username, fullName, email, phone, passwordHash, superAdminRole.id, branchId, branchName, licenseNumber);

  console.log('Successfully inserted single Super Admin user (admin@1 / 1800)');

  // 4. Verify in DB
  const remainingUsers = await prisma.user.findMany({
    include: { role: true }
  });
  console.log('Verified remaining users count:', remainingUsers.length);
  remainingUsers.forEach(u => {
    console.log(`- ID: ${u.id}, Name: ${u.fullName}, Email: ${u.email}, Role: ${u.role?.name} (${u.role?.slug})`);
  });
}

resetUsers()
  .catch(err => {
    console.error('Error resetting users:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
