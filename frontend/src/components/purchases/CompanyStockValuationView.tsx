import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Search, 
  TrendingUp, 
  DollarSign, 
  Boxes, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  FileSpreadsheet, 
  Printer, 
  CheckCircle2, 
  Package, 
  Calendar, 
  Layers, 
  ArrowUpDown,
  ShoppingCart,
  Clock,
  Sparkles
} from 'lucide-react';
import { Medicine, Batch, Supplier } from '../../types/pharmacy';
import { PharmacyService } from '../../services/pharmacyService';

interface CompanyStockValuationViewProps {
  onNavigateToPo?: (supplierName: string) => void;
}

interface ProductStockDetail {
  medicine: Medicine;
  totalPieces: number;
  batches: Batch[];
  totalCostValue: number;
  totalMrpValue: number;
  isLowStock: boolean;
  isNearExpiry: boolean;
  averageTp: number;
  averageMrp: number;
}

interface CompanyValuationSummary {
  companyName: string;
  matchedSupplier?: Supplier;
  totalProductsCount: number;
  totalPieces: number;
  totalCostValue: number;
  totalMrpValue: number;
  grossMarginAmount: number;
  grossMarginPercent: number;
  lowStockCount: number;
  nearExpiryCount: number;
  products: ProductStockDetail[];
}

