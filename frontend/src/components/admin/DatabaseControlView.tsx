import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  Clock,
  Boxes,
  Receipt,
  FileText,
  Users,
  Download,
  RotateCcw,
  Lock,
  Sparkles,
  History,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PharmacyService } from '../../services/pharmacyService';
import { AuditService } from '../../services/auditService';
import { CustomerService } from '../../services/customerService';
import { systemApi } from '../../lib/api';

interface PurgeActionOption {
  id: string;
  title: string;
  titleBn: string;
  description: string;
  descriptionBn: string;
  badge: string;
  badgeBn: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'transactions' | 'stock' | 'logs' | 'clinical';
  impactCount?: number;
}

export const DatabaseControlView: React.FC = () => {
  const { currentUser, isSuperAdmin } = useAuth();
  const [refreshTick, setRefreshTick] = useState(0);
  const [remoteStats, setRemoteStats] = useState<Record<string, number> | null>(null);
  const [isSyncingStats, setIsSyncingStats] = useState(false);
  const [activeConfirmAction, setActiveConfirmAction] = useState<PurgeActionOption | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [operationHistory, setOperationHistory] = useState<
    { id: string; scope: string; title: string; timestamp: string; operator: string }[]
  >(() => {
    try {
      const saved = localStorage.getItem('rx_superadmin_purge_history_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const authorized = isSuperAdmin || currentUser?.roleCode === 'super_admin';

  const fetchStats = async () => {
    setIsSyncingStats(true);
    try {
      const stats = await systemApi.getStats();
      if (stats && typeof stats === 'object') {
        setRemoteStats(stats);
      }
    } catch {
      // Fallback to local cache counts when offline
    } finally {
      setIsSyncingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const unsub1 = PharmacyService.subscribe(() => setRefreshTick((t) => t + 1));
    const unsub2 = AuditService.subscribe(() => setRefreshTick((t) => t + 1));
    const unsub3 = CustomerService.subscribe(() => setRefreshTick((t) => t + 1));
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, []);

  const liveCounts = useMemo(() => {
    const medicines = PharmacyService.getMedicines();
    const batches = PharmacyService.getBatches();
    const sales = PharmacyService.getSales();
    const returns = PharmacyService.getSaleReturns();
    const purchases = PharmacyService.getPurchaseOrders();
    const prescriptions = PharmacyService.getPrescriptions();
    const heldSales = PharmacyService.getHeldSales();
    const accounting = PharmacyService.getAccountingTransactions();
    const customers = CustomerService.getCustomers();
    const logs = AuditService.getAllLogs();

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const todayStr = new Date().toISOString().split('T')[0];

    const expiredOrQuarantinedBatches = batches.filter((b) => {
      const st = (b.status || '').toLowerCase();
      return st === 'expired' || st === 'quarantined' || b.expiryDate < todayStr;
    }).length;

    const logsLast24h = logs.filter((l) => now - new Date(l.timestamp).getTime() <= dayMs).length;
    const logsLast7d = logs.filter((l) => now - new Date(l.timestamp).getTime() <= 7 * dayMs).length;
    const logsLast30d = logs.filter((l) => now - new Date(l.timestamp).getTime() <= 30 * dayMs).length;
    const logsOlder30d = logs.filter((l) => now - new Date(l.timestamp).getTime() > 30 * dayMs).length;

    const salesLast24h = sales.filter((s) => now - new Date(s.timestamp || s.date).getTime() <= dayMs).length;
    const salesLast7d = sales.filter((s) => now - new Date(s.timestamp || s.date).getTime() <= 7 * dayMs).length;
    const salesLast30d = sales.filter((s) => now - new Date(s.timestamp || s.date).getTime() <= 30 * dayMs).length;

    const customersWithDue = customers.filter((c) => (c.totalDue || 0) > 0 || (c.loyaltyPoints || 0) > 0).length;

    return {
      medicines: Math.max(medicines.length, remoteStats?.products || 0),
      batches: Math.max(batches.length, remoteStats?.batches || 0),
      expiredOrQuarantinedBatches: Math.max(
        expiredOrQuarantinedBatches,
        (remoteStats?.expiredBatches || 0) + (remoteStats?.quarantinedBatches || 0)
      ),
      sales: Math.max(sales.length, remoteStats?.sales || 0),
      returns: Math.max(returns.length, remoteStats?.saleReturns || 0),
      purchases: Math.max(purchases.length, remoteStats?.purchaseOrders || 0),
      prescriptions: Math.max(prescriptions.length, remoteStats?.prescriptions || 0),
      heldSales: Math.max(heldSales.length, remoteStats?.heldSales || 0),
      accounting: Math.max(accounting.length, remoteStats?.journalEntries || 0),
      customers: Math.max(customers.length, remoteStats?.customers || 0),
      customersWithDue,
      logsTotal: Math.max(logs.length, remoteStats?.auditLogs || 0),
      logsLast24h,
      logsLast7d,
      logsLast30d,
      logsOlder30d,
      salesLast24h,
      salesLast7d,
      salesLast30d,
    };
  }, [refreshTick, remoteStats]);

  if (!authorized) {
    return (
      <div className="p-8 rounded-2xl bg-white dark:bg-[#161b26] border border-rose-200 dark:border-rose-900/60 shadow-sm flex flex-col items-center justify-center text-center min-h-[420px]">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white">
          Super Admin Clearance Required
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1">
          This module contains destructive database purge and reset controls restricted exclusively to the Super Admin account.
        </p>
      </div>
    );
  }

  const masterDangerOption: PurgeActionOption = {
    id: 'full_database',
    title: 'Clear Whole Database (Factory Wipe)',
    titleBn: 'সম্পূর্ণ ডাটাবেস মুছুন (ফ্যাক্টরি রিসেট)',
    description:
      'Wipes all transactions, sales, returns, purchases, stock batches, medicines catalog, prescriptions, customer dues, and audit logs across PostgreSQL & local cache. Preserves Super Admin login & branches.',
    descriptionBn:
      'সকল লেনদেন, বিক্রয়, রিটার্ন, ক্রয়, স্টক ব্যাচ, ওষুধের তালিকা, প্রেসক্রিপশন, গ্রাহকের বকেয়া এবং অডিট লগ সম্পূর্ণ মুছে ফেলবে। শুধুমাত্র সুপার অ্যাডমিন অ্যাকাউন্ট ও শাখা অক্ষত থাকবে।',
    badge: 'NUCLEAR RESET',
    badgeBn: 'সম্পূর্ণ রিসেট',
    severity: 'critical',
    category: 'transactions',
  };

  const purgeOptions: PurgeActionOption[] = [
    // Category 1: Transactions & Financials
    {
      id: 'only_transactions',
      title: 'Clear Only Transactions (All Financials)',
      titleBn: 'শুধুমাত্র সকল লেনদেন মুছুন',
      description:
        'Deletes all POS sales, sales returns, held carts, purchase orders, supplier ledgers, and accounting entries while keeping Medicine Catalog and Batch Stock intact.',
      descriptionBn:
        'ওষুধের ক্যাটালগ ও স্টক অক্ষত রেখে সকল বিক্রয়, রিটার্ন, হোল্ড কার্ট, ক্রয় আদেশ, সাপ্লায়ার লেজার এবং হিসাব মুছে ফেলবে।',
      badge: 'Keep Stock',
      badgeBn: 'স্টক অক্ষত থাকবে',
      severity: 'high',
      category: 'transactions',
      impactCount: liveCounts.sales + liveCounts.returns + liveCounts.purchases + liveCounts.accounting,
    },
    {
      id: 'only_sales_pos',
      title: 'Clear POS Sales, Held Carts & Returns Only',
      titleBn: 'শুধুমাত্র পিওএস বিক্রয় ও রিটার্ন মুছুন',
      description:
        'Clears all POS invoices, held orders, and customer sales returns without touching purchase orders or inventory.',
      descriptionBn:
        'ক্রয় আদেশ বা ইনভেন্টরি পরিবর্তন না করে সকল পিওএস চালান, হোল্ড অর্ডার ও বিক্রয় রিটার্ন মুছে ফেলবে।',
      badge: 'POS Clean',
      badgeBn: 'পিওএস ক্লিন',
      severity: 'medium',
      category: 'transactions',
      impactCount: liveCounts.sales + liveCounts.returns + liveCounts.heldSales,
    },
    {
      id: 'only_purchases_ledgers',
      title: 'Clear Purchase Orders, GRNs & Supplier Ledgers',
      titleBn: 'ক্রয় আদেশ, চালান ও সাপ্লায়ার লেজার মুছুন',
      description:
        'Clears all inward purchase orders, challan/GRN histories, reorder queues, and supplier payable balances.',
      descriptionBn:
        'সকল ক্রয় আদেশ, চালান/জিআরএন ইতিহাস, রি-অর্ডার তালিকা এবং সাপ্লায়ার বকেয়া হিসাব মুছে ফেলবে।',
      badge: 'Procurement',
      badgeBn: 'ক্রয় বিভাগ',
      severity: 'medium',
      category: 'transactions',
      impactCount: liveCounts.purchases,
    },
    {
      id: 'only_customer_dues',
      title: 'Reset All Customer Dues & Loyalty Points',
      titleBn: 'গ্রাহকের সকল বকেয়া ও লয়্যালটি পয়েন্ট শূন্য করুন',
      description:
        'Resets all customer credit/due balances and loyalty points to zero while keeping customer profiles.',
      descriptionBn:
        'গ্রাহকের প্রোফাইল রেখে সকল বকেয়া পাওনা এবং লয়্যালটি পয়েন্ট শূন্য (০) করে দেবে।',
      badge: 'Receivables',
      badgeBn: 'বকেয়া রিসেট',
      severity: 'medium',
      category: 'transactions',
      impactCount: liveCounts.customersWithDue,
    },
    {
      id: 'transactions_last_day',
      title: 'Clear Last 24 Hours Transactions',
      titleBn: 'গত ২৪ ঘণ্টার লেনদেন মুছুন',
      description:
        'Removes POS sales, returns, and accounting entries recorded during the last 24 hours.',
      descriptionBn:
        'গত ২৪ ঘণ্টায় এন্ট্রি করা বিক্রয়, রিটার্ন এবং হিসাব লেনদেন মুছে ফেলবে।',
      badge: 'Last 24h',
      badgeBn: 'গত ২৪ ঘণ্টা',
      severity: 'low',
      category: 'transactions',
      impactCount: liveCounts.salesLast24h,
    },
    {
      id: 'transactions_last_week',
      title: 'Clear Last 7 Days Transactions',
      titleBn: 'গত ৭ দিনের লেনদেন মুছুন',
      description:
        'Removes POS sales, returns, and accounting entries recorded during the last 7 days.',
      descriptionBn:
        'গত ৭ দিনে এন্ট্রি করা বিক্রয়, রিটার্ন এবং হিসাব লেনদেন মুছে ফেলবে।',
      badge: 'Last 7d',
      badgeBn: 'গত ৭ দিন',
      severity: 'medium',
      category: 'transactions',
      impactCount: liveCounts.salesLast7d,
    },
    {
      id: 'transactions_last_month',
      title: 'Clear Last 30 Days Transactions',
      titleBn: 'গত ৩০ দিনের লেনদেন মুছুন',
      description:
        'Removes POS sales, returns, and accounting entries recorded during the last 30 days.',
      descriptionBn:
        'গত ৩০ দিনে এন্ট্রি করা বিক্রয়, রিটার্ন এবং হিসাব লেনদেন মুছে ফেলবে।',
      badge: 'Last 30d',
      badgeBn: 'গত ৩০ দিন',
      severity: 'medium',
      category: 'transactions',
      impactCount: liveCounts.salesLast30d,
    },

    // Category 2: Stock & Inventory
    {
      id: 'only_stock',
      title: 'Clear Only Stock (All Batches & Quantities)',
      titleBn: 'শুধুমাত্র স্টক মুছুন (সকল ব্যাচ ও পরিমাণ)',
      description:
        'Deletes all batch lots, stock quantities, adjustments, and transfers while keeping the Medicine Product Catalog intact.',
      descriptionBn:
        'ওষুধের মূল ক্যাটালগ অক্ষত রেখে সকল ব্যাচ লট, স্টকের পরিমাণ, সমন্বয় ও ট্রান্সফার মুছে ফেলবে।',
      badge: 'Zero Stock',
      badgeBn: 'স্টক শূন্য করুন',
      severity: 'high',
      category: 'stock',
      impactCount: liveCounts.batches,
    },
    {
      id: 'stock_and_catalog',
      title: 'Clear Stock + Medicine Master Catalog',
      titleBn: 'স্টক এবং ওষুধের সম্পূর্ণ ক্যাটালগ মুছুন',
      description:
        'Completely wipes all batches AND all medicine product master records so you can import a fresh catalog.',
      descriptionBn:
        'সকল ব্যাচ এবং ওষুধের সম্পূর্ণ মাস্টার তালিকা মুছে ফেলবে যাতে নতুন করে ক্যাটালগ যোগ করা যায়।',
      badge: 'Full Inventory',
      badgeBn: 'সম্পূর্ণ ইনভেন্টরি',
      severity: 'critical',
      category: 'stock',
      impactCount: liveCounts.medicines + liveCounts.batches,
    },
    {
      id: 'expired_and_quarantined_stock',
      title: 'Clear Expired & Quarantined Batches Only',
      titleBn: 'শুধুমাত্র মেয়াদোত্তীর্ণ ও কোয়ারেন্টাইন ব্যাচ মুছুন',
      description:
        'Smart hygiene cleanup: purges only expired and quarantined batches while keeping all healthy sellable FEFO stock.',
      descriptionBn:
        'বিক্রয়যোগ্য ভালো স্টক অক্ষত রেখে শুধুমাত্র মেয়াদোত্তীর্ণ ও কোয়ারেন্টাইনকৃত ব্যাচগুলো মুছে ফেলবে।',
      badge: 'Smart Hygiene',
      badgeBn: 'স্মার্ট ক্লিনআপ',
      severity: 'low',
      category: 'stock',
      impactCount: liveCounts.expiredOrQuarantinedBatches,
    },
    {
      id: 'stock_transfers_adjustments',
      title: 'Clear Inter-Branch Transfers & Stock Adjustments',
      titleBn: 'ব্রাঞ্চ ট্রান্সফার ও স্টক সমন্বয় ইতিহাস মুছুন',
      description:
        'Clears all inter-branch transfer (IBT) requisitions and stock adjustment audit records.',
      descriptionBn:
        'সকল আন্তঃশাখা স্টক ট্রান্সফার (IBT) এবং স্টক সমন্বয়ের রেকর্ড মুছে ফেলবে।',
      badge: 'IBT & Reconcile',
      badgeBn: 'ট্রান্সফার ও সমন্বয়',
      severity: 'low',
      category: 'stock',
    },

    // Category 3: Audit Logs & System History
    {
      id: 'logs_last_day',
      title: 'Clear Last Day Logs (Last 24 Hours)',
      titleBn: 'গত ১ দিনের লগ মুছুন (২৪ ঘণ্টা)',
      description:
        'Purges all audit logs and activity trail entries generated in the last 24 hours.',
      descriptionBn:
        'গত ২৪ ঘণ্টায় তৈরি হওয়া সকল অডিট লগ এবং অ্যাক্টিভিটি রেকর্ড মুছে ফেলবে।',
      badge: '24 Hours',
      badgeBn: '২৪ ঘণ্টা',
      severity: 'low',
      category: 'logs',
      impactCount: liveCounts.logsLast24h,
    },
    {
      id: 'logs_last_week',
      title: 'Clear Last Week Logs (Last 7 Days)',
      titleBn: 'গত ১ সপ্তাহের লগ মুছুন (৭ দিন)',
      description:
        'Purges all audit logs and activity trail entries generated in the last 7 days.',
      descriptionBn:
        'গত ৭ দিনে তৈরি হওয়া সকল অডিট লগ এবং অ্যাক্টিভিটি রেকর্ড মুছে ফেলবে।',
      badge: '7 Days',
      badgeBn: '৭ দিন',
      severity: 'low',
      category: 'logs',
      impactCount: liveCounts.logsLast7d,
    },
    {
      id: 'logs_last_month',
      title: 'Clear Last Month Logs (Last 30 Days)',
      titleBn: 'গত ১ মাসের লগ মুছুন (৩০ দিন)',
      description:
        'Purges all audit logs and activity trail entries generated in the last 30 days.',
      descriptionBn:
        'গত ৩০ দিনে তৈরি হওয়া সকল অডিট লগ এবং অ্যাক্টিভিটি রেকর্ড মুছে ফেলবে।',
      badge: '30 Days',
      badgeBn: '৩০ দিন',
      severity: 'medium',
      category: 'logs',
      impactCount: liveCounts.logsLast30d,
    },
    {
      id: 'logs_older_than_30d',
      title: 'Clear Logs Older Than 30 Days (Retention Cleanup)',
      titleBn: '৩০ দিনের পুরনো লগ মুছুন (স্টোরেজ ক্লিনআপ)',
      description:
        'Frees database storage by deleting archived logs older than 30 days while keeping the most recent 30 days of logs.',
      descriptionBn:
        'সাম্প্রতিক ৩০ দিনের লগ অক্ষত রেখে ৩০ দিনের বেশি পুরনো আর্কাইভ লগ মুছে ডাটাবেস হালকা করবে।',
      badge: 'Archive Purge',
      badgeBn: 'পুরনো লগ ক্লিনআপ',
      severity: 'low',
      category: 'logs',
      impactCount: liveCounts.logsOlder30d,
    },
    {
      id: 'logs_all',
      title: 'Clear All Audit Logs (Complete Log Wipe)',
      titleBn: 'সকল অডিট লগ সম্পূর্ণ মুছুন',
      description:
        'Wipes the entire audit log table and forensic trail history across PostgreSQL and local storage.',
      descriptionBn:
        'ডাটাবেস এবং লোকাল স্টোরেজ থেকে সম্পূর্ণ অডিট লগ ও ইতিহাস মুছে ফেলবে।',
      badge: 'All Logs',
      badgeBn: 'সম্পূর্ণ লগ',
      severity: 'high',
      category: 'logs',
      impactCount: liveCounts.logsTotal,
    },

    // Category 4: Clinical & Staff Hygiene
    {
      id: 'only_prescriptions',
      title: 'Clear Digital Prescriptions & Rx Queue',
      titleBn: 'সকল প্রেসক্রিপশন ও Rx কিউ মুছুন',
      description:
        'Clears all digital prescriptions and dispensed Rx queue records.',
      descriptionBn:
        'সকল ডিজিটাল প্রেসক্রিপশন এবং বিতরণকৃত প্রেসক্রিপশন তালিকা মুছে ফেলবে।',
      badge: 'Rx Queue',
      badgeBn: 'প্রেসক্রিপশন',
      severity: 'low',
      category: 'clinical',
      impactCount: liveCounts.prescriptions,
    },
    {
      id: 'non_admin_users',
      title: 'Clear Non-Super-Admin Staff Accounts',
      titleBn: 'সুপার অ্যাডমিন ব্যতীত অন্যান্য স্টাফ অ্যাকাউন্ট মুছুন',
      description:
        'Removes all cashier, pharmacist, and manager staff accounts while preserving the root Super Admin account.',
      descriptionBn:
        'মূল সুপার অ্যাডমিন অ্যাকাউন্ট অক্ষত রেখে অন্যান্য সকল ক্যাশিয়ার, ফার্মাসিস্ট ও স্টাফ অ্যাকাউন্ট মুছে ফেলবে।',
      badge: 'Staff Reset',
      badgeBn: 'স্টাফ রিসেট',
      severity: 'high',
      category: 'clinical',
    },
  ];

  const handleExportSnapshot = () => {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser?.name || 'Super Admin',
      medicines: PharmacyService.getMedicines(),
      batches: PharmacyService.getBatches(),
      suppliers: PharmacyService.getSuppliers(),
      sales: PharmacyService.getSales(),
      returns: PharmacyService.getSaleReturns(),
      purchases: PharmacyService.getPurchaseOrders(),
      prescriptions: PharmacyService.getPrescriptions(),
      accounting: PharmacyService.getAccountingTransactions(),
      customers: CustomerService.getCustomers(),
      auditLogs: AuditService.getAllLogs(),
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmapulse-db-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusBanner({
      type: 'info',
      message: 'Full JSON database backup downloaded successfully.',
    });
  };

  const handleRestoreDemoData = async () => {
    setIsExecuting(true);
    try {
      await PharmacyService.restoreFactoryDemoData();
      await fetchStats();
      setRefreshTick((t) => t + 1);
      setStatusBanner({
        type: 'success',
        message: 'Default demo seed data restored and synchronized.',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExecuteConfirmedPurge = async () => {
    if (!activeConfirmAction) return;
    const isValidConfirm =
      confirmInput.trim().toUpperCase() === 'CLEAR' ||
      confirmInput.trim() === '1800' ||
      confirmInput.trim() === '9999';

    if (!isValidConfirm) return;

    setIsExecuting(true);
    try {
      const res = await PharmacyService.executeSuperAdminPurge(activeConfirmAction.id);
      const newEntry = {
        id: `PURGE-${Date.now()}`,
        scope: activeConfirmAction.id,
        title: activeConfirmAction.title,
        timestamp: new Date().toISOString(),
        operator: currentUser?.name || 'Super Admin',
      };
      const updatedHistory = [newEntry, ...operationHistory].slice(0, 15);
      setOperationHistory(updatedHistory);
      try {
        localStorage.setItem('rx_superadmin_purge_history_v1', JSON.stringify(updatedHistory));
      } catch {}

      await fetchStats();
      setRefreshTick((t) => t + 1);
      setStatusBanner({
        type: 'success',
        message: res.message,
      });
      setActiveConfirmAction(null);
      setConfirmInput('');
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        message: err?.message || 'Failed to execute database purge.',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const renderCategorySection = (
    categoryKey: PurgeActionOption['category'],
    title: string,
    subtitle: string,
    icon: React.ReactNode
  ) => {
    const items = purgeOptions.filter((o) => o.category === categoryKey);
    return (
      <div className="p-5 rounded-2xl bg-white dark:bg-[#161b26] border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">
              {icon}
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">{title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {items.map((opt) => {
            const isCrit = opt.severity === 'critical';
            const isHigh = opt.severity === 'high';
            return (
              <div
                key={opt.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                  isCrit
                    ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                    : isHigh
                    ? 'bg-amber-50/30 dark:bg-amber-950/15 border-amber-200/80 dark:border-amber-900/50'
                    : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/70'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      {opt.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        isCrit
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                          : isHigh
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                          : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {opt.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/50">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {opt.impactCount !== undefined
                      ? `Matching Records: ${opt.impactCount}`
                      : 'Ready to execute'}
                  </span>
                  <button
                    onClick={() => {
                      setActiveConfirmAction(opt);
                      setConfirmInput('');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      isCrit
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                        : isHigh
                        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                        : 'bg-slate-900 dark:bg-slate-700 hover:bg-rose-600 dark:hover:bg-rose-600 text-white'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Now</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Top Executive Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950 text-white border border-slate-800 shadow-lg flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-black tracking-tight">
                Database Control &amp; Purge Center
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                Super Admin Only
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Root-level database lifecycle management: clear full database, isolate transaction or stock resets, and purge audit logs by time window.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportSnapshot}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Backup JSON Snapshot</span>
          </button>

          <button
            onClick={handleRestoreDemoData}
            disabled={isExecuting}
            className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Demo Seed</span>
          </button>

          <button
            onClick={fetchStats}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            title="Refresh Database Counters"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncingStats ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Notification Banner */}
      {statusBanner && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-bold ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : statusBanner.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
              : 'bg-sky-50 dark:bg-sky-950/50 border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusBanner.message}</span>
          </div>
          <button onClick={() => setStatusBanner(null)} className="hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Live Database Record Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#161b26] border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400">POS Sales</span>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
            {liveCounts.sales}
          </div>
          <span className="text-[10px] text-slate-500">{liveCounts.returns} Returns</span>
        </div>
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#161b26] border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400">Active Batches</span>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
            {liveCounts.batches}
          </div>
          <span className="text-[10px] text-slate-500">{liveCounts.medicines} Medicines</span>
        </div>
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#161b26] border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400">Purchase Orders</span>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
            {liveCounts.purchases}
          </div>
          <span className="text-[10px] text-slate-500">{liveCounts.accounting} Ledger Tx</span>
        </div>
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#161b26] border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400">Prescriptions</span>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
            {liveCounts.prescriptions}
          </div>
          <span className="text-[10px] text-slate-500">{liveCounts.heldSales} Held Carts</span>
        </div>
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#161b26] border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400">Customers</span>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
            {liveCounts.customers}
          </div>
          <span className="text-[10px] text-slate-500">{liveCounts.customersWithDue} With Dues</span>
        </div>
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#161b26] border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400">Audit Logs</span>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
            {liveCounts.logsTotal}
          </div>
          <span className="text-[10px] text-slate-500">{liveCounts.logsLast24h} in last 24h</span>
        </div>
      </div>

      {/* DANGER ZONE: Master Clear Whole Database Card */}
      <div className="p-5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/25 border-2 border-rose-500/70 dark:border-rose-600/70 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-600/30">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black uppercase">
                DANGER ZONE
              </span>
              <h2 className="text-base font-black text-rose-950 dark:text-rose-200">
                {masterDangerOption.title}
              </h2>
            </div>
            <p className="text-xs text-rose-800/90 dark:text-rose-300/80 mt-1 max-w-3xl">
              {masterDangerOption.description}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setActiveConfirmAction(masterDangerOption);
            setConfirmInput('');
          }}
          className="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black text-xs tracking-wide shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 shrink-0 transition cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear Whole Database</span>
        </button>
      </div>

      {/* Granular Clear Sections */}
      {renderCategorySection(
        'transactions',
        'Transactions & Financial Ledgers',
        'Clear all transactions or filter by POS sales, purchases, customer dues, or recent time windows (24h / 7d / 30d)',
        <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
      )}

      {renderCategorySection(
        'stock',
        'Stock, Batches & Inventory Reset',
        'Zero out batch stock, clear expired/quarantined lots, or wipe the entire product catalog',
        <Boxes className="w-5 h-5 text-amber-600 dark:text-amber-400" />
      )}

      {renderCategorySection(
        'logs',
        'Audit Trail & System Logs Cleanup',
        'Purge logs from the last 24 hours, last week, last month, older than 30 days, or clear all logs',
        <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
      )}

      {renderCategorySection(
        'clinical',
        'Prescriptions & Staff Directory Reset',
        'Clear digital prescription queues or reset non-Super-Admin employee accounts',
        <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
      )}

      {/* Recent Purge History Log */}
      {operationHistory.length > 0 && (
        <div className="p-5 rounded-2xl bg-white dark:bg-[#161b26] border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Recent Super Admin Purge Operations
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {operationHistory.map((h) => (
              <div key={h.id} className="py-2 flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{h.title}</span>
                  <span className="text-slate-400 ml-2">by {h.operator}</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {new Date(h.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two-Step Security Confirmation Modal */}
      {activeConfirmAction && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-5 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-black text-sm">Confirm Destructive Database Operation</h3>
              </div>
              <button
                onClick={() => setActiveConfirmAction(null)}
                className="p-1 rounded-lg hover:bg-white/20 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
                <div className="font-black text-xs text-rose-900 dark:text-rose-200">
                  {activeConfirmAction.title}
                </div>
                <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1">
                  {activeConfirmAction.description}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Type <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-rose-600 font-black">CLEAR</code> or enter Super Admin PIN (<code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800">1800</code>) to authorize:
                </label>
                <input
                  type="text"
                  autoFocus
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="Type CLEAR or 1800"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveConfirmAction(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    isExecuting ||
                    (confirmInput.trim().toUpperCase() !== 'CLEAR' &&
                      confirmInput.trim() !== '1800' &&
                      confirmInput.trim() !== '9999')
                  }
                  onClick={handleExecuteConfirmedPurge}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isExecuting ? 'Executing Purge...' : 'Authorize & Clear'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
