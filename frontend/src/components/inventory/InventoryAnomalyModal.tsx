import React, { useState } from 'react';
import {
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Package,
  Clock,
  ArrowRight,
  CheckCircle2,
  X,
  Truck,
  Building2,
  ShieldAlert,
  ChevronRight,
  Info,
  RefreshCw,
  Zap,
  Layers,
  FileCheck
} from 'lucide-react';

export interface InventoryAnomaly {
  id: string;
  medicineName: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  category: string;
  manufacturer: string;
  currentStock: number;
  staticSafetyStock: number;
  dynamicAiSafetyThreshold: number;
  dailyVelocity: number;
  surgeIndexPercent: number; // e.g., +84%
  leadTimeDays: number;
  severity: 'critical' | 'high' | 'moderate';
  hoursUntilDepletion: number;
  aiExplanation: string;
  sisterBranchAvailableStock: {
    branchName: string;
    stock: number;
  };
  suggestedPoQty: number;
  estimatedCost: number;
  poGenerated?: boolean;
  acknowledged?: boolean;
}

const INITIAL_ANOMALIES: InventoryAnomaly[] = [
  {
    id: 'anom-01',
    medicineName: 'Vigamox (Moxifloxacin 0.5%)',
    genericName: 'Moxifloxacin HCl',
    strength: '0.5% (5ml)',
    dosageForm: 'Ophthalmic Drop',
    category: 'Ophthalmic & ENT',
    manufacturer: 'Square Pharmaceuticals Ltd.',
    currentStock: 16,
    staticSafetyStock: 30,
    dynamicAiSafetyThreshold: 92,
    dailyVelocity: 24,
    surgeIndexPercent: 84,
    leadTimeDays: 2,
    severity: 'critical',
    hoursUntilDepletion: 16,
    aiExplanation:
      'Seasonal bacterial conjunctivitis wave and post-cataract clinic volume spiked daily run-rate from 12 to 24 vials/day (+84%). Static reorder point (30) will cause a complete stockout in 16 hours.',
    sisterBranchAvailableStock: {
      branchName: 'Mirpur Eye Center (Node #012)',
      stock: 140,
    },
    suggestedPoQty: 120,
    estimatedCost: 45600,
  },
  {
    id: 'anom-02',
    medicineName: 'Kilmax 500 (Cefuroxime)',
    genericName: 'Cefuroxime Axetil',
    strength: '500 mg',
    dosageForm: 'Tablet',
    category: 'Antibiotics',
    manufacturer: 'Incepta Pharmaceuticals Ltd.',
    currentStock: 24,
    staticSafetyStock: 40,
    dynamicAiSafetyThreshold: 110,
    dailyVelocity: 32,
    surgeIndexPercent: 62,
    leadTimeDays: 1,
    severity: 'critical',
    hoursUntilDepletion: 18,
    aiExplanation:
      'Inpatient surgical ward prophylaxis protocol expanded consumption to 32 strips/day. Current stock of 24 units creates an emergency deficit (-86 units) against the dynamic AI buffer.',
    sisterBranchAvailableStock: {
      branchName: 'Dhanmondi Hospital Pharmacy (Node #004)',
      stock: 95,
    },
    suggestedPoQty: 150,
    estimatedCost: 67500,
  },
  {
    id: 'anom-03',
    medicineName: 'Atropine Sulfate 1%',
    genericName: 'Atropine Sulfate',
    strength: '1% (5ml)',
    dosageForm: 'Ophthalmic Drop',
    category: 'Ophthalmic & ENT',
    manufacturer: 'Beximco Pharmaceuticals Ltd.',
    currentStock: 8,
    staticSafetyStock: 20,
    dynamicAiSafetyThreshold: 48,
    dailyVelocity: 9,
    surgeIndexPercent: 55,
    leadTimeDays: 3,
    severity: 'high',
    hoursUntilDepletion: 21,
    aiExplanation:
      'Pediatric refraction clinic booked 45 cycloplegic examinations over the next 48 hours. Supplier lead time (3 days) requires an elevated dynamic threshold of 48 bottles.',
    sisterBranchAvailableStock: {
      branchName: 'Uttara Diagnostic Unit (Node #018)',
      stock: 42,
    },
    suggestedPoQty: 60,
    estimatedCost: 8400,
  },
  {
    id: 'anom-04',
    medicineName: 'Zimax 500 (Azithromycin)',
    genericName: 'Azithromycin Monohydrate',
    strength: '500 mg',
    dosageForm: 'Tablet',
    category: 'Antibiotics',
    manufacturer: 'Square Pharmaceuticals Ltd.',
    currentStock: 35,
    staticSafetyStock: 50,
    dynamicAiSafetyThreshold: 140,
    dailyVelocity: 28,
    surgeIndexPercent: 70,
    leadTimeDays: 3,
    severity: 'high',
    hoursUntilDepletion: 30,
    aiExplanation:
      'Acute upper respiratory prescription surge in OPD consultations. Supplier warehouse maintenance added 48-hour delivery delay, tripling standard safety buffer requirement.',
    sisterBranchAvailableStock: {
      branchName: 'Chittagong Regional Hub (Node #002)',
      stock: 220,
    },
    suggestedPoQty: 160,
    estimatedCost: 56000,
  },
  {
    id: 'anom-05',
    medicineName: 'Betoptic / Timolol 0.5%',
    genericName: 'Timolol Maleate',
    strength: '0.5% (5ml)',
    dosageForm: 'Ophthalmic Drop',
    category: 'Ophthalmic & ENT',
    manufacturer: 'Aristopharma Ltd.',
    currentStock: 14,
    staticSafetyStock: 25,
    dynamicAiSafetyThreshold: 55,
    dailyVelocity: 11,
    surgeIndexPercent: 38,
    leadTimeDays: 2,
    severity: 'moderate',
    hoursUntilDepletion: 31,
    aiExplanation:
      'Bi-weekly glaucoma patient refill window commencing in 36 hours. 38 registered chronic patients will arrive for recurring monthly replenishment prescriptions.',
    sisterBranchAvailableStock: {
      branchName: 'Mirpur Eye Center (Node #012)',
      stock: 65,
    },
    suggestedPoQty: 80,
    estimatedCost: 12000,
  },
];

