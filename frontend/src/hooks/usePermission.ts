import { useAuth } from '../context/AuthContext';
import { Permission, PredefinedRoleCode } from '../types/rbac';

export interface DiscountCheckResult {
  allowed: boolean;
  maxAllowed: number;
  reason?: string;
  requiresSupervisorPin?: boolean;
}

/**
 * Custom React Hook: usePermission
 * Provides granular permission checking, role validation, and financial visibility flags.
 */
export function usePermission() {
  const auth = useAuth();

  /**
   * Check if the authenticated user has a specific granular permission
   */
  const hasPermission = (permission: Permission): boolean => {
    return auth.hasPermission(permission);
  };

  /**
   * Check if the user has AT LEAST ONE of the specified permissions (OR logic)
   */
  const hasAnyPermission = (permissions: Permission[]): boolean => {
    return auth.hasAnyPermission(permissions);
  };

  /**
   * Check if the user has ALL of the specified permissions (AND logic)
   */
  const hasAllPermissions = (permissions: Permission[]): boolean => {
    return auth.hasAllPermissions(permissions);
  };

  /**
   * Check if the current user matches one or more role codes
   */
  const hasRole = (roleCodes: PredefinedRoleCode | string | (PredefinedRoleCode | string)[]): boolean => {
    const list = Array.isArray(roleCodes) ? roleCodes : [roleCodes];
    return list.includes(auth.currentUser.roleCode);
  };

  /**
   * Security Guardrail: Validate whether the current user is allowed to apply a specific discount percentage
   * For cashiers: capped at maxDiscountPercent (default 5%)
   */
  const checkDiscountAllowed = (discountPercent: number): DiscountCheckResult => {
    const numericDiscount = Number(discountPercent) || 0;
    const maxAllowed = auth.currentUser.maxDiscountPercent ?? 0;

    if (numericDiscount <= maxAllowed) {
      return {
        allowed: true,
        maxAllowed,
      };
    }

    return {
      allowed: false,
      maxAllowed,
      reason: `Discount of ${numericDiscount}% exceeds your role limit of ${maxAllowed}%. Requires Manager Override PIN.`,
      requiresSupervisorPin: true,
    };
  };

  return {
    user: auth.currentUser,
    role: auth.activeRole,
    allRoles: auth.allRoles,
    token: auth.token,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    isSuperAdmin: auth.isSuperAdmin,
    canViewCosts: auth.canViewCosts,
    canViewProfits: auth.canViewProfits,
    canViewAccounting: auth.canViewAccounting,
    maxDiscountPercent: auth.maxDiscountPercent,
    checkDiscountAllowed,
    switchUser: auth.switchUser,
    switchRole: auth.switchRole,
  };
}

export default usePermission;