export const CompanyStockValuationView: React.FC<CompanyStockValuationViewProps> = ({ onNavigateToPo }) => {
  // Read fresh data from PharmacyService every time this component renders
  const medicines = useMemo(() => PharmacyService.getMedicines(), []);
  const batches = useMemo(() => PharmacyService.getBatches(), []);
  const suppliers = useMemo(() => PharmacyService.getSuppliers(), []);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'value_desc' | 'value_asc' | 'qty_desc' | 'name_asc' | 'products_desc'>('value_desc');
  const [filterAlertOnly, setFilterAlertOnly] = useState<'all' | 'low_stock' | 'near_expiry'>('all');

  // Expanded company accordion
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({});

  // Toggle company expand
  const toggleCompany = (companyName: string) => {
    setExpandedCompanies(prev => ({
      ...prev,
      [companyName]: !prev[companyName]
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    companySummaries.forEach(c => { all[c.companyName] = true; });
    setExpandedCompanies(all);
  };

  const collapseAll = () => {
    setExpandedCompanies({});
  };

  // Compile Company-Wise Aggregation
  const companySummaries = useMemo<CompanyValuationSummary[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Group medicines by normalized manufacturer
    const groupMap = new Map<string, Medicine[]>();

    medicines.forEach(med => {
      const rawMfr = (med.manufacturer || 'General Pharmaceuticals').trim();
      const existing = groupMap.get(rawMfr) || [];
      existing.push(med);
      groupMap.set(rawMfr, existing);
    });

    const result: CompanyValuationSummary[] = [];

    groupMap.forEach((medList, companyName) => {
      let companyTotalPieces = 0;
      let companyTotalCost = 0;
      let companyTotalMrp = 0;
      let companyLowStock = 0;
      let companyNearExpiry = 0;

      const productDetails: ProductStockDetail[] = medList.map(med => {
        const medBatches = batches.filter(
          b => b.medicineId === med.id && (b.status === 'active' || !b.status)
        );

        let prodPieces = 0;
        let prodCostVal = 0;
        let prodMrpVal = 0;
        let hasNearExp = false;

        medBatches.forEach(b => {
          const qty = Math.max(0, b.currentStock);
          prodPieces += qty;
          prodCostVal += qty * (b.purchasePrice || 0);
          prodMrpVal += qty * (b.mrp || b.sellingPrice || 0);

          if (b.expiryDate) {
            const exp = new Date(b.expiryDate);
            const daysToExpiry = (exp.getTime() - today.getTime()) / (1000 * 3600 * 24);
            if (daysToExpiry <= 90 && daysToExpiry > 0) {
              hasNearExp = true;
            }
          }
        });

        const isLow = prodPieces <= (med.reorderLevel || 10);
        if (isLow) companyLowStock++;
        if (hasNearExp) companyNearExpiry++;

        companyTotalPieces += prodPieces;
        companyTotalCost += prodCostVal;
        companyTotalMrp += prodMrpVal;

        const avgTp = prodPieces > 0 ? prodCostVal / prodPieces : (medBatches[0]?.purchasePrice || 0);
        const avgMrp = prodPieces > 0 ? prodMrpVal / prodPieces : (medBatches[0]?.mrp || medBatches[0]?.sellingPrice || 0);

        return {
          medicine: med,
          totalPieces: prodPieces,
          batches: medBatches,
          totalCostValue: prodCostVal,
          totalMrpValue: prodMrpVal,
          isLowStock: isLow,
          isNearExpiry: hasNearExp,
          averageTp: avgTp,
          averageMrp: avgMrp
        };
      });

      // Match with known supplier depot
      const matchedSupplier = suppliers.find(s => 
        s.companyName.toLowerCase().includes(companyName.toLowerCase()) || 
        companyName.toLowerCase().includes(s.companyName.toLowerCase()) ||
        s.name.toLowerCase().includes(companyName.toLowerCase())
      );

      const marginAmount = Math.max(0, companyTotalMrp - companyTotalCost);
      const marginPercent = companyTotalMrp > 0 ? (marginAmount / companyTotalMrp) * 100 : 0;

      // Sort products within company by stock value desc
      productDetails.sort((a, b) => b.totalCostValue - a.totalCostValue);

      result.push({
        companyName,
        matchedSupplier,
        totalProductsCount: medList.length,
        totalPieces: companyTotalPieces,
        totalCostValue: companyTotalCost,
        totalMrpValue: companyTotalMrp,
        grossMarginAmount: marginAmount,
        grossMarginPercent: marginPercent,
        lowStockCount: companyLowStock,
        nearExpiryCount: companyNearExpiry,
        products: productDetails
      });
    });

    return result;
  }, [medicines, batches, suppliers]);

  // Filtered and Sorted summaries
  const filteredCompanies = useMemo(() => {
    let list = companySummaries.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      const matchesCompany = item.companyName.toLowerCase().includes(q) ||
        (item.matchedSupplier && item.matchedSupplier.name.toLowerCase().includes(q));
      
      const matchesProduct = item.products.some(p => 
        p.medicine.name.toLowerCase().includes(q) ||
        p.medicine.genericName.toLowerCase().includes(q)
      );

      return matchesCompany || matchesProduct;
    });

    if (filterAlertOnly === 'low_stock') {
      list = list.filter(item => item.lowStockCount > 0);
    } else if (filterAlertOnly === 'near_expiry') {
      list = list.filter(item => item.nearExpiryCount > 0);
    }

    list.sort((a, b) => {
      if (sortBy === 'value_desc') return b.totalCostValue - a.totalCostValue;
      if (sortBy === 'value_asc') return a.totalCostValue - b.totalCostValue;
      if (sortBy === 'qty_desc') return b.totalPieces - a.totalPieces;
      if (sortBy === 'products_desc') return b.totalProductsCount - a.totalProductsCount;
      if (sortBy === 'name_asc') return a.companyName.localeCompare(b.companyName);
      return 0;
    });

    return list;
  }, [companySummaries, searchQuery, sortBy, filterAlertOnly]);

  // Grand Totals across entire hospital inventory
  const grandTotals = useMemo(() => {
    return companySummaries.reduce((acc, c) => ({
      companiesCount: acc.companiesCount + 1,
      totalPieces: acc.totalPieces + c.totalPieces,
      totalCostValue: acc.totalCostValue + c.totalCostValue,
      totalMrpValue: acc.totalMrpValue + c.totalMrpValue,
      lowStockTotal: acc.lowStockTotal + c.lowStockCount,
      nearExpiryTotal: acc.nearExpiryTotal + c.nearExpiryCount,
    }), {
      companiesCount: 0,
      totalPieces: 0,
      totalCostValue: 0,
      totalMrpValue: 0,
      lowStockTotal: 0,
      nearExpiryTotal: 0
    });
  }, [companySummaries]);

  // Export to CSV
  const handleExportCsv = () => {
    const rows = [
      ['Company / Manufacturer', 'Product Name', 'Generic Name', 'Dosage Form', 'Total Stock (Pcs)', 'Average TP (৳)', 'Average MRP (৳)', 'Total Stock Value TP (৳)', 'Total Potential MRP (৳)', 'Stock Status']
    ];

    companySummaries.forEach(c => {
      c.products.forEach(p => {
        rows.push([
          `"${c.companyName}"`,
          `"${p.medicine.name} ${p.medicine.strength}"`,
          `"${p.medicine.genericName}"`,
          `"${p.medicine.dosageForm}"`,
          `${p.totalPieces}`,
          `${(p?.averageTp != null ? Number(p.averageTp) : 0).toFixed(2)}`,
          `${(p?.averageMrp != null ? Number(p.averageMrp) : 0).toFixed(2)}`,
          `${(p?.totalCostValue != null ? Number(p.totalCostValue) : 0).toFixed(2)}`,
          `${(p?.totalMrpValue != null ? Number(p.totalMrpValue) : 0).toFixed(2)}`,
          `"${p.isLowStock ? 'LOW STOCK' : 'IN STOCK'}"`
        ]);
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Company_Stock_Valuation_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5" id="company-stock-valuation-view">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              DGDA Audited • Multi-Company Valuation
            </span>
            <span className="text-xs text-slate-400">• Real-Time Stock Valuation</span>
          </div>
          <h2 className="text-lg md:text-xl font-black tracking-tight text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <span>Company-Wise Stock Valuation &amp; Inventory Audit</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            কোন কোম্পানির কত টাকার ওষুধ স্টকে রয়েছে এবং কোন প্রোডাক্ট কত পিস মজুদ আছে তা এক নজরে পর্যবেক্ষণ করুন।
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
            title="Download CSV Report"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            title="Print Valuation Report"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-[#161b26] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
            <span>Registered Companies</span>
            <Building2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {grandTotals.companiesCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <Package className="w-3 h-3 text-slate-400" />
            <span>{medicines.length} Unique SKUs</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#161b26] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
            <span>Total Stock Quantity</span>
            <Boxes className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
            {grandTotals.totalPieces.toLocaleString()} <span className="text-xs font-normal text-slate-500">Pcs</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across active pharmacy batches
          </div>
        </div>

        <div className="bg-white dark:bg-[#161b26] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
            <span>Total Stock Value (Cost / TP)</span>
            <DollarSign className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400">
            ৳ {grandTotals.totalCostValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            মূল্য ক্রয়মূল্য বা ট্রেড প্রাইস (TP)
          </div>
        </div>

        <div className="bg-white dark:bg-[#161b26] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
            <span>Potential Retail (MRP)</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            ৳ {grandTotals.totalMrpValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
            Est. Margin: ৳ {(grandTotals.totalMrpValue - grandTotals.totalCostValue).toLocaleString(undefined, { maximumFractionDigits: 0 })} ({grandTotals.totalMrpValue > 0 ? (((grandTotals.totalMrpValue - grandTotals.totalCostValue) / grandTotals.totalMrpValue) * 100).toFixed(1) : 0}%)
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filters & Expand/Collapse */}
      <div className="bg-white dark:bg-[#161b26] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company (Square, Incepta...) or medicine..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="text-slate-400 hover:text-slate-600 text-xs absolute right-2.5 top-1/2 -translate-y-1/2"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setFilterAlertOnly('all')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                filterAlertOnly === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              All Companies ({companySummaries.length})
            </button>
            <button
              onClick={() => setFilterAlertOnly('low_stock')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                filterAlertOnly === 'low_stock'
                  ? 'bg-amber-500 text-white font-bold'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Low Stock Only</span>
            </button>
            <button
              onClick={() => setFilterAlertOnly('near_expiry')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                filterAlertOnly === 'near_expiry'
                  ? 'bg-rose-500 text-white font-bold'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>Near Expiry</span>
            </button>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium cursor-pointer"
            >
              <option value="value_desc">Highest Stock Value (৳)</option>
              <option value="value_asc">Lowest Stock Value (৳)</option>
              <option value="qty_desc">Highest Quantity (Pcs)</option>
              <option value="products_desc">Most Products Count</option>
              <option value="name_asc">Company Name (A-Z)</option>
            </select>
          </div>

          {/* Expand / Collapse All */}
          <div className="flex items-center gap-1">
            <button
              onClick={expandAll}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              title="Expand all product lists"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              title="Collapse all"
            >
              Collapse
            </button>
          </div>
        </div>
      </div>

      {/* Companies List Accordion Table */}
      <div className="space-y-3">
        {filteredCompanies.length === 0 ? (
          <div className="bg-white dark:bg-[#161b26] p-10 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
              কোন কোম্পানির তথ্য খুঁজে পাওয়া যায়নি
            </div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              অনুসন্ধান ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন অথবা ইনভেন্টরিতে নতুন ওষুধ যোগ করুন।
            </p>
          </div>
        ) : (
          filteredCompanies.map((company) => {
            const isExpanded = !!expandedCompanies[company.companyName];

            return (
              <div
                key={company.companyName}
                className="bg-white dark:bg-[#161b26] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs transition-all"
              >
                {/* Company Header Row */}
                <div
                  onClick={() => toggleCompany(company.companyName)}
                  className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 select-none"
                >
                  <div className="flex items-center gap-3 min-w-[280px]">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-sm shrink-0 shadow-2xs">
                      {company.companyName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {company.companyName}
                        </span>
                        {company.lowStockCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                            {company.lowStockCount} Low Stock
                          </span>
                        )}
                        {company.nearExpiryCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300">
                            {company.nearExpiryCount} Near Exp
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{company.totalProductsCount} Products (SKUs)</span>
                        {company.matchedSupplier && (
                          <>
                            <span>•</span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                              Depot: {company.matchedSupplier.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Financial & Stock Badges */}
                  <div className="flex flex-wrap items-center gap-4 lg:gap-6 text-xs">
                    {/* Stock Pieces */}
                    <div className="flex flex-col items-start lg:items-end">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Total Stock
                      </span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">
                        {company.totalPieces.toLocaleString()} <span className="text-[11px] font-normal text-slate-500">Pcs</span>
                      </span>
                    </div>

                    {/* Cost Value (TP ৳) */}
                    <div className="flex flex-col items-start lg:items-end">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Stock Value (ক্রয়মূল্য TP)
                      </span>
                      <span className="font-black text-indigo-700 dark:text-indigo-400 text-sm">
                        ৳ {company.totalCostValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* MRP Value (৳) */}
                    <div className="flex flex-col items-start lg:items-end">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Potential Retail (MRP)
                      </span>
                      <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                        ৳ {company.totalMrpValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Gross Margin */}
                    <div className="flex flex-col items-start lg:items-end">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Est. Margin
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                        {(company?.grossMarginPercent != null ? Number(company.grossMarginPercent) : 0).toFixed(1)}% (৳ {(company?.grossMarginAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                      </span>
                    </div>

                    {/* Expand/Collapse Chevron Button */}
                    <div className="flex items-center gap-2 pl-2">
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center gap-1 transition"
                      >
                        <span>{isExpanded ? 'Hide Products' : 'View Products'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Products Table */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {company.companyName} এর প্রোডাক্ট তালিকা ({company.products.length} টি ওষুধ)
                        </span>
                        <span className="text-[11px] text-slate-400">
                          (ব্যাচ অনুযায়ী মজুদ ও মূল্য তালিকা)
                        </span>
                      </div>

                      {onNavigateToPo && (
                        <button
                          type="button"
                          onClick={() => onNavigateToPo(company.companyName)}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-2xs transition cursor-pointer"
                        >
                          <ShoppingCart className="w-3 h-3" />
                          <span>Create PO for {company.companyName}</span>
                        </button>
                      )}
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161b26]">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px] font-bold">
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">Medicine &amp; Strength</th>
                            <th className="py-2.5 px-3">Generic &amp; Form</th>
                            <th className="py-2.5 px-3 text-center">Current Stock</th>
                            <th className="py-2.5 px-3">Active Batches (Exp Date)</th>
                            <th className="py-2.5 px-3 text-right">Unit TP (৳)</th>
                            <th className="py-2.5 px-3 text-right">Unit MRP (৳)</th>
                            <th className="py-2.5 px-3 text-right">Total Stock Value (৳)</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {company.products.map((p, idx) => {
                            return (
                              <tr
                                key={p.medicine.id}
                                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                              >
                                <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    {p.medicine.name}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    {p.medicine.strength} • {p.medicine.packSize} pcs/pack
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="text-slate-700 dark:text-slate-300 text-[11px]">
                                    {p.medicine.genericName}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {p.medicine.dosageForm} • {p.medicine.rackLocation || 'Rack A'}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className={`font-black text-xs px-2 py-0.5 rounded-md ${
                                    p.totalPieces === 0
                                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                      : p.isLowStock
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                      : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  }`}>
                                    {p.totalPieces.toLocaleString()} {p.medicine.unitOfMeasure || 'Pcs'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3">
                                  {p.batches.length === 0 ? (
                                    <span className="text-slate-400 italic text-[11px]">No active batch</span>
                                  ) : (
                                    <div className="space-y-1">
                                      {p.batches.map(b => (
                                        <div key={b.id} className="flex items-center gap-1.5 text-[11px]">
                                          <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                                            #{b.batchNumber}
                                          </span>
                                          <span className="text-slate-500">
                                            ({b.currentStock} pcs)
                                          </span>
                                          <span className="text-[10px] text-slate-400">
                                            Exp: {b.expiryDate}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                  ৳ {(p?.averageTp != null ? Number(p.averageTp) : 0).toFixed(2)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                  ৳ {(p?.averageMrp != null ? Number(p.averageMrp) : 0).toFixed(2)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700 dark:text-indigo-400">
                                  ৳ {p.totalCostValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {p.totalPieces === 0 ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200">
                                      Stockout
                                    </span>
                                  ) : p.isLowStock ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200">
                                      Low Reorder
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                                      Normal
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100/90 dark:bg-slate-800/90 font-bold border-t border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
                            <td colSpan={3} className="py-2.5 px-3 text-right text-xs">
                              {company.companyName} Total:
                            </td>
                            <td className="py-2.5 px-3 text-center text-emerald-700 dark:text-emerald-400 font-extrabold">
                              {company.totalPieces.toLocaleString()} Pcs
                            </td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td className="py-2.5 px-3 text-right text-indigo-700 dark:text-indigo-400 font-black">
                              ৳ {company.totalCostValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
