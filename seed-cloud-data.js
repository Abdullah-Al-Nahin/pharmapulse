const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_VxZlL5sgNkr9@ep-silent-haze-b33tmzc2-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require'
    }
  }
});

async function main() {
  console.log('Seeding real production cloud data into Neon PostgreSQL...');

  // 1. Seed Roles
  const rolesData = [
    { name: 'Super Admin', slug: 'super_admin', isSystem: true, description: 'Full system privileges' },
    { name: 'Pharmacy Manager', slug: 'pharmacy_manager', isSystem: true, description: 'Store operations and management' },
    { name: 'Pharmacist', slug: 'pharmacist', isSystem: true, description: 'Prescription dispensing and clinical safety' },
    { name: 'Cashier', slug: 'cashier', isSystem: true, description: 'Counter POS checkout and cash drawer' },
    { name: 'Storekeeper', slug: 'storekeeper', isSystem: true, description: 'Inventory, batches, and warehouse storage' },
    { name: 'Purchase Officer', slug: 'purchase_officer', isSystem: true, description: 'Supplier orders and challan GRN' },
    { name: 'Accountant', slug: 'accountant', isSystem: true, description: 'Financial ledger, dues, and tax audit' },
    { name: 'Auditor', slug: 'auditor', isSystem: true, description: 'Compliance, DGDA / regulatory audit trail' },
  ];

  const roleMap = {};
  for (const r of rolesData) {
    let existing = await prisma.role.findFirst({ where: { slug: r.slug } });
    if (!existing) {
      existing = await prisma.role.create({ data: r });
    }
    roleMap[r.slug] = existing.id;
  }
  console.log('✓ Roles synced');

  // 2. Seed Branches into branches table
  const branchesData = [
    {
      id: 'br-snakra',
      name: 'snakra',
      bnName: 'শাঁকরা ব্রাঞ্চ',
      code: '1234',
      type: 'retail_branch',
      address: 'Shankra Main Road, Keraniganj',
      phone: '+880 1919-191919',
      managerName: 'nahin3',
      licenseNo: 'BR-177324194412969-52',
      color: '#10b981',
      metrics: JSON.stringify({
        stockCount: 15,
        stockValue: 42500,
        todaySales: 2420.50,
        monthSales: 68500,
        monthlyPurchase: 45000,
        cashBalance: 2420.50,
        monthlyExpense: 12000,
        monthlyProfit: 11500,
        profitMargin: 16.8,
        staffCount: 1,
        activeSuppliers: 5,
        registeredCustomers: 25,
      })
    },
    {
      id: 'HQ-MAIN',
      name: 'Madina Eye Hospital & Central Pharmacy',
      bnName: 'মদিনা আই হসপিটাল ও সেন্ট্রাল ফার্মেসি',
      code: 'HQ-MAIN',
      type: 'head_office',
      address: 'Plot 12, Mirpur Main Road, Dhaka',
      phone: '+880 1711-001122',
      managerName: 'nahin3',
      licenseNo: 'DGDA-DH-10492',
      color: '#10b981',
      metrics: JSON.stringify({
        stockCount: 45,
        stockValue: 125000,
        todaySales: 15400,
        monthSales: 340000,
        monthlyPurchase: 210000,
        cashBalance: 15400,
        monthlyExpense: 35000,
        monthlyProfit: 95000,
        profitMargin: 27.9,
        staffCount: 8,
        activeSuppliers: 12,
        registeredCustomers: 120,
      })
    },
    {
      id: 'br-dhaka-central',
      name: 'Dhaka Central Hub',
      bnName: 'ঢাকা সেন্ট্রাল হাব',
      code: 'BR-DHAKA-CENTRAL',
      type: 'head_office',
      address: 'Motijheel C/A, Dhaka',
      phone: '+880 1711-223344',
      managerName: 'nahin1',
      licenseNo: 'DGDA-DH-99120',
      color: '#3b82f6',
      metrics: JSON.stringify({
        stockCount: 30,
        stockValue: 85000,
        todaySales: 8900,
        monthSales: 195000,
        monthlyPurchase: 140000,
        cashBalance: 8900,
        monthlyExpense: 22000,
        monthlyProfit: 33000,
        profitMargin: 16.9,
        staffCount: 2,
        activeSuppliers: 8,
        registeredCustomers: 40,
      })
    },
    {
      id: 'br-sylhet',
      name: 'Sylhet Care Center',
      bnName: 'সিলেট কেয়ার সেন্টার',
      code: 'BR-SYLHET',
      type: 'retail_branch',
      address: 'Zindabazar, Sylhet',
      phone: '+880 1819-334455',
      managerName: 'nahin',
      licenseNo: 'DGDA-SY-33102',
      color: '#8b5cf6',
      metrics: JSON.stringify({
        stockCount: 12,
        stockValue: 32000,
        todaySales: 3100,
        monthSales: 78000,
        monthlyPurchase: 55000,
        cashBalance: 3100,
        monthlyExpense: 11000,
        monthlyProfit: 12000,
        profitMargin: 15.4,
        staffCount: 1,
        activeSuppliers: 4,
        registeredCustomers: 15,
      })
    }
  ];

  for (const b of branchesData) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "branches" ("id", "name", "bnName", "code", "type", "address", "phone", "managerName", "licenseNo", "color", "metrics", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "name" = EXCLUDED."name",
        "bnName" = EXCLUDED."bnName",
        "code" = EXCLUDED."code",
        "managerName" = EXCLUDED."managerName",
        "metrics" = EXCLUDED."metrics",
        "updatedAt" = NOW();
    `, b.id, b.name, b.bnName, b.code, b.type, b.address, b.phone, b.managerName, b.licenseNo, b.color, b.metrics);
  }
  console.log('✓ Branches synced into Neon DB');

  // 3. Seed Users / Staff Directory
  const staffData = [
    {
      id: 'user-nahin3-superadmin',
      username: 'nahin3',
      fullName: 'nahin3',
      email: 'nahin3@phamerp.io',
      phone: '0191919191919',
      passwordHash: 'hashed_pw_pharma123',
      roleId: roleMap['super_admin'],
      branchId: 'br-snakra',
      branchName: 'snakra',
      licenseNumber: 'DGDA-REG-SUPER-01'
    },
    {
      id: 'user-nahin1-admin',
      username: 'nahin1-admin',
      fullName: 'nahin1',
      email: 'nahin1.admin@phamerp.io',
      phone: '01919191919191',
      passwordHash: 'hashed_pw_pharma123',
      roleId: roleMap['super_admin'],
      branchId: 'br-dhaka-central',
      branchName: 'Dhaka Central Hub',
      licenseNumber: 'DGDA-REG-SUPER-02'
    },
    {
      id: 'user-nahin1-acc',
      username: 'nahin1-acc',
      fullName: 'nahin1',
      email: 'nahin1@phamerp.io',
      phone: '01919191919',
      passwordHash: 'hashed_pw_pharma123',
      roleId: roleMap['accountant'],
      branchId: 'br-dhaka-central',
      branchName: 'Dhaka Central Hub',
      licenseNumber: 'ICAB-ACC-9821'
    },
    {
      id: 'user-nahin-cashier',
      username: 'nahin',
      fullName: 'nahin',
      email: 'nahin@phamerp.io',
      phone: '0191919',
      passwordHash: 'hashed_pw_pharma123',
      roleId: roleMap['cashier'],
      branchId: 'br-sylhet',
      branchName: 'Sylhet Care Center',
      licenseNumber: 'REG-CSH-004'
    },
    {
      id: 'user-pharmacist-01',
      username: 'tanvir.pharm',
      fullName: 'Tanvir Ahmed, M.Pharm',
      email: 'tanvir@phamerp.io',
      phone: '01712-445566',
      passwordHash: 'hashed_pw_pharma123',
      roleId: roleMap['pharmacist'],
      branchId: 'br-snakra',
      branchName: 'snakra',
      licenseNumber: 'PCB-REG-7741'
    },
    {
      id: 'user-storekeeper-01',
      username: 'tariq.logistics',
      fullName: 'Tariq Rahman',
      email: 'tariq@phamerp.io',
      phone: '01811-998877',
      passwordHash: 'hashed_pw_pharma123',
      roleId: roleMap['storekeeper'],
      branchId: 'br-snakra',
      branchName: 'snakra',
      licenseNumber: 'STR-LOG-019'
    },
    {
      id: 'user-purchase-01',
      username: 'farhana.purchase',
      fullName: 'Farhana Yeasmin',
      email: 'farhana@phamerp.io',
      phone: '01614-223344',
      passwordHash: 'hashed_pw_pharma123',
      roleId: roleMap['purchase_officer'],
      branchId: 'br-snakra',
      branchName: 'snakra',
      licenseNumber: 'PO-PROC-005'
    },
    {
      id: 'user-auditor-01',
      username: 'shahid.audit',
      fullName: 'Shahidul Islam (DGDA Auditor)',
      email: 'shahid@phamerp.io',
      phone: '01511-778899',
      passwordHash: 'hashed_pw_pharma123',
      roleId: roleMap['auditor'],
      branchId: 'br-snakra',
      branchName: 'snakra',
      licenseNumber: 'DGDA-INSP-441'
    }
  ];

  for (const s of staffData) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "users" ("id", "username", "fullName", "email", "phone", "passwordHash", "roleId", "branchId", "branchName", "licenseNumber", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "username" = EXCLUDED."username",
        "fullName" = EXCLUDED."fullName",
        "email" = EXCLUDED."email",
        "phone" = EXCLUDED."phone",
        "roleId" = EXCLUDED."roleId",
        "branchId" = EXCLUDED."branchId",
        "branchName" = EXCLUDED."branchName",
        "licenseNumber" = EXCLUDED."licenseNumber",
        "updatedAt" = NOW();
    `, s.id, s.username, s.fullName, s.email, s.phone, s.passwordHash, s.roleId, s.branchId, s.branchName, s.licenseNumber);
  }
  console.log('✓ Staff directory synced into Neon DB');

  // 4. Seed Customers into Neon customers table
  const customersData = [
    {
      id: 'cust-walkin',
      customerCode: 'CUST-0000',
      name: 'Walk-In Customer',
      phone: '01700-000000',
      email: 'walkin@pharmapulse.bd',
      address: 'Counter Direct, Shankra',
      customerType: 'RETAIL',
      creditLimit: 0,
      outstandingBalance: 0,
      loyaltyPointsBalance: 0
    },
    {
      id: 'cust-tanvir',
      customerCode: 'CUST-0001',
      name: 'Md. Tanvir Ahmed (OPD Patient)',
      phone: '01711-234567',
      email: 'tanvir.opd@gmail.com',
      address: 'Keraniganj, Dhaka',
      customerType: 'RETAIL',
      creditLimit: 2000,
      outstandingBalance: 450.00,
      loyaltyPointsBalance: 120
    },
    {
      id: 'cust-farhana',
      customerCode: 'CUST-0002',
      name: 'Kazi Farhana Rahman',
      phone: '01819-876543',
      email: 'farhana.k@gmail.com',
      address: 'Dhanmondi Road 27, Dhaka',
      customerType: 'RETAIL',
      creditLimit: 5000,
      outstandingBalance: 0.00,
      loyaltyPointsBalance: 340
    },
    {
      id: 'cust-rafiq',
      customerCode: 'CUST-0003',
      name: 'Haji Rafiqul Islam (Retail Pharmacy)',
      phone: '01912-345678',
      email: 'rafiq.pharmacy@yahoo.com',
      address: 'Babu Bazar Wholesale Market, Dhaka',
      customerType: 'WHOLESALE',
      creditLimit: 50000,
      outstandingBalance: 12500.00,
      loyaltyPointsBalance: 850
    },
    {
      id: 'cust-beximco-corp',
      customerCode: 'CUST-0004',
      name: 'Beximco Health Corporate Account',
      phone: '01713-112233',
      email: 'health.corp@beximco.net',
      address: 'Gulshan 1, Dhaka',
      customerType: 'CORPORATE',
      creditLimit: 100000,
      outstandingBalance: 24800.00,
      loyaltyPointsBalance: 2400
    },
    {
      id: 'cust-rokeya',
      customerCode: 'CUST-0005',
      name: 'Rokeya Begum (Chronic Patient)',
      phone: '01817-654321',
      email: 'rokeya.family@gmail.com',
      address: 'Mirpur Section 10, Dhaka',
      customerType: 'RETAIL',
      creditLimit: 3000,
      outstandingBalance: 780.00,
      loyaltyPointsBalance: 410
    }
  ];

  for (const c of customersData) {
    const existing = await prisma.customer.findFirst({ where: { phone: c.phone } });
    if (!existing) {
      await prisma.customer.create({
        data: {
          id: c.id,
          customerCode: c.customerCode,
          name: c.name,
          phone: c.phone,
          email: c.email,
          address: c.address,
          customerType: c.customerType,
          creditLimit: c.creditLimit,
          outstandingBalance: c.outstandingBalance,
          loyaltyPointsBalance: c.loyaltyPointsBalance
        }
      });
    }
  }
  console.log('✓ Customers synced into Neon DB');

  console.log('\n🎉 ALL REAL CLOUD DATA SEEDED DIRECTLY INTO NEON POSTGRESQL!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
