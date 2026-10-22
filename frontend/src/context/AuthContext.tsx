import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AuthUser, RoleDefinition, Permission, PredefinedRoleCode } from '../types/rbac';
import { PRECONFIGURED_ROLES, PRECONFIGURED_USERS, evaluatePermission } from '../services/rbacDefaults';
import { generateJwtToken } from '../utils/tokenHelper';

export interface EmployeeCreateInput {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  roleCode: PredefinedRoleCode | string;
  branchId?: string;
  branchName?: string;
  licenseNumber?: string;
}

interface AuthContextType {
  currentUser: AuthUser;
  activeRole: RoleDefinition;
  allRoles: RoleDefinition[];
  allUsers: AuthUser[];
  token: string;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => { success: boolean; message?: string; user?: AuthUser };
  logout: () => void;
  switchUser: (userId: string) => void;
  switchRole: (roleCode: PredefinedRoleCode | string) => void;
  createCustomRole: (roleData: Omit<RoleDefinition, 'id' | 'isSystem' | 'updatedAt'>) => { success: boolean; message?: string; role?: RoleDefinition };
  updateRole: (roleId: string, updates: Partial<RoleDefinition>) => { success: boolean; message?: string };
  deleteRole: (roleId: string) => { success: boolean; message?: string };
  // Employee Directory & Role Assignment
  createEmployee: (data: EmployeeCreateInput) => { success: boolean; message?: string; user?: AuthUser };
  updateEmployee: (userId: string, updates: Partial<AuthUser>) => { success: boolean; message?: string };
  deleteEmployee: (userId: string) => { success: boolean; message?: string };
  assignRoleToUser: (userId: string, roleCode: string) => { success: boolean; message?: string };
  hasPermission: (perm: Permission) => boolean;
  hasAnyPermission: (perms: Permission[]) => boolean;
  hasAllPermissions: (perms: Permission[]) => boolean;
  isSuperAdmin: boolean;
  canViewCosts: boolean;
  canViewProfits: boolean;
  canViewAccounting: boolean;
  maxDiscountPercent: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_ROLES = 'pharmerp_roles_dynamic_v2';
const STORAGE_KEY_EMPLOYEES = 'pharmerp_employees_dynamic_v2';
const STORAGE_KEY_USER_ID = 'pharmerp_current_user_id_v2';
const STORAGE_KEY_AUTH_SESSION = 'pharmerp_auth_session_v2';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load roles (preconfigured + custom + saved modifications in localStorage)
  const [allRoles, setAllRoles] = useState<RoleDefinition[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ROLES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = PRECONFIGURED_ROLES.map((defRole) => {
            const found = parsed.find((r: RoleDefinition) => r.code === defRole.code || r.id === defRole.id);
            return found ? { ...defRole, ...found } : defRole;
          });
          const customRoles = parsed.filter(
            (r: RoleDefinition) => !PRECONFIGURED_ROLES.some((pr) => pr.code === r.code || pr.id === r.id)
          );
          return [...merged, ...customRoles];
        }
      }
    } catch {
      // Fallback
    }
    return PRECONFIGURED_ROLES;
  });

  // Load employee directory
  const [allUsers, setAllUsers] = useState<AuthUser[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EMPLOYEES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(parsed.map((u: any) => u.id));
          const missing = PRECONFIGURED_USERS.filter((pu) => !existingIds.has(pu.id));
          if (missing.length > 0) {
            const merged = [...parsed, ...missing];
            localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(merged));
            return merged;
          }
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return PRECONFIGURED_USERS;
  });

  // Load current active user ID (defaults to nahin3 if available)
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER_ID);
      if (saved) {
        return saved;
      }
    } catch {
      // Fallback
    }
    return PRECONFIGURED_USERS.find((u) => u.id === 'user-nahin3-superadmin')?.id || PRECONFIGURED_USERS[0].id;
  });

  // Load authentication status (defaults to true if session flag is set)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const session = localStorage.getItem(STORAGE_KEY_AUTH_SESSION);
      if (session === 'false') return false;
      if (session === 'true') return true;
      // Default initial state: authenticated for seamless access unless user signs out
      return true;
    } catch {
      return true;
    }
  });

  // Resolve base user
  const baseUser = allUsers.find((u) => u.id === currentUserId) || allUsers[0] || PRECONFIGURED_USERS[0];

  // Resolve active role definition (with latest dynamic permissions)
  const activeRole = allRoles.find((r) => r.code === baseUser.roleCode) || allRoles[0];

  // Effective user incorporating dynamic role definition
  const currentUser: AuthUser = {
    ...baseUser,
    roleName: activeRole.name,
    permissions: activeRole.permissions,
    maxDiscountPercent: activeRole.maxDiscountPercent,
    canViewPurchaseCosts: activeRole.canViewPurchaseCosts,
    canViewProfitMargins: activeRole.canViewProfitMargins,
    canViewAccounting: activeRole.canViewAccounting,
  };

  // Generate real JWT token for the user
  const [token, setToken] = useState<string>(() => generateJwtToken(currentUser));

  useEffect(() => {
    setToken(generateJwtToken(currentUser));
  }, [currentUser.id, currentUser.roleCode, activeRole.permissions, activeRole.maxDiscountPercent]);

  // Persist roles helper
  const persistRoles = (updatedRoles: RoleDefinition[]) => {
    setAllRoles(updatedRoles);
    try {
      localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(updatedRoles));
    } catch (e) {
      console.error('Failed to save roles to localStorage', e);
    }
  };

  // Persist employees helper
  const persistUsers = (updatedUsers: AuthUser[]) => {
    setAllUsers(updatedUsers);
    try {
      localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(updatedUsers));
    } catch (e) {
      console.error('Failed to save employees to localStorage', e);
    }
  };

  // Login handler
  const login = (email: string, password?: string): { success: boolean; message?: string; user?: AuthUser } => {
    const cleanEmail = email.trim().toLowerCase();
    const user = allUsers.find(
      (u) =>
        u.email.toLowerCase() === cleanEmail ||
        u.name.toLowerCase() === cleanEmail ||
        u.id.toLowerCase() === cleanEmail
    );

    if (!user) {
      return { success: false, message: 'Invalid credentials. User not found in system directory.' };
    }

    // Validate password if user has one configured
    if (user.password) {
      if (!password || user.password !== password) {
        return { success: false, message: 'Invalid password. Please verify and try again.' };
      }
    }

    setCurrentUserId(user.id);
    setIsAuthenticated(true);
    try {
      localStorage.setItem(STORAGE_KEY_USER_ID, user.id);
      localStorage.setItem(STORAGE_KEY_AUTH_SESSION, 'true');
    } catch {}

    return {
      success: true,
      message: `Welcome back, ${user.name}! Authenticated as ${user.roleName}.`,
      user,
    };
  };

  // Logout handler
  const logout = () => {
    setIsAuthenticated(false);
    try {
      localStorage.setItem(STORAGE_KEY_AUTH_SESSION, 'false');
    } catch {}
  };

  // Switch User
  const switchUser = (userId: string) => {
    const target = allUsers.find((u) => u.id === userId);
    if (target) {
      setCurrentUserId(target.id);
      try {
        localStorage.setItem(STORAGE_KEY_USER_ID, target.id);
      } catch {
        // Ignore
      }
    }
  };

  // Switch Role directly
  const switchRole = (roleCode: PredefinedRoleCode | string) => {
    const matchingUser = allUsers.find((u) => u.roleCode === roleCode);
    if (matchingUser) {
      switchUser(matchingUser.id);
    } else {
      const customRole = allRoles.find((r) => r.code === roleCode);
      if (customRole) {
        const tempUser: AuthUser = {
          ...baseUser,
          roleCode: customRole.code,
          roleName: customRole.name,
          permissions: customRole.permissions,
          maxDiscountPercent: customRole.maxDiscountPercent,
          canViewPurchaseCosts: customRole.canViewPurchaseCosts,
          canViewProfitMargins: customRole.canViewProfitMargins,
          canViewAccounting: customRole.canViewAccounting,
        };
        const updated = allUsers.map((u) => (u.id === baseUser.id ? tempUser : u));
        persistUsers(updated);
      }
    }
  };

  // Create Custom Role
  const createCustomRole = (
    roleData: Omit<RoleDefinition, 'id' | 'isSystem' | 'updatedAt'>
  ): { success: boolean; message?: string; role?: RoleDefinition } => {
    const sanitizedCode = roleData.code.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');

    if (allRoles.some((r) => r.code === sanitizedCode)) {
      return { success: false, message: `Role code '${sanitizedCode}' already exists.` };
    }

    const newRole: RoleDefinition = {
      ...roleData,
      id: `role-custom-${Date.now()}`,
      code: sanitizedCode,
      isSystem: false,
      updatedAt: new Date().toISOString().split('T')[0],
      colorBadge: roleData.colorBadge || 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    };

    const updated = [...allRoles, newRole];
    persistRoles(updated);
    return { success: true, message: `Custom role '${newRole.name}' created!`, role: newRole };
  };

  // Update Role (Permissions, Max Discount, Visibility)
  const updateRole = (roleId: string, updates: Partial<RoleDefinition>): { success: boolean; message?: string } => {
    const index = allRoles.findIndex((r) => r.id === roleId || r.code === roleId);
    if (index === -1) {
      return { success: false, message: 'Role not found.' };
    }

    const updatedRole: RoleDefinition = {
      ...allRoles[index],
      ...updates,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    const updatedRoles = [...allRoles];
    updatedRoles[index] = updatedRole;

    persistRoles(updatedRoles);

    // Cascading dynamic sync to all employees holding this role
    const syncedUsers = allUsers.map((u) => {
      if (u.roleCode === updatedRole.code) {
        return {
          ...u,
          roleName: updatedRole.name,
          permissions: updatedRole.permissions,
          maxDiscountPercent: updatedRole.maxDiscountPercent,
          canViewPurchaseCosts: updatedRole.canViewPurchaseCosts,
          canViewProfitMargins: updatedRole.canViewProfitMargins,
          canViewAccounting: updatedRole.canViewAccounting,
        };
      }
      return u;
    });
    persistUsers(syncedUsers);

    return { success: true, message: `Role '${updatedRole.name}' updated successfully.` };
  };

  // Delete Custom Role
  const deleteRole = (roleId: string): { success: boolean; message?: string } => {
    const target = allRoles.find((r) => r.id === roleId || r.code === roleId);
    if (!target) {
      return { success: false, message: 'Role not found.' };
    }
    if (target.isSystem) {
      return { success: false, message: 'System pre-configured roles cannot be deleted.' };
    }

    const updated = allRoles.filter((r) => r.id !== target.id);
    persistRoles(updated);

    if (activeRole.id === target.id) {
      switchUser(PRECONFIGURED_USERS[0].id);
    }

    return { success: true, message: `Custom role '${target.name}' deleted.` };
  };

  // --- Employee Management Methods ---
  const createEmployee = (data: EmployeeCreateInput): { success: boolean; message?: string; user?: AuthUser } => {
    const role = allRoles.find((r) => r.code === data.roleCode || r.id === data.roleCode) || allRoles[3]; // default cashier
    const newId = `user-emp-${Date.now()}`;
    const newUser: AuthUser = {
      id: newId,
      name: data.name.trim(),
      email: data.email.trim(),
      phone: data.phone?.trim() || undefined,
      password: data.password?.trim() || 'pharma123',
      roleCode: role.code,
      roleName: role.name,
      branchId: data.branchId || 'HQ-MAIN',
      branchName: data.branchName || 'Madina Eye Hospital & Pharmacy (Main)',
      licenseNumber: data.licenseNumber?.trim() || undefined,
      maxDiscountPercent: role.maxDiscountPercent,
      canViewPurchaseCosts: role.canViewPurchaseCosts,
      canViewProfitMargins: role.canViewProfitMargins,
      canViewAccounting: role.canViewAccounting,
      permissions: role.permissions,
    };

    const next = [...allUsers, newUser];
    persistUsers(next);

    return {
      success: true,
      message: `Employee '${newUser.name}' created with password and assigned role '${role.name}'.`,
      user: newUser,
    };
  };

  const updateEmployee = (userId: string, updates: Partial<AuthUser>): { success: boolean; message?: string } => {
    const next = allUsers.map((u) => {
      if (u.id === userId) {
        const targetRole = updates.roleCode
          ? allRoles.find((r) => r.code === updates.roleCode || r.id === updates.roleCode) || activeRole
          : allRoles.find((r) => r.code === u.roleCode) || activeRole;
        return {
          ...u,
          ...updates,
          roleCode: targetRole.code,
          roleName: targetRole.name,
          permissions: targetRole.permissions,
          maxDiscountPercent: targetRole.maxDiscountPercent,
          canViewPurchaseCosts: targetRole.canViewPurchaseCosts,
          canViewProfitMargins: targetRole.canViewProfitMargins,
          canViewAccounting: targetRole.canViewAccounting,
        };
      }
      return u;
    });
    persistUsers(next);
    return { success: true, message: 'Employee updated successfully.' };
  };

  const deleteEmployee = (userId: string): { success: boolean; message?: string } => {
    if (userId === PRECONFIGURED_USERS[0].id) {
      return { success: false, message: 'Primary Super Admin account cannot be deleted.' };
    }
    const next = allUsers.filter((u) => u.id !== userId);
    persistUsers(next);
    if (currentUserId === userId) {
      switchUser(PRECONFIGURED_USERS[0].id);
    }
    return { success: true, message: 'Employee removed from directory.' };
  };

  const assignRoleToUser = (userId: string, roleCode: string): { success: boolean; message?: string } => {
    const role = allRoles.find((r) => r.code === roleCode || r.id === roleCode);
    if (!role) return { success: false, message: 'Role not found.' };

    const next = allUsers.map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          roleCode: role.code,
          roleName: role.name,
          permissions: role.permissions,
          maxDiscountPercent: role.maxDiscountPercent,
          canViewPurchaseCosts: role.canViewPurchaseCosts,
          canViewProfitMargins: role.canViewProfitMargins,
          canViewAccounting: role.canViewAccounting,
        };
      }
      return u;
    });
    persistUsers(next);
    return { success: true, message: `Assigned role '${role.name}' to user.` };
  };

  // Granular Permission Evaluation
  const hasPermission = useCallback(
    (perm: Permission) => evaluatePermission(currentUser.permissions, perm),
    [currentUser.permissions]
  );

  const hasAnyPermission = useCallback(
    (perms: Permission[]) => perms.some((p) => evaluatePermission(currentUser.permissions, p)),
    [currentUser.permissions]
  );

  const hasAllPermissions = useCallback(
    (perms: Permission[]) => perms.every((p) => evaluatePermission(currentUser.permissions, p)),
    [currentUser.permissions]
  );

  const isSuperAdmin = currentUser.roleCode === 'super_admin' || currentUser.permissions.includes('*');

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        activeRole,
        allRoles,
        allUsers,
        token,
        isAuthenticated,
        login,
        logout,
        switchUser,
        switchRole,
        createCustomRole,
        updateRole,
        deleteRole,
        createEmployee,
        updateEmployee,
        deleteEmployee,
        assignRoleToUser,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        isSuperAdmin,
        canViewCosts: currentUser.canViewPurchaseCosts,
        canViewProfits: currentUser.canViewProfitMargins,
        canViewAccounting: currentUser.canViewAccounting,
        maxDiscountPercent: currentUser.maxDiscountPercent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
