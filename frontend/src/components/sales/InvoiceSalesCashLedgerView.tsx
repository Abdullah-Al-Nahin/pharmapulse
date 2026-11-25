import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Download,
  RefreshCw,
  Printer,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  CreditCard,
  Smartphone,
  Percent,
  Building2,
  Calendar,
  TrendingUp,
  UserCheck,
  Layers,
  Pill,
  BarChart3,
  Clock,
  X,
  Check,
  ShieldCheck,
  Banknote,
  ArrowUpDown,
  Lock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { PharmacyService } from '../../services/pharmacyService';
import { BranchService } from '../../services/branchService';
import { CustomerService } from '../../services/customerService';
import { AuditService } from '../../services/auditService';
import { useAuth } from '../../context/AuthContext';
import { Sale, Medicine, Batch } from '../../types/pharmacy';
import { BranchInfo, PharmaCartItem } from '../../types/pharmapulse';
import { ThermalReceiptModal } from '../pharmapulse/PharmaPulseModals';
import {
  getCurrentLocale,
  subscribeLocale,
  toBanglaDigits,
} from '../../utils/i18nFormatter';
import {
  round2,
  LedgerPeriod,
  LedgerPaymentFilter,
  NormalizedInvoice,
  normalizeInvoice,
  filterInvoicesByPeriod,
  computeMasterKpis,
  computeCategoryBreakdown,
  computeProductBreakdown,
  computeChannelMatrix,
  computeCashierAudit,
  computeBranchComparison,
  computeDailyCashbookClosing,
} from '../../utils/invoiceLedgerMath';

interface InvoiceSalesCashLedgerViewProps {
  onOpenFullPos?: () => void;
  onNavigateTab?: (tab: string) => void;
}

type InnerTab = 'ledger' | 'audit' | 'categories' | 'products' | 'overview';

interface CashbookClosingRecord {
  id: string;
  timestamp: string;
  date: string;
  branchName: string;
  closedBy: string;
  openingFloat: number;
  expectedCash: number;
  physicalCounted: number;
  variance: number;
  status: string;
  notes?: string;
}

const CASHBOOK_CLOSINGS_STORAGE_KEY = 'rx_daily_cashbook_closings_v1';
const PIE_COLORS = ['#10b981', '#ec4899', '#6366f1', '#a855f7', '#ef4444'];

