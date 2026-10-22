import React, { ReactNode, ComponentType } from 'react';
import { usePermission } from '../../hooks/usePermission';
import { Permission, PredefinedRoleCode } from '../../types/rbac';
import { ShieldAlert, Lock } from 'lucide-react';

interface PermissionGuardProps {
  permission: Permission | Permission[];
  requireAll?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Component: PermissionGuard
 * Conditionally renders children if the authenticated user has the required permission(s).
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  requireAll = false,
  fallback = null,
  children,
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermission();

  const isGranted = Array.isArray(permission)
    ? requireAll
      ? hasAllPermissions(permission)
      : hasAnyPermission(permission)
    : hasPermission(permission);

  if (!isGranted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

interface RoleGuardProps {
  roles: PredefinedRoleCode | string | (PredefinedRoleCode | string)[];
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Component: RoleGuard
 * Conditionally renders children based on allowed user roles.
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({ roles, fallback = null, children }) => {
  const { hasRole } = usePermission();

  if (!hasRole(roles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

/**
 * Higher-Order Component (HOC): withPermission
 * Wraps a React component and checks permission before rendering.
 */
export function withPermission<P extends object>(
  Component: ComponentType<P>,
  requiredPermission: Permission | Permission[],
  FallbackComponent: ComponentType<P> | ReactNode = null
): React.FC<P> {
  return function WithPermissionWrapper(props: P) {
    const { hasPermission, hasAnyPermission } = usePermission();

    const isGranted = Array.isArray(requiredPermission)
      ? hasAnyPermission(requiredPermission)
      : hasPermission(requiredPermission);

    if (!isGranted) {
      if (typeof FallbackComponent === 'function') {
        const Fallback = FallbackComponent as ComponentType<P>;
        return <Fallback {...props} />;
      }
      return <>{FallbackComponent}</>;
    }

    return <Component {...props} />;
  };
}

/**
 * Security Guardrail Component: MaskedCost
 * Displays purchase/cost price if authorized, or a discreet locked badge if unauthorized (Cashier / Storekeeper).
 */
interface MaskedCostProps {
  value?: number | null;
  amount?: number | null;
  prefix?: string;
  className?: string;
}

export const MaskedCost: React.FC<MaskedCostProps> = ({
  value,
  amount,
  prefix = '$',
  className = '',
}) => {
  const { canViewCosts } = usePermission();

  if (!canViewCosts) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 border border-slate-200 select-none ${className}`}
        title="Purchase cost restricted to Admin / Management"
      >
        <Lock className="w-2.5 h-2.5 text-slate-400" />
        <span>Restricted</span>
      </span>
    );
  }

  const numericVal = value != null ? Number(value) : (amount != null ? Number(amount) : 0);
  const safeVal = isNaN(numericVal) ? 0 : numericVal;

  return <span className={className}>{prefix}{safeVal.toFixed(2)}</span>;
};

/**
 * Security Guardrail Component: MaskedProfit
 * Displays gross profit and margin % if authorized, or a discreet locked badge if unauthorized.
 */
interface MaskedProfitProps {
  profit?: number | null;
  marginPercent?: number | null;
  className?: string;
}

export const MaskedProfit: React.FC<MaskedProfitProps> = ({
  profit,
  marginPercent,
  className = '',
}) => {
  const { canViewProfits } = usePermission();

  if (!canViewProfits) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 border border-slate-200 select-none"
        title="Profit analytics restricted to Admin / Management"
      >
        <Lock className="w-2.5 h-2.5 text-slate-400" />
        <span>Restricted</span>
      </span>
    );
  }

  const numericProfit = profit != null ? Number(profit) : 0;
  const safeProfit = isNaN(numericProfit) ? 0 : numericProfit;
  const numericMargin = marginPercent != null ? Number(marginPercent) : null;

  return (
    <span className={className}>
      ${safeProfit.toFixed(2)}
      {numericMargin != null && !isNaN(numericMargin) && (
        <span className="text-[10px] text-slate-400 ml-1">({numericMargin.toFixed(1)}%)</span>
      )}
    </span>
  );
};

/**
 * Access Denied Shield View for Protected Pages
 */
interface AccessDeniedCardProps {
  moduleTitle: string;
  requiredPermission: string;
  onSwitchToAdmin?: () => void;
}

export const AccessDeniedCard: React.FC<AccessDeniedCardProps> = ({
  moduleTitle,
  requiredPermission,
  onSwitchToAdmin,
}) => {
  const { user } = usePermission();

  return (
    <div className="max-w-xl mx-auto my-12 p-6 bg-white rounded-2xl border border-slate-200 shadow-xl text-center space-y-4">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
        <ShieldAlert className="w-7 h-7" />
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500">
          Your current role (<strong className="text-slate-800 uppercase">{user.roleName}</strong>) does not have authorization to view the <strong>{moduleTitle}</strong> module.
        </p>
      </div>

      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1 font-mono">
        <div className="text-slate-500">Required Permission:</div>
        <div className="text-rose-600 font-bold">{requiredPermission}</div>
      </div>

      {onSwitchToAdmin && (
        <div className="pt-2">
          <button
            onClick={onSwitchToAdmin}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Switch to Super Admin to View
          </button>
        </div>
      )}
    </div>
  );
};
