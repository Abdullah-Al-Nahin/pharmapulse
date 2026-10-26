import React from 'react';
import {
  ShoppingCart,
  FileText,
  Boxes,
  Truck,
  Wallet,
  LineChart,
  Settings,
  ChevronRight,
  Menu,
  Clock,
  Plus,
  RotateCcw,
  Users,
  ClipboardCheck,
  ShieldCheck,
  CalendarClock,
  Activity,
  Building2,
  Crown,
  LogOut,
} from 'lucide-react';
import { PharmaNavTab } from '../../types/pharmapulse';
import { useAuth } from '../../context/AuthContext';
import { Permission } from '../../types/rbac';
import { BranchService } from '../../services/branchService';
import { PharmacyService } from '../../services/pharmacyService';

const TAB_PERMISSIONS: Partial<Record<PharmaNavTab, Permission[]>> = {
  pos: ['pos:sale:create', 'pos:sale:view'],
  prescriptions: ['prescriptions:rx:view', 'prescriptions:rx:dispense'],
  returns: ['returns:sale:process', 'returns:sale:view'],
  customers: ['customers:profile:view', 'customers:profile:manage'],
  inventory: ['inventory:stock:view', 'inventory:product:create'],
  purchases: ['purchases:po:view', 'purchases:po:create', 'purchases:grn:receive'],
  batches_expiry: ['inventory:batch:manage', 'inventory:stock:view'],
  adjustments_audit: ['audit:logs:view'],
  executive_dashboard: ['reports:profit:view', 'reports:sales:view'],
  command_center: ['reports:sales:view', 'inventory:stock:view'],
  accounts: ['accounting:ledger:view', 'accounting:statements:view'],
  multi_branch: ['inventory:stock:view', 'rbac:roles:manage'],
  analytics: ['reports:sales:view', 'reports:profit:view'],
  settings: ['rbac:roles:manage', 'rbac:users:manage'],
};

interface PharmaPulseSidebarProps {
  activeTab: PharmaNavTab;
  onSelectTab: (tab: PharmaNavTab) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onExpiringClick?: () => void;
}

interface SidebarGroup {
  title: string;
  titleBn: string;
  items: {
    id: PharmaNavTab;
    label: string;
    labelBn: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    badgeColor?: string;
  }[];
}

