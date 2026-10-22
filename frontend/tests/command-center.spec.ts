import { test, expect } from '@playwright/test';

test.describe('Command Center Tab Verification', () => {
  test('Opens Command Center cleanly without growthVsYesterday or undefined errors', async ({ page }) => {
    // 1. Collect all console errors and unhandled exceptions
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      console.error('Page error observed:', err.message);
      pageErrors.push(err.message);
    });

    // 2. Open frontend
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Authenticate session
    await page.evaluate(() => {
      localStorage.setItem('pharmerp_auth_session_v2', 'true');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 3. Click Command Center tab in the sidebar
    const commandCenterBtn = page.locator('button:has-text("Command Center")');
    await expect(commandCenterBtn).toBeVisible({ timeout: 5000 });
    await commandCenterBtn.click();

    // 4. Verify Command Center header renders
    await expect(
      page.locator('h1:has-text("Pharmacy Command Center")')
    ).toBeVisible({ timeout: 5000 });

    // 5. Verify the key metric cards render cleanly
    // Pillar 1: Sales
    await expect(page.locator('text=1. Sales (বিক্রয়)').first()).toBeVisible();
    await expect(page.locator('text=Today Gross Sales').first()).toBeVisible();

    // Pillar 2: Profit
    await expect(page.locator('text=2. Profit (মুনাফা)').first()).toBeVisible();
    await expect(page.locator('text=Today Gross Profit').first()).toBeVisible();

    // Pillar 3: Stock
    await expect(page.locator('text=3. Stock (মজুদ)').first()).toBeVisible();
    await expect(page.locator('text=Total Inventory Valuation').first()).toBeVisible();

    // Pillar 4: Expiry
    await expect(page.locator('text=4. Expiry & FEFO').first()).toBeVisible();

    // Pillar 5: Purchase
    await expect(page.locator('text=5. Purchase (ক্রয়)').first()).toBeVisible();

    // Pillar 6: Cash
    await expect(page.locator('text=6. Cash (ক্যাশ ড্রয়ার)').first()).toBeVisible();

    // Pillar 7: Staff
    await expect(page.locator('text=7. Staff (কর্মী ও শিফট)').first()).toBeVisible();

    // Pillar 8: Alerts
    await expect(page.locator('text=8. Live Alerts (সতর্কতা)').first()).toBeVisible();

    // 6. Ensure 0 runtime unhandled errors
    expect(pageErrors).toEqual([]);
    console.log('Command Center fully verified with 0 runtime errors!');
  });
});
