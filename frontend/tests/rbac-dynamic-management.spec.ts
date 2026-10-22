import { test, expect } from '@playwright/test';

test.describe('RBAC Dynamic Roles, Checkboxes & Employee Directory Management', () => {
  test('Complete flow: real checkboxes, dynamic permission inheritance & employee role assignment', async ({ page }) => {
    // 1. Load Application
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // 2. Navigate to Settings & Roles tab
    const settingsButton = page.locator('button:has-text("Settings & Roles"), button:has-text("সেটিংস")').first();
    await settingsButton.click();
    await page.waitForTimeout(500);

    // Verify RBAC Matrix view loads
    await expect(page.locator('text=Role-Based Access Control (RBAC) & Security Matrix')).toBeVisible();

    // 3. Verify Functional Checkboxes Exist
    // Ensure input[type="checkbox"] exists in the permissions list
    const permissionCheckboxes = page.locator('input[type="checkbox"][id^="perm-check-"]');
    const checkboxCount = await permissionCheckboxes.count();
    console.log(`Found ${checkboxCount} original HTML checkboxes in permissions matrix.`);
    expect(checkboxCount).toBeGreaterThan(10);

    // 4. Select Cashier Role
    const cashierRoleCard = page.locator('span:text-is("Cashier")').first();
    await cashierRoleCard.click();
    await page.waitForTimeout(400);

    // Verify Cashier is selected
    await expect(page.locator('h3:has-text("Granular Permissions for:")')).toContainText('Cashier');

    // 5. Test Dynamic Checkbox Toggle on Cashier:
    // Toggle "inventory:stock:view" (View Stock Quantities)
    const inventoryStockViewCheckbox = page.locator('input#perm-check-inventory\\:stock\\:view');
    const isInitiallyChecked = await inventoryStockViewCheckbox.isChecked();
    console.log('Cashier initial inventory:stock:view state:', isInitiallyChecked);

    // Click checkbox to toggle ON if unchecked
    if (!isInitiallyChecked) {
      await inventoryStockViewCheckbox.check();
      await page.waitForTimeout(300);
      expect(await inventoryStockViewCheckbox.isChecked()).toBe(true);
      console.log('Checked inventory:stock:view for Cashier.');
    }

    // Switch active test persona to Cashier
    const testCashierBtn = page.locator('button:has-text("Test This Role")').first();
    await testCashierBtn.click();
    await page.waitForTimeout(500);

    // Dynamic Verification: Cashier now MUST see "Inventory & FEFO" in sidebar!
    const inventorySidebarItem = page.locator('#pharmapulse-sidebar button:has-text("Inventory & FEFO")');
    await expect(inventorySidebarItem).toBeVisible();
    console.log('Verified: Cashier dynamically sees "Inventory & FEFO" option!');

    // Now uncheck "inventory:stock:view" for Cashier
    await inventoryStockViewCheckbox.uncheck();
    await page.waitForTimeout(500);
    expect(await inventoryStockViewCheckbox.isChecked()).toBe(false);

    // Dynamic Verification: Cashier now MUST NOT see "Inventory & FEFO" in sidebar!
    await expect(inventorySidebarItem).not.toBeVisible();
    console.log('Verified: Cashier dynamically NO LONGER sees "Inventory & FEFO" option after unchecking!');

    // 6. Test Staff & Employee Directory Tab
    const staffDirTab = page.locator('button:has-text("Staff & Employee Directory")');
    await staffDirTab.click();
    await page.waitForTimeout(400);

    // Verify Staff Directory table
    await expect(page.locator('text=Pharmacy Staff & Employee Directory')).toBeVisible();
    const employeeRows = page.locator('tbody tr');
    const initialEmpCount = await employeeRows.count();
    console.log(`Initial employees in directory: ${initialEmpCount}`);
    expect(initialEmpCount).toBeGreaterThanOrEqual(1);

    // 7. Register New Employee & Assign Role
    const registerBtn = page.locator('button:has-text("Register New Employee")').first();
    await registerBtn.click();
    await page.waitForTimeout(300);

    await expect(page.locator('text=Register Staff & Assign Role')).toBeVisible();

    const empName = `Farhan Ahmed ${Date.now().toString().slice(-4)}`;
    const empEmail = `farhan.${Date.now().toString().slice(-4)}@madinaeye.com`;

    await page.fill('input[placeholder="e.g. Tanvir Ahmed, BPharm"]', empName);
    await page.fill('input[placeholder="tanvir@phamerp.io"]', empEmail);
    await page.fill('input[placeholder="+880 1711-000000"]', '+880 1812-998877');

    // Assign Pharmacist role from dropdown
    const roleSelect = page.locator('form select').filter({ hasText: 'Pharmacist' });
    await roleSelect.selectOption('pharmacist');

    // Submit form
    await page.click('button:has-text("Save Employee")');
    await page.waitForTimeout(500);

    // 8. Verify Employee Appears in Table with Assigned Role
    const newEmpRow = page.locator(`tr:has-text("${empName}")`);
    await expect(newEmpRow).toBeVisible();
    console.log(`Verified: Employee '${empName}' successfully listed in directory.`);

    // Verify Role dropdown value for this employee is 'pharmacist'
    const assignedRoleSelect = newEmpRow.locator('select');
    await expect(assignedRoleSelect).toHaveValue('pharmacist');

    // 9. Change Role to 'storekeeper' Dynamically
    await assignedRoleSelect.selectOption('storekeeper');
    await page.waitForTimeout(400);
    await expect(assignedRoleSelect).toHaveValue('storekeeper');
    console.log(`Verified: Changed '${empName}' role to 'storekeeper' dynamically.`);

    // 10. Switch to this employee session
    const testLoginBtn = newEmpRow.locator('button:has-text("Login / Test")');
    await testLoginBtn.click();
    await page.waitForTimeout(400);

    // Verify active test persona updated in the top ribbon
    await expect(page.locator('strong', { hasText: empName })).toBeVisible();
    console.log(`Verified: Successfully switched active session to '${empName}'. All RBAC requirements PASS 100%!`);
  });
});
