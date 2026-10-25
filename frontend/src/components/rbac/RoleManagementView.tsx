import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { MODULE_PERMISSIONS, ALL_PERMISSIONS } from '../../services/rbacDefaults';
import { Permission, RoleDefinition, AuthUser } from '../../types/rbac';
import { BranchService } from '../../services/branchService';
import { 
  Shield, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Lock, 
  Users, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Copy, 
  CheckCircle2, 
  AlertTriangle,
  Building2,
  Mail,
  Phone,
  UserCheck,
  Search,
  ArrowRight,
  Filter,
  BadgeCheck,
  CheckSquare,
  Square,
  KeyRound
} from 'lucide-react';

export const RoleManagementView: React.FC = () => {
  const {
    allRoles,
    allUsers,
    currentUser,
    activeRole,
    switchUser,
    switchRole,
    createCustomRole,
    updateRole,
    deleteRole,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    assignRoleToUser,
    token,
    isSuperAdmin,
  } = useAuth();

  // Main Tab Navigation: Roles & Permissions vs Staff Directory
  const [activeMainTab, setActiveMainTab] = useState<'roles' | 'employees'>('roles');

  // Active Role being configured by Admin
  const [selectedRole, setSelectedRole] = useState<RoleDefinition>(() => {
    return allRoles.find((r) => r.code === 'pharmacy_manager') || allRoles[0];
  });

  // Modal States
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Employee Directory Filters
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeRoleFilter, setEmployeeRoleFilter] = useState('all');

  // Dynamic Branches for Employee Tagging
  const [availableBranches, setAvailableBranches] = useState(() => BranchService.getBranches());
  useEffect(() => {
    return BranchService.subscribe(() => {
      setAvailableBranches(BranchService.getBranches());
    });
  }, []);

  // New Employee Form State
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpEmployeeId, setNewEmpEmployeeId] = useState('');
  const [newEmpPassword, setNewEmpPassword] = useState('');
  const [newEmpPhone, setNewEmpPhone] = useState('');
  const [newEmpRole, setNewEmpRole] = useState<string>('cashier');
  const [newEmpBranch, setNewEmpBranch] = useState(() => {
    const list = BranchService.getBranches();
    return list.length > 0 ? list[0].id : 'main';
  });
  const [newEmpLicense, setNewEmpLicense] = useState('');

  // Change Password Modal State (Super Admin Only)
  const [changePasswordTarget, setChangePasswordTarget] = useState<AuthUser | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);

  // New Custom Role Form State
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCode, setNewRoleCode] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRoleDiscount, setNewRoleDiscount] = useState<number>(5);
  const [newRoleCostView, setNewRoleCostView] = useState(false);
  const [newRoleProfitView, setNewRoleProfitView] = useState(false);
  const [newRoleAccountingView, setNewRoleAccountingView] = useState(false);
  const [newRolePermissions, setNewRolePermissions] = useState<Permission[]>([]);
  const [baseCloneRole, setBaseCloneRole] = useState<string>('cashier');

  // Keep selected role in sync with allRoles updates
  const currentRoleDetails = allRoles.find((r) => r.id === selectedRole.id || r.code === selectedRole.code) || allRoles[0];

  const triggerToast = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  // Toggle single permission for the selected role
  const handleTogglePermission = (role: RoleDefinition, perm: Permission) => {
    let updatedPermissions: Permission[];
    if (role.permissions.includes(perm)) {
      updatedPermissions = role.permissions.filter((p) => p !== perm);
    } else {
      updatedPermissions = [...role.permissions, perm];
    }

    const res = updateRole(role.id, { permissions: updatedPermissions });
    if (res.success) {
      triggerToast('success', `Permission '${perm}' updated for ${role.name}. Changes applied dynamically!`);
    }
  };

  // Grant all permissions for a specific module group
  const handleGrantGroupPermissions = (role: RoleDefinition, moduleName: string) => {
    const group = MODULE_PERMISSIONS.find((m) => m.module === moduleName);
    if (!group) return;
    const groupCodes = group.permissions.map((p) => p.code);
    const updated = Array.from(new Set([...role.permissions, ...groupCodes]));
    updateRole(role.id, { permissions: updated });
    triggerToast('success', `Granted all ${group.name} permissions to ${role.name}`);
  };

  // Revoke all permissions for a specific module group
  const handleRevokeGroupPermissions = (role: RoleDefinition, moduleName: string) => {
    const group = MODULE_PERMISSIONS.find((m) => m.module === moduleName);
    if (!group) return;
    const groupCodes = new Set(group.permissions.map((p) => p.code));
    const updated = role.permissions.filter((p) => !groupCodes.has(p));
    updateRole(role.id, { permissions: updated });
    triggerToast('success', `Revoked all ${group.name} permissions from ${role.name}`);
  };

  const handleUpdateDiscountThreshold = (role: RoleDefinition, newThreshold: number) => {
    const val = Math.min(100, Math.max(0, newThreshold));
    updateRole(role.id, { maxDiscountPercent: val });
  };

  const handleCloneFromBase = (code: string) => {
    setBaseCloneRole(code);
    const base = allRoles.find((r) => r.code === code);
    if (base) {
      setNewRolePermissions([...base.permissions]);
      setNewRoleDiscount(base.maxDiscountPercent);
      setNewRoleCostView(base.canViewPurchaseCosts);
      setNewRoleProfitView(base.canViewProfitMargins);
      setNewRoleAccountingView(base.canViewAccounting);
    }
  };

  const handleCreateRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName || !newRoleCode) {
      triggerToast('error', 'Role Name and Unique Code are required.');
      return;
    }

    const res = createCustomRole({
      name: newRoleName.trim(),
      code: newRoleCode.trim(),
      description: newRoleDesc.trim() || 'Custom Security Role',
      permissions: newRolePermissions,
      maxDiscountPercent: newRoleDiscount,
      canViewPurchaseCosts: newRoleCostView,
      canViewProfitMargins: newRoleProfitView,
      canViewAccounting: newRoleAccountingView,
      colorBadge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    });

    if (res.success && res.role) {
      setShowCreateRoleModal(false);
      setSelectedRole(res.role);
      triggerToast('success', res.message || 'Custom role created successfully!');
      setNewRoleName('');
      setNewRoleCode('');
      setNewRoleDesc('');
      setNewRolePermissions([]);
    } else {
      triggerToast('error', res.message || 'Failed to create role.');
    }
  };

  const handleAddEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim() || !newEmpEmployeeId.trim()) {
      triggerToast('error', 'Employee Name and Employee ID are required.');
      return;
    }

    if (!newEmpPassword.trim()) {
      triggerToast('error', 'Please enter a login password for the new employee.');
      return;
    }

    const chosenBranch =
      availableBranches.find((b) => b.id === newEmpBranch) ||
      availableBranches.find((b) => b.code === newEmpBranch);
    const branchId = chosenBranch ? chosenBranch.id : (newEmpBranch || 'main');
    const branchName = chosenBranch ? chosenBranch.name : 'Main Branch';

    const res = createEmployee({
      name: newEmpName.trim(),
      employeeId: newEmpEmployeeId.trim(),
      phone: newEmpPhone.trim() || undefined,
      password: newEmpPassword.trim(),
      roleCode: newEmpRole,
      branchId,
      branchName,
      licenseNumber: newEmpLicense.trim() || undefined,
    });

    if (res.success) {
      setShowAddEmployeeModal(false);
      triggerToast('success', res.message || 'Employee registered and role assigned!');
      setNewEmpName('');
      setNewEmpEmployeeId('');
      setNewEmpPassword('');
      setNewEmpPhone('');
      setNewEmpLicense('');
    } else {
      triggerToast('error', res.message || 'Failed to add employee.');
    }
  };

  const handlePasswordResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!changePasswordTarget) return;

    if (!newResetPassword.trim()) {
      triggerToast('error', 'Please enter a new password.');
      return;
    }

    if (newResetPassword !== confirmResetPassword) {
      triggerToast('error', 'Passwords do not match. Please verify and re-type.');
      return;
    }

    const res = updateEmployee(changePasswordTarget.id, { password: newResetPassword.trim() });
    if (res.success) {
      triggerToast('success', `Password successfully updated for ${changePasswordTarget.name}!`);
      setShowResetPasswordModal(false);
      setChangePasswordTarget(null);
      setNewResetPassword('');
      setConfirmResetPassword('');
    } else {
      triggerToast('error', res.message || 'Failed to update employee password.');
    }
  };

  // Filtered employees
  const filteredEmployees = allUsers.filter((emp) => {
    const matchSearch =
      emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      (emp.employeeId && emp.employeeId.toLowerCase().includes(employeeSearch.toLowerCase())) ||
      emp.email.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      (emp.phone && emp.phone.includes(employeeSearch));
    const matchRole = employeeRoleFilter === 'all' || emp.roleCode === employeeRoleFilter;
    return matchSearch && matchRole;
  });

  if (!isSuperAdmin && currentUser?.roleCode !== 'super_admin') {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/50 m-6 max-w-lg mx-auto shadow-lg text-slate-800 dark:text-slate-200">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Access Restricted</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Settings & Roles management is strictly restricted to Super Admin only.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 text-slate-800">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 text-white p-5 rounded-2xl shadow-xl border border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-inner">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-white">
                Role-Based Access Control (RBAC) & Security Matrix
              </h2>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {allRoles.length} Roles Active
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Granular permission matrix, original functional checkboxes, live dynamic role inheritance, and staff assignment.
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {activeMainTab === 'roles' ? (
            <button
              onClick={() => {
                handleCloneFromBase('cashier');
                setShowCreateRoleModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Custom Role</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAddEmployeeModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Employee</span>
            </button>
          )}

          <button
            onClick={handleCopyToken}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            title="Copy signed Bearer JWT token for API testing"
          >
            {copiedToken ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedToken ? 'JWT Copied!' : 'Copy JWT'}</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all shadow-sm ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Main Section Navigation Switcher */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveMainTab('roles')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeMainTab === 'roles'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Role Permissions Matrix &amp; Guardrails</span>
          </button>

          <button
            onClick={() => setActiveMainTab('employees')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeMainTab === 'employees'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Staff &amp; Employee Directory ({allUsers.length})</span>
          </button>
        </div>

        {/* Live Preview Persona Indicator */}
        <div className="hidden sm:flex items-center gap-2 text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="text-slate-500 font-medium">Active Test Persona:</span>
          <strong className="text-purple-700 font-bold">{currentUser.name}</strong>
          <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-bold">
            {currentUser.roleName}
          </span>
          {currentUser.roleCode !== 'super_admin' && (
            <button
              onClick={() => switchUser(allUsers[0].id)}
              className="ml-2 text-[10px] font-bold text-sky-600 hover:text-sky-800 underline cursor-pointer"
            >
              Reset to Admin
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: ROLE PERMISSIONS MATRIX & GUARDRAILS */}
      {/* ======================================================== */}
      {activeMainTab === 'roles' && (
        <div className="space-y-6">
          {/* Role Selector Carousel / Grid */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wide">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span>Select Role to Configure Permissions:</span>
              </div>
              <span className="text-xs text-slate-500">
                Click any role to edit its access. Checkboxes below update the role immediately.
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {allRoles.map((role) => {
                const isSelected = currentRoleDetails.id === role.id;
                const isCurrentPersona = currentUser.roleCode === role.code;
                const grantedCount = role.permissions.includes('*')
                  ? ALL_PERMISSIONS.length
                  : role.permissions.length;

                return (
                  <div
                    key={role.id}
                    onClick={() => setSelectedRole(role)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[76px] relative group ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50/90 shadow-sm ring-2 ring-purple-500/20'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 leading-tight">
                          {role.name}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {role.permissions.includes('*') ? 'All (*)' : `${grantedCount} perms`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1 pt-1 border-t border-slate-200/60">
                      <span>Disc: {role.maxDiscountPercent}%</span>
                      {isCurrentPersona ? (
                        <span className="text-purple-700 font-extrabold uppercase">Live</span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            switchRole(role.code);
                          }}
                          className="text-[9px] text-sky-600 hover:text-sky-800 font-bold underline"
                          title="Switch active session persona to this role"
                        >
                          Test
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Role Detail Header & Guardrails Inspection */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Role Profile & Guardrail Config */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">{currentRoleDetails.name}</h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        currentRoleDetails.isSystem
                          ? 'bg-slate-100 text-slate-700 border-slate-300'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {currentRoleDetails.isSystem ? 'System Role' : 'Custom Role'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{currentRoleDetails.description}</p>
                </div>

                {!currentRoleDetails.isSystem && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete custom role ${currentRoleDetails.name}?`)) {
                        deleteRole(currentRoleDetails.id);
                        setSelectedRole(allRoles[0]);
                      }
                    }}
                    className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                    title="Delete Custom Role"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Dynamic Role Inheritance Status Box */}
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-purple-900 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Dynamic Role Inheritance Active</span>
                </div>
                <p className="text-[11px] text-purple-800 leading-snug">
                  Any permission checked below immediately updates the role. All employees assigned this role ({allUsers.filter((u) => u.roleCode === currentRoleDetails.code).length} staff) and their sidebar navigation will refresh in real time.
                </p>
              </div>

              {/* Security Guardrails Panel */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                <div className="font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5 text-[11px]">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Enforced Security Guardrails</span>
                </div>

                {/* Guardrail 1: Max Manual Discount */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-slate-700">
                    <span>Max Manual Discount Limit:</span>
                    <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                      {currentRoleDetails.maxDiscountPercent}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={currentRoleDetails.maxDiscountPercent}
                      onChange={(e) => handleUpdateDiscountThreshold(currentRoleDetails, Number(e.target.value))}
                      className="w-full accent-purple-600 cursor-pointer"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Discounts exceeding this threshold require Manager Override Authorization.
                  </p>
                </div>

                {/* Guardrail 2: Purchase Cost Visibility */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {currentRoleDetails.canViewPurchaseCosts ? (
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-rose-500" />
                    )}
                    <span>View Purchase / Cost Prices</span>
                  </div>
                  <button
                    onClick={() =>
                      updateRole(currentRoleDetails.id, {
                        canViewPurchaseCosts: !currentRoleDetails.canViewPurchaseCosts,
                      })
                    }
                    className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer border ${
                      currentRoleDetails.canViewPurchaseCosts
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}
                  >
                    {currentRoleDetails.canViewPurchaseCosts ? 'Allowed' : 'Masked (***)'}
                  </button>
                </div>

                {/* Guardrail 3: Profit Margins Visibility */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {currentRoleDetails.canViewProfitMargins ? (
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-rose-500" />
                    )}
                    <span>View Profit &amp; Gross Margins</span>
                  </div>
                  <button
                    onClick={() =>
                      updateRole(currentRoleDetails.id, {
                        canViewProfitMargins: !currentRoleDetails.canViewProfitMargins,
                      })
                    }
                    className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer border ${
                      currentRoleDetails.canViewProfitMargins
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}
                  >
                    {currentRoleDetails.canViewProfitMargins ? 'Allowed' : 'Masked'}
                  </button>
                </div>

                {/* Guardrail 4: Accounting Books Access */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {currentRoleDetails.canViewAccounting ? (
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-rose-500" />
                    )}
                    <span>Access Accounting Ledger</span>
                  </div>
                  <button
                    onClick={() =>
                      updateRole(currentRoleDetails.id, {
                        canViewAccounting: !currentRoleDetails.canViewAccounting,
                      })
                    }
                    className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer border ${
                      currentRoleDetails.canViewAccounting
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}
                  >
                    {currentRoleDetails.canViewAccounting ? 'Allowed' : 'Blocked'}
                  </button>
                </div>
              </div>

              {/* Total Active Count */}
              <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                <span>
                  <strong>Granted Privileges:</strong>{' '}
                  {currentRoleDetails.permissions.includes('*') ? (
                    <span className="font-bold text-purple-600">Full Root Wildcard (*)</span>
                  ) : (
                    <span className="font-bold text-slate-900">
                      {currentRoleDetails.permissions.length} of {ALL_PERMISSIONS.length}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => switchRole(currentRoleDetails.code)}
                  className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-[10px] cursor-pointer"
                >
                  Test This Role
                </button>
              </div>
            </div>

            {/* Right 2 cols: Granular Permissions Matrix with Real Functional Checkboxes */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <span>Granular Permissions for:</span>
                    <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 font-bold">
                      {currentRoleDetails.name}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click checkboxes to grant or revoke specific actions. Changes take effect dynamically.
                  </p>
                </div>

                {!currentRoleDetails.permissions.includes('*') && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => {
                        updateRole(currentRoleDetails.id, { permissions: ALL_PERMISSIONS });
                        triggerToast('success', `Granted ALL permissions to ${currentRoleDetails.name}`);
                      }}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-bold cursor-pointer transition-colors"
                    >
                      Grant All
                    </button>
                    <button
                      onClick={() => {
                        updateRole(currentRoleDetails.id, { permissions: [] });
                        triggerToast('success', `Revoked all permissions from ${currentRoleDetails.name}`);
                      }}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold cursor-pointer transition-colors"
                    >
                      Revoke All
                    </button>
                  </div>
                )}
              </div>

              {currentRoleDetails.permissions.includes('*') ? (
                <div className="p-8 text-center bg-purple-50 rounded-2xl border border-purple-200 space-y-2">
                  <Sparkles className="w-8 h-8 text-purple-600 mx-auto" />
                  <h4 className="font-bold text-slate-900">Root Wildcard Privilege Active (*)</h4>
                  <p className="text-xs text-purple-800 max-w-md mx-auto">
                    {currentRoleDetails.name} inherits unrestricted authorization across all present and future modules without restriction.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[620px] overflow-y-auto pr-1">
                  {MODULE_PERMISSIONS.map((group) => {
                    const grantedCount = group.permissions.filter((p) =>
                      currentRoleDetails.permissions.includes(p.code)
                    ).length;
                    const allInGroupGranted = grantedCount === group.permissions.length;

                    return (
                      <div key={group.module} className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        {/* Group Header with Select/Deselect All */}
                        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="font-black text-xs text-slate-800 uppercase tracking-wide">
                              {group.name}
                            </span>
                            <p className="text-[10px] text-slate-500">{group.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                              {grantedCount} / {group.permissions.length}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                allInGroupGranted
                                  ? handleRevokeGroupPermissions(currentRoleDetails, group.module)
                                  : handleGrantGroupPermissions(currentRoleDetails, group.module)
                              }
                              className="text-[11px] font-bold text-purple-700 hover:text-purple-900 hover:underline cursor-pointer"
                            >
                              {allInGroupGranted ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>
                        </div>

                        {/* Granular Permission Items with Real Checkboxes */}
                        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white">
                          {group.permissions.map((perm) => {
                            const isChecked = currentRoleDetails.permissions.includes(perm.code);
                            return (
                              <label
                                key={perm.code}
                                htmlFor={`perm-check-${perm.code}`}
                                className={`p-2.5 rounded-xl border transition-all flex items-start gap-2.5 select-none cursor-pointer ${
                                  isChecked
                                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-2xs'
                                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                                }`}
                              >
                                {/* Original Functional HTML Checkbox */}
                                <div className="pt-0.5 shrink-0">
                                  <input
                                    type="checkbox"
                                    id={`perm-check-${perm.code}`}
                                    checked={isChecked}
                                    onChange={() => handleTogglePermission(currentRoleDetails, perm.code)}
                                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                                  />
                                </div>

                                <div className="flex-1 space-y-0.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-xs text-slate-900">{perm.label}</span>
                                    {perm.isSensitive && (
                                      <span className="text-[9px] px-1 py-0.2 bg-amber-100 text-amber-800 rounded font-bold border border-amber-200">
                                        Sensitive
                                      </span>
                                    )}
                                  </div>
                                  <code className="text-[10px] text-slate-500 block font-mono">
                                    {perm.code}
                                  </code>
                                  <p className="text-[10px] text-slate-500 leading-tight">
                                    {perm.description}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: STAFF & EMPLOYEE DIRECTORY (ASSIGN ROLES) */}
      {/* ======================================================== */}
      {activeMainTab === 'employees' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                <span>Pharmacy Staff &amp; Employee Directory</span>
              </h3>
              <p className="text-xs text-slate-500">
                When adding an employee, simply assign them a role. All permissions and guardrails are inherited automatically.
              </p>
            </div>

            <button
              onClick={() => {
                setNewEmpName('');
                setNewEmpEmployeeId('');
                setNewEmpPassword('');
                setNewEmpPhone('');
                setNewEmpLicense('');
                setShowAddEmployeeModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Employee</span>
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff by name, Employee ID, or phone..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="bg-transparent border-none outline-none w-full text-xs text-slate-800 placeholder-slate-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-600">Filter Role:</span>
              <select
                value={employeeRoleFilter}
                onChange={(e) => setEmployeeRoleFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer"
              >
                <option value="all">All Roles ({allUsers.length})</option>
                {allRoles.map((r) => (
                  <option key={r.id} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Employees Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-extrabold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Branch Location</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Effective Permissions</th>
                  <th className="py-3 px-4">Discount Cap</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => {
                  const empRole = allRoles.find((r) => r.code === emp.roleCode) || allRoles[0];
                  const isCurrent = currentUser.id === emp.id;
                  const grantedCount = empRole.permissions.includes('*')
                    ? ALL_PERMISSIONS.length
                    : empRole.permissions.length;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-black flex items-center justify-center shrink-0 border border-purple-200">
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">{emp.name}</span>
                              {isCurrent && (
                                <span className="text-[9px] px-1.5 py-0.2 bg-purple-100 text-purple-800 font-bold rounded">
                                  Current
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span className="flex items-center gap-1 font-mono font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                <BadgeCheck className="w-3 h-3 text-purple-600" />
                                <span>ID: {emp.employeeId || emp.email.split('@')[0]}</span>
                              </span>
                              {emp.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {emp.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{emp.branchName}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {/* Dynamic Role Assignment Dropdown */}
                        <select
                          value={emp.roleCode}
                          onChange={(e) => {
                            assignRoleToUser(emp.id, e.target.value);
                            triggerToast(
                              'success',
                              `Role updated to '${allRoles.find((r) => r.code === e.target.value)?.name}' for ${emp.name}`
                            );
                          }}
                          className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 cursor-pointer shadow-2xs hover:border-purple-500"
                        >
                          {allRoles.map((r) => (
                            <option key={r.id} value={r.code}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-700">
                          {empRole.permissions.includes('*') ? (
                            <span className="text-purple-600 font-bold">Root All (*)</span>
                          ) : (
                            `${grantedCount} / ${ALL_PERMISSIONS.length} Privileges`
                          )}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {empRole.maxDiscountPercent}%
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Super Admin Change Password Action */}
                          {(isSuperAdmin || currentUser?.roleCode === 'super_admin') && (
                            <button
                              onClick={() => {
                                setChangePasswordTarget(emp);
                                setNewResetPassword('');
                                setConfirmResetPassword('');
                                setShowResetPasswordModal(true);
                              }}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Reset/Change password for this employee"
                            >
                              <KeyRound className="w-3 h-3 text-amber-600" />
                              <span>Change Pass</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              switchUser(emp.id);
                              triggerToast('success', `Switched active session to ${emp.name}`);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                              isCurrent
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                            title="Switch active user to preview their view"
                          >
                            {isCurrent ? 'Active Now' : 'Login / Test'}
                          </button>

                          {emp.id !== allUsers[0]?.id && (
                            <button
                              onClick={() => {
                                if (confirm(`Remove employee ${emp.name}?`)) {
                                  deleteEmployee(emp.id);
                                  triggerToast('success', `Removed ${emp.name}`);
                                }
                              }}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Delete Employee"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD NEW EMPLOYEE & ASSIGN ROLE */}
      {/* ======================================================== */}
      {showAddEmployeeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-bold">Register Staff &amp; Assign Role</h3>
              </div>
              <button
                onClick={() => setShowAddEmployeeModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEmployeeSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Employee Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tanvir Ahmed, BPharm"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Employee ID (Login ID) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EMP-101 or CSH-01"
                    value={newEmpEmployeeId}
                    onChange={(e) => setNewEmpEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Login Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter employee password..."
                    value={newEmpPassword}
                    onChange={(e) => setNewEmpPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+880 1711-000000"
                  value={newEmpPhone}
                  onChange={(e) => setNewEmpPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* Crucial Requirement: Assign Role */}
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1.5">
                <label className="font-bold text-purple-900 block text-xs">
                  Assign System / Custom Role *
                </label>
                <p className="text-[10px] text-purple-700">
                  The employee will automatically inherit all permissions, discount limits, and financial visibility defined for this role.
                </p>
                <select
                  value={newEmpRole}
                  onChange={(e) => setNewEmpRole(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-purple-300 rounded-lg text-xs font-bold text-slate-900 shadow-2xs cursor-pointer"
                >
                  {allRoles.map((r) => (
                    <option key={r.id} value={r.code}>
                      {r.name} ({r.permissions.includes('*') ? 'All Permissions' : `${r.permissions.length} perms`}, Disc: {r.maxDiscountPercent}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Assigned Branch (Facility Tag)</label>
                  <select
                    value={newEmpBranch}
                    onChange={(e) => setNewEmpBranch(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                  >
                    {availableBranches.length === 0 ? (
                      <option value="main">Main Branch (Default)</option>
                    ) : (
                      availableBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code}) — {b.type.replace('_', ' ').toUpperCase()}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Reg / License No.</label>
                  <input
                    type="text"
                    placeholder="e.g. RPH-99120"
                    value={newEmpLicense}
                    onChange={(e) => setNewEmpLicense(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddEmployeeModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-sm cursor-pointer"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: RESET / CHANGE EMPLOYEE PASSWORD (SUPER ADMIN ONLY) */}
      {/* ======================================================== */}
      {showResetPasswordModal && changePasswordTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Change Employee Password</h3>
                  <p className="text-[10px] text-slate-400">Super Admin Administrative Security Control</p>
                </div>
              </div>
              <button
                onClick={() => setShowResetPasswordModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePasswordResetSubmit} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-slate-800 font-bold">
                  <span>{changePasswordTarget.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">
                    {changePasswordTarget.roleName}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-2">
                  <span>Employee ID:</span>
                  <span className="font-mono font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {changePasswordTarget.employeeId || changePasswordTarget.email.split('@')[0]}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  New Security Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password (e.g. 1800 or custom)..."
                  value={newResetPassword}
                  onChange={(e) => setNewResetPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter new password to verify..."
                  value={confirmResetPassword}
                  onChange={(e) => setConfirmResetPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetPasswordModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Save New Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE CUSTOM ROLE */}
      {/* ======================================================== */}
      {showCreateRoleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold">Create Dynamic Custom Role</h3>
              </div>
              <button
                onClick={() => setShowCreateRoleModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRoleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Clone Preset */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <label className="font-bold text-slate-700">Clone Base Permissions From Existing Role:</label>
                <select
                  value={baseCloneRole}
                  onChange={(e) => handleCloneFromBase(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {allRoles.map((r) => (
                    <option key={r.id} value={r.code}>
                      {r.name} ({r.permissions.length} perms, Disc: {r.maxDiscountPercent}%)
                    </option>
                  ))}
                </select>
              </div>

              {/* Role Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Role Display Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Dispensary Tech"
                    value={newRoleName}
                    onChange={(e) => {
                      setNewRoleName(e.target.value);
                      if (!newRoleCode) {
                        setNewRoleCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Unique Role Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. senior_dispensary_tech"
                    value={newRoleCode}
                    onChange={(e) => setNewRoleCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Responsibilities and authorization scope..."
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* Guardrails Configuration */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                <span className="font-bold text-amber-900 block text-[11px] uppercase tracking-wide">
                  Configure Role Security Guardrails
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Max Manual Discount %: <strong className="text-slate-900">{newRoleDiscount}%</strong>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newRoleDiscount}
                      onChange={(e) => setNewRoleDiscount(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={newRoleCostView}
                        onChange={(e) => setNewRoleCostView(e.target.checked)}
                        className="rounded accent-purple-600"
                      />
                      <span>Allow Purchase Price Visibility</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={newRoleProfitView}
                        onChange={(e) => setNewRoleProfitView(e.target.checked)}
                        className="rounded accent-purple-600"
                      />
                      <span>Allow Profit Margin Analytics</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={newRoleAccountingView}
                        onChange={(e) => setNewRoleAccountingView(e.target.checked)}
                        className="rounded accent-purple-600"
                      />
                      <span>Allow Accounting Books Access</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Module Granular Permissions Checkboxes */}
              <div className="space-y-3">
                <span className="font-bold text-slate-700 uppercase tracking-wide text-[11px] block">
                  Select Granular Module Permissions ({newRolePermissions.length} selected)
                </span>

                {MODULE_PERMISSIONS.map((group) => (
                  <div key={group.module} className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{group.name}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const modPerms = group.permissions.map((p) => p.code);
                            setNewRolePermissions((prev) => Array.from(new Set([...prev, ...modPerms])));
                          }}
                          className="text-[10px] text-purple-700 hover:underline font-bold cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            const modPerms = new Set(group.permissions.map((p) => p.code));
                            setNewRolePermissions((prev) => prev.filter((code) => !modPerms.has(code)));
                          }}
                          className="text-[10px] text-slate-500 hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {group.permissions.map((p) => {
                        const checked = newRolePermissions.includes(p.code);
                        return (
                          <label
                            key={p.code}
                            className={`p-1.5 rounded border flex items-center gap-2 cursor-pointer text-[11px] ${
                              checked
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewRolePermissions((prev) => [...prev, p.code]);
                                } else {
                                  setNewRolePermissions((prev) => prev.filter((code) => code !== p.code));
                                }
                              }}
                              className="rounded accent-emerald-600"
                            />
                            <span>{p.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateRoleModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm cursor-pointer"
                >
                  Save &amp; Activate Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
