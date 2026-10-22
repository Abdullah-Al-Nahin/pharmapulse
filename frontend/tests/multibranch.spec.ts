import { test, expect } from '@playwright/test';

test.describe('Multi-Branch & IBT Hub Tab Verification', () => {
  test('Opens Multi-Branch tab cleanly without any runtime errors', async ({ page }) => {
    // 1. Listen for page errors
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      errors.push(err.message);
    });

    // 2. Visit App
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Ensure session authenticated
    await page.evaluate(() => {
      localStorage.setItem('pharmerp_auth_session_v2', 'true');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 3. Click Multi-Branch (IBT) tab in sidebar
    const multiBranchTab = page.locator('button:has-text("Multi-Branch (IBT)")');
    await expect(multiBranchTab).toBeVisible({ timeout: 5000 });
    await multiBranchTab.click();

    // 4. Verify Multi-Branch Hub header renders cleanly
    await expect(
      page.locator('text=Multi-Branch Pharmacy Management & Inter-Branch Transfer (IBT)')
    ).toBeVisible({ timeout: 5000 });

    // 5. Verify empty state if no branches or create one
    const hasBranches = await page.locator('text=No Branches Configured').isVisible();
    if (hasBranches) {
      await page.click('button:has-text("Create Your First Branch")');
      await page.fill('input[placeholder="e.g. Branch A / Dhanmondi Outlet"]', 'Main Central Branch');
      await page.fill('input[placeholder="e.g. BR-A / DMD-01"]', 'HQ-01');
      await page.click('button:has-text("Create Branch")');
    }

    await expect(page.locator('text=Main Central Branch').or(page.locator('button:has-text("Add New Branch")')).first()).toBeVisible({ timeout: 5000 });

    // 6. Test Sub-tabs: Inter-Branch Transfer (IBT)
    await page.click('button:has-text("Inter-Branch Transfer (IBT)")');
    await expect(page.locator('input[placeholder*="Search IBT Number"]')).toBeVisible({ timeout: 5000 });

    // 7. Test Sub-tabs: Branch Comparison Matrix
    await page.click('button:has-text("Branch Comparison Matrix")');
    await expect(page.locator('text=Multi-Branch Financial & Operational Matrix')).toBeVisible();

    // 8. Test Sub-tabs: back to Overview
    await page.click('button:has-text("Branch Metrics & Ledger")');
    await expect(page.locator('text=1. Inventory & Stock')).toBeVisible();

    // Ensure zero uncaught errors occurred
    expect(errors).toEqual([]);
    console.log('Multi-Branch tab verified with 0 runtime errors!');
  });
});
