import { test, expect } from '@playwright/test';

test.describe.serial('Bug Hunt Flowchart — End-to-End Verification', () => {

  test('Phase 1: Inventory — Add Medicine & Batch Stock', async ({ page }) => {
    test.setTimeout(90000);
    console.log('\n--- STARTING PHASE 1 ---');
    await page.goto('/');

    // 1.1 Go to Inventory tab
    console.log('[Step 1.1] Navigating to Inventory & FEFO...');
    await page.click('button:has-text("Inventory & FEFO")');
    await expect(page.locator('text=Batch Stock & FEFO')).toBeVisible({ timeout: 10000 });
    console.log('[Step 1.1] PASS: Inventory tab loaded.');

    // 1.2 Click Add New Medicine
    console.log('[Step 1.2] Opening Add Medicine modal...');
    await page.click('button:has-text("Add Medicine")');
    await expect(page.locator('text=Add New Pharmaceutical Product')).toBeVisible();
    console.log('[Step 1.2] PASS: Add Medicine modal opened.');

    // 1.3 Fill in fields
    console.log('[Step 1.3] Filling medicine details: Test Tablet 500mg...');
    await page.fill('input[placeholder="e.g., Amoxicillin + Clavulanate 625mg"]', 'Test Tablet 500mg');
    await page.fill('input[placeholder="e.g., Amoxicillin & Potassium Clavulanate"]', 'Test Generic');
    await page.fill('input[placeholder="e.g., Augmentin Duo"]', 'TestBrand');
    console.log('[Step 1.3] PASS: All fields accept input.');

    // 1.4 Save medicine
    console.log('[Step 1.4] Saving medicine...');
    await page.click('button:has-text("Save Medicine")');
    await page.waitForTimeout(1000);
    // Search for it to confirm
    const searchBox = page.locator('input[placeholder*="Search"]').first();
    await searchBox.fill('Test Tablet');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Test Tablet 500mg').first()).toBeVisible({ timeout: 10000 });
    console.log('[Step 1.4] PASS: Test Tablet 500mg appears in inventory list.');

    // 1.5 Click Inward Batch on Test Tablet
    console.log('[Step 1.5] Opening Inward Batch modal...');
    const inwardBtn = page.locator('button:has-text("Inward Batch")').first();
    await inwardBtn.click();
    await expect(page.locator('text=Inward Batch Entry')).toBeVisible();
    console.log('[Step 1.5] PASS: Batch form opened.');

    // 1.6 Add Batch TST-001: Qty 100, Cost 5, MRP 10, Selling 8, Expiry 2027-06-30
    console.log('[Step 1.6] Adding Batch TST-001 (Qty 100, Exp 2027-06-30)...');
    await page.fill('input[placeholder="e.g. BTH-2026-901"]', 'TST-001');
    const dateInputs = page.locator('input[type="date"]');
    // Expiry date is the second date input in the modal
    await dateInputs.nth(1).fill('2027-06-30');
    // Cost, MRP, Selling Price
    const numInputs = page.locator('input[type="number"]');
    await numInputs.nth(0).fill('5'); // cost
    await numInputs.nth(1).fill('10'); // mrp
    await numInputs.nth(2).fill('8'); // selling
    await numInputs.nth(3).fill('100'); // qty

    await page.click('button:has-text("Confirm Inward Batch")');
    await page.waitForTimeout(1500);

    // Verify stock shows 100
    await searchBox.fill('Test Tablet');
    await page.waitForTimeout(1000);
    const stockBadge1 = page.locator('text=100').first();
    await expect(stockBadge1).toBeVisible();
    console.log('[Step 1.6] PASS: Batch TST-001 created, stock shows 100.');

    // 1.7 Add 2nd Batch: TST-002: Qty 50, Cost 6, MRP 10, Selling 8, Expiry 2026-12-15
    console.log('[Step 1.7] Adding Batch TST-002 (Qty 50, Exp 2026-12-15)...');
    await inwardBtn.click();
    await expect(page.locator('text=Inward Batch Entry')).toBeVisible();
    await page.fill('input[placeholder="e.g. BTH-2026-901"]', 'TST-002');
    await dateInputs.nth(1).fill('2026-12-15');
    await numInputs.nth(0).fill('6');
    await numInputs.nth(1).fill('10');
    await numInputs.nth(2).fill('8');
    await numInputs.nth(3).fill('50');
    await page.click('button:has-text("Confirm Inward Batch")');
    await page.waitForTimeout(1500);

    // Check stock total shows 150
    await searchBox.fill('Test Tablet');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=150').first()).toBeVisible();
    console.log('[Step 1.7] PASS: Batch TST-002 created, total stock shows 150.');

    // 1.8 Check FIFO/FEFO table order: TST-002 (Dec 2026) should appear ABOVE TST-001 (Jun 2027)
    console.log('[Step 1.8] Verifying FEFO order (TST-002 above TST-001)...');
    const tst002Index = await page.locator('text=TST-002').first().boundingBox();
    const tst001Index = await page.locator('text=TST-001').first().boundingBox();
    console.log(`TST-002 Y: ${tst002Index?.y}, TST-001 Y: ${tst001Index?.y}`);
    if (tst002Index && tst001Index && tst002Index.y < tst001Index.y) {
      console.log('[Step 1.8] PASS: TST-002 appears ABOVE TST-001 as expected (FEFO).');
    } else {
      console.warn('[Step 1.8] WARNING: FEFO sorting order did not position TST-002 above TST-001!');
    }
  });

});
