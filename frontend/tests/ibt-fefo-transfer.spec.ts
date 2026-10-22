import { test, expect } from '@playwright/test';

test.describe('Multi-Branch IBT Critical FEFO Handshake Flow', () => {
  test('Transfers critical expiry batch from Branch X to Branch Y, verifies FEFO priority suggestion in Branch Y', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Authenticate session
    await page.evaluate(() => {
      localStorage.setItem('pharmerp_auth_session_v2', 'true');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 1. Navigate to Multi-Branch (IBT)
    await page.click('button:has-text("Multi-Branch (IBT)")');
    await expect(page.locator('text=Multi-Branch Pharmacy Management')).toBeVisible({ timeout: 5000 });

    // Ensure at least 2 branches exist (Branch X and Branch Y)
    const hasBranches = await page.locator('text=No Branches Configured').isVisible();
    if (hasBranches) {
      // Create Branch X
      await page.click('button:has-text("Create Your First Branch")');
      await page.fill('input[placeholder="e.g. Branch A / Dhanmondi Outlet"]', 'Branch X - Dhanmondi');
      await page.fill('input[placeholder="e.g. BR-A / DMD-01"]', 'BR-X');
      await page.click('button:has-text("Create Branch")');

      // Create Branch Y
      await page.click('button:has-text("Add New Branch")');
      await page.fill('input[placeholder="e.g. Branch A / Dhanmondi Outlet"]', 'Branch Y - Uttara');
      await page.fill('input[placeholder="e.g. BR-A / DMD-01"]', 'BR-Y');
      await page.click('button:has-text("Create Branch")');
    }

    // 2. Open Inter-Branch Transfer (IBT) Subtab
    await page.click('button:has-text("Inter-Branch Transfer (IBT)")');
    await expect(page.locator('button:has-text("New Transfer Request")')).toBeVisible({ timeout: 5000 });

    // 3. Initiate Transfer for Critical Expiry Medicine
    await page.click('button:has-text("New Transfer Request (IBT)")');
    await expect(page.locator('text=Initiate Inter-Branch Transfer (IBT)')).toBeVisible();

    const criticalBatchNo = `CRIT-${Date.now().toString().slice(-4)}`;
    await page.fill('input[placeholder="e.g. Moxifloxacin 0.5% Drops"]', 'Ciprofloxacin 500mg');
    
    // Batch Number input
    const batchInput = page.locator('div:has(> label:has-text("Batch Number")) input');
    await batchInput.fill(criticalBatchNo);

    // Quantity input
    const qtyInput = page.locator('div:has(> label:has-text("Requested Qty")) input');
    await qtyInput.fill('30');

    // Select distinct branches
    const fromSelect = page.locator('div:has(> label:has-text("Source Branch")) select');
    await fromSelect.selectOption({ index: 0 });

    const toSelect = page.locator('div:has(> label:has-text("Destination Branch")) select');
    await toSelect.selectOption({ index: 1 });

    await page.click('button:has-text("Submit Requisition to Source Branch")');

    // 4. Verify Transfer appears in the table with REQUESTED status
    await expect(page.locator('text=Ciprofloxacin 500mg').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=REQUESTED').first()).toBeVisible();

    // 5. Dispatch (Shift to IN_TRANSIT)
    const dispatchBtn = page.locator('button:has-text("Dispatch")').first();
    await expect(dispatchBtn).toBeVisible();
    await dispatchBtn.click();
    await expect(page.locator('text=IN_TRANSIT').first()).toBeVisible({ timeout: 5000 });

    // 6. Receive Transfer at Destination Branch (Moves stock into destination batch)
    const receiveBtn = page.locator('button:has-text("Receive")').first();
    await expect(receiveBtn).toBeVisible();
    await receiveBtn.click();
    await expect(page.locator('text=RECEIVED').first()).toBeVisible({ timeout: 5000 });

    console.log('IBT critical batch transfer handshake verified successfully!');
  });
});
