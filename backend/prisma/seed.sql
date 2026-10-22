-- ==============================================================================
-- PHARMACY MANAGEMENT SAAS - BANGLADESH OPHTHALMIC DATA SEED SCRIPT (RAW SQL)
-- Target RDBMS: PostgreSQL 14+ / Cloud SQL for PostgreSQL
-- Dataset Source: MedEx Bangladesh & DGDA Registered Drug List
-- Hospital: Madina Eye Hospital & Pharmacy Services Ltd.
-- ==============================================================================

BEGIN;

-- 1. SEED CATEGORIES
INSERT INTO categories (id, name, slug, description, "createdAt", "updatedAt")
VALUES 
  ('cat-ophthalmic', 'Ophthalmic & ENT', 'ophthalmic-ent', 'Sterile ophthalmic preparations, eye drops, ointments, ocular lubricants, and surgical viscoelastics.', NOW(), NOW()),
  ('cat-glaucoma', 'Antiglaucoma Preparations', 'antiglaucoma-preparations', 'Intraocular pressure lowering drops, prostaglandin analogues, alpha-agonists, and beta blockers.', NOW(), NOW()),
  ('cat-lubricants', 'Ocular Lubricants & Artificial Tears', 'ocular-lubricants-artificial-tears', 'Demulcents and viscoelastic eye drops/gels for dry eye syndrome and ocular surface discomfort.', NOW(), NOW())
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description, "updatedAt" = NOW();

