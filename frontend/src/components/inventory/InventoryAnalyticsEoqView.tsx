import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Calculator, 
  Clock, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Filter, 
  FileText, 
  Download, 
  RefreshCw, 
  Layers, 
  BarChart3, 
  HelpCircle,
  Truck,
  RotateCcw,
  Sparkles,
  ArrowUpDown,
  ShoppingBag,
  Sliders,
  ShieldAlert,
  Info
} from 'lucide-react';
import { Medicine, Batch } from '../../types/pharmacy';
import { 
  FSNAnalysisItem, 
  EOQCalculation, 
  StockAgingBucket, 
  StockValuationComparison,
  FSNCategory 
} from '../../types/inventoryAdvanced';
import { InventoryAdvancedService } from '../../services/inventoryAdvancedService';
import { MaskedCost } from '../common/PermissionGuard';

interface InventoryAnalyticsEoqViewProps {
  medicines: Medicine[];
  batches: Batch[];
  onTriggerReorder?: (medicine: Medicine, quantity: number) => void;
}

export const InventoryAnalyticsEoqView: React.FC<InventoryAnalyticsEoqViewProps> = ({
  medicines,
  batches,
  onTriggerReorder
}) => {
  const [activeTab, setActiveTab] = useState<'eoq_minmax' | 'fsn_matrix' | 'stock_aging' | 'stock_valuation'>('eoq_minmax');

  // --- EOQ CALCULATOR STATE ---
  const [selectedMedForEoq, setSelectedMedForEoq] = useState<Medicine>(medicines[0] || {} as Medicine);
  const [orderingCostS, setOrderingCostS] = useState<number>(350); // BDT per PO
  const [holdingCostPercentH, setHoldingCostPercentH] = useState<number>(20); // 20% annual
  const [leadTimeDays, setLeadTimeDays] = useState<number>(5);
  const [eoqSearch, setEoqSearch] = useState('');
  const [eoqFilter, setEoqFilter] = useState<'all' | 'reorder_needed' | 'overstocked' | 'healthy'>('all');

  // --- FSN MATRIX STATE ---
  const [fsnSearch, setFsnSearch] = useState('');
  const [fsnFilter, setFsnFilter] = useState<'all' | 'F' | 'S' | 'N'>('all');
  const [liquidationModalItem, setLiquidationModalItem] = useState<FSNAnalysisItem | null>(null);
  const [liquidationSuccessMsg, setLiquidationSuccessMsg] = useState<string | null>(null);

  // --- STOCK AGING STATE ---
  const [selectedAgingBracket, setSelectedAgingBracket] = useState<string>('all');

  // --- STOCK VALUATION STATE ---
  const [valuationSearch, setValuationSearch] = useState('');
  const [printSuccessMsg, setPrintSuccessMsg] = useState<string | null>(null);

  // Re-sync selected medicine if list changes
  React.useEffect(() => {
    if (!selectedMedForEoq?.id && medicines.length > 0) {
      setSelectedMedForEoq(medicines[0]);
    }
  }, [medicines, selectedMedForEoq]);

  // 1. Compute FSN Analysis
  const fsnItems = useMemo(() => {
    return InventoryAdvancedService.calculateFSNAnalysis(medicines, batches);
  }, [medicines, batches]);

  // 2. Compute EOQ for currently selected medicine
  const activeEoqCalc = useMemo(() => {
    if (!selectedMedForEoq || !selectedMedForEoq.id) return null;
    return InventoryAdvancedService.calculateEOQ(
      selectedMedForEoq, 
      batches, 
      orderingCostS, 
      holdingCostPercentH / 100
    );
  }, [selectedMedForEoq, batches, orderingCostS, holdingCostPercentH]);

  // 3. Compute Stock Aging
  const agingData = useMemo(() => {
    return InventoryAdvancedService.calculateStockAging(batches);
  }, [batches]);

  // 4. Compute Valuation Comparison
  const valuationData = useMemo(() => {
    return InventoryAdvancedService.calculateValuationComparison(batches);
  }, [batches]);

  // Filtered FSN Items
  const filteredFsnItems = useMemo(() => {
    return fsnItems.filter(item => {
      const matchSearch = item.medicineName.toLowerCase().includes(fsnSearch.toLowerCase()) ||
        item.genericName.toLowerCase().includes(fsnSearch.toLowerCase()) ||
        item.category.toLowerCase().includes(fsnSearch.toLowerCase());
      const matchFilter = fsnFilter === 'all' || item.fsnCategory === fsnFilter;
      return matchSearch && matchFilter;
    });
  }, [fsnItems, fsnSearch, fsnFilter]);

  // Fast, Slow, Dead summary stats
  const fsnStats = useMemo(() => {
    let fast = 0, slow = 0, dead = 0;
    let deadValue = 0;
    fsnItems.forEach(item => {
      if (item.fsnCategory === 'F') fast++;
      else if (item.fsnCategory === 'S') slow++;
      else {
        dead++;
        deadValue += item.totalStockValue;
      }
    });
    return { fast, slow, dead, deadValue: Math.round(deadValue) };
  }, [fsnItems]);

  // Batches for Stock Aging detailed drill-down
  const agingBatches = useMemo(() => {
    const nowTime = new Date().getTime();
    return batches
      .filter(b => b.currentStock > 0)
      .map(b => {
        const mfgTime = new Date(b.manufacturingDate || '2026-01-01').getTime();
        const ageDays = Math.max(0, Math.floor((nowTime - mfgTime) / (1000 * 60 * 60 * 24)));
        const expTime = new Date(b.expiryDate).getTime();
        const daysToExpiry = Math.floor((expTime - nowTime) / (1000 * 60 * 60 * 24));
        
        let bracket = '0-30 days';
        if (ageDays > 180) bracket = '>180 days';
        else if (ageDays > 90) bracket = '91-180 days';
        else if (ageDays > 60) bracket = '61-90 days';
        else if (ageDays > 30) bracket = '31-60 days';

        return {
          ...b,
          ageDays,
          daysToExpiry,
          bracket,
          value: b.currentStock * b.purchasePrice
        };
      })
      .filter(item => selectedAgingBracket === 'all' || item.bracket === selectedAgingBracket)
      .sort((a, b) => b.ageDays - a.ageDays);
  }, [batches, selectedAgingBracket]);

  // EOQ & Min/Max Table for all medicines
  const medicineEoqList = useMemo(() => {
    return medicines.map(med => {
      const medBatches = batches.filter(b => b.medicineId === med.id && b.status !== 'expired');
      const currentStock = medBatches.reduce((sum, b) => sum + b.currentStock, 0);
      const eoq = InventoryAdvancedService.calculateEOQ(med, batches, orderingCostS, holdingCostPercentH / 100);

      const isCritical = currentStock <= (med.reorderLevel * 0.5);
      const isReorderNeeded = currentStock <= med.reorderLevel;
      const isOverstocked = currentStock > eoq.maxStock;

      let statusBadge: 'critical' | 'reorder' | 'healthy' | 'overstocked' = 'healthy';
      if (isCritical) statusBadge = 'critical';
      else if (isReorderNeeded) statusBadge = 'reorder';
      else if (isOverstocked) statusBadge = 'overstocked';

      const suggestedPO = Math.max(0, eoq.maxStock - currentStock);

      return {
        medicine: med,
        currentStock,
        eoq,
        statusBadge,
        suggestedPO
      };
    }).filter(item => {
      const matchSearch = item.medicine.name.toLowerCase().includes(eoqSearch.toLowerCase()) ||
        item.medicine.genericName.toLowerCase().includes(eoqSearch.toLowerCase()) ||
        item.medicine.category.toLowerCase().includes(eoqSearch.toLowerCase());
      
      let matchFilter = true;
      if (eoqFilter === 'reorder_needed') matchFilter = item.statusBadge === 'critical' || item.statusBadge === 'reorder';
      else if (eoqFilter === 'overstocked') matchFilter = item.statusBadge === 'overstocked';
      else if (eoqFilter === 'healthy') matchFilter = item.statusBadge === 'healthy';

      return matchSearch && matchFilter;
    });
  }, [medicines, batches, orderingCostS, holdingCostPercentH, eoqSearch, eoqFilter]);

  const handleExecuteLiquidation = (actionName: string) => {
    if (!liquidationModalItem) return;
    setLiquidationSuccessMsg(`Successfully queued liquidation [${actionName}] for ${liquidationModalItem.medicineName}. Debit note generated.`);
    setTimeout(() => {
      setLiquidationSuccessMsg(null);
      setLiquidationModalItem(null);
    }, 2800);
  };

  return (
    <div className="space-y-4">
      {/* Sub-Header / Navigation Tabs */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('eoq_minmax')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'eoq_minmax'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Min/Max & EOQ Engine</span>
          </button>

          <button
            onClick={() => setActiveTab('fsn_matrix')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'fsn_matrix'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>FSN & Dead Stock ({fsnStats.dead})</span>
          </button>

          <button
            onClick={() => setActiveTab('stock_aging')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'stock_aging'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Stock Aging Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab('stock_valuation')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'stock_valuation'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Stock Valuation (FIFO vs WAC)</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
            Automated Hospital Inventory Intel
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MIN/MAX & ECONOMIC ORDER QUANTITY (EOQ) ENGINE                     */}
      {/* ========================================================================= */}
      {activeTab === 'eoq_minmax' && (
        <div className="space-y-4">
          {/* Top EOQ Simulator & Wilson Formula Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Wilson Model Visualizer */}
            <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 text-white shadow-sm border border-slate-700 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
                      <Calculator className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold tracking-wide">Wilson Economic Order Quantity (EOQ) Formula</h3>
                      <p className="text-xs text-slate-400">Minimizes Total Annual Carrying & PO Acquisition Costs</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                    EOQ = √[(2 × D × S) ÷ H]
                  </span>
                </div>

                {/* Selected Drug Selector & Formula Parameters */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-800/80 p-3 rounded-lg border border-slate-700/80">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Simulated Drug Formula</label>
                    <select
                      value={selectedMedForEoq?.id || ''}
                      onChange={(e) => {
                        const m = medicines.find(med => med.id === e.target.value);
                        if (m) setSelectedMedForEoq(m);
                      }}
                      className="w-full bg-slate-900 text-white text-xs border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {medicines.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.strength})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                      <span>Order Cost (S): ৳{orderingCostS}</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="1000"
                      step="50"
                      value={orderingCostS}
                      onChange={(e) => setOrderingCostS(Number(e.target.value))}
                      className="w-full accent-emerald-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-400">PO admin & transport</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                      <span>Carrying Cost (H): {holdingCostPercentH}%/yr</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="35"
                      step="1"
                      value={holdingCostPercentH}
                      onChange={(e) => setHoldingCostPercentH(Number(e.target.value))}
                      className="w-full accent-emerald-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-400">Cold-chain, rent & capital</span>
                  </div>
                </div>

                {/* Formula Output Row */}
                {activeEoqCalc && (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                      <div className="text-xs text-slate-400">Optimal EOQ</div>
                      <div className="text-lg font-black text-emerald-400">{activeEoqCalc.eoqUnits} <span className="text-xs font-normal text-slate-300">units</span></div>
                      <div className="text-[10px] text-slate-400">Batch order size</div>
                    </div>

                    <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                      <div className="text-xs text-slate-400">Reorder Point (ROP)</div>
                      <div className="text-lg font-black text-amber-400">{activeEoqCalc.reorderPoint} <span className="text-xs font-normal text-slate-300">units</span></div>
                      <div className="text-[10px] text-slate-400">Trigger PO here</div>
                    </div>

                    <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                      <div className="text-xs text-slate-400">Safety Stock (Min)</div>
                      <div className="text-lg font-black text-sky-400">{activeEoqCalc.minStock} <span className="text-xs font-normal text-slate-300">units</span></div>
                      <div className="text-[10px] text-slate-400">Buffer stock</div>
                    </div>

                    <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                      <div className="text-xs text-slate-400">Max Stock Ceiling</div>
                      <div className="text-lg font-black text-purple-400">{activeEoqCalc.maxStock} <span className="text-xs font-normal text-slate-300">units</span></div>
                      <div className="text-[10px] text-slate-400">Prevent over-holding</div>
                    </div>
                  </div>
                )}
              </div>

              {activeEoqCalc && (
                <div className="mt-4 pt-3 border-t border-slate-700/80 flex flex-wrap items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-3">
                    <span>Optimal Frequency: <strong className="text-white">{activeEoqCalc.optimalOrdersPerYear} orders/year</strong></span>
                    <span>•</span>
                    <span>Cycle Time: <strong className="text-white">Every {activeEoqCalc.cycleTimeDays} days</strong></span>
                  </div>
                  <div className="text-emerald-400 font-medium">
                    Total Annual Policy Cost: ৳{activeEoqCalc.totalAnnualInventoryCost.toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            {/* Inventory Holding vs Reorder Policy Card */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Hospital Min/Max Buffer Guidelines</h4>
                <div className="space-y-3">
                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs">
                    <div className="font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Reorder Point (ROP)</span>
                    </div>
                    <p className="text-[11px] text-amber-800 mt-1">
                      Calculated as: <em>(Daily Demand × Lead Time) + Safety Stock</em>. When shelf inventory breaches this threshold, auto-draft purchase request.
                    </p>
                  </div>

                  <div className="p-2.5 bg-sky-50 rounded-lg border border-sky-200 text-xs">
                    <div className="font-bold text-sky-900 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-sky-600" />
                      <span>Safety Stock Floor (Min Stock)</span>
                    </div>
                    <p className="text-[11px] text-sky-800 mt-1">
                      Reserved buffer for supplier delivery delays or sudden hospital epidemic surges. Stock should never drop below this value.
                    </p>
                  </div>

                  <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200 text-xs">
                    <div className="font-bold text-purple-900 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-purple-600" />
                      <span>Max Stock Ceiling</span>
                    </div>
                    <p className="text-[11px] text-purple-800 mt-1">
                      Calculated as: <em>Safety Stock + EOQ</em>. Prevents over-ordering which leads to expiry risk, fridge overcrowding, and trapped capital.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Lead Time: <strong>{leadTimeDays} days</strong> (Incepta/Square)</span>
                <span className="text-emerald-700 font-bold">Dynamic FEFO Synced</span>
              </div>
            </div>
          </div>

          {/* Master Min/Max & Reorder Level Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Table Search and Filters */}
            <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
              <div className="relative flex-1 w-full sm:max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by drug name, generic formula or category..."
                  value={eoqSearch}
                  onChange={(e) => setEoqSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <button
                  onClick={() => setEoqFilter('all')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold ${eoqFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
                >
                  All ({medicines.length})
                </button>
                <button
                  onClick={() => setEoqFilter('reorder_needed')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold ${eoqFilter === 'reorder_needed' ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-amber-700'}`}
                >
                  Reorder Needed
                </button>
                <button
                  onClick={() => setEoqFilter('healthy')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold ${eoqFilter === 'healthy' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-emerald-700'}`}
                >
                  Healthy
                </button>
                <button
                  onClick={() => setEoqFilter('overstocked')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold ${eoqFilter === 'overstocked' ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-purple-700'}`}
                >
                  Overstocked
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2.5">Medicine & Formula</th>
                    <th className="px-3.5 py-2.5 text-center">Current Stock</th>
                    <th className="px-3.5 py-2.5">Stock vs [Min | ROP | Max] Bar</th>
                    <th className="px-3.5 py-2.5 text-center">EOQ Batch</th>
                    <th className="px-3.5 py-2.5 text-center">Suggested PO</th>
                    <th className="px-3.5 py-2.5 text-center">Status</th>
                    <th className="px-3.5 py-2.5 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {medicineEoqList.map(item => {
                    const maxBoundary = Math.max(item.eoq.maxStock, item.currentStock, 100);
                    const currentPercent = Math.min(100, Math.round((item.currentStock / maxBoundary) * 100));
                    const ropPercent = Math.min(100, Math.round((item.eoq.reorderPoint / maxBoundary) * 100));
                    const minPercent = Math.min(100, Math.round((item.eoq.minStock / maxBoundary) * 100));

                    return (
                      <tr key={item.medicine.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-3.5 py-3">
                          <div className="font-bold text-slate-900">{item.medicine.name}</div>
                          <div className="text-[11px] text-slate-500">{item.medicine.genericName} • {item.medicine.category}</div>
                        </td>

                        <td className="px-3.5 py-3 text-center">
                          <span className={`inline-block font-mono font-bold text-sm ${
                            item.currentStock <= item.eoq.minStock 
                              ? 'text-rose-600' 
                              : item.currentStock <= item.eoq.reorderPoint 
                                ? 'text-amber-600' 
                                : 'text-slate-800'
                          }`}>
                            {item.currentStock}
                          </span>
                          <span className="text-[10px] text-slate-400 block">{item.medicine.unitOfMeasure}</span>
                        </td>

                        <td className="px-3.5 py-3 min-w-[200px]">
                          {/* Visual Min / ROP / Max indicator bar */}
                          <div className="relative w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                            {/* Current Stock Bar */}
                            <div 
                              className={`h-full transition-all duration-300 ${
                                item.currentStock <= item.eoq.minStock 
                                  ? 'bg-rose-500' 
                                  : item.currentStock <= item.eoq.reorderPoint 
                                    ? 'bg-amber-500' 
                                    : item.currentStock > item.eoq.maxStock 
                                      ? 'bg-purple-500' 
                                      : 'bg-emerald-500'
                              }`}
                              style={{ width: `${currentPercent}%` }}
                            />
                            {/* ROP Marker */}
                            <div 
                              className="absolute top-0 bottom-0 w-0.5 bg-amber-700 z-10"
                              style={{ left: `${ropPercent}%` }}
                              title={`Reorder Point: ${item.eoq.reorderPoint}`}
                            />
                          </div>

                          <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                            <span>Min: {item.eoq.minStock}</span>
                            <span className="text-amber-700 font-semibold">ROP: {item.eoq.reorderPoint}</span>
                            <span>Max: {item.eoq.maxStock}</span>
                          </div>
                        </td>

                        <td className="px-3.5 py-3 text-center">
                          <span className="font-mono font-bold text-slate-800">{item.eoq.eoqUnits}</span>
                          <span className="text-[10px] text-slate-400 block">units/order</span>
                        </td>

                        <td className="px-3.5 py-3 text-center">
                          {item.suggestedPO > 0 ? (
                            <span className="font-mono font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              +{item.suggestedPO}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px] font-mono">0 (Adequate)</span>
                          )}
                        </td>

                        <td className="px-3.5 py-3 text-center">
                          {item.statusBadge === 'critical' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                              <AlertTriangle className="w-3 h-3" /> Critical Stock
                            </span>
                          )}
                          {item.statusBadge === 'reorder' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3" /> Reorder Point
                            </span>
                          )}
                          {item.statusBadge === 'healthy' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Optimal
                            </span>
                          )}
                          {item.statusBadge === 'overstocked' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              <Layers className="w-3 h-3" /> Overstocked
                            </span>
                          )}
                        </td>

                        <td className="px-3.5 py-3 text-right">
                          <button
                            onClick={() => {
                              if (onTriggerReorder) {
                                onTriggerReorder(item.medicine, item.suggestedPO > 0 ? item.suggestedPO : item.eoq.eoqUnits);
                              } else {
                                alert(`Purchase Order draft initiated for ${item.medicine.name} - Quantity: ${item.suggestedPO > 0 ? item.suggestedPO : item.eoq.eoqUnits} units.`);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-md font-semibold text-xs transition-colors cursor-pointer"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>Draft PO</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: FSN CLASSIFICATION & DEAD STOCK LIQUIDATION                        */}
      {/* ========================================================================= */}
      {activeTab === 'fsn_matrix' && (
        <div className="space-y-4">
          {/* Notification Banner if action succeeded */}
          {liquidationSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{liquidationSuccessMsg}</span>
            </div>
          )}

          {/* FSN KPI Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Fast Moving (F)</span>
                <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg font-bold">F</span>
              </div>
              <div className="text-2xl font-black text-emerald-700 mt-2">{fsnStats.fast} <span className="text-xs font-normal text-slate-500">lines</span></div>
              <p className="text-[11px] text-slate-400 mt-1">High turnover & daily velocity &gt; 10 units</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Slow Moving (S)</span>
                <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg font-bold">S</span>
              </div>
              <div className="text-2xl font-black text-amber-700 mt-2">{fsnStats.slow} <span className="text-xs font-normal text-slate-500">lines</span></div>
              <p className="text-[11px] text-slate-400 mt-1">Moderate consumption; adjust order frequency</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs">
              <div className="flex items-center justify-between text-xs text-rose-600 font-bold">
                <span>Non-Moving / Dead (N)</span>
                <span className="p-1.5 bg-rose-100 text-rose-700 rounded-lg font-bold">N</span>
              </div>
              <div className="text-2xl font-black text-rose-700 mt-2">{fsnStats.dead} <span className="text-xs font-normal text-slate-500">drugs</span></div>
              <p className="text-[11px] text-rose-600 mt-1">No sales in &gt;90 days; immediate action needed</p>
            </div>

            <div className="bg-gradient-to-br from-rose-900 to-rose-800 p-4 rounded-xl text-white shadow-xs">
              <div className="text-xs font-semibold text-rose-200 flex items-center justify-between">
                <span>Dead Stock Capital Trapped</span>
                <DollarSign className="w-4 h-4 text-rose-300" />
              </div>
              <div className="text-2xl font-black text-rose-100 mt-2">
                <MaskedCost amount={fsnStats.deadValue} />
              </div>
              <p className="text-[11px] text-rose-300 mt-1">Available for vendor debit return claim</p>
            </div>
          </div>

          {/* FSN Filtering & Search Toolbar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
              <div className="relative flex-1 w-full sm:max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by drug name or generic formula..."
                  value={fsnSearch}
                  onChange={(e) => setFsnSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <button
                  onClick={() => setFsnFilter('all')}
                  className={`px-3 py-1 rounded text-xs font-semibold ${fsnFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
                >
                  All ({fsnItems.length})
                </button>
                <button
                  onClick={() => setFsnFilter('F')}
                  className={`px-3 py-1 rounded text-xs font-semibold ${fsnFilter === 'F' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-emerald-700'}`}
                >
                  Fast Moving ({fsnStats.fast})
                </button>
                <button
                  onClick={() => setFsnFilter('S')}
                  className={`px-3 py-1 rounded text-xs font-semibold ${fsnFilter === 'S' ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-amber-700'}`}
                >
                  Slow Moving ({fsnStats.slow})
                </button>
                <button
                  onClick={() => setFsnFilter('N')}
                  className={`px-3 py-1 rounded text-xs font-semibold ${fsnFilter === 'N' ? 'bg-rose-600 text-white' : 'bg-white border border-slate-200 text-rose-700'}`}
                >
                  Dead Stock ({fsnStats.dead})
                </button>
              </div>
            </div>

            {/* FSN Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2.5">FSN Class</th>
                    <th className="px-3.5 py-2.5">Medicine & Category</th>
                    <th className="px-3.5 py-2.5 text-center">Current Stock</th>
                    <th className="px-3.5 py-2.5 text-center">Daily Velocity</th>
                    <th className="px-3.5 py-2.5 text-center">Days Inactive</th>
                    <th className="px-3.5 py-2.5 text-right">Capital Value</th>
                    <th className="px-3.5 py-2.5">Recommended Liquidation Action</th>
                    <th className="px-3.5 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFsnItems.map(item => (
                    <tr key={item.medicineId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3.5 py-3">
                        {item.fsnCategory === 'F' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Fast (F)
                          </span>
                        )}
                        {item.fsnCategory === 'S' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
                            Slow (S)
                          </span>
                        )}
                        {item.fsnCategory === 'N' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                            <AlertTriangle className="w-3 h-3" /> Dead (N)
                          </span>
                        )}
                      </td>

                      <td className="px-3.5 py-3">
                        <div className="font-bold text-slate-900">{item.medicineName}</div>
                        <div className="text-[11px] text-slate-500">{item.genericName} • {item.category}</div>
                      </td>

                      <td className="px-3.5 py-3 text-center">
                        <span className="font-mono font-bold text-slate-800">{item.currentStock}</span>
                        <span className="text-[10px] text-slate-400 block">{item.unitOfMeasure}</span>
                      </td>

                      <td className="px-3.5 py-3 text-center">
                        <span className={`font-mono font-bold ${item.dailyVelocity > 10 ? 'text-emerald-700' : 'text-slate-600'}`}>
                          {item.dailyVelocity}
                        </span>
                        <span className="text-[10px] text-slate-400 block">units/day</span>
                      </td>

                      <td className="px-3.5 py-3 text-center">
                        <span className={`font-mono font-semibold ${item.daysWithoutSale >= 90 ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                          {item.daysWithoutSale} days
                        </span>
                      </td>

                      <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-800">
                        <MaskedCost amount={item.totalStockValue} />
                      </td>

                      <td className="px-3.5 py-3 text-[11px] text-slate-600 max-w-xs">
                        {item.liquidationAction || 'Maintain regular order cycle with automatic FEFO picking.'}
                      </td>

                      <td className="px-3.5 py-3 text-right">
                        {item.isDeadStock ? (
                          <button
                            onClick={() => setLiquidationModalItem(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-md font-semibold text-xs transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Liquidate</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">Regular</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: STOCK AGING LEDGER                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'stock_aging' && (
        <div className="space-y-4">
          {/* Aging Buckets Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {agingData.buckets.map(b => {
              const isSelected = selectedAgingBracket === b.bracket;
              return (
                <div
                  key={b.bracket}
                  onClick={() => setSelectedAgingBracket(isSelected ? 'all' : b.bracket)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected 
                      ? 'ring-2 ring-emerald-500 bg-emerald-50/50 border-emerald-400' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">{b.bracket}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      b.riskLevel === 'low' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : b.riskLevel === 'moderate' 
                          ? 'bg-sky-100 text-sky-800' 
                          : b.riskLevel === 'elevated' 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-rose-100 text-rose-800'
                    }`}>
                      {b.riskLevel}
                    </span>
                  </div>

                  <div className="mt-2 text-xl font-black text-slate-900">
                    <MaskedCost amount={b.totalValuation} />
                  </div>

                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                    <span>{b.totalQuantity} units</span>
                    <span className="font-semibold">{b.percentageOfInventory}% of total</span>
                  </div>

                  {/* Micro Progress Bar */}
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div 
                      className={`h-full ${
                        b.riskLevel === 'low' 
                          ? 'bg-emerald-500' 
                          : b.riskLevel === 'moderate' 
                            ? 'bg-sky-500' 
                            : b.riskLevel === 'elevated' 
                              ? 'bg-amber-500' 
                              : 'bg-rose-500'
                      }`} 
                      style={{ width: `${b.percentageOfInventory}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Aging Batches Drill-Down */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h4 className="text-xs font-bold text-slate-800">
                  Aging Batches Drill-Down {selectedAgingBracket !== 'all' ? `— [${selectedAgingBracket}]` : '— All Age Brackets'}
                </h4>
                <p className="text-[11px] text-slate-500">Calculated from manufacturing & stock arrival receipt timestamp</p>
              </div>

              {selectedAgingBracket !== 'all' && (
                <button
                  onClick={() => setSelectedAgingBracket('all')}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer"
                >
                  Clear Bracket Filter
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2.5">Batch Number</th>
                    <th className="px-3.5 py-2.5">Medicine Name</th>
                    <th className="px-3.5 py-2.5 text-center">Manufacturing Date</th>
                    <th className="px-3.5 py-2.5 text-center">Shelf Age (Days)</th>
                    <th className="px-3.5 py-2.5 text-center">Expiry Date</th>
                    <th className="px-3.5 py-2.5 text-center">Days to Expiry</th>
                    <th className="px-3.5 py-2.5 text-center">In Stock Units</th>
                    <th className="px-3.5 py-2.5 text-right">Batch Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agingBatches.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3.5 py-3 font-mono font-bold text-slate-900">{b.batchNumber}</td>
                      <td className="px-3.5 py-3 font-semibold text-slate-800">{b.medicineName}</td>
                      <td className="px-3.5 py-3 text-center font-mono text-slate-500">{b.manufacturingDate}</td>
                      <td className="px-3.5 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                          b.ageDays > 180 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {b.ageDays} days
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-center font-mono text-slate-500">{b.expiryDate}</td>
                      <td className="px-3.5 py-3 text-center font-mono">
                        <span className={`font-semibold ${b.daysToExpiry <= 60 ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                          {b.daysToExpiry} days
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-center font-mono font-bold text-slate-800">{b.currentStock}</td>
                      <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-800">
                        <MaskedCost amount={b.value} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: STOCK VALUATION (FIFO VS WEIGHTED AVERAGE COST)                    */}
      {/* ========================================================================= */}
      {activeTab === 'stock_valuation' && (
        <div className="space-y-4">
          {printSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{printSuccessMsg}</span>
            </div>
          )}

          {/* Comparative Valuation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-semibold flex items-center justify-between">
                <span>Weighted Average Cost (WAC)</span>
                <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-bold">Standard</span>
              </div>
              <div className="text-2xl font-black text-sky-700 mt-2">
                <MaskedCost amount={valuationData.weightedAverageValuation} />
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Unrealized Margin: <strong>{valuationData.unrealizedGrossMarginWAC}%</strong>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-semibold flex items-center justify-between">
                <span>FIFO Replacement Valuation</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">Latest Batches</span>
              </div>
              <div className="text-2xl font-black text-emerald-700 mt-2">
                <MaskedCost amount={valuationData.fifoValuation} />
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Unrealized Margin: <strong>{valuationData.unrealizedGrossMarginFIFO}%</strong>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-semibold">Valuation Variance</div>
              <div className={`text-2xl font-black mt-2 ${valuationData.varianceAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {valuationData.varianceAmount >= 0 ? '+' : ''}৳{valuationData.varianceAmount.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-mono">
                {valuationData.variancePercent}% variance (FIFO vs WAC)
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-semibold">Total Retail Value (MRP)</div>
              <div className="text-2xl font-black text-purple-700 mt-2">
                <MaskedCost amount={valuationData.retailValueMRP} />
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-mono">
                {valuationData.totalUnitsInStock.toLocaleString()} active units tracked
              </div>
            </div>
          </div>

          {/* Audit Note & Valuation Statement Generator */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-slate-200 text-slate-700 rounded-lg">
                <FileText className="w-5 h-5" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Hospital Pharmacy Stock Audit Valuation Ledger</h4>
                <p className="text-[11px] text-slate-500">
                  Complies with Bangladesh DGDA & IAS 2 Inventory Standards. Dual FIFO & Weighted Average tracking.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setPrintSuccessMsg('Exported official Inventory Valuation Statement (PDF/Excel) for Hospital Accounts.');
                setTimeout(() => setPrintSuccessMsg(null), 3000);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Export Valuation Statement</span>
            </button>
          </div>

          {/* Detailed Valuation Table per Drug */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search valuation ledger..."
                  value={valuationSearch}
                  onChange={(e) => setValuationSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <span className="text-xs text-slate-500 font-mono">
                Date: {valuationData.valuationDate}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2.5">Medicine Name</th>
                    <th className="px-3.5 py-2.5 text-center">Units in Stock</th>
                    <th className="px-3.5 py-2.5 text-right">WAC Cost</th>
                    <th className="px-3.5 py-2.5 text-right">FIFO Cost</th>
                    <th className="px-3.5 py-2.5 text-right">WAC Total Value</th>
                    <th className="px-3.5 py-2.5 text-right">FIFO Total Value</th>
                    <th className="px-3.5 py-2.5 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {medicines
                    .filter(m => m.name.toLowerCase().includes(valuationSearch.toLowerCase()) || m.genericName.toLowerCase().includes(valuationSearch.toLowerCase()))
                    .map(m => {
                      const medBatches = batches.filter(b => b.medicineId === m.id && b.status !== 'expired' && b.currentStock > 0);
                      const totalQty = medBatches.reduce((s, b) => s + b.currentStock, 0);
                      if (totalQty === 0) return null;

                      const wacVal = medBatches.reduce((s, b) => s + (b.currentStock * b.purchasePrice), 0);
                      const wacUnit = wacVal / totalQty;

                      // newest batch cost for FIFO
                      const sorted = [...medBatches].sort((a, b) => b.expiryDate.localeCompare(a.expiryDate));
                      const fifoUnit = sorted[0].purchasePrice;
                      const fifoVal = totalQty * fifoUnit;
                      const variance = fifoVal - wacVal;

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3.5 py-3">
                            <div className="font-bold text-slate-900">{m.name}</div>
                            <div className="text-[11px] text-slate-500">{m.genericName} • {medBatches.length} batch(es)</div>
                          </td>

                          <td className="px-3.5 py-3 text-center font-mono font-bold text-slate-800">
                            {totalQty} {m.unitOfMeasure}
                          </td>

                          <td className="px-3.5 py-3 text-right font-mono text-slate-600">
                            ৳{wacUnit.toFixed(2)}
                          </td>

                          <td className="px-3.5 py-3 text-right font-mono text-slate-600">
                            ৳{fifoUnit.toFixed(2)}
                          </td>

                          <td className="px-3.5 py-3 text-right font-mono font-bold text-sky-700">
                            <MaskedCost amount={Math.round(wacVal)} />
                          </td>

                          <td className="px-3.5 py-3 text-right font-mono font-bold text-emerald-700">
                            <MaskedCost amount={Math.round(fifoVal)} />
                          </td>

                          <td className="px-3.5 py-3 text-right font-mono font-semibold">
                            <span className={variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                              {variance >= 0 ? '+' : ''}৳{Math.round(variance)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DEAD STOCK LIQUIDATION WORKFLOW                                    */}
      {/* ========================================================================= */}
      {liquidationModalItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-rose-100 text-rose-700 rounded-lg">
                  <RotateCcw className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Dead Stock Liquidation Protocol</h3>
                  <p className="text-xs text-slate-500">Formulate immediate recovery strategy for non-moving medicine</p>
                </div>
              </div>
              <button
                onClick={() => setLiquidationModalItem(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 text-sm">{liquidationModalItem.medicineName}</div>
                <div className="text-slate-500">{liquidationModalItem.genericName} ({liquidationModalItem.category})</div>
                <div className="flex justify-between pt-2 text-slate-700 font-mono">
                  <span>Current Locked Stock: <strong>{liquidationModalItem.currentStock} units</strong></span>
                  <span>Locked Capital: <strong className="text-rose-600">৳{liquidationModalItem.totalStockValue}</strong></span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-slate-700 block">Select Liquidation Channel:</label>
                
                <button
                  onClick={() => handleExecuteLiquidation('Vendor Debit Note Return')}
                  className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all cursor-pointer"
                >
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>1. Vendor Return Claim (Beximco / Square / Incepta)</span>
                    <span className="text-emerald-600 font-mono">100% Credit Note</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Return near-expiry/zero-velocity stock back to authorized manufacturer depot for replacement credit.
                  </p>
                </button>

                <button
                  onClick={() => handleExecuteLiquidation('OPD Clearance Markdown 25%')}
                  className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 transition-all cursor-pointer"
                >
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>2. Outpatient Counter Clearance (25% Discount)</span>
                    <span className="text-amber-700 font-mono">Rapid OTC Sell-off</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Apply promotional bundle discount at POS counter to stimulate immediate customer purchase.
                  </p>
                </button>

                <button
                  onClick={() => handleExecuteLiquidation('Internal Ward / OT Bulk Reallocation')}
                  className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-sky-500 hover:bg-sky-50/50 transition-all cursor-pointer"
                >
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>3. Inpatient Ward / OT Emergency Reallocation</span>
                    <span className="text-sky-700 font-mono">Internal Transfer</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Transfer stock to high-volume hospital inpatient ward or surgery theatre crash cart.
                  </p>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => setLiquidationModalItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
