import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Starting real data seed for hospital pharmacy ERP...");

  // 1. Clear existing data (in correct foreign key order)
  await prisma.saleReturnItem.deleteMany();
  await prisma.saleReturn.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.heldSale.deleteMany();
  await prisma.prescriptionItem.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.stockAdjustment.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.product.deleteMany();
  await prisma.generic.deleteMany();
  await prisma.category.deleteMany();
  await prisma.manufacturer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();

  console.log("Cleared existing data.");

  // 2. Roles & Users
  const superAdminRole = await prisma.role.create({
    data: {
      id: '82ef9503-65bd-42c6-a4ab-a304b69e69fa',
      name: 'Super Admin',
      slug: 'super_admin',
      description: 'Root system administrator with unrestricted system access',
      isSystem: true
    }
  });

  const adminUser = await prisma.user.create({
    data: {
      id: 'user-super-admin-01',
      username: 'admin',
      email: 'admin@1',
      passwordHash: '1800',
      fullName: 'Super Admin',
      roleId: superAdminRole.id
    }
  });

  // 3. Categories
  const catAntibiotics = await prisma.category.create({ data: { name: 'Antibiotics', slug: 'antibiotics' } });
  const catAnalgesics = await prisma.category.create({ data: { name: 'Analgesics & Antipyretics', slug: 'analgesics-antipyretics' } });
  const catCardio = await prisma.category.create({ data: { name: 'Cardiovascular', slug: 'cardiovascular' } });
  const catNeuro = await prisma.category.create({ data: { name: 'Neurology', slug: 'neurology' } });
  const catOphthalmic = await prisma.category.create({ data: { name: 'Ophthalmic', slug: 'ophthalmic' } });
  const catGastro = await prisma.category.create({ data: { name: 'Gastrointestinal', slug: 'gastrointestinal' } });

  // 4. Generics
  const genAmox = await prisma.generic.create({ data: { name: 'Amoxicillin + Clavulanic Acid', therapeuticClass: 'Antibiotic' } });
  const genPara = await prisma.generic.create({ data: { name: 'Paracetamol', therapeuticClass: 'Analgesic' } });
  const genRosu = await prisma.generic.create({ data: { name: 'Rosuvastatin', therapeuticClass: 'Statin' } });
  const genClon = await prisma.generic.create({ data: { name: 'Clonazepam', therapeuticClass: 'Benzodiazepine' } });
  const genMoxi = await prisma.generic.create({ data: { name: 'Moxifloxacin', therapeuticClass: 'Ophthalmic Antibiotic' } });

  // 5. Manufacturers
  const mfrSquare = await prisma.manufacturer.create({ data: { name: 'Square Pharmaceuticals' } });
  const mfrBeximco = await prisma.manufacturer.create({ data: { name: 'Beximco Pharma' } });
  const mfrIncepta = await prisma.manufacturer.create({ data: { name: 'Incepta Pharmaceuticals' } });

  // 6. Suppliers
  const supWholesaleA = await prisma.supplier.create({ data: { name: 'National Medical Distribution', phone: '01711223344' } });
  const supWholesaleB = await prisma.supplier.create({ data: { name: 'Global Pharma Wholesale', phone: '01811223344' } });

  // 7. Products
  const pAugmentin = await prisma.product.create({
    data: {
      sku: 'SKU-AUG-625',
      barcode: '8901234567890',
      name: 'Augmentin 625 Duo',
      genericId: genAmox.id,
      manufacturerId: mfrSquare.id,
      categoryId: catAntibiotics.id,
      dosageForm: 'TABLET',
      route: 'ORAL',
      strength: '625mg',
      requiresPrescription: true,
      unitOfMeasure: 'Strip',
      packSize: 10,
      reorderLevel: 50,
      defaultRackLocation: 'Rack A-01',
      vatRate: 5.00
    }
  });

  const pNapa = await prisma.product.create({
    data: {
      sku: 'SKU-NAP-500',
      barcode: '8901234567891',
      name: 'Napa 500mg',
      genericId: genPara.id,
      manufacturerId: mfrBeximco.id,
      categoryId: catAnalgesics.id,
      dosageForm: 'TABLET',
      route: 'ORAL',
      strength: '500mg',
      requiresPrescription: false,
      unitOfMeasure: 'Strip',
      packSize: 10,
      reorderLevel: 100,
      defaultRackLocation: 'Rack A-02',
      vatRate: 0.00
    }
  });

  const pRostar = await prisma.product.create({
    data: {
      sku: 'SKU-ROS-10',
      barcode: '8901234567892',
      name: 'Rostar 10mg',
      genericId: genRosu.id,
      manufacturerId: mfrIncepta.id,
      categoryId: catCardio.id,
      dosageForm: 'TABLET',
      route: 'ORAL',
      strength: '10mg',
      requiresPrescription: true,
      unitOfMeasure: 'Strip',
      packSize: 10,
      reorderLevel: 30,
      defaultRackLocation: 'Rack C-01',
      vatRate: 5.00
    }
  });

  const pRivotril = await prisma.product.create({
    data: {
      sku: 'SKU-RIV-0.5',
      barcode: '8901234567893',
      name: 'Rivotril 0.5mg',
      genericId: genClon.id,
      manufacturerId: mfrSquare.id,
      categoryId: catNeuro.id,
      dosageForm: 'TABLET',
      route: 'ORAL',
      strength: '0.5mg',
      requiresPrescription: true,
      isNarcoticOrSedative: true,
      unitOfMeasure: 'Strip',
      packSize: 10,
      reorderLevel: 20,
      defaultRackLocation: 'Controlled Vault A',
      storageCondition: 'CONTROLLED_NARCOTIC_VAULT',
      vatRate: 5.00
    }
  });

  const pMoxiflox = await prisma.product.create({
    data: {
      sku: 'SKU-MOX-EYE',
      barcode: '8901234567894',
      name: 'Moxiflox Eye Drop',
      genericId: genMoxi.id,
      manufacturerId: mfrIncepta.id,
      categoryId: catOphthalmic.id,
      dosageForm: 'OPHTHALMIC_DROP',
      route: 'OPHTHALMIC',
      strength: '0.5%',
      requiresPrescription: true,
      unitOfMeasure: 'Bottle',
      packSize: 1,
      reorderLevel: 15,
      defaultRackLocation: 'Cold Chain - Fridge 1',
      storageCondition: 'REFRIGERATED_2_TO_8',
      vatRate: 5.00
    }
  });

  // 8. Batches
  const today = new Date();
  
  // Augmentin - Active Batch
  const expiryNextYear = new Date(today);
  expiryNextYear.setFullYear(today.getFullYear() + 1);

  await prisma.batch.create({
    data: {
      batchNumber: 'AUG-2309',
      productId: pAugmentin.id,
      supplierId: supWholesaleA.id,
      manufacturingDate: new Date('2023-09-01'),
      expiryDate: expiryNextYear,
      purchasePrice: 200.00,
      mrp: 250.00,
      unitSellingPrice: 250.00,
      initialQuantity: 500,
      currentStock: 400,
      rackLocation: 'Rack A-01',
      status: 'ACTIVE'
    }
  });

  // Napa - Active Batch
  const expiryTwoYears = new Date(today);
  expiryTwoYears.setFullYear(today.getFullYear() + 2);

  await prisma.batch.create({
    data: {
      batchNumber: 'NAP-2401',
      productId: pNapa.id,
      supplierId: supWholesaleB.id,
      manufacturingDate: new Date('2024-01-01'),
      expiryDate: expiryTwoYears,
      purchasePrice: 10.00,
      mrp: 12.00,
      unitSellingPrice: 12.00,
      initialQuantity: 2000,
      currentStock: 1850,
      rackLocation: 'Rack A-02',
      status: 'ACTIVE'
    }
  });

  // Rostar - Near Expiry Batch
  const expiryNextMonth = new Date(today);
  expiryNextMonth.setMonth(today.getMonth() + 1);

  await prisma.batch.create({
    data: {
      batchNumber: 'ROS-OLD-1',
      productId: pRostar.id,
      supplierId: supWholesaleA.id,
      manufacturingDate: new Date('2021-01-01'),
      expiryDate: expiryNextMonth,
      purchasePrice: 150.00,
      mrp: 180.00,
      unitSellingPrice: 170.00, // Discounted
      initialQuantity: 300,
      currentStock: 25,
      rackLocation: 'Rack C-01',
      status: 'NEAR_EXPIRY'
    }
  });

  // Rivotril - Controlled Vault
  await prisma.batch.create({
    data: {
      batchNumber: 'RIV-2311',
      productId: pRivotril.id,
      supplierId: supWholesaleA.id,
      manufacturingDate: new Date('2023-11-01'),
      expiryDate: expiryNextYear,
      purchasePrice: 50.00,
      mrp: 60.00,
      unitSellingPrice: 60.00,
      initialQuantity: 100,
      currentStock: 80,
      rackLocation: 'Controlled Vault A',
      status: 'ACTIVE'
    }
  });

  // Moxiflox - Quarantined batch (cold chain broken)
  await prisma.batch.create({
    data: {
      batchNumber: 'MOX-FAIL-9',
      productId: pMoxiflox.id,
      supplierId: supWholesaleB.id,
      manufacturingDate: new Date('2024-02-01'),
      expiryDate: expiryTwoYears,
      purchasePrice: 120.00,
      mrp: 150.00,
      unitSellingPrice: 150.00,
      initialQuantity: 50,
      currentStock: 50,
      rackLocation: 'Quarantine Fridge',
      status: 'QUARANTINED',
      quarantineReason: 'Cold chain broken during transit'
    }
  });

  // Moxiflox - Good batch
  await prisma.batch.create({
    data: {
      batchNumber: 'MOX-GOOD-1',
      productId: pMoxiflox.id,
      supplierId: supWholesaleB.id,
      manufacturingDate: new Date('2024-03-01'),
      expiryDate: expiryTwoYears,
      purchasePrice: 120.00,
      mrp: 150.00,
      unitSellingPrice: 150.00,
      initialQuantity: 150,
      currentStock: 120,
      rackLocation: 'Cold Chain - Fridge 1',
      status: 'ACTIVE'
    }
  });

  console.log("Real hospital data successfully seeded!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
