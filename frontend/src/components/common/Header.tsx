import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Pill, 
  ShoppingCart, 
  Boxes, 
  ClockAlert, 
  FileText, 
  Truck, 
  RotateCcw, 
  TrendingUp, 
  AlertTriangle,
  Building2,
  LayoutDashboard,
  ShieldCheck,
  Users,
  SlidersHorizontal,
} from 'lucide-react';
import { ActiveTab } from '../../types/pharmacy';
import { useAuth } from '../../context/AuthContext';
import { LanguageSwitcher } from './LanguageSwitcher';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  lowStockCount: number;
  expiredBatchesCount: number;
  nearExpiryBatchesCount: number;
  heldCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  lowStockCount,
  expiredBatchesCount,
  nearExpiryBatchesCount,
  heldCount,
}) => {
  const { t } = useTranslation();
  const { currentUser, allUsers, switchUser, hasPermission } = useAuth();

  const allTabs: { 
    id: ActiveTab; 
    label: string; 
    icon: React.ComponentType<{ className?: string }>; 
    badge?: number; 
    badgeColor?: string;
    requiredPermission?: string;
    adminOnly?: boolean;
  }[] = [
    { id: 'dashboard', label: t('nav.dashboard', 'Dashboard'), icon: LayoutDashboard, requiredPermission: 'reports:sales:view' },
    { id: 'pos', label: t('nav.pos', 'POS Checkout'), icon: ShoppingCart, badge: heldCount > 0 ? heldCount : undefined, badgeColor: 'bg-amber-500', requiredPermission: 'pos:sale:create' },
    { id: 'inventory', label: t('nav.inventory', 'Medicines & Stock'), icon: Boxes, badge: lowStockCount > 0 ? lowStockCount : undefined, badgeColor: 'bg-rose-500', requiredPermission: 'inventory:stock:view' },
    { id: 'batches_expiry', label: t('nav.batches_expiry', 'FEFO & Expiry'), icon: ClockAlert, badge: (expiredBatchesCount + nearExpiryBatchesCount) > 0 ? (expiredBatchesCount + nearExpiryBatchesCount) : undefined, badgeColor: expiredBatchesCount > 0 ? 'bg-red-600 animate-pulse' : 'bg-amber-500', requiredPermission: 'inventory:stock:view' },
    { id: 'adjustments_audit', label: t('nav.adjustments_audit', 'Adjustments & Audit'), icon: SlidersHorizontal, requiredPermission: 'inventory:stock:view' },
    { id: 'prescriptions', label: t('nav.prescriptions', 'Prescriptions'), icon: FileText, requiredPermission: 'prescriptions:rx:view' },
    { id: 'purchases', label: t('nav.purchases', 'Inward / Purchases'), icon: Truck, requiredPermission: 'purchases:po:view' },
    { id: 'customers', label: t('nav.customers', 'Customers & Ledger'), icon: Users, requiredPermission: 'pos:sale:create' },
    { id: 'returns', label: t('nav.returns', 'Sales Returns'), icon: RotateCcw, requiredPermission: 'returns:sale:view' },
    { id: 'accounting_analytics', label: t('nav.accounting', 'Profit & Accounting'), icon: TrendingUp, requiredPermission: 'accounting:ledger:view' },
    { id: 'rbac', label: t('nav.rbac', 'Access Control'), icon: ShieldCheck },
  ];

  // Check visibility for each tab
  const visibleTabs = allTabs.filter(tab => {
    if (tab.id === 'rbac') return true; // Always visible to inspect/test RBAC
    if (!tab.requiredPermission) return true;
    return hasPermission(tab.requiredPermission as any);
  });

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
      {/* Top Utility Ribbon */}
      <div className="px-4 py-1.5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Strict FEFO Active
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>License: <strong className="text-slate-200">DL-MED-99410-RX</strong></span>
          </div>
        </div>

        {/* Expiry alerts, Language Switcher & RBAC Quick Role Switcher */}
        <div className="flex items-center gap-2">
          {expiredBatchesCount > 0 && hasPermission('inventory:stock:view') && (
            <button
              onClick={() => setActiveTab('batches_expiry')}
              className="flex items-center gap-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 px-2.5 py-1 rounded border border-red-500/30 font-semibold cursor-pointer transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>{expiredBatchesCount} Expired Locked</span>
            </button>
          )}

          {/* Bilingual Language Switcher (EN / BN) */}
          <LanguageSwitcher />

          {/* Quick Role & Staff Switcher Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 transition-colors">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="text-slate-400 hidden md:inline text-[11px]">Role:</span>
            <select
              value={currentUser.id}
              onChange={(e) => switchUser(e.target.value)}
              className="bg-transparent text-emerald-300 font-bold text-xs cursor-pointer focus:outline-hidden pr-2"
              title="Switch user to evaluate RBAC and permission guardrails"
            >
              {allUsers.map((u) => (
                <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                  {u.roleName} ({u.name.split(' ')[0]}) - Max Disc {u.maxDiscountPercent}%
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('pos')}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-900/30">
            <Pill className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white leading-none">
                PharmERP <span className="text-emerald-400">Pro</span>
              </h1>
              <span className="text-[10px] uppercase font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded">
                RBAC Active
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Logged in as: <strong className="text-slate-200">{currentUser.name}</strong> • Disc Limit: <strong className="text-amber-400">{currentUser.maxDiscountPercent}%</strong>
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
          {visibleTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isAccessControl = tab.id === 'rbac';
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap relative ${
                  isActive
                    ? isAccessControl
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50 font-semibold ring-1 ring-purple-400/40'
                      : 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50 font-semibold'
                    : isAccessControl
                      ? 'text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/60 font-medium'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isAccessControl && !isActive ? 'text-purple-400' : ''}`} />
                <span className={isAccessControl ? 'font-semibold tracking-wide' : ''}>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold text-white ${tab.badgeColor || 'bg-slate-700'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