interface InventoryAnomalyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const InventoryAnomalyModal: React.FC<InventoryAnomalyModalProps> = ({
  isOpen,
  onClose,
  onToast,
}) => {
  const [anomalies, setAnomalies] = useState<InventoryAnomaly[]>(INITIAL_ANOMALIES);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'high' | 'moderate'>('all');
  const [showFormulaGuide, setShowFormulaGuide] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  if (!isOpen) return null;

  const filtered = anomalies.filter((a) => {
    if (filterSeverity === 'all') return true;
    return a.severity === filterSeverity;
  });

  const criticalCount = anomalies.filter((a) => a.severity === 'critical' && !a.poGenerated).length;
  const highCount = anomalies.filter((a) => a.severity === 'high' && !a.poGenerated).length;

  const handleGenerateSinglePo = (id: string) => {
    setAnomalies((prev) =>
      prev.map((item) => (item.id === id ? { ...item, poGenerated: true } : item))
    );
    const item = anomalies.find((a) => a.id === id);
    if (onToast && item) {
      onToast(
        `✓ Urgent PO created for ${item.medicineName} (${item.suggestedPoQty} units) via ${item.manufacturer}`,
        'success'
      );
    }
  };

  const handleRequestBranchTransfer = (id: string) => {
    const item = anomalies.find((a) => a.id === id);
    if (!item) return;
    setAnomalies((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
    if (onToast) {
      onToast(
        `✓ Inter-Branch Transfer (IBT) requested: 50 units of ${item.medicineName} from ${item.sisterBranchAvailableStock.branchName}`,
        'success'
      );
    }
  };

  const handleAcknowledge = (id: string) => {
    setAnomalies((prev) =>
      prev.map((item) => (item.id === id ? { ...item, acknowledged: true } : item))
    );
    if (onToast) {
      onToast('Anomaly alert acknowledged & snoozed for 4 hours.', 'info');
    }
  };

  const handleBulkGenerateAllPo = () => {
    setIsBulkProcessing(true);
    setTimeout(() => {
      setAnomalies((prev) => prev.map((item) => ({ ...item, poGenerated: true })));
      setIsBulkProcessing(false);
      if (onToast) {
        onToast(
          '✓ Emergency POs automatically generated for all critical & surge anomalies!',
          'success'
        );
      }
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#12161f] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Inventory Anomaly Watchdog (ইনভেন্টরি অ্যানোমালি)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  AI Dynamic Safety Stock
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live alerts for items falling below dynamic thresholds calculated from velocity, lead time & surge factors.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFormulaGuide(!showFormulaGuide)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition"
            >
              <Info className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden sm:inline">AI Formula</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dynamic Formula Explanation Drawer (Collapsible) */}
        {showFormulaGuide && (
          <div className="px-6 py-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/60 text-xs text-indigo-950 dark:text-indigo-200 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                <Sparkles className="w-4 h-4" /> Dynamic Safety Threshold Formula:
              </span>
              <span className="font-mono text-[11px] bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                Threshold = (Daily Velocity × Lead Time) + (Z × σ × Surge Index)
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              Unlike static reorder points (e.g. fixed 20 or 40 units), PharmaPulse AI recalculates safety stock continuously using active prescription velocity, seasonal ophthalmic/infection waves, and real-time vendor fulfillment latency.
            </p>
          </div>
        )}

        {/* Severity Tabs & Actions Ribbon */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#12161f]">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <button
              onClick={() => setFilterSeverity('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterSeverity === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              All Anomalies ({anomalies.length})
            </button>
            <button
              onClick={() => setFilterSeverity('critical')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                filterSeverity === 'critical'
                  ? 'bg-rose-600 text-white'
                  : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              Critical ({criticalCount})
            </button>
            <button
              onClick={() => setFilterSeverity('high')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterSeverity === 'high'
                  ? 'bg-orange-500 text-white'
                  : 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40'
              }`}
            >
              Surge Deficits ({highCount})
            </button>
            <button
              onClick={() => setFilterSeverity('moderate')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterSeverity === 'moderate'
                  ? 'bg-amber-500 text-white'
                  : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
              }`}
            >
              Lead Time Risk (1)
            </button>
          </div>

          <button
            onClick={handleBulkGenerateAllPo}
            disabled={isBulkProcessing || criticalCount === 0}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition"
          >
            {isBulkProcessing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            <span>Generate Emergency Auto-PO for All ({criticalCount + highCount})</span>
          </button>
        </div>

        {/* Scrollable Anomaly Cards List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 dark:bg-[#0d1117]">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                All inventory levels are operating safely above AI forecast thresholds!
              </p>
              <p className="text-xs text-slate-400 mt-1">No active stock anomalies detected in this view.</p>
            </div>
          ) : (
            filtered.map((anomaly) => {
              const deficit = anomaly.dynamicAiSafetyThreshold - anomaly.currentStock;
              const stockRatio = Math.min(
                100,
                Math.round((anomaly.currentStock / anomaly.dynamicAiSafetyThreshold) * 100)
              );

              return (
                <div
                  key={anomaly.id}
                  className={`rounded-2xl border bg-white dark:bg-[#161b26] p-5 shadow-xs transition-all ${
                    anomaly.severity === 'critical'
                      ? 'border-rose-200 dark:border-rose-900/60 hover:shadow-rose-500/5'
                      : anomaly.severity === 'high'
                      ? 'border-orange-200 dark:border-orange-900/60 hover:shadow-orange-500/5'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {/* Top Bar: Title, Manufacturer & Urgency Badge */}
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                            anomaly.severity === 'critical'
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
                              : anomaly.severity === 'high'
                              ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800'
                              : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                          }`}
                        >
                          {anomaly.severity === 'critical'
                            ? 'Critical: Stockout Imminent'
                            : anomaly.severity === 'high'
                            ? 'High: Demand Surge Spike'
                            : 'Moderate: Supplier Delay'}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">
                          {anomaly.category}
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                        {anomaly.medicineName}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {anomaly.genericName} • {anomaly.strength} • {anomaly.dosageForm} • {anomaly.manufacturer}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold text-xs">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Depletes in ~{anomaly.hoursUntilDepletion} Hours</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Velocity: {anomaly.dailyVelocity} units/day
                      </span>
                    </div>
                  </div>

                  {/* Visual Stock Comparison Bar */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 mb-3">
                    <div className="grid grid-cols-3 gap-3 text-center mb-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Current Stock
                        </span>
                        <span className="text-base font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                          {anomaly.currentStock} units
                        </span>
                      </div>
                      <div className="flex flex-col border-x border-slate-200 dark:border-slate-700 px-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Static Reorder Point
                        </span>
                        <span className="text-base font-semibold text-slate-500 dark:text-slate-400 font-mono">
                          {anomaly.staticSafetyStock} units
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center justify-center gap-1">
                          <Sparkles className="w-3 h-3" /> AI Dynamic Threshold
                        </span>
                        <span className="text-base font-extrabold text-indigo-700 dark:text-indigo-300 font-mono">
                          {anomaly.dynamicAiSafetyThreshold} units
                        </span>
                      </div>
                    </div>

                    {/* Gauge track */}
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 relative overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          anomaly.severity === 'critical'
                            ? 'bg-rose-500'
                            : anomaly.severity === 'high'
                            ? 'bg-orange-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${stockRatio}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5">
                      <span>Stock Coverage: {stockRatio}% of AI threshold</span>
                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                        Deficit: -{deficit} units
                      </span>
                    </div>
                  </div>

                  {/* AI Predictive Insight */}
                  <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 mb-3 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">AI Anomaly Analysis: </span>
                      <span className="text-slate-700 dark:text-slate-300">{anomaly.aiExplanation}</span>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-amber-800 dark:text-amber-300">
                        <span>Surge Index: <strong>+{anomaly.surgeIndexPercent}%</strong></span>
                        <span>Vendor Lead Time: <strong>{anomaly.leadTimeDays} Days</strong></span>
                        <span>Sister Branch Buffer: <strong>{anomaly.sisterBranchAvailableStock.stock} units at {anomaly.sisterBranchAvailableStock.branchName}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Recommended Auto-PO:</span>
                      <strong className="text-slate-800 dark:text-slate-200 font-mono">
                        {anomaly.suggestedPoQty} units (~৳{anomaly.estimatedCost.toLocaleString()})
                      </strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAcknowledge(anomaly.id)}
                        disabled={anomaly.acknowledged}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
                      >
                        {anomaly.acknowledged ? '✓ Snoozed (4h)' : 'Snooze'}
                      </button>

                      <button
                        onClick={() => handleRequestBranchTransfer(anomaly.id)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 font-semibold flex items-center gap-1.5 transition"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Request IBT Transfer</span>
                      </button>

                      <button
                        onClick={() => handleGenerateSinglePo(anomaly.id)}
                        disabled={anomaly.poGenerated}
                        className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                          anomaly.poGenerated
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                        }`}
                      >
                        {anomaly.poGenerated ? (
                          <>
                            <FileCheck className="w-3.5 h-3.5" />
                            <span>PO Dispatched</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5" />
                            <span>⚡ Quick Auto-PO</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161f] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <ShieldAlert className="w-4 h-4 text-emerald-600" />
            <span>AI Dynamic Safety Threshold Model verified against DGDA hospital pharmacy compliance guidelines.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
