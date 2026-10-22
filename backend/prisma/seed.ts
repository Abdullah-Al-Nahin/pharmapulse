/**
 * ==============================================================================
 * PHARMACY MANAGEMENT SAAS - BANGLADESH OPHTHALMIC DATA SEED SCRIPT (PRISMA ORM)
 * ==============================================================================
 * Dataset Source: MedEx Bangladesh & DGDA Licensed Manufacturers
 * Clinic/Hospital: Madina Eye Hospital & Pharmacy Services Ltd.
 * Scope: Ophthalmic Drops (চোখের ড্রপ), Ointments (চোখের মলম), Gels (চোখের জেল)
 *
 * Models Populated:
 * 1. Manufacturer (DGDA Approved Bangladeshi Pharma Companies)
 * 2. Generic (Ophthalmic APIs with Indications, Contraindications, Side Effects)
 * 3. Category (Ocular Therapeutics & Surgical Formulations)
 * 4. Product (Dosage Forms, Storage Instructions, Barcodes, Rx Flags)
 * 5. Batch (FEFO Scheduling, Expiry Dates, MRP, Trade Discounted Cost Prices)
 * ==============================================================================
 */

import { PrismaClient, DosageForm, StorageCondition, AdministrationRoute, BatchStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to calculate realistic purchase cost (MRP minus 12% to 15% trade discount)
const calculatePurchasePrice = (mrp: number, discountPercentage: number): number => {
  return Number((mrp * (1 - discountPercentage / 100)).toFixed(2));
};

export async function main() {
  console.log('🚀 Starting Bangladesh Ophthalmic Market Data Seed (MedEx Dataset)...');

  // ----------------------------------------------------------------------------
  // 1. SEED CATEGORIES
  // ----------------------------------------------------------------------------
  console.log('📦 Seeding Product Categories...');
  const ophthalmicCategory = await prisma.category.upsert({
    where: { slug: 'ophthalmic-ent' },
    update: {},
    create: {
      id: 'cat-ophthalmic',
      name: 'Ophthalmic & ENT',
      slug: 'ophthalmic-ent',
      description: 'Sterile ophthalmic preparations, eye drops, ointments, ocular lubricants, and surgical viscoelastics.'
    }
  });

  const glaucomaCategory = await prisma.category.upsert({
    where: { slug: 'antiglaucoma-preparations' },
    update: {},
    create: {
      id: 'cat-glaucoma',
      name: 'Antiglaucoma Preparations',
      slug: 'antiglaucoma-preparations',
      description: 'Intraocular pressure lowering drops, prostaglandin analogues, alpha-agonists, and beta blockers.'
    }
  });

  const lubricantCategory = await prisma.category.upsert({
    where: { slug: 'ocular-lubricants-artificial-tears' },
    update: {},
    create: {
      id: 'cat-lubricants',
      name: 'Ocular Lubricants & Artificial Tears',
      slug: 'ocular-lubricants-artificial-tears',
      description: 'Demulcents and viscoelastic eye drops/gels for dry eye syndrome and ocular surface discomfort.'
    }
  });

  // ----------------------------------------------------------------------------
  // 2. SEED MANUFACTURERS (DGDA BANGLADESH REGISTERED)
  // ----------------------------------------------------------------------------
  console.log('🏭 Seeding Bangladeshi Pharmaceutical Manufacturers...');
  const manufacturersData = [
    {
      id: 'mfg-general',
      name: 'General Pharmaceuticals Ltd.',
      code: 'GPL',
      contactPerson: 'Depot Manager (Ophthalmic Div)',
      phone: '+880-2-9663244',
      email: 'info@generalpharma.com',
      address: 'House 24, Road 13/A, Block D, Banani, Dhaka-1213',
      country: 'Bangladesh'
    },
    {
      id: 'mfg-gaco',
      name: 'Gaco Pharmaceuticals Ltd.',
      code: 'GACO',
      contactPerson: 'Institutional Sales Officer',
      phone: '+880-2-9887711',
      email: 'sales@gacopharma.com',
      address: 'Gulshan Grace, Plot 8, Road 11, South Avenue, Gulshan-1, Dhaka',
      country: 'Bangladesh'
    },
    {
      id: 'mfg-incepta',
      name: 'Incepta Pharmaceuticals Ltd.',
      code: 'INCP',
      contactPerson: 'Key Account Manager (Eye Care)',
      phone: '+880-2-8891688',
      email: 'incepta@inceptapharma.com',
      address: '40 Shahid Tajuddin Ahmed Sarani, Tejgaon I/A, Dhaka-1208',
      country: 'Bangladesh'
    },
    {
      id: 'mfg-square',
      name: 'Square Pharmaceuticals PLC',
      code: 'SQR',
      contactPerson: 'Regional Eye Care Representative',
      phone: '+880-2-8833047',
      email: 'info@squaregroup.com',
      address: 'Square Centre, 48 Mohakhali C/A, Dhaka-1212',
      country: 'Bangladesh'
    },
    {
      id: 'mfg-aristo',
      name: 'Aristopharma Ltd.',
      code: 'ARIS',
      contactPerson: 'Hospital Supply Executive',
      phone: '+880-2-9351691',
      email: 'marketing@aristopharma.com',
      address: '7 Purana Paltan Line, Dhaka-1000',
      country: 'Bangladesh'
    },
    {
      id: 'mfg-opsonin',
      name: 'Opsonin Pharma Ltd.',
      code: 'OPS',
      contactPerson: 'Depot Distribution Officer',
      phone: '+880-2-9850616',
      email: 'info@opsonin-pharma.com',
      address: 'Opsonin Building, 30 New Eskaton Road, Dhaka-1000',
      country: 'Bangladesh'
    },
    {
      id: 'mfg-ibnsina',
      name: 'The Ibn Sina Pharmaceutical Industry PLC',
      code: 'IBN',
      contactPerson: 'Medical Promotion Officer',
      phone: '+880-2-9014705',
      email: 'pharma@ibnsinapharma.com',
      address: '1/1, B/1, Kallyanpur, Mirpur Road, Dhaka-1207',
      country: 'Bangladesh'
    },
    {
      id: 'mfg-osl',
      name: 'Opso Saline Ltd. (OSL Pharma)',
      code: 'OSL',
      contactPerson: 'Surgical & Ophthalmic In-charge',
      phone: '+880-2-9844431',
      email: 'saline@opsosaline.com',
      address: '30 New Eskaton Road, Dhaka-1000',
      country: 'Bangladesh'
    }
  ];

  for (const mfg of manufacturersData) {
    await prisma.manufacturer.upsert({
      where: { name: mfg.name },
      update: mfg,
      create: mfg
    });
  }

  // ----------------------------------------------------------------------------
  // 3. SEED GENERICS (MEDEX PHARMACOLOGICAL PROFILES)
  // ----------------------------------------------------------------------------
  console.log('🧬 Seeding Ophthalmic Generic Formulations...');
  const genericsData = [
    {
      id: 'gen-tobra-dex',
      name: 'Tobramycin + Dexamethasone',
      therapeuticClass: 'Ophthalmic Antibacterial & Corticosteroid Combinations',
      description: 'Fixed-dose combination of aminoglycoside antibacterial (Tobramycin) and potent anti-inflammatory corticosteroid (Dexamethasone).',
      indication: 'Steroid-responsive inflammatory ocular conditions with bacterial infection or suspected bacterial ocular infection risk (blepharitis, conjunctivitis, post-cataract surgery).',
      contraindications: 'Viral diseases of cornea and conjunctiva including epithelial herpes simplex keratitis, vaccinia, varicella, fungal infections of the eye.',
      sideEffects: 'Transient ocular irritation, burning, stinging, conjunctival erythema, elevated intraocular pressure with prolonged use.'
    },
    {
      id: 'gen-moxi',
      name: 'Moxifloxacin (0.5%)',
      therapeuticClass: '4th Generation Fluoroquinolone Antibacterial',
      description: 'Broad-spectrum 8-methoxy fluoroquinolone ophthalmic solution active against Gram-positive, Gram-negative, and atypical ocular pathogens.',
      indication: 'Treatment of bacterial conjunctivitis, corneal ulcers, bacterial keratitis, and pre/post-operative surgical infection prophylaxis.',
      contraindications: 'Hypersensitivity to moxifloxacin, other quinolones, or any excipients.',
      sideEffects: 'Transient eye discomfort, decreased visual acuity, subconjunctival hemorrhage, dry eye.'
    },
    {
      id: 'gen-cmc',
      name: 'Carboxymethylcellulose Sodium (0.5%)',
      therapeuticClass: 'Ocular Lubricant & Demulcent (Artificial Tears)',
      description: 'High-viscosity polymer matrix providing long-lasting hydration, lubrication, and corneal epithelial healing in dry eyes.',
      indication: 'Temporary relief of burning, irritation, dryness, and ocular fatigue caused by environmental exposure, wind, screen time, or post-LASIK surgery.',
      contraindications: 'Hypersensitivity to carboxymethylcellulose sodium.',
      sideEffects: 'Mild temporary blurred vision immediately upon instillation, minor matting of eyelashes.'
    },
    {
      id: 'gen-olopatadine',
      name: 'Olopatadine (0.1% / 0.2%)',
      therapeuticClass: 'Dual Action Mast Cell Stabilizer & Selective H1-Antagonist',
      description: 'Ophthalmic anti-allergic agent preventing mast cell degranulation and blocking histamine H1-receptors.',
      indication: 'Treatment of signs and symptoms of allergic conjunctivitis (seasonal and perennial ocular itching, redness, tearing).',
      contraindications: 'Known hypersensitivity to olopatadine hydrochloride.',
      sideEffects: 'Headache, asthenia, ocular burning, stinging, foreign body sensation.'
    },
    {
      id: 'gen-brimonidine',
      name: 'Brimonidine Tartrate (0.2%)',
      therapeuticClass: 'Alpha-2 Adrenergic Receptor Agonist (Antiglaucoma)',
      description: 'Selective alpha-2 adrenergic agonist reducing intraocular pressure (IOP) by decreasing aqueous humor synthesis and increasing uveoscleral outflow.',
      indication: 'Reduction of elevated intraocular pressure in patients with open-angle glaucoma or ocular hypertension.',
      contraindications: 'Patients receiving monoamine oxidase (MAO) inhibitor therapy, neonates and children under 2 years of age.',
      sideEffects: 'Ocular hyperemia, burning, visual disturbance, foreign body sensation, fatigue, dry mouth.'
    },
    {
      id: 'gen-baci-poly',
      name: 'Bacitracin Zinc + Polymyxin B Sulfate',
      therapeuticClass: 'Topical Ophthalmic Antibacterial Combination',
      description: 'Synergistic combination of polypeptide antibiotics effective against both Gram-positive and Gram-negative ocular organisms.',
      indication: 'Superficial ocular infections involving conjunctiva and/or cornea (acute blepharoconjunctivitis, infected styes, corneal abrasions).',
      contraindications: 'Hypersensitivity to bacitracin or polymyxin B sulfate.',
      sideEffects: 'Allergic contact dermatitis, local itching, eyelid swelling.'
    },
    {
      id: 'gen-chloram',
      name: 'Chloramphenicol (1%)',
      therapeuticClass: 'Broad-Spectrum Phenicol Antibacterial',
      description: 'Lipid-soluble bacteriostatic antibiotic inhibiting microbial protein synthesis by binding to 50S ribosomal subunits.',
      indication: 'Bacterial conjunctivitis, blepharitis, superficial ocular infections caused by susceptible organisms.',
      contraindications: 'Personal or family history of blood dyscrasias, bone marrow depression, hypersensitivity.',
      sideEffects: 'Transient burning, stinging, rare systemic hematological toxicities.'
    },
    {
      id: 'gen-hpmc-carbomer',
      name: 'Hydroxypropyl Methylcellulose (2%) / Carbomer',
      therapeuticClass: 'Ophthalmic Viscoelastic Surgical Aid & Tear Gel',
      description: 'Sterile, non-pyrogenic viscoelastic biopolymer maintaining anterior chamber depth during intraocular surgery, and lubricating gels for severe dry eye.',
      indication: 'Surgical aid in anterior segment ophthalmic surgery (cataract extraction, IOL implantation); treatment of severe keratoconjunctivitis sicca.',
      contraindications: 'Known hypersensitivity to methylcellulose or carbomer derivatives.',
      sideEffects: 'Transient postoperative rise in intraocular pressure, blurred vision, crusting along eyelids.'
    }
  ];

  for (const gen of genericsData) {
    await prisma.generic.upsert({
      where: { name: gen.name },
      update: gen,
      create: gen
    });
  }

  // Retrieve saved Generics & Manufacturers for clean foreign key references
  const mfgMap = new Map((await prisma.manufacturer.findMany()).map((m) => [m.code || m.name, m.id]));
  const genMap = new Map((await prisma.generic.findMany()).map((g) => [g.name, g.id]));

  // Common ophthalmic storage text
  const OPHTHALMIC_STORAGE_INSTRUCTION = 'Store below 25°C. Protect from light. Do not freeze. Discard 28 days after first opening.';

  // ----------------------------------------------------------------------------
  // 4. SEED PRODUCTS & BATCHES (MEDEX BANGLADESH DATASET)
  // ----------------------------------------------------------------------------
  console.log('👁️ Seeding Ophthalmic Products and FEFO Batches...');

  const productsDataset = [
    // --- 1. OPHTHALMIC DROPS ---
    {
      sku: 'OPH-DROP-001',
      barcode: '8941100101017',
      name: 'Tobradex Ophthalmic Drop 5ml',
      genericName: 'Tobramycin + Dexamethasone',
      mfgCode: 'GPL',
      categoryId: ophthalmicCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_DROP,
      route: AdministrationRoute.OPHTHALMIC,
      strength: '0.3% + 0.1% (5 ml)',
      unitOfMeasure: 'Vial',
      packSize: 1,
      mrp: 145.00,
      tradeDiscountPct: 13.5, // Realistic 13.5% trade discount
      reorderLevel: 25,
      defaultRackLocation: 'Ophthalmic Bay Rack E-01',
      requiresPrescription: true,
      isAntibiotic: true,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: OPHTHALMIC_STORAGE_INSTRUCTION,
      batches: [
        {
          batchNumber: 'TBX-2401',
          mfgOffsetDays: -180,
          expOffsetDays: 360,
          initialQty: 100,
          currentStock: 68
        },
        {
          batchNumber: 'TBX-2402',
          mfgOffsetDays: -60,
          expOffsetDays: 540,
          initialQty: 150,
          currentStock: 145
        }
      ]
    },
    {
      sku: 'OPH-DROP-002',
      barcode: '8941100101024',
      name: 'Tobidex Ophthalmic Drop 5ml',
      genericName: 'Tobramycin + Dexamethasone',
      mfgCode: 'GACO',
      categoryId: ophthalmicCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_DROP,
      route: AdministrationRoute.OPHTHALMIC,
      strength: '0.3% + 0.1% (5 ml)',
      unitOfMeasure: 'Vial',
      packSize: 1,
      mrp: 150.00,
      tradeDiscountPct: 14.0,
      reorderLevel: 20,
      defaultRackLocation: 'Ophthalmic Bay Rack E-01',
      requiresPrescription: true,
      isAntibiotic: true,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: OPHTHALMIC_STORAGE_INSTRUCTION,
      batches: [
        {
          batchNumber: 'TBD-2403',
          mfgOffsetDays: -90,
          expOffsetDays: 450,
          initialQty: 120,
          currentStock: 95
        }
      ]
    },
    {
      sku: 'OPH-DROP-003',
      barcode: '8941100101031',
      name: 'Moxicin Eye Drop 5ml',
      genericName: 'Moxifloxacin (0.5%)',
      mfgCode: 'SQR',
      categoryId: ophthalmicCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_DROP,
      route: AdministrationRoute.OPHTHALMIC,
      strength: '0.5% (5 ml)',
      unitOfMeasure: 'Vial',
      packSize: 1,
      mrp: 150.00,
      tradeDiscountPct: 13.0,
      reorderLevel: 30,
      defaultRackLocation: 'Ophthalmic Bay Rack E-02',
      requiresPrescription: true,
      isAntibiotic: true,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: OPHTHALMIC_STORAGE_INSTRUCTION,
      batches: [
        {
          batchNumber: 'MXC-2408',
          mfgOffsetDays: -120,
          expOffsetDays: 480,
          initialQty: 200,
          currentStock: 165
        },
        {
          batchNumber: 'MXC-2311',
          mfgOffsetDays: -420,
          expOffsetDays: 45, // Near expiry to test FEFO prioritizing!
          initialQty: 80,
          currentStock: 12
        }
      ]
    },
    {
      sku: 'OPH-DROP-004',
      barcode: '8941100101048',
      name: 'Flomox Eye Drop 5ml',
      genericName: 'Moxifloxacin (0.5%)',
      mfgCode: 'INCP',
      categoryId: ophthalmicCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_DROP,
      route: AdministrationRoute.OPHTHALMIC,
      strength: '0.5% (5 ml)',
      unitOfMeasure: 'Vial',
      packSize: 1,
      mrp: 140.00,
      tradeDiscountPct: 13.5,
      reorderLevel: 25,
      defaultRackLocation: 'Ophthalmic Bay Rack E-02',
      requiresPrescription: true,
      isAntibiotic: true,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: OPHTHALMIC_STORAGE_INSTRUCTION,
      batches: [
        {
          batchNumber: 'FLX-2405',
          mfgOffsetDays: -80,
          expOffsetDays: 400,
          initialQty: 150,
          currentStock: 110
        }
      ]
    },
    {
      sku: 'OPH-DROP-005',
      barcode: '8941100101055',
      name: 'Lubrex 0.5% Eye Drop 10ml',
      genericName: 'Carboxymethylcellulose Sodium (0.5%)',
      mfgCode: 'ARIS',
      categoryId: lubricantCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_DROP,
      route: AdministrationRoute.OPHTHALMIC,
      strength: '0.5% (10 ml)',
      unitOfMeasure: 'Vial',
      packSize: 1,
      mrp: 150.00,
      tradeDiscountPct: 14.0,
      reorderLevel: 40,
      defaultRackLocation: 'Ophthalmic Bay Rack E-03',
      requiresPrescription: false, // OTC artificial tears
      isAntibiotic: false,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: OPHTHALMIC_STORAGE_INSTRUCTION,
      batches: [
        {
          batchNumber: 'LBR-2404',
          mfgOffsetDays: -100,
          expOffsetDays: 520,
          initialQty: 250,
          currentStock: 215
        }
      ]
    },
    {
      sku: 'OPH-DROP-006',
      barcode: '8941100101062',
      name: 'Tear-Off Eye Drop 10ml',
      genericName: 'Carboxymethylcellulose Sodium (0.5%)',
      mfgCode: 'SQR',
      categoryId: lubricantCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_DROP,
      route: AdministrationRoute.OPHTHALMIC,
      strength: '0.5% (10 ml)',
      unitOfMeasure: 'Vial',
      packSize: 1,
      mrp: 120.00,
      tradeDiscountPct: 13.0,
      reorderLevel: 35,
      defaultRackLocation: 'Ophthalmic Bay Rack E-03',
      requiresPrescription: false,
      isAntibiotic: false,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: OPHTHALMIC_STORAGE_INSTRUCTION,
      batches: [
        {
          batchNumber: 'TRF-2402',
          mfgOffsetDays: -150,
          expOffsetDays: 450,
          initialQty: 180,
          currentStock: 140
        }
      ]
    },
    {
      sku: 'OPH-DROP-007',
      barcode: '8941100101079',
      name: 'Patadin 0.1% Eye Drop 5ml',
      genericName: 'Olopatadine (0.1% / 0.2%)',
      mfgCode: 'INCP',
      categoryId: ophthalmicCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_DROP,
      route: AdministrationRoute.OPHTHALMIC,
      strength: '0.1% (5 ml)',
      unitOfMeasure: 'Vial',
      packSize: 1,
      mrp: 120.00,
      tradeDiscountPct: 14.0,
      reorderLevel: 25,
      defaultRackLocation: 'Ophthalmic Bay Rack E-04',
      requiresPrescription: true,
      isAntibiotic: false,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: OPHTHALMIC_STORAGE_INSTRUCTION,
      batches: [
        {
          batchNumber: 'PTD-2401',
          mfgOffsetDays: -90,
          expOffsetDays: 380,
          initialQty: 130,
          currentStock: 104
        }
      ]
    },
    {
      sku: 'OPH-DROP-008',
      barcode: '8941100101086',
      name: 'Alastat 0.2% Eye Drop 5ml',
      genericName: 'Olopatadine (0.1% / 0.2%)',
      mfgCode: 'SQR',
      categoryId: ophthalmicCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_DROP,
      route: AdministrationRoute.OPHTHALMIC,
      strength: '0.2% (5 ml)',
      unitOfMeasure: 'Vial',
      packSize: 1,
      mrp: 160.00,
      tradeDiscountPct: 13.5,
      reorderLevel: 20,
      defaultRackLocation: 'Ophthalmic Bay Rack E-04',
      requiresPrescription: true,
      isAntibiotic: false,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: OPHTHALMIC_STORAGE_INSTRUCTION,
      batches: [
        {
          batchNumber: 'ALS-2406',
          mfgOffsetDays: -75,
          expOffsetDays: 460,
          initialQty: 140,
          currentStock: 118
        }
      ]
    },
    {
      sku: 'OPH-DROP-009',
      barcode: '8941100101093',
      name: 'Bricoma Eye Drop 5ml',
      genericName: 'Brimonidine Tartrate (0.2%)',
      mfgCode: 'OPS',
      categoryId: glaucomaCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_DROP,
      route: AdministrationRoute.OPHTHALMIC,
      strength: '0.2% (5 ml)',
      unitOfMeasure: 'Vial',
      packSize: 1,
      mrp: 80.00,
      tradeDiscountPct: 14.0,
      reorderLevel: 20,
      defaultRackLocation: 'Glaucoma Bay Rack G-01',
      requiresPrescription: true,
      isAntibiotic: false,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: OPHTHALMIC_STORAGE_INSTRUCTION,
      batches: [
        {
          batchNumber: 'BRC-2403',
          mfgOffsetDays: -110,
          expOffsetDays: 420,
          initialQty: 110,
          currentStock: 82
        }
      ]
    },
    {
      sku: 'OPH-DROP-010',
      barcode: '8941100101109',
      name: 'Brimodin Eye Drop 5ml',
      genericName: 'Brimonidine Tartrate (0.2%)',
      mfgCode: 'INCP',
      categoryId: glaucomaCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_DROP,
      route: AdministrationRoute.OPHTHALMIC,
      strength: '0.2% (5 ml)',
      unitOfMeasure: 'Vial',
      packSize: 1,
      mrp: 80.30,
      tradeDiscountPct: 13.5,
      reorderLevel: 20,
      defaultRackLocation: 'Glaucoma Bay Rack G-01',
      requiresPrescription: true,
      isAntibiotic: false,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: OPHTHALMIC_STORAGE_INSTRUCTION,
      batches: [
        {
          batchNumber: 'BMD-2402',
          mfgOffsetDays: -140,
          expOffsetDays: 390,
          initialQty: 120,
          currentStock: 92
        }
      ]
    },

    // --- 2. OPHTHALMIC OINTMENTS ---
    {
      sku: 'OPH-OINT-011',
      barcode: '8941100101116',
      name: 'Dexagen T Ophthalmic Ointment 3.5gm',
      genericName: 'Tobramycin + Dexamethasone',
      mfgCode: 'GPL',
      categoryId: ophthalmicCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_OINTMENT,
      route: AdministrationRoute.OPHTHALMIC,
      strength: '0.3% + 0.1% (3.5 gm)',
      unitOfMeasure: 'Tube',
      packSize: 1,
      mrp: 90.00,
      tradeDiscountPct: 13.5,
      reorderLevel: 15,
      defaultRackLocation: 'Ophthalmic Ointment Rack O-01',
      requiresPrescription: true,
      isAntibiotic: true,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: OPHTHALMIC_STORAGE_INSTRUCTION,
      batches: [
        {
          batchNumber: 'DXT-2401',
          mfgOffsetDays: -160,
          expOffsetDays: 400,
          initialQty: 90,
          currentStock: 65
        }
      ]
    },
    {
      sku: 'OPH-OINT-012',
      barcode: '8941100101123',
      name: 'Tobidex Ophthalmic Ointment 3.5gm',
      genericName: 'Tobramycin + Dexamethasone',
      mfgCode: 'GACO',
      categoryId: ophthalmicCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_OINTMENT,
      route: AdministrationRoute.OPHTHALMIC,
      strength: '0.3% + 0.1% (3.5 gm)',
      unitOfMeasure: 'Tube',
      packSize: 1,
      mrp: 105.00,
      tradeDiscountPct: 14.0,
      reorderLevel: 15,
      defaultRackLocation: 'Ophthalmic Ointment Rack O-01',
      requiresPrescription: true,
      isAntibiotic: true,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: OPHTHALMIC_STORAGE_INSTRUCTION,
      batches: [
        {
          batchNumber: 'TBO-2403',
          mfgOffsetDays: -120,
          expOffsetDays: 440,
          initialQty: 100,
          currentStock: 74
        }
      ]
    },
    {
      sku: 'OPH-OINT-013',
      barcode: '8941100101130',
      name: 'Torcin D Ophthalmic Ointment 3gm',
      genericName: 'Tobramycin + Dexamethasone',
      mfgCode: 'OPS',
      categoryId: ophthalmicCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_OINTMENT,
      route: AdministrationRoute.OPHTHALMIC,
      strength: '0.3% + 0.1% (3 gm)',
      unitOfMeasure: 'Tube',
      packSize: 1,
      mrp: 115.00,
      tradeDiscountPct: 13.0,
      reorderLevel: 15,
      defaultRackLocation: 'Ophthalmic Ointment Rack O-01',
      requiresPrescription: true,
      isAntibiotic: true,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: OPHTHALMIC_STORAGE_INSTRUCTION,
      batches: [
        {
          batchNumber: 'TRC-2404',
          mfgOffsetDays: -100,
          expOffsetDays: 460,
          initialQty: 85,
          currentStock: 59
        }
      ]
    },
    {
      sku: 'OPH-OINT-014',
      barcode: '8941100101147',
      name: 'T-Mycin Plus Ophthalmic Ointment 3.5gm',
      genericName: 'Tobramycin + Dexamethasone',
      mfgCode: 'ARIS',
      categoryId: ophthalmicCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_OINTMENT,
      route: AdministrationRoute.OPHTHALMIC,
      strength: '0.3% + 0.1% (3.5 gm)',
      unitOfMeasure: 'Tube',
      packSize: 1,
      mrp: 150.00,
      tradeDiscountPct: 14.5,
      reorderLevel: 20,
      defaultRackLocation: 'Ophthalmic Ointment Rack O-01',
      requiresPrescription: true,
      isAntibiotic: true,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: OPHTHALMIC_STORAGE_INSTRUCTION,
      batches: [
        {
          batchNumber: 'TMP-2402',
          mfgOffsetDays: -80,
          expOffsetDays: 520,
          initialQty: 110,
          currentStock: 88
        }
      ]
    },
    {
      sku: 'OPH-OINT-015',
      barcode: '8941100101154',
      name: 'Polytracin Ophthalmic Ointment 3gm',
      genericName: 'Bacitracin Zinc + Polymyxin B Sulfate',
      mfgCode: 'IBN',
      categoryId: ophthalmicCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_OINTMENT,
      route: AdministrationRoute.OPHTHALMIC,
      strength: '500 IU + 10,000 IU/g (3 gm)',
      unitOfMeasure: 'Tube',
      packSize: 1,
      mrp: 35.23,
      tradeDiscountPct: 12.0,
      reorderLevel: 25,
      defaultRackLocation: 'Ophthalmic Ointment Rack O-02',
      requiresPrescription: true,
      isAntibiotic: true,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: OPHTHALMIC_STORAGE_INSTRUCTION,
      batches: [
        {
          batchNumber: 'PLY-2401',
          mfgOffsetDays: -140,
          expOffsetDays: 370,
          initialQty: 150,
          currentStock: 112
        }
      ]
    },
    {
      sku: 'OPH-OINT-016',
      barcode: '8941100101161',
      name: 'Polymix Ophthalmic Ointment 5gm',
      genericName: 'Bacitracin Zinc + Polymyxin B Sulfate',
      mfgCode: 'OSL',
      categoryId: ophthalmicCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_OINTMENT,
      route: AdministrationRoute.OPHTHALMIC,
      strength: '500 IU + 10,000 IU/g (5 gm)',
      unitOfMeasure: 'Tube',
      packSize: 1,
      mrp: 65.00,
      tradeDiscountPct: 13.5,
      reorderLevel: 20,
      defaultRackLocation: 'Ophthalmic Ointment Rack O-02',
      requiresPrescription: true,
      isAntibiotic: true,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: OPHTHALMIC_STORAGE_INSTRUCTION,
      batches: [
        {
          batchNumber: 'PMX-2403',
          mfgOffsetDays: -110,
          expOffsetDays: 410,
          initialQty: 100,
          currentStock: 76
        }
      ]
    },
    {
      sku: 'OPH-OINT-017',
      barcode: '8941100101178',
      name: 'Opsophenicol 1% Ophthalmic Ointment 3.5gm',
      genericName: 'Chloramphenicol (1%)',
      mfgCode: 'OPS',
      categoryId: ophthalmicCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_OINTMENT,
      route: AdministrationRoute.OPHTHALMIC,
      strength: '1% (3.5 gm)',
      unitOfMeasure: 'Tube',
      packSize: 1,
      mrp: 35.00,
      tradeDiscountPct: 12.5,
      reorderLevel: 30,
      defaultRackLocation: 'Ophthalmic Ointment Rack O-03',
      requiresPrescription: true,
      isAntibiotic: true,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: OPHTHALMIC_STORAGE_INSTRUCTION,
      batches: [
        {
          batchNumber: 'OPH-2401',
          mfgOffsetDays: -150,
          expOffsetDays: 390,
          initialQty: 180,
          currentStock: 135
        }
      ]
    },
    {
      sku: 'OPH-OINT-018',
      barcode: '8941100101185',
      name: 'Chloramex 1% Ophthalmic Ointment 3.5gm',
      genericName: 'Chloramphenicol (1%)',
      mfgCode: 'SQR',
      categoryId: ophthalmicCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_OINTMENT,
      route: AdministrationRoute.OPHTHALMIC,
      strength: '1% (3.5 gm)',
      unitOfMeasure: 'Tube',
      packSize: 1,
      mrp: 45.00,
      tradeDiscountPct: 13.0,
      reorderLevel: 25,
      defaultRackLocation: 'Ophthalmic Ointment Rack O-03',
      requiresPrescription: true,
      isAntibiotic: true,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: OPHTHALMIC_STORAGE_INSTRUCTION,
      batches: [
        {
          batchNumber: 'CHL-2405',
          mfgOffsetDays: -90,
          expOffsetDays: 450,
          initialQty: 140,
          currentStock: 108
        }
      ]
    },

    // --- 3. OPHTHALMIC GELS & VISCOELASTICS ---
    {
      sku: 'OPH-GEL-019',
      barcode: '8941100101192',
      name: 'Eye Gel 2% (Pre-filled Viscoelastic Syringe 3ml)',
      genericName: 'Hydroxypropyl Methylcellulose (2%) / Carbomer',
      mfgCode: 'OSL',
      categoryId: ophthalmicCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_GEL,
      route: AdministrationRoute.OPHTHALMIC,
      strength: '2% (20mg/ml, 3 ml Syringe)',
      unitOfMeasure: 'Piece',
      packSize: 1,
      mrp: 120.45,
      tradeDiscountPct: 14.5,
      reorderLevel: 15,
      defaultRackLocation: 'Eye Surgery & Visco Vault S-01',
      requiresPrescription: true, // Intraocular surgical aid
      isAntibiotic: false,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: 'Store between 2°C and 25°C. Protect from freezing and light. Single surgical use.',
      batches: [
        {
          batchNumber: 'EYG-2402',
          mfgOffsetDays: -70,
          expOffsetDays: 600,
          initialQty: 80,
          currentStock: 62
        }
      ]
    },
    {
      sku: 'OPH-GEL-020',
      barcode: '8941100101208',
      name: 'Viscogel Ophthalmic Gel 5gm',
      genericName: 'Hydroxypropyl Methylcellulose (2%) / Carbomer',
      mfgCode: 'GPL',
      categoryId: lubricantCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_GEL,
      route: AdministrationRoute.OPHTHALMIC,
      strength: 'Carbomer 0.2% (5 gm)',
      unitOfMeasure: 'Tube',
      packSize: 1,
      mrp: 108.00,
      tradeDiscountPct: 13.5,
      reorderLevel: 20,
      defaultRackLocation: 'Ophthalmic Gel Bay G-02',
      requiresPrescription: false, // Nighttime lubricant
      isAntibiotic: false,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: OPHTHALMIC_STORAGE_INSTRUCTION,
      batches: [
        {
          batchNumber: 'VSG-2401',
          mfgOffsetDays: -130,
          expOffsetDays: 410,
          initialQty: 100,
          currentStock: 82
        }
      ]
    },
    {
      sku: 'OPH-GEL-021',
      barcode: '8941100101215',
      name: 'Tear-Gel Ophthalmic Gel 5gm',
      genericName: 'Hydroxypropyl Methylcellulose (2%) / Carbomer',
      mfgCode: 'ARIS',
      categoryId: lubricantCategory.id,
      dosageForm: DosageForm.OPHTHALMIC_GEL,
      route: AdministrationRoute.OPHTHALMIC,
      strength: 'Carbomer 0.2% (5 gm)',
      unitOfMeasure: 'Tube',
      packSize: 1,
      mrp: 140.00,
      tradeDiscountPct: 14.0,
      reorderLevel: 20,
      defaultRackLocation: 'Ophthalmic Gel Bay G-02',
      requiresPrescription: false,
      isAntibiotic: false,
      storageCondition: StorageCondition.STORE_BELOW_25_OPHTHALMIC,
      storageInstructions: OPHTHALMIC_STORAGE_INSTRUCTION,
      batches: [
        {
          batchNumber: 'TRG-2403',
          mfgOffsetDays: -85,
          expOffsetDays: 480,
          initialQty: 120,
          currentStock: 98
        }
      ]
    }
  ];

  const today = new Date();
  const computeDate = (offsetDays: number): Date => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d;
  };

  for (const item of productsDataset) {
    const genericId = genMap.get(item.genericName);
    const mfgId = mfgMap.get(item.mfgCode);

    if (!genericId || !mfgId) {
      console.warn(`Skipping ${item.name}: Missing generic or manufacturer reference`);
      continue;
    }

    const product = await prisma.product.upsert({
      where: { sku: item.sku },
      update: {
        barcode: item.barcode,
        name: item.name,
        genericId,
        manufacturerId: mfgId,
        categoryId: item.categoryId,
        dosageForm: item.dosageForm,
        route: item.route,
        strength: item.strength,
        unitOfMeasure: item.unitOfMeasure,
        packSize: item.packSize,
        reorderLevel: item.reorderLevel,
        defaultRackLocation: item.defaultRackLocation,
        requiresPrescription: item.requiresPrescription,
        isAntibiotic: item.isAntibiotic,
        storageCondition: item.storageCondition,
        storageInstructions: item.storageInstructions
      },
      create: {
        id: `prod-${item.sku.toLowerCase()}`,
        sku: item.sku,
        barcode: item.barcode,
        name: item.name,
        genericId,
        manufacturerId: mfgId,
        categoryId: item.categoryId,
        dosageForm: item.dosageForm,
        route: item.route,
        strength: item.strength,
        unitOfMeasure: item.unitOfMeasure,
        packSize: item.packSize,
        reorderLevel: item.reorderLevel,
        defaultRackLocation: item.defaultRackLocation,
        requiresPrescription: item.requiresPrescription,
        isAntibiotic: item.isAntibiotic,
        storageCondition: item.storageCondition,
        storageInstructions: item.storageInstructions
      }
    });

    // Seed Batches for product
    for (const b of item.batches) {
      const mfgDate = computeDate(b.mfgOffsetDays);
      const expDate = computeDate(b.expOffsetDays);
      const purchasePrice = calculatePurchasePrice(item.mrp, item.tradeDiscountPct);

      // Determine batch status: near_expiry if expiring within 60 days
      const daysUntilExpiry = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const status: BatchStatus = daysUntilExpiry <= 0 ? BatchStatus.EXPIRED : daysUntilExpiry <= 60 ? BatchStatus.NEAR_EXPIRY : BatchStatus.ACTIVE;

      await prisma.batch.upsert({
        where: { id: `bat-${b.batchNumber.toLowerCase()}` },
        update: {
          batchNumber: b.batchNumber,
          productId: product.id,
          manufacturingDate: mfgDate,
          expiryDate: expDate,
          purchasePrice,
          mrp: item.mrp,
          unitSellingPrice: item.mrp,
          currentStock: b.currentStock,
          initialQuantity: b.initialQty,
          status,
          rackLocation: item.defaultRackLocation
        },
        create: {
          id: `bat-${b.batchNumber.toLowerCase()}` ,
          batchNumber: b.batchNumber,
          productId: product.id,
          manufacturingDate: mfgDate,
          expiryDate: expDate,
          purchasePrice,
          mrp: item.mrp,
          unitSellingPrice: item.mrp,
          initialQuantity: b.initialQty,
          currentStock: b.currentStock,
          status,
          rackLocation: item.defaultRackLocation
        }
      });
    }
  }

  console.log('✅ Successfully seeded 21 Ophthalmic items, 8 Generics, 8 Manufacturers, and active FEFO Batches into Database!');
}

main()
  .catch((e) => {
    console.error('❌ Error executing Prisma seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