-- 2. SEED MANUFACTURERS (BANGLADESH DGDA REGISTERED)
INSERT INTO manufacturers (id, name, code, "contactPerson", phone, email, address, country, "isActive", "createdAt", "updatedAt")
VALUES
  ('mfg-general', 'General Pharmaceuticals Ltd.', 'GPL', 'Depot Manager (Ophthalmic Div)', '+880-2-9663244', 'info@generalpharma.com', 'House 24, Road 13/A, Block D, Banani, Dhaka-1213', 'Bangladesh', true, NOW(), NOW()),
  ('mfg-gaco', 'Gaco Pharmaceuticals Ltd.', 'GACO', 'Institutional Sales Officer', '+880-2-9887711', 'sales@gacopharma.com', 'Gulshan Grace, Plot 8, Road 11, South Avenue, Gulshan-1, Dhaka', 'Bangladesh', true, NOW(), NOW()),
  ('mfg-incepta', 'Incepta Pharmaceuticals Ltd.', 'INCP', 'Key Account Manager (Eye Care)', '+880-2-8891688', 'incepta@inceptapharma.com', '40 Shahid Tajuddin Ahmed Sarani, Tejgaon I/A, Dhaka-1208', 'Bangladesh', true, NOW(), NOW()),
  ('mfg-square', 'Square Pharmaceuticals PLC', 'SQR', 'Regional Eye Care Representative', '+880-2-8833047', 'info@squaregroup.com', 'Square Centre, 48 Mohakhali C/A, Dhaka-1212', 'Bangladesh', true, NOW(), NOW()),
  ('mfg-aristo', 'Aristopharma Ltd.', 'ARIS', 'Hospital Supply Executive', '+880-2-9351691', 'marketing@aristopharma.com', '7 Purana Paltan Line, Dhaka-1000', 'Bangladesh', true, NOW(), NOW()),
  ('mfg-opsonin', 'Opsonin Pharma Ltd.', 'OPS', 'Depot Distribution Officer', '+880-2-9850616', 'info@opsonin-pharma.com', 'Opsonin Building, 30 New Eskaton Road, Dhaka-1000', 'Bangladesh', true, NOW(), NOW()),
  ('mfg-ibnsina', 'The Ibn Sina Pharmaceutical Industry PLC', 'IBN', 'Medical Promotion Officer', '+880-2-9014705', 'pharma@ibnsinapharma.com', '1/1, B/1, Kallyanpur, Mirpur Road, Dhaka-1207', 'Bangladesh', true, NOW(), NOW()),
  ('mfg-osl', 'Opso Saline Ltd. (OSL Pharma)', 'OSL', 'Surgical & Ophthalmic In-charge', '+880-2-9844431', 'saline@opsosaline.com', '30 New Eskaton Road, Dhaka-1000', 'Bangladesh', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, code = EXCLUDED.code, "updatedAt" = NOW();

-- 3. SEED GENERICS (MEDEX PHARMACOLOGICAL PROFILES)
INSERT INTO generics (id, name, "therapeuticClass", description, indication, contraindications, "sideEffects", "createdAt", "updatedAt")
VALUES
  ('gen-tobra-dex', 'Tobramycin + Dexamethasone', 'Ophthalmic Antibacterial & Corticosteroid Combinations', 
   'Fixed-dose combination of aminoglycoside antibacterial (Tobramycin) and potent anti-inflammatory corticosteroid (Dexamethasone).',
   'Steroid-responsive inflammatory ocular conditions with bacterial infection or suspected bacterial infection risk.',
   'Viral diseases of cornea and conjunctiva including epithelial herpes simplex keratitis, vaccinia, varicella, fungal infections.',
   'Transient ocular irritation, burning, stinging, conjunctival erythema, elevated intraocular pressure.', NOW(), NOW()),
  
  ('gen-moxi', 'Moxifloxacin (0.5%)', '4th Generation Fluoroquinolone Antibacterial',
   'Broad-spectrum 8-methoxy fluoroquinolone ophthalmic solution active against Gram-positive, Gram-negative, and atypical ocular pathogens.',
   'Treatment of bacterial conjunctivitis, corneal ulcers, bacterial keratitis, and pre/post-operative surgical infection prophylaxis.',
   'Hypersensitivity to moxifloxacin, other quinolones, or any excipients.',
   'Transient eye discomfort, decreased visual acuity, subconjunctival hemorrhage, dry eye.', NOW(), NOW()),

  ('gen-cmc', 'Carboxymethylcellulose Sodium (0.5%)', 'Ocular Lubricant & Demulcent (Artificial Tears)',
   'High-viscosity polymer matrix providing long-lasting hydration, lubrication, and corneal epithelial healing in dry eyes.',
   'Temporary relief of burning, irritation, dryness, and ocular fatigue caused by environmental exposure, wind, screen time, or post-LASIK.',
   'Hypersensitivity to carboxymethylcellulose sodium.',
   'Mild temporary blurred vision immediately upon instillation, minor matting of eyelashes.', NOW(), NOW()),

  ('gen-olopatadine', 'Olopatadine (0.1% / 0.2%)', 'Dual Action Mast Cell Stabilizer & Selective H1-Antagonist',
   'Ophthalmic anti-allergic agent preventing mast cell degranulation and blocking histamine H1-receptors.',
   'Treatment of signs and symptoms of allergic conjunctivitis (seasonal and perennial ocular itching, redness, tearing).',
   'Known hypersensitivity to olopatadine hydrochloride.',
   'Headache, asthenia, ocular burning, stinging, foreign body sensation.', NOW(), NOW()),

  ('gen-brimonidine', 'Brimonidine Tartrate (0.2%)', 'Alpha-2 Adrenergic Receptor Agonist (Antiglaucoma)',
   'Selective alpha-2 adrenergic agonist reducing intraocular pressure (IOP) by decreasing aqueous humor synthesis and increasing uveoscleral outflow.',
   'Reduction of elevated intraocular pressure in patients with open-angle glaucoma or ocular hypertension.',
   'Patients receiving monoamine oxidase (MAO) inhibitor therapy, neonates and children under 2 years of age.',
   'Ocular hyperemia, burning, visual disturbance, foreign body sensation, fatigue, dry mouth.', NOW(), NOW()),

  ('gen-baci-poly', 'Bacitracin Zinc + Polymyxin B Sulfate', 'Topical Ophthalmic Antibacterial Combination',
   'Synergistic combination of polypeptide antibiotics effective against both Gram-positive and Gram-negative ocular organisms.',
   'Superficial ocular infections involving conjunctiva and/or cornea (acute blepharoconjunctivitis, infected styes, corneal abrasions).',
   'Hypersensitivity to bacitracin or polymyxin B sulfate.',
   'Allergic contact dermatitis, local itching, eyelid swelling.', NOW(), NOW()),

  ('gen-chloram', 'Chloramphenicol (1%)', 'Broad-Spectrum Phenicol Antibacterial',
   'Lipid-soluble bacteriostatic antibiotic inhibiting microbial protein synthesis by binding to 50S ribosomal subunits.',
   'Bacterial conjunctivitis, blepharitis, superficial ocular infections caused by susceptible organisms.',
   'Personal or family history of blood dyscrasias, bone marrow depression, hypersensitivity.',
   'Transient burning, stinging, rare systemic hematological toxicities.', NOW(), NOW()),

  ('gen-hpmc-carbomer', 'Hydroxypropyl Methylcellulose (2%) / Carbomer', 'Ophthalmic Viscoelastic Surgical Aid & Tear Gel',
   'Sterile, non-pyrogenic viscoelastic biopolymer maintaining anterior chamber depth during intraocular surgery, and lubricating gels for severe dry eye.',
   'Surgical aid in anterior segment ophthalmic surgery (cataract extraction, IOL implantation); severe dry eye / keratoconjunctivitis sicca.',
   'Known hypersensitivity to methylcellulose or carbomer derivatives.',
   'Transient postoperative rise in intraocular pressure, blurred vision, eyelid stickiness.', NOW(), NOW())
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, "therapeuticClass" = EXCLUDED."therapeuticClass", "updatedAt" = NOW();

-- 4. SEED PRODUCTS
INSERT INTO products (
  id, sku, barcode, name, "genericId", "manufacturerId", "categoryId", "dosageForm", route, strength, 
  "unitOfMeasure", "packSize", "reorderLevel", "defaultRackLocation", "requiresPrescription", "isAntibiotic", 
  "storageCondition", "storageInstructions", "vatRate", "createdAt", "updatedAt"
) VALUES
  -- 1. Drops
  ('prod-oph-001', 'OPH-DROP-001', '8941100101017', 'Tobradex Ophthalmic Drop 5ml', 'gen-tobra-dex', 'mfg-general', 'cat-ophthalmic', 'OPHTHALMIC_DROP', 'OPHTHALMIC', '0.3% + 0.1% (5 ml)', 'Vial', 1, 25, 'Ophthalmic Bay Rack E-01', true, true, 'STORE_BELOW_25_OPHTHALMIC', 'Store below 25°C. Protect from light. Do not freeze. Discard 28 days after first opening.', 5.00, NOW(), NOW()),
  ('prod-oph-002', 'OPH-DROP-002', '8941100101024', 'Tobidex Ophthalmic Drop 5ml', 'gen-tobra-dex', 'mfg-gaco', 'cat-ophthalmic', 'OPHTHALMIC_DROP', 'OPHTHALMIC', '0.3% + 0.1% (5 ml)', 'Vial', 1, 20, 'Ophthalmic Bay Rack E-01', true, true, 'STORE_BELOW_25_OPHTHALMIC', 'Store below 25°C. Protect from light. Do not freeze. Discard 28 days after first opening.', 5.00, NOW(), NOW()),
  ('prod-oph-003', 'OPH-DROP-003', '8941100101031', 'Moxicin Eye Drop 5ml', 'gen-moxi', 'mfg-square', 'cat-ophthalmic', 'OPHTHALMIC_DROP', 'OPHTHALMIC', '0.5% (5 ml)', 'Vial', 1, 30, 'Ophthalmic Bay Rack E-02', true, true, 'STORE_BELOW_25_OPHTHALMIC', 'Store below 25°C. Protect from light. Do not freeze. Discard 28 days after first opening.', 5.00, NOW(), NOW()),
  ('prod-oph-004', 'OPH-DROP-004', '8941100101048', 'Flomox Eye Drop 5ml', 'gen-moxi', 'mfg-incepta', 'cat-ophthalmic', 'OPHTHALMIC_DROP', 'OPHTHALMIC', '0.5% (5 ml)', 'Vial', 1, 25, 'Ophthalmic Bay Rack E-02', true, true, 'STORE_BELOW_25_OPHTHALMIC', 'Store below 25°C. Protect from light. Do not freeze. Discard 28 days after first opening.', 5.00, NOW(), NOW()),
  ('prod-oph-005', 'OPH-DROP-005', '8941100101055', 'Lubrex 0.5% Eye Drop 10ml', 'gen-cmc', 'mfg-aristo', 'cat-lubricants', 'OPHTHALMIC_DROP', 'OPHTHALMIC', '0.5% (10 ml)', 'Vial', 1, 40, 'Ophthalmic Bay Rack E-03', false, false, 'STORE_BELOW_25_OPHTHALMIC', 'Store below 25°C. Protect from light. Do not freeze. Discard 28 days after first opening.', 5.00, NOW(), NOW()),
  ('prod-oph-006', 'OPH-DROP-006', '8941100101062', 'Tear-Off Eye Drop 10ml', 'gen-cmc', 'mfg-square', 'cat-lubricants', 'OPHTHALMIC_DROP', 'OPHTHALMIC', '0.5% (10 ml)', 'Vial', 1, 35, 'Ophthalmic Bay Rack E-03', false, false, 'STORE_BELOW_25_OPHTHALMIC', 'Store below 25°C. Protect from light. Do not freeze. Discard 28 days after first opening.', 5.00, NOW(), NOW()),
  ('prod-oph-007', 'OPH-DROP-007', '8941100101079', 'Patadin 0.1% Eye Drop 5ml', 'gen-olopatadine', 'mfg-incepta', 'cat-ophthalmic', 'OPHTHALMIC_DROP', 'OPHTHALMIC', '0.1% (5 ml)', 'Vial', 1, 25, 'Ophthalmic Bay Rack E-04', true, false, 'STORE_BELOW_25_OPHTHALMIC', 'Store below 25°C. Protect from light. Do not freeze. Discard 28 days after first opening.', 5.00, NOW(), NOW()),
  ('prod-oph-008', 'OPH-DROP-008', '8941100101086', 'Alastat 0.2% Eye Drop 5ml', 'gen-olopatadine', 'mfg-square', 'cat-ophthalmic', 'OPHTHALMIC_DROP', 'OPHTHALMIC', '0.2% (5 ml)', 'Vial', 1, 20, 'Ophthalmic Bay Rack E-04', true, false, 'STORE_BELOW_25_OPHTHALMIC', 'Store below 25°C. Protect from light. Do not freeze. Discard 28 days after first opening.', 5.00, NOW(), NOW()),
  ('prod-oph-009', 'OPH-DROP-009', '8941100101093', 'Bricoma Eye Drop 5ml', 'gen-brimonidine', 'mfg-opsonin', 'cat-glaucoma', 'OPHTHALMIC_DROP', 'OPHTHALMIC', '0.2% (5 ml)', 'Vial', 1, 20, 'Glaucoma Bay Rack G-01', true, false, 'STORE_BELOW_25_OPHTHALMIC', 'Store below 25°C. Protect from light. Do not freeze. Discard 28 days after first opening.', 5.00, NOW(), NOW()),
  ('prod-oph-010', 'OPH-DROP-010', '8941100101109', 'Brimodin Eye Drop 5ml', 'gen-brimonidine', 'mfg-incepta', 'cat-glaucoma', 'OPHTHALMIC_DROP', 'OPHTHALMIC', '0.2% (5 ml)', 'Vial', 1, 20, 'Glaucoma Bay Rack G-01', true, false, 'STORE_BELOW_25_OPHTHALMIC', 'Store below 25°C. Protect from light. Do not freeze. Discard 28 days after first opening.', 5.00, NOW(), NOW()),

  -- 2. Ointments
  ('prod-oph-011', 'OPH-OINT-011', '8941100101116', 'Dexagen T Ophthalmic Ointment 3.5gm', 'gen-tobra-dex', 'mfg-general', 'cat-ophthalmic', 'OPHTHALMIC_OINTMENT', 'OPHTHALMIC', '0.3% + 0.1% (3.5 gm)', 'Tube', 1, 15, 'Ophthalmic Ointment Rack O-01', true, true, 'STORE_BELOW_25_OPHTHALMIC', 'Store below 25°C. Protect from light. Do not freeze. Discard 28 days after opening.', 5.00, NOW(), NOW()),
  ('prod-oph-012', 'OPH-OINT-012', '8941100101123', 'Tobidex Ophthalmic Ointment 3.5gm', 'gen-tobra-dex', 'mfg-gaco', 'cat-ophthalmic', 'OPHTHALMIC_OINTMENT', 'OPHTHALMIC', '0.3% + 0.1% (3.5 gm)', 'Tube', 1, 15, 'Ophthalmic Ointment Rack O-01', true, true, 'STORE_BELOW_25_OPHTHALMIC', 'Store below 25°C. Protect from light. Do not freeze. Discard 28 days after opening.', 5.00, NOW(), NOW()),
  ('prod-oph-013', 'OPH-OINT-013', '8941100101130', 'Torcin D Ophthalmic Ointment 3gm', 'gen-tobra-dex', 'mfg-opsonin', 'cat-ophthalmic', 'OPHTHALMIC_OINTMENT', 'OPHTHALMIC', '0.3% + 0.1% (3 gm)', 'Tube', 1, 15, 'Ophthalmic Ointment Rack O-01', true, true, 'STORE_BELOW_25_OPHTHALMIC', 'Store below 25°C. Protect from light. Do not freeze. Discard 28 days after opening.', 5.00, NOW(), NOW()),
  ('prod-oph-014', 'OPH-OINT-014', '8941100101147', 'T-Mycin Plus Ophthalmic Ointment 3.5gm', 'gen-tobra-dex', 'mfg-aristo', 'cat-ophthalmic', 'OPHTHALMIC_OINTMENT', 'OPHTHALMIC', '0.3% + 0.1% (3.5 gm)', 'Tube', 1, 20, 'Ophthalmic Ointment Rack O-01', true, true, 'STORE_BELOW_25_OPHTHALMIC', 'Store below 25°C. Protect from light. Do not freeze. Discard 28 days after opening.', 5.00, NOW(), NOW()),
  ('prod-oph-015', 'OPH-OINT-015', '8941100101154', 'Polytracin Ophthalmic Ointment 3gm', 'gen-baci-poly', 'mfg-ibnsina', 'cat-ophthalmic', 'OPHTHALMIC_OINTMENT', 'OPHTHALMIC', '500 IU + 10,000 IU/g (3 gm)', 'Tube', 1, 25, 'Ophthalmic Ointment Rack O-02', true, true, 'STORE_BELOW_25_OPHTHALMIC', 'Store below 25°C. Protect from heat and light. Discard 28 days after opening.', 5.00, NOW(), NOW()),
  ('prod-oph-016', 'OPH-OINT-016', '8941100101161', 'Polymix Ophthalmic Ointment 5gm', 'gen-baci-poly', 'mfg-osl', 'cat-ophthalmic', 'OPHTHALMIC_OINTMENT', 'OPHTHALMIC', '500 IU + 10,000 IU/g (5 gm)', 'Tube', 1, 20, 'Ophthalmic Ointment Rack O-02', true, true, 'STORE_BELOW_25_OPHTHALMIC', 'Store below 25°C. Protect from heat and light. Discard 28 days after opening.', 5.00, NOW(), NOW()),
  ('prod-oph-017', 'OPH-OINT-017', '8941100101178', 'Opsophenicol 1% Ophthalmic Ointment 3.5gm', 'gen-chloram', 'mfg-opsonin', 'cat-ophthalmic', 'OPHTHALMIC_OINTMENT', 'OPHTHALMIC', '1% (3.5 gm)', 'Tube', 1, 30, 'Ophthalmic Ointment Rack O-03', true, true, 'STORE_BELOW_25_OPHTHALMIC', 'Store below 25°C. Protect from light. Discard 28 days after opening.', 5.00, NOW(), NOW()),
  ('prod-oph-018', 'OPH-OINT-018', '8941100101185', 'Chloramex 1% Ophthalmic Ointment 3.5gm', 'gen-chloram', 'mfg-square', 'cat-ophthalmic', 'OPHTHALMIC_OINTMENT', 'OPHTHALMIC', '1% (3.5 gm)', 'Tube', 1, 25, 'Ophthalmic Ointment Rack O-03', true, true, 'STORE_BELOW_25_OPHTHALMIC', 'Store below 25°C. Protect from light. Discard 28 days after opening.', 5.00, NOW(), NOW()),

  -- 3. Gels & Viscoelastics
  ('prod-oph-019', 'OPH-GEL-019', '8941100101192', 'Eye Gel 2% (Pre-filled Viscoelastic Syringe 3ml)', 'gen-hpmc-carbomer', 'mfg-osl', 'cat-ophthalmic', 'OPHTHALMIC_GEL', 'OPHTHALMIC', '2% (20mg/ml, 3 ml Syringe)', 'Piece', 1, 15, 'Eye Surgery & Visco Vault S-01', true, false, 'STORE_BELOW_25_OPHTHALMIC', 'Store between 2°C and 25°C. Protect from freezing and light. Single surgical use.', 5.00, NOW(), NOW()),
  ('prod-oph-020', 'OPH-GEL-020', '8941100101208', 'Viscogel Ophthalmic Gel 5gm', 'gen-hpmc-carbomer', 'mfg-general', 'cat-lubricants', 'OPHTHALMIC_GEL', 'OPHTHALMIC', 'Carbomer 0.2% (5 gm)', 'Tube', 1, 20, 'Ophthalmic Gel Bay G-02', false, false, 'STORE_BELOW_25_OPHTHALMIC', 'Store below 25°C. Protect from light. Do not freeze. Discard 28 days after opening.', 5.00, NOW(), NOW()),
  ('prod-oph-021', 'OPH-GEL-021', '8941100101215', 'Tear-Gel Ophthalmic Gel 5gm', 'gen-hpmc-carbomer', 'mfg-aristo', 'cat-lubricants', 'OPHTHALMIC_GEL', 'OPHTHALMIC', 'Carbomer 0.2% (5 gm)', 'Tube', 1, 20, 'Ophthalmic Gel Bay G-02', false, false, 'STORE_BELOW_25_OPHTHALMIC', 'Store below 25°C. Protect from light. Do not freeze. Discard 28 days after opening.', 5.00, NOW(), NOW())
ON CONFLICT (sku) DO UPDATE
SET barcode = EXCLUDED.barcode, name = EXCLUDED.name, "defaultRackLocation" = EXCLUDED."defaultRackLocation", "updatedAt" = NOW();

-- 5. SEED FEFO BATCHES WITH 12-15% TRADE DISCOUNT COST PRICING
INSERT INTO batches (
  id, "batchNumber", "productId", "manufacturingDate", "expiryDate", "purchasePrice", mrp, "unitSellingPrice",
  "initialQuantity", "currentStock", "rackLocation", status, "createdAt", "updatedAt"
) VALUES
  -- Tobradex 5ml (MRP ৳145.00, Trade Discount 13.5% -> Purchase Cost ৳125.43)
  ('bat-tbx-2401', 'TBX-2401', 'prod-oph-001', CURRENT_DATE - INTERVAL '180 days', CURRENT_DATE + INTERVAL '360 days', 125.43, 145.00, 145.00, 100, 68, 'Ophthalmic Bay Rack E-01', 'ACTIVE', NOW(), NOW()),
  ('bat-tbx-2402', 'TBX-2402', 'prod-oph-001', CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '540 days', 125.43, 145.00, 145.00, 150, 145, 'Ophthalmic Bay Rack E-01', 'ACTIVE', NOW(), NOW()),

  -- Tobidex 5ml (MRP ৳150.00, Trade Discount 14.0% -> Purchase Cost ৳129.00)
  ('bat-tbd-2403', 'TBD-2403', 'prod-oph-002', CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE + INTERVAL '450 days', 129.00, 150.00, 150.00, 120, 95, 'Ophthalmic Bay Rack E-01', 'ACTIVE', NOW(), NOW()),

  -- Moxicin 5ml (MRP ৳150.00, Trade Discount 13.0% -> Purchase Cost ৳130.50)
  ('bat-mxc-2408', 'MXC-2408', 'prod-oph-003', CURRENT_DATE - INTERVAL '120 days', CURRENT_DATE + INTERVAL '480 days', 130.50, 150.00, 150.00, 200, 165, 'Ophthalmic Bay Rack E-02', 'ACTIVE', NOW(), NOW()),
  ('bat-mxc-2311', 'MXC-2311', 'prod-oph-003', CURRENT_DATE - INTERVAL '420 days', CURRENT_DATE + INTERVAL '45 days', 130.50, 150.00, 150.00, 80, 12, 'Ophthalmic Bay Rack E-02', 'NEAR_EXPIRY', NOW(), NOW()),

  -- Flomox 5ml (MRP ৳140.00, Trade Discount 13.5% -> Purchase Cost ৳121.10)
  ('bat-flx-2405', 'FLX-2405', 'prod-oph-004', CURRENT_DATE - INTERVAL '80 days', CURRENT_DATE + INTERVAL '400 days', 121.10, 140.00, 140.00, 150, 110, 'Ophthalmic Bay Rack E-02', 'ACTIVE', NOW(), NOW()),

  -- Lubrex 10ml (MRP ৳150.00, Trade Discount 14.0% -> Purchase Cost ৳129.00)
  ('bat-lbr-2404', 'LBR-2404', 'prod-oph-005', CURRENT_DATE - INTERVAL '100 days', CURRENT_DATE + INTERVAL '520 days', 129.00, 150.00, 150.00, 250, 215, 'Ophthalmic Bay Rack E-03', 'ACTIVE', NOW(), NOW()),

  -- Tear-Off 10ml (MRP ৳120.00, Trade Discount 13.0% -> Purchase Cost ৳104.40)
  ('bat-trf-2402', 'TRF-2402', 'prod-oph-006', CURRENT_DATE - INTERVAL '150 days', CURRENT_DATE + INTERVAL '450 days', 104.40, 120.00, 120.00, 180, 140, 'Ophthalmic Bay Rack E-03', 'ACTIVE', NOW(), NOW()),

  -- Patadin 5ml (MRP ৳120.00, Trade Discount 14.0% -> Purchase Cost ৳103.20)
  ('bat-ptd-2401', 'PTD-2401', 'prod-oph-007', CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE + INTERVAL '380 days', 103.20, 120.00, 120.00, 130, 104, 'Ophthalmic Bay Rack E-04', 'ACTIVE', NOW(), NOW()),

  -- Alastat 5ml (MRP ৳160.00, Trade Discount 13.5% -> Purchase Cost ৳138.40)
  ('bat-als-2406', 'ALS-2406', 'prod-oph-008', CURRENT_DATE - INTERVAL '75 days', CURRENT_DATE + INTERVAL '460 days', 138.40, 160.00, 160.00, 140, 118, 'Ophthalmic Bay Rack E-04', 'ACTIVE', NOW(), NOW()),

  -- Bricoma 5ml (MRP ৳80.00, Trade Discount 14.0% -> Purchase Cost ৳68.80)
  ('bat-brc-2403', 'BRC-2403', 'prod-oph-009', CURRENT_DATE - INTERVAL '110 days', CURRENT_DATE + INTERVAL '420 days', 68.80, 80.00, 80.00, 110, 82, 'Glaucoma Bay Rack G-01', 'ACTIVE', NOW(), NOW()),

  -- Brimodin 5ml (MRP ৳80.30, Trade Discount 13.5% -> Purchase Cost ৳69.46)
  ('bat-bmd-2402', 'BMD-2402', 'prod-oph-010', CURRENT_DATE - INTERVAL '140 days', CURRENT_DATE + INTERVAL '390 days', 69.46, 80.30, 80.30, 120, 92, 'Glaucoma Bay Rack G-01', 'ACTIVE', NOW(), NOW()),

  -- Dexagen T Ointment 3.5gm (MRP ৳90.00, Trade Discount 13.5% -> Purchase Cost ৳77.85)
  ('bat-dxt-2401', 'DXT-2401', 'prod-oph-011', CURRENT_DATE - INTERVAL '160 days', CURRENT_DATE + INTERVAL '400 days', 77.85, 90.00, 90.00, 90, 65, 'Ophthalmic Ointment Rack O-01', 'ACTIVE', NOW(), NOW()),

  -- Tobidex Ointment 3.5gm (MRP ৳105.00, Trade Discount 14.0% -> Purchase Cost ৳90.30)
  ('bat-tbo-2403', 'TBO-2403', 'prod-oph-012', CURRENT_DATE - INTERVAL '120 days', CURRENT_DATE + INTERVAL '440 days', 90.30, 105.00, 105.00, 100, 74, 'Ophthalmic Ointment Rack O-01', 'ACTIVE', NOW(), NOW()),

  -- Torcin D Ointment 3gm (MRP ৳115.00, Trade Discount 13.0% -> Purchase Cost ৳100.05)
  ('bat-trc-2404', 'TRC-2404', 'prod-oph-013', CURRENT_DATE - INTERVAL '100 days', CURRENT_DATE + INTERVAL '460 days', 100.05, 115.00, 115.00, 85, 59, 'Ophthalmic Ointment Rack O-01', 'ACTIVE', NOW(), NOW()),

  -- T-Mycin Plus Ointment 3.5gm (MRP ৳150.00, Trade Discount 14.5% -> Purchase Cost ৳128.25)
  ('bat-tmp-2402', 'TMP-2402', 'prod-oph-014', CURRENT_DATE - INTERVAL '80 days', CURRENT_DATE + INTERVAL '520 days', 128.25, 150.00, 150.00, 110, 88, 'Ophthalmic Ointment Rack O-01', 'ACTIVE', NOW(), NOW()),

  -- Polytracin Ointment 3gm (MRP ৳35.23, Trade Discount 12.0% -> Purchase Cost ৳31.00)
  ('bat-ply-2401', 'PLY-2401', 'prod-oph-015', CURRENT_DATE - INTERVAL '140 days', CURRENT_DATE + INTERVAL '370 days', 31.00, 35.23, 35.23, 150, 112, 'Ophthalmic Ointment Rack O-02', 'ACTIVE', NOW(), NOW()),

  -- Polymix Ointment 5gm (MRP ৳65.00, Trade Discount 13.5% -> Purchase Cost ৳56.23)
  ('bat-pmx-2403', 'PMX-2403', 'prod-oph-016', CURRENT_DATE - INTERVAL '110 days', CURRENT_DATE + INTERVAL '410 days', 56.23, 65.00, 65.00, 100, 76, 'Ophthalmic Ointment Rack O-02', 'ACTIVE', NOW(), NOW()),

  -- Opsophenicol Ointment 3.5gm (MRP ৳35.00, Trade Discount 12.5% -> Purchase Cost ৳30.63)
  ('bat-oph-2401', 'OPH-2401', 'prod-oph-017', CURRENT_DATE - INTERVAL '150 days', CURRENT_DATE + INTERVAL '390 days', 30.63, 35.00, 35.00, 180, 135, 'Ophthalmic Ointment Rack O-03', 'ACTIVE', NOW(), NOW()),

  -- Chloramex Ointment 3.5gm (MRP ৳45.00, Trade Discount 13.0% -> Purchase Cost ৳39.15)
  ('bat-chl-2405', 'CHL-2405', 'prod-oph-018', CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE + INTERVAL '450 days', 39.15, 45.00, 45.00, 140, 108, 'Ophthalmic Ointment Rack O-03', 'ACTIVE', NOW(), NOW()),

  -- Eye Gel 2% 3ml Pre-filled Syringe (MRP ৳120.45, Trade Discount 14.5% -> Purchase Cost ৳102.98)
  ('bat-eyg-2402', 'EYG-2402', 'prod-oph-019', CURRENT_DATE - INTERVAL '70 days', CURRENT_DATE + INTERVAL '600 days', 102.98, 120.45, 120.45, 80, 62, 'Eye Surgery & Visco Vault S-01', 'ACTIVE', NOW(), NOW()),

  -- Viscogel 5gm (MRP ৳108.00, Trade Discount 13.5% -> Purchase Cost ৳93.42)
  ('bat-vsg-2401', 'VSG-2401', 'prod-oph-020', CURRENT_DATE - INTERVAL '130 days', CURRENT_DATE + INTERVAL '410 days', 93.42, 108.00, 108.00, 100, 82, 'Ophthalmic Gel Bay G-02', 'ACTIVE', NOW(), NOW()),

  -- Tear-Gel 5gm (MRP ৳140.00, Trade Discount 14.0% -> Purchase Cost ৳120.40)
  ('bat-trg-2403', 'TRG-2403', 'prod-oph-021', CURRENT_DATE - INTERVAL '85 days', CURRENT_DATE + INTERVAL '480 days', 120.40, 140.00, 140.00, 120, 98, 'Ophthalmic Gel Bay G-02', 'ACTIVE', NOW(), NOW())
ON CONFLICT (id) DO UPDATE
SET "currentStock" = EXCLUDED."currentStock", "purchasePrice" = EXCLUDED."purchasePrice", mrp = EXCLUDED.mrp, "updatedAt" = NOW();

COMMIT;
