/**
 * Granular Role-Based Access Control (RBAC) Types & Permission Definitions
 * Pharmacy SaaS ERP & POS Engine
 */

// 1. Permission Strings formatted as module:action:scope
export type Permission =
  // Wildcard (Super Admin)
  | '*'

  // POS Module
  | 'pos:*'
  | 'pos:sale:create'
  | 'pos:sale:view'
  | 'pos:sale:void'
  | 'pos:sale:reprint'
  | 'pos:discount:apply'
  | 'pos:discount:override' // Allow discounts > cashier threshold (5%)
  | 'pos:hold:manage'
  | 'pos:payment:split'

  // Inventory Module
  | 'inventory:*'
  | 'inventory:stock:view'
  | 'inventory:stock:adjust'
  | 'inventory:stock:quarantine'
  | 'inventory:product:create'
  | 'inventory:product:edit'
  | 'inventory:product:delete'
  | 'inventory:cost:view' // Security Guardrail: Purchase price visibility
  | 'inventory:batch:manage'

  // Prescriptions Module
  | 'prescriptions:*'
  | 'prescriptions:rx:view'
  | 'prescriptions:rx:dispense'
  | 'prescriptions:rx:upload'
  | 'prescriptions:narcotic:dispense'

  // Purchases & Supplier Module
  | 'purchases:*'
  | 'purchases:po:create'
  | 'purchases:po:approve'
  | 'purchases:po:view'
  | 'purchases:grn:receive'
  | 'purchases:supplier:manage'
  | 'purchases:cost:view' // Security Guardrail: Purchase order costs

  // Sales Returns Module
  | 'returns:*'
  | 'returns:sale:process'
  | 'returns:sale:view'
  | 'returns:refund:cash'

  // Customers & Receivables Module
  | 'customers:*'
  | 'customers:profile:view'
  | 'customers:profile:manage'
  | 'customers:due:collect'
  | 'customers:ledger:view'
  | 'customers:loyalty:manage'

  // Reports & Financial Analytics
  | 'reports:*'
  | 'reports:sales:view'
  | 'reports:inventory:view'
  | 'reports:profit:view' // Security Guardrail: Gross margins & profit
  | 'reports:expiry:view'

  // Accounting Module
  | 'accounting:*'
  | 'accounting:ledger:view'
  | 'accounting:payment:record'
  | 'accounting:expense:record'
  | 'accounting:statements:view'

  // Audit Module
  | 'audit:*'
  | 'audit:logs:view'
  | 'audit:compliance:export'

  // RBAC Administration
  | 'rbac:*'
  | 'rbac:roles:manage'
  | 'rbac:users:manage'
  | 'rbac:permissions:grant';

// Permission categorization for UI matrix
export interface PermissionNode {
  code: Permission;
  label: string;
  description: string;
  isSensitive?: boolean; // Highlight sensitive financial/system permissions
}

export interface ModulePermissionGroup {
  module: string;
  name: string;
  description: string;
  permissions: PermissionNode[];
}

// 2. Pre-configured 8 System Roles
export type PredefinedRoleCode =
  | 'super_admin'
  | 'pharmacy_manager'
  | 'pharmacist'
  | 'cashier'
  | 'storekeeper'
  | 'purchase_officer'
  | 'accountant'
  | 'auditor';

export interface RoleDefinition {
  id: string;
  code: PredefinedRoleCode | string;
  name: string;
  description: string;
  isSystem: boolean; // Pre-configured roles cannot be deleted
  permissions: Permission[];
  maxDiscountPercent: number; // e.g., 5 for Cashier, 100 for Super Admin
  canViewPurchaseCosts: boolean; // Mask purchase prices if false
  canViewProfitMargins: boolean; // Mask profit/margins if false
  canViewAccounting: boolean; // Access to financial books
  colorBadge: string;
  updatedAt: string;
}

// 3. User Representation
export interface AuthUser {
  id: string;
  employeeId?: string;
  name: string;
  email: string;
  phone?: string;
  password?: string;
  roleCode: PredefinedRoleCode | string;
  roleName: string;
  branchId: string;
  branchName: string;
  licenseNumber?: string;
  maxDiscountPercent: number;
  canViewPurchaseCosts: boolean;
  canViewProfitMargins: boolean;
  canViewAccounting: boolean;
  permissions: Permission[];
}

// 4. JWT Token Payload
export interface AuthTokenPayload {
  userId: string;
  email: string;
  name: string;
  roleCode: string;
  permissions: Permission[];
  maxDiscountPercent: number;
  canViewPurchaseCosts: boolean;
  canViewProfitMargins: boolean;
  iat?: number;
  exp?: number;
}