export const InvoiceSalesCashLedgerView: React.FC<InvoiceSalesCashLedgerViewProps> = ({
  onOpenFullPos,
  onNavigateTab,
}) => {
  const { currentUser, isSuperAdmin } = useAuth();
  const [locale, setLocaleState] = useState<'en' | 'bn'>(() => getCurrentLocale());
  useEffect(() => subscribeLocale((l) => setLocaleState(l)), []);
  const isBn = locale === 'bn';

  const fmtNum = (val: number, decimals = 2) => {
    const str = Number(val || 0).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return isBn ? toBanglaDigits(str) : str;
  };
  const fmtInt = (val: number) => {
    const str = Math.round(Number(val || 0)).toLocaleString('en-US');
    return isBn ? toBanglaDigits(str) : str;
  };
  const fmtCur = (val: number) => `৳${fmtNum(val, 2)}`;

  // Live service states
  const [sales, setSales] = useState<Sale[]>(() => PharmacyService.getSales());
  const [medicines, setMedicines] = useState<Medicine[]>(() => PharmacyService.getMedicines());
  const [batches, setBatches] = useState<Batch[]>(() => PharmacyService.getBatches());
  const [returns, setReturns] = useState(() => PharmacyService.getReturns());
  const [accountingTx, setAccountingTx] = useState(() => PharmacyService.getAccountingTransactions());
  const [branches, setBranches] = useState<BranchInfo[]>(() => BranchService.getBranches());
  const [customers, setCustomers] = useState(() => CustomerService.getCustomers());

  useEffect(() => {
    const unsub1 = PharmacyService.subscribe(() => {
      setSales([...PharmacyService.getSales()]);
      setMedicines([...PharmacyService.getMedicines()]);
      setBatches([...PharmacyService.getBatches()]);
      setReturns([...PharmacyService.getReturns()]);
      setAccountingTx([...PharmacyService.getAccountingTransactions()]);
    });
    const unsub2 = BranchService.subscribe(() => setBranches([...BranchService.getBranches()]));
    const unsub3 = CustomerService.subscribe(() => setCustomers([...CustomerService.getCustomers()]));
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, []);

  // RBAC: Admins/Managers can inspect All Branches or individual branches; Cashiers locked to assigned branch
  const canSwitchBranch =
    isSuperAdmin ||
    currentUser?.roleCode === 'super_admin' ||
    currentUser?.roleCode === 'pharmacy_manager' ||
    currentUser?.roleCode === 'accountant';

  const [period, setPeriod] = useState<LedgerPeriod>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() =>
    canSwitchBranch ? 'all' : currentUser?.branchId || 'HQ-MAIN'
  );
  const [activeInnerTab, setActiveInnerTab] = useState<InnerTab>('ledger');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<LedgerPaymentFilter>('all');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Modals State
  const [receiptInvoice, setReceiptInvoice] = useState<NormalizedInvoice | null>(null);
  const [collectDueTarget, setCollectDueTarget] = useState<NormalizedInvoice | null>(null);
  const [duePayAmount, setDuePayAmount] = useState<number>(0);
  const [duePayMethod, setDuePayMethod] = useState<'cash' | 'bkash_nagad' | 'card'>('cash');
  const [duePayTrxRef, setDuePayTrxRef] = useState<string>('');
  const [isCollectingDue, setIsCollectingDue] = useState<boolean>(false);

  // Daily Cashbook & Closing Modal
  const [showCashbookModal, setShowCashbookModal] = useState<boolean>(false);
  const [openingFloat, setOpeningFloat] = useState<number>(5000);
  const [physicalCounted, setPhysicalCounted] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [closingHistory, setClosingHistory] = useState<CashbookClosingRecord[]>(() => {
    try {
      const saved = localStorage.getItem(CASHBOOK_CLOSINGS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Quick Invoice / Cash Modal
  const [showQuickInvoiceModal, setShowQuickInvoiceModal] = useState<boolean>(false);
  const [qiCustomerName, setQiCustomerName] = useState<string>('Walk-In Customer');
  const [qiCustomerPhone, setQiCustomerPhone] = useState<string>('');
  const [qiCustomerId, setQiCustomerId] = useState<string>('');
  const [qiBranchId, setQiBranchId] = useState<string>(
    currentUser?.branchId || branches[0]?.id || 'HQ-MAIN'
  );
  const [qiPaymentMode, setQiPaymentMode] = useState<
    'cash' | 'bkash_nagad' | 'card' | 'split' | 'due_credit'
  >('cash');
  const [qiDiscountType, setQiDiscountType] = useState<'pct' | 'flat'>('pct');
  const [qiDiscountVal, setQiDiscountVal] = useState<number>(0);
  const [qiVatPct, setQiVatPct] = useState<number>(0);
  const [qiTendered, setQiTendered] = useState<number>(0);
  const [qiSplitCash, setQiSplitCash] = useState<number>(0);
  const [qiSplitMfs, setQiSplitMfs] = useState<number>(0);
  const [qiSplitCard, setQiSplitCard] = useState<number>(0);
  const [qiTrxRef, setQiTrxRef] = useState<string>('');
  const [qiRows, setQiRows] = useState<
    Array<{ medicineId: string; qty: number; rate: number }>
  >([]);
  const [isSavingQuickInv, setIsSavingQuickInv] = useState<boolean>(false);

  // Product sort state
  const [prodSearch, setProdSearch] = useState<string>('');
  const [prodSortKey, setProdSortKey] = useState<'netSales' | 'qtySold' | 'grossProfit' | 'marginPct'>('netSales');

  const showNotice = (type: 'success' | 'error', msg: string) => {
    setStatusBanner({ type, msg });
    setTimeout(() => setStatusBanner(null), 4000);
  };

  // Normalize all sales with exact mathematical engine
  const allNormalized = useMemo(
    () =>
      sales.map((s) => normalizeInvoice(s, medicines, batches, branches)),
    [sales, medicines, batches, branches]
  );

  // Branch filter
  const branchFiltered = useMemo(() => {
    if (selectedBranchId === 'all') return allNormalized;
    return allNormalized.filter((inv) => inv.branchId === selectedBranchId);
  }, [allNormalized, selectedBranchId]);

  // Period filter (drives the 6 KPIs, Category Breakdown, Product Breakdown, Cashier Audit, Visuals)
  const periodInvoices = useMemo(
    () => filterInvoicesByPeriod(branchFiltered, period, customStart, customEnd),
    [branchFiltered, period, customStart, customEnd]
  );

  // Table search & payment filter (drives Ledger rows)
  const ledgerInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return periodInvoices.filter((inv) => {
      if (paymentFilter === 'discounted' && inv.discountGiven <= 0.009) return false;
      if (paymentFilter === 'cash' && inv.normalizedMode !== 'cash') return false;
      if (paymentFilter === 'bkash_nagad' && inv.normalizedMode !== 'bkash_nagad') return false;
      if (paymentFilter === 'card' && inv.normalizedMode !== 'card') return false;
      if (paymentFilter === 'split' && inv.normalizedMode !== 'split') return false;
      if (paymentFilter === 'due_credit' && inv.dueAmount <= 0.009 && inv.normalizedMode !== 'due_credit') {
        return false;
      }

      if (!q) return true;
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.customerPhone.toLowerCase().includes(q) ||
        inv.cashierName.toLowerCase().includes(q) ||
        inv.branchName.toLowerCase().includes(q) ||
        inv.items.some(
          (it) =>
            it.medicineName.toLowerCase().includes(q) ||
            it.batchNumber.toLowerCase().includes(q)
        )
      );
    });
  }, [periodInvoices, searchQuery, paymentFilter]);

  // Computed Analytics
  const kpis = useMemo(() => computeMasterKpis(periodInvoices), [periodInvoices]);
  const categoryRows = useMemo(() => computeCategoryBreakdown(periodInvoices), [periodInvoices]);
  const productRows = useMemo(
    () => computeProductBreakdown(periodInvoices, medicines, batches),
    [periodInvoices, medicines, batches]
  );
  const channelMatrix = useMemo(() => computeChannelMatrix(periodInvoices), [periodInvoices]);
  const cashierAudit = useMemo(() => computeCashierAudit(periodInvoices), [periodInvoices]);
  const branchComparison = useMemo(
    () => computeBranchComparison(filterInvoicesByPeriod(allNormalized, period, customStart, customEnd)),
    [allNormalized, period, customStart, customEnd]
  );

  const cashbookSummary = useMemo(
    () =>
      computeDailyCashbookClosing({
        openingFloat,
        invoices: periodInvoices,
        returns,
        accountingTx,
        physicalCountedCash: physicalCounted,
        startDate: period === 'today' ? new Date().toISOString().split('T')[0] : customStart || undefined,
        endDate: period === 'today' ? new Date().toISOString().split('T')[0] : customEnd || undefined,
        branchId: selectedBranchId,
      }),
    [openingFloat, periodInvoices, returns, accountingTx, physicalCounted, period, customStart, customEnd, selectedBranchId]
  );

  // Auto-seed physicalCounted when opening Cashbook modal
  useEffect(() => {
    if (showCashbookModal) {
      setPhysicalCounted(cashbookSummary.expectedDrawerCash);
    }
  }, [showCashbookModal]);

  // Visual chart datasets
  const dailyTrendData = useMemo(() => {
    const map = new Map<string, { date: string; gross: number; net: number; cash: number; profit: number }>();
    periodInvoices.forEach((inv) => {
      const key = inv.date || 'N/A';
      const cur = map.get(key) || { date: key, gross: 0, net: 0, cash: 0, profit: 0 };
      cur.gross = round2(cur.gross + inv.grossBill);
      cur.net = round2(cur.net + inv.netSale);
      cur.cash = round2(cur.cash + inv.cashCollected);
      cur.profit = round2(cur.profit + inv.grossProfit);
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [periodInvoices]);

  const paymentPieData = useMemo(() => {
    return [
      { name: isBn ? 'নগদ ক্যাশ' : 'Cash', value: kpis.netCashCollection },
      { name: isBn ? 'বিকাশ / নগদ' : 'bKash / Nagad', value: kpis.totalMfsCollection },
      { name: isBn ? 'কার্ড পিওএস' : 'Card POS', value: kpis.totalCardCollection },
      { name: isBn ? 'বকেয়া / বাকি' : 'Due / Credit', value: kpis.totalDue },
    ].filter((d) => d.value > 0);
  }, [kpis, isBn]);

  const filteredProductRows = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    return [...productRows]
      .filter(
        (r) =>
          !q ||
          r.medicineName.toLowerCase().includes(q) ||
          r.genericName.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
      )
      .sort((a, b) => b[prodSortKey] - a[prodSortKey]);
  }, [productRows, prodSearch, prodSortKey]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        PharmacyService.syncDatabase(),
        BranchService.syncFromDB(),
        CustomerService.syncFromDB(),
      ]);
      showNotice(
        'success',
        isBn ? 'লাইভ ডাটাবেস থেকে সকল ইনভয়েস ও ক্যাশ তথ্য হালনাগাদ হয়েছে।' : 'Synchronized live invoices & cash ledger from Neon database.'
      );
    } catch {
      showNotice('error', isBn ? 'রিফ্রেশ ব্যর্থ হয়েছে।' : 'Failed to refresh from database.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      'Invoice #',
      'Date',
      'Time',
      'Branch',
      'Branch Code',
      'Customer',
      'Phone',
      'Cashier',
      'Medicines',
      'Units',
      'Gross Bill',
      'Discount Given',
      'Discount %',
      'VAT',
      'Net Sale',
      'COGS',
      'Gross Profit',
      'Cash Collected',
      'MFS Collected',
      'Card Collected',
      'Due Amount',
      'Payment Mode',
      'Status',
    ];

    const escapeCsv = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const rows = ledgerInvoices.map((inv) => [
      inv.invoiceNumber,
      inv.date,
      new Date(inv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      inv.branchName,
      inv.branchCode,
      inv.customerName,
      inv.customerPhone,
      inv.cashierName,
      inv.items.map((i) => `${i.medicineName} (${i.qty} x ${i.unitRate})`).join('; '),
      inv.totalUnits,
      inv.grossBill.toFixed(2),
      inv.discountGiven.toFixed(2),
      `${inv.discountPercent}%`,
      inv.vatAmount.toFixed(2),
      inv.netSale.toFixed(2),
      inv.cogs.toFixed(2),
      inv.grossProfit.toFixed(2),
      inv.cashCollected.toFixed(2),
      inv.mfsCollected.toFixed(2),
      inv.cardCollected.toFixed(2),
      inv.dueAmount.toFixed(2),
      inv.normalizedMode.toUpperCase(),
      inv.paymentStatus.toUpperCase(),
    ]);

    rows.push([
      'TOTALS',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      `${ledgerInvoices.length} Invoices`,
      String(ledgerInvoices.reduce((s, i) => s + i.totalUnits, 0)),
      ledgerInvoices.reduce((s, i) => s + i.grossBill, 0).toFixed(2),
      ledgerInvoices.reduce((s, i) => s + i.discountGiven, 0).toFixed(2),
      '',
      ledgerInvoices.reduce((s, i) => s + i.vatAmount, 0).toFixed(2),
      ledgerInvoices.reduce((s, i) => s + i.netSale, 0).toFixed(2),
      ledgerInvoices.reduce((s, i) => s + i.cogs, 0).toFixed(2),
      ledgerInvoices.reduce((s, i) => s + i.grossProfit, 0).toFixed(2),
      ledgerInvoices.reduce((s, i) => s + i.cashCollected, 0).toFixed(2),
      ledgerInvoices.reduce((s, i) => s + i.mfsCollected, 0).toFixed(2),
      ledgerInvoices.reduce((s, i) => s + i.cardCollected, 0).toFixed(2),
      ledgerInvoices.reduce((s, i) => s + i.dueAmount, 0).toFixed(2),
      '',
      '',
    ]);

    const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice_Sales_Cash_Ledger_${period}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('success', isBn ? 'CSV রিপোর্ট ডাউনলোড সম্পন্ন।' : 'Exported Invoice Cash Ledger CSV.');
  };

  // Sales & Group PDF Report (With Full Branch Metadata)
  const handleExportBranchPdfReport = () => {
    const activeBranch =
      selectedBranchId === 'all'
        ? null
        : branches.find((b) => b.id === selectedBranchId) || branches[0];

    const periodLabel =
      period === 'today'
        ? "Today's Sales"
        : period === 'yesterday'
        ? 'Yesterday'
        : period === 'last7'
        ? 'Last 7 Days'
        : period === 'month'
        ? 'This Month'
        : period === 'custom'
        ? `${customStart || '...'} to ${customEnd || '...'}`
        : 'All History';

    const win = window.open('', '_blank', 'width=1024,height=780');
    if (!win) {
      window.print();
      return;
    }

    const branchHeaderHtml = activeBranch
      ? `
        <div style="border:1px solid #cbd5e1;border-radius:10px;padding:14px;background:#f8fafc;margin-bottom:16px;">
          <div style="font-size:17px;font-weight:800;color:#0f172a;">${activeBranch.name} (${activeBranch.code})</div>
          <div style="font-size:12px;color:#475569;margin-top:4px;">
            Address: ${activeBranch.address} &nbsp;|&nbsp; Phone: ${activeBranch.phone} &nbsp;|&nbsp; DGDA License: ${activeBranch.licenseNo} &nbsp;|&nbsp; Manager: ${activeBranch.managerName}
          </div>
        </div>
      `
      : `
        <div style="border:1px solid #cbd5e1;border-radius:10px;padding:14px;background:#f8fafc;margin-bottom:16px;">
          <div style="font-size:16px;font-weight:800;color:#0f172a;">Consolidated Multi-Branch Pharmacy Network (${branches.length} Branch(es))</div>
          <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:11px;">
            <thead>
              <tr style="background:#e2e8f0;text-align:left;">
                <th style="padding:5px;">Branch</th><th style="padding:5px;">Code</th><th style="padding:5px;text-align:right;">Invoices</th><th style="padding:5px;text-align:right;">Gross</th><th style="padding:5px;text-align:right;">Discount</th><th style="padding:5px;text-align:right;">Net Sales</th><th style="padding:5px;text-align:right;">Cash</th><th style="padding:5px;text-align:right;">MFS/Card</th><th style="padding:5px;text-align:right;">Due</th><th style="padding:5px;text-align:right;">Profit</th>
              </tr>
            </thead>
            <tbody>
              ${branchComparison
                .map(
                  (br) => `
                  <tr style="border-top:1px solid #e2e8f0;">
                    <td style="padding:5px;font-weight:700;">${br.branchName}</td>
                    <td style="padding:5px;">${br.branchCode}</td>
                    <td style="padding:5px;text-align:right;">${br.invoiceCount}</td>
                    <td style="padding:5px;text-align:right;">৳${br.grossBill.toFixed(2)}</td>
                    <td style="padding:5px;text-align:right;color:#b45309;">-৳${br.discountGiven.toFixed(2)}</td>
                    <td style="padding:5px;text-align:right;font-weight:700;">৳${br.netSales.toFixed(2)}</td>
                    <td style="padding:5px;text-align:right;color:#047857;">৳${br.cashCollected.toFixed(2)}</td>
                    <td style="padding:5px;text-align:right;">৳${br.mfsAndCard.toFixed(2)}</td>
                    <td style="padding:5px;text-align:right;color:#dc2626;">৳${br.dueAmount.toFixed(2)}</td>
                    <td style="padding:5px;text-align:right;color:#059669;">৳${br.grossProfit.toFixed(2)}</td>
                  </tr>
                `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;

    win.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Sales & Group PDF Report - ${periodLabel}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; font-size: 12px; }
            h1 { margin: 0; font-size: 20px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
            .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; }
            .kpi-title { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
            .kpi-val { font-size: 18px; font-weight: 800; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; }
            th { background: #f1f5f9; text-align: left; }
            .num { text-align: right; font-family: monospace; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:14px;">
            <div>
              <h1>PharmaPulse Sales, Discount & Cash Collection Report</h1>
              <div style="color:#475569;margin-top:2px;">Period: <b>${periodLabel}</b> &nbsp;|&nbsp; Generated: ${new Date().toLocaleString()}</div>
            </div>
            <button onclick="window.print()" style="padding:8px 14px;background:#059669;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;">Print / Save PDF</button>
          </div>
          ${branchHeaderHtml}
          <div class="grid">
            <div class="kpi"><div class="kpi-title">1. Gross Invoice Bill</div><div class="kpi-val">৳${kpis.grossInvoiceBill.toFixed(2)}</div><div>${kpis.invoiceCount} Invoices • ${kpis.totalUnitsSold} Units</div></div>
            <div class="kpi"><div class="kpi-title">2. Total Discount Given</div><div class="kpi-val" style="color:#d97706;">-৳${kpis.totalDiscountGiven.toFixed(2)}</div><div>${kpis.discountedInvoiceCount} Invoices (${kpis.effectiveDiscountPct}%)</div></div>
            <div class="kpi"><div class="kpi-title">3. Net Invoice Sales</div><div class="kpi-val" style="color:#4f46e5;">৳${kpis.netInvoiceSales.toFixed(2)}</div><div>Incl. VAT: ৳${kpis.totalVat.toFixed(2)}</div></div>
            <div class="kpi"><div class="kpi-title">4. Net Cash Collection</div><div class="kpi-val" style="color:#059669;">৳${kpis.netCashCollection.toFixed(2)}</div><div>Tendered: ৳${kpis.totalCashTendered.toFixed(2)}</div></div>
            <div class="kpi"><div class="kpi-title">5. MFS & Card Collection</div><div class="kpi-val" style="color:#db2777;">৳${kpis.totalMfsAndCard.toFixed(2)}</div><div>MFS: ৳${kpis.totalMfsCollection.toFixed(2)} • Card: ৳${kpis.totalCardCollection.toFixed(2)}</div></div>
            <div class="kpi"><div class="kpi-title">6. Due & Gross Profit</div><div class="kpi-val" style="color:#dc2626;">Due: ৳${kpis.totalDue.toFixed(2)}</div><div style="color:#059669;font-weight:700;">Profit: +৳${kpis.totalGrossProfit.toFixed(2)} (${kpis.avgMarginPct}%)</div></div>
          </div>

          <h3 style="margin:0 0 6px;">Group / Category-Wise Sales Breakdown</h3>
          <table>
            <thead><tr><th>Category</th><th class="num">Invoices</th><th class="num">Units</th><th class="num">Gross</th><th class="num">Discount</th><th class="num">Net Sales</th><th class="num">COGS</th><th class="num">Profit</th><th class="num">Margin</th></tr></thead>
            <tbody>
              ${categoryRows
                .map(
                  (c) => `<tr><td><b>${c.category}</b></td><td class="num">${c.invoiceCount}</td><td class="num">${c.unitsSold}</td><td class="num">৳${c.grossSales.toFixed(2)}</td><td class="num">-৳${c.discountGiven.toFixed(2)}</td><td class="num"><b>৳${c.netSales.toFixed(2)}</b></td><td class="num">৳${c.cogs.toFixed(2)}</td><td class="num" style="color:#059669;">৳${c.grossProfit.toFixed(2)}</td><td class="num">${c.marginPct}%</td></tr>`
                )
                .join('')}
            </tbody>
          </table>

          <h3 style="margin:0 0 6px;">Invoice-Wise Ledger (${ledgerInvoices.length} Records)</h3>
          <table>
            <thead><tr><th>Invoice #</th><th>Date</th><th>Branch</th><th>Customer</th><th>Cashier</th><th class="num">Gross</th><th class="num">Discount</th><th class="num">Net</th><th class="num">Cash</th><th class="num">MFS/Card</th><th class="num">Due</th></tr></thead>
            <tbody>
              ${ledgerInvoices
                .map(
                  (inv) => `<tr><td><b>${inv.invoiceNumber}</b></td><td>${inv.date}</td><td>${inv.branchCode}</td><td>${inv.customerName}</td><td>${inv.cashierName}</td><td class="num">৳${inv.grossBill.toFixed(2)}</td><td class="num">-৳${inv.discountGiven.toFixed(2)}</td><td class="num"><b>৳${inv.netSale.toFixed(2)}</b></td><td class="num">৳${inv.cashCollected.toFixed(2)}</td><td class="num">৳${inv.mfsOrCardTotal.toFixed(2)}</td><td class="num">৳${inv.dueAmount.toFixed(2)}</td></tr>`
                )
                .join('')}
            </tbody>
          </table>

          <div style="display:flex;justify-content:space-between;margin-top:40px;padding-top:12px;">
            <div style="border-top:1px solid #334155;width:200px;text-align:center;padding-top:4px;">Prepared By (${currentUser?.name || 'Pharmacist'})</div>
            <div style="border-top:1px solid #334155;width:200px;text-align:center;padding-top:4px;">Counter Cashier Signature</div>
            <div style="border-top:1px solid #334155;width:200px;text-align:center;padding-top:4px;">Auditor / Manager Approval</div>
          </div>
          <script>setTimeout(() => window.print(), 350);</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  // Collect Due Handler
  const handleConfirmCollectDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectDueTarget || duePayAmount <= 0) return;
    setIsCollectingDue(true);
    try {
      await PharmacyService.collectInvoiceDue({
        saleId: collectDueTarget.id,
        amountPaid: duePayAmount,
        method: duePayMethod,
        trxRef: duePayTrxRef.trim() || undefined,
        collectedBy: currentUser?.name || 'Duty Pharmacist',
      });
      if (collectDueTarget.customerId) {
        try {
          CustomerService.collectDuePayment({
            customerId: collectDueTarget.customerId,
            amountPaid: duePayAmount,
            paymentMethod: duePayMethod === 'bkash_nagad' ? 'upi_mobile' : duePayMethod,
            transactionReference: duePayTrxRef.trim() || undefined,
            referenceNotes: `Settled against ${collectDueTarget.invoiceNumber}`,
            collectedBy: currentUser?.name || 'Duty Pharmacist',
          });
        } catch {}
      }
      showNotice(
        'success',
        isBn
          ? `ইনভয়েস ${collectDueTarget.invoiceNumber}-এর ৳${duePayAmount.toFixed(2)} বকেয়া আদায় সম্পন্ন হয়েছে!`
          : `Collected ৳${duePayAmount.toFixed(2)} against ${collectDueTarget.invoiceNumber}!`
      );
      setCollectDueTarget(null);
      setDuePayTrxRef('');
    } finally {
      setIsCollectingDue(false);
    }
  };

  // Daily Cashbook Closing Save Handler
  const handleSaveCashbookClosing = () => {
    const branchObj =
      selectedBranchId === 'all'
        ? { name: 'All Branches (Consolidated)' }
        : branches.find((b) => b.id === selectedBranchId) || { name: selectedBranchId };

    const rec: CashbookClosingRecord = {
      id: `CLS-${Date.now()}`,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      branchName: branchObj.name,
      closedBy: currentUser?.name || 'Pharmacist',
      openingFloat: cashbookSummary.openingFloat,
      expectedCash: cashbookSummary.expectedDrawerCash,
      physicalCounted: cashbookSummary.physicalCountedCash,
      variance: cashbookSummary.variance,
      status: cashbookSummary.status,
      notes: closingNotes.trim() || undefined,
    };

    const next = [rec, ...closingHistory].slice(0, 20);
    setClosingHistory(next);
    try {
      localStorage.setItem(CASHBOOK_CLOSINGS_STORAGE_KEY, JSON.stringify(next));
    } catch {}

    AuditService.recordAuditLog({
      userId: currentUser?.id || 'current-user',
      userName: currentUser?.name || 'Cashier',
      userRole: currentUser?.roleName || 'Cashier',
      action: 'CREATE',
      module: 'pos',
      targetEntityId: rec.id,
      targetEntityType: 'DailyCashbookClosing',
      summary: `Shift Cashbook Closed (${rec.branchName}): Expected ৳${rec.expectedCash.toFixed(2)}, Physical ৳${rec.physicalCounted.toFixed(2)}, Variance ৳${rec.variance.toFixed(2)}`,
      beforeState: null,
      afterState: rec,
    });

    showNotice(
      'success',
      isBn
        ? `ক্যাশবুক ক্লোজিং সংরক্ষিত হয়েছে (ভ্যারিয়েন্স: ৳${rec.variance.toFixed(2)})`
        : `Daily cashbook closing recorded (Variance: ৳${rec.variance.toFixed(2)})`
    );
    setClosingNotes('');
  };

  // Quick Invoice Modal Helpers
  const openQuickInvoiceModal = () => {
    const defaultMed = medicines[0];
    const defaultFefo = defaultMed ? PharmacyService.getFefoBatchForMedicine(defaultMed.id) : null;
    const defaultRate =
      Number(defaultFefo?.batch?.sellingPrice || defaultMed?.sellingPrice || defaultMed?.mrp || 10);
    setQiRows(
      defaultMed
        ? [{ medicineId: defaultMed.id, qty: 1, rate: defaultRate }]
        : []
    );
    setQiCustomerName('Walk-In Customer');
    setQiCustomerPhone('');
    setQiCustomerId('');
    setQiBranchId(
      selectedBranchId !== 'all'
        ? selectedBranchId
        : currentUser?.branchId || branches[0]?.id || 'HQ-MAIN'
    );
    setQiPaymentMode('cash');
    setQiDiscountType('pct');
    setQiDiscountVal(0);
    setQiVatPct(0);
    setQiTendered(defaultRate);
    setQiSplitCash(0);
    setQiSplitMfs(0);
    setQiSplitCard(0);
    setQiTrxRef('');
    setShowQuickInvoiceModal(true);
  };

  const qiGross = useMemo(
    () => round2(qiRows.reduce((s, r) => s + Math.max(0, r.qty) * Math.max(0, r.rate), 0)),
    [qiRows]
  );
  const qiDiscountAmt = useMemo(() => {
    if (qiDiscountType === 'pct') {
      return round2((qiGross * Math.min(100, Math.max(0, qiDiscountVal))) / 100);
    }
    return round2(Math.min(qiGross, Math.max(0, qiDiscountVal)));
  }, [qiGross, qiDiscountType, qiDiscountVal]);
  const qiAfterDisc = useMemo(() => round2(Math.max(0, qiGross - qiDiscountAmt)), [qiGross, qiDiscountAmt]);
  const qiVatAmt = useMemo(() => round2((qiAfterDisc * Math.max(0, qiVatPct)) / 100), [qiAfterDisc, qiVatPct]);
  const qiGrandTotal = useMemo(() => round2(qiAfterDisc + qiVatAmt), [qiAfterDisc, qiVatAmt]);

  const handleSaveQuickInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qiRows.length === 0 || qiGrandTotal <= 0) {
      showNotice('error', isBn ? 'কমপক্ষে ১টি ওষুধ নির্বাচন করুন।' : 'Add at least one medicine item.');
      return;
    }

    setIsSavingQuickInv(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const invNo = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`;
      const branchObj = branches.find((b) => b.id === qiBranchId);

      let totalCost = 0;
      const saleItems = qiRows.map((row) => {
        const med = medicines.find((m) => m.id === row.medicineId);
        const fefo = PharmacyService.getFefoBatchForMedicine(row.medicineId, qiBranchId);
        const b = fefo.batch;
        const unitCost = Number(b?.purchasePrice || med?.purchasePrice || 0);
        const lineGross = round2(row.qty * row.rate);
        const itemShareDisc =
          qiGross > 0 ? round2((lineGross / qiGross) * qiDiscountAmt) : 0;
        const lineTotal = round2(lineGross - itemShareDisc);
        totalCost += round2(row.qty * unitCost);

        return {
          medicineId: med?.id || row.medicineId,
          medicineName: med?.name || 'Medicine Item',
          genericName: med?.genericName || '',
          batchId: b?.id || 'unknown-batch',
          batchNumber: b?.batchNumber || 'GEN-01',
          expiryDate: b?.expiryDate || '2027-12-31',
          quantity: row.qty,
          unitPrice: row.rate,
          unitCost,
          mrp: row.rate,
          discountPercent: lineGross > 0 ? Number(((itemShareDisc / lineGross) * 100).toFixed(1)) : 0,
          taxRate: qiVatPct,
          subtotal: lineGross,
          taxAmount: round2((lineTotal * qiVatPct) / 100),
          total: lineTotal,
        };
      });

      let dueAmount = 0;
      let cashTendered = 0;
      let changeGiven = 0;
      let splitDetails: Sale['splitDetails'] | undefined;

      if (qiPaymentMode === 'due_credit') {
        dueAmount = qiGrandTotal;
      } else if (qiPaymentMode === 'split') {
        const paidNow = round2(qiSplitCash + qiSplitMfs + qiSplitCard);
        dueAmount = round2(Math.max(0, qiGrandTotal - paidNow));
        cashTendered = qiSplitCash;
        splitDetails = {
          cashAmount: qiSplitCash,
          mobileAmount: qiSplitMfs,
          mobileTrxId: qiTrxRef || undefined,
          cardAmount: qiSplitCard,
        };
      } else if (qiPaymentMode === 'bkash_nagad') {
        splitDetails = { mobileAmount: qiGrandTotal, mobileTrxId: qiTrxRef || undefined };
      } else if (qiPaymentMode === 'card') {
        splitDetails = { cardAmount: qiGrandTotal, cardAuthCode: qiTrxRef || undefined };
      } else {
        cashTendered = qiTendered >= qiGrandTotal ? qiTendered : qiGrandTotal;
        changeGiven = round2(Math.max(0, cashTendered - qiGrandTotal));
      }

      const saleRecord: Sale = {
        id: `sale-${Date.now()}`,
        invoiceNumber: invNo,
        date: todayStr,
        timestamp: new Date().toISOString(),
        customerId: qiCustomerId || undefined,
        customerName: qiCustomerName.trim() || 'Walk-In Customer',
        customerPhone: qiCustomerPhone.trim(),
        items: saleItems,
        subtotal: qiGross,
        discountTotal: qiDiscountAmt,
        taxTotal: qiVatAmt,
        roundOff: 0,
        grandTotal: qiGrandTotal,
        totalCost: round2(totalCost),
        grossProfit: round2(qiAfterDisc - totalCost),
        dueAmount,
        paymentMethod: qiPaymentMode,
        cashTendered,
        changeGiven,
        splitDetails,
        paymentStatus: dueAmount <= 0.009 ? 'paid' : dueAmount < qiGrandTotal ? 'partially_paid' : 'due',
        cashierId: currentUser?.id || 'user-super-admin-01',
        cashierName: currentUser?.name || 'Duty Pharmacist',
        branchId: qiBranchId,
        branchName: branchObj?.name || 'Main Branch',
      };

      await PharmacyService.completeSale(saleRecord);
      if (qiCustomerId && dueAmount > 0) {
        CustomerService.recordCreditSale({
          customerId: qiCustomerId,
          invoiceNumber: invNo,
          totalAmount: qiGrandTotal,
          amountPaidNow: round2(qiGrandTotal - dueAmount),
          dueAmount,
          collectedBy: currentUser?.name,
        });
      }

      setShowQuickInvoiceModal(false);
      showNotice(
        'success',
        isBn
          ? `ইনভয়েস ${invNo} (৳${qiGrandTotal.toFixed(2)}) সফলভাবে তৈরি হয়েছে!`
          : `Created quick invoice ${invNo} (৳${qiGrandTotal.toFixed(2)})!`
      );
    } finally {
      setIsSavingQuickInv(false);
    }
  };

  // Mode badge renderer matching screenshot
  const renderModeBadge = (inv: NormalizedInvoice) => {
    switch (inv.normalizedMode) {
      case 'due_credit':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/90 text-rose-300 border border-rose-700/70 text-[10px] font-bold">
            <AlertTriangle className="w-2.5 h-2.5" />
            {isBn ? 'বাকি / ক্রেডিট' : 'Due Credit'}
          </span>
        );
      case 'split':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-950/90 text-purple-300 border border-purple-700/70 text-[10px] font-bold">
            <Layers className="w-2.5 h-2.5" />
            {isBn ? 'স্প্লিট পে' : 'Split Pay'}
          </span>
        );
      case 'bkash_nagad':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-pink-950/90 text-pink-300 border border-pink-700/70 text-[10px] font-bold">
            <Smartphone className="w-2.5 h-2.5" />
            {isBn ? 'বিকাশ / নগদ' : 'bKash / Nagad'}
          </span>
        );
      case 'card':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-950/90 text-indigo-300 border border-indigo-700/70 text-[10px] font-bold">
            <CreditCard className="w-2.5 h-2.5" />
            {isBn ? 'কার্ড পিওএস' : 'Card POS'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-700/70 text-[10px] font-bold">
            <Banknote className="w-2.5 h-2.5" />
            {isBn ? 'নগদ ক্যাশ' : 'Cash'}
          </span>
        );
    }
  };

  return (
    <div data-no-translate="true" className="w-full space-y-4 text-slate-900 dark:text-slate-100">
      {/* Status Banner */}
      {statusBanner && (
        <div
          className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
            statusBanner.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
              : 'bg-rose-950/80 border-rose-700 text-rose-300'
          }`}
        >
          <span>{statusBanner.msg}</span>
          <button onClick={() => setStatusBanner(null)} className="cursor-pointer opacity-80 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOP HEADER BANNER */}
      <div className="rounded-2xl bg-[#0e1525] border border-slate-800/90 p-4 sm:p-5 shadow-lg flex flex-col xl:flex-row xl:items-center justify-between gap-4 text-white">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-400 text-[11px] font-bold">
              <FileText className="w-3 h-3" />
              {isBn
                ? 'সম্পূর্ণ ইনভয়েস বিক্রয়, ডিসকাউন্ট ও ক্যাশ কালেকশন রিপোর্ট সিস্টেম'
                : 'Complete Invoice Sales, Discount & Cash Collection Report System'}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              • {isBn ? 'ডিজিডিএ অডিট ও কাউন্টার ক্যাশ লেজার' : 'DGDA Audit & Counter Cash Ledger'}
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">
            {isBn
              ? 'ইনভয়েস ভিত্তিক বিক্রয়, ডিসকাউন্ট ও ক্যাশ কালেকশন মাস্টার লেজার'
              : 'Invoice-Wise Sales, Discount Granted & Cash Collection Master Ledger'}
          </h1>
          <p className="text-xs text-slate-400">
            {isBn
              ? 'মোট বিল, প্রদত্ত ডিসকাউন্ট, নিট বিক্রয়, নগদ আদায়, বিকাশ/কার্ড সেটেলমেন্ট এবং ক্যাটাগরি রিপোর্টের রিয়েল-টাইম হিসাব।'
              : 'Real-time invoice breakdown showing gross bill, discount granted, net sale, exact cash collected, MFS/Card settlements, and category reports.'}
          </p>
        </div>

        {/* 5 Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowCashbookModal(true)}
            className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>{isBn ? 'দৈনিক ক্যাশবুক ও ক্লোজিং' : 'Daily Cashbook & Closing'}</span>
          </button>

          <button
            type="button"
            onClick={openQuickInvoiceModal}
            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isBn ? '+ দ্রুত ইনভয়েস / ক্যাশ' : '+ Quick Invoice / Cash'}</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{isBn ? 'রিফ্রেশ' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-300" />
            <span>{isBn ? 'সিএসভি এক্সপোর্ট' : 'Export CSV'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportBranchPdfReport}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>
              {isBn ? 'বিক্রয় ও গ্রুপ পিডিএফ রিপোর্ট (শাখাসহ)' : 'Sales & Group PDF Report (With Branch Info)'}
            </span>
          </button>
        </div>
      </div>

      {/* PERIOD, BRANCH & CUSTOM RANGE FILTER BAR */}
      <div className="rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
            <span>{isBn ? 'সময়কাল নির্বাচন:' : 'Select Report Period:'}</span>
          </span>
          {(
            [
              { id: 'today', en: "Today's Sales", bn: 'আজকের বিক্রয়' },
              { id: 'yesterday', en: 'Yesterday', bn: 'গতকাল' },
              { id: 'last7', en: 'Last 7 Days', bn: 'গত ৭ দিন' },
              { id: 'month', en: 'This Month', bn: 'এই মাস' },
              { id: 'all', en: 'All History', bn: 'সকল ইতিহাস' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                period === p.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {isBn ? p.bn : p.en}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Branch Selector (RBAC-aware) */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-xs">
            <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-bold text-emerald-800 dark:text-emerald-300">
              {isBn ? 'শাখা:' : 'Branch:'}
            </span>
            <select
              disabled={!canSwitchBranch}
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent font-bold text-slate-900 dark:text-white outline-none text-xs cursor-pointer disabled:cursor-not-allowed"
            >
              {canSwitchBranch && (
                <option value="all" className="text-slate-900 dark:bg-slate-900 dark:text-white">
                  {isBn ? 'সকল শাখা (অ্যাডমিন)' : 'All Branches (Admin Only)'}
                </option>
              )}
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="text-slate-900 dark:bg-slate-900 dark:text-white">
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
            {!canSwitchBranch && <Lock className="w-3 h-3 text-slate-400" />}
          </div>

          {/* Custom Date Range */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-semibold">
              {isBn ? 'কাস্টম তারিখ:' : 'Custom Range:'}
            </span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => {
                setCustomStart(e.target.value);
                setPeriod('custom');
              }}
              className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
            />
            <span className="text-slate-400">{isBn ? 'থেকে' : 'to'}</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => {
                setCustomEnd(e.target.value);
                setPeriod('custom');
              }}
              className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* 6 MASTER KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* 1. Gross Invoice Bill */}
        <div className="rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <span>{isBn ? '১. মোট ইনভয়েস বিল' : '1. GROSS INVOICE BILL'}</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-2">
            {fmtCur(kpis.grossInvoiceBill)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
            {isBn
              ? `${fmtInt(kpis.invoiceCount)} ইনভয়েস • ${fmtInt(kpis.totalUnitsSold)} ইউনিট`
              : `${fmtInt(kpis.invoiceCount)} Invoices • ${fmtInt(kpis.totalUnitsSold)} units`}
          </div>
        </div>

        {/* 2. Total Discount Given */}
        <div className="rounded-2xl bg-white dark:bg-[#111827] border border-amber-300/70 dark:border-amber-700/60 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            <span>{isBn ? '২. মোট ডিসকাউন্ট প্রদান' : '2. TOTAL DISCOUNT GIVEN'}</span>
            <Percent className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-2">
            -{fmtCur(kpis.totalDiscountGiven)}
          </div>
          <div className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-1.5 font-medium">
            {isBn
              ? `${fmtInt(kpis.discountedInvoiceCount)} ইনভয়েসে (${fmtNum(kpis.effectiveDiscountPct, 1)}%)`
              : `Granted on ${fmtInt(kpis.discountedInvoiceCount)} invoices (${fmtNum(kpis.effectiveDiscountPct, 1)}%)`}
          </div>
        </div>

        {/* 3. Net Invoice Sales */}
        <div className="rounded-2xl bg-white dark:bg-[#111827] border border-indigo-300/70 dark:border-indigo-700/60 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            <span>{isBn ? '৩. নিট ইনভয়েস বিক্রয়' : '3. NET INVOICE SALES'}</span>
            <Banknote className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-2">
            {fmtCur(kpis.netInvoiceSales)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
            {isBn
              ? `ভ্যাট অন্তর্ভুক্ত +${fmtCur(kpis.totalVat)}`
              : `Includes +${fmtCur(kpis.totalVat)} VAT`}
          </div>
        </div>

        {/* 4. Net Cash Collection */}
        <div className="rounded-2xl bg-white dark:bg-[#111827] border border-emerald-300/70 dark:border-emerald-700/60 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            <span>{isBn ? '৪. নিট ক্যাশ কালেকশন' : '4. NET CASH COLLECTION'}</span>
            <Wallet className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-2">
            {fmtCur(kpis.netCashCollection)}
          </div>
          <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-1.5 font-medium">
            {isBn
              ? `গৃহীত: ${fmtCur(kpis.totalCashTendered)}`
              : `Tendered: ${fmtCur(kpis.totalCashTendered)}`}
            {kpis.totalChangeGiven > 0 ? ` • Chg: ${fmtCur(kpis.totalChangeGiven)}` : ''}
          </div>
        </div>

        {/* 5. MFS & Card Collection */}
        <div className="rounded-2xl bg-white dark:bg-[#111827] border border-pink-300/70 dark:border-pink-700/60 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wide text-pink-600 dark:text-pink-400">
            <span>{isBn ? '৫. এমএফএস ও কার্ড আদায়' : '5. MFS & CARD COLLECTION'}</span>
            <CreditCard className="w-4 h-4 text-pink-500" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-2">
            {fmtCur(kpis.totalMfsAndCard)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
            MFS: {fmtCur(kpis.totalMfsCollection)} • Card: {fmtCur(kpis.totalCardCollection)}
          </div>
        </div>

        {/* 6. Due & Gross Profit */}
        <div className="rounded-2xl bg-white dark:bg-[#111827] border border-rose-300/70 dark:border-rose-700/60 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            <span>{isBn ? '৬. বকেয়া ও মোট লাভ' : '6. DUE & GROSS PROFIT'}</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-end justify-between gap-2 mt-2">
            <div>
              <div className="text-[10px] font-bold text-rose-500 uppercase">
                {isBn ? 'বকেয়া:' : 'Due:'}
              </div>
              <div className="text-base font-black font-mono text-rose-500">
                {fmtCur(kpis.totalDue)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-emerald-500 uppercase">
                {isBn ? 'লাভ:' : 'Profit:'}
              </div>
              <div className="text-base font-black font-mono text-emerald-500">
                +{fmtCur(kpis.totalGrossProfit)}
              </div>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
            {isBn
              ? `মোট আদায়: ${fmtCur(kpis.totalRealizedCollection)}`
              : `Total Realized Collection: ${fmtCur(kpis.totalRealizedCollection)}`}
          </div>
        </div>
      </div>

      {/* 5 INNER SUB-TABS */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto pb-1">
        {(
          [
            {
              id: 'ledger',
              en: 'Invoice Sales, Discount & Cash Ledger',
              bn: 'ইনভয়েস, ডিসকাউন্ট ও ক্যাশ লেজার',
              count: periodInvoices.length,
              icon: FileText,
            },
            {
              id: 'audit',
              en: 'Cash Collection & Discount Audit',
              bn: 'ক্যাশ ও ডিসকাউন্ট অডিট',
              count: cashierAudit.length,
              icon: ShieldCheck,
            },
            {
              id: 'categories',
              en: 'Group / Category-Wise Sales',
              bn: 'গ্রুপ / ক্যাটাগরি বিক্রয়',
              count: categoryRows.length,
              icon: Layers,
            },
            {
              id: 'products',
              en: 'Product-Wise Sales',
              bn: 'প্রোডাক্ট ভিত্তিক বিক্রয়',
              count: productRows.length,
              icon: Pill,
            },
            {
              id: 'overview',
              en: 'Overview & Visuals',
              bn: 'সারসংক্ষেপ ও চার্ট',
              count: null,
              icon: BarChart3,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeInnerTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveInnerTab(tab.id)}
              className={`px-3.5 py-2 rounded-t-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer border-b-2 transition ${
                isActive
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/30'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{isBn ? tab.bn : tab.en}</span>
              {tab.count !== null && (
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold ${
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {fmtInt(tab.count)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: INVOICE SALES, DISCOUNT & CASH LEDGER                      */}
      {/* ===================================================================== */}
      {activeInnerTab === 'ledger' && (
        <div className="space-y-3">
          {/* Search + Payment Filter Pills */}
          <div className="rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isBn
                    ? 'ইনভয়েস নম্বর, গ্রাহক, ফোন, ক্যাশিয়ার অথবা ওষুধ দিয়ে খুঁজুন...'
                    : 'Search invoice #, customer, phone, cashier or medicine...'
                }
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { id: 'all', en: 'All Invoices', bn: 'সকল ইনভয়েস' },
                  { id: 'discounted', en: 'Discounted Only', bn: 'ডিসকাউন্টকৃত' },
                  { id: 'cash', en: 'Cash Only', bn: 'শুধু ক্যাশ' },
                  { id: 'bkash_nagad', en: 'bKash / Nagad', bn: 'বিকাশ / নগদ' },
                  { id: 'card', en: 'Card POS', bn: 'কার্ড পিওএস' },
                  { id: 'split', en: 'Split Pay', bn: 'স্প্লিট পে' },
                  { id: 'due_credit', en: 'Due / Credit', bn: 'বাকি / ক্রেডিট' },
                ] as const
              ).map((pf) => (
                <button
                  key={pf.id}
                  onClick={() => setPaymentFilter(pf.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                    paymentFilter === pf.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {isBn ? pf.bn : pf.en}
                </button>
              ))}
            </div>
          </div>

          {/* Master Ledger Table */}
          <div className="rounded-2xl bg-white dark:bg-[#0e1525] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#131c2e] border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4">{isBn ? 'ইনভয়েস ও সময়' : 'Invoice # & Time'}</th>
                    <th className="py-3 px-3">{isBn ? 'গ্রাহক ও ক্যাশিয়ার' : 'Customer & Cashier'}</th>
                    <th className="py-3 px-3 min-w-[300px]">{isBn ? 'বিক্রিত ওষুধসমূহ' : 'Sold Medicines'}</th>
                    <th className="py-3 px-3 text-right">{isBn ? 'মোট বিল' : 'Gross Bill'}</th>
                    <th className="py-3 px-3 text-right">{isBn ? 'ডিসকাউন্ট' : 'Discount Given'}</th>
                    <th className="py-3 px-3 text-right">{isBn ? 'ভ্যাট' : 'VAT'}</th>
                    <th className="py-3 px-3 text-right">{isBn ? 'নিট বিক্রয়' : 'Net Sale Amount'}</th>
                    <th className="py-3 px-3 text-right">{isBn ? 'নগদ আদায়' : 'Cash Collected'}</th>
                    <th className="py-3 px-3 text-right">{isBn ? 'এমএফএস / কার্ড' : 'MFS / Card'}</th>
                    <th className="py-3 px-3 text-right">{isBn ? 'বকেয়া' : 'Due'}</th>
                    <th className="py-3 px-4 text-center">{isBn ? 'অ্যাকশন' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                  {ledgerInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-14 text-center text-slate-400">
                        <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <div className="font-bold text-sm">
                          {isBn
                            ? 'নির্বাচিত সময় ও ফিল্টারে কোনো ইনভয়েস পাওয়া যায়নি'
                            : 'No invoices found for the selected period & filter'}
                        </div>
                        <div className="text-xs mt-1">
                          {isBn
                            ? 'সময়কাল পরিবর্তন করুন অথবা "+ দ্রুত ইনভয়েস / ক্যাশ" থেকে নতুন বিক্রয় তৈরি করুন।'
                            : 'Try changing the report period above or create one via "+ Quick Invoice / Cash".'}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    ledgerInvoices.map((inv) => {
                      const timeStr = new Date(inv.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <tr
                          key={inv.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors align-top"
                        >
                          {/* Invoice # & Time + Branch + Mode */}
                          <td className="py-3.5 px-4 space-y-1.5">
                            <div className="font-mono font-extrabold text-slate-900 dark:text-white text-xs">
                              {inv.invoiceNumber}
                            </div>
                            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/70">
                              <Building2 className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[165px]">
                                {inv.branchName} [{inv.branchCode}]
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              <span>
                                {inv.date} {timeStr}
                              </span>
                            </div>
                            <div>{renderModeBadge(inv)}</div>
                          </td>

                          {/* Customer & Cashier */}
                          <td className="py-3.5 px-3 space-y-1">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {inv.customerName}
                            </div>
                            {inv.customerPhone && (
                              <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                {inv.customerPhone}
                              </div>
                            )}
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 pt-0.5">
                              <UserCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span>
                                {isBn ? 'ক্যাশিয়ার: ' : 'By: '}
                                <strong className="text-slate-700 dark:text-slate-300">
                                  {inv.cashierName}
                                </strong>
                              </span>
                            </div>
                          </td>

                          {/* Sold Medicines Embedded Mini-Table */}
                          <td className="py-3 px-3">
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0b101b] overflow-hidden">
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="border-b border-slate-200 dark:border-slate-800/90 text-[10px] text-slate-400 font-semibold">
                                    <th className="py-1.5 px-2.5 text-left">
                                      {isBn ? 'ওষুধ ও ব্যাচ' : 'Medicine & Batch'}
                                    </th>
                                    <th className="py-1.5 px-2 text-right">{isBn ? 'সংখ্যা' : 'Qty'}</th>
                                    <th className="py-1.5 px-2 text-right">{isBn ? 'দর' : 'Rate'}</th>
                                    <th className="py-1.5 px-2.5 text-right">{isBn ? 'মোট' : 'Total'}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/60">
                                  {inv.items.map((it, iIdx) => (
                                    <tr key={iIdx}>
                                      <td className="py-1.5 px-2.5">
                                        <div className="font-bold text-slate-800 dark:text-slate-100">
                                          {it.medicineName}
                                        </div>
                                        <div className="text-[9px] font-mono text-slate-400">
                                          Batch: {it.batchNumber}
                                          {it.expiryDate ? ` • Exp: ${it.expiryDate}` : ''}
                                        </div>
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                        ×{fmtInt(it.qty)}
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-mono text-slate-600 dark:text-slate-300">
                                        {fmtCur(it.unitRate)}
                                      </td>
                                      <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                                        {fmtCur(it.lineNet)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <div className="px-2.5 py-1 bg-slate-100/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px]">
                                <span className="text-slate-500 dark:text-slate-400 font-semibold">
                                  {fmtInt(inv.items.length)}{' '}
                                  {isBn ? 'টি ওষুধ' : 'Medicine(s)'}
                                </span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {isBn
                                    ? `মোট: ${fmtInt(inv.totalUnits)} ইউনিট`
                                    : `Total: ${fmtInt(inv.totalUnits)} Units`}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Gross Bill */}
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {fmtCur(inv.grossBill)}
                          </td>

                          {/* Discount Given */}
                          <td className="py-3.5 px-3 text-right font-mono whitespace-nowrap">
                            {inv.discountGiven > 0 ? (
                              <div>
                                <div className="font-bold text-amber-600 dark:text-amber-400">
                                  -{fmtCur(inv.discountGiven)}
                                </div>
                                <div className="text-[10px] text-amber-600/80 dark:text-amber-300/80">
                                  ({fmtNum(inv.discountPercent, 1)}% off)
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400">৳0.00</span>
                            )}
                          </td>

                          {/* VAT */}
                          <td className="py-3.5 px-3 text-right font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            +{fmtCur(inv.vatAmount)}
                          </td>

                          {/* Net Sale Amount + Profit */}
                          <td className="py-3.5 px-3 text-right font-mono whitespace-nowrap">
                            <div className="font-extrabold text-indigo-600 dark:text-indigo-400">
                              {fmtCur(inv.netSale)}
                            </div>
                            <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              {isBn ? 'লাভ: ' : 'Profit: '}+{fmtCur(inv.grossProfit)}
                            </div>
                          </td>

                          {/* Cash Collected */}
                          <td className="py-3.5 px-3 text-right font-mono whitespace-nowrap">
                            <div
                              className={`font-extrabold ${
                                inv.cashCollected > 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {fmtCur(inv.cashCollected)}
                            </div>
                            {inv.changeGiven > 0 && (
                              <div className="text-[9px] text-slate-400">
                                Rec: {fmtCur(inv.cashTendered)} | Chg: {fmtCur(inv.changeGiven)}
                              </div>
                            )}
                          </td>

                          {/* MFS / Card */}
                          <td className="py-3.5 px-3 text-right font-mono whitespace-nowrap">
                            <div
                              className={`font-extrabold ${
                                inv.mfsOrCardTotal > 0
                                  ? 'text-pink-600 dark:text-pink-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {fmtCur(inv.mfsOrCardTotal)}
                            </div>
                            {inv.mfsOrCardRef && (
                              <div className="text-[9px] text-slate-400">{inv.mfsOrCardRef}</div>
                            )}
                          </td>

                          {/* Due + Collect Cash CTA */}
                          <td className="py-3.5 px-3 text-right font-mono whitespace-nowrap">
                            {inv.dueAmount <= 0.009 ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                                {isBn ? 'পরিশোধিত' : 'Paid'}
                              </span>
                            ) : (
                              <div className="flex flex-col items-end gap-1">
                                <span className="font-extrabold text-rose-500">
                                  {fmtCur(inv.dueAmount)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCollectDueTarget(inv);
                                    setDuePayAmount(inv.dueAmount);
                                    setDuePayMethod('cash');
                                    setDuePayTrxRef('');
                                  }}
                                  className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-xs transition"
                                >
                                  <Check className="w-2.5 h-2.5" />
                                  <span>{isBn ? 'ক্যাশ আদায়' : 'Collect Cash'}</span>
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Action: Receipt */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setReceiptInvoice(inv)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white border border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition"
                            >
                              <Printer className="w-3 h-3" />
                              <span>{isBn ? 'রসিদ' : 'Receipt'}</span>
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
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: CASH COLLECTION & DISCOUNT AUDIT                           */}
      {/* ===================================================================== */}
      {activeInnerTab === 'audit' && (
        <div className="space-y-4">
          {/* Payment Channel Reconciliation Matrix */}
          <div className="rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
            <h3 className="text-sm font-extrabold flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-500" />
              <span>
                {isBn
                  ? 'পেমেন্ট চ্যানেল ভিত্তিক ক্যাশ ও সেটেলমেন্ট মিলকরণ ম্যাট্রিক্স'
                  : 'Payment Channel Cash & Digital Reconciliation Matrix'}
              </span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase text-slate-500 font-bold">
                    <th className="py-2 px-3">{isBn ? 'চ্যানেল' : 'Channel'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'ইনভয়েস' : 'Invoices'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'মোট বিল' : 'Gross Bill'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'ডিসকাউন্ট' : 'Discount'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'নিট বিক্রয়' : 'Net Sales'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'গৃহীত ক্যাশ' : 'Tendered'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'ফেরত টাকা' : 'Change'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'নিট নগদ' : 'Cash Retained'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'ডিজিটাল/কার্ড' : 'MFS / Card'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'বকেয়া' : 'Due'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'আদায় %' : 'Realized %'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {channelMatrix.map((row) => (
                    <tr key={row.mode} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2.5 px-3 font-bold">{isBn ? row.labelBn : row.labelEn}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{fmtInt(row.invoiceCount)}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{fmtCur(row.grossBill)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-500">-{fmtCur(row.discountGiven)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-500">{fmtCur(row.netSales)}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{fmtCur(row.cashTendered)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">{fmtCur(row.changeGiven)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-500">{fmtCur(row.cashRetained)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-pink-500">{fmtCur(row.digitalSettled)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-500">{fmtCur(row.duePending)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">{fmtNum(row.realizationPct, 1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cashier Discount & Cash Control Audit */}
          <div className="rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
            <h3 className="text-sm font-extrabold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <span>
                {isBn
                  ? 'ক্যাশিয়ার ভিত্তিক ডিসকাউন্ট ও ক্যাশ কালেকশন অডিট'
                  : 'Cashier Discount & Counter Cash Control Audit'}
              </span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase text-slate-500 font-bold">
                    <th className="py-2 px-3">{isBn ? 'ক্যাশিয়ার / ফার্মাসিস্ট' : 'Cashier / Pharmacist'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'ইনভয়েস' : 'Invoices'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'মোট বিল' : 'Gross Bill'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'ডিসকাউন্ট প্রদান' : 'Discount Given'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'গড় %' : 'Avg %'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'সর্বোচ্চ %' : 'Max %'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'নগদ আদায়' : 'Cash Collected'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'এমএফএস/কার্ড' : 'MFS / Card'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'বকেয়া' : 'Due Issued'}</th>
                    <th className="py-2 px-3 text-center">{isBn ? 'অডিট স্ট্যাটাস' : 'Audit Flag'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cashierAudit.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-6 text-center text-slate-400">
                        {isBn ? 'কোনো ক্যাশিয়ার অডিট তথ্য নেই' : 'No cashier activity in selected period'}
                      </td>
                    </tr>
                  ) : (
                    cashierAudit.map((c) => (
                      <tr key={c.cashierName} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                        <td className="py-2.5 px-3 font-bold">{c.cashierName}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{fmtInt(c.invoiceCount)}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{fmtCur(c.grossBill)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-500">-{fmtCur(c.discountGiven)}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{fmtNum(c.avgDiscountPct, 1)}%</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">{fmtNum(c.maxDiscountPct, 1)}%</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-500">{fmtCur(c.cashCollected)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-pink-500">{fmtCur(c.mfsAndCardCollected)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-500">{fmtCur(c.dueIssued)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              c.flagLevel === 'high_alert'
                                ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                : c.flagLevel === 'review'
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {c.flagLevel === 'high_alert'
                              ? isBn
                                ? 'উচ্চ সতর্কতা'
                                : 'High Alert'
                              : c.flagLevel === 'review'
                              ? isBn
                                ? 'পর্যালোচনা'
                                : 'Review'
                              : isBn
                              ? 'স্বাভাবিক'
                              : 'Normal'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3: GROUP / CATEGORY-WISE SALES                                */}
      {/* ===================================================================== */}
      {activeInnerTab === 'categories' && (
        <div className="rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-extrabold flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-500" />
              <span>
                {isBn
                  ? 'থেরাপিউটিক গ্রুপ / ক্যাটাগরি ভিত্তিক বিক্রয় ও লাভ বিশ্লেষণ'
                  : 'Group / Therapeutic Category-Wise Sales & Margin Breakdown'}
              </span>
            </h3>
            <span className="text-[11px] text-slate-400">
              {isBn
                ? 'ইনভয়েস ডিসকাউন্ট প্রতিটি ক্যাটাগরিতে অনুপাত অনুযায়ী সমন্বিত'
                : 'Invoice-level discounts allocated pro-rata across item net weights'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase text-slate-500 font-bold">
                  <th className="py-2.5 px-3">{isBn ? 'ক্যাটাগরি' : 'Category / Group'}</th>
                  <th className="py-2.5 px-3 text-right">{isBn ? 'ইনভয়েস' : 'Invoices'}</th>
                  <th className="py-2.5 px-3 text-right">{isBn ? 'ইউনিট' : 'Units'}</th>
                  <th className="py-2.5 px-3 text-right">{isBn ? 'মোট বিক্রয়' : 'Gross Sales'}</th>
                  <th className="py-2.5 px-3 text-right">{isBn ? 'ডিসকাউন্ট' : 'Discount'}</th>
                  <th className="py-2.5 px-3 text-right">{isBn ? 'নিট বিক্রয়' : 'Net Sales'}</th>
                  <th className="py-2.5 px-3 text-right">{isBn ? 'ক্রয় খরচ' : 'COGS'}</th>
                  <th className="py-2.5 px-3 text-right">{isBn ? 'লাভ' : 'Gross Profit'}</th>
                  <th className="py-2.5 px-3 text-right">{isBn ? 'মার্জিন %' : 'Margin %'}</th>
                  <th className="py-2.5 px-3 min-w-[140px]">{isBn ? 'শেয়ার %' : 'Revenue Share'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {categoryRows.map((c) => (
                  <tr key={c.category} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td className="py-2.5 px-3 font-bold">{c.category}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{fmtInt(c.invoiceCount)}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{fmtInt(c.unitsSold)}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{fmtCur(c.grossSales)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-500">-{fmtCur(c.discountGiven)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-500">{fmtCur(c.netSales)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">{fmtCur(c.cogs)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-500">+{fmtCur(c.grossProfit)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">{fmtNum(c.marginPct, 1)}%</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.min(100, c.sharePct)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] font-bold w-11 text-right">
                          {fmtNum(c.sharePct, 1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {categoryRows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-slate-900/80 border-t-2 border-slate-300 dark:border-slate-700 font-extrabold">
                    <td className="py-2.5 px-3">{isBn ? 'সর্বমোট (ট্যাক্স বাদে)' : 'TOTAL (Pre-Tax)'}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{fmtInt(kpis.invoiceCount)}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{fmtInt(kpis.totalUnitsSold)}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{fmtCur(categoryRows.reduce((s, r) => s + r.grossSales, 0))}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-500">-{fmtCur(categoryRows.reduce((s, r) => s + r.discountGiven, 0))}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-indigo-500">{fmtCur(categoryRows.reduce((s, r) => s + r.netSales, 0))}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{fmtCur(categoryRows.reduce((s, r) => s + r.cogs, 0))}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-500">+{fmtCur(categoryRows.reduce((s, r) => s + r.grossProfit, 0))}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{fmtNum(kpis.avgMarginPct, 1)}%</td>
                    <td className="py-2.5 px-3 text-right font-mono">100.0%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 4: PRODUCT-WISE SALES                                         */}
      {/* ===================================================================== */}
      {activeInnerTab === 'products' && (
        <div className="rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={prodSearch}
                onChange={(e) => setProdSearch(e.target.value)}
                placeholder={isBn ? 'ওষুধের নাম বা জেনেরিক খুঁজুন...' : 'Filter sold medicines by name, generic or group...'}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500 font-semibold">{isBn ? 'সাজান:' : 'Sort by:'}</span>
              <select
                value={prodSortKey}
                onChange={(e) => setProdSortKey(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
              >
                <option value="netSales">{isBn ? 'নিট বিক্রয়' : 'Net Sales'}</option>
                <option value="qtySold">{isBn ? 'বিক্রিত পরিমাণ' : 'Quantity Sold'}</option>
                <option value="grossProfit">{isBn ? 'মোট লাভ' : 'Gross Profit'}</option>
                <option value="marginPct">{isBn ? 'মার্জিন %' : 'Margin %'}</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase text-slate-500 font-bold">
                  <th className="py-2.5 px-3">{isBn ? 'ওষুধ ও জেনেরিক' : 'Product & Generic'}</th>
                  <th className="py-2.5 px-3">{isBn ? 'ক্যাটাগরি' : 'Category'}</th>
                  <th className="py-2.5 px-3">{isBn ? 'ব্যাচসমূহ' : 'Batches Used'}</th>
                  <th className="py-2.5 px-3 text-right">{isBn ? 'পরিমাণ' : 'Qty Sold'}</th>
                  <th className="py-2.5 px-3 text-right">{isBn ? 'গড় দর' : 'Avg Rate'}</th>
                  <th className="py-2.5 px-3 text-right">{isBn ? 'মোট বিক্রয়' : 'Gross'}</th>
                  <th className="py-2.5 px-3 text-right">{isBn ? 'ডিসকাউন্ট' : 'Discount'}</th>
                  <th className="py-2.5 px-3 text-right">{isBn ? 'নিট বিক্রয়' : 'Net Sales'}</th>
                  <th className="py-2.5 px-3 text-right">{isBn ? 'লাভ' : 'Profit'}</th>
                  <th className="py-2.5 px-3 text-right">{isBn ? 'মার্জিন %' : 'Margin'}</th>
                  <th className="py-2.5 px-3 text-right">{isBn ? 'বর্তমান স্টক' : 'Stock'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredProductRows.map((p) => (
                  <tr key={p.medicineKey} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td className="py-2.5 px-3">
                      <div className="font-bold">{p.medicineName}</div>
                      {p.genericName && <div className="text-[10px] text-slate-400">{p.genericName}</div>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{p.category}</td>
                    <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">
                      {p.batchesUsed.join(', ') || 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-500">{fmtInt(p.qtySold)}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{fmtCur(p.avgRate)}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{fmtCur(p.grossSales)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-500">-{fmtCur(p.discountGiven)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-500">{fmtCur(p.netSales)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-500">+{fmtCur(p.grossProfit)}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{fmtNum(p.marginPct, 1)}%</td>
                    <td className="py-2.5 px-3 text-right font-mono">{fmtInt(p.currentStock)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 5: OVERVIEW & VISUALS                                         */}
      {/* ===================================================================== */}
      {activeInnerTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Daily Gross vs Net vs Cash Bar Chart */}
            <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
              <h3 className="text-sm font-extrabold mb-3">
                {isBn
                  ? 'দৈনিক মোট বিল বনাম নিট বিক্রয় ও ক্যাশ কালেকশন'
                  : 'Daily Gross Bill vs Net Sales vs Cash Collection'}
              </h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="gross" name={isBn ? 'মোট বিল' : 'Gross Bill'} fill="#64748b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="net" name={isBn ? 'নিট বিক্রয়' : 'Net Sales'} fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cash" name={isBn ? 'ক্যাশ আদায়' : 'Cash Collected'} fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Payment Method Mix Donut */}
            <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
              <h3 className="text-sm font-extrabold mb-3">
                {isBn ? 'কালেকশন মাধ্যম বিভাজন' : 'Collection Channel Mix'}
              </h3>
              <div className="h-72 w-full">
                {paymentPieData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    {isBn ? 'কোনো পেমেন্ট তথ্য নেই' : 'No collection data in period'}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentPieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {paymentPieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Branch Comparison Table */}
          <div className="rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
            <h3 className="text-sm font-extrabold mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-500" />
              <span>{isBn ? 'শাখা ভিত্তিক বিক্রয় ও ক্যাশ তুলনা' : 'Branch-Wise Sales & Cash Comparison'}</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase text-slate-500 font-bold">
                    <th className="py-2 px-3">{isBn ? 'শাখা' : 'Branch'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'ইনভয়েস' : 'Invoices'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'ইউনিট' : 'Units'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'মোট বিল' : 'Gross'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'ডিসকাউন্ট' : 'Discount'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'নিট বিক্রয়' : 'Net Sales'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'ক্যাশ' : 'Cash'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'এমএফএস/কার্ড' : 'MFS/Card'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'বকেয়া' : 'Due'}</th>
                    <th className="py-2 px-3 text-right">{isBn ? 'লাভ' : 'Profit'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {branchComparison.map((br) => (
                    <tr key={br.branchId} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2.5 px-3 font-bold">
                        {br.branchName} <span className="text-xs font-mono text-slate-400">[{br.branchCode}]</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{fmtInt(br.invoiceCount)}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{fmtInt(br.unitsSold)}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{fmtCur(br.grossBill)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-500">-{fmtCur(br.discountGiven)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-500">{fmtCur(br.netSales)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-500">{fmtCur(br.cashCollected)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-pink-500">{fmtCur(br.mfsAndCard)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-500">{fmtCur(br.dueAmount)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-500">+{fmtCur(br.grossProfit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: COLLECT DUE CASH MODAL                                       */}
      {/* ===================================================================== */}
      {collectDueTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">
                  {isBn ? 'বকেয়া বিল আদায় (Collect Due Cash)' : 'Collect Due Balance'}
                </h3>
                <p className="text-xs text-emerald-400 mt-0.5 font-mono">
                  {collectDueTarget.invoiceNumber} • {collectDueTarget.customerName}
                </p>
              </div>
              <button onClick={() => setCollectDueTarget(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCollectDue} className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center justify-between">
                <span className="font-bold text-rose-700 dark:text-rose-300">
                  {isBn ? 'অবশিষ্ট বকেয়া:' : 'Outstanding Invoice Due:'}
                </span>
                <span className="font-mono text-base font-black text-rose-600 dark:text-rose-400">
                  {fmtCur(collectDueTarget.dueAmount)}
                </span>
              </div>

              <div>
                <label className="block font-bold mb-1">
                  {isBn ? 'আদায়কৃত টাকার পরিমাণ (৳) *' : 'Amount Collecting Now (৳) *'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={collectDueTarget.dueAmount}
                  required
                  value={duePayAmount}
                  onChange={(e) => setDuePayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-sm font-bold"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">
                  {isBn ? 'আদায়ের মাধ্যম' : 'Settlement Method'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'cash', en: 'Cash', bn: 'নগদ ক্যাশ' },
                      { id: 'bkash_nagad', en: 'bKash / Nagad', bn: 'বিকাশ / নগদ' },
                      { id: 'card', en: 'Card POS', bn: 'কার্ড' },
                    ] as const
                  ).map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setDuePayMethod(m.id)}
                      className={`py-2 px-2 rounded-xl font-bold border cursor-pointer transition ${
                        duePayMethod === m.id
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {isBn ? m.bn : m.en}
                    </button>
                  ))}
                </div>
              </div>

              {duePayMethod !== 'cash' && (
                <div>
                  <label className="block font-bold mb-1">
                    {isBn ? 'ট্রানজেকশন / অথ কোড' : 'Transaction / Auth Reference'}
                  </label>
                  <input
                    type="text"
                    value={duePayTrxRef}
                    onChange={(e) => setDuePayTrxRef(e.target.value)}
                    placeholder="e.g. BK-881209"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs"
                  />
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCollectDueTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isCollectingDue}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  {isCollectingDue
                    ? isBn
                      ? 'সংরক্ষণ হচ্ছে...'
                      : 'Processing...'
                    : isBn
                    ? '✓ আদায় নিশ্চিত করুন'
                    : '✓ Confirm Collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: DAILY CASHBOOK & SHIFT CLOSING MODAL                         */}
      {/* ===================================================================== */}
      {showCashbookModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-amber-400" />
                  <span>{isBn ? 'দৈনিক ক্যাশবুক ও শিফট ক্লোজিং' : 'Daily Cashbook & Drawer Closing'}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedBranchId === 'all'
                    ? 'Consolidated Drawer'
                    : branches.find((b) => b.id === selectedBranchId)?.name || 'Counter Drawer'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCashbookModal(false);
                      onNavigateTab('cashbook_expenses');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer transition"
                  >
                    {isBn ? 'সম্পূর্ণ ক্যাশবুক খুলুন' : 'Open Full Cashbook & Expenses'}
                  </button>
                )}
                <button onClick={() => setShowCashbookModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">
                    {isBn ? 'প্রারম্ভিক ক্যাশ ফ্লোট (৳)' : 'Opening Float (৳)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">
                    {isBn ? 'বাস্তব ক্যাশ গণনা (৳)' : 'Physical Cash Counted (৳)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={physicalCounted}
                    onChange={(e) => setPhysicalCounted(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border-2 border-emerald-500 bg-white dark:bg-slate-800 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">{isBn ? '(+) প্রারম্ভিক ফ্লোট' : '(+) Opening Float'}</span>
                  <span className="font-mono font-bold">{fmtCur(cashbookSummary.openingFloat)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-600">{isBn ? '(+) বিক্রয় থেকে নগদ আদায়' : '(+) Net Cash Sales Collected'}</span>
                  <span className="font-mono font-bold text-emerald-600">+{fmtCur(cashbookSummary.cashSalesCollected)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-600">{isBn ? '(+) পূর্বের বকেয়া নগদ আদায়' : '(+) Prior Due Cash Collected'}</span>
                  <span className="font-mono font-bold text-emerald-600">+{fmtCur(cashbookSummary.dueCashCollectedInPeriod)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rose-500">{isBn ? '(-) নগদ রিটার্ন / ফেরত' : '(-) Cash Sales Returns'}</span>
                  <span className="font-mono font-bold text-rose-500">-{fmtCur(cashbookSummary.cashReturnsRefunded)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rose-500">{isBn ? '(-) নগদ পরিচালন খরচ' : '(-) Cash Operating Expenses'}</span>
                  <span className="font-mono font-bold text-rose-500">-{fmtCur(cashbookSummary.cashExpenses)}</span>
                </div>
                <div className="pt-2 border-t border-slate-300 dark:border-slate-700 flex justify-between text-sm font-black">
                  <span>{isBn ? '= প্রত্যাশিত ড্রয়ার ক্যাশ' : '= Expected Drawer Cash'}</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">
                    {fmtCur(cashbookSummary.expectedDrawerCash)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="font-bold">{isBn ? 'ক্যাশ ভ্যারিয়েন্স (পার্থক্য)' : 'Cash Drawer Variance'}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-mono font-black ${
                      cashbookSummary.status === 'balanced'
                        ? 'bg-emerald-100 text-emerald-700'
                        : cashbookSummary.status === 'surplus'
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {cashbookSummary.variance >= 0 ? '+' : ''}
                    {fmtCur(cashbookSummary.variance)} ({cashbookSummary.status.toUpperCase()})
                  </span>
                </div>
              </div>

              <input
                type="text"
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder={isBn ? 'শিফট ক্লোজিং মন্তব্য (ঐচ্ছিক)...' : 'Closing remarks / handover notes...'}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              />

              {closingHistory.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-bold text-[11px] text-slate-500 uppercase">
                    {isBn ? 'সাম্প্রতিক শিফট ক্লোজিং ইতিহাস' : 'Recent Shift Closings'}
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {closingHistory.slice(0, 4).map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 text-[11px]"
                      >
                        <span className="font-mono">
                          {h.date} • {h.closedBy}
                        </span>
                        <span className="font-mono font-bold">
                          {fmtCur(h.physicalCounted)} ({h.status})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCashbookModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  {isBn ? 'বন্ধ করুন' : 'Close'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveCashbookClosing}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
                >
                  {isBn ? '✓ শিফট ক্লোজিং সংরক্ষণ করুন' : '✓ Confirm & Save Shift Closing'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: QUICK INVOICE / CASH MODAL                                   */}
      {/* ===================================================================== */}
      {showQuickInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">
                  {isBn ? 'দ্রুত ইনভয়েস ও ক্যাশ এন্ট্রি' : 'Quick Counter Invoice & Cash Entry'}
                </h3>
                <p className="text-xs text-indigo-400 mt-0.5">
                  {isBn ? 'তাৎক্ষণিক কাউন্টার বিলিং ও ক্যাশ লেজার আপডেট' : 'Instant invoice creation synced to Neon DB & FEFO stock'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {onOpenFullPos && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickInvoiceModal(false);
                      onOpenFullPos();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[11px] font-bold cursor-pointer"
                  >
                    {isBn ? 'পূর্ণ পিওএস খুলুন' : 'Open Full POS'}
                  </button>
                )}
                <button onClick={() => setShowQuickInvoiceModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveQuickInvoice} className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold mb-1">{isBn ? 'গ্রাহকের নাম' : 'Customer Name'}</label>
                  <input
                    type="text"
                    value={qiCustomerName}
                    onChange={(e) => setQiCustomerName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{isBn ? 'মোবাইল নম্বর' : 'Customer Phone'}</label>
                  <input
                    type="text"
                    value={qiCustomerPhone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setQiCustomerPhone(val);
                      const found = customers.find((c) => c.phone && val && c.phone.includes(val));
                      if (found) {
                        setQiCustomerId(found.id);
                        setQiCustomerName(found.name);
                      }
                    }}
                    placeholder="017..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{isBn ? 'শাখা' : 'Branch'}</label>
                  <select
                    value={qiBranchId}
                    onChange={(e) => setQiBranchId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Medicines Line Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold uppercase text-[11px]">
                    {isBn ? 'ওষুধের তালিকা' : 'Medicines / Line Items'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const m = medicines[0];
                      if (!m) return;
                      const fefo = PharmacyService.getFefoBatchForMedicine(m.id);
                      const rate = Number(fefo.batch?.sellingPrice || m.sellingPrice || m.mrp || 10);
                      setQiRows([...qiRows, { medicineId: m.id, qty: 1, rate }]);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isBn ? 'ওষুধ যোগ করুন' : 'Add Item'}</span>
                  </button>
                </div>

                {qiRows.length === 0 ? (
                  <div className="p-4 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400">
                    {isBn ? 'ইনভেন্টরিতে কোনো ওষুধ পাওয়া যায়নি।' : 'No medicines registered in catalog yet.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {qiRows.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <select
                          value={row.medicineId}
                          onChange={(e) => {
                            const id = e.target.value;
                            const m = medicines.find((x) => x.id === id);
                            const fefo = PharmacyService.getFefoBatchForMedicine(id);
                            const rate = Number(fefo.batch?.sellingPrice || m?.sellingPrice || m?.mrp || 10);
                            setQiRows(qiRows.map((r, i) => (i === idx ? { ...r, medicineId: id, rate } : r)));
                          }}
                          className="col-span-6 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                        >
                          {medicines.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.strength})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={row.qty}
                          onChange={(e) =>
                            setQiRows(
                              qiRows.map((r, i) =>
                                i === idx ? { ...r, qty: parseInt(e.target.value, 10) || 1 } : r
                              )
                            )
                          }
                          className="col-span-2 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-right"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={row.rate}
                          onChange={(e) =>
                            setQiRows(
                              qiRows.map((r, i) =>
                                i === idx ? { ...r, rate: parseFloat(e.target.value) || 0 } : r
                              )
                            )
                          }
                          className="col-span-3 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-right"
                        />
                        <button
                          type="button"
                          onClick={() => setQiRows(qiRows.filter((_, i) => i !== idx))}
                          className="col-span-1 text-rose-500 hover:text-rose-400 flex justify-center cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Discount, VAT & Payment Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block font-bold mb-1">{isBn ? 'ডিসকাউন্ট' : 'Discount'}</label>
                  <div className="flex gap-1">
                    <select
                      value={qiDiscountType}
                      onChange={(e) => setQiDiscountType(e.target.value as 'pct' | 'flat')}
                      className="px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                    >
                      <option value="pct">%</option>
                      <option value="flat">৳</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={qiDiscountVal}
                      onChange={(e) => setQiDiscountVal(parseFloat(e.target.value) || 0)}
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-bold mb-1">{isBn ? 'ভ্যাট (%)' : 'VAT (%)'}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={qiVatPct}
                    onChange={(e) => setQiVatPct(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{isBn ? 'পেমেন্ট মাধ্যম' : 'Payment Mode'}</label>
                  <select
                    value={qiPaymentMode}
                    onChange={(e) => setQiPaymentMode(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                  >
                    <option value="cash">{isBn ? 'নগদ ক্যাশ' : 'Cash'}</option>
                    <option value="bkash_nagad">{isBn ? 'বিকাশ / নগদ' : 'bKash / Nagad'}</option>
                    <option value="card">{isBn ? 'কার্ড পিওএস' : 'Card POS'}</option>
                    <option value="split">{isBn ? 'স্প্লিট পে' : 'Split Pay'}</option>
                    <option value="due_credit">{isBn ? 'বাকি / ক্রেডিট' : 'Due / Credit'}</option>
                  </select>
                </div>
              </div>

              {qiPaymentMode === 'cash' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">{isBn ? 'গৃহীত নগদ (৳)' : 'Cash Tendered (৳)'}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={qiTendered}
                      onChange={(e) => setQiTendered(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex justify-between font-mono font-bold text-emerald-700 dark:text-emerald-300">
                      <span>{isBn ? 'ফেরত:' : 'Change:'}</span>
                      <span>{fmtCur(Math.max(0, qiTendered - qiGrandTotal))}</span>
                    </div>
                  </div>
                </div>
              )}

              {qiPaymentMode === 'split' && (
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold mb-1">Cash (৳)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={qiSplitCash}
                      onChange={(e) => setQiSplitCash(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold mb-1">MFS (৳)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={qiSplitMfs}
                      onChange={(e) => setQiSplitMfs(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold mb-1">Card (৳)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={qiSplitCard}
                      onChange={(e) => setQiSplitCard(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold mb-1">Trx Ref</label>
                    <input
                      type="text"
                      value={qiTrxRef}
                      onChange={(e) => setQiTrxRef(e.target.value)}
                      placeholder="BKS-..."
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>
                </div>
              )}

              {(qiPaymentMode === 'bkash_nagad' || qiPaymentMode === 'card') && (
                <div>
                  <label className="block font-bold mb-1">
                    {isBn ? 'ট্রানজেকশন / অথ কোড' : 'Transaction / Approval Reference'}
                  </label>
                  <input
                    type="text"
                    value={qiTrxRef}
                    onChange={(e) => setQiTrxRef(e.target.value)}
                    placeholder="e.g. TRX-90481"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
                <div className="text-xs space-x-3 font-mono">
                  <span>Gross: {fmtCur(qiGross)}</span>
                  <span className="text-amber-500">Disc: -{fmtCur(qiDiscountAmt)}</span>
                  <span className="font-black text-sm text-emerald-500">Net: {fmtCur(qiGrandTotal)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickInvoiceModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                  >
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingQuickInv || qiRows.length === 0}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    {isSavingQuickInv
                      ? isBn
                        ? 'সংরক্ষণ হচ্ছে...'
                        : 'Saving...'
                      : isBn
                      ? '✓ ইনভয়েস ও ক্যাশ সেভ করুন'
                      : '✓ Issue Invoice & Record Cash'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: THERMAL RECEIPT MODAL                                        */}
      {/* ===================================================================== */}
      {receiptInvoice && (
        <ThermalReceiptModal
          isOpen={Boolean(receiptInvoice)}
          onClose={() => setReceiptInvoice(null)}
          cart={receiptInvoice.items.map((it, idx) => ({
            id: idx + 1,
            medicineId: it.medicineId,
            name: it.medicineName,
            sub: it.genericName,
            company: it.manufacturer,
            batch: it.batchNumber,
            exp: it.expiryDate,
            price: it.unitRate,
            purchasePrice: it.unitCost,
            qty: it.qty,
            disc: it.lineGross > 0 ? Number(((it.itemDiscount / it.lineGross) * 100).toFixed(1)) : 0,
          }))}
          subtotal={receiptInvoice.grossBill}
          discount={receiptInvoice.discountGiven}
          tax={receiptInvoice.vatAmount}
          grandTotal={receiptInvoice.netSale}
          orderNumber={receiptInvoice.invoiceNumber}
          isBengaliDefault={isBn}
          tenderedAmount={receiptInvoice.cashTendered || receiptInvoice.netSale}
          changeDue={receiptInvoice.changeGiven}
        />
      )}
    </div>
  );
};
