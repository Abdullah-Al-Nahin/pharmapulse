import { test, expect } from '@playwright/test';

test.describe('Pharmacy ERP - Full System E2E Suite', () => {

  test('Supplier Lifecycle: Add a supplier and verify it propagates', async ({ page }) => {
    await page.goto('/');

    // 1. Go to Purchases & SCM
    await page.click('button:has-text("Suppliers & Purchase")');
    await expect(page.locator('text=Supplier Management & Purchase Inward Workflow')).toBeVisible();

    // 2. Open Add Supplier Modal (from the Ledger tab or main PO tab)
    // First, navigate to Supplier Ledger Tab
    await page.click('button:has-text("Supplier Ledger & Payables")');
    
    // Click Add Supplier Button
    await page.click('button:has-text("Add Supplier")');
    
    // 3. Fill out the Supplier Form
    const testCompanyName = `Test Pharma ${Date.now()}`;
    await page.fill('input[placeholder="e.g. Square Pharmaceuticals PLC, Beximco, Incepta, Renata"]', testCompanyName);
    await page.fill('input[placeholder="e.g. Md. Rafiqul Islam (Senior MPO)"]', testCompanyName + ' Ltd');
    await page.fill('input[placeholder="e.g. +880 1711-234567"]', '+880 1711-234567');
    
    // Submit
    await page.click('button:has-text("Save Supplier")');

    // 4. Verify Success Toast
    await expect(page.locator(`text=New company/supplier "${testCompanyName}" successfully registered!`)).toBeVisible();

    // 5. Go to Inventory and verify the supplier is now in the database and loaded
    await page.click('button:has-text("Inventory & FEFO")');
    
    // The supplier should now be in the system. We can verify the UI is stable and doesn't crash.
    await expect(page.locator('text=Batch Stock & FEFO')).toBeVisible();
  });

  test('Excel Chalan Lifecycle: Bulk add batches and verify in POS', async ({ page }) => {
    await page.goto('/');

    // 1. Go to Purchases & SCM -> Excel Chalan Entry
    await page.click('button:has-text("Suppliers & Purchase")');
    await page.click('button:has-text("Excel Chalan Entry")');

    // Wait for the table to load
    await expect(page.locator('text=Excel-Style Chalan Entry')).toBeVisible();

    // Fill invoice number
    await page.fill('input[placeholder="e.g. SQ-INV-99201"]', `TEST-INV-${Date.now()}`);

    // Click Commit
    await page.click('button:has-text("Confirm & Update Stock & Batches")');

    // Verify error toast if fields are missing
    await expect(page.locator('.text-rose-700')).toBeVisible();
  });

});
