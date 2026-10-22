import React, { useState, useMemo, useCallback } from 'react';
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  ShoppingCart, 
  Truck, 
  DollarSign, 
  AlertTriangle, 
  ClockAlert, 
  Layers, 
  Building2, 
  RefreshCw, 
  FileSpreadsheet, 
  PlusCircle, 
  Check, 
  ExternalLink, 
  Package, 
  Boxes, 
  PieChart as PieChartIcon, 
  BarChart3, 
  LineChart as LineChartIcon, 
  Activity, 
  Zap, 
  ShieldAlert, 
  ArrowUpRight, 
  ArrowDownRight,
  Info,
  X,
  Printer,
  Sparkles
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { PharmacyService } from '../../services/pharmacyService';
import { DateFilterPreset, ReorderItem, ActiveTab } from '../../types/pharmacy';

interface DashboardViewProps {
  onNavigateTab?: (tab: ActiveTab) => void;
  selectedBranchId?: string;
  hideHeaderBanner?: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ 
  onNavigateTab, 
  selectedBranchId = 'all',
  hideHeaderBanner = false 
}) => {
  // --- Date Filter State ---
  const [selectedPreset, setSelectedPreset] = useState<DateFilterPreset>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // --- Chart Controls ---
  const [trendGranularity, setTrendGranularity] = useState<'daily' | 'weekly'>('daily');
  const [barChartMode, setBarChartMode] = useState<'top_medicines' | 'velocity'>('top_medicines');

  // --- Reorder List Drawer / Modal State ---
  const [isReorderModalOpen, setIsReorderModalOpen] = useState<boolean>(false);
  const [reorderList, setReorderList] = useState<ReorderItem[]>(() => PharmacyService.getReorderList());

  // --- Notification Toast ---
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setRefreshTrigger(prev => prev + 1);
    setReorderList(PharmacyService.getReorderList());
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('Analytics & KPIs synchronized with latest data');
    }, 300);
  }, []);

  // --- Load Metrics & Chart Data (Multi-Branch Scoped) ---
  const kpis = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = refreshTrigger;
    return PharmacyService.getDashboardKPIs(selectedPreset, customStartDate, customEndDate, selectedBranchId);
  }, [selectedPreset, customStartDate, customEndDate, refreshTrigger, selectedBranchId]);

  const salesVsPurchasesTrend = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = refreshTrigger;
    return PharmacyService.getSalesVsPurchasesTrend(trendGranularity, selectedBranchId);
  }, [trendGranularity, refreshTrigger, selectedBranchId]);

  const topSellingMedicines = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = refreshTrigger;
    return PharmacyService.getTopSellingMedicines(10, selectedBranchId);
  }, [refreshTrigger, selectedBranchId]);

  const movementInventory = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = refreshTrigger;
    return PharmacyService.getFastVsSlowMovingInventory(selectedBranchId);
  }, [refreshTrigger, selectedBranchId]);

  const stockValuationByCategory = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = refreshTrigger;
    return PharmacyService.getStockValuationByCategory(selectedBranchId);
  }, [refreshTrigger, selectedBranchId]);

  const totalStockValuation = useMemo(() => {
    return stockValuationByCategory.reduce((acc, cat) => acc + cat.value, 0);
  }, [stockValuationByCategory]);

  const paymentCollectionSplit = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = refreshTrigger;
    return PharmacyService.getPaymentCollectionSplit(selectedBranchId);
  }, [refreshTrigger, selectedBranchId]);

  const totalCollectedAmount = useMemo(() => {
    return paymentCollectionSplit.reduce((acc, item) => acc + item.value, 0);
  }, [paymentCollectionSplit]);

  const expiryRiskOverTime = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = refreshTrigger;
    return PharmacyService.getExpiryRiskOverTime(6, selectedBranchId);
  }, [refreshTrigger, selectedBranchId]);

  const nearExpiryBatches = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = refreshTrigger;
    return PharmacyService.getTopNearExpiryBatches(5, selectedBranchId);
  }, [refreshTrigger, selectedBranchId]);

  const lowStockAlerts = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = refreshTrigger;
    return PharmacyService.getLowStockAlertMedicines(selectedBranchId);
  }, [refreshTrigger, reorderList, selectedBranchId]);

  // Handle Add to Reorder List
  const handleAddToReorder = (item: typeof lowStockAlerts[0]) => {
    PharmacyService.addToReorderList({
      medicineId: item.medicineId,
      medicineName: item.medicineName,
      genericName: item.genericName,
      currentStock: item.currentStock,
      reorderLevel: item.reorderLevel,
      suggestedQty: item.suggestedOrderQty,
      supplierId: item.supplierId,
      supplierName: item.supplierName
    });
    setReorderList(PharmacyService.getReorderList());
    showToast(`Added ${item.medicineName} to Reorder List`);
  };

  const handleRemoveFromReorder = (medicineId: string, name: string) => {
    PharmacyService.removeFromReorderList(medicineId);
    setReorderList(PharmacyService.getReorderList());
    showToast(`Removed ${name} from Reorder List`);
  };

  const handlePrintOrExport = () => {
    window.print();
  };

  // Format currency helper (BDT Standard)
  const fmt = (val: number) => `৳ ${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div id="pharmacy-dashboard-container" className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-12 right-6 z-50 bg-slate-900 text-emerald-400 border border-emerald-500/30 px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: HEADER & DATE FILTER BAR                                       */}
      {/* ========================================================================= */}
      <div id="dashboard-filter-header" className="bg-white rounded-xl shadow-xs border border-slate-200 p-4">
        {!hideHeaderBanner && (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
            {/* Left Title & Status */}
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    Pharmacy Analytics &amp; Intelligence
                    <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                      Live FEFO Metrics
                    </span>
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time sales velocity, FEFO batch expiry risks, stock valuation, and supplier accounts.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Reorder Queue Button */}
              <button
                id="btn-view-reorder-list"
                onClick={() => setIsReorderModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                <Package className="w-3.5 h-3.5 text-indigo-600" />
                <span>Reorder Queue</span>
                {reorderList.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                    {reorderList.length}
                  </span>
                )}
              </button>

              {/* Print / Export Report */}
              <button
                id="btn-export-report"
                onClick={handlePrintOrExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Print / Export</span>
              </button>

              {/* Live Refresh Button */}
              <button
                id="btn-refresh-dashboard"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Date Filter Bar Row */}
        <div className={`flex flex-wrap items-center justify-between gap-3 text-xs ${!hideHeaderBanner ? '' : ''}`}>
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5" id="date-filter-presets">
            <span className="text-slate-500 font-medium mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Period:
            </span>
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'this_week', label: 'This Week' },
                { id: 'this_month', label: 'This Month' },
                { id: 'custom', label: 'Custom Range' },
              ] as { id: DateFilterPreset; label: string }[]
            ).map(tab => (
              <button
                key={tab.id}
                id={`date-filter-tab-${tab.id}`}
                onClick={() => setSelectedPreset(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  selectedPreset === tab.id
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range Selector (Active when custom selected) */}
          {selectedPreset === 'custom' && (
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200 animate-fadeIn">
              <span className="text-slate-500 text-[11px] font-medium">From:</span>
              <input
                id="input-custom-start-date"
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-emerald-500"
              />
              <span className="text-slate-500 text-[11px] font-medium">To:</span>
              <input
                id="input-custom-end-date"
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-emerald-500"
              />
            </div>
          )}

          {/* Action Buttons when Header Banner is hidden */}
          {hideHeaderBanner && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                id="btn-view-reorder-list-compact"
                onClick={() => setIsReorderModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                <Package className="w-3.5 h-3.5 text-indigo-600" />
                <span>Reorder Queue</span>
                {reorderList.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                    {reorderList.length}
                  </span>
                )}
              </button>
              <button
                id="btn-export-report-compact"
                onClick={handlePrintOrExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Print</span>
              </button>
              <button
                id="btn-refresh-dashboard-compact"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
              </button>
            </div>
          )}

          {/* Active Period Label */}
          <div className="text-[11px] text-slate-500 font-mono bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
            Comparing: <strong className="text-slate-800">{kpis.dateRange.label}</strong> vs{' '}
            <span className="text-slate-600">{kpis.previousRange.label}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: TOP KPI CARDS ROW (8 Cards with +/- % Trend Indicators)          */}
      {/* ========================================================================= */}
      <div id="dashboard-kpi-cards-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Sales Revenue */}
        <div id="kpi-card-sales" className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-shadow">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {selectedPreset === 'today' ? "Today's Sales" : 'Period Sales'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {fmt(kpis.sales.current)}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-slate-500">{kpis.sales.invoiceCount} invoices issued</span>
              <div className={`flex items-center gap-0.5 font-bold ${kpis.sales.trend.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                {kpis.sales.trend.isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                <span>{kpis.sales.trend.percent}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Purchases / Inward Consignments */}
        <div id="kpi-card-purchases" className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-shadow">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {selectedPreset === 'today' ? "Today's Purchases" : 'Period Purchases'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {fmt(kpis.purchases.current)}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-slate-500">{kpis.purchases.billCount} inward bills</span>
              <div className={`flex items-center gap-0.5 font-bold ${kpis.purchases.trend.isPositive ? 'text-sky-600' : 'text-slate-600'}`}>
                {kpis.purchases.trend.isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                <span>{kpis.purchases.trend.percent}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Gross Profit */}
        <div id="kpi-card-gross-profit" className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-shadow">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Gross Profit
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {fmt(kpis.grossProfit.current)}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-slate-500">Margin: {(kpis.grossProfit?.marginPercent ?? 0).toFixed(1)}%</span>
              <div className={`flex items-center gap-0.5 font-bold ${kpis.grossProfit.trend.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                {kpis.grossProfit.trend.isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                <span>{kpis.grossProfit.trend.percent}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Net Profit */}
        <div id="kpi-card-net-profit" className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-shadow">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Net Profit
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-teal-900 tracking-tight">
              {fmt(kpis.netProfit.current)}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-slate-500">Net: {(kpis.netProfit?.marginPercent ?? 0).toFixed(1)}%</span>
              <div className={`flex items-center gap-0.5 font-bold ${kpis.netProfit.trend.isPositive ? 'text-teal-600' : 'text-rose-600'}`}>
                {kpis.netProfit.trend.isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                <span>{kpis.netProfit.trend.percent}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 5: Low Stock Count */}
        <div id="kpi-card-low-stock" className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-shadow">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Low Stock Alert
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-amber-900 tracking-tight flex items-baseline gap-2">
              <span>{kpis.lowStock.count}</span>
              <span className="text-xs font-normal text-slate-500">medicines below min</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-amber-700 font-medium">Reorder required</span>
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold text-[10px]">
                {kpis.lowStock.criticalItems} Critical
              </span>
            </div>
          </div>
        </div>

        {/* Card 6: Near Expiry Count */}
        <div id="kpi-card-near-expiry" className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-shadow">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Near Expiry (&lt;90d)
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <ClockAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-rose-900 tracking-tight flex items-baseline gap-2">
              <span>{kpis.nearExpiry.total}</span>
              <span className="text-xs font-normal text-slate-500">batches at risk</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px]">
              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded font-bold">
                &lt;30d: {kpis.nearExpiry.under30}
              </span>
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">
                &lt;60d: {kpis.nearExpiry.under60}
              </span>
              {kpis.nearExpiry.expired > 0 && (
                <span className="px-1.5 py-0.5 bg-red-600 text-white rounded font-bold">
                  Exp: {kpis.nearExpiry.expired}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card 7: Supplier Payables */}
        <div id="kpi-card-supplier-payables" className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-shadow">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Supplier Payables
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-purple-900 tracking-tight">
              {fmt(kpis.supplierPayables.amount)}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-slate-500">{kpis.supplierPayables.pendingBillsCount} pending supplier invoices</span>
              <span className="text-purple-700 font-medium text-[11px]">Due Terms</span>
            </div>
          </div>
        </div>

        {/* Card 8: Customer Receivables */}
        <div id="kpi-card-customer-receivables" className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-shadow">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Customer Receivables
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-indigo-900 tracking-tight">
              {fmt(kpis.customerReceivables.amount)}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-slate-500">{kpis.customerReceivables.creditAccountsCount} corporate credit accounts</span>
              <div className="flex items-center gap-0.5 text-emerald-600 font-bold">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>8.4%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: VISUAL CHARTS LAYOUT                                           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: LINE CHART (Sales vs Purchase Trend) */}
        <div id="chart-sales-vs-purchases" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <LineChartIcon className="w-4 h-4 text-emerald-600" />
                Sales vs Purchase Trend
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Financial cashflow comparison of sales income against inventory inwards.
              </p>
            </div>
            {/* Granularity Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
              <button
                id="btn-trend-daily"
                onClick={() => setTrendGranularity('daily')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  trendGranularity === 'daily'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daily (14d)
              </button>
              <button
                id="btn-trend-weekly"
                onClick={() => setTrendGranularity('weekly')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  trendGranularity === 'weekly'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Weekly (8w)
              </button>
            </div>
          </div>

          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesVsPurchasesTrend} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="displayDate" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  stroke="#cbd5e1" 
                  tickFormatter={val => `৳${val}`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `৳${Number(value).toFixed(2)}`,
                    name === 'sales' ? 'Sales Revenue' : name === 'purchases' ? 'Purchases' : 'Gross Profit'
                  ]}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  formatter={(value) => value === 'sales' ? 'Sales Revenue' : value === 'purchases' ? 'Inward Purchases' : 'Gross Profit'}
                />
                <Line
                  type="monotone"
                  dataKey="sales"
                  name="sales"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#10b981' }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="purchases"
                  name="purchases"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#6366f1' }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="grossProfit"
                  name="grossProfit"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 2: BAR CHART (Top 10 Selling Medicines & Fast vs Slow Moving Inventory) */}
        <div id="chart-medicines-velocity" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                {barChartMode === 'top_medicines' ? 'Top 10 Selling Medicines' : 'Fast vs Slow Moving Inventory'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {barChartMode === 'top_medicines' 
                  ? 'Ranked by gross sales revenue & dispensed unit volume.'
                  : 'Turnover velocity tracking overstock and stockout hazards.'}
              </p>
            </div>
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
              <button
                id="btn-mode-top-medicines"
                onClick={() => setBarChartMode('top_medicines')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  barChartMode === 'top_medicines'
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Top Medicines
              </button>
              <button
                id="btn-mode-velocity"
                onClick={() => setBarChartMode('velocity')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  barChartMode === 'velocity'
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Movement Velocity
              </button>
            </div>
          </div>

          <div className="w-full h-72">
            {barChartMode === 'top_medicines' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topSellingMedicines}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={val => `৳${val}`} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#334155' }}
                    stroke="#cbd5e1"
                    width={110}
                    tickFormatter={val => val.length > 15 ? `${val.substring(0, 14)}...` : val}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === 'revenue' ? `৳${Number(value).toFixed(2)}` : `${value} units`,
                      name === 'revenue' ? 'Sales Revenue' : 'Units Dispensed'
                    ]}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                  />
                  <Bar dataKey="revenue" name="revenue" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col justify-between overflow-y-auto pr-1">
                {/* Velocity Summary Badges */}
                <div className="grid grid-cols-3 gap-2 mb-2 text-center text-xs">
                  {movementInventory.summary.map(s => (
                    <div key={s.name} className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="block font-bold text-base text-slate-800">{s.count}</span>
                      <span className="text-[10px] text-slate-500">{s.name}</span>
                    </div>
                  ))}
                </div>

                {/* Ranked Velocity Items */}
                <div className="space-y-2 overflow-y-auto max-h-52 pr-1">
                  {movementInventory.all.slice(0, 7).map(item => (
                    <div key={item.medicineId} className="flex items-center justify-between text-xs p-2 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200/80">
                      <div className="min-w-0 pr-2">
                        <span className="font-semibold text-slate-800 block truncate">{item.name}</span>
                        <span className="text-[10px] text-slate-500">{item.category} • Current Stock: {item.currentStock}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-slate-700 text-right">{item.unitsSold} sold</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.movementType === 'fast' 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : item.movementType === 'medium'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {item.movementType}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CHART 3: DONUT CHARTS (Stock Valuation by Category & Payment Collection Split) */}
        <div id="chart-valuation-and-payments" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-teal-600" />
                Stock Valuation by Category
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Total active inventory retail worth: <strong className="text-slate-900">{fmt(totalStockValuation)}</strong>
              </p>
            </div>
          </div>

          <div className="w-full h-64 flex items-center">
            <div className="w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockValuationByCategory}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {stockValuationByCategory.map((entry, index) => (
                      <Cell key={`cell-cat-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `৳${Number(value).toFixed(2)}`,
                      name
                    ]}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Category Legend List */}
            <div className="w-1/2 space-y-1.5 overflow-y-auto max-h-56 pr-2 text-xs">
              {stockValuationByCategory.map(item => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0 pr-1">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-700 truncate text-[11px] font-medium">{item.name}</span>
                  </div>
                  <span className="font-mono text-slate-900 font-semibold text-[11px]">
                    {fmt(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Tender Split Ribbon */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Payment Collection Tender Split ({fmt(totalCollectedAmount)})
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {paymentCollectionSplit.map(tender => (
                <div key={tender.name} className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tender.color }} />
                    <span className="text-[11px] text-slate-600 font-medium truncate">{tender.name}</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="font-bold text-xs text-slate-900 font-mono">{fmt(tender.value)}</span>
                    <span className="text-[10px] font-bold text-slate-500">{tender.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CHART 4: AREA CHART (Expiry Risk Trend over Next 6 Months) */}
        <div id="chart-expiry-risk-trend" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Expiry Risk Trend (Next 6 Months)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Financial risk exposure of batches expiring each month.
              </p>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-rose-50 text-rose-700 text-xs font-semibold">
              <ClockAlert className="w-3.5 h-3.5" />
              <span>FEFO Radar</span>
            </div>
          </div>

          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={expiryRiskOverTime} margin={{ top: 10, right: 20, left: -5, bottom: 5 }}>
                <defs>
                  <linearGradient id="expiryRiskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="cumulativeRiskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  stroke="#cbd5e1" 
                  tickFormatter={val => `৳${val}`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `৳${Number(value).toFixed(2)}`,
                    name === 'valueAtRisk' ? 'Expiring in Month' : 'Cumulative Risk'
                  ]}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                <Area
                  type="monotone"
                  dataKey="valueAtRisk"
                  name="Monthly Expiry Value"
                  stroke="#f43f5e"
                  fillOpacity={1}
                  fill="url(#expiryRiskGrad)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativeRisk"
                  name="Cumulative Exposure"
                  stroke="#f97316"
                  fillOpacity={1}
                  fill="url(#cumulativeRiskGrad)"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 4: QUICK ALERT & SUMMARY TABLES                                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TABLE 1: TOP 5 MEDICINES ABOUT TO EXPIRE SOON */}
        <div id="table-near-expiry-alerts" className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Top Medicines Expiring Soon (Priority FEFO Radar)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Immediate FEFO dispensing priority to prevent inventory write-offs.
              </p>
            </div>
            {onNavigateTab && (
              <button
                id="btn-nav-batches-expiry"
                onClick={() => onNavigateTab('batches_expiry')}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
              >
                <span>View All Batches</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Medicine & Batch</th>
                  <th className="px-3 py-2.5">Expiry Date</th>
                  <th className="px-3 py-2.5">Stock</th>
                  <th className="px-3 py-2.5">Risk Level</th>
                  <th className="px-3 py-2.5 text-right">Value at Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {nearExpiryBatches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No expired or near-expiry batches detected. Inventory is in safe range.
                    </td>
                  </tr>
                ) : (
                  nearExpiryBatches.map(batch => {
                    // Risk level color styling
                    const isExpired = batch.riskLevel === 'expired';
                    const isCritical = batch.riskLevel === 'critical';
                    const isWarning = batch.riskLevel === 'warning';

                    return (
                      <tr key={batch.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-900">{batch.medicineName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Batch: {batch.batchNumber} • {batch.rackLocation}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono">
                          <span className="text-slate-800">{batch.expiryDate}</span>
                          <span className={`block text-[10px] font-bold ${
                            isExpired ? 'text-red-600' : isCritical ? 'text-orange-600' : 'text-amber-600'
                          }`}>
                            {batch.daysLeft <= 0 ? 'EXPIRED' : `${batch.daysLeft} days left`}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-900">
                          {batch.currentStock} pcs
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-tight uppercase ${
                            isExpired 
                              ? 'bg-red-600 text-white shadow-xs animate-pulse' 
                              : isCritical
                              ? 'bg-orange-100 text-orange-800 border border-orange-300'
                              : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                          }`}>
                            {isExpired ? 'Expired (Locked)' : isCritical ? '<30d (Critical)' : '<60d (Warning)'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                          {fmt(batch.totalValueAtRisk)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* TABLE 2: LOW STOCK ALERT TABLE WITH INSTANT REORDER BUTTON */}
        <div id="table-low-stock-alerts" className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-amber-500" />
                Low Stock Threshold Alerts
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Medicines at or below minimum reorder level. Instant supplier replenishment.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onNavigateTab && (
                <button
                  id="btn-nav-po-suggester"
                  onClick={() => onNavigateTab('purchases')}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto PO Suggester</span>
                </button>
              )}
              {onNavigateTab && (
                <button
                  id="btn-nav-inventory"
                  onClick={() => onNavigateTab('inventory')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer transition"
                >
                  <span>Stock Master</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Medicine</th>
                  <th className="px-3 py-2.5">Stock / Min</th>
                  <th className="px-3 py-2.5">Deficit</th>
                  <th className="px-3 py-2.5">Supplier</th>
                  <th className="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowStockAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      All medicines are currently well above safety stock thresholds.
                    </td>
                  </tr>
                ) : (
                  lowStockAlerts.map(item => {
                    const isInList = reorderList.some(r => r.medicineId === item.medicineId);

                    return (
                      <tr key={item.medicineId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-900">{item.medicineName}</div>
                          <div className="text-[10px] text-slate-500">{item.genericName} • {item.dosageForm}</div>
                        </td>
                        <td className="px-3 py-2.5 font-mono">
                          <span className="font-bold text-rose-600">{item.currentStock}</span>
                          <span className="text-slate-400"> / {item.reorderLevel} min</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">
                            -{item.deficit} {item.unitOfMeasure}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-slate-600 truncate max-w-[120px]">
                          {item.supplierName}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {isInList ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded font-semibold border border-emerald-200">
                              <Check className="w-3 h-3 text-emerald-600" />
                              Added
                            </span>
                          ) : (
                            <button
                              id={`btn-reorder-${item.medicineId}`}
                              onClick={() => handleAddToReorder(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded text-[11px] shadow-xs cursor-pointer transition-colors"
                            >
                              <PlusCircle className="w-3 h-3" />
                              Reorder
                            </button>
                          )}
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

      {/* ========================================================================= */}
      {/* REORDER LIST SLIDE-OVER / MODAL                                            */}
      {/* ========================================================================= */}
      {isReorderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-fadeIn">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Purchase Reorder Queue</h3>
                  <p className="text-xs text-slate-500">
                    {reorderList.length} items staged for supplier procurement order.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsReorderModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Table of Items */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
              {reorderList.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Package className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-600">Reorder Queue is Empty</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Click "Reorder" next to any low-stock medicine on the dashboard to stage replenishment.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {reorderList.map(item => (
                    <div key={item.id} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-bold text-slate-900 block">{item.medicineName}</span>
                        <span className="text-slate-500 text-[11px]">
                          Supplier: <strong>{item.supplierName || 'Apex Pharma Ltd'}</strong> • Stock: {item.currentStock} / Min: {item.reorderLevel}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-800 px-2.5 py-1 rounded font-mono font-bold">
                          Order: {item.suggestedQty} pcs
                        </span>
                        <button
                          onClick={() => handleRemoveFromReorder(item.medicineId, item.medicineName)}
                          className="text-rose-500 hover:text-rose-700 font-bold p-1 rounded cursor-pointer"
                          title="Remove from queue"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Staged for immediate inward Purchase Order generation.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsReorderModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>
                {onNavigateTab && (
                  <button
                    onClick={() => {
                      setIsReorderModalOpen(false);
                      onNavigateTab('purchases');
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Launch Auto PO Suggester</span>
                  </button>
                )}
                {onNavigateTab && reorderList.length > 0 && (
                  <button
                    onClick={() => {
                      setIsReorderModalOpen(false);
                      onNavigateTab('purchases');
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Manual PO Form</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
