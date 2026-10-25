import { ModulePermissionGroup, Permission, RoleDefinition, AuthUser } from '../types/rbac';

export const MODULE_PERMISSIONS: ModulePermissionGroup[] = [
  {
    module: 'pos',
    name: 'Point of Sale (POS)',
    description: 'Cash counter checkout, barcode scanning, payments, and discount controls',
    permissions: [
      { code: 'pos:sale:create', label: 'Create Sale / Checkout', description: 'Initiate and tender sales transactions' },
      { code: 'pos:sale:view', label: 'View Past Invoices', description: 'Browse and lookup past transaction receipts' },
      { code: 'pos:sale:void', label: 'Void Active Sale', description: 'Cancel active basket before tender completion', isSensitive: true },
      { code: 'pos:sale:reprint', label: 'Reprint Receipts', description: 'Reprint 58mm/80mm thermal and A4 slips' },
      { code: 'pos:discount:apply', label: 'Apply Standard Discount', description: 'Apply manual line or cart discount within role limit' },
      { code: 'pos:discount:override', label: 'Override Discount Limit (>5%)', description: 'Apply discounts exceeding the standard cashier limit', isSensitive: true },
      { code: 'pos:hold:manage', label: 'Hold & Recall Baskets', description: 'Suspend transactions for later recall' },
      { code: 'pos:payment:split', label: 'Split Payments', description: 'Tender multi-tender splits (Cash, Card, Mobile)' },
    ],
  },
  {
    module: 'inventory',
    name: 'Inventory & Batch Management',
    description: 'Product catalog, batch shelf locations, FEFO expiries, and stock corrections',
    permissions: [
      { code: 'inventory:stock:view', label: 'View Stock Quantities', description: 'Check on-hand quantities and shelf locations' },
      { code: 'inventory:stock:adjust', label: 'Adjust Physical Stock', description: 'Log manual shrinkage, damaged goods, or cycle counts', isSensitive: true },
      { code: 'inventory:stock:quarantine', label: 'Quarantine Batches', description: 'Lock recalled or suspicious medicine batches', isSensitive: true },
      { code: 'inventory:product:create', label: 'Create New Medicines', description: 'Register new drug molecules and dosage forms' },
      { code: 'inventory:product:edit', label: 'Edit Medicine Details', description: 'Update manufacturer, rack, or reorder levels' },
      { code: 'inventory:product:delete', label: 'Delete Products', description: 'Remove inactive medicines from catalog', isSensitive: true },
      { code: 'inventory:cost:view', label: 'View Purchase Costs', description: 'GUARDRAIL: View unit purchase and acquisition costs', isSensitive: true },
      { code: 'inventory:batch:manage', label: 'Manage Batches & Expiries', description: 'Edit batch numbers, mfg, and expiry dates' },
    ],
  },
  {
    module: 'prescriptions',
    name: 'Prescription & Narcotics',
    description: 'Schedule H, narcotic registers, doctor orders, and dispensing validation',
    permissions: [
      { code: 'prescriptions:rx:view', label: 'View Prescriptions', description: 'Review doctor prescriptions and patient details' },
      { code: 'prescriptions:rx:dispense', label: 'Dispense Prescription Drugs', description: 'Fulfill Rx orders into the active POS cart' },
      { code: 'prescriptions:rx:upload', label: 'Upload Digital Rx', description: 'Attach prescription image or scan to sale' },
      { code: 'prescriptions:narcotic:dispense', label: 'Dispense Narcotic / Sedatives', description: 'Authorize strict Schedule H & X narcotic dispensation', isSensitive: true },
    ],
  },
  {
    module: 'purchases',
    name: 'Purchases & Supplier Management',
    description: 'Purchase Orders (PO), Goods Receive Notes (GRN), and supplier contracts',
    permissions: [
      { code: 'purchases:po:create', label: 'Create Purchase Orders', description: 'Generate vendor POs with trade discounts and MRP' },
      { code: 'purchases:po:approve', label: 'Approve Purchase Orders', description: 'Authorize supplier orders for delivery', isSensitive: true },
      { code: 'purchases:po:view', label: 'View Purchase Orders', description: 'Inspect vendor order status and history' },
      { code: 'purchases:grn:receive', label: 'Receive Goods (GRN)', description: 'Commit inward batch stock into active inventory' },
      { code: 'purchases:supplier:manage', label: 'Manage Suppliers', description: 'Create and update supplier profiles and terms' },
      { code: 'purchases:cost:view', label: 'View Purchase Order Costs', description: 'GUARDRAIL: View vendor unit costs and net payables', isSensitive: true },
    ],
  },
  {
    module: 'returns',
    name: 'Sales Returns & Refunds',
    description: 'Patient returns, batch restocking, credit notes, and damage triage',
    permissions: [
      { code: 'returns:sale:process', label: 'Process Sales Return', description: 'Authorize item returns and restock/quarantine triage' },
      { code: 'returns:sale:view', label: 'View Return Log', description: 'Browse historical credit notes and refund audit log' },
      { code: 'returns:refund:cash', label: 'Issue Cash Refunds', description: 'Dispense physical cash refund to customers', isSensitive: true },
    ],
  },
  {
    module: 'customers',
    name: 'Customers, Receivables & Loyalty',
    description: 'Customer profiles, multi-tier pricing assignment, due collection, and loyalty rewards',
    permissions: [
      { code: 'customers:profile:view', label: 'View Customers', description: 'Browse customer directory, tier pricing, and loyalty points' },
      { code: 'customers:profile:manage', label: 'Manage Customer Profiles', description: 'Create and update customer details, credit limits, and pricing tiers' },
      { code: 'customers:due:collect', label: 'Collect Due Balance', description: 'Record partial/full customer due payments and generate receipts', isSensitive: true },
      { code: 'customers:ledger:view', label: 'View Receivables Ledger', description: 'Inspect chronological debit/credit accounts receivable ledger', isSensitive: true },
      { code: 'customers:loyalty:manage', label: 'Manage Loyalty Program', description: 'Configure earn/burn rules and manual point adjustments' },
    ],
  },
  {
    module: 'reports',
    name: 'Analytics & Financial Reporting',
    description: 'Sales velocity, fast-moving SKUs, gross margin, and profit calculation',
    permissions: [
      { code: 'reports:sales:view', label: 'View Sales Analytics', description: 'Daily sales volume, ticket size, and payment modes' },
      { code: 'reports:inventory:view', label: 'View Stock Valuation', description: 'Stock value, fast/slow moving velocity reports' },
      { code: 'reports:profit:view', label: 'View Gross Margins & Net Profit', description: 'GUARDRAIL: View profitability, markup %, and net margin', isSensitive: true },
      { code: 'reports:expiry:view', label: 'View Expiry Loss Projections', description: 'Near-expiry stock financial risk calculations' },
    ],
  },
  {
    module: 'accounting',
    name: 'Accounting & Ledger',
    description: 'Double-entry bookkeeping, supplier ledger, and financial statements',
    permissions: [
      { code: 'accounting:ledger:view', label: 'View General Ledger', description: 'GUARDRAIL: Inspect debit/credit accounting entries', isSensitive: true },
      { code: 'accounting:payment:record', label: 'Record Supplier Payments', description: 'Settle vendor payables and issue payment vouchers', isSensitive: true },
      { code: 'accounting:expense:record', label: 'Log Operational Expenses', description: 'Record utility, rent, salary, and overhead costs' },
      { code: 'accounting:statements:view', label: 'View Profit & Loss / Balance Sheet', description: 'GUARDRAIL: Access company-level financial statements', isSensitive: true },
    ],
  },
  {
    module: 'audit',
    name: 'Audit Trail & Compliance',
    description: 'Regulatory log inspection, user actions, and drug administration audits',
    permissions: [
      { code: 'audit:logs:view', label: 'View System Audit Trail', description: 'Inspect chronological ledger of user operations', isSensitive: true },
      { code: 'audit:compliance:export', label: 'Export Regulatory Logs', description: 'Export Schedule H narcotic and expiry destruction logs' },
    ],
  },
  {
    module: 'rbac',
    name: 'Role & User Access Control',
    description: 'Manage roles, permission matrices, user credentials, and security limits',
    permissions: [
      { code: 'rbac:roles:manage', label: 'Create & Edit Custom Roles', description: 'Build custom roles and customize permission matrices', isSensitive: true },
      { code: 'rbac:users:manage', label: 'Manage Staff Users', description: 'Assign roles, reset passwords, and lock accounts', isSensitive: true },
      { code: 'rbac:permissions:grant', label: 'Grant Sensitive Permissions', description: 'Authorize financial and system overrides', isSensitive: true },
    ],
  },
];

