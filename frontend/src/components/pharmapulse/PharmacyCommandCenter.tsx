import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  DollarSign,
  TrendingUp,
  Boxes,
  Clock,
  Truck,
  Wallet,
  Users,
  AlertTriangle,
  Snowflake,
  ShieldCheck,
  CheckCircle2,
  Scan,
  RefreshCw,
  Eye,
  Calendar,
  Layers,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Building2,
  Filter,
  Sparkles,
  Plus,
  FileText,
  CreditCard,
  PackageCheck,
  AlertCircle,
  MapPin,
  UserCheck,
  BarChart3,
  ArrowRight,
  ArrowLeftRight,
  Printer,
  ChevronDown,
} from 'lucide-react';
import { PharmacyService } from '../../services/pharmacyService';
import { BranchService } from '../../services/branchService';
import { useAuth } from '../../context/AuthContext';
import { Batch, Medicine, Sale, PurchaseOrder, SaleReturn, AccountingTransaction } from '../../types/pharmacy';
import { BranchInfo } from '../../types/pharmapulse';

interface PharmacyCommandCenterProps {
  onOpenPos: () => void;
  onOpenBarcodeScanner: () => void;
  onOpenPriceHistory: (drugName?: string) => void;
  onOpenSubstitute: (drugName?: string) => void;
  onOpenExpiryView: () => void;
  onNavigateTab?: (tab: string) => void;
}

type TimeframePreset = 'today' | 'yesterday' | 'week' | 'month' | 'all';