export const PharmaPulseSidebar: React.FC<PharmaPulseSidebarProps> = ({
  activeTab,
  onSelectTab,
  isCollapsed = false,
  onToggleCollapse,
  onExpiringClick,
}) => {
  const { hasAnyPermission, isSuperAdmin, currentUser, logout } = useAuth();

  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const expiringLotsCount = PharmacyService.getBatches().filter((b) => {
    if ((b.currentStock || 0) <= 0) return false;
    const expTime = new Date(b.expiryDate).getTime();
    return expTime > now && expTime <= now + thirtyDaysMs;
  }).length;

  const isTabAllowed = (tabId: PharmaNavTab) => {
    // ONLY Super Admin can view or access Settings & Roles
    if (tabId === 'settings') {
      return isSuperAdmin || currentUser?.roleCode === 'super_admin';
    }
    if (isSuperAdmin || currentUser?.roleCode === 'super_admin') return true;
    const perms = TAB_PERMISSIONS[tabId];
    if (!perms || perms.length === 0) return true;
    return hasAnyPermission(perms);
  };
  const sidebarGroups: SidebarGroup[] = [
    {
      title: 'Sales & POS',
      titleBn: 'বিক্রয় ও কাউন্টার',
      items: [
        { id: 'pos', label: 'POS Billing', labelBn: 'ক্যাশ কাউন্টার', icon: ShoppingCart },
        { id: 'prescriptions', label: 'Prescription Hub', labelBn: 'প্রেসক্রিপশন', icon: FileText },
        { id: 'returns', label: 'Returns & Refunds', labelBn: 'রিটার্ন ও রিফান্ড', icon: RotateCcw },
        { id: 'customers', label: 'Customers & Dues', labelBn: 'কাস্টমার ও বাকি', icon: Users },
      ]
    },
    {
      title: 'Inventory & Supply',
      titleBn: 'স্টক ও সাপ্লাই',
      items: [
        {
          id: 'inventory',
          label: 'Inventory & FEFO',
          labelBn: 'ইনভেন্টরি ও FEFO',
          icon: Boxes,
          badge: 'Alerts',
          badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
        },
        { id: 'purchases', label: 'Suppliers & Purchase', labelBn: 'সাপ্লায়ার ও ক্রয়', icon: Truck },
        { id: 'batches_expiry', label: 'Batches & Expiry', labelBn: 'ব্যাচ ও মেয়াদ', icon: CalendarClock },
        {
          id: 'adjustments_audit',
          label: 'Audit Logs & Trail',
          labelBn: 'অডিট ও ট্রেইল',
          icon: ShieldCheck,
          badge: 'Live',
          badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
        },
      ]
    },
    {
      title: 'Management & Finance',
      titleBn: 'ম্যানেজমেন্ট ও হিসাব',
      items: [
        {
          id: 'executive_dashboard',
          label: 'Executive Dashboard',
          labelBn: 'সিইও ড্যাশবোর্ড',
          icon: Crown,
          badge: 'VIP',
          badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
        },
        { id: 'command_center', label: 'Command Center', labelBn: 'কমান্ড সেন্টার', icon: Activity },
        { id: 'accounts', label: 'Accounts & Ledger', labelBn: 'হিসাব ও লেজার', icon: Wallet },
        {
          id: 'multi_branch',
          label: 'Multi-Branch (IBT)',
          labelBn: 'মাল্টি-ব্রাঞ্চ',
          icon: Building2,
          badge: `${BranchService.getBranches().length} Br`,
          badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
        },
        {
          id: 'analytics',
          label: 'Analytics & AI',
          labelBn: 'এনালিটিক্স',
          icon: LineChart,
          badge: 'AI',
          badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
        },
        { id: 'settings', label: 'Settings & Roles', labelBn: 'সেটিংস', icon: Settings },
      ]
    }
  ];

  return (
    <aside
      id="pharmapulse-sidebar"
      className={`shrink-0 h-screen bg-white dark:bg-[#12161f] border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-all duration-300 shadow-xs select-none z-30 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex-1 flex flex-col min-h-0">
        {/* Brand Logo Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Pharmacy Cross Icon */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center p-1.5 shadow-sm shrink-0">
              <Plus className="w-5 h-5 stroke-[3]" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col leading-tight min-w-0">
                <span className="font-black text-base tracking-tight text-slate-900 dark:text-white truncate">
                  PharmaPulse
                </span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                  HOSPITAL &amp; RETAIL OS
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onToggleCollapse}
            aria-label="Toggle sidebar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Navigation Area */}
        <div className="flex-1 overflow-y-auto py-3 px-3 flex flex-col gap-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          {/* Active Branch Pill */}
          {!isCollapsed && (
            <div className="px-1">
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-bold truncate">
                    {currentUser.branchName || 'Central Hub'}
                  </span>
                </div>
                <span className="font-mono text-[9px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 uppercase">
                  {currentUser.branchId || 'HQ'}
                </span>
              </div>
            </div>
          )}

          {/* Categorized Navigation Groups */}
          {sidebarGroups.map((group, gIdx) => {
            const visibleItems = group.items.filter((item) => isTabAllowed(item.id));
            if (visibleItems.length === 0) return null;

            return (
              <div key={gIdx} className="flex flex-col gap-1">
                {!isCollapsed && (
                  <div className="px-2 pb-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
                    <span>{group.title}</span>
                    <span className="text-[10px] font-normal text-slate-400 dark:text-slate-600">{group.titleBn}</span>
                  </div>
                )}

                <div className="flex flex-col gap-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelectTab(item.id)}
                        title={`${item.label} (${item.labelBn})`}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-700/20'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                        } ${isCollapsed ? 'justify-center px-2 py-2.5' : ''}`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                        {!isCollapsed && (
                          <>
                            <span className="truncate flex-1 text-left">{item.label}</span>
                            {item.badge && (
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${item.badgeColor}`}>
                                {item.badge}
                              </span>
                            )}
                            {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/80 shrink-0" />}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Expiring Alert & Cloud Status */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 shrink-0">
        {!isCollapsed ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={onExpiringClick}
              className="w-full p-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/60 shadow-2xs flex items-center justify-between hover:border-amber-400 transition cursor-pointer text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col leading-tight truncate">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Expiring Soon</span>
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">{expiringLotsCount} Lots &lt; 30d</span>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
            <div className="flex items-center justify-between px-1 text-slate-400 dark:text-slate-500 text-[10px] font-medium">
              <span>Terminal v4.12</span>
              <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Online
              </span>
            </div>

            {/* User Account & Sign Out */}
            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-slate-400 truncate">
                  {currentUser.roleName}
                </span>
              </div>
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer shrink-0"
                title="Sign Out / Lock Terminal"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onExpiringClick}
              title={`Expiring Soon: ${expiringLotsCount} Lots < 30d`}
              className="w-full flex items-center justify-center p-2 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 cursor-pointer"
            >
              <Clock className="w-4 h-4" />
            </button>
            <button
              onClick={logout}
              title="Sign Out / Lock Terminal"
              className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