// Helper: list all permission strings
export const ALL_PERMISSIONS: Permission[] = MODULE_PERMISSIONS.flatMap((m) =>
  m.permissions.map((p) => p.code)
);

// Pre-configured 8 System Roles
export const PRECONFIGURED_ROLES: RoleDefinition[] = [
  {
    id: 'role-super-admin',
    code: 'super_admin',
    name: 'Super Admin',
    description: 'Root system administrator with unrestricted system access, role customization, and financial oversight.',
    isSystem: true,
    permissions: ['*'],
    maxDiscountPercent: 100,
    canViewPurchaseCosts: true,
    canViewProfitMargins: true,
    canViewAccounting: true,
    colorBadge: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    updatedAt: '2026-09-08',
  },
  {
    id: 'role-pharmacy-manager',
    code: 'pharmacy_manager',
    name: 'Pharmacy Manager',
    description: 'Head Pharmacist & Operations Lead with store oversight, PO approval, cost visibility, and manager discount overrides.',
    isSystem: true,
    permissions: [
      'pos:sale:create', 'pos:sale:view', 'pos:sale:void', 'pos:sale:reprint',
      'pos:discount:apply', 'pos:discount:override', 'pos:hold:manage', 'pos:payment:split',
      'inventory:stock:view', 'inventory:stock:adjust', 'inventory:stock:quarantine',
      'inventory:product:create', 'inventory:product:edit', 'inventory:cost:view', 'inventory:batch:manage',
      'prescriptions:rx:view', 'prescriptions:rx:dispense', 'prescriptions:rx:upload', 'prescriptions:narcotic:dispense',
      'purchases:po:create', 'purchases:po:approve', 'purchases:po:view', 'purchases:grn:receive', 'purchases:supplier:manage', 'purchases:cost:view',
      'returns:sale:process', 'returns:sale:view', 'returns:refund:cash',
      'customers:profile:view', 'customers:profile:manage', 'customers:due:collect', 'customers:ledger:view', 'customers:loyalty:manage',
      'reports:sales:view', 'reports:inventory:view', 'reports:profit:view', 'reports:expiry:view',
      'accounting:ledger:view', 'accounting:payment:record', 'accounting:expense:record', 'accounting:statements:view',
      'audit:logs:view', 'audit:compliance:export',
      'rbac:roles:manage', 'rbac:users:manage',
    ],
    maxDiscountPercent: 30,
    canViewPurchaseCosts: true,
    canViewProfitMargins: true,
    canViewAccounting: true,
    colorBadge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    updatedAt: '2026-09-08',
  },
  {
    id: 'role-pharmacist',
    code: 'pharmacist',
    name: 'Pharmacist',
    description: 'Licensed clinician dispensing prescriptions, checking drug interactions, batch expiries, and narcotic logs.',
    isSystem: true,
    permissions: [
      'pos:sale:create', 'pos:sale:view', 'pos:sale:reprint', 'pos:discount:apply', 'pos:hold:manage', 'pos:payment:split',
      'inventory:stock:view', 'inventory:batch:manage', 'inventory:product:create', 'inventory:product:edit',
      'prescriptions:rx:view', 'prescriptions:rx:dispense', 'prescriptions:rx:upload', 'prescriptions:narcotic:dispense',
      'returns:sale:process', 'returns:sale:view',
      'customers:profile:view', 'customers:due:collect', 'customers:ledger:view',
      'reports:sales:view', 'reports:expiry:view',
    ],
    maxDiscountPercent: 10,
    canViewPurchaseCosts: false, // Guardrail
    canViewProfitMargins: false, // Guardrail
    canViewAccounting: false, // Guardrail
    colorBadge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    updatedAt: '2026-09-08',
  },
  {
    id: 'role-cashier',
    code: 'cashier',
    name: 'Cashier',
    description: 'Front-counter checkout cashier. STRICT GUARDRAIL: Capped at max 5% discount; blocked from purchase costs and profit books.',
    isSystem: true,
    permissions: [
      'pos:sale:create', 'pos:sale:view', 'pos:sale:reprint',
      'pos:discount:apply', // Only up to maxDiscountPercent (5%)
      'pos:hold:manage', 'pos:payment:split',
      'returns:sale:view',
      'customers:profile:view', 'customers:due:collect',
    ],
    maxDiscountPercent: 5, // Strict Guardrail: Max 5%
    canViewPurchaseCosts: false, // Strict Guardrail: Masked
    canViewProfitMargins: false, // Strict Guardrail: Masked
    canViewAccounting: false, // Strict Guardrail: Blocked
    colorBadge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    updatedAt: '2026-09-08',
  },
  {
    id: 'role-storekeeper',
    code: 'storekeeper',
    name: 'Storekeeper',
    description: 'Warehouse and shelf manager managing physical inventory, cycle counts, GRN batch intake, and damaged stock triage.',
    isSystem: true,
    permissions: [
      'inventory:stock:view', 'inventory:stock:adjust', 'inventory:stock:quarantine',
      'inventory:batch:manage',
      'purchases:po:view', 'purchases:grn:receive',
      'reports:inventory:view', 'reports:expiry:view',
    ],
    maxDiscountPercent: 0,
    canViewPurchaseCosts: false, // Guardrail: cannot see buying costs
    canViewProfitMargins: false,
    canViewAccounting: false,
    colorBadge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    updatedAt: '2026-09-08',
  },
  {
    id: 'role-purchase-officer',
    code: 'purchase_officer',
    name: 'Purchase Officer',
    description: 'Procurement specialist handling vendor relationships, supplier orders, purchase agreements, and stock replenishments.',
    isSystem: true,
    permissions: [
      'purchases:po:create', 'purchases:po:view', 'purchases:grn:receive',
      'purchases:supplier:manage', 'purchases:cost:view',
      'inventory:stock:view', 'inventory:cost:view', 'inventory:product:create',
      'reports:inventory:view', 'reports:expiry:view',
    ],
    maxDiscountPercent: 0,
    canViewPurchaseCosts: true,
    canViewProfitMargins: false,
    canViewAccounting: false,
    colorBadge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    updatedAt: '2026-09-08',
  },
  {
    id: 'role-accountant',
    code: 'accountant',
    name: 'Accountant',
    description: 'Financial controller monitoring cash flows, vendor settlements, profit & loss statements, margins, and VAT filing.',
    isSystem: true,
    permissions: [
      'accounting:ledger:view', 'accounting:payment:record', 'accounting:expense:record', 'accounting:statements:view',
      'customers:profile:view', 'customers:due:collect', 'customers:ledger:view',
      'reports:sales:view', 'reports:inventory:view', 'reports:profit:view', 'reports:expiry:view',
      'purchases:po:view', 'purchases:cost:view', 'inventory:cost:view',
      'pos:sale:view', 'returns:sale:view',
    ],
    maxDiscountPercent: 0,
    canViewPurchaseCosts: true,
    canViewProfitMargins: true,
    canViewAccounting: true,
    colorBadge: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
    updatedAt: '2026-09-08',
  },
  {
    id: 'role-auditor',
    code: 'auditor',
    name: 'Auditor',
    description: 'Independent compliance officer with read-only inspection access across transaction logs, FEFO traceability, and drug registers.',
    isSystem: true,
    permissions: [
      'audit:logs:view', 'audit:compliance:export',
      'reports:sales:view', 'reports:inventory:view', 'reports:expiry:view',
      'inventory:stock:view', 'pos:sale:view', 'purchases:po:view', 'returns:sale:view',
    ],
    maxDiscountPercent: 0,
    canViewPurchaseCosts: false,
    canViewProfitMargins: false,
    canViewAccounting: false,
    colorBadge: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    updatedAt: '2026-09-08',
  },
];

