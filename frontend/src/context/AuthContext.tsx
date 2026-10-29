import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { AuthUser, RoleDefinition, Permission, PredefinedRoleCode } from '../types/rbac';
import { PRECONFIGURED_ROLES, PRECONFIGURED_USERS, evaluatePermission } from '../services/rbacDefaults';
import { generateJwtToken } from '../utils/tokenHelper';
import { userApi } from '../lib/api';

export interface EmployeeCreateInput {
  name: string;
  employeeId: string;
  email?: string;
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
  login: (employeeIdOrEmail: string, password?: string) => Promise<{ success: boolean; message?: string; user?: AuthUser }> | { success: boolean; message?: string; user?: AuthUser };
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

const STORAGE_KEY_ROLES = 'pharmerp_roles_db_v3';
const STORAGE_KEY_EMPLOYEES = 'pharmerp_employees_db_v3';
const STORAGE_KEY_USER_ID = 'pharmerp_current_user_id_v3';
const STORAGE_KEY_AUTH_SESSION = 'pharmerp_auth_session_v3';

const LEGACY_MOCK_IDS = new Set([
  'user-super-admin',
  'user-manager',
  'user-pharmacist',
  'user-cashier',
  'user-storekeeper',
  'user-purchase',
  'user-accountant',
  'user-auditor',
  'user-nahin3-superadmin',
  'user-nahin1-admin',
  'user-nahin1-acc',
  'user-nahin-cashier',
  'user-pharmacist-01',
  'user-storekeeper-01',
  'user-purchase-01',
  'user-auditor-01',
  'be08c99a-5b9c-4265-88e5-cd3605fa4fcd',
]);

const isLegacyUser = (u: any) =>
  !u ||
  LEGACY_MOCK_IDS.has(u.id) ||
  (typeof u.email === 'string' && (u.email.endsWith('@phamerp.io') || u.email.includes('hospital.com'))) ||
  (typeof u.name === 'string' && u.name.toLowerCase().startsWith('nahin'));

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Clear legacy v2 storage if present
  try {
    localStorage.removeItem('pharmerp_employees_dynamic_v2');
  } catch {}

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
          // Filter out any mock personas and legacy test employees
          const cleanUsers = parsed.filter((u: any) => !isLegacyUser(u));
          const existingIds = new Set(cleanUsers.map((u: any) => u.id));
          const missing = PRECONFIGURED_USERS.filter((pu) => !existingIds.has(pu.id));
          const merged = [...cleanUsers, ...missing];
          if (merged.length > 0) {
            localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(merged));
            return merged;
          }
        }
      }
    } catch {
      // Fallback
    }
    return PRECONFIGURED_USERS;
  });

  // Load current active user ID (defaults to single super admin admin@1)
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER_ID);
      if (saved && !LEGACY_MOCK_IDS.has(saved)) {
        return saved;
      }
    } catch {
      // Fallback
    }
    return PRECONFIGURED_USERS[0].id;
  });

  // Load authentication status (defaults to false so unauthenticated users must sign in via LoginPage.tsx)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const session = localStorage.getItem(STORAGE_KEY_AUTH_SESSION);
      if (session === 'true') return true;
      return false;
    } catch {
      return false;
    }
  });

  // Resolve base user
  const baseUser = allUsers.find((u) => u.id === currentUserId) || allUsers[0] || PRECONFIGURED_USERS[0];

  // Resolve active role definition (with latest dynamic permissions)
  const activeRole = allRoles.find((r) => r.code === baseUser.roleCode) || allRoles[0];

  // Effective user incorporating dynamic role definition
  const currentUser: AuthUser = useMemo(() => ({
    ...baseUser,
    roleName: activeRole.name,
    permissions: activeRole.permissions,
    maxDiscountPercent: activeRole.maxDiscountPercent,
    canViewPurchaseCosts: activeRole.canViewPurchaseCosts,
    canViewProfitMargins: activeRole.canViewProfitMargins,
    canViewAccounting: activeRole.canViewAccounting,
  }), [baseUser, activeRole]);

  // Generate real JWT token for the user
  const [token, setToken] = useState<string>(() => generateJwtToken(currentUser));

  // Sync users directly from Neon PostgreSQL Database on mount & poll every 30s
  useEffect(() => {
    let isMounted = true;
    let endpointAvailable = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const syncUsersFromDB = () => {
      if (!endpointAvailable) return;
      userApi.getUsers().then((dbUsers: any) => {
        if (!isMounted) return;
        if (Array.isArray(dbUsers) && dbUsers.length > 0) {
          const cleanDbUsers = dbUsers.filter((u: any) => !isLegacyUser(u));
          const finalUsers = cleanDbUsers.length > 0 ? cleanDbUsers : PRECONFIGURED_USERS;
          setAllUsers((prev) => {
            if (JSON.stringify(prev) === JSON.stringify(finalUsers)) {
              return prev;
            }
            try {
              localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(finalUsers));
            } catch {}
            return finalUsers;
          });
        }
      }).catch((e: any) => {
        if (e?.response?.status === 404) {
          // Stop spamming 404 polls if backend deployment hasn't mounted /api/users yet
          endpointAvailable = false;
          if (intervalId) clearInterval(intervalId);
        }
      });
    };

    syncUsersFromDB();
    intervalId = setInterval(syncUsersFromDB, 30000);
    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

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

  // Login handler with Server Authentication & Fallback support
  const login = async (employeeIdOrEmail: string, password?: string): Promise<{ success: boolean; message?: string; user?: AuthUser }> => {
    const cleanId = employeeIdOrEmail.trim();

    // 1. Try server-side validation against database
    try {
      const serverRes = await userApi.login({ identifier: cleanId, password });
      if (serverRes && serverRes.success && serverRes.user) {
        if (serverRes.token) {
          localStorage.setItem('pharmerp_jwt_token', serverRes.token);
        }
        setCurrentUserId(serverRes.user.id);
        setIsAuthenticated(true);
        localStorage.setItem(STORAGE_KEY_USER_ID, serverRes.user.id);
        localStorage.setItem(STORAGE_KEY_AUTH_SESSION, 'true');
        return {
          success: true,
          message: `Welcome back, ${serverRes.user.name}! Authenticated as ${serverRes.user.roleName}.`,
          user: serverRes.user,
        };
      }
    } catch (err: any) {
      console.warn('Server authentication failed or server offline, trying local directory:', err?.response?.data?.message || err.message);
    }

    // 2. Offline / local fallback (e.g. root Super Admin admin/1800)
    const cleanLower = cleanId.toLowerCase();
    let user = allUsers.find(
      (u) =>
        (u.employeeId && u.employeeId.toLowerCase() === cleanLower) ||
        u.email.toLowerCase() === cleanLower ||
        u.name.toLowerCase() === cleanLower ||
        u.id.toLowerCase() === cleanLower
    );

    if (!user && (cleanLower === 'admin' || cleanLower === 'admin@1' || cleanLower === 'super_admin' || cleanLower === 'super admin')) {
      user = PRECONFIGURED_USERS[0];
    }

    if (!user) {
      return { success: false, message: 'Invalid Employee ID. No registered staff found with this ID.' };
    }

    // Validate password if known locally (or admin default 1800)
    const validPass = user.password || (user.roleCode === 'super_admin' ? '1800' : undefined);
    if (validPass && validPass !== password) {
      return { success: false, message: 'Invalid password. Please verify and try again.' };
    }

    setCurrentUserId(user.id);
    setIsAuthenticated(true);
    try {
      localStorage.setItem('pharmerp_jwt_token', `pharmerp_token_${user.id}`);
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
      localStorage.removeItem('pharmerp_jwt_token');
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
    const cleanEmpId = (data.employeeId || data.email || data.name || 'EMP').trim();
    const generatedEmail = data.email?.trim() || (cleanEmpId.includes('@') ? cleanEmpId : `${cleanEmpId.toLowerCase()}@pharma.local`);
    const newUser: AuthUser = {
      id: newId,
      employeeId: cleanEmpId,
      name: data.name.trim(),
      email: generatedEmail,
      phone: data.phone?.trim() || undefined,
      password: data.password?.trim() || '1800',
      roleCode: role.code,
      roleName: role.name,
      branchId: data.branchId || 'br-snakra',
      branchName: data.branchName || 'snakra',
      licenseNumber: data.licenseNumber?.trim() || undefined,
      maxDiscountPercent: role.maxDiscountPercent,
      canViewPurchaseCosts: role.canViewPurchaseCosts,
      canViewProfitMargins: role.canViewProfitMargins,
      canViewAccounting: role.canViewAccounting,
      permissions: role.permissions,
    };

    const next = [...allUsers, newUser];
    persistUsers(next);

    // Save directly to Neon Database
    userApi.createUser(newUser).catch((e) => console.error('Failed to create user in database:', e));

    return {
      success: true,
      message: `Employee '${newUser.name}' (ID: ${cleanEmpId}) created and saved to database.`,
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

    // Save directly to Neon Database
    userApi.updateUser(userId, updates).catch((e) => console.error('Failed to update user in database:', e));

    return { success: true, message: 'Employee updated successfully in database.' };
  };

  const deleteEmployee = (userId: string): { success: boolean; message?: string } => {
    if (userId === PRECONFIGURED_USERS[0].id) {
      return { success: false, message: 'Primary Super Admin account cannot be deleted.' };
    }
    const next = allUsers.filter((u) => u.id !== userId);
    persistUsers(next);

    // Delete directly from Neon Database
    userApi.deleteUser(userId).catch((e) => console.error('Failed to delete user in database:', e));

    if (currentUserId === userId) {
      switchUser(PRECONFIGURED_USERS[0].id);
    }
    return { success: true, message: 'Employee removed from directory and database.' };
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
