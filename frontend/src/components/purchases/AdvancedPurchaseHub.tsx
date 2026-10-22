import React, { useState } from 'react';
import {
  FileText,
  Truck,
  Layers,
  Scale,
  Sparkles,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Award,
  DollarSign,
  ThermometerSnowflake,
  ShieldCheck,
  Building2,
  Printer,
  X,
  PackagePlus,
  FileCheck,
} from 'lucide-react';
import {
  PurchaseRequisition,
  GoodsReceivedNote,
  MoleculePriceComparison,
  SupplierPerformanceMetric,
  AutoPurchaseSuggestionItem,
} from '../../types/pharmapulse';
import { PharmacyService } from '../../services/pharmacyService';
import { batchApi } from '../../lib/api';

interface AdvancedPurchaseHubProps {
  onConvertToPO?: (items: any[], supplierName: string) => void;
  onOpenPriceHistory?: (drugName: string) => void;
}

export const AdvancedPurchaseHub: React.FC<AdvancedPurchaseHubProps> = ({
  onConvertToPO,
  onOpenPriceHistory,
}) => {
  // Active Subtab
  const [activeTab, setActiveTab] = useState<
    'auto_suggest' | 'requisitions' | 'grn' | 'price_comparison' | 'supplier_scorecards'
  >('auto_suggest');

  // Datasets
  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([]);
  const [grnList, setGrnList] = useState<GoodsReceivedNote[]>([]);
  const [priceComparisons] = useState<MoleculePriceComparison[]>([]);
  const [supplierMetrics] = useState<SupplierPerformanceMetric[]>([]);
  const [autoSuggestions, setAutoSuggestions] = useState<
    AutoPurchaseSuggestionItem[]
  >([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showNewPRModal, setShowNewPRModal] = useState(false);
  const [showNewGRNModal, setShowNewGRNModal] = useState(false);
  const [viewingGRN, setViewingGRN] = useState<GoodsReceivedNote | null>(null);

  // New PR Form
  const medicines = PharmacyService.getMedicines();
  const suppliers = PharmacyService.getSuppliers();

  const [prDept, setPrDept] = useState('Pharmacy Counter (OPD Ground Floor)');
  const [prRequester, setPrRequester] = useState('Tahmina Akhter');
  
  const [prSupplierId, setPrSupplierId] = useState(suppliers[0]?.id || '');
  const [prMedicineId, setPrMedicineId] = useState('');
  
  const [prCurStock, setPrCurStock] = useState(0);
  const [prReqQty, setPrReqQty] = useState(50);
  const [prEstPrice, setPrEstPrice] = useState(0);
  const [prJustification, setPrJustification] = useState('');

  // Filter medicines based on supplier
  const prFilteredMedicines = React.useMemo(() => {
    const currentSup = suppliers.find(s => s.id === prSupplierId);
    if (!currentSup) return medicines;
    const vendorName = (currentSup.name || '').toLowerCase();
    const companyName = (currentSup.companyName || '').toLowerCase();
    
    const matched = medicines.filter(m => {
      const mfr = (m.manufacturer || '').toLowerCase();
      if (!mfr) return false;
      return mfr === vendorName || mfr === companyName || 
             (vendorName && vendorName.includes(mfr)) || (companyName && companyName.includes(mfr)) || 
             mfr.includes(vendorName) || mfr.includes(companyName);
    });

    return matched.length > 0 ? matched : medicines;
  }, [medicines, suppliers, prSupplierId]);

  // When medicine changes, update current stock and price
  React.useEffect(() => {
    if (prMedicineId) {
      const med = medicines.find(m => m.id === prMedicineId);
      if (med) {
        const batches = PharmacyService.getBatches().filter(b => b.medicineId === med.id);
        const stock = batches.reduce((acc, b) => acc + (b.currentStock || 0), 0);
        setPrCurStock(stock);
        // Estimate price from last batch or fallback
        setPrEstPrice(batches.length > 0 ? (batches[batches.length - 1].purchasePrice || 0) : 100);
        setPrJustification(`Current stock ${stock} is below reorder level ${med.reorderLevel}. Immediate replenishment needed.`);
      }
    }
  }, [prMedicineId, medicines]);


  // New GRN Form
  const [grnPoNo, setGrnPoNo] = useState('PO-2026-0195');
  const [grnSupplier, setGrnSupplier] = useState('Square Pharmaceuticals Ltd.');
  const [grnChallan, setGrnChallan] = useState('CH-SQ-99940');
  const [grnTemp, setGrnTemp] = useState('4.5°C (Refrigerated Ophthalmic / Insulin)');
  const [grnItemName, setGrnItemName] = useState(''); // Stores medicine ID
  const [grnOrdQty, setGrnOrdQty] = useState(100);
  const [grnRcvQty, setGrnRcvQty] = useState(100);
  const [grnFreeQty, setGrnFreeQty] = useState(0);
  const [grnBatch, setGrnBatch] = useState('SQ-9104');
  const [grnExp, setGrnExp] = useState('08/2028');
  const [grnPrice, setGrnPrice] = useState(28.0);

  // Handle Approve Requisition
  const handleApproveRequisition = (prId: string) => {
    setRequisitions((prev) =>
      prev.map((r) =>
        r.id === prId
          ? {
              ...r,
              status: 'APPROVED',
              approvedBy: 'Dr. Shahabuddin Ahmed (Central Store Director)',
            }
          : r
      )
    );
  };

  // Convert Auto Suggestion or Requisition into PO
  const handleTriggerPO = (item: AutoPurchaseSuggestionItem) => {
    if (onConvertToPO) {
      onConvertToPO(
        [
          {
            medicineName: item.medicineName,
            quantity: item.suggestedPurchase,
            unitPrice: item.unitPurchasePrice,
          },
        ],
        item.preferredSupplier
      );
    } else {
      alert(
        `PO Generated for ${item.medicineName} (Qty: ${item.suggestedPurchase} units) to ${item.preferredSupplier}`
      );
    }
  };

  const handleCreateRequisition = (e: React.FormEvent) => {
    e.preventDefault();
    const med = medicines.find(m => m.id === prMedicineId);
    const sup = suppliers.find(s => s.id === prSupplierId);
    
    if (!med || !sup) {
      alert("Please select a medicine and a supplier.");
      return;
    }

    const newPR: PurchaseRequisition = {
      id: `pr-${Date.now()}`,
      requisitionNumber: `PR-2026-${Math.floor(100 + Math.random() * 900)}`,
      departmentBranch: prDept,
      requestedBy: prRequester,
      requestDate: new Date().toISOString().split('T')[0],
      urgency: 'Emergency',
      status: 'PENDING',
      totalEstimatedAmount: Number(prReqQty) * Number(prEstPrice),
      items: [
        {
          medicineName: med.name,
          genericName: med.genericName,
          currentStock: Number(prCurStock),
          requestedQty: Number(prReqQty),
          estimatedUnitPrice: Number(prEstPrice),
          preferredSupplier: sup.name,
          justification: prJustification,
        },
      ],
    };
    setRequisitions([newPR, ...requisitions]);
    setShowNewPRModal(false);
  };

  const handleCreateGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grnItemName) {
      alert("Please select a medicine.");
      return;
    }
    
    const med = medicines.find(m => m.id === grnItemName);
    if (!med) return;

    try {
      const payload = {
        productId: med.id,
        batchNumber: grnBatch,
        manufacturingDate: new Date().toISOString(),
        expiryDate: new Date(grnExp).toISOString(), // ensure valid date formatting in a real app
        purchasePrice: Number(grnPrice),
        mrp: Number(grnPrice) * 1.25,
        unitSellingPrice: Number(grnPrice) * 1.15,
        initialQuantity: Number(grnRcvQty) + Number(grnFreeQty),
        currentStock: Number(grnRcvQty) + Number(grnFreeQty),
        status: 'ACTIVE',
        rackLocation: med.defaultRackLocation || 'Unassigned',
        supplierId: suppliers.find(s => s.name === grnSupplier)?.id
      };

      await batchApi.createBatch(payload);

      const total = Number(grnRcvQty) * Number(grnPrice);
      const newGrn: GoodsReceivedNote = {
        id: `grn-${Date.now()}`,
        grnNumber: `GRN-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        poNumber: grnPoNo,
        supplierName: grnSupplier,
        challanNumber: grnChallan,
        receivedDate: new Date().toLocaleString(),
        receivedBy: 'Md. Rayhan Kabir (PharmD)',
        storageLocation: 'Main Depot - Cold / Active Shelf',
        coldChainTemperature: grnTemp,
        physicalInspectionPassed: true,
        totalReceivedAmount: total,
        items: [
          {
            medicineName: med.name,
            orderedQty: Number(grnOrdQty),
            receivedQty: Number(grnRcvQty),
            bonusFreeQty: Number(grnFreeQty),
            damagedQty: 0,
            batchNumber: grnBatch,
            mfgDate: '08/2026',
            expDate: grnExp,
            purchasePrice: Number(grnPrice),
            mrp: Number(grnPrice) * 1.25,
          },
        ],
      };
      setGrnList([newGrn, ...grnList]);
      setShowNewGRNModal(false);
      alert("Inward GRN Delivery saved and Database Stock Updated Live!");
    } catch (err) {
      console.error("Failed to create GRN batch in DB", err);
      alert("Failed to save stock to database. Check console.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" />
              Advanced Procurement &amp; SCM
            </span>
            <span className="text-xs text-slate-300">
              DGDA &amp; Enterprise Institutional Standards
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Advanced Purchase Management &amp; Reorder Engine
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-3xl">
            Streamlining Purchase Requisition (PR), Purchase Order (PO), Goods Received Note (GRN), Multi-Vendor Best Price Comparison, Supplier Scorecards, and Velocity-driven Auto Suggestions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowNewPRModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-600 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-indigo-400" />
            New Requisition (PR)
          </button>

          <button
            onClick={() => setShowNewGRNModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <FileCheck className="w-4 h-4" />
            Receive GRN Delivery
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        <button
          onClick={() => setActiveTab('auto_suggest')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'auto_suggest'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          Auto Purchase Suggestion (Reorder Level &amp; Velocity)
          <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px]">
            {autoSuggestions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('requisitions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'requisitions'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          Purchase Requisition (PR)
          <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px]">
            {requisitions.filter((r) => r.status === 'PENDING').length} Pending
          </span>
        </button>

        <button
          onClick={() => setActiveTab('grn')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'grn'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          Goods Received Note (GRN) Log
        </button>

        <button
          onClick={() => setActiveTab('price_comparison')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'price_comparison'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Scale className="w-4 h-4" />
          Best Supplier Price Comparison Matrix
        </button>

        <button
          onClick={() => setActiveTab('supplier_scorecards')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'supplier_scorecards'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Award className="w-4 h-4" />
          Supplier Performance Scorecards
        </button>
      </div>

      {/* 1. TAB: Auto Purchase Suggestion (Reorder Level & Velocity) */}
      {activeTab === 'auto_suggest' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-950 dark:text-indigo-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Intelligent Reorder &amp; Velocity Formula Engine
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Formula: <code>Suggested Purchase = (Daily Velocity × Target Buffer Days) + Reorder Level - Current Stock</code>
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-semibold">
                Est. Procurement Budget
              </span>
              <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">
                ৳
                {autoSuggestions
                  .reduce((a, b) => a + b.totalEstimatedCost, 0)
                  .toLocaleString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {autoSuggestions.map((sug) => (
              <div
                key={sug.id}
                className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        sug.urgencyLevel === 'CRITICAL_OUT'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200'
                          : sug.urgencyLevel === 'URGENT_REORDER'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {sug.urgencyLevel.replace('_', ' ')}
                    </span>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white mt-1">
                      {sug.medicineName}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      {sug.genericName} • {sug.strength}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Suggested PO Qty
                    </span>
                    <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {sug.suggestedPurchase}{' '}
                      <span className="text-xs font-normal text-slate-400">units</span>
                    </span>
                  </div>
                </div>

                {/* Stock vs Reorder Level Metrics Pill Grid */}
                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Current Stock</span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        sug.currentStock <= sug.reorderLevel
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {sug.currentStock} units
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] block">Reorder Level</span>
                    <span className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400">
                      {sug.reorderLevel} units
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] block">Daily Velocity</span>
                    <span className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">
                      {sug.dailyConsumptionVelocity} / day
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <strong>Reason:</strong> {sug.reason}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                  <div className="text-xs">
                    <span className="text-slate-400 block text-[10px]">Preferred Vendor:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {sug.preferredSupplier}
                    </span>
                  </div>

                  <button
                    onClick={() => handleTriggerPO(sug)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                    Convert to PO (৳{sug.totalEstimatedCost.toFixed(2)})
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. TAB: Purchase Requisition (PR) */}
      {activeTab === 'requisitions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Branch &amp; Department Purchase Requisitions
            </h3>
            <button
              onClick={() => setShowNewPRModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Submit Requisition
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Requisition #</th>
                    <th className="py-3 px-4">Origin Dept / Branch</th>
                    <th className="py-3 px-4">Items &amp; Quantities</th>
                    <th className="py-3 px-4">Urgency</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Est. Amount</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {requisitions.map((pr) => (
                    <tr
                      key={pr.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {pr.requisitionNumber}
                        <div className="text-[10px] text-slate-400 font-normal">
                          {pr.requestDate}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {pr.departmentBranch}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          By: {pr.requestedBy}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {pr.items.map((it, idx) => (
                            <div key={idx} className="font-medium text-slate-900 dark:text-white">
                              {it.medicineName}{' '}
                              <span className="text-slate-400 font-normal font-mono text-[11px]">
                                (Req: {it.requestedQty} • Stock: {it.currentStock})
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            pr.urgency === 'Emergency'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {pr.urgency}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            pr.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : pr.status === 'CONVERTED_TO_PO'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {pr.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        ৳{pr.totalEstimatedAmount.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {pr.status === 'PENDING' ? (
                          <button
                            onClick={() => handleApproveRequisition(pr.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all cursor-pointer"
                          >
                            Approve PR
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-semibold">
                            Approved by HO
                          </span>
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

      {/* 3. TAB: Goods Received Note (GRN) */}
      {activeTab === 'grn' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Institutional Goods Received Notes (GRN) &amp; QC Receiving
            </h3>
            <button
              onClick={() => setShowNewGRNModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Record Inward GRN Delivery
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">GRN # / Challan</th>
                    <th className="py-3 px-4">Supplier &amp; PO</th>
                    <th className="py-3 px-4">Received Items &amp; Bonus</th>
                    <th className="py-3 px-4">Cold Chain &amp; QC</th>
                    <th className="py-3 px-4">Warehouse Bin</th>
                    <th className="py-3 px-4 text-right">Total Inward Value</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {grnList.map((grn) => (
                    <tr
                      key={grn.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {grn.grnNumber}
                        <div className="text-[10px] text-slate-400 font-normal">
                          Challan: {grn.challanNumber}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {grn.supplierName}
                        </div>
                        <div className="text-[11px] text-indigo-600 font-mono">
                          {grn.poNumber}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {grn.items.map((it, idx) => (
                            <div key={idx} className="font-medium text-slate-900 dark:text-white">
                              {it.medicineName}{' '}
                              <span className="text-slate-400 font-normal font-mono text-[11px]">
                                ({it.receivedQty} rcvd + {it.bonusFreeQty} bonus • Batch: {it.batchNumber})
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-[11px] text-cyan-600 font-semibold">
                          <ThermometerSnowflake className="w-3.5 h-3.5" />
                          {grn.coldChainTemperature}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                          <ShieldCheck className="w-3 h-3" />
                          Physical QC Passed
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {grn.storageLocation}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white text-sm">
                        ৳{grn.totalReceivedAmount.toLocaleString()}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setViewingGRN(grn)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-white text-[11px] font-bold"
                        >
                          View GRN
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB: Best Supplier Price Comparison Matrix */}
      {activeTab === 'price_comparison' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-950 dark:text-indigo-200">
            <strong>Institutional Multi-Vendor SCM:</strong> Compares active Trade Prices, Trade Discounts (TD), Net Effective Unit Rates, Payment Credit Days, and Delivery Lead Times across top licensed manufacturers.
          </div>

          <div className="space-y-6">
            {priceComparisons.map((cmp) => (
              <div
                key={cmp.id}
                className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      {cmp.moleculeName}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Standard Formulation: {cmp.strengthForm} • Benchmark MRP: ৳{cmp.benchmarkPrice.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-2.5">Manufacturer</th>
                        <th className="p-2.5">Brand Formulation</th>
                        <th className="p-2.5 text-right">Pack Trade Price</th>
                        <th className="p-2.5 text-right">Trade Disc. %</th>
                        <th className="p-2.5 text-right">Net Unit Cost</th>
                        <th className="p-2.5 text-right">Margin %</th>
                        <th className="p-2.5 text-center">Credit Days</th>
                        <th className="p-2.5 text-center">Lead Time</th>
                        <th className="p-2.5 text-right">Best Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {cmp.competitors.map((c, idx) => (
                        <tr
                          key={idx}
                          className={
                            c.isBestPrice
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 font-semibold'
                              : ''
                          }
                        >
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                            {c.supplierName}
                          </td>
                          <td className="p-2.5">{c.brandName}</td>
                          <td className="p-2.5 text-right font-mono">
                            ৳{c.tradePricePerPack.toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-indigo-600">
                            {c.tradeDiscountPercent}%
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                            ৳{c.effectiveUnitPrice.toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-emerald-600">
                            {c.marginPercent}%
                          </td>
                          <td className="p-2.5 text-center font-mono">
                            {c.creditDays} days
                          </td>
                          <td className="p-2.5 text-center font-mono">
                            {c.leadTimeDays} day(s)
                          </td>
                          <td className="p-2.5 text-right">
                            {c.isBestPrice ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                <Award className="w-3 h-3" />
                                Recommended Best Rate
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">
                                Alternative
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. TAB: Supplier Performance Scorecards */}
      {activeTab === 'supplier_scorecards' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Supplier Name</th>
                    <th className="py-3 px-4">Grade &amp; Tier</th>
                    <th className="py-3 px-4 text-right">On-Time Delivery</th>
                    <th className="py-3 px-4 text-right">Order Fill Rate</th>
                    <th className="py-3 px-4 text-right">Return / Defect %</th>
                    <th className="py-3 px-4 text-center">Credit Term</th>
                    <th className="py-3 px-4 text-right">Monthly Spend</th>
                    <th className="py-3 px-4 text-right">Outstanding Payable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {supplierMetrics.map((sup) => (
                    <tr
                      key={sup.supplierId}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        {sup.supplierName}
                        <div className="text-[10px] text-slate-400 font-normal">
                          Category: {sup.category}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                            sup.ratingGrade === 'A+'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          }`}
                        >
                          Grade {sup.ratingGrade}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                        {sup.onTimeDeliveryRate}%
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-600">
                        {sup.fillRatePercent}%
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-slate-600 dark:text-slate-300">
                        {sup.defectReturnRate}%
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono">
                        {sup.creditDaysAllowed} Days
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        ৳{sup.totalMonthlySpend.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        ৳{sup.outstandingPayable.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: New Purchase Requisition */}
      {showNewPRModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Create Purchase Requisition (PR)
                </h3>
              </div>
              <button
                onClick={() => setShowNewPRModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequisition} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Department / Branch
                  </label>
                  <select
                    value={prDept}
                    onChange={(e) => setPrDept(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
                  >
                    <option value="Pharmacy Counter (OPD Ground Floor)">
                      Pharmacy Counter (OPD Ground Floor)
                    </option>
                    <option value="Hospital Pharmacy (Madina Eye Inpatient)">
                      Hospital Pharmacy (Madina Eye Inpatient)
                    </option>
                    <option value="Branch A (Dhanmondi Main)">
                      Branch A (Dhanmondi Main)
                    </option>
                    <option value="Branch B (Mirpur Model)">
                      Branch B (Mirpur Model)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Requested By
                  </label>
                  <input
                    type="text"
                    value={prRequester}
                    onChange={(e) => setPrRequester(e.target.value)}
                    required
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Preferred Supplier *
                </label>
                <select
                  value={prSupplierId}
                  onChange={(e) => setPrSupplierId(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select a Supplier / Distributor --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.companyName})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Medicine Name *
                </label>
                <select
                  value={prMedicineId}
                  onChange={(e) => setPrMedicineId(e.target.value)}
                  required
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select a Medicine --</option>
                  {prFilteredMedicines.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.strength}) - {m.manufacturer}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Current Stock
                  </label>
                  <input
                    type="number"
                    value={prCurStock}
                    onChange={(e) => setPrCurStock(Number(e.target.value))}
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Requested Qty
                  </label>
                  <input
                    type="number"
                    value={prReqQty}
                    onChange={(e) => setPrReqQty(Number(e.target.value))}
                    required
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Est. Unit Price (৳)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={prEstPrice}
                    onChange={(e) => setPrEstPrice(Number(e.target.value))}
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                  />
                </div>
              </div>

              {/* Removed original Preferred Supplier text input */}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Justification
                </label>
                <textarea
                  rows={2}
                  value={prJustification}
                  onChange={(e) => setPrJustification(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewPRModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  Submit Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: New Goods Received Note (GRN) */}
      {showNewGRNModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Record Inward GRN Delivery
                </h3>
              </div>
              <button
                onClick={() => setShowNewGRNModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGRN} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    PO Number
                  </label>
                  <input
                    type="text"
                    value={grnPoNo}
                    onChange={(e) => setGrnPoNo(e.target.value)}
                    required
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Supplier Challan #
                  </label>
                  <input
                    type="text"
                    value={grnChallan}
                    onChange={(e) => setGrnChallan(e.target.value)}
                    required
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier Name
                </label>
                <select
                  value={grnSupplier}
                  onChange={(e) => setGrnSupplier(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
                >
                  <option value="Square Pharmaceuticals Ltd.">Square Pharmaceuticals Ltd.</option>
                  <option value="Beximco Pharmaceuticals Ltd.">Beximco Pharmaceuticals Ltd.</option>
                  <option value="Incepta Pharmaceuticals Ltd.">Incepta Pharmaceuticals Ltd.</option>
                  <option value="Healthcare Pharmaceuticals Ltd.">Healthcare Pharmaceuticals Ltd.</option>
                  <option value="Aristopharma Ltd. (Ophthalmic)">Aristopharma Ltd. (Ophthalmic)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Medicine Name
                </label>
                <select
                  value={grnItemName}
                  onChange={(e) => setGrnItemName(e.target.value)}
                  required
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                >
                  <option value="">-- Select Medicine --</option>
                  {medicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.strength})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Received Qty
                  </label>
                  <input
                    type="number"
                    value={grnRcvQty}
                    onChange={(e) => setGrnRcvQty(Number(e.target.value))}
                    required
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Bonus / Free Qty
                  </label>
                  <input
                    type="number"
                    value={grnFreeQty}
                    onChange={(e) => setGrnFreeQty(Number(e.target.value))}
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-emerald-600 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Batch #
                  </label>
                  <input
                    type="text"
                    value={grnBatch}
                    onChange={(e) => setGrnBatch(e.target.value)}
                    required
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="text"
                    value={grnExp}
                    onChange={(e) => setGrnExp(e.target.value)}
                    placeholder="MM/YYYY"
                    required
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Unit Purchase Price (৳)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={grnPrice}
                    onChange={(e) => setGrnPrice(Number(e.target.value))}
                    required
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Cold Chain Temperature Verification
                </label>
                <input
                  type="text"
                  value={grnTemp}
                  onChange={(e) => setGrnTemp(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewGRNModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Save &amp; Inward Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: View GRN Details */}
      {viewingGRN && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Goods Received Note #{viewingGRN.grnNumber}
                </h3>
              </div>
              <button
                onClick={() => setViewingGRN(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Supplier:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {viewingGRN.supplierName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">PO Number:</span>
                <span className="font-mono text-indigo-600">
                  {viewingGRN.poNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Delivery Challan:</span>
                <span className="font-mono font-bold">
                  {viewingGRN.challanNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cold Chain Inspection:</span>
                <span className="text-cyan-600 font-semibold">
                  {viewingGRN.coldChainTemperature}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Inspected By:</span>
                <span>{viewingGRN.receivedBy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Inward Value:</span>
                <span className="font-mono font-bold text-emerald-600 text-base">
                  ৳{viewingGRN.totalReceivedAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold"
              >
                <Printer className="w-4 h-4" />
                Print GRN
              </button>
              <button
                onClick={() => setViewingGRN(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
