import { test, expect } from '@playwright/test';

test('completes a POS sale successfully', async ({ page }) => {
  await page.goto('/');

  // Navigate to POS
  await page.click('button:has-text("POS Billing")');

  // Ensure POS view is loaded by checking search box
  const searchInput = page.getByPlaceholder('Scan Barcode (UPC) or Search Medicine, Generic (e.g. Latanoprost, Moxacin, Insulin, Sergel)... [F2]');
  await searchInput.waitFor();
  
  // Search for an item
  await searchInput.fill('Napa');
  
  // Wait for search results and add to cart
  await page.click('text=Napa Extra');

  // Verify the cart has the item (using the first one to avoid strict mode issues)
  await expect(page.locator('text=Napa').first()).toBeVisible();

  // Click Pay / Tender -> Process & Dispense (F10)
  await page.click('text=Process & Dispense (F10)');

  // Inside Modal, click Confirm & Dispatch (Enter)
  await page.click('text=Confirm & Dispatch (Enter)');

  // Verify success toast appears
  await expect(page.locator('text=Dispensed verified!')).toBeVisible();
});
