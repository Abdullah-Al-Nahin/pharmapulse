import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Truck, 
  Receipt, 
  CreditCard, 
  Boxes, 
  AlertTriangle, 
  Clock, 
  Sparkles, 
  Brain, 
  ShieldAlert, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  RefreshCw, 
  Printer, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  ExternalLink, 
  Building2, 
  ShieldCheck, 
  Percent, 
  Wallet, 
  Flame, 
  Snowflake, 
  FileText, 
  SlidersHorizontal,
  Info,
  Package,
  Layers
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { 
  ExecutiveTimeframe, 
  AIStockAnomalyCategory, 
  AIFinancialAnomalyCategory 
} from '../../types/executiveDashboard';
import { ExecutiveDashboardService } from '../../services/executiveDashboardService';
import { PharmacyService } from '../../services/pharmacyService';
import { BranchService } from '../../services/branchService';
import { useAuth } from '../../context/AuthContext';
import { getCurrentLocale, setLocale, subscribeLocale } from '../../utils/i18nFormatter';
import { BranchInfo } from '../../types/pharmapulse';

interface ExecutiveDashboardViewProps {
  onNavigateToTab?: (tab: string) => void;
}

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  onNavigateToTab,
}) => {
  const { currentUser } = useAuth();
  const [version, setVersion] = useState(0);

  // --- Branch state ---
  const [branches, setBranches] = useState<BranchInfo[]>(() => BranchService.getBranches());
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    if (currentUser?.branchId) return currentUser.branchId;
    const brs = BranchService.getBranches();
    return brs.length > 0 ? brs[0].id : 'all';
  });

  // --- Timeframe state ---
  const [timeframe, setTimeframe] = useState<ExecutiveTimeframe>('today');
  const [selectedLanguage, setSelectedLanguage] = useState<'EN' | 'BN'>(() =>
    getCurrentLocale() === 'bn' ? 'BN' : 'EN'
  );
  const [selectedStockCategory, setSelectedStockCategory] = useState<string>('all');
  const [selectedAnomalyCategory, setSelectedAnomalyCategory] = useState<string>('all');
  const [selectedForecastIndex, setSelectedForecastIndex] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    return subscribeLocale((loc) => {
      setSelectedLanguage(loc === 'bn' ? 'BN' : 'EN');
    });
  }, []);

  // Subscribe to live changes in pharmacy and branch stores
  useEffect(() => {
    const unsubPharmacy = PharmacyService.subscribe(() => {
      setVersion((v) => v + 1);
    });
    const unsubBranch = BranchService.subscribe(() => {
      setBranches(BranchService.getBranches());
      setVersion((v) => v + 1);
    });

    return () => {
      unsubPharmacy();
      unsubBranch();
    };
  }, []);

  // Update selectedBranchId if currentUser changes and not set
  useEffect(() => {
    if (currentUser?.branchId && selectedBranchId === 'all' && branches.some((b) => b.id === currentUser.branchId)) {
      setSelectedBranchId(currentUser.branchId);
    }
  }, [currentUser, branches]);

  // Load live data from service (100% dynamic, real calculations scoped to branch)
  const kpis = useMemo(
    () => ExecutiveDashboardService.getFinancialKpis(timeframe, selectedBranchId),
    [timeframe, selectedBranchId, version]
  );
  const fastMoving = useMemo(
    () => ExecutiveDashboardService.getFastMovingProducts(selectedBranchId),
    [selectedBranchId, version]
  );
  const slowMoving = useMemo(
    () => ExecutiveDashboardService.getSlowMovingProducts(selectedBranchId),
    [selectedBranchId, version]
  );
  const forecastMedicines = useMemo(
    () => ExecutiveDashboardService.getAISalesForecastMedicines(selectedBranchId),
    [selectedBranchId, version]
  );
  const stockAnomalies = useMemo(
    () => ExecutiveDashboardService.getAIStockIntelligence(selectedBranchId),
    [selectedBranchId, version]
  );
  const financialAnomalies = useMemo(
    () => ExecutiveDashboardService.getAIFinancialAnomalies(selectedBranchId),
    [selectedBranchId, version]
  );
  const executiveBriefing = useMemo(
    () => ExecutiveDashboardService.generateExecutiveBriefing(timeframe, selectedBranchId),
    [timeframe, selectedBranchId, version]
  );

  const activeForecast = forecastMedicines[selectedForecastIndex] || forecastMedicines[0] || {
    id: 'forecast-fallback',
    medicineName: 'Paracetamol 500mg (Paracetamol)',
    genericName: 'Paracetamol',
    strength: '500mg',
    form: 'Tablet',
    manufacturer: 'Beximco Pharmaceuticals Ltd',
    leadTimeDays: 2,
    currentStock: 180,
    forecastDays: 14,
    predictedDemand: 320,
    recommendedPurchase: 200,
    safetyBuffer: 60,
    confidenceScore: 94.5,
    primaryDriver: 'Baseline outpatient analgesic demand',
    dailyForecast: [],
  };

  const currentBranchObj = branches.find((b) => b.id === selectedBranchId);
  const activeBranchName =
    selectedBranchId === 'all'
      ? `Consolidated Enterprise (${branches.length} Branches)`
      : currentBranchObj
      ? `${currentBranchObj.name} [${currentBranchObj.code}]`
      : currentUser?.branchName || 'Central Pharmacy';

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setVersion((v) => v + 1);
      setBranches(BranchService.getBranches());
      showNotification(
        selectedLanguage === 'BN' 
          ? 'রিয়েল-টাইম এক্সিকিউটিভ ডেটা আপডেট সম্পন্ন হয়েছে!' 
          : 'Executive live data refreshed successfully!'
      );
    }, 450);
  };

  const showNotification = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const handleDraftPurchaseOrder = (medName: string, units: number) => {
    // Attempt auto-creation in PharmacyService if supplier exists
    try {
      const suppliers = PharmacyService.getSuppliers();
      const medicines = PharmacyService.getMedicines();
      const med = medicines.find(m => m.name.toLowerCase().includes(medName.toLowerCase()) || medName.toLowerCase().includes(m.name.toLowerCase()));
      const supplier = suppliers[0];
      
      if (supplier && med) {
        PharmacyService.createPurchaseOrder({
          supplierId: supplier.id,
          paymentTerms: 'Credit 30 Days',
          expectedDeliveryDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
          notes: `AI-Recommended Purchase Order for ${medName} based on 14-day demand forecast.`,
          items: [
            {
              id: `pitem-${Date.now()}`,
              medicineId: med.id,
              medicineName: med.name,
              dosageForm: med.dosageForm || 'Tablet',
              orderedQuantity: units,
              quantity: units,
              packSize: med.packSize || 10,
              purchasePrice: 1.8,
              mrp: 2.5,
              sellingPrice: 2.5,
              taxRate: 0,
              totalAmount: units * 1.8,
              discountPercent: 0,
            }
          ]
        });
      }
    } catch {
      // safe fallback
    }

    showNotification(
      selectedLanguage === 'BN'
        ? `সফলভাবে ${units} ইউনিটের ক্রয় আদেশ (Purchase Order) ড্রাফট তৈরি করা হয়েছে!`
        : `Successfully auto-drafted Purchase Order for ${units} units of ${medName}!`
    );
  };

  // Filter stock anomalies
  const filteredStockAnomalies = useMemo(() => {
    if (selectedStockCategory === 'all') return stockAnomalies;
    return stockAnomalies.filter(item => item.category === selectedStockCategory);
  }, [stockAnomalies, selectedStockCategory]);

  // Filter financial anomalies
  const filteredFinancialAnomalies = useMemo(() => {
    if (selectedAnomalyCategory === 'all') return financialAnomalies;
    return financialAnomalies.filter(item => item.category === selectedAnomalyCategory);
  }, [financialAnomalies, selectedAnomalyCategory]);

  // Total anomalies count
  const criticalIssuesCount = stockAnomalies.filter(a => a.severity === 'critical').length +
    financialAnomalies.filter(a => a.severity === 'critical').length;

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 dark:text-slate-100">
      {/* Toast Notification */}
      {actionSuccessMsg && (
        <div className="fixed top-5 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-600 text-white shadow-xl shadow-emerald-700/25 text-xs font-semibold animate-slide-down">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* Top Executive Command Header Ribbon                     */}
      {/* ======================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-slate-700/60 relative overflow-hidden">
        {/* Subtle decorative background circles */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-48 -bottom-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                CEO / Owner Executive Suite
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Node: {activeBranchName}
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                Executive Dashboard
                {selectedLanguage === 'BN' && (
                  <span className="text-base sm:text-lg font-medium text-slate-300">
                    (মালিকানা ও আর্থিক নিয়ন্ত্রণ কেন্দ্র)
                  </span>
                )}
              </h1>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Real-time executive oversight of hospital pharmacy turnover, gross and net profitability margins, working capital liquidity, predictive 14-day replenishment forecasts, and AI fraud protection watchdog.
            </p>
          </div>

          {/* Action buttons, Branch selector & Timeframe selector */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-2.5 shrink-0">
            {/* Branch Selector Dropdown */}
            <div className="relative">
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="appearance-none pl-7 pr-7 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-700/80 text-xs font-bold text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 transition shadow-inner"
                title="Filter executive dashboard by branch"
              >
                <option value="all">🏢 All Branches (Consolidated)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    📍 {b.name} ({b.code})
                  </option>
                ))}
              </select>
              <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <ChevronRight className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
            </div>

            {/* Timeframe pill selector */}
            <div className="inline-flex p-1 bg-slate-950/60 rounded-xl border border-slate-700/80 shadow-inner">
              {(['today', 'yesterday', 'week', 'month', 'ytd'] as ExecutiveTimeframe[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                    timeframe === tf
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  {tf === 'today' ? (selectedLanguage === 'BN' ? 'আজ (Today)' : 'Today') :
                   tf === 'yesterday' ? (selectedLanguage === 'BN' ? 'গতকাল' : 'Yesterday') :
                   tf === 'week' ? (selectedLanguage === 'BN' ? 'এই সপ্তাহ' : 'This Week') :
                   tf === 'month' ? (selectedLanguage === 'BN' ? 'এই মাস' : 'This Month') : 'YTD'}
                </button>
              ))}
            </div>

            {/* Language switch & Refresh */}
            <div className="flex items-center gap-2">
              <button
                data-no-translate="true"
                onClick={() => {
                  const next = selectedLanguage === 'BN' ? 'EN' : 'BN';
                  setSelectedLanguage(next);
                  setLocale(next === 'BN' ? 'bn' : 'en');
                }}
                title="Toggle English / Bengali"
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-600 transition-colors cursor-pointer"
              >
                {selectedLanguage === 'BN' ? 'EN' : 'বাং'}
              </button>

              <button
                onClick={handleRefresh}
                title="Refresh Live Metrics"
                className={`p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-all cursor-pointer ${
                  isRefreshing ? 'animate-spin text-emerald-400' : ''
                }`}
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={() => window.print()}
                title="Print Executive Briefing Report"
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Critical Alerts Ribbon */}
        {criticalIssuesCount > 0 && (
          <div className="mt-4 pt-3.5 border-t border-slate-700/60 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 text-rose-300 font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
              <span>
                {selectedLanguage === 'BN'
                  ? `সতর্কতা: ${criticalIssuesCount}টি গুরুত্বপূর্ণ পর্যবেক্ষণ সনাক্ত হয়েছে (মেয়াদোত্তীর্ণ ঝুঁকি, অতিরিক্ত স্টক ও অস্বাভাবিক ছাড়)!`
                  : `Attention: ${criticalIssuesCount} critical anomalies detected across inventory and cashier transactions!`}
              </span>
            </div>
            <a
              href="#ai-stock-intelligence"
              className="text-amber-300 hover:text-amber-200 font-bold underline flex items-center gap-1 text-[11px]"
            >
              <span>{selectedLanguage === 'BN' ? 'AI ইনভেস্টিগেশন দেখুন' : 'Jump to AI Investigation'}</span>
              <ChevronRight className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: CORE EXECUTIVE FINANCIAL KPIs                 */}
      {/* (Today's Sales, Gross Profit, Net Profit, Purchase,      */}
      {/* Expense, Outstanding, Stock Value, Expired, Near Expiry) */}
      {/* ======================================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-5 bg-emerald-600 rounded-full" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {selectedLanguage === 'BN' ? 'আর্থিক সারসংক্ষেপ ও কেপিআই (Financial KPIs)' : 'Financial KPIs & Operating Margins'}
            </h2>
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {selectedLanguage === 'BN' 
              ? `ফিল্টার: ${timeframe.toUpperCase()} (মুদ্রা: ৳ BDT)` 
              : `Active Period: ${timeframe.toUpperCase()} (Currency: ৳ BDT)`}
          </span>
        </div>

        {/* 9 Core Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
          {/* 1. Today's Sales */}
          <div className="bg-white dark:bg-[#161b26] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {timeframe === 'today' ? "Today's Sales" : `${timeframe.toUpperCase()} Sales`}
                </span>
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
                  ৳ {kpis.sales.amount.toLocaleString()}
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <DollarSign className="w-6 h-6 stroke-[2.2]" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <ArrowUpRight className="w-3.5 h-3.5" />
                +{kpis.sales?.growthVsPrevPeriod ?? 0}% vs prev
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {kpis.sales?.transactionsCount ?? 0} bills (Avg ৳{(kpis.sales?.avgBasketValue ?? 0).toFixed(0)})
              </span>
            </div>

            {/* Split pills */}
            <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-medium text-slate-600 dark:text-slate-400">
              <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">Cash: ৳{(((kpis.sales?.cashAmount ?? 0)) / 1000).toFixed(1)}k</span>
              <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">MFS: ৳{(((kpis.sales?.mfsAmount ?? 0)) / 1000).toFixed(1)}k</span>
              <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">Card: ৳{(((kpis.sales?.cardAmount ?? 0)) / 1000).toFixed(1)}k</span>
            </div>
          </div>

          {/* 2. Gross Profit */}
          <div className="bg-white dark:bg-[#161b26] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Gross Profit
                </span>
                <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                  ৳ {kpis.grossProfit.amount.toLocaleString()}
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/80 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <TrendingUp className="w-6 h-6 stroke-[2.2]" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                <Percent className="w-3.5 h-3.5" />
                {kpis.grossProfit.marginPercent}% Gross Margin
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                COGS: ৳{(kpis.sales.amount - kpis.grossProfit.amount).toLocaleString()}
              </span>
            </div>

            <div className="mt-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${kpis.grossProfit.marginPercent}%` }} 
              />
            </div>
          </div>

          {/* 3. Net Profit */}
          <div className="bg-white dark:bg-[#161b26] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Net Profit (Take-Home)
                </span>
                <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono tracking-tight">
                  ৳ {kpis.netProfit.amount.toLocaleString()}
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Wallet className="w-6 h-6 stroke-[2.2]" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {kpis.netProfit.marginPercent}% Net Margin
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Less OpEx: -৳{kpis.netProfit.operatingExpenseDeduction.toLocaleString()}
              </span>
            </div>

            <div className="mt-2.5 text-[10px] text-slate-500 dark:text-slate-400">
              Clear profit after all operating deductions and salaries
            </div>
          </div>

          {/* 4. Purchase */}
          <div className="bg-white dark:bg-[#161b26] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Purchase (Procurement)
                </span>
                <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 font-mono tracking-tight">
                  ৳ {kpis.purchase.amount.toLocaleString()}
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Truck className="w-6 h-6 stroke-[2.2]" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {kpis.purchase.billsCount} Inward GRN Bills
              </span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                {kpis.purchase.pendingDeliveries} Deliveries in Transit
              </span>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500">
              <span>Primary Vendor: Square & Incepta</span>
              <button 
                onClick={() => onNavigateToTab?.('purchases')}
                className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
              >
                View POs &rarr;
              </button>
            </div>
          </div>

          {/* 5. Expense */}
          <div className="bg-white dark:bg-[#161b26] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Operating Expense (OpEx)
                </span>
                <div className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 font-mono tracking-tight">
                  ৳ {kpis.expense.amount.toLocaleString()}
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <Receipt className="w-6 h-6 stroke-[2.2]" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Salaries: ৳{kpis.expense.categories.salaries.toLocaleString()}</span>
              <span className="text-slate-500 dark:text-slate-400">Utility/Cold: ৳{kpis.expense.categories.utilitiesAndColdChain.toLocaleString()}</span>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500">
              <span>Packaging: ৳{kpis.expense.categories.packagingAndStationery.toLocaleString()}</span>
              <span>Loss: ৳{kpis.expense.categories.wasteAndLoss.toLocaleString()}</span>
            </div>
          </div>

          {/* 6. Outstanding (Customer Receivables + Supplier Payables) */}
          <div className="bg-white dark:bg-[#161b26] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div className="space-y-1 min-w-0">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Outstanding Balances
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono tracking-tight truncate">
                  ৳ {(Number(kpis.outstanding.customerReceivables || 0) + Number(kpis.outstanding.supplierPayables || 0)).toLocaleString()}
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <CreditCard className="w-6 h-6 stroke-[2.2]" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs gap-2">
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold truncate">
                Customer Dues: ৳{Number(kpis.outstanding.customerReceivables || 0).toLocaleString()}
              </span>
              <span className="text-rose-700 dark:text-rose-400 font-semibold truncate">
                Supplier Dues: ৳{Number(kpis.outstanding.supplierPayables || 0).toLocaleString()}
              </span>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500">
              <span className="truncate">Net Balance: ৳{Number(kpis.outstanding.netBalance || 0).toLocaleString()}</span>
              <button 
                onClick={() => onNavigateToTab?.('customers')}
                className="text-amber-600 dark:text-amber-400 hover:underline font-semibold cursor-pointer shrink-0"
              >
                Manage Dues &rarr;
              </button>
            </div>
          </div>

          {/* 7. Stock Value */}
          <div className="bg-white dark:bg-[#161b26] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Stock Value (Asset Valuation)
                </span>
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
                  ৳ {kpis.stockValue.costValue.toLocaleString()}
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300">
                <Boxes className="w-6 h-6 stroke-[2.2]" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                Retail Value: ৳{kpis.stockValue.retailValue.toLocaleString()}
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                +৳{kpis.stockValue.unrealizedProfit.toLocaleString()} Potential
              </span>
            </div>

            <div className="mt-2.5 text-[10px] text-slate-500">
              {kpis.stockValue.totalUnits.toLocaleString()} total units across {kpis.stockValue.totalSKUs} pharmaceutical SKUs
            </div>
          </div>

          {/* 8. Expired Stock */}
          <div className="bg-white dark:bg-[#161b26] p-5 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Expired Stock (Scrap / Loss)
                </span>
                <div className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 font-mono tracking-tight">
                  ৳ {kpis.expiredStock.costValue.toLocaleString()}
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <XCircle className="w-6 h-6 stroke-[2.2]" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-rose-100 dark:border-rose-950 flex items-center justify-between text-xs">
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                {kpis.expiredStock.unitsCount} Units ({kpis.expiredStock.batchesCount} Batches)
              </span>
              <span className="text-slate-500">
                {kpis.expiredStock.percentOfTotalStock}% of total stock
              </span>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[10px] text-rose-600 dark:text-rose-400 font-medium">
              <span>Zero-sale lockout active in Quarantine</span>
              <button 
                onClick={() => onNavigateToTab?.('batches_expiry')}
                className="hover:underline font-bold cursor-pointer"
              >
                Audit Vault &rarr;
              </button>
            </div>
          </div>

          {/* 9. Near Expiry */}
          <div className="bg-white dark:bg-[#161b26] p-5 rounded-2xl border border-orange-200 dark:border-orange-900/60 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                  Near Expiry (≤ 90 Days Risk)
                </span>
                <div className="text-3xl font-extrabold text-orange-600 dark:text-orange-400 font-mono tracking-tight">
                  ৳ {kpis.nearExpiry.costValue.toLocaleString()}
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 flex items-center justify-center text-orange-600 dark:text-orange-400">
                <Clock className="w-6 h-6 stroke-[2.2]" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-orange-100 dark:border-orange-950 flex items-center justify-between text-xs">
              <span className="font-semibold text-orange-600 dark:text-orange-400">
                {kpis.nearExpiry.unitsCount} Units ({kpis.nearExpiry.batchesCount} Batches)
              </span>
              <span className="text-slate-500">
                FEFO priority auto-push
              </span>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[10px] text-orange-700 dark:text-orange-400 font-medium">
              <span>Priority dispensing in POS active</span>
              <button 
                onClick={() => onNavigateToTab?.('batches_expiry')}
                className="hover:underline font-bold cursor-pointer"
              >
                View Batches &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 2: AI PHARMACY ANALYTICS (NEXT-GEN INTELLIGENCE)  */}
      {/* ======================================================== */}
      <div id="ai-pharmacy-analytics" className="space-y-5 pt-2">
        <div className="flex items-center justify-between flex-wrap gap-2 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                AI Pharmacy Analytics
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Next-Gen Intelligence Engine
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                14-day machine-learning demand forecasting, stock risk intelligence, and real-time fraud radar.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">
              Forecast Target:
            </span>
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5">
              {forecastMedicines.map((m, idx) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedForecastIndex(idx)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    selectedForecastIndex === idx
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {m.genericName.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* 2A: AI Sales Forecast (Exact User Specification)     */}
        {/* "আগামী 14 দিনে Paracetamol 500mg-এর সম্ভাব্য চাহিদা: 320 units" */}
        {/* "Current stock: 180" | "Recommended purchase: 200"   */}
        {/* ---------------------------------------------------- */}
        <div className="bg-white dark:bg-[#161b26] rounded-2xl border border-indigo-100 dark:border-slate-800 p-6 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left Col: High-Impact AI Prediction Card */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
                <Brain className="w-4 h-4" />
                <span>AI Sales Forecast (14-Day Outlook)</span>
              </div>

              {/* Prominent High-Contrast Callout Card */}
              <div className="bg-gradient-to-br from-indigo-50/80 via-white to-emerald-50/60 dark:from-slate-800/80 dark:via-[#161b26] dark:to-emerald-950/30 p-5 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 shadow-xs space-y-3.5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                      {activeForecast.medicineName}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activeForecast.manufacturer} &bull; {activeForecast.form} ({activeForecast.strength})
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    {activeForecast.confidenceScore}% Confidence
                  </span>
                </div>

                {/* THE USER'S EXACT PHRASE IN HIGHLIGHT */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/90 border border-indigo-200 dark:border-indigo-900 space-y-2">
                  <div className="text-sm sm:text-base font-bold text-indigo-950 dark:text-indigo-200 leading-snug">
                    {selectedLanguage === 'BN' ? (
                      <>
                        আগামী {activeForecast.forecastDays} দিনে{' '}
                        <span className="text-indigo-600 dark:text-indigo-400 underline decoration-indigo-400 font-extrabold">
                          {activeForecast.medicineName}
                        </span>
                        -এর সম্ভাব্য চাহিদা:{' '}
                        <span className="text-emerald-600 dark:text-emerald-400 font-black text-lg">
                          {activeForecast.predictedDemand} units
                        </span>
                      </>
                    ) : (
                      <>
                        Estimated {activeForecast.forecastDays}-day demand for{' '}
                        <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">
                          {activeForecast.medicineName}
                        </span>
                        :{' '}
                        <span className="text-emerald-600 dark:text-emerald-400 font-black text-lg">
                          {activeForecast.predictedDemand} units
                        </span>
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Current stock:
                      </span>
                      <span className="text-xl font-black text-slate-800 dark:text-white font-mono">
                        {activeForecast.currentStock}
                      </span>
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-950/60 p-2 rounded-lg text-left border border-emerald-200 dark:border-emerald-800">
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                        Recommended purchase:
                      </span>
                      <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {activeForecast.recommendedPurchase}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                  <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Primary Driver:</strong> {activeForecast.primaryDriver}
                  </span>
                </div>

                {/* Direct Action Button */}
                <button
                  onClick={() => handleDraftPurchaseOrder(activeForecast.medicineName, activeForecast.recommendedPurchase)}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>
                    {selectedLanguage === 'BN' 
                      ? `অটো-ড্রাফট ক্রয় আদেশ (${activeForecast.recommendedPurchase} units)` 
                      : `Auto-Draft Purchase Order (${activeForecast.recommendedPurchase} Units)`}
                  </span>
                </button>
              </div>
            </div>

            {/* Right Col: 14-Day Demand & Inventory Burn-Down Trend Chart */}
            <div className="lg:col-span-7 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 px-1">
                <span>14-Day Projected Daily Consumption & Stock Burn-down</span>
                <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Projected Stockout at Day 8 without PO
                </span>
              </div>

              <div className="h-64 w-full bg-slate-50/60 dark:bg-slate-900/40 rounded-xl p-2 border border-slate-100 dark:border-slate-800">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activeForecast.dailyForecast} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="predictedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Area 
                      type="monotone" 
                      dataKey="predictedDemand" 
                      name="Predicted Daily Demand" 
                      stroke="#4f46e5" 
                      fillOpacity={1} 
                      fill="url(#predictedGrad)" 
                      strokeWidth={2.5}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="projectedStockRemaining" 
                      name="Stock Remaining" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                Calculated using 30-day historical OPD run-rate, active doctor booking calendars, and regional monsoon infection weighting.
              </p>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* 2B: AI Stock Intelligence & Anomaly Detection        */}
        {/* Overstock detected | Understock detected |            */}
        {/* Dead stock detected | Expiry risk                     */}
        {/* ---------------------------------------------------- */}
        <div id="ai-stock-intelligence" className="bg-white dark:bg-[#161b26] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Boxes className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>AI Stock Intelligence & Inventory Health</span>
              </h3>
              <p className="text-xs text-slate-500">
                Automated continuous scanning for overstock, severe understock, dead capital, and expiry exposure.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
              {[
                { id: 'all', label: 'All Anomalies' },
                { id: 'overstock', label: 'Overstock' },
                { id: 'understock', label: 'Understock' },
                { id: 'dead_stock', label: 'Dead Stock' },
                { id: 'expiry_risk', label: 'Expiry Risk' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setSelectedStockCategory(pill.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedStockCategory === pill.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Anomaly Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {filteredStockAnomalies.map((anomaly) => {
              const isOverstock = anomaly.category === 'overstock';
              const isUnderstock = anomaly.category === 'understock';
              const isDeadStock = anomaly.category === 'dead_stock';
              const isExpiryRisk = anomaly.category === 'expiry_risk';

              const badgeColor = 
                isUnderstock ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900' :
                isExpiryRisk ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900' :
                isDeadStock ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-900' :
                'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900';

              return (
                <div
                  key={anomaly.id}
                  className="p-4 rounded-xl bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${badgeColor}`}>
                        {isOverstock && 'Overstock Detected'}
                        {isUnderstock && 'Understock / Stockout Risk'}
                        {isDeadStock && 'Dead Stock Detected'}
                        {isExpiryRisk && 'High Expiry Risk'}
                      </span>
                      {anomaly.trappedCapital > 0 && (
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono">
                          ৳ {anomaly.trappedCapital.toLocaleString()} at risk
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {anomaly.medicineName}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {anomaly.genericName} {anomaly.batchNumber && `&bull; Batch #${anomaly.batchNumber}`}
                      </p>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      <strong>AI Diagnosis:</strong> {anomaly.aiDiagnosis}
                    </p>

                    <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                      <strong>AI Suggested Action:</strong> {anomaly.aiSuggestedAction}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-slate-800 text-xs">
                    <span className="text-[11px] text-slate-500">
                      {anomaly.currentStock} in stock ({anomaly.daysSupplyOrStagnant} days)
                    </span>

                    {anomaly.actionType === 'draft_po' && (
                      <button
                        onClick={() => handleDraftPurchaseOrder(anomaly.medicineName, 120)}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        Auto-Order Now
                      </button>
                    )}

                    {anomaly.actionType === 'discount_clearance' && (
                      <button
                        onClick={() => showNotification(`Clearance promotion applied for ${anomaly.medicineName}`)}
                        className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        Apply Promo
                      </button>
                    )}

                    {anomaly.actionType === 'transfer_branch' && (
                      <button
                        onClick={() => onNavigateToTab?.('multi_branch')}
                        className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        Transfer to Br#2
                      </button>
                    )}

                    {anomaly.actionType === 'quarantine' && (
                      <button
                        onClick={() => onNavigateToTab?.('batches_expiry')}
                        className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        Audit Batch
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* 2C: AI Financial & Fraud Radar                        */}
        {/* Abnormal sales | Unusual discount | Suspicious refund | */}
        {/* Purchase price anomaly                                */}
        {/* ---------------------------------------------------- */}
        <div id="ai-fraud-radar" className="bg-white dark:bg-[#161b26] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                <span>AI Financial & Fraud Anomaly Radar</span>
              </h3>
              <p className="text-xs text-slate-500">
                Auditing cashier overrides, high-risk refunds, vendor price inflations, and off-hour dispensing.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
              {[
                { id: 'all', label: 'All Alerts' },
                { id: 'abnormal_sales', label: 'Abnormal Sales' },
                { id: 'unusual_discount', label: 'Unusual Discount' },
                { id: 'suspicious_refund', label: 'Suspicious Refund' },
                { id: 'purchase_price_anomaly', label: 'Price Anomaly' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setSelectedAnomalyCategory(pill.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedAnomalyCategory === pill.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredFinancialAnomalies.map((item) => {
              const isAbnormalSale = item.category === 'abnormal_sales';
              const isDiscount = item.category === 'unusual_discount';
              const isRefund = item.category === 'suspicious_refund';
              const isPriceAnomaly = item.category === 'purchase_price_anomaly';

              const severityColor = 
                item.severity === 'critical' ? 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/60 dark:border-rose-900' :
                item.severity === 'high' ? 'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-950/60 dark:border-orange-900' :
                'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/60 dark:border-blue-900';

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${severityColor}`}>
                        {isAbnormalSale && 'Abnormal Sales Spike'}
                        {isDiscount && 'Unusual Discount Alert'}
                        {isRefund && 'Suspicious Refund'}
                        {isPriceAnomaly && 'Purchase Price Anomaly'}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                        Discrepancy: ৳ {item.discrepancyValue.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        &bull; {item.detectedAt}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </h4>

                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {item.description}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span><strong>Terminal/User:</strong> {item.terminalOrUser}</span>
                      <span>&bull;</span>
                      <span><strong>Ref:</strong> {item.invoiceOrRef}</span>
                      <span>&bull;</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                        AI Confidence: {item.aiFraudConfidence}%
                      </span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <button
                      onClick={() => showNotification(`Owner action recorded: Investigation flagged for ${item.invoiceOrRef}`)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Audit Invoice
                    </button>
                    {isPriceAnomaly && (
                      <button
                        onClick={() => showNotification(`Debit Note issued for ${item.invoiceOrRef}`)}
                        className="px-2.5 py-1 rounded text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 cursor-pointer"
                      >
                        Issue Debit Note
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 3: FAST MOVING VS SLOW MOVING PRODUCTS           */}
      {/* (Product Turnover & Capital Efficiency Matrix)           */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Fast Moving Products Table */}
        <div className="bg-white dark:bg-[#161b26] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Fast Moving Products
                </h3>
                <p className="text-xs text-slate-500">
                  Highest daily velocity & revenue contribution
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
              High Turnover
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">Product</th>
                  <th className="py-2.5 px-3 text-right">Daily Velocity</th>
                  <th className="py-2.5 px-3 text-right">Stock (Days)</th>
                  <th className="py-2.5 px-3 text-right">Gross Margin</th>
                  <th className="py-2.5 px-3 rounded-r-lg text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {fastMoving.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                      <div>{item.medicineName}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{item.category}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                      {item.dailyVelocityUnits} u/day
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      <span className={item.daysOnHand < 8 ? 'text-rose-600 font-bold' : 'text-slate-600 dark:text-slate-300'}>
                        {item.currentStock} ({item.daysOnHand}d)
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                      {item.grossMarginPercent}%
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        item.stockStatus === 'low_stock' 
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' 
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}>
                        {item.stockStatus === 'low_stock' ? 'Reorder' : 'Optimal'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Slow Moving Products Table */}
        <div className="bg-white dark:bg-[#161b26] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/60 flex items-center justify-center text-orange-600 dark:text-orange-400">
                <Snowflake className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Slow Moving Products
                </h3>
                <p className="text-xs text-slate-500">
                  Stagnant inventory tying up hospital working capital
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950 px-2.5 py-1 rounded-full border border-orange-200 dark:border-orange-800">
              Trapped Capital
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">Product</th>
                  <th className="py-2.5 px-3 text-right">Trapped (৳)</th>
                  <th className="py-2.5 px-3 text-right">Stagnant Days</th>
                  <th className="py-2.5 px-3 rounded-r-lg text-right">Action Plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {slowMoving.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white max-w-[170px] truncate">
                      <div>{item.medicineName}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{item.category}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      ৳ {item.trappedCapital?.toLocaleString() || '0'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-300">
                      {item.daysWithoutSale} days
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block max-w-[160px] truncate ml-auto" title={item.recommendedAction}>
                        {item.recommendedAction}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 4: AI EXECUTIVE BRIEFING & SYNTHESIS             */}
      {/* ======================================================== */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">
              {selectedLanguage === 'BN' 
                ? 'সিইও সারসংক্ষেপ ও কৌশলগত সুপারিশ (AI Executive Synthesis)' 
                : 'CEO Executive Synthesis & Strategic Recommendations'}
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Business Health Score:</span>
            <span className="px-2.5 py-0.5 rounded-full font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
              {executiveBriefing.overallHealthScore} / 100 (EXCELLENT)
            </span>
          </div>
        </div>

        {/* Narrative Box */}
        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 text-xs sm:text-sm leading-relaxed text-slate-200">
          {selectedLanguage === 'BN' 
            ? executiveBriefing.headlineSummaryBn 
            : executiveBriefing.headlineSummaryEn}
        </div>

        {/* 4 Key Strategic Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {executiveBriefing.keyInsights.map((insight, idx) => (
            <div 
              key={idx} 
              className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                insight.type === 'positive' 
                  ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200' :
                insight.type === 'risk' 
                  ? 'bg-rose-950/30 border-rose-800/60 text-rose-200' :
                  'bg-indigo-950/30 border-indigo-800/60 text-indigo-200'
              }`}
            >
              <span className="font-bold block tracking-tight">
                {insight.title}
              </span>
              <p className="text-[11px] text-slate-300 leading-snug">
                {insight.description}
              </p>
            </div>
          ))}
        </div>

        {/* Owner Action Checklist */}
        <div className="pt-2 border-t border-slate-800">
          <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block mb-2">
            Owner / CEO Decision Checklist for Today:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {executiveBriefing.executiveActionChecklist.map((item, idx) => (
              <div 
                key={idx} 
                className="flex items-start gap-2 text-xs text-slate-300 bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/50"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
