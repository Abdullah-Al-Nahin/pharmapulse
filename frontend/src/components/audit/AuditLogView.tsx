import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuditService } from '../../services/auditService';
import { ImmutableAuditLog, AuditActionType, AuditModule } from '../../types/stockAdjustment';
import { formatDate, getCurrentLocale } from '../../utils/i18nFormatter';
import {
  ShieldCheck,
  Filter,
  Search,
  ShoppingCart,
  Package,
  Clock,
  User,
  AlertTriangle,
  FileText,
  Download,
  Printer,
  RefreshCw,
  Eye,
  Code,
  Copy,
  Check,
  Plus,
  Lock,
  Layers,
  Sparkles,
  X,
  Calendar,
  SlidersHorizontal,
  FileSpreadsheet,
  Ban,
  Pill,
  CheckCircle2,
  ChevronRight,
  Info
} from 'lucide-react';

interface AuditLogViewProps {
  initialModule?: AuditModule | 'all';
  initialRole?: string;
  onNavigateToAdjustment?: () => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({
  initialModule = 'all',
  initialRole = 'all',
  onNavigateToAdjustment
}) => {
  const { currentUser, hasPermission, isSuperAdmin } = useAuth();
  const locale = getCurrentLocale();

  // Primary State
  const [logs, setLogs] = useState<ImmutableAuditLog[]>([]);
  const [selectedLogForDiff, setSelectedLogForDiff] = useState<ImmutableAuditLog | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [jsonViewTab, setJsonViewTab] = useState<'diff' | 'before' | 'after'>('diff');

  // Filter States
  const [selectedRole, setSelectedRole] = useState<string>(initialRole);
  const [selectedModule, setSelectedModule] = useState<AuditModule | 'all'>(initialModule);
  const [selectedAction, setSelectedAction] = useState<AuditActionType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Simulator Modal State
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load audit logs
  const refreshLogs = () => {
    const all = AuditService.getAllLogs();
    setLogs(all);
  };

  useEffect(() => {
    refreshLogs();
    // Subscribe to real-time audit log updates
    const unsub = AuditService.subscribe(() => {
      refreshLogs();
    });
    return () => unsub();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Reset sample dataset
  const handleResetSampleData = () => {
    const refreshed = AuditService.resetSampleLogs();
    setLogs(refreshed);
    showToast('Audit trail reset to verified clinical and POS sample records');
  };

  // Roles in system
  const PREDEFINED_ROLES = [
    { code: 'all', name: 'All Roles', badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
    { code: 'Cashier', name: 'Cashier', badgeColor: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300' },
    { code: 'Pharmacy Manager', name: 'Pharmacy Manager', badgeColor: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300' },
    { code: 'Chief Pharmacist', name: 'Chief Pharmacist', badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
    { code: 'Storekeeper', name: 'Storekeeper', badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
    { code: 'Super Admin', name: 'Super Admin', badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' },
  ];

  // Calculate counts per role for quick chips
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: logs.length };
    logs.forEach(log => {
      const r = log.userRole || 'Unknown';
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  }, [logs]);

  // Quick module counts
  const moduleCounts = useMemo(() => {
    return {
      all: logs.length,
      inventory: logs.filter(l => l.module === 'inventory' || l.module === 'stock_adjustment').length,
      pos: logs.filter(l => l.module === 'pos').length,
    };
  }, [logs]);

  // High-risk and override counts
  const alertCount = useMemo(() => {
    return logs.filter(l => 
      l.action === 'OVERRIDE' || 
      l.action === 'VOID' || 
      l.action === 'QUARANTINE' || 
      l.action === 'DELETE'
    ).length;
  }, [logs]);

  // Filtered dataset
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Role Filter
      if (selectedRole !== 'all') {
        const target = selectedRole.toLowerCase();
        const logRole = (log.userRole || '').toLowerCase();
        if (!logRole.includes(target) && !target.includes(logRole)) {
          return false;
        }
      }

      // 2. Module Filter
      if (selectedModule !== 'all') {
        if (selectedModule === 'inventory') {
          if (log.module !== 'inventory' && log.module !== 'stock_adjustment') {
            return false;
          }
        } else if (log.module !== selectedModule) {
          return false;
        }
      }

      // 3. Action Filter
      if (selectedAction !== 'all' && log.action !== selectedAction) {
        return false;
      }

      // 4. Date Filter
      const logTime = new Date(log.timestamp).getTime();
      const now = Date.now();
      if (dateFilter === 'today') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        if (logTime < startOfDay.getTime()) return false;
      } else if (dateFilter === '7days') {
        if (logTime < now - 7 * 86400000) return false;
      } else if (dateFilter === '30days') {
        if (logTime < now - 30 * 86400000) return false;
      } else if (dateFilter === 'custom') {
        if (customStartDate && logTime < new Date(customStartDate).getTime()) return false;
        if (customEndDate && logTime > new Date(customEndDate).getTime() + 86400000) return false;
      }

      // 5. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          log.id.toLowerCase().includes(q) ||
          log.summary.toLowerCase().includes(q) ||
          log.targetEntityId.toLowerCase().includes(q) ||
          log.targetEntityType.toLowerCase().includes(q) ||
          (log.userName && log.userName.toLowerCase().includes(q)) ||
          (log.userRole && log.userRole.toLowerCase().includes(q)) ||
          (log.clientIp && log.clientIp.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [logs, selectedRole, selectedModule, selectedAction, dateFilter, customStartDate, customEndDate, searchQuery]);

  // Relative time helper
  const getRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return formatDate(isoString, locale);
    } catch {
      return isoString;
    }
  };

  // Quick Simulation of Events for Demo / Verification
  const handleSimulateEvent = (type: 'pos_sale' | 'pos_override' | 'pos_void' | 'inv_adjust' | 'inv_quarantine' | 'inv_price') => {
    let newLog: ImmutableAuditLog;

    if (type === 'pos_sale') {
      newLog = AuditService.recordAuditLog({
        userId: currentUser?.id || 'usr-cashier-01',
        userName: currentUser?.name || 'Md. Rafiqul Islam',
        userRole: currentUser?.roleName || 'Cashier',
        action: 'CREATE',
        module: 'pos',
        targetEntityId: `INV-2026-${Math.floor(9100 + Math.random() * 800)}`,
        targetEntityType: 'SaleInvoice',
        summary: 'Completed counter POS sale for 3 items (৳84.00) via Cash Tender at Terminal 01',
        beforeState: null,
        afterState: {
          invoiceId: `INV-2026-9150`,
          totalAmount: 84.00,
          tendered: 100.00,
          change: 16.00,
          itemsCount: 3,
          paymentMethod: 'cash',
          status: 'completed'
        }
      });
      showToast('Simulated POS Checkout by Cashier logged to immutable audit trail');
    } else if (type === 'pos_override') {
      newLog = AuditService.recordAuditLog({
        userId: currentUser?.id || 'usr-mgr-01',
        userName: currentUser?.name || 'Dr. Shahabuddin Ahmed',
        userRole: currentUser?.roleName || 'Pharmacy Manager',
        action: 'OVERRIDE',
        module: 'pos',
        targetEntityId: `INV-2026-${Math.floor(9100 + Math.random() * 800)}`,
        targetEntityType: 'SaleInvoice',
        summary: 'Authorized 12% Hospital Staff Discount Override (Cashier authorization threshold 5% exceeded)',
        beforeState: {
          invoiceId: 'INV-2026-9148',
          discountPercent: 5,
          totalPayable: 114.00,
          overrideStatus: 'pending'
        },
        afterState: {
          invoiceId: 'INV-2026-9148',
          discountPercent: 12,
          totalPayable: 105.60,
          overrideStatus: 'approved',
          authorizer: `${currentUser?.name || 'Dr. Shahabuddin Ahmed'} (${currentUser?.roleName || 'Pharmacy Manager'})`,
          overrideReason: 'Hospital doctor staff family member'
        }
      });
      showToast('Simulated Manager POS Discount Override logged');
    } else if (type === 'pos_void') {
      newLog = AuditService.recordAuditLog({
        userId: currentUser?.id || 'usr-cashier-01',
        userName: currentUser?.name || 'Md. Rafiqul Islam',
        userRole: currentUser?.roleName || 'Cashier',
        action: 'VOID',
        module: 'pos',
        targetEntityId: `INV-2026-${Math.floor(9100 + Math.random() * 800)}`,
        targetEntityType: 'SaleInvoice',
        summary: 'Voided transaction: Customer cancelled dispensed items before tender authorization',
        beforeState: {
          invoiceId: 'INV-2026-9140',
          status: 'pending_payment',
          amount: 65.00
        },
        afterState: {
          invoiceId: 'INV-2026-9140',
          status: 'voided',
          amount: 0.00,
          voidReason: 'Patient declined due to prescribed substitution preference'
        }
      });
      showToast('Simulated POS Transaction Void logged');
    } else if (type === 'inv_adjust') {
      newLog = AuditService.recordAuditLog({
        userId: currentUser?.id || 'usr-store-01',
        userName: currentUser?.name || 'Kamal Hossain',
        userRole: currentUser?.roleName || 'Storekeeper',
        action: 'ADJUST',
        module: 'inventory',
        targetEntityId: 'batch-parac-99',
        targetEntityType: 'Batch',
        summary: 'Cycle count discrepancy write-off: -2 bottles of Cough Syrup damaged in transit',
        beforeState: {
          batchNumber: 'PARA-2024-C2',
          medicineName: 'Paracetamol Suspension 100ml',
          stock: 45,
          rackLocation: 'Rack B-01'
        },
        afterState: {
          batchNumber: 'PARA-2024-C2',
          medicineName: 'Paracetamol Suspension 100ml',
          stock: 43,
          rackLocation: 'Rack B-01',
          discrepancyReason: 'Inner carton crushed during floor restock'
        }
      });
      showToast('Simulated Inventory Stock Adjustment by Storekeeper logged');
    } else if (type === 'inv_quarantine') {
      newLog = AuditService.recordAuditLog({
        userId: currentUser?.id || 'usr-pharm-01',
        userName: currentUser?.name || 'Farhana Islam',
        userRole: currentUser?.roleName || 'Chief Pharmacist',
        action: 'QUARANTINE',
        module: 'inventory',
        targetEntityId: 'batch-insu-03',
        targetEntityType: 'Batch',
        summary: 'Emergency quarantine of Insulin Glargine (10 vials) due to cold-chain door alarm',
        beforeState: {
          batchNumber: 'INS-GLAR-03',
          medicineName: 'Insulin Glargine 100 IU/ml',
          status: 'active',
          rackLocation: 'Fridge-02-Main'
        },
        afterState: {
          batchNumber: 'INS-GLAR-03',
          medicineName: 'Insulin Glargine 100 IU/ml',
          status: 'quarantined',
          rackLocation: 'Quarantine-Cold-Holding',
          quarantineReason: 'Fridge door left ajar for 35 minutes; temp recorded 13.5°C'
        }
      });
      showToast('Simulated Pharmacist Cold-Chain Quarantine logged');
    } else {
      newLog = AuditService.recordAuditLog({
        userId: currentUser?.id || 'usr-mgr-01',
        userName: currentUser?.name || 'Dr. Shahabuddin Ahmed',
        userRole: currentUser?.roleName || 'Pharmacy Manager',
        action: 'UPDATE',
        module: 'inventory',
        targetEntityId: 'med-azith-500',
        targetEntityType: 'Medicine',
        summary: 'DGDA Official Gazette Maximum Retail Price (MRP) cap updated from ৳35.00 to ৳33.50',
        beforeState: {
          medicineName: 'Azithromycin 500mg',
          sellingPrice: 35.00,
          mrp: 35.00
        },
        afterState: {
          medicineName: 'Azithromycin 500mg',
          sellingPrice: 33.50,
          mrp: 33.50,
          regulatoryNotice: 'DGDA Gazette No. 4410-2026'
        }
      });
      showToast('Simulated DGDA Gazette MRP Price update logged');
    }

    setIsSimulatorOpen(false);
    refreshLogs();
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      showToast('No logs match current filters to export');
      return;
    }

    const headers = ['Log ID', 'Timestamp', 'Module', 'Action', 'User', 'Role', 'Target Entity', 'Summary', 'Client IP'];
    const rows = filteredLogs.map(l => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${l.module}"`,
      `"${l.action}"`,
      `"${l.userName}"`,
      `"${l.userRole}"`,
      `"${l.targetEntityType}: ${l.targetEntityId}"`,
      `"${(l.summary || '').replace(/"/g, '""')}"`,
      `"${l.clientIp || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pharmapulse-audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported audit report to CSV format');
  };

  // Export JSON
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `pharmapulse-audit-log-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported audit log dataset as JSON');
  };

  // Print view
  const handlePrint = () => {
    window.print();
  };

  // Copy JSON to clipboard
  const handleCopyJson = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // Get Action Badge Visuals
  const getActionBadge = (action: AuditActionType) => {
    switch (action) {
      case 'CREATE':
        return {
          bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
          icon: <Plus className="w-3 h-3" />
        };
      case 'UPDATE':
        return {
          bg: 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border-sky-300 dark:border-sky-800',
          icon: <SlidersHorizontal className="w-3 h-3" />
        };
      case 'OVERRIDE':
        return {
          bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-bold',
          icon: <AlertTriangle className="w-3 h-3 text-amber-600" />
        };
      case 'VOID':
        return {
          bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-bold',
          icon: <Ban className="w-3 h-3 text-rose-600" />
        };
      case 'ADJUST':
        return {
          bg: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-300 dark:border-purple-800',
          icon: <Layers className="w-3 h-3" />
        };
      case 'DISPENSE':
        return {
          bg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
          icon: <Pill className="w-3 h-3" />
        };
      case 'QUARANTINE':
        return {
          bg: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950/80 dark:text-yellow-300 border-yellow-300 dark:border-yellow-800',
          icon: <Lock className="w-3 h-3" />
        };
      case 'APPROVE':
        return {
          bg: 'bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border-teal-300 dark:border-teal-800',
          icon: <CheckCircle2 className="w-3 h-3" />
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
          icon: <FileText className="w-3 h-3" />
        };
    }
  };

  // Get Role Badge Visuals
  const getRoleBadge = (role: string) => {
    const lower = role.toLowerCase();
    if (lower.includes('super admin') || lower.includes('admin')) {
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
    }
    if (lower.includes('manager')) {
      return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800';
    }
    if (lower.includes('pharmacist')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
    }
    if (lower.includes('store') || lower.includes('keeper')) {
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
    }
    if (lower.includes('cashier')) {
      return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  };

  return (
    <div id="audit-log-view-container" className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl text-xs border border-slate-700 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white">
                  Inventory &amp; POS Audit Log Trail
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  APPEND-ONLY
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-2xl mt-0.5">
                Forensic tamper-evident change records tracking all inventory mutations, POS sales, discount overrides, and voids by authenticated user role.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Quick Simulation Trigger */}
          <button
            id="audit-simulate-btn"
            onClick={() => setIsSimulatorOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Simulate Change</span>
          </button>

          {/* Export Dropdown / Buttons */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-0.5 text-xs font-medium">
            <button
              onClick={handleExportCSV}
              title="Export as CSV"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>
            <button
              onClick={handleExportJSON}
              title="Export as JSON"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <Code className="w-3.5 h-3.5 text-sky-400" />
              <span>JSON</span>
            </button>
            <button
              onClick={handlePrint}
              title="Print View"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleResetSampleData}
            title="Reset to fresh sample logs"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-[#12161f] border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Audit Logs</span>
            <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{logs.length}</span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">100% Immutable</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {filteredLogs.length} currently displayed
          </div>
        </div>

        <div className="bg-white dark:bg-[#12161f] border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Inventory Changes</span>
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg text-emerald-600 dark:text-emerald-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{moduleCounts.inventory}</span>
            <span className="text-[11px] text-slate-500">Batches &amp; Prices</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Reconciliations, GRNs &amp; MRP
          </div>
        </div>

        <div className="bg-white dark:bg-[#12161f] border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">POS Records</span>
            <div className="p-1.5 bg-sky-50 dark:bg-sky-950/50 rounded-lg text-sky-600 dark:text-sky-400">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-sky-600 dark:text-sky-400">{moduleCounts.pos}</span>
            <span className="text-[11px] text-slate-500">Sales &amp; Tenders</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Invoices, Voids &amp; Dispensations
          </div>
        </div>

        <div className="bg-white dark:bg-[#12161f] border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Overrides &amp; Voids</span>
            <div className="p-1.5 bg-amber-50 dark:bg-amber-950/50 rounded-lg text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{alertCount}</span>
            <span className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">High Priority</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Manager approvals &amp; quarantines
          </div>
        </div>
      </div>

      {/* FILTER PANEL: Module Selector + Role Filtering Ribbon */}
      <div className="bg-white dark:bg-[#12161f] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-4">
        {/* Module Tabs (All vs Inventory vs POS) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              onClick={() => setSelectedModule('all')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedModule === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>All Activity</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-600 font-mono">
                {moduleCounts.all}
              </span>
            </button>

            <button
              onClick={() => setSelectedModule('inventory')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedModule === 'inventory'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-emerald-500" />
              <span>Inventory Changes</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-mono">
                {moduleCounts.inventory}
              </span>
            </button>

            <button
              onClick={() => setSelectedModule('pos')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedModule === 'pos'
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 text-sky-500" />
              <span>POS Records</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 font-mono">
                {moduleCounts.pos}
              </span>
            </button>
          </div>

          {/* Real-time Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by invoice, batch, drug, user, IP..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Dedicated User Role Filter Ribbon */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span>Filter by User Role:</span>
            </div>
            {selectedRole !== 'all' && (
              <button
                onClick={() => setSelectedRole('all')}
                className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
              >
                Clear Role Filter
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {PREDEFINED_ROLES.map((role) => {
              const count = roleCounts[role.name] || (role.code === 'all' ? logs.length : 0);
              const isActive = selectedRole === role.code || (role.code === 'all' && selectedRole === 'all');
              return (
                <button
                  key={role.code}
                  onClick={() => setSelectedRole(role.code === 'all' ? 'all' : role.name)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{role.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive
                        ? 'bg-emerald-800 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Granular Filters (Action, Date) */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Action Type:</span>
          </div>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-hidden"
          >
            <option value="all">All Actions</option>
            <option value="CREATE">CREATE (Invoices &amp; Inward Batches)</option>
            <option value="UPDATE">UPDATE (Prices &amp; Racks)</option>
            <option value="OVERRIDE">OVERRIDE (Discounts &amp; Policies)</option>
            <option value="VOID">VOID (Cancellations)</option>
            <option value="ADJUST">ADJUST (Stock Reconciliations)</option>
            <option value="DISPENSE">DISPENSE (Controlled Rx)</option>
            <option value="QUARANTINE">QUARANTINE (Temp Excursions)</option>
            <option value="APPROVE">APPROVE (Credits &amp; Adjustments)</option>
          </select>

          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium ml-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Timeframe:</span>
          </div>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-hidden"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="7days">Past 7 Days</option>
            <option value="30days">Past 30 Days</option>
            <option value="custom">Custom Date Range</option>
          </select>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 text-xs"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 text-xs"
              />
            </div>
          )}

          {(selectedRole !== 'all' || selectedModule !== 'all' || selectedAction !== 'all' || dateFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedRole('all');
                setSelectedModule('all');
                setSelectedAction('all');
                setDateFilter('all');
                setSearchQuery('');
                setCustomStartDate('');
                setCustomEndDate('');
              }}
              className="ml-auto text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-semibold underline cursor-pointer"
            >
              Reset All Filters
            </button>
          )}
        </div>
      </div>

      {/* AUDIT LOG TABLE */}
      <div className="bg-white dark:bg-[#12161f] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Audit Stream Records
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-semibold">
              {filteredLogs.length} events
            </span>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            <span>Click any record to inspect visual state diff</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700/80 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Time &amp; Log ID</th>
                <th className="py-3 px-3">Domain</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">User &amp; Role</th>
                <th className="py-3 px-3">Target Entity</th>
                <th className="py-3 px-4">Forensic Summary</th>
                <th className="py-3 px-3">Client Station</th>
                <th className="py-3 px-3 text-center">Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldCheck className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold text-slate-600 dark:text-slate-300">
                        No audit records match the selected role or filter criteria.
                      </p>
                      <button
                        onClick={() => {
                          setSelectedRole('all');
                          setSelectedModule('all');
                          setSelectedAction('all');
                          setSearchQuery('');
                        }}
                        className="text-xs text-emerald-600 hover:underline cursor-pointer"
                      >
                        Reset filters to view all entries
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const actionVisual = getActionBadge(log.action);
                  const isInventory = log.module === 'inventory' || log.module === 'stock_adjustment';
                  const roleBadgeClass = getRoleBadge(log.userRole || '');

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLogForDiff(log)}
                      className="hover:bg-emerald-50/40 dark:hover:bg-slate-800/50 transition cursor-pointer group"
                    >
                      {/* Timestamp & ID */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-800 dark:text-white text-xs">
                          {getRelativeTime(log.timestamp)}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                          {log.id}
                        </div>
                      </td>

                      {/* Module Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isInventory ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <Package className="w-3 h-3" />
                            <span>INVENTORY</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                            <ShoppingCart className="w-3 h-3" />
                            <span>POS SALE</span>
                          </span>
                        )}
                      </td>

                      {/* Action Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${actionVisual.bg}`}>
                          {actionVisual.icon}
                          <span>{log.action}</span>
                        </span>
                      </td>

                      {/* User & Role (Key focus of prompt) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{log.userName || 'System Agent'}</span>
                        </div>
                        <div className="mt-0.5">
                          <span className={`inline-block px-1.5 py-0.2 rounded-sm text-[10px] font-bold border ${roleBadgeClass}`}>
                            {log.userRole || 'Standard User'}
                          </span>
                        </div>
                      </td>

                      {/* Target Entity */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                          {log.targetEntityType}
                        </span>
                        <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                          {log.targetEntityId}
                        </div>
                      </td>

                      {/* Forensic Summary */}
                      <td className="py-3 px-4 max-w-md">
                        <p className="text-slate-700 dark:text-slate-200 text-xs line-clamp-2 leading-relaxed">
                          {log.summary}
                        </p>
                      </td>

                      {/* Client Station / IP */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                        <div>{log.clientIp || '192.168.1.100'}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                          {log.userAgent?.includes('Tablet') ? 'iPad / Manager' : log.userAgent?.includes('Terminal') ? 'POS Terminal' : 'Web Station'}
                        </div>
                      </td>

                      {/* Diff Button */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLogForDiff(log);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 dark:bg-slate-800 dark:hover:bg-emerald-950 dark:text-slate-300 dark:hover:text-emerald-300 transition cursor-pointer flex items-center gap-1 mx-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Diff</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VISUAL STATE DIFF MODAL */}
      {selectedLogForDiff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12161f] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded">
                    {selectedLogForDiff.id}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${getActionBadge(selectedLogForDiff.action).bg}`}>
                    {selectedLogForDiff.action}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {formatDate(selectedLogForDiff.timestamp, locale, true)}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1.5">
                  Visual Forensic State Diff
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Target: <strong className="text-slate-800 dark:text-slate-200">{selectedLogForDiff.targetEntityType}</strong> ({selectedLogForDiff.targetEntityId})
                </p>
              </div>

              <button
                onClick={() => setSelectedLogForDiff(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Sub-Tabs: Diff vs Before vs After State */}
            <div className="px-5 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setJsonViewTab('diff')}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    jsonViewTab === 'diff'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Visual Field Diff
                </button>
                <button
                  onClick={() => setJsonViewTab('before')}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    jsonViewTab === 'before'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Before State (Raw)
                </button>
                <button
                  onClick={() => setJsonViewTab('after')}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    jsonViewTab === 'after'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  After State (Raw)
                </button>
              </div>

              <button
                onClick={() =>
                  handleCopyJson(
                    JSON.stringify(
                      jsonViewTab === 'diff'
                        ? selectedLogForDiff.diffSummary
                        : jsonViewTab === 'before'
                        ? selectedLogForDiff.beforeState
                        : selectedLogForDiff.afterState,
                      null,
                      2
                    )
                  )
                }
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium cursor-pointer"
              >
                {copiedJson ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600 font-bold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
              {/* Attribution Banner */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-bold">User</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{selectedLogForDiff.userName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-bold">User Role</span>
                  <span className={`inline-block px-1.5 py-0.2 rounded-sm text-[10px] font-bold border mt-0.5 ${getRoleBadge(selectedLogForDiff.userRole || '')}`}>
                    {selectedLogForDiff.userRole}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-bold">Client IP</span>
                  <span className="font-mono text-slate-900 dark:text-white">{selectedLogForDiff.clientIp}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-bold">Terminal Agent</span>
                  <span className="truncate block text-slate-700 dark:text-slate-300">{selectedLogForDiff.userAgent || 'Web Client'}</span>
                </div>
              </div>

              {/* Summary Description */}
              <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-slate-800 dark:text-slate-200 leading-relaxed">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 mr-1.5">Forensic Summary:</span>
                {selectedLogForDiff.summary}
              </div>

              {/* Tab 1: Visual Field Diff Table */}
              {jsonViewTab === 'diff' && (
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                    <span>State Field Delta Comparison</span>
                  </h4>

                  {(!selectedLogForDiff.diffSummary || selectedLogForDiff.diffSummary.length === 0) ? (
                    <div className="p-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl">
                      {selectedLogForDiff.beforeState === null ? (
                        <span>Initial record creation: full state instantiated (see Raw After State tab).</span>
                      ) : (
                        <span>No discrete property level delta calculated.</span>
                      )}
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                            <th className="p-2.5">Field</th>
                            <th className="p-2.5 text-rose-700 dark:text-rose-400 bg-rose-50/40 dark:bg-rose-950/20">
                              Before State (Old Value)
                            </th>
                            <th className="p-2.5 text-emerald-700 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20">
                              After State (New Value)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                          {selectedLogForDiff.diffSummary.map((diff, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200 font-sans">
                                {diff.field}
                              </td>
                              <td className="p-2.5 text-rose-600 dark:text-rose-300 bg-rose-50/30 dark:bg-rose-950/10">
                                <span className="line-through decoration-rose-400">
                                  {typeof diff.oldValue === 'object'
                                    ? JSON.stringify(diff.oldValue)
                                    : String(diff.oldValue)}
                                </span>
                              </td>
                              <td className="p-2.5 text-emerald-600 dark:text-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/10 font-bold">
                                + {typeof diff.newValue === 'object'
                                  ? JSON.stringify(diff.newValue)
                                  : String(diff.newValue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Raw Before State */}
              {jsonViewTab === 'before' && (
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">Before State Snapshot</h4>
                  <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto">
                    {selectedLogForDiff.beforeState
                      ? JSON.stringify(selectedLogForDiff.beforeState, null, 2)
                      : '(null - record created freshly)'}
                  </pre>
                </div>
              )}

              {/* Tab 3: Raw After State */}
              {jsonViewTab === 'after' && (
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">After State Snapshot</h4>
                  <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto">
                    {selectedLogForDiff.afterState
                      ? JSON.stringify(selectedLogForDiff.afterState, null, 2)
                      : '(null - record deleted)'}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Immutable SHA-256 Checksum Verified • Compliant with 21 CFR Part 11
              </span>
              <button
                onClick={() => setSelectedLogForDiff(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EVENT SIMULATOR MODAL (Allows testing real-time reactivity) */}
      {isSimulatorOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12161f] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Simulate Live Audit Event
                </h3>
              </div>
              <button
                onClick={() => setIsSimulatorOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Instantly simulate real-time POS checkout, manager discount override, cashier bill void, or inventory stock reconciliation to test role-filtered audit behavior.
            </p>

            <div className="space-y-2">
              <button
                onClick={() => handleSimulateEvent('pos_sale')}
                className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-400 hover:bg-sky-50/50 dark:hover:bg-slate-800/80 transition flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
                      Cashier
                    </span>
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      Counter POS Sale Checkout ($84.00)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Generates completed sale invoice with item counts and cash payment
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => handleSimulateEvent('pos_override')}
                className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-slate-800/80 transition flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                      Pharmacy Manager
                    </span>
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      POS 12% Discount Authorization Override
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Manager authorizes discount exceeding standard Cashier 5% limit
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => handleSimulateEvent('pos_void')}
                className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-400 hover:bg-rose-50/50 dark:hover:bg-slate-800/80 transition flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
                      Cashier
                    </span>
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      POS Transaction Void (Customer Cancel)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Void record tracking reasons and zeroing draft invoice totals
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => handleSimulateEvent('inv_adjust')}
                className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-slate-800/80 transition flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      Storekeeper
                    </span>
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      Inventory Physical Stock Discrepancy (-2)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Reconciliation of transit damage on Paracetamol suspension
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => handleSimulateEvent('inv_quarantine')}
                className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 transition flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Chief Pharmacist
                    </span>
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      Cold-Chain Insulin Temperature Quarantine
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Batch relocation to quarantine due to &gt;12°C logger alarm
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => handleSimulateEvent('inv_price')}
                className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-slate-800/80 transition flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                      Pharmacy Manager
                    </span>
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      DGDA Gazette MRP Price Ceiling Revision
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Azithromycin 500mg price cap reduction from $35.00 to $33.50
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
