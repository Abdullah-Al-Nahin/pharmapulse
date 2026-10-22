import { Request, Response } from 'express';
import {
  PRECONFIGURED_ROLES,
  PRECONFIGURED_USERS,
  MODULE_PERMISSIONS,
  ALL_PERMISSIONS,
} from '../../services/rbacDefaults';
import { RoleDefinition, AuthUser, Permission } from '../../types/rbac';
import { generateJwtToken } from '../middleware/rbacMiddleware';

// In-memory persistent custom roles registry (synced with predefined)
let roleRegistry: RoleDefinition[] = [...PRECONFIGURED_ROLES];

export class RbacController {
  /**
   * GET /api/rbac/permissions
   * List all categorized permissions
   */
  static getPermissionsCatalog(_req: Request, res: Response): void {
    res.json({
      success: true,
      modules: MODULE_PERMISSIONS,
      totalPermissions: ALL_PERMISSIONS.length,
    });
  }

  /**
   * GET /api/rbac/roles
   * List all system and custom roles
   */
  static getRoles(_req: Request, res: Response): void {
    res.json({
      success: true,
      roles: roleRegistry,
    });
  }

  /**
   * POST /api/rbac/roles
   * Super Admin dynamic role creation
   */
  static createRole(req: Request, res: Response): void {
    const { name, code, description, permissions, maxDiscountPercent, canViewPurchaseCosts, canViewProfitMargins, canViewAccounting } = req.body;

    if (!name || !code) {
      res.status(400).json({ error: 'Bad Request', message: 'Role name and code are required.' });
      return;
    }

    const sanitizedCode = String(code).toLowerCase().replace(/[^a-z0-9_]/g, '_');

    // Check collision
    if (roleRegistry.some((r) => r.code === sanitizedCode)) {
      res.status(409).json({
        error: 'Conflict',
        message: `Role code '${sanitizedCode}' already exists. Please pick a unique identifier.`,
      });
      return;
    }

    const newRole: RoleDefinition = {
      id: `role-custom-${Date.now()}`,
      code: sanitizedCode,
      name: String(name).trim(),
      description: String(description || 'Custom user-defined security role'),
      isSystem: false,
      permissions: Array.isArray(permissions) ? permissions : [],
      maxDiscountPercent: typeof maxDiscountPercent === 'number' ? Math.min(100, Math.max(0, maxDiscountPercent)) : 5,
      canViewPurchaseCosts: Boolean(canViewPurchaseCosts),
      canViewProfitMargins: Boolean(canViewProfitMargins),
      canViewAccounting: Boolean(canViewAccounting),
      colorBadge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      updatedAt: new Date().toISOString().split('T')[0],
    };

    roleRegistry.push(newRole);

    res.status(201).json({
      success: true,
      message: `Custom role '${newRole.name}' created successfully.`,
      role: newRole,
    });
  }

  /**
   * PUT /api/rbac/roles/:id
   * Update role permissions and discount threshold
   */
  static updateRole(req: Request, res: Response): void {
    const { id } = req.params;
    const { permissions, maxDiscountPercent, canViewPurchaseCosts, canViewProfitMargins, canViewAccounting, description } = req.body;

    const index = roleRegistry.findIndex((r) => r.id === id || r.code === id);

    if (index === -1) {
      res.status(404).json({ error: 'Not Found', message: 'Role not found.' });
      return;
    }

    const existing = roleRegistry[index];

    // System roles can have permissions and thresholds modified by Super Admin, but code is immutable
    const updated: RoleDefinition = {
      ...existing,
      description: description !== undefined ? String(description) : existing.description,
      permissions: Array.isArray(permissions) ? permissions : existing.permissions,
      maxDiscountPercent: typeof maxDiscountPercent === 'number' ? maxDiscountPercent : existing.maxDiscountPercent,
      canViewPurchaseCosts: canViewPurchaseCosts !== undefined ? Boolean(canViewPurchaseCosts) : existing.canViewPurchaseCosts,
      canViewProfitMargins: canViewProfitMargins !== undefined ? Boolean(canViewProfitMargins) : existing.canViewProfitMargins,
      canViewAccounting: canViewAccounting !== undefined ? Boolean(canViewAccounting) : existing.canViewAccounting,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    roleRegistry[index] = updated;

    res.json({
      success: true,
      message: `Role '${updated.name}' updated successfully.`,
      role: updated,
    });
  }

  /**
   * DELETE /api/rbac/roles/:id
   * Remove custom role (prevent deletion of pre-configured system roles)
   */
  static deleteRole(req: Request, res: Response): void {
    const { id } = req.params;
    const role = roleRegistry.find((r) => r.id === id || r.code === id);

    if (!role) {
      res.status(404).json({ error: 'Not Found', message: 'Role not found.' });
      return;
    }

    if (role.isSystem) {
      res.status(400).json({
        error: 'Bad Request',
        message: `System role '${role.name}' is core to pharmacy operations and cannot be deleted.`,
      });
      return;
    }

    roleRegistry = roleRegistry.filter((r) => r.id !== role.id);

    res.json({
      success: true,
      message: `Custom role '${role.name}' has been deleted.`,
    });
  }

  /**
   * POST /api/auth/token
   * Issue signed JWT token for a specific role or user
   */
  static issueToken(req: Request, res: Response): void {
    const { roleCode, userId } = req.body;

    const user = PRECONFIGURED_USERS.find((u) => u.roleCode === roleCode || u.id === userId) || PRECONFIGURED_USERS[0];
    const role = roleRegistry.find((r) => r.code === user.roleCode);

    // Merge custom updated permissions if modified in registry
    const effectiveUser: AuthUser = {
      ...user,
      permissions: role ? role.permissions : user.permissions,
      maxDiscountPercent: role ? role.maxDiscountPercent : user.maxDiscountPercent,
      canViewPurchaseCosts: role ? role.canViewPurchaseCosts : user.canViewPurchaseCosts,
      canViewProfitMargins: role ? role.canViewProfitMargins : user.canViewProfitMargins,
      canViewAccounting: role ? role.canViewAccounting : user.canViewAccounting,
    };

    const token = generateJwtToken(effectiveUser);

    res.json({
      success: true,
      token,
      user: effectiveUser,
      expiresIn: '8h',
    });
  }
}
