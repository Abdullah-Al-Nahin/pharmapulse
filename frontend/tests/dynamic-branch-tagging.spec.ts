import { test, expect } from '@playwright/test';

test.describe('Dynamic Branch Creation & Transaction Tagging Flow', () => {
  test('Creates dynamic branch, assigns to employee, verifies branch tagging & metrics', async ({ page }) => {
    // 1. Visit App
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Clear session & branches storage to test fresh zero-demo-branches state
    await page.evaluate(() => {
      localStorage.setItem('pharmerp_auth_session_v2', 'true');
      localStorage.removeItem('pharmerp_branches_dynamic_v2');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 2. Open Multi-Branch (IBT) tab
    await page.click('button:has-text("Multi-Branch (IBT)")');
    await expect(page.locator('text=Multi-Branch Pharmacy Management')).toBeVisible({ timeout: 5000 });

    // 3. Verify zero demo branches: empty state is shown
    await expect(page.locator('text=No Branches Configured')).toBeVisible({ timeout: 4000 });
    await expect(page.locator('button:has-text("Create Your First Branch")')).toBeVisible();

    // 4. Add First Branch: "Branch A - Dhanmondi Outlet"
    await page.click('button:has-text("Create Your First Branch")');
    await expect(page.locator('text=Register New Pharmacy Branch')).toBeVisible();

    await page.fill('input[placeholder="e.g. Branch A / Dhanmondi Outlet"]', 'Branch A - Dhanmondi Outlet');
    await page.fill('input[placeholder="e.g. BR-A / DMD-01"]', 'BR-A');
    await page.fill('input[placeholder="e.g. Marcus Vance, BPharm"]', 'Sarah Conner, PharmD');
    await page.fill('input[placeholder="e.g. Road 27, House 14, Dhanmondi"]', 'Road 27, Dhanmondi');

    await page.click('button:has-text("Create Branch")');

    // Verify Branch A was created and is active
    await expect(page.locator('text=Branch A - Dhanmondi Outlet').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=BR-A').first()).toBeVisible();

    // 5. Add Second Branch: "Branch B - Uttara Care"
    await page.click('button:has-text("Add New Branch")');
    await expect(page.locator('text=Register New Pharmacy Branch')).toBeVisible();

    await page.fill('input[placeholder="e.g. Branch A / Dhanmondi Outlet"]', 'Branch B - Uttara Care');
    await page.fill('input[placeholder="e.g. BR-A / DMD-01"]', 'BR-B');
    await page.fill('input[placeholder="e.g. Marcus Vance, BPharm"]', 'Marcus Vance');

    await page.click('button:has-text("Create Branch")');

    // Verify both branches are listed in the selector chips
    await expect(page.locator('text=Branch B - Uttara Care').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Branch A - Dhanmondi Outlet').first()).toBeVisible();

    // 6. Navigate to Settings & Roles -> Staff & Employee Directory
    await page.click('button:has-text("Settings & Roles")');
    await page.click('button:has-text("Staff & Employee Directory")');

    // 7. Click Add New Employee and verify Branch A is in the dropdown
    await page.click('button:has-text("Add New Employee")');
    await expect(page.locator('text=Register Staff & Assign Role')).toBeVisible();

    const testStaffName = 'Kamal Hossain, Dispenser';
    const testStaffEmail = `kamal.${Date.now()}@branch-a.io`;
    const testStaffPass = 'BranchPass123!';

    await page.fill('input[placeholder="e.g. Tanvir Ahmed, BPharm"]', testStaffName);
    await page.fill('input[placeholder="tanvir@phamerp.io"]', testStaffEmail);
    await page.fill('input[placeholder="Enter employee password..."]', testStaffPass);

    // Select Pharmacy Manager role so employee can view Accounts & Ledger
    const modalForm = page.locator('form').filter({ hasText: 'Full Employee Name' });
    const roleSelect = modalForm.locator('select').first();
    await roleSelect.selectOption('pharmacy_manager');

    // Verify and select Branch A
    const branchSelect = modalForm.locator('select').nth(1);
    await expect(branchSelect).toBeVisible();
    await branchSelect.selectOption({ label: 'Branch A - Dhanmondi Outlet (BR-A) — RETAIL BRANCH' });

    // Save Employee
    await page.click('button:has-text("Save Employee")');

    // Verify employee appears with Branch A tag
    await expect(page.getByText(testStaffName, { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Branch A - Dhanmondi Outlet').first()).toBeVisible();

    // 8. Sign Out and Sign In as the new employee tagged with Branch A
    const logoutBtn = page.locator('button[title="Sign Out / Lock Terminal"]').first();
    await logoutBtn.click();

    await expect(page.locator('text=Terminal Authorization')).toBeVisible({ timeout: 5000 });
    await page.fill('input[type="email"]', testStaffEmail);
    await page.fill('input[placeholder="••••••••••••"]', testStaffPass);
    await page.click('button:has-text("Sign In to Terminal")');

    // 9. Verify dashboard shows employee and their tagged branch on sidebar AND in the top header pill
    await expect(page.locator('#pharmapulse-sidebar').getByText(testStaffName, { exact: true })).toBeVisible({ timeout: 6000 });
    await expect(page.locator('#pharmapulse-sidebar').locator('text=Branch A - Dhanmondi Outlet')).toBeVisible();
    await expect(page.locator('header').getByText(testStaffName, { exact: true })).toBeVisible();
    await expect(page.locator('header').locator('text=Branch A - Dhanmondi Outlet')).toBeVisible();
    await expect(page.locator('header').locator('text=BR-A')).toBeVisible();

    // 10. Verify Accounting View has branch filtering
    await page.click('button:has-text("Accounts & Ledger")');
    await expect(page.locator('text=Pharmacy Profit Analytics & Financial Accounting')).toBeVisible({ timeout: 5000 });

    const acctBranchFilter = page.locator('select:has-text("All Branches")');
    await expect(acctBranchFilter).toBeVisible();

    // Switch accounting to Branch A
    await acctBranchFilter.selectOption({ label: 'Branch A - Dhanmondi Outlet (BR-A)' });
    await expect(page.locator('text=Scope: Branch A - Dhanmondi Outlet')).toBeVisible();

    console.log('Dynamic branch creation and employee tagging flow successfully verified!');
  });
});