// Real staff profiles synchronized with Neon PostgreSQL database
export const PRECONFIGURED_USERS: AuthUser[] = [
  {
    id: 'user-super-admin-01',
    employeeId: 'admin',
    name: 'Super Admin',
    email: 'admin@1',
    phone: '+880 1700-000000',
    password: '1800',
    roleCode: 'super_admin',
    roleName: 'Super Admin',
    branchId: 'all',
    branchName: 'Headquarters & All Branches',
    licenseNumber: 'DGDA-SUPER-ADMIN-01',
    maxDiscountPercent: 100,
    canViewPurchaseCosts: true,
    canViewProfitMargins: true,
    canViewAccounting: true,
    permissions: ['*'],
  },
];

/**
 * Permission evaluation logic with support for wildcards:
 * - '*' grants all permissions
 * - 'pos:*' grants all pos module permissions
 * - exact match 'pos:sale:create'
 */
export function evaluatePermission(userPermissions: Permission[], target: Permission): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;

  // Wildcard check
  if (userPermissions.includes('*')) return true;

  // Exact match
  if (userPermissions.includes(target)) return true;

  // Module wildcard check (e.g., 'pos:*' grants 'pos:sale:create')
  const [targetModule] = target.split(':');
  if (userPermissions.includes(`${targetModule}:*` as Permission)) {
    return true;
  }

  return false;
}
