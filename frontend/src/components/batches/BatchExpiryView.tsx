import React, { useState, useMemo } from 'react';
import { 
  ClockAlert, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Search, 
  Trash2, 
  RotateCcw, 
  ShieldCheck,
  Building,
  DollarSign,
  Calendar,
  Layers
} from 'lucide-react';
import { Batch } from '../../types/pharmacy';
import { PharmacyService } from '../../services/pharmacyService';

interface BatchExpiryViewProps {
  onDataChanged?: () => void;
}

export const BatchExpiryView: React.FC<BatchExpiryViewProps> = ({ onDataChanged }) => {
  const [batches, setBatches] = useState<Batch[]>(() => PharmacyService.getBatches());
  const [search, setSearch] = useState('');
  const [activeRadarTab, setActiveRadarTab] = useState<'all' | 'expired' | 'critical' | 'near' | 'healthy' | 'quarantined'>('all');

  const refreshBatches = () => {
    setBatches(PharmacyService.getBatches());
    if (onDataChanged) onDataChanged();
  };

  const nowTime = new Date().getTime();

  // Categorize batches with precise day counts
  const analyzedBatches = useMemo(() => {
    return batches.map(b => {
      const expDate = new Date(b.expiryDate);
      const diffDays = Math.ceil((expDate.getTime() - nowTime) / (1000 * 60 * 60 * 24));
      
      let category: 'expired' | 'critical' | 'near' | 'healthy';
      if (diffDays <= 0 || b.status === 'expired') {
        category = 'expired';
      } else if (diffDays <= 30) {
        category = 'critical';
      } else if (diffDays <= 90) {
        category = 'near';
      } else {
        category = 'healthy';
      }

      const costValue = (b.currentStock || 0) * (b.purchasePrice || 0);
      const salesValue = (b.currentStock || 0) * (b.sellingPrice || 0);

      return {
        ...b,
        diffDays,
        category,
        costValue,
        salesValue
      };
    });
  }, [batches, nowTime]);

  // Totals & Financial risk
  const riskMetrics = useMemo(() => {
    let expiredCost = 0;
    let criticalCost = 0;
    let nearCost = 0;

    let expiredCount = 0;
    let criticalCount = 0;
    let nearCount = 0;
    let healthyCount = 0;
    let quarantinedCount = 0;

    analyzedBatches.forEach(b => {
      if (b.status === 'quarantined') quarantinedCount++;

      if (b.category === 'expired') {
        expiredCount++;
        expiredCost += b.costValue;
      } else if (b.category === 'critical') {
        criticalCount++;
        criticalCost += b.costValue;
      } else if (b.category === 'near') {
        nearCount++;
        nearCost += b.costValue;
      } else {
        healthyCount++;
      }
    });

    return {
      expiredCost,
      criticalCost,
      nearCost,
      expiredCount,
      criticalCount,
      nearCount,
      healthyCount,
      quarantinedCount,
      totalAtRiskCost: criticalCost + nearCost
    };
  }, [analyzedBatches]);

  // Filtering
  const filtered = useMemo(() => {
    return analyzedBatches.filter(b => {
      const matchSearch = 
        b.batchNumber.toLowerCase().includes(search.toLowerCase()) ||
        b.medicineName.toLowerCase().includes(search.toLowerCase()) ||
        (b.supplierName && b.supplierName.toLowerCase().includes(search.toLowerCase()));

      let matchTab = true;
      if (activeRadarTab === 'quarantined') {
        matchTab = b.status === 'quarantined';
      } else if (activeRadarTab !== 'all') {
        matchTab = b.category === activeRadarTab && b.status !== 'quarantined';
      }

      return matchSearch && matchTab;
    });
  }, [analyzedBatches, search, activeRadarTab]);

  // Quarantine Batch Action
  const handleQuarantine = (batch: Batch) => {
    if (confirm(`Quarantine batch ${batch.batchNumber} of ${batch.medicineName}? It will be locked from POS sales immediately.`)) {
      PharmacyService.updateBatch({
        ...batch,
        status: 'quarantined'
      });
      refreshBatches();
    }
  };

  // Dispose Expired Batch Action
  const handleDispose = (batch: Batch) => {
    if (confirm(`Dispose of ${batch.currentStock} units in batch ${batch.batchNumber}? Stock will be written off.`)) {
      PharmacyService.updateBatch({
        ...batch,
        currentStock: 0,
        status: 'depleted'
      });
      refreshBatches();
    }
  };

  return (
    <div className="p-4 md:p-6 bg-slate-100 min-h-[calc(100vh-85px)] space-y-4">
      
      {/* Title ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ClockAlert className="w-5 h-5 text-emerald-600" />
            <span>FEFO Expiry Radar & Quarantine Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict First-Expiry-First-Out enforcement, zero-tolerance expired batch lockouts, and return risk audit.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Zero-Tolerance Lockout: Active</span>
          </div>
        </div>
      </div>

      {/* Financial Risk KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Expired Stock Loss */}
        <div className="bg-white p-3.5 rounded-xl border border-red-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center text-red-600 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-red-700">Expired Stock (Locked)</div>
            <div className="text-lg font-extrabold text-red-900 mt-0.5">
              ${(riskMetrics?.expiredCost ?? 0).toFixed(2)}
            </div>
            <p className="text-[10px] text-red-600">{riskMetrics?.expiredCount ?? 0} batches zero-tolerance blocked</p>
          </div>
        </div>

        {/* Critical Expiry (<30d) */}
        <div className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-rose-700">Critical Expiry (&lt;30d)</div>
            <div className="text-lg font-extrabold text-rose-900 mt-0.5">
              ${(riskMetrics?.criticalCost ?? 0).toFixed(2)}
            </div>
            <p className="text-[10px] text-rose-600">{riskMetrics?.criticalCount ?? 0} batches require immediate return/use</p>
          </div>
        </div>

        {/* Near Expiry (30-90d) */}
        <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <ClockAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-amber-700">Near Expiry (30-90d)</div>
            <div className="text-lg font-extrabold text-amber-900 mt-0.5">
              ${(riskMetrics?.nearCost ?? 0).toFixed(2)}
            </div>
            <p className="text-[10px] text-amber-600">{riskMetrics.nearCount} batches in FEFO priority queue</p>
          </div>
        </div>

        {/* Safe Healthy Batches */}
        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-emerald-700">Healthy Stock (&gt;90d)</div>
            <div className="text-lg font-extrabold text-emerald-900 mt-0.5">
              {riskMetrics.healthyCount} Batches
            </div>
            <p className="text-[10px] text-emerald-600">Stable inventory with adequate shelf-life</p>
          </div>
        </div>
      </div>

      {/* Filter and Radar Tabs */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by batch #, medicine name, distributor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            {[
              { id: 'all', label: `All (${analyzedBatches.length})` },
              { id: 'expired', label: `Expired (${riskMetrics.expiredCount})`, alert: riskMetrics.expiredCount > 0 },
              { id: 'critical', label: `Critical <30d (${riskMetrics.criticalCount})` },
              { id: 'near', label: `Near Expiry (${riskMetrics.nearCount})` },
              { id: 'healthy', label: `Healthy (${riskMetrics.healthyCount})` },
              { id: 'quarantined', label: `Quarantine (${riskMetrics.quarantinedCount})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveRadarTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeRadarTab === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                } ${tab.alert && activeRadarTab !== tab.id ? 'text-red-600 ring-1 ring-red-300' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px]">
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Medicine & Location</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Time Remaining</th>
                <th className="py-3 px-4">Stock Qty</th>
                <th className="py-3 px-4">Cost Value</th>
                <th className="py-3 px-4">Retail Value</th>
                <th className="py-3 px-4">FEFO Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400">
                    No batches match the selected radar filter.
                  </td>
                </tr>
              ) : (
                filtered.map(b => {
                  const isExpired = b.category === 'expired';
                  const isQuarantined = b.status === 'quarantined';

                  return (
                    <tr
                      key={b.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isExpired
                          ? 'bg-red-50/50'
                          : b.category === 'critical'
                          ? 'bg-rose-50/30'
                          : b.category === 'near'
                          ? 'bg-amber-50/30'
                          : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {b.batchNumber}
                        {b.supplierName && (
                          <div className="text-[10px] text-slate-400 font-sans font-normal truncate max-w-[150px]">
                            {b.supplierName}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{b.medicineName}</div>
                        <div className="text-[10px] text-slate-500">{b.rackLocation || 'Shelf Storage'}</div>
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-700">
                        {b.expiryDate}
                      </td>

                      <td className="py-3 px-4 font-bold">
                        {isExpired ? (
                          <span className="text-red-600 font-extrabold">
                            Expired ({Math.abs(b.diffDays)} days ago)
                          </span>
                        ) : b.diffDays <= 30 ? (
                          <span className="text-rose-600 font-bold">{b.diffDays} days left</span>
                        ) : b.diffDays <= 90 ? (
                          <span className="text-amber-600 font-semibold">{b.diffDays} days left</span>
                        ) : (
                          <span className="text-emerald-700 font-medium">{b.diffDays} days left</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-extrabold text-slate-900">
                        {b.currentStock}
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        ৳{Number(b.costValue ?? 0).toFixed(2)}
                        <span className="text-[10px] text-slate-400 block">@৳{Number(b.purchasePrice ?? 0).toFixed(2)}</span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-800">
                        ৳{Number(b.salesValue ?? 0).toFixed(2)}
                        <span className="text-[10px] text-slate-400 block">@৳{Number(b.sellingPrice ?? 0).toFixed(2)}</span>
                      </td>

                      <td className="py-3 px-4">
                        {isQuarantined ? (
                          <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                            QUARANTINED
                          </span>
                        ) : isExpired ? (
                          <span className="text-[10px] font-black bg-red-600 text-white px-2 py-0.5 rounded animate-pulse">
                            EXPIRED • LOCKED
                          </span>
                        ) : b.category === 'critical' ? (
                          <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded">
                            CRITICAL FEFO
                          </span>
                        ) : b.category === 'near' ? (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                            PRIORITY FEFO
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                            HEALTHY
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isQuarantined && (
                            <button
                              onClick={() => handleQuarantine(b)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold cursor-pointer"
                              title="Quarantine this batch"
                            >
                              Quarantine
                            </button>
                          )}

                          {isExpired && (
                            <button
                              onClick={() => handleDispose(b)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold cursor-pointer"
                              title="Dispose / Write off expired stock"
                            >
                              Dispose
                            </button>
                          )}
                        </div>
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
  );
};