export const PharmacyCommandCenter: React.FC<PharmacyCommandCenterProps> = ({
  onOpenPos,
  onOpenBarcodeScanner,
  onOpenPriceHistory,
  onOpenSubstitute,
  onOpenExpiryView,
  onNavigateTab,
}) => {
  const { currentUser, allUsers } = useAuth();
  const [version, setVersion] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<string>('Just now');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState<TimeframePreset>('today');

  // Load registered branches
  const [branches, setBranches] = useState<BranchInfo[]>(() => BranchService.getBranches());

  // Current branch selection: 'all' or branch ID
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    if (currentUser?.branchId) return currentUser.branchId;
    const brs = BranchService.getBranches();
    return brs.length > 0 ? brs[0].id : 'all';
  });

  // Subscribe to pharmacy state changes
  useEffect(() => {
    const unsubPharmacy = PharmacyService.subscribe(() => {
      setVersion((v) => v + 1);
    });
    const unsubBranch = BranchService.subscribe(() => {
      const freshBranches = BranchService.getBranches();
      setBranches(freshBranches);
      setVersion((v) => v + 1);
    });

    return () => {
      unsubPharmacy();
      unsubBranch();
    };
  }, []);

  // Update selectedBranchId if currentUser changes and not set
  useEffect(() => {
    if (currentUser?.branchId && selectedBranchId === 'all' && branches.some(b => b.id === currentUser.branchId)) {
      setSelectedBranchId(currentUser.branchId);
    }
  }, [currentUser, branches]);

  // Handle manual refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setVersion((v) => v + 1);
      setBranches(BranchService.getBranches());
      setLastRefreshed(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }, 350);
  };

  // Branch matching helper
  const isMatchingBranch = (itemBranchId?: string, targetBranchId?: string): boolean => {
    if (!targetBranchId || targetBranchId === 'all') return true;
    if (!itemBranchId) {
      // Default to Head Office if untagged
      const targetBranch = branches.find((b) => b.id === targetBranchId);
      return targetBranch?.type === 'head_office' || targetBranchId === 'HQ-MAIN';
    }
    if (itemBranchId === targetBranchId) return true;
    return branches.some(
      (b) =>
        b.id === targetBranchId &&
        (b.code.toLowerCase() === itemBranchId.toLowerCase() ||
          b.name.toLowerCase() === itemBranchId.toLowerCase())
    );
  };

  // Compute all metrics dynamically with 100% real data
  const data = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const monthPrefix = todayStr.substring(0, 7);

    // Fetch live models from storage
    const medicines: Medicine[] = PharmacyService.getMedicines();
    const batches: Batch[] = PharmacyService.getBatches();
    const sales: Sale[] = PharmacyService.getSales();
    const purchases: PurchaseOrder[] = PharmacyService.getPurchases();
    const returns: SaleReturn[] = PharmacyService.getReturns();
    const accountingTx: AccountingTransaction[] = PharmacyService.getAccountingTransactions();

    // 1. FILTER SALES BY BRANCH AND TIMEFRAME
    const branchSales = sales.filter((s) => isMatchingBranch(s.branchId, selectedBranchId));

    const filterSalesByTime = (sList: Sale[], tf: TimeframePreset) => {
      return sList.filter((s) => {
        const sDate = s.date || (s.timestamp ? s.timestamp.split('T')[0] : '');
        if (tf === 'today') return sDate === todayStr;
        if (tf === 'yesterday') return sDate === yesterdayStr;
        if (tf === 'week') return sDate >= sevenDaysAgoStr && sDate <= todayStr;
        if (tf === 'month') return sDate.startsWith(monthPrefix);
        return true;
      });
    };

    const currentPeriodSales = filterSalesByTime(branchSales, timeframe);

    // Previous period sales for calculating trends
    let prevPeriodSales: Sale[] = [];
    if (timeframe === 'today') {
      prevPeriodSales = filterSalesByTime(branchSales, 'yesterday');
    } else if (timeframe === 'yesterday') {
      const dayBeforeYesterday = new Date();
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
      const dbyStr = dayBeforeYesterday.toISOString().split('T')[0];
      prevPeriodSales = branchSales.filter((s) => (s.date || '').startsWith(dbyStr));
    } else if (timeframe === 'week') {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const fourteenStr = fourteenDaysAgo.toISOString().split('T')[0];
      prevPeriodSales = branchSales.filter((s) => {
        const sDate = s.date || '';
        return sDate >= fourteenStr && sDate < sevenDaysAgoStr;
      });
    } else if (timeframe === 'month') {
      const prevMonth = new Date();
      prevMonth.setMonth(prevMonth.getMonth() - 1);
      const prevMonthPrefix = prevMonth.toISOString().substring(0, 7);
      prevPeriodSales = branchSales.filter((s) => (s.date || '').startsWith(prevMonthPrefix));
    }

    // Sales Metrics
    const grossSales = currentPeriodSales.reduce((acc, s) => acc + (s.grandTotal || 0), 0);
    const discountTotal = currentPeriodSales.reduce((acc, s) => acc + (s.discountTotal || 0), 0);
    const branchReturns = returns.filter((r) => isMatchingBranch(r.branchId, selectedBranchId));
    const returnRefunds = branchReturns.reduce((acc, r) => acc + (r.totalRefund || 0), 0);
    const netSales = Math.max(0, grossSales - discountTotal - returnRefunds);
    const totalBills = currentPeriodSales.length;

    // Payment splits
    let cashSales = 0;
    let cardSales = 0;
    let mfsSales = 0;
    let creditSales = 0;

    currentPeriodSales.forEach((s) => {
      if (s.paymentMethod === 'cash') cashSales += s.grandTotal || 0;
      else if (s.paymentMethod === 'card') cardSales += s.grandTotal || 0;
      else if (s.paymentMethod === 'bkash_nagad' || s.paymentMethod === 'upi_mobile') mfsSales += s.grandTotal || 0;
      else if (s.paymentMethod === 'due_credit' || s.paymentStatus === 'due') creditSales += (s.dueAmount || s.grandTotal || 0);
      else if (s.paymentMethod === 'split' && s.splitDetails) {
        cashSales += s.splitDetails.cashAmount || 0;
        cardSales += s.splitDetails.cardAmount || 0;
        mfsSales += s.splitDetails.mobileAmount || 0;
      } else {
        cashSales += s.grandTotal || 0;
      }
    });

    const prevGross = prevPeriodSales.reduce((acc, s) => acc + (s.grandTotal || 0), 0);
    let growthVsPrev = 0;
    if (prevGross > 0) {
      growthVsPrev = Number((((grossSales - prevGross) / prevGross) * 100).toFixed(1));
    } else if (grossSales > 0) {
      growthVsPrev = 100;
    }

    const avgBasketValue = totalBills > 0 ? grossSales / totalBills : 0;

    // 2. PROFIT METRICS
    const grossProfit = currentPeriodSales.reduce((acc, s) => {
      if (s.grossProfit !== undefined && s.grossProfit !== null && !isNaN(s.grossProfit)) {
        return acc + s.grossProfit;
      }
      return acc + ((s.grandTotal || 0) - (s.taxTotal || 0) - (s.totalCost || 0));
    }, 0);

    const branchTx = accountingTx.filter((t) => isMatchingBranch(t.branchId, selectedBranchId));
    const operatingExpenses = branchTx
      .filter((t) => t.type === 'operational_expense')
      .reduce((acc, t) => acc + (t.debit || 0), 0);

    const netProfit = Math.max(0, grossProfit - operatingExpenses);
    const marginPercent = netSales > 0 ? Number(((grossProfit / netSales) * 100).toFixed(1)) : 0;

    // Top margin product calculation
    const medProfitMap = new Map<string, { name: string; profit: number; qty: number; revenue: number }>();
    currentPeriodSales.forEach((s) => {
      (s.items || []).forEach((it) => {
        const itemProfit = (it.unitPrice - (it.unitCost || 0)) * (it.quantity || 1);
        const existing = medProfitMap.get(it.medicineId) || { name: it.medicineName, profit: 0, qty: 0, revenue: 0 };
        medProfitMap.set(it.medicineId, {
          name: it.medicineName,
          profit: existing.profit + itemProfit,
          qty: existing.qty + it.quantity,
          revenue: existing.revenue + it.unitPrice * it.quantity,
        });
      });
    });

    let topMarginProduct = {
      name: 'No sales recorded yet',
      details: 'Start dispensing via POS billing',
      margin: 0,
    };

    if (medProfitMap.size > 0) {
      const sorted = Array.from(medProfitMap.values()).sort((a, b) => b.profit - a.profit);
      const best = sorted[0];
      const medObj = medicines.find((m) => m.name.toLowerCase() === best.name.toLowerCase());
      topMarginProduct = {
        name: best.name,
        details: `${medObj?.manufacturer || 'Verified Item'} • ${best.qty} units sold (৳${Math.round(best.profit).toLocaleString()} profit)`,
        margin: best.revenue > 0 ? Number(((best.profit / best.revenue) * 100).toFixed(1)) : 0,
      };
    } else {
      // Find highest margin in-stock item for this branch
      const branchBatchesWithStock = batches.filter(
        (b) => isMatchingBranch(b.branchId, selectedBranchId) && b.currentStock > 0
      );
      if (branchBatchesWithStock.length > 0) {
        const sortedBatches = [...branchBatchesWithStock].sort(
          (a, b) => (b.sellingPrice - b.purchasePrice) - (a.sellingPrice - a.purchasePrice)
        );
        const bestBatch = sortedBatches[0];
        const medObj = medicines.find((m) => m.id === bestBatch.medicineId);
        const markup =
          bestBatch.sellingPrice > 0
            ? Number((((bestBatch.sellingPrice - bestBatch.purchasePrice) / bestBatch.sellingPrice) * 100).toFixed(1))
            : 0;
        topMarginProduct = {
          name: bestBatch.medicineName,
          details: `${medObj?.manufacturer || 'In Stock'} • Buy ৳${bestBatch.purchasePrice} → Sell ৳${bestBatch.sellingPrice} (+${markup}%)`,
          margin: markup,
        };
      }
    }

    // 3. STOCK & INVENTORY METRICS
    const branchBatches = batches.filter((b) => isMatchingBranch(b.branchId, selectedBranchId));
    const stockByMed = new Map<string, number>();
    branchBatches.forEach((b) => {
      if (b.currentStock > 0) {
        stockByMed.set(b.medicineId, (stockByMed.get(b.medicineId) || 0) + b.currentStock);
      }
    });

    const totalValuation = branchBatches
      .filter((b) => b.currentStock > 0 && b.status !== 'expired')
      .reduce((sum, b) => sum + b.currentStock * (b.purchasePrice || 0), 0);

    const activeBatchesCount = branchBatches.filter((b) => b.currentStock > 0).length;
    const totalSkus = medicines.length;

    const lowStockItems: { id: string; name: string; stock: number; reorder: number }[] = [];
    const outOfStockItems: { id: string; name: string }[] = [];

    medicines.forEach((m) => {
      const stk = stockByMed.get(m.id) || 0;
      const reorder = m.reorderLevel || 10;
      if (stk <= 0) {
        outOfStockItems.push({ id: m.id, name: m.name });
      } else if (stk <= reorder) {
        lowStockItems.push({ id: m.id, name: m.name, stock: stk, reorder });
      }
    });

    const inStockPercentage =
      totalSkus > 0
        ? Number((((totalSkus - outOfStockItems.length) / totalSkus) * 100).toFixed(1))
        : 100;

    // 4. EXPIRY & FEFO METRICS
    const nowTime = Date.now();
    const activeBatchesWithStock = branchBatches.filter((b) => b.currentStock > 0);

    const expiredLots: (Batch & { daysLeft: number })[] = [];
    const criticalLots: (Batch & { daysLeft: number })[] = [];
    const warningLots: (Batch & { daysLeft: number })[] = [];

    activeBatchesWithStock.forEach((b) => {
      const expTime = new Date(b.expiryDate).getTime();
      const daysLeft = Math.ceil((expTime - nowTime) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 0 || b.status === 'expired') {
        expiredLots.push({ ...b, daysLeft });
      } else if (daysLeft <= 30) {
        criticalLots.push({ ...b, daysLeft });
      } else if (daysLeft <= 90) {
        warningLots.push({ ...b, daysLeft });
      }
    });

    const valueAtRisk30d = criticalLots.reduce(
      (sum, b) => sum + b.currentStock * (b.sellingPrice || b.mrp || 0),
      0
    );
    const valueAtRisk90d = warningLots.reduce(
      (sum, b) => sum + b.currentStock * (b.sellingPrice || b.mrp || 0),
      0
    );
    const valueExpired = expiredLots.reduce(
      (sum, b) => sum + b.currentStock * (b.purchasePrice || 0),
      0
    );

    const urgentFefoQueue = [...expiredLots, ...criticalLots, ...warningLots].sort(
      (a, b) => a.daysLeft - b.daysLeft
    );

    // 5. PURCHASES & INBOUND GRN
    const branchPurchases = purchases.filter((p) => isMatchingBranch(p.branchId, selectedBranchId));
    const receivedPurchases = branchPurchases.filter((p) => p.status === 'received');
    const pendingPurchases = branchPurchases.filter(
      (p) => p.status === 'ordered' || p.status === 'partially_received' || p.status === 'draft'
    );

    const receivedInTimeframe = receivedPurchases.filter((p) => {
      const pDate = p.receivedAt ? p.receivedAt.split('T')[0] : p.purchaseDate || '';
      if (timeframe === 'today') return pDate === todayStr;
      if (timeframe === 'yesterday') return pDate === yesterdayStr;
      if (timeframe === 'week') return pDate >= sevenDaysAgoStr && pDate <= todayStr;
      if (timeframe === 'month') return pDate.startsWith(monthPrefix);
      return true;
    });

    const grnReceived = receivedInTimeframe.reduce((acc, p) => acc + (p.totalAmount || 0), 0);

    const supplierPayablesDue = branchPurchases
      .filter((p) => p.paymentStatus !== 'paid')
      .reduce((acc, p) => {
        if (p.dueAmount !== undefined) return acc + p.dueAmount;
        return acc + Math.max(0, p.totalAmount - (p.paidAmount || 0));
      }, 0);

    const latestReceived =
      receivedPurchases.length > 0
        ? [...receivedPurchases].sort((a, b) =>
            (b.receivedAt || b.purchaseDate || '').localeCompare(a.receivedAt || a.purchaseDate || '')
          )[0]
        : null;

    // 6. CASH DRAWER & FINANCIAL TILL
    const todaySalesCash = branchSales
      .filter((s) => s.date === todayStr || (s.timestamp && s.timestamp.startsWith(todayStr)))
      .reduce(
        (acc, s) =>
          acc +
          (s.paymentMethod === 'cash' ? s.grandTotal || 0 : s.splitDetails?.cashAmount || 0),
        0
      );

    const todayCashExpenses = branchTx
      .filter(
        (t) =>
          (t.date === todayStr || t.date.startsWith(todayStr)) &&
          (t.account === 'Cash' || t.description.toLowerCase().includes('cash'))
      )
      .reduce((acc, t) => acc + (t.debit || 0), 0);

    const physicalDrawerCash = Math.max(0, todaySalesCash - todayCashExpenses);

    // 7. STAFF ON DUTY
    const branchStaff = (allUsers || []).filter((u) => {
      if (selectedBranchId === 'all') return true;
      return isMatchingBranch(u.branchId, selectedBranchId);
    });

    const staffWithMetrics = branchStaff.map((u) => {
      const staffSales = branchSales.filter(
        (s) => s.cashierName === u.name || s.cashierName === u.username
      );
      const billsCount = staffSales.length;
      const totalVolume = staffSales.reduce((acc, s) => acc + (s.grandTotal || 0), 0);
      return {
        id: u.id,
        name: u.name,
        role: u.roleName || 'Pharmacist',
        reg: u.licenseNumber || 'REG-PHARM',
        bills: billsCount,
        volume: totalVolume,
        isActive: u.isActive !== false,
      };
    });

    // 8. LIVE OPERATIONAL ALERTS & REGULATORY GATE
    const alerts: {
      id: string;
      level: 'critical' | 'warning' | 'info' | 'success';
      title: string;
      desc: string;
    }[] = [];

    if (expiredLots.length > 0) {
      alerts.push({
        id: 'al-expired',
        level: 'critical',
        title: `Quarantine: ${expiredLots.length} Expired Batches Detected`,
        desc: `Action needed for ${expiredLots.slice(0, 2).map((b) => b.medicineName).join(', ')}. Est. loss risk: ৳${valueExpired.toLocaleString()}`,
      });
    }

    if (criticalLots.length > 0) {
      alerts.push({
        id: 'al-crit-fefo',
        level: 'critical',
        title: `FEFO Priority: ${criticalLots.length} Lots Expiring Under 30 Days`,
        desc: `৳${valueAtRisk30d.toLocaleString()} value at risk. Dispense first or initiate IBT stock transfer.`,
      });
    }

    if (outOfStockItems.length > 0) {
      alerts.push({
        id: 'al-stockout',
        level: 'warning',
        title: `Stockout: ${outOfStockItems.length} Medicines at 0 Units`,
        desc: `Reorder needed: ${outOfStockItems.slice(0, 3).map((m) => m.name).join(', ')}`,
      });
    }

    if (lowStockItems.length > 0) {
      alerts.push({
        id: 'al-lowstock',
        level: 'warning',
        title: `Low Stock: ${lowStockItems.length} SKUs Below Reorder Level`,
        desc: `${lowStockItems.slice(0, 3).map((m) => `${m.name} (${m.stock} left)`).join(', ')}`,
      });
    }

    if (pendingPurchases.length > 0) {
      alerts.push({
        id: 'al-pending-po',
        level: 'info',
        title: `Inbound Orders: ${pendingPurchases.length} POs Awaiting Delivery`,
        desc: `Verify supplier challans upon physical delivery at reception.`,
      });
    }

    if (creditSales > 0) {
      alerts.push({
        id: 'al-credit-due',
        level: 'info',
        title: `Receivables: ৳${creditSales.toLocaleString()} in Outstanding Patient Credit`,
        desc: `Reconcile credit payments in Accounts & Ledger.`,
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        id: 'al-all-clear',
        level: 'success',
        title: 'All Operational Indicators Optimal',
        desc: 'Inventory levels, expiry thresholds, and drawer reconciliation are operating within standard tolerance.',
      });
    }

    // Cold-Chain Medicine Count
    const coldChainMeds = medicines.filter(
      (m) =>
        (m.rackLocation &&
          (m.rackLocation.toLowerCase().includes('fridge') ||
            m.rackLocation.toLowerCase().includes('cold') ||
            m.rackLocation.toLowerCase().includes('refrigerator'))) ||
        m.dosageForm === 'Injection' ||
        m.dosageForm === 'Eye / Ear Drops'
    );
    const coldChainBatches = branchBatches.filter(
      (b) => coldChainMeds.some((m) => m.id === b.medicineId) && b.currentStock > 0
    );

    // DGDA Regulatory Prescription Compliance
    const rxSales = currentPeriodSales.filter((s) =>
      (s.items || []).some((it) => {
        const med = medicines.find((m) => m.id === it.medicineId);
        return med?.requiresPrescription || med?.isNarcoticOrSedative;
      })
    );
    const rxWithDoc = rxSales.filter((s) => s.prescriptionId || s.doctorName);
    const rxCompliancePercent =
      rxSales.length > 0 ? Math.round((rxWithDoc.length / rxSales.length) * 100) : 100;

    // Active branch title
    const currentBranchObj = branches.find((b) => b.id === selectedBranchId);
    const storeNodeTitle =
      selectedBranchId === 'all'
        ? `Consolidated (All ${branches.length} Branches)`
        : currentBranchObj
        ? `${currentBranchObj.name} [${currentBranchObj.code}]`
        : currentUser?.branchName
        ? `${currentUser.branchName} (${currentUser.branchId || 'HQ'})`
        : 'Central Pharmacy';

    return {
      storeNodeTitle,
      currentBranchObj,
      sales: {
        growthVsPrev,
        grossSales,
        netSales,
        totalBills,
        cashSales,
        cardSales,
        mfsSales,
        creditSales,
        avgBasketValue,
        recentSales: currentPeriodSales.slice(0, 5),
      },
      profit: {
        marginPercent,
        grossProfit,
        operatingExpenses,
        netProfit,
        topMarginProduct,
      },
      stock: {
        inStockPercentage,
        totalValuation,
        totalSkus,
        activeBatches: activeBatchesCount,
        lowStockItems,
        outOfStockItems,
      },
      expiry: {
        expiredCount: expiredLots.length,
        criticalCount: criticalLots.length,
        warningCount: warningLots.length,
        valueAtRisk30d,
        valueAtRisk90d,
        valueExpired,
        urgentQueue: urgentFefoQueue.slice(0, 4),
      },
      purchase: {
        grnReceived,
        pendingCount: pendingPurchases.length,
        supplierPayablesDue,
        latestReceived,
      },
      cash: {
        physicalDrawerCash,
        cardSales,
        mfsSales,
        creditSales,
      },
      staff: staffWithMetrics,
      alerts,
      compliance: {
        coldChainCount: coldChainBatches.length,
        rxCompliancePercent,
        rxSalesCount: rxSales.length,
      },
    };
  }, [version, selectedBranchId, timeframe, branches, currentUser, allUsers]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-100/70 dark:bg-[#0d1117] overflow-y-auto p-3 sm:p-5 text-slate-800 dark:text-slate-100 animate-fade-in font-sans">
      {/* Top Mission Control Header */}
      <div className="mb-4 bg-white dark:bg-[#151922] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title & Branch Context */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 shrink-0">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Pharmacy Command Center
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold uppercase tracking-wider">
                LIVE ENTERPRISE COCKPIT
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                {data.storeNodeTitle}
              </span>
              <span>•</span>
              <span>8-Pillars Operational Telemetry (Sales, Stock, FEFO, Cash & Staff)</span>
            </div>
          </div>
        </div>

        {/* Filters & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Branch Selector Dropdown */}
          <div className="relative">
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="appearance-none pl-8 pr-8 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              title="Filter cockpit by specific branch"
            >
              <option value="all">🏢 All Branches (Consolidated)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  📍 {b.name} ({b.code})
                </option>
              ))}
            </select>
            <Building2 className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Timeframe Presets */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            {(['today', 'yesterday', 'week', 'month'] as TimeframePreset[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition ${
                  timeframe === tf
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tf === 'today'
                  ? 'Today'
                  : tf === 'yesterday'
                  ? 'Yesterday'
                  : tf === 'week'
                  ? '7 Days'
                  : 'This Month'}
              </button>
            ))}
          </div>

          {/* Live Refresh Button */}
          <button
            onClick={handleRefresh}
            title="Refresh live metrics"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`}
            />
            <span className="hidden xl:inline text-[11px]">{lastRefreshed}</span>
          </button>

          {/* Smart Barcode Quick Shortcut */}
          <button
            onClick={onOpenBarcodeScanner}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:border-emerald-500 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition"
          >
            <Scan className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Smart Barcode</span>
          </button>

          {/* Launch POS Billing */}
          <button
            onClick={onOpenPos}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-emerald-700/20 flex items-center gap-1.5 transition"
          >
            <span>Launch POS</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 8-PILLARS OPERATIONAL GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* ========================================================
            PILLAR 1: SALES (বিক্রয়)
           ======================================================== */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#151922] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-blue-400/50 transition">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  1. Sales (বিক্রয়)
                </span>
              </div>
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  data.sales.growthVsPrev >= 0
                    ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60'
                    : 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60'
                }`}
              >
                {data.sales.growthVsPrev >= 0 ? '+' : ''}
                {data.sales.growthVsPrev}% vs prev
              </span>
            </div>

            <div className="mt-2">
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                Gross Sales ({timeframe})
              </span>
              <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                ৳ {Math.round(data.sales.grossSales).toLocaleString()}
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Net: ৳{Math.round(data.sales.netSales).toLocaleString()} • {data.sales.totalBills} Invoices Dispensed
              </span>
            </div>

            {/* Live Payment Method Distribution */}
            <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px]">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400 block font-semibold">Cash</span>
                <span className="font-bold font-mono text-slate-800 dark:text-slate-100 block truncate">
                  ৳{Math.round(data.sales.cashSales).toLocaleString()}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400 block font-semibold">Card POS</span>
                <span className="font-bold font-mono text-slate-800 dark:text-slate-100 block truncate">
                  ৳{Math.round(data.sales.cardSales).toLocaleString()}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400 block font-semibold">MFS (bKash)</span>
                <span className="font-bold font-mono text-slate-800 dark:text-slate-100 block truncate">
                  ৳{Math.round(data.sales.mfsSales).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium text-[11px]">
              AOV: <strong className="text-slate-800 dark:text-slate-200">৳{Math.round(data.sales.avgBasketValue).toLocaleString()}</strong>
            </span>
            <button
              onClick={onOpenPos}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-0.5 text-[11px]"
            >
              <span>New Bill</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ========================================================
            PILLAR 2: PROFIT (মুনাফা ও মার্জিন)
           ======================================================== */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#151922] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-emerald-400/50 transition">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  2. Profit (মুনাফা)
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                Margin: {data.profit.marginPercent}%
              </span>
            </div>

            <div className="mt-2">
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                Gross Profit ({timeframe})
              </span>
              <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                ৳ {Math.round(data.profit.grossProfit).toLocaleString()}
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Operating OpEx: ৳{Math.round(data.profit.operatingExpenses).toLocaleString()} • Net: ৳{Math.round(data.profit.netProfit).toLocaleString()}
              </span>
            </div>

            {/* Real Top Margin Product */}
            <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center justify-between mb-1 text-[10px]">
                <span className="text-slate-400 uppercase font-bold">Top Margin Product</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {data.profit.topMarginProduct.margin > 0 ? `+${data.profit.topMarginProduct.margin}% Return` : 'Cataloged'}
                </span>
              </div>
              <span className="font-bold text-slate-800 dark:text-slate-100 truncate block text-[11px]">
                {data.profit.topMarginProduct.name}
              </span>
              <span className="text-[10px] text-slate-500 block truncate mt-0.5">
                {data.profit.topMarginProduct.details}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px]">
              Avg Profit/Bill: ৳
              {data.sales.totalBills > 0
                ? Math.round(data.profit.grossProfit / data.sales.totalBills)
                : 0}
            </span>
            <button
              onClick={() => onOpenPriceHistory()}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-0.5 text-[11px]"
            >
              <span>Price Trend</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ========================================================
            PILLAR 3: STOCK (মজুদ নিয়ন্ত্রণ)
           ======================================================== */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#151922] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-indigo-400/50 transition">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  3. Stock (মজুদ)
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                {data.stock.inStockPercentage}% In Stock
              </span>
            </div>

            <div className="mt-2">
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                Inventory Valuation (Cost)
              </span>
              <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                ৳ {(data.stock.totalValuation / 100000).toFixed(2)} Lakh
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {data.stock.totalSkus} SKUs Cataloged • {data.stock.activeBatches} Batches Active
              </span>
            </div>

            {/* Low Stock & Out of Stock Live Counts */}
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div
                onClick={() => onNavigateTab && onNavigateTab('inventory')}
                className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 cursor-pointer hover:border-amber-400 transition"
                title="Click to view low stock items"
              >
                <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold block uppercase">
                  Low Stock
                </span>
                <span className="font-mono font-extrabold text-sm text-amber-900 dark:text-amber-200">
                  {data.stock.lowStockItems.length} SKUs
                </span>
                {data.stock.lowStockItems.length > 0 && (
                  <span className="text-[9px] text-amber-700/80 dark:text-amber-300/80 truncate block mt-0.5">
                    {data.stock.lowStockItems[0].name}
                  </span>
                )}
              </div>

              <div
                onClick={() => onNavigateTab && onNavigateTab('inventory')}
                className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 cursor-pointer hover:border-rose-400 transition"
                title="Click to view out of stock items"
              >
                <span className="text-[10px] text-rose-700 dark:text-rose-300 font-bold block uppercase">
                  Out of Stock
                </span>
                <span className="font-mono font-extrabold text-sm text-rose-900 dark:text-rose-200">
                  {data.stock.outOfStockItems.length} SKUs
                </span>
                {data.stock.outOfStockItems.length > 0 && (
                  <span className="text-[9px] text-rose-700/80 dark:text-rose-300/80 truncate block mt-0.5">
                    {data.stock.outOfStockItems[0].name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px]">Real-Time Sync</span>
            <button
              onClick={() => onOpenSubstitute()}
              className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-0.5 text-[11px]"
            >
              <span>Substitutes</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ========================================================
            PILLAR 4: EXPIRY & FEFO (মেয়াদোত্তীর্ণ ও ফেফো)
           ======================================================== */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#151922] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-orange-400/50 transition">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/80 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  4. Expiry & FEFO
                </span>
              </div>
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  data.expiry.criticalCount > 0
                    ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 animate-pulse'
                    : 'text-orange-600 bg-orange-50 dark:bg-orange-950/60'
                }`}
              >
                {data.expiry.criticalCount} Lots &lt; 30d
              </span>
            </div>

            <div className="mt-2">
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                Value at Risk (&lt; 30d)
              </span>
              <div className="text-2xl font-black font-mono text-orange-600 dark:text-orange-400">
                ৳ {Math.round(data.expiry.valueAtRisk30d).toLocaleString()}
              </div>
              <span className="text-xs text-slate-500 font-medium">
                &lt; 90 Days: {data.expiry.warningCount} Lots (৳{Math.round(data.expiry.valueAtRisk90d).toLocaleString()})
              </span>
            </div>

            {/* Real FEFO Status Alert */}
            <div className="mt-3 p-2.5 rounded-xl bg-orange-50/60 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/40 text-xs">
              <div className="flex items-center justify-between text-[10px] font-bold text-orange-800 dark:text-orange-300 mb-0.5">
                <span>FEFO Priority Queue Active</span>
                <span className="font-mono">{data.expiry.urgentQueue.length} Lots Queued</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                {data.expiry.urgentQueue.length > 0
                  ? `Next: ${data.expiry.urgentQueue[0].medicineName} (${data.expiry.urgentQueue[0].batchNumber})`
                  : 'Zero lots expiring in the next 90 days. Stock is optimal.'}
              </p>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px]">Loss Prevention</span>
            <button
              onClick={onOpenExpiryView}
              className="text-orange-600 dark:text-orange-400 font-bold hover:underline flex items-center gap-0.5 text-[11px]"
            >
              <span>View Queue</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ========================================================
            PILLAR 5: PURCHASE (ক্রয় ও চালানের স্থিতি)
           ======================================================== */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#151922] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-teal-400/50 transition">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  5. Purchase (ক্রয়)
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.5 rounded">
                GRN Received
              </span>
            </div>

            <div className="mt-2">
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                GRN Inward ({timeframe})
              </span>
              <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                ৳ {Math.round(data.purchase.grnReceived).toLocaleString()}
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Supplier Payables: ৳{Math.round(data.purchase.supplierPayablesDue).toLocaleString()}
              </span>
            </div>

            {/* Real Most Recent Inbound Shipment */}
            <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center justify-between mb-1 text-[10px]">
                <span className="text-slate-400 uppercase font-bold">Latest Inbound PO</span>
                <span className="text-teal-600 dark:text-teal-400 font-bold font-mono">
                  {data.purchase.latestReceived ? 'Verified' : 'None'}
                </span>
              </div>
              <span className="font-bold text-slate-800 dark:text-slate-100 block truncate text-[11px]">
                {data.purchase.latestReceived
                  ? `${data.purchase.latestReceived.supplierName} • PO #${data.purchase.latestReceived.poNumber}`
                  : 'No inbound deliveries received yet'}
              </span>
              <span className="text-[10px] text-slate-500 block truncate mt-0.5">
                {data.purchase.latestReceived
                  ? `Amount: ৳${data.purchase.latestReceived.totalAmount.toLocaleString()} (${data.purchase.latestReceived.receivedAt || data.purchase.latestReceived.purchaseDate})`
                  : 'Requisition purchase orders from suppliers'}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px]">
              {data.purchase.pendingCount} Pending POs
            </span>
            <button
              onClick={() => onNavigateTab && onNavigateTab('purchases')}
              className="text-teal-600 dark:text-teal-400 font-bold hover:underline flex items-center gap-0.5 text-[11px]"
            >
              <span>Suppliers</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ========================================================
            PILLAR 6: CASH DRAWER (ক্যাশ ড্রয়ার ও কালেকশন)
           ======================================================== */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#151922] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-amber-400/50 transition">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  6. Cash (ক্যাশ ড্রয়ার)
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                Live Till Sync
              </span>
            </div>

            <div className="mt-2">
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                Drawer Cash In Hand (Today)
              </span>
              <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                ৳ {Math.round(data.cash.physicalDrawerCash).toLocaleString()}
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Customer Dues / Receivables: ৳{Math.round(data.cash.creditSales).toLocaleString()}
              </span>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-2 gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px]">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400 text-[10px] block font-semibold">Card POS</span>
                <span className="font-bold font-mono text-slate-800 dark:text-slate-100 block truncate">
                  ৳{Math.round(data.cash.cardSales).toLocaleString()}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400 text-[10px] block font-semibold">MFS Wallet</span>
                <span className="font-bold font-mono text-slate-800 dark:text-slate-100 block truncate">
                  ৳{Math.round(data.cash.mfsSales).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px]">Shift Reconciled</span>
            <button
              onClick={() => onNavigateTab && onNavigateTab('accounts_ledger')}
              className="text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-0.5 text-[11px]"
            >
              <span>Ledger</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ========================================================
            PILLAR 7: STAFF (কর্মী ও ডিসপেন্সিং শিফট)
           ======================================================== */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#151922] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-purple-400/50 transition">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  7. Staff (কর্মী ও শিফট)
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded">
                {data.staff.length} Assigned
              </span>
            </div>

            {/* Real Staff List */}
            <div className="mt-2 flex flex-col gap-1.5 max-h-[148px] overflow-y-auto pr-0.5">
              {data.staff.length > 0 ? (
                data.staff.slice(0, 3).map((member) => (
                  <div
                    key={member.id}
                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {member.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 dark:text-white block truncate text-[11px]">
                          {member.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {member.role} • {member.reg}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-[11px] text-slate-800 dark:text-slate-200 block">
                        {member.bills} bills
                      </span>
                      <span className="text-[9px] text-slate-400 block">
                        ৳{Math.round(member.volume).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <span>No staff assigned to this branch yet.</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px]">Roster Active</span>
            <button
              onClick={() => onNavigateTab && onNavigateTab('settings')}
              className="text-purple-600 dark:text-purple-400 font-bold hover:underline flex items-center gap-0.5 text-[11px]"
            >
              <span>Manage Roles</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ========================================================
            PILLAR 8: LIVE ALERTS & COMPLIANCE (সতর্কতা ও নিয়ন্ত্রণ)
           ======================================================== */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#151922] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-rose-400/50 transition">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  8. Live Alerts (সতর্কতা)
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                Active Audit
              </span>
            </div>

            {/* Cold-Chain & DGDA Quick Badges */}
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/80 flex items-center gap-2">
                <Snowflake className="w-4 h-4 text-sky-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-sky-800 dark:text-sky-300 uppercase block truncate">
                    Cold Chain
                  </span>
                  <span className="text-[11px] font-mono font-bold text-sky-900 dark:text-sky-100 block truncate">
                    {data.compliance.coldChainCount} SKUs Monitored
                  </span>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-emerald-800 dark:text-emerald-300 uppercase block truncate">
                    DGDA Rx Gate
                  </span>
                  <span className="text-[11px] font-mono font-bold text-emerald-900 dark:text-emerald-100 block truncate">
                    {data.compliance.rxCompliancePercent}% Compliant
                  </span>
                </div>
              </div>
            </div>

            {/* Real-time Dynamic Alerts */}
            <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto pr-0.5">
              {data.alerts.slice(0, 2).map((al) => (
                <div
                  key={al.id}
                  className={`p-2 rounded-xl border text-xs flex items-start gap-2 ${
                    al.level === 'critical'
                      ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60'
                      : al.level === 'warning'
                      ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60'
                      : al.level === 'success'
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800'
                  }`}
                >
                  <AlertTriangle
                    className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                      al.level === 'critical'
                        ? 'text-rose-600'
                        : al.level === 'warning'
                        ? 'text-amber-600'
                        : al.level === 'success'
                        ? 'text-emerald-600'
                        : 'text-blue-600'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-slate-800 dark:text-slate-100 block truncate text-[11px]">
                      {al.title}
                    </span>
                    <span className="text-[10px] text-slate-500 block line-clamp-1">
                      {al.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px]">Compliance: Active</span>
            <button
              onClick={() => onNavigateTab && onNavigateTab('audit_logs')}
              className="text-rose-600 dark:text-rose-400 font-bold hover:underline flex items-center gap-0.5 text-[11px]"
            >
              <span>Audit Trail</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          LOWER EXECUTIVE DASHBOARD: REAL-TIME TRANSACTION FEED & FEFO QUEUE
         ======================================================== */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Live Transaction Ledger Feed (2 Cols) */}
        <div className="lg:col-span-2 p-4 rounded-2xl bg-white dark:bg-[#151922] border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                Live Transaction Feed ({data.sales.recentSales.length} Recent Bills)
              </h2>
            </div>
            <button
              onClick={onOpenPos}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>Open POS</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {data.sales.recentSales.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] uppercase bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold">
                  <tr>
                    <th className="py-2 px-3 rounded-l-lg">Invoice #</th>
                    <th className="py-2 px-3">Time</th>
                    <th className="py-2 px-3">Customer</th>
                    <th className="py-2 px-3">Items</th>
                    <th className="py-2 px-3">Payment</th>
                    <th className="py-2 px-3">Cashier</th>
                    <th className="py-2 px-3 text-right rounded-r-lg">Grand Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.sales.recentSales.map((sale) => (
                    <tr
                      key={sale.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {sale.invoiceNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {sale.timestamp ? sale.timestamp.substring(11, 16) : sale.date}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        {sale.customerName || 'Walking Customer'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono">
                        {(sale.items || []).length} items
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 truncate max-w-[100px]">
                        {sale.cashierName || 'Staff'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                        ৳{Math.round(sale.grandTotal).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <Boxes className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="font-semibold">No sales recorded in this timeframe.</p>
              <p className="text-[11px] mt-0.5">Click "Launch POS" above to dispense your first prescription.</p>
            </div>
          )}
        </div>

        {/* Urgent FEFO Clearance Queue & Action Panel (1 Col) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#151922] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-600" />
                <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                  Urgent FEFO Queue
                </h2>
              </div>
              <button
                onClick={onOpenExpiryView}
                className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1"
              >
                <span>Full List</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {data.expiry.urgentQueue.length > 0 ? (
                data.expiry.urgentQueue.map((lot) => (
                  <div
                    key={lot.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800 dark:text-slate-100 text-xs block truncate">
                        {lot.medicineName}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        Batch: {lot.batchNumber} • Stock: {lot.currentStock} units
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold block ${
                          lot.daysLeft <= 0
                            ? 'bg-rose-500 text-white'
                            : lot.daysLeft <= 30
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                            : 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300'
                        }`}
                      >
                        {lot.daysLeft <= 0
                          ? 'EXPIRED'
                          : `${lot.daysLeft}d left`}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        ৳{Math.round(lot.currentStock * lot.sellingPrice).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                  <p className="font-bold text-slate-700 dark:text-slate-300">Clean Expiry Horizon</p>
                  <p className="text-[11px] mt-0.5">No batches expiring within the next 90 days.</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Action Buttons for FEFO Clearance */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <button
              onClick={() => onNavigateTab && onNavigateTab('multi_branch')}
              className="flex-1 py-2 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition"
              title="Transfer near-expiry medicine to higher volume branch"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" />
              <span>IBT Transfer</span>
            </button>
            <button
              onClick={onOpenPos}
              className="flex-1 py-2 px-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
              title="Dispense priority batch in POS"
            >
              <span>Dispense Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
