import { test, expect } from '@playwright/test';

test.describe('PharmaPulse Authentication & Employee Password Flow', () => {
  test('Full Login, Logout, Employee Registration with Password & Verification', async ({ page }) => {
    // 1. Visit App
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Force sign out in local storage to test login screen
    await page.evaluate(() => {
      localStorage.setItem('pharmerp_auth_session_v2', 'false');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 2. Verify Login Page is rendered
    await expect(page.locator('text=Terminal Authorization')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h1:has-text("PharmaPulse")')).toBeVisible();

    // 3. Test Invalid Password
    await page.fill('input[type="email"]', 'admin@phamerp.io');
    await page.fill('input[placeholder="••••••••••••"]', 'wrongpassword');
    await page.click('button:has-text("Sign In to Terminal")');

    // Expect error message
    await expect(page.locator('text=Invalid password')).toBeVisible({ timeout: 4000 });

    // 4. Test Valid Login with Super Admin
    await page.fill('input[placeholder="••••••••••••"]', 'admin123');
    await page.click('button:has-text("Sign In to Terminal")');

    // Expect dashboard to load
    await expect(page.locator('text=Dr. Alexander Wright')).toBeVisible({ timeout: 6000 });
    await expect(page.locator('text=Super Admin').first()).toBeVisible();

    // 5. Navigate to Settings & Roles in Sidebar
    await page.click('button:has-text("Settings & Roles")');

    // Switch to Staff & Employee Directory tab
    await page.click('button:has-text("Staff & Employee Directory")');

    // 6. Click Add New Employee
    await page.click('button:has-text("Add New Employee")');
    await expect(page.locator('text=Register Staff & Assign Role')).toBeVisible();

    // Fill registration form with password
    const testEmail = `pharmacist.${Date.now()}@hospital.io`;
    const testPassword = 'HospitalSecurePass2026!';
    const testName = 'Dr. Zahid Hasan, RPh';

    await page.fill('input[placeholder="e.g. Tanvir Ahmed, BPharm"]', testName);
    await page.fill('input[placeholder="tanvir@phamerp.io"]', testEmail);
    await page.fill('input[placeholder="Enter employee password..."]', testPassword);
    await page.fill('input[placeholder="+880 1711-000000"]', '+880 1711-998877');

    // Submit form
    await page.click('button:has-text("Save Employee")');

    // Wait for employee card to show up (exact match)
    await expect(page.getByText(testName, { exact: true })).toBeVisible({ timeout: 5000 });

    // 7. Sign Out / Lock Terminal from sidebar
    const logoutBtn = page.locator('button[title="Sign Out / Lock Terminal"]').first();
    await logoutBtn.click();

    // Verify back on Login page
    await expect(page.locator('text=Terminal Authorization')).toBeVisible({ timeout: 5000 });

    // 8. Sign In with the newly created employee
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[placeholder="••••••••••••"]', testPassword);
    await page.click('button:has-text("Sign In to Terminal")');

    // 9. Verify authenticated as the new Pharmacist
    await expect(page.locator('#pharmapulse-sidebar').getByText(testName, { exact: true })).toBeVisible({ timeout: 6000 });
    await expect(page.locator('header').getByText(testName, { exact: true })).toBeVisible();

    console.log('Authentication and employee registration with password successfully verified!');
  });
});
