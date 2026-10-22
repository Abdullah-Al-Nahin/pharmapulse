import React, { useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight, Package, AlertTriangle, ClockAlert, CreditCard } from 'lucide-react';
import { PharmacyService } from '../../services/pharmacyService';

interface PharmaPulseKpiRowProps {
  selectedBranchId?: string;
}

function generateSparkline(values: number[], width = 160, height = 30): { areaPath: string; linePath: string } {
  if (!values || values.length === 0 || values.every(v => v === 0)) {
    return {
      areaPath: `M0 ${height} L${width} ${height} Z`,
      linePath: `M0 ${height * 0.75} Q ${width * 0.5} ${height * 0.6}, ${width} ${height * 0.75}`
    };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((val, idx) => {
    const x = Math.round((idx / (values.length - 1 || 1)) * width);
    const y = Math.round(height - ((val - min) / range) * (height - 8) - 4);
    return { x, y };
  });

  const linePath = points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  return { areaPath, linePath };
}

export const PharmaPulseKpiRow: React.FC<PharmaPulseKpiRowProps> = ({ selectedBranchId = 'all' }) => {
  const kpis = useMemo(() => {
    return PharmacyService.getDashboardKPIs('today', undefined, undefined, selectedBranchId);
  }, [selectedBranchId]);

  const nearExpiryBatches = useMemo(() => {
    return PharmacyService.getTopNearExpiryBatches(10, selectedBranchId);
  }, [selectedBranchId]);

  const lowStockList = useMemo(() => {
    return PharmacyService.getLowStockAlertMedicines(selectedBranchId);
  }, [selectedBranchId]);

  const trendPoints = useMemo(() => {
    return PharmacyService.getSalesVsPurchasesTrend('daily', selectedBranchId);
  }, [selectedBranchId]);

  // Derived metrics
  const salesSparkline = useMemo(() => {
    const salesArr = trendPoints.map(p => p.sales);
    return generateSparkline(salesArr);
  }, [trendPoints]);

  const profitSparkline = useMemo(() => {
    const profitArr = trendPoints.map(p => p.grossProfit);
    return generateSparkline(profitArr);
  }, [trendPoints]);

  const ledgerSparkline = useMemo(() => {
    const diffArr = trendPoints.map(p => Math.max(0, p.netDifference));
    return generateSparkline(diffArr);
  }, [trendPoints]);

  const nearExpiryCriticalCount = kpis.nearExpiry.under30 + kpis.nearExpiry.expired;
  const nearExpiryWorth = useMemo(() => {
    return nearExpiryBatches
      .filter(b => b.daysLeft <= 30)
      .reduce((sum, b) => sum + (Number(b.totalValueAtRisk) || 0), 0);
  }, [nearExpiryBatches]);

  const avgPerInvoice = kpis.sales.invoiceCount > 0
    ? Math.round(kpis.sales.current / kpis.sales.invoiceCount)
    : 0;

  const topUrgentLowStock = lowStockList[0]?.medicineName || 'Inventory Healthy';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-5">
      {/* Metric 1: Today's Sales */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#161b26] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            TODAY'S SALES
          </span>
          <span className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            kpis.sales.trend.isPositive
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
          }`}>
            {kpis.sales.trend.isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {kpis.sales.trend.isPositive ? '+' : '-'}{kpis.sales.trend.percent}%
          </span>
        </div>
        <div className="flex items-baseline gap-1 my-1">
          <span className="font-bold text-[16px] text-emerald-600 dark:text-emerald-400">৳</span>
          <span className="font-extrabold text-[22px] tracking-tight text-slate-900 dark:text-white font-mono">
            {kpis.sales.current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] font-medium">
          <span>{kpis.sales.invoiceCount} Invoices</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">Avg ৳{avgPerInvoice}/rx</span>
        </div>
        {/* Dynamic Emerald Sparkline */}
        <div className="w-full h-7 mt-2">
          <svg className="w-full h-full text-emerald-500" preserveAspectRatio="none" viewBox="0 0 160 30">
            <defs>
              <linearGradient id="kpiSalesGradDynamic" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={salesSparkline.areaPath} fill="url(#kpiSalesGradDynamic)" />
            <path d={salesSparkline.linePath} fill="none" stroke="#059669" strokeLinecap="round" strokeWidth="2" />
          </svg>
        </div>
      </div>

      {/* Metric 2: Gross Profit */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#161b26] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            GROSS PROFIT
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
            {kpis.grossProfit.marginPercent.toFixed(1)}% margin
          </span>
        </div>
        <div className="flex items-baseline gap-1 my-1">
          <span className="font-bold text-[16px] text-emerald-600 dark:text-emerald-400">৳</span>
          <span className="font-extrabold text-[22px] tracking-tight text-slate-900 dark:text-white font-mono">
            {kpis.grossProfit.current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] font-medium">
          <span>Net Profit</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">
            ৳{kpis.netProfit.current.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
        {/* Dynamic Profit Sparkline */}
        <div className="w-full h-7 mt-2">
          <svg className="w-full h-full text-emerald-500" preserveAspectRatio="none" viewBox="0 0 160 30">
            <defs>
              <linearGradient id="kpiProfitGradDynamic" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={profitSparkline.areaPath} fill="url(#kpiProfitGradDynamic)" />
            <path d={profitSparkline.linePath} fill="none" stroke="#10b981" strokeLinecap="round" strokeWidth="2" />
          </svg>
        </div>
      </div>

      {/* Metric 3: Stock Reorder */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#161b26] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            STOCK REORDER
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            kpis.lowStock.count > 0
              ? 'bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800'
              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
          }`}>
            {kpis.lowStock.count > 0 ? 'PO Required' : 'Optimal'}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 my-1">
          <span className="font-extrabold text-[22px] tracking-tight text-orange-600 dark:text-orange-400 font-mono">
            {kpis.lowStock.count}
          </span>
          <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
            {kpis.lowStock.criticalItems > 0 ? `${kpis.lowStock.criticalItems} Critical` : 'Items Below Min'}
          </span>
        </div>
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] font-medium">
          <span className="truncate max-w-[110px]" title={topUrgentLowStock}>{topUrgentLowStock}</span>
          <span className="text-orange-600 dark:text-orange-400 font-bold">
            {kpis.lowStock.count > 0 ? 'Auto-PO Ready' : 'Healthy'}
          </span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
          <div 
            className="bg-orange-500 h-1.5 rounded-full transition-all duration-500" 
            style={{ width: `${Math.min(100, Math.max(10, kpis.lowStock.count * 15))}%` }}
          />
        </div>
      </div>

      {/* Metric 4: Near Expiry (<30D) - Highlighted Orange Border */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#161b26] border-2 border-orange-300 dark:border-orange-600/70 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
            NEAR EXPIRY (&lt;30D)
          </span>
          <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold shadow-xs">
            FEFO Priority
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 my-1">
          <span className="font-extrabold text-[22px] tracking-tight text-orange-600 dark:text-orange-400 font-mono">
            {nearExpiryCriticalCount}
          </span>
          <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Batches &lt; 30d</span>
        </div>
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] font-medium">
          <span>Worth: <strong className="text-slate-800 dark:text-slate-200 font-mono">৳{nearExpiryWorth.toLocaleString()}</strong></span>
          <span className="text-orange-600 dark:text-orange-400 font-bold">Flagged on POS</span>
        </div>
        <div className="w-full bg-orange-100 dark:bg-orange-950/60 rounded-full h-1.5 mt-3 overflow-hidden">
          <div 
            className="bg-orange-500 h-1.5 rounded-full transition-all duration-500" 
            style={{ width: `${Math.min(100, Math.max(8, nearExpiryCriticalCount * 12))}%` }}
          />
        </div>
      </div>

      {/* Metric 5: Store Ledger Due / Receivables */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#161b26] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            STORE LEDGER DUE
          </span>
          <span className="px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 text-[10px] font-bold border border-sky-200 dark:border-sky-800">
            {kpis.customerReceivables.creditAccountsCount} Accounts
          </span>
        </div>
        <div className="flex items-baseline gap-1 my-1">
          <span className="font-bold text-[16px] text-sky-600 dark:text-sky-400">৳</span>
          <span className="font-extrabold text-[22px] tracking-tight text-slate-900 dark:text-white font-mono">
            {kpis.customerReceivables.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] font-medium">
          <span>Corporate / Credit</span>
          <span className="text-sky-600 dark:text-sky-400 font-bold">Active Dues</span>
        </div>
        <div className="w-full h-7 mt-2">
          <svg className="w-full h-full text-sky-500" preserveAspectRatio="none" viewBox="0 0 160 30">
            <defs>
              <linearGradient id="kpiLedgerGradDynamic" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={ledgerSparkline.areaPath} fill="url(#kpiLedgerGradDynamic)" />
            <path d={ledgerSparkline.linePath} fill="none" stroke="#0284c7" strokeLinecap="round" strokeWidth="2" />
          </svg>
        </div>
      </div>
    </div>
  );
};
