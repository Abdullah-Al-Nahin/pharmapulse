import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthTokenPayload, Permission, AuthUser } from '../../types/rbac';
import { evaluatePermission } from '../../services/rbacDefaults';

const JWT_SECRET = process.env.JWT_SECRET || 'pharmacy-saas-production-secret-key-2026-secure';

// Extend Express Request interface to include typed user
declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

/**
 * Utility: Sign a JWT token for a given user profile
 */
export function generateJwtToken(user: AuthUser, expiresIn = '8h'): string {
  const payload: AuthTokenPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    roleCode: user.roleCode,
    permissions: user.permissions,
    maxDiscountPercent: user.maxDiscountPercent,
    canViewPurchaseCosts: user.canViewPurchaseCosts,
    canViewProfitMargins: user.canViewProfitMargins,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

/**
 * Middleware: Verify Bearer JWT Token in Authorization Header
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'AUTH_TOKEN_MISSING',
      message: 'Access denied. Valid Bearer JWT authorization token is required.',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    req.user = decoded;
    next();
  } catch (err: any) {
    const isExpired = err?.name === 'TokenExpiredError';
    res.status(401).json({
      error: 'Unauthorized',
      code: isExpired ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_TOKEN_INVALID',
      message: isExpired ? 'Your session token has expired. Please re-authenticate.' : 'Invalid authentication token signature.',
      timestamp: new Date().toISOString(),
    });
    return;
  }
}

/**
 * Middleware: Require a specific granular permission
 * Supports wildcards:
 * - '*' (Super Admin) grants everything
 * - 'pos:*' grants any 'pos:...' action
 */
export function requirePermission(requiredPermission: Permission | string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication context required before evaluating permissions.',
      });
      return;
    }

    const hasAccess = evaluatePermission(req.user.permissions, requiredPermission as Permission);

    if (!hasAccess) {
      res.status(403).json({
        error: 'Forbidden',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: `Your role (${req.user.roleCode}) lacks the required permission: '${requiredPermission}'.`,
        requiredPermission,
        userRole: req.user.roleCode,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

/**
 * Middleware: Require ANY of the specified permissions (Logical OR)
 */
export function requireAnyPermission(requiredPermissions: (Permission | string)[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication context required.',
      });
      return;
    }

    const hasAny = requiredPermissions.some((perm) =>
      evaluatePermission(req.user!.permissions, perm as Permission)
    );

    if (!hasAny) {
      res.status(403).json({
        error: 'Forbidden',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: `Access denied. Requires at least one of: [${requiredPermissions.join(', ')}].`,
        requiredPermissions,
        userRole: req.user.roleCode,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

/**
 * Security Guardrail Middleware: Enforce Maximum Discount Threshold
 * Prevents Cashiers from giving manual discounts beyond their configured limit (e.g., max 5%).
 * Requires manager override token or supervisor code if exceeded.
 */
export function enforceMaxDiscount() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    // Extract requested discount from request payload
    const bodyDiscount = Number(req.body?.discountPercent ?? req.body?.discountRate ?? 0);
    const maxAllowed = req.user.maxDiscountPercent ?? 0;

    // Check if line items have higher discounts
    let highestItemDiscount = 0;
    if (Array.isArray(req.body?.items)) {
      highestItemDiscount = Math.max(
        0,
        ...req.body.items.map((it: any) => Number(it.discountPercent || it.discountRate || 0))
      );
    }

    const effectiveDiscount = Math.max(bodyDiscount, highestItemDiscount);

    if (effectiveDiscount > maxAllowed) {
      // Check for supervisor override in header or body
      const managerOverridePin = req.headers['x-manager-override-pin'] || req.body?.managerOverridePin;
      const validPins = ['9999', '1234', '8888']; // Configurable manager approval pins

      if (managerOverridePin && validPins.includes(String(managerOverridePin))) {
        // Manager override granted
        next();
        return;
      }

      res.status(403).json({
        error: 'Forbidden',
        code: 'DISCOUNT_LIMIT_EXCEEDED',
        message: `Cashier discount violation: Requested discount of ${effectiveDiscount}% exceeds your maximum authorized limit of ${maxAllowed}%. Manager authorization PIN required.`,
        requestedDiscount: effectiveDiscount,
        maxAllowedDiscount: maxAllowed,
        userRole: req.user.roleCode,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

/**
 * Security Guardrail: Financial Data Masker
 * Redacts purchase costs, trade prices, and gross profit margins from JSON responses
 * if the authenticated user does not have permission to view them.
 */
export function maskFinancialData(data: any, user?: AuthTokenPayload): any {
  if (!data || !user) return data;

  const canCosts = user.canViewPurchaseCosts ?? false;
  const canProfits = user.canViewProfitMargins ?? false;

  // If user has full access, return unmodified
  if (canCosts && canProfits) return data;

  // Helper to sanitize an individual object
  const sanitize = (item: any): any => {
    if (!item || typeof item !== 'object') return item;
    const cloned = { ...item };

    if (!canCosts) {
      delete cloned.purchasePrice;
      delete cloned.costPrice;
      delete cloned.unitCost;
      delete cloned.vendorRate;
    }

    if (!canProfits) {
      delete cloned.profit;
      delete cloned.grossMargin;
      delete cloned.marginPercentage;
      delete cloned.netProfit;
    }

    return cloned;
  };

  if (Array.isArray(data)) {
    return data.map(sanitize);
  }

  return sanitize(data);
}
