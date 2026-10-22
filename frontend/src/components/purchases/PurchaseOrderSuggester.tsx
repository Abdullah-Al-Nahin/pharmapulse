import React, { useState, useMemo, useEffect } from 'react';
import { 
  Sparkles, 
  ShoppingCart, 
  AlertTriangle, 
  CheckCircle2, 
  Building2, 
  Package, 
  Clock, 
  Search, 
  SlidersHorizontal, 
  ArrowRight, 
  Printer, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Minus, 
  FileText, 
  ShieldAlert, 
  Check, 
  Boxes,
  Truck,
  DollarSign,
  Info,
  TrendingDown,
  Calendar
} from 'lucide-react';
import { PharmacyService } from '../../services/pharmacyService';
import { 
  SupplierPurchaseSuggestionGroup, 
  PurchaseOrderSuggestionItem, 
  StockoutRiskLevel,
  PurchaseOrder,
  Supplier
} from '../../types/pharmacy';

interface PurchaseOrderSuggesterProps {
  onNavigateToPoRegister?: (poId?: string) => void;
  onDataChanged?: () => void;
}

export const PurchaseOrderSuggester: React.FC<PurchaseOrderSuggesterProps> = ({
  onNavigateToPoRegister,
  onDataChanged
}) => {
  // Configuration / Simulation States
  const [targetBufferDays, setTargetBufferDays] = useState<number>(30);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'out_of_stock' | 'critical' | 'reorder_point'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [includeAllMedicines, setIncludeAllMedicines] = useState<boolean>(false);

  // Local state for interactive overrides (pack quantities & selections)
  // Map key: medicineId -> { adjustedPacks: number, isSelected: boolean }
  const [itemOverrides, setItemOverrides] = useState<Record<string, { adjustedPacks: number; isSelected: boolean }>>({});
  const [collapsedSuppliers, setCollapsedSuppliers] = useState<Record<string, boolean>>({});

  // Feedback & Modal States
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printGroup, setPrintGroup] = useState<SupplierPurchaseSuggestionGroup | null>(null);
  const [successModalData, setSuccessModalData] = useState<{
    poList: PurchaseOrder[];
    supplierNames: string[];
    totalAmount: number;
  } | null>(null);

  // Refresh key to force re-read from PharmacyService after data changes
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch Suppliers for dropdown — re-reads when refreshKey changes
  const suppliers = useMemo(() => PharmacyService.getSuppliers(), [refreshKey]);

  // Fetch raw suggestions from business logic engine
  const suggestionData = useMemo(() => {
    return PharmacyService.getPurchaseOrderSuggestions({
      targetBufferDays,
      supplierId: selectedSupplierId,
      urgencyFilter,
      searchQuery,
      includeAllMedicines
    });
  }, [targetBufferDays, selectedSupplierId, urgencyFilter, searchQuery, includeAllMedicines, refreshKey]);

  // Merge suggestionData with itemOverrides for reactive UI updates
  const processedGroups: SupplierPurchaseSuggestionGroup[] = useMemo(() => {
    return suggestionData.groups.map(group => {
      const mergedItems: PurchaseOrderSuggestionItem[] = group.items.map(item => {
        const override = itemOverrides[item.medicineId];
        const isSelected = override ? override.isSelected : item.isSelected;
        const adjustedPacks = override ? override.adjustedPacks : item.suggestedPacks;
        const adjustedQuantity = adjustedPacks * (item.packSize || 1);
        const estimatedSubtotal = Number((adjustedQuantity * item.unitPurchasePrice).toFixed(2));
        const estimatedTax = Number((estimatedSubtotal * (item.taxRate / 100)).toFixed(2));
        const estimatedTotal = Number((estimatedSubtotal + estimatedTax).toFixed(2));

        return {
          ...item,
          isSelected,
          adjustedPacks,
          adjustedQuantity,
          estimatedSubtotal,
          estimatedTax,
          estimatedTotal
        };
      });

      const selectedItems = mergedItems.filter(it => it.isSelected);
      const totalEstimatedSubtotal = selectedItems.reduce((sum, it) => sum + it.estimatedSubtotal, 0);
      const totalEstimatedTax = selectedItems.reduce((sum, it) => sum + it.estimatedTax, 0);
      const totalEstimatedAmount = Number((totalEstimatedSubtotal + totalEstimatedTax).toFixed(2));
      const totalSuggestedPacks = selectedItems.reduce((sum, it) => sum + it.adjustedPacks, 0);
      const totalSuggestedQuantity = selectedItems.reduce((sum, it) => sum + it.adjustedQuantity, 0);

      return {
        ...group,
        items: mergedItems,
        selectedItemsCount: selectedItems.length,
        totalSuggestedPacks,
        totalSuggestedQuantity,
        totalEstimatedSubtotal,
        totalEstimatedTax,
        totalEstimatedAmount,
        meetsMinOrderValue: totalEstimatedAmount >= group.minOrderValueTarget
      };
    });
  }, [suggestionData, itemOverrides]);

  // Overall summary metrics across all selected items
  const overallMetrics = useMemo(() => {
    let totalSelectedItems = 0;
    let totalSelectedAmount = 0;
    let totalSelectedPacks = 0;
    let totalOos = 0;
    let totalCrit = 0;
    let totalSuppliersWithOrders = 0;

    processedGroups.forEach(g => {
      if (g.selectedItemsCount > 0) {
        totalSuppliersWithOrders += 1;
        totalSelectedItems += g.selectedItemsCount;
        totalSelectedAmount += g.totalEstimatedAmount;
        totalSelectedPacks += g.totalSuggestedPacks;
      }
      totalOos += g.outOfStockCount;
      totalCrit += g.criticalCount;
    });

    return {
      totalSelectedItems,
      totalSelectedAmount: Number(totalSelectedAmount.toFixed(2)),
      totalSelectedPacks,
      totalOos,
      totalCrit,
      totalSuppliersWithOrders,
      totalSKUs: suggestionData.summary.totalSKUsNeedingReorder
    };
  }, [processedGroups, suggestionData]);

  // Handlers for interactive overrides
  const handleToggleItemSelect = (medicineId: string, currentSelected: boolean) => {
    setItemOverrides(prev => ({
      ...prev,
      [medicineId]: {
        adjustedPacks: prev[medicineId]?.adjustedPacks ?? 
          (suggestionData.groups.flatMap(g => g.items).find(it => it.medicineId === medicineId)?.suggestedPacks || 1),
        isSelected: !currentSelected
      }
    }));
  };

  const handleAdjustPacks = (medicineId: string, currentPacks: number, delta: number) => {
    const newPacks = Math.max(1, currentPacks + delta);
    setItemOverrides(prev => ({
      ...prev,
      [medicineId]: {
        isSelected: prev[medicineId]?.isSelected ?? true,
        adjustedPacks: newPacks
      }
    }));
  };

  const handleDirectPackInput = (medicineId: string, value: string) => {
    const val = parseInt(value, 10);
    const newPacks = isNaN(val) || val < 1 ? 1 : val;
    setItemOverrides(prev => ({
      ...prev,
      [medicineId]: {
        isSelected: prev[medicineId]?.isSelected ?? true,
        adjustedPacks: newPacks
      }
    }));
  };

  const handleToggleSupplierAll = (supplierId: string, selectAll: boolean) => {
    const group = processedGroups.find(g => g.supplier.id === supplierId);
    if (!group) return;

    setItemOverrides(prev => {
      const updated = { ...prev };
      group.items.forEach(it => {
        updated[it.medicineId] = {
          adjustedPacks: updated[it.medicineId]?.adjustedPacks ?? it.suggestedPacks,
          isSelected: selectAll
        };
      });
      return updated;
    });
  };

  const handleToggleAllOverall = (selectAll: boolean) => {
    setItemOverrides(prev => {
      const updated = { ...prev };
      processedGroups.forEach(g => {
        g.items.forEach(it => {
          updated[it.medicineId] = {
            adjustedPacks: updated[it.medicineId]?.adjustedPacks ?? it.suggestedPacks,
            isSelected: selectAll
          };
        });
      });
      return updated;
    });
  };

  const toggleSupplierCollapse = (supplierId: string) => {
    setCollapsedSuppliers(prev => ({
      ...prev,
      [supplierId]: !prev[supplierId]
    }));
  };

  // Generate single PO for a specific supplier
  const handleGenerateSupplierPO = (group: SupplierPurchaseSuggestionGroup) => {
    const selectedItems = group.items.filter(it => it.isSelected);
    if (selectedItems.length === 0) {
      alert(`Please select at least one item from ${group.supplier.name} to generate a Purchase Order.`);
      return;
    }

    try {
      const newPO = PharmacyService.generatePurchaseOrderFromSuggestions({
        supplierId: group.supplier.id,
        items: selectedItems.map(it => ({
          medicineId: it.medicineId,
          medicineName: it.medicineName,
          dosageForm: it.dosageForm,
          orderedQuantity: it.adjustedPacks,
          packSize: it.packSize,
          unitPurchasePrice: it.unitPurchasePrice,
          taxRate: it.taxRate,
          mrp: it.mrp,
          sellingPrice: it.sellingPrice
        })),
        notes: `Auto-generated Requisition via PO Suggester for ${group.supplier.name}. Safety buffer: ${targetBufferDays} days.`
      });

      // Clear overrides for these items
      setItemOverrides(prev => {
        const next = { ...prev };
        selectedItems.forEach(it => delete next[it.medicineId]);
        return next;
      });

      if (onDataChanged) onDataChanged();
      setRefreshKey(k => k + 1);

      setSuccessModalData({
        poList: [newPO],
        supplierNames: [group.supplier.name],
        totalAmount: newPO.totalAmount
      });
    } catch (err: any) {
      alert(`Error generating Purchase Order: ${err.message}`);
    }
  };

  // Generate all POs in bulk across all suppliers
  const handleGenerateBulkPOs = () => {
    const ordersToCreate: Array<{
      supplierId: string;
      items: Array<{
        medicineId: string;
        medicineName: string;
        dosageForm: any;
        orderedQuantity: number;
        packSize: number;
        unitPurchasePrice: number;
        taxRate: number;
        mrp?: number;
        sellingPrice?: number;
      }>;
      notes?: string;
    }> = [];

    const supplierNames: string[] = [];

    processedGroups.forEach(group => {
      const selected = group.items.filter(it => it.isSelected);
      if (selected.length > 0) {
        supplierNames.push(group.supplier.name);
        ordersToCreate.push({
          supplierId: group.supplier.id,
          items: selected.map(it => ({
            medicineId: it.medicineId,
            medicineName: it.medicineName,
            dosageForm: it.dosageForm,
            orderedQuantity: it.adjustedPacks,
            packSize: it.packSize,
            unitPurchasePrice: it.unitPurchasePrice,
            taxRate: it.taxRate,
            mrp: it.mrp,
            sellingPrice: it.sellingPrice
          })),
          notes: `Batch requisition generated by PO Suggester for ${group.supplier.name}. Safety target: ${targetBufferDays}d.`
        });
      }
    });

    if (ordersToCreate.length === 0) {
      alert('No items are currently selected. Please select items to generate Purchase Orders.');
      return;
    }

    try {
      const createdPOs = PharmacyService.generateBulkPurchaseOrders(ordersToCreate);
      const totalAmount = createdPOs.reduce((sum, po) => sum + po.totalAmount, 0);

      // Clear overrides
      setItemOverrides({});
      setIsBulkConfirmOpen(false);

      if (onDataChanged) onDataChanged();
      setRefreshKey(k => k + 1);

      setSuccessModalData({
        poList: createdPOs,
        supplierNames,
        totalAmount
      });
    } catch (err: any) {
      alert(`Failed to bulk generate purchase orders: ${err.message}`);
    }
  };

  // Open Requisition print preview
  const handleOpenPrintModal = (group: SupplierPurchaseSuggestionGroup) => {
    setPrintGroup(group);
    setIsPrintModalOpen(true);
  };

  const fmt = (num: number) => {
    return `৳${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div id="po-suggester-container" className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. TOP HERO BAR & STRATEGIC INSIGHTS                                      */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-teal-950 text-white rounded-2xl p-6 shadow-md border border-emerald-800/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Automated Replenishment Engine</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <span>Purchase Order Suggester</span>
            </h1>
            <p className="text-sm text-emerald-100/80 mt-1 max-w-2xl leading-relaxed">
              Analyzes real-time inventory depth against minimum safety thresholds, dynamic 30-day consumption velocity (ADC), and supplier lead times to suggest optimal, pack-normalized order quantities per distributor.
            </p>
          </div>

          {/* Quick Metrics Capsule */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 text-center min-w-[110px]">
              <div className="text-xs text-emerald-200 font-medium">SKUs to Reorder</div>
              <div className="text-2xl font-bold font-mono text-white mt-0.5">
                {suggestionData.summary.totalSKUsNeedingReorder}
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 text-center min-w-[110px]">
              <div className="text-xs text-rose-300 font-medium">Stockouts (0d)</div>
              <div className="text-2xl font-bold font-mono text-rose-400 mt-0.5">
                {suggestionData.summary.outOfStockCount}
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 text-center min-w-[130px]">
              <div className="text-xs text-amber-200 font-medium">Est. Total Outlay</div>
              <div className="text-lg font-bold font-mono text-amber-300 mt-0.5">
                {fmt(suggestionData.summary.totalEstimatedAmount)}
              </div>
            </div>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="mt-6 pt-5 border-t border-emerald-700/50 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>{overallMetrics.totalSelectedItems}</strong> item(s) selected across <strong>{overallMetrics.totalSuppliersWithOrders}</strong> supplier group(s).
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-select-all-global"
              type="button"
              onClick={() => handleToggleAllOverall(true)}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition cursor-pointer"
            >
              Select All
            </button>
            <button
              id="btn-deselect-all-global"
              type="button"
              onClick={() => handleToggleAllOverall(false)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-emerald-200 hover:text-white transition cursor-pointer"
            >
              Clear Selection
            </button>
            <button
              id="btn-generate-all-pos"
              type="button"
              onClick={() => setIsBulkConfirmOpen(true)}
              disabled={overallMetrics.totalSelectedItems === 0}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Generate All POs ({fmt(overallMetrics.totalSelectedAmount)})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SIMULATION & FILTER CONTROLS BAR                                       */}
      {/* ========================================================================= */}
      <div id="suggester-controls-card" className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Coverage & Buffer Days */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Safety Target:</span>
          </div>
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            {[
              { days: 15, label: '15d Lean' },
              { days: 30, label: '30d Standard' },
              { days: 45, label: '45d Safe Buffer' },
              { days: 60, label: '60d Wholesale' }
            ].map(opt => (
              <button
                key={opt.days}
                id={`btn-buffer-${opt.days}`}
                type="button"
                onClick={() => setTargetBufferDays(opt.days)}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                  targetBufferDays === opt.days
                    ? 'bg-white text-emerald-800 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Supplier Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Distributor:</span>
            <select
              id="select-supplier-filter"
              value={selectedSupplierId}
              onChange={e => setSelectedSupplierId(e.target.value)}
              className="text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Distributors ({suppliers.length})</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Search & Urgency Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Urgency Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-medium">
            <button
              id="filter-urgency-all"
              type="button"
              onClick={() => setUrgencyFilter('all')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                urgencyFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Reorders
            </button>
            <button
              id="filter-urgency-oos"
              type="button"
              onClick={() => setUrgencyFilter('out_of_stock')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                urgencyFilter === 'out_of_stock'
                  ? 'bg-rose-100 text-rose-800 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-rose-700'
              }`}
            >
              Out of Stock
            </button>
            <button
              id="filter-urgency-crit"
              type="button"
              onClick={() => setUrgencyFilter('critical')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                urgencyFilter === 'critical'
                  ? 'bg-orange-100 text-orange-800 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-orange-700'
              }`}
            >
              Critical (&lt;5d)
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              id="input-suggester-search"
              type="text"
              placeholder="Search medicine or generic..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Include all toggle */}
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input
              id="checkbox-include-all"
              type="checkbox"
              checked={includeAllMedicines}
              onChange={e => setIncludeAllMedicines(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <span>Include healthy stock</span>
          </label>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SUPPLIER GROUPS & ITEMIZED RECOMMENDATIONS                             */}
      {/* ========================================================================= */}
      {processedGroups.length === 0 ? (
        <div id="no-suggestions-box" className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Inventory Well-Balanced</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            No medicines currently meet the threshold for replenishment under the current safety buffer ({targetBufferDays} days) and urgency filter.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              id="btn-reset-filters"
              type="button"
              onClick={() => {
                setSelectedSupplierId('all');
                setUrgencyFilter('all');
                setSearchQuery('');
                setIncludeAllMedicines(true);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              Review All Inventory SKUs
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {processedGroups.map(group => {
            const isCollapsed = collapsedSuppliers[group.supplier.id] || false;

            return (
              <div
                key={group.supplier.id}
                id={`supplier-group-${group.supplier.id}`}
                className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all"
              >
                {/* Supplier Header Banner */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Supplier info */}
                    <div className="flex items-start gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-bold text-slate-900">
                            {group.supplier.name}
                          </h2>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {group.paymentTerms}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            ~{group.leadTimeDays}d Lead Time
                          </span>
                          {group.outOfStockCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" />
                              {group.outOfStockCount} Out of Stock
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500 mt-1">
                          <span>License: <strong className="text-slate-700 font-mono">{group.supplier.drugLicenseNumber}</strong></span>
                          <span>•</span>
                          <span>Phone: <strong className="text-slate-700">{group.supplier.phone}</strong></span>
                          <span>•</span>
                          <span>Payable Balance: <strong className="text-rose-600 font-mono">{fmt(group.balancePayable)}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Financial Summary & Group Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-right px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="text-[11px] text-slate-500">Selected Order Total</div>
                        <div className="text-base font-bold font-mono text-emerald-700">
                          {fmt(group.totalEstimatedAmount)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {group.selectedItemsCount} of {group.totalItemsCount} items ({group.totalSuggestedPacks} packs)
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          id={`btn-print-supplier-${group.supplier.id}`}
                          type="button"
                          onClick={() => handleOpenPrintModal(group)}
                          title="Print requisition sheet"
                          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        <button
                          id={`btn-create-po-supplier-${group.supplier.id}`}
                          type="button"
                          onClick={() => handleGenerateSupplierPO(group)}
                          disabled={group.selectedItemsCount === 0}
                          className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Generate PO ({group.selectedItemsCount})</span>
                        </button>

                        <button
                          id={`btn-toggle-collapse-${group.supplier.id}`}
                          type="button"
                          onClick={() => toggleSupplierCollapse(group.supplier.id)}
                          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Supplier Sub-Header: Select all toggle & MOV progress */}
                  {!isCollapsed && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleSupplierAll(group.supplier.id, true)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                          Select All ({group.items.length})
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => handleToggleSupplierAll(group.supplier.id, false)}
                          className="text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          Deselect All
                        </button>
                      </div>

                      {/* Minimum Order Value indicator */}
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-slate-500">Free Freight Target ({fmt(group.minOrderValueTarget)}):</span>
                        <div className="w-24 bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${group.meetsMinOrderValue ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(100, (group.totalEstimatedAmount / group.minOrderValueTarget) * 100)}%` }}
                          />
                        </div>
                        {group.meetsMinOrderValue ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Target Met
                          </span>
                        ) : (
                          <span className="text-amber-700 font-bold">
                            {fmt(Math.max(0, group.minOrderValueTarget - group.totalEstimatedAmount))} short
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Line Items Table */}
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-3 w-10 text-center">
                            <span className="sr-only">Select</span>
                          </th>
                          <th className="px-3 py-3">Medicine & Specification</th>
                          <th className="px-3 py-3">Current Stock</th>
                          <th className="px-3 py-3">Consumption (ADC)</th>
                          <th className="px-3 py-3">Stockout Risk</th>
                          <th className="px-3 py-3 text-center">Pack Size</th>
                          <th className="px-3 py-3 text-center">Suggested Order</th>
                          <th className="px-3 py-3 text-right">Unit Cost</th>
                          <th className="px-3 py-3 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.items.map(item => {
                          const isOos = item.riskLevel === 'out_of_stock';
                          const isCrit = item.riskLevel === 'critical';
                          const isReorder = item.riskLevel === 'reorder_point';

                          return (
                            <tr
                              key={item.medicineId}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                !item.isSelected ? 'opacity-60 bg-slate-50/30' : ''
                              }`}
                            >
                              {/* Selection Checkbox */}
                              <td className="px-3 py-3 text-center">
                                <input
                                  id={`checkbox-item-${item.medicineId}`}
                                  type="checkbox"
                                  checked={item.isSelected}
                                  onChange={() => handleToggleItemSelect(item.medicineId, item.isSelected)}
                                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                              </td>

                              {/* Medicine Details */}
                              <td className="px-3 py-3 max-w-[220px]">
                                <div className="font-bold text-slate-900 leading-tight">
                                  {item.medicineName}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                  {item.genericName} • {item.dosageForm} ({item.strength})
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  Loc: {item.rackLocation} • {item.category}
                                </div>
                              </td>

                              {/* Current Stock vs Threshold */}
                              <td className="px-3 py-3">
                                <div className="flex items-baseline gap-1.5 font-mono">
                                  <span className={`font-bold text-sm ${
                                    isOos ? 'text-rose-600' : isCrit ? 'text-orange-600' : 'text-slate-800'
                                  }`}>
                                    {item.currentStock}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    / {item.reorderLevel} min
                                  </span>
                                </div>
                                <div className="w-20 bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                  <div
                                    className={`h-full ${
                                      isOos ? 'bg-rose-500' : isCrit ? 'bg-orange-500' : 'bg-amber-400'
                                    }`}
                                    style={{
                                      width: `${Math.min(100, Math.max(5, (item.currentStock / item.reorderLevel) * 100))}%`
                                    }}
                                  />
                                </div>
                                {item.deficit > 0 && (
                                  <div className="text-[10px] font-bold text-rose-600 mt-0.5">
                                    -{item.deficit} {item.unitOfMeasure} deficit
                                  </div>
                                )}
                              </td>

                              {/* Consumption Velocity (ADC) */}
                              <td className="px-3 py-3">
                                <div className="text-slate-900 font-semibold font-mono">
                                  {item.avgDailyConsumption} / day
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {item.salesLast30Days} sold last 30d
                                </div>
                              </td>

                              {/* Stockout Risk Badge */}
                              <td className="px-3 py-3">
                                {isOos ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                                    <ShieldAlert className="w-3 h-3" />
                                    <span>Stockout (0d)</span>
                                  </span>
                                ) : isCrit ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">
                                    <Clock className="w-3 h-3" />
                                    <span>{item.daysOfStockRemaining}d left (Critical)</span>
                                  </span>
                                ) : isReorder ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>{item.daysOfStockRemaining}d left (Reorder)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span>{item.daysOfStockRemaining}d left (Safe)</span>
                                  </span>
                                )}
                              </td>

                              {/* Pack Size */}
                              <td className="px-3 py-3 text-center">
                                <span className="inline-block px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-mono text-[11px]">
                                  {item.packSize} {item.unitOfMeasure}/pack
                                </span>
                              </td>

                              {/* Suggested Order Stepper */}
                              <td className="px-3 py-3 text-center">
                                <div className="inline-flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden shadow-2xs">
                                  <button
                                    id={`btn-pack-minus-${item.medicineId}`}
                                    type="button"
                                    onClick={() => handleAdjustPacks(item.medicineId, item.adjustedPacks, -1)}
                                    className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <input
                                    id={`input-pack-${item.medicineId}`}
                                    type="text"
                                    value={item.adjustedPacks}
                                    onChange={e => handleDirectPackInput(item.medicineId, e.target.value)}
                                    className="w-12 text-center font-bold font-mono text-xs py-1 text-slate-900 focus:outline-none bg-white"
                                  />
                                  <button
                                    id={`btn-pack-plus-${item.medicineId}`}
                                    type="button"
                                    onClick={() => handleAdjustPacks(item.medicineId, item.adjustedPacks, 1)}
                                    className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono mt-1">
                                  = {item.adjustedQuantity} {item.unitOfMeasure}
                                </div>
                              </td>

                              {/* Unit Cost */}
                              <td className="px-3 py-3 text-right font-mono">
                                <div className="font-semibold text-slate-900">
                                  {fmt(item.unitPurchasePrice)}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  MRP {fmt(item.mrp)}
                                </div>
                              </td>

                              {/* Line Total */}
                              <td className="px-3 py-3 text-right font-mono">
                                <div className="font-bold text-slate-900 text-sm">
                                  {fmt(item.estimatedTotal)}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  +{item.taxRate}% Tax ({fmt(item.estimatedTax)})
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. BULK PURCHASE ORDER CONFIRMATION MODAL                                 */}
      {/* ========================================================================= */}
      {isBulkConfirmOpen && (
        <div id="modal-bulk-confirm" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Confirm Bulk Purchase Order Generation
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  The automated suggester will dispatch separate purchase orders per distributor.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Orders to be Created:
              </div>
              <div className="max-h-52 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                {processedGroups.filter(g => g.selectedItemsCount > 0).map(g => (
                  <div key={g.supplier.id} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{g.supplier.name}</div>
                      <div className="text-slate-500 text-[11px]">
                        {g.selectedItemsCount} items ({g.totalSuggestedPacks} packs) • {g.paymentTerms}
                      </div>
                    </div>
                    <div className="font-bold font-mono text-emerald-700">
                      {fmt(g.totalEstimatedAmount)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                <span className="font-bold">Total Requisition Outlay:</span>
                <span className="font-bold font-mono text-base text-emerald-800">
                  {fmt(overallMetrics.totalSelectedAmount)}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                id="btn-cancel-bulk-modal"
                type="button"
                onClick={() => setIsBulkConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-bulk-generation"
                type="button"
                onClick={handleGenerateBulkPOs}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                Confirm & Generate {overallMetrics.totalSuppliersWithOrders} PO(s)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. SUCCESS MODAL WITH DIRECT PO REGISTER NAVIGATION                       */}
      {/* ========================================================================= */}
      {successModalData && (
        <div id="modal-success-generation" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Purchase Order(s) Successfully Created!
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Automated requisitions have been logged into the procurement register and supplier liability balances.
            </p>

            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Orders Generated:</span>
                <strong className="text-slate-800">{successModalData.poList.length} Purchase Order(s)</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Outlay:</span>
                <strong className="text-emerald-700 font-mono">{fmt(successModalData.totalAmount)}</strong>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-500 text-[11px] block">Distributor(s):</span>
                <div className="font-medium text-slate-700 text-[11px] truncate">
                  {successModalData.supplierNames.join(', ')}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center gap-2.5">
              <button
                id="btn-close-success-modal"
                type="button"
                onClick={() => setSuccessModalData(null)}
                className="w-full sm:w-1/2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                Stay in Suggester
              </button>
              <button
                id="btn-goto-po-register"
                type="button"
                onClick={() => {
                  setSuccessModalData(null);
                  if (onNavigateToPoRegister) {
                    onNavigateToPoRegister(successModalData.poList[0]?.id);
                  }
                }}
                className="w-full sm:w-1/2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>View PO Register</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. PRINT / EXPORT REQUISITION MODAL                                       */}
      {/* ========================================================================= */}
      {isPrintModalOpen && printGroup && (
        <div id="modal-print-requisition" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
            {/* Modal Actions */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-bold text-slate-900">Printable Purchase Requisition</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="btn-execute-browser-print"
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>
                <button
                  id="btn-close-print-modal"
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Formal Requisition Document Sheet */}
            <div className="border border-slate-300 rounded-xl p-6 sm:p-8 text-slate-900 space-y-6 print:border-none print:p-0">
              {/* Hospital Letterhead */}
              <div className="flex items-start justify-between border-b border-slate-300 pb-4">
                <div>
                  <h1 className="text-lg font-bold text-slate-950 uppercase tracking-tight">
                    Madina Eye Hospital Ltd. & Pharmacy Depot
                  </h1>
                  <p className="text-xs text-slate-600">
                    Department of Pharmaceutical Procurement & Inventory Control
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Dhaka, Bangladesh • Contact: +880 2-8891000 • Email: pharmacy@madinaeye.org
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 px-2 py-1 rounded inline-block">
                    Automated Purchase Requisition
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-mono">
                    Date: {new Date().toLocaleDateString('en-GB')}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    Ref: REQ-{Date.now().toString().slice(-6)}
                  </div>
                </div>
              </div>

              {/* Supplier Details */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 font-medium block">Distributor / Vendor:</span>
                  <strong className="text-sm text-slate-900 font-bold block mt-0.5">
                    {printGroup.supplier.name}
                  </strong>
                  <span className="text-slate-600 block mt-0.5">{printGroup.supplier.address}</span>
                  <span className="text-slate-600 block">Phone: {printGroup.supplier.phone}</span>
                </div>
                <div className="space-y-1">
                  <div>
                    <span className="text-slate-500">DGDA Drug License: </span>
                    <strong className="font-mono">{printGroup.supplier.drugLicenseNumber}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Tax TIN: </span>
                    <strong className="font-mono">{printGroup.supplier.taxId}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Payment Terms: </span>
                    <strong>{printGroup.paymentTerms}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Expected Delivery: </span>
                    <strong>Within {printGroup.leadTimeDays} Business Days</strong>
                  </div>
                </div>
              </div>

              {/* Itemized Requisition Table */}
              <table className="w-full text-left text-xs border border-slate-300">
                <thead className="bg-slate-100 text-[11px] font-bold text-slate-700 uppercase border-b border-slate-300">
                  <tr>
                    <th className="p-2 border-r border-slate-300 w-8 text-center">#</th>
                    <th className="p-2 border-r border-slate-300">Medicine & Specification</th>
                    <th className="p-2 border-r border-slate-300 text-center">Pack Size</th>
                    <th className="p-2 border-r border-slate-300 text-center">Reorder Packs</th>
                    <th className="p-2 border-r border-slate-300 text-center">Total Units</th>
                    <th className="p-2 border-r border-slate-300 text-right">Unit Price</th>
                    <th className="p-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {printGroup.items.filter(it => it.isSelected).map((it, idx) => (
                    <tr key={it.medicineId} className="even:bg-slate-50/50">
                      <td className="p-2 border-r border-slate-300 text-center font-mono">{idx + 1}</td>
                      <td className="p-2 border-r border-slate-300">
                        <div className="font-bold text-slate-900">{it.medicineName}</div>
                        <div className="text-[10px] text-slate-500">{it.genericName} • {it.dosageForm}</div>
                      </td>
                      <td className="p-2 border-r border-slate-300 text-center font-mono">
                        {it.packSize} {it.unitOfMeasure}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-center font-bold font-mono">
                        {it.adjustedPacks}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-center font-mono">
                        {it.adjustedQuantity} {it.unitOfMeasure}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-right font-mono">
                        {fmt(it.unitPurchasePrice)}
                      </td>
                      <td className="p-2 text-right font-bold font-mono">
                        {fmt(it.estimatedTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                  <tr>
                    <td colSpan={5} className="p-2 text-right">Subtotal:</td>
                    <td colSpan={2} className="p-2 text-right font-mono">{fmt(printGroup.totalEstimatedSubtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="p-2 text-right">Estimated Tax (VAT):</td>
                    <td colSpan={2} className="p-2 text-right font-mono">{fmt(printGroup.totalEstimatedTax)}</td>
                  </tr>
                  <tr className="text-sm bg-emerald-50 text-emerald-950">
                    <td colSpan={5} className="p-2.5 text-right font-bold">Estimated Grand Total:</td>
                    <td colSpan={2} className="p-2.5 text-right font-bold font-mono text-base">{fmt(printGroup.totalEstimatedAmount)}</td>
                  </tr>
                </tfoot>
              </table>

              {/* Signatures */}
              <div className="pt-10 grid grid-cols-3 gap-8 text-center text-xs">
                <div className="border-t border-slate-400 pt-2">
                  <div className="font-semibold text-slate-800">Prepared By</div>
                  <div className="text-[10px] text-slate-500">Store Pharmacist</div>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <div className="font-semibold text-slate-800">Verified By</div>
                  <div className="text-[10px] text-slate-500">Procurement Manager</div>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <div className="font-semibold text-slate-800">Approved By</div>
                  <div className="text-[10px] text-slate-500">Medical Superintendent</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
