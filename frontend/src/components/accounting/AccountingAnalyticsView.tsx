import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  PieChart, 
  Receipt, 
  Boxes, 
  ArrowUpRight, 
  ArrowDownRight,
  Calendar,
  Wallet,
  Building,
  CheckCircle2,
  Building2,
  Filter
} from 'lucide-react';
import { Sale, AccountingTransaction, Medicine, Batch } from '../../types/pharmacy';
import { PharmacyService } from '../../services/pharmacyService';
import { BranchService } from '../../services/branchService';
import { usePermission } from '../../hooks/usePermission';
import { AccessDeniedCard } from '../common/PermissionGuard';

export const AccountingAnalyticsView: React.FC = () => {
  const { hasPermission, canViewProfits, canViewAccounting } = usePermission();
  const [sales, setSales] = useState<Sale[]>(() => PharmacyService.getSales());
  const [accountingTx, setAccountingTx] = useState<AccountingTransaction[]>(() => PharmacyService.getAccountingTransactions());
  const [medicines, setMedicines] = useState<Medicine[]>(() => PharmacyService.getMedicines());
  const [batches, setBatches] = useState<Batch[]>(() => PharmacyService.getBatches());

  // Dynamic Branches for Branch-Wise Filtering
  const [branches, setBranches] = useState(() => BranchService.getBranches());
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');

  useEffect(() => {
    const unsubPharmacy = PharmacyService.subscribe(() => {
      setSales(PharmacyService.getSales());
      setAccountingTx(PharmacyService.getAccountingTransactions());
      setMedicines(PharmacyService.getMedicines());
      setBatches(PharmacyService.getBatches());
    });
    const unsubBranches = BranchService.subscribe(() => {
      setBranches(BranchService.getBranches());
    });
    return () => {
      unsubPharmacy();
      unsubBranches();
    };
  }, []);

  // Filtered records based on selected branch tag
  const filteredSales = useMemo(() => {
    if (selectedBranchId === 'all') return sales;
    return sales.filter(s => s.branchId === selectedBranchId);
  }, [sales, selectedBranchId]);

  const filteredBatches = useMemo(() => {
    if (selectedBranchId === 'all') return batches;
    return batches.filter(b => b.branchId === selectedBranchId);
  }, [batches, selectedBranchId]);

  const filteredTx = useMemo(() => {
    if (selectedBranchId === 'all') return accountingTx;
    return accountingTx.filter(t => t.branchId === selectedBranchId);
  }, [accountingTx, selectedBranchId]);

  // Metrics computed dynamically from filtered records
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalCOGS = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    filteredSales.forEach(s => {
      totalRevenue += s.grandTotal;
      totalCOGS += s.totalCost;
      totalTax += s.taxTotal;
      totalDiscount += s.discountTotal;
    });

    const netSales = totalRevenue - totalTax;
    const grossProfit = netSales - totalCOGS;
    const marginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

    // Inventory Valuation
    let stockCostValue = 0;
    let stockRetailValue = 0;
    filteredBatches.forEach(b => {
      stockCostValue += b.currentStock * b.purchasePrice;
      stockRetailValue += b.currentStock * b.sellingPrice;
    });

    const potentialStockProfit = stockRetailValue - stockCostValue;

    return {
      totalRevenue,
      totalCOGS,
      totalTax,
      totalDiscount,
      netSales,
      grossProfit,
      marginPercent,
      stockCostValue,
      stockRetailValue,
      potentialStockProfit
    };
  }, [filteredSales, filteredBatches]);

  // Category Profitability Breakdown
  const categoryProfits = useMemo(() => {
    const map: Record<string, { revenue: number; cost: number; profit: number }> = {};

    filteredSales.forEach(s => {
      s.items.forEach(it => {
        const med = medicines.find(m => m.id === it.medicineId);
        const cat = med?.category || 'General';
        if (!map[cat]) map[cat] = { revenue: 0, cost: 0, profit: 0 };

        const itemRev = it.total;
        const itemCost = it.unitCost * it.quantity;
        map[cat].revenue += itemRev;
        map[cat].cost += itemCost;
        map[cat].profit += (itemRev - itemCost);
      });
    });

    return Object.entries(map).map(([cat, data]) => ({
      category: cat,
      revenue: data.revenue,
      cost: data.cost,
      profit: data.profit,
      margin: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0
    })).sort((a, b) => b.profit - a.profit);
  }, [filteredSales, medicines]);

  // Security Guardrail: Non-admin users are strictly blocked from accounting reports and profit analytics
  if (!canViewAccounting && !hasPermission('accounting:ledger:view')) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <AccessDeniedCard 
          permission="accounting:ledger:view"
          title="Accounting & Ledger Restricted"
          message="Your security profile is blocked from accessing double-entry bookkeeping, unit acquisition rates, COGS, and institutional profit balances."
        />
      </div>
    );
  }

  const selectedBranchName = branches.find(b => b.id === selectedBranchId)?.name || 'All Branches (Consolidated)';

  return (
    <div className="p-4 md:p-6 bg-slate-100 min-h-[calc(100vh-85px)] space-y-4 dark:bg-slate-800">
      
      {/* Header ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs dark:bg-[#111827] dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 dark:text-white">
            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Pharmacy Profit Analytics &amp; Financial Accounting</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">
            Branch-tagged COGS tracking, gross profit margins, and isolated branch-wise ledger.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Branch-wise selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 dark:bg-slate-900 dark:border-slate-700">
            <Building2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="text-xs font-bold bg-transparent border-none outline-none cursor-pointer text-slate-800 dark:text-slate-100"
            >
              <option value="all">All Branches (Consolidated)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800/70">
            Avg Profit Margin: {metrics.marginPercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Gross Sales Revenue */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1 dark:bg-[#111827] dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase dark:text-slate-400">
            <span>Gross Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            ৳{metrics.totalRevenue.toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-400">Total receipts ({selectedBranchName})</p>
        </div>

        {/* Cost of Goods Sold (COGS) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1 dark:bg-[#111827] dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase dark:text-slate-400">
            <span>Cost of Goods (COGS)</span>
            <Receipt className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            ৳{metrics.totalCOGS.toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-400">Batch-level purchase costs</p>
        </div>

        {/* Gross Net Profit */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs space-y-1 bg-gradient-to-b from-white to-emerald-50/30 dark:bg-[#111827] dark:border-emerald-800/70 dark:from-[#111827] dark:to-emerald-950/30">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-bold uppercase dark:text-emerald-300">
            <span>Gross Profit</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            +৳{metrics.grossProfit.toFixed(2)}
          </div>
          <p className="text-[11px] text-emerald-700 font-semibold dark:text-emerald-300">{metrics.marginPercent.toFixed(1)}% Net Margin</p>
        </div>

        {/* Inventory Stock Asset Value */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1 dark:bg-[#111827] dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase dark:text-slate-400">
            <span>Stock Asset Value</span>
            <Boxes className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            ৳{metrics.stockCostValue.toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-400">
            Retail potential: ৳{metrics.stockRetailValue.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Category-Wise Profit Breakdown & Margins */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Left 2 Cols: Category Margins */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 dark:bg-[#111827] dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Profit Contribution by Therapeutic Category</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Margin performance for {selectedBranchName}</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {categoryProfits.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No sales recorded under this branch filter yet.</p>
            ) : (
              categoryProfits.map(cat => (
                <div key={cat.category} className="space-y-1.5">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-100">{cat.category}</span>
                    <div className="space-x-3 text-right">
                      <span className="text-slate-500 dark:text-slate-400">Sales: ৳{cat.revenue.toFixed(2)}</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">+৳{cat.profit.toFixed(2)} ({cat.margin.toFixed(0)}%)</span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex dark:bg-slate-800">
                    <div 
                      className="bg-emerald-500 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, Math.max(10, cat.margin))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right 1 Col: Financial Health Overview */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 flex flex-col justify-between dark:bg-[#111827] dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Financial Summary</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Scope: {selectedBranchName}</p>

            <div className="mt-4 space-y-2.5 text-xs divide-y divide-slate-100 dark:divide-slate-800">
              <div className="flex justify-between pt-1 text-slate-600 dark:text-slate-300">
                <span>Total Tax (VAT Collected):</span>
                <span className="font-bold text-slate-900 dark:text-white">৳{metrics.totalTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 text-slate-600 dark:text-slate-300">
                <span>Customer Discounts Granted:</span>
                <span className="font-bold text-slate-900 dark:text-white">-৳{metrics.totalDiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 text-slate-600 dark:text-slate-300">
                <span>Unrealized Inventory Profit:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300">+৳{metrics.potentialStockProfit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 text-slate-600 dark:text-slate-300">
                <span>Branch Registered Sales:</span>
                <span className="font-bold text-slate-900 dark:text-white">{filteredSales.length} invoices</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2 dark:bg-emerald-950/40 dark:border-emerald-800/70 dark:text-emerald-300">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 dark:text-emerald-400" />
            <p className="text-[11px] leading-relaxed">
              Branch tagging isolates inventory, sales, and expenses to ensure granular auditability and compliance.
            </p>
          </div>
        </div>

      </div>

      {/* Accounting Transactions General Ledger */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden dark:bg-[#111827] dark:border-slate-800">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 dark:text-white">
            <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>General Accounting Ledger (Debits &amp; Credits)</span>
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">Branch: {selectedBranchName}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px] dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300">
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Branch Tag</th>
                <th className="py-2.5 px-4">Account</th>
                <th className="py-2.5 px-4">Description</th>
                <th className="py-2.5 px-4">Reference</th>
                <th className="py-2.5 px-4 text-right">Debit (Expense / Asset)</th>
                <th className="py-2.5 px-4 text-right">Credit (Revenue)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredTx.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    No transactions recorded for this branch yet.
                  </td>
                </tr>
              ) : (
                filteredTx.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/60">
                    <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap dark:text-slate-300">{tx.date}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/70">
                        {tx.branchName || tx.branchId || 'Central'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-100">{tx.account}</td>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-200">{tx.description}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500 dark:text-slate-400">{tx.referenceId}</td>
                    <td className="py-2.5 px-4 text-right font-medium text-slate-900 dark:text-white">
                      {tx.debit > 0 ? `৳${tx.debit.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-700 dark:text-emerald-300">
                      {tx.credit > 0 ? `৳${tx.credit.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
