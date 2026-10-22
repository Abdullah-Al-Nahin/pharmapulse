import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Snowflake, 
  MapPin, 
  ShieldAlert, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  ArrowRightLeft, 
  Lock, 
  Sparkles,
  HelpCircle,
  Tag
} from 'lucide-react';
import { Medicine, Batch } from '../../types/pharmacy';
import { MaskedCost } from '../common/PermissionGuard';
import { StorageZone } from '../../types/inventoryAdvanced';

interface BatchStockFefoTableProps {
  medicines: Medicine[];
  batches: Batch[];
  reservedBatches: { batchNumber: string; quantity: number }[];
  quarantinedBatchNumbers: string[];
  bonusBatches: { batchNumber: string; bonusQuantity: number }[];
  onAddBatch: (med: Medicine) => void;
  onTransferBatch: (med: Medicine, batch: Batch) => void;
  onQuarantineBatch: (med: Medicine, batch: Batch) => void;
  onReserveBatch: (med: Medicine, batch: Batch) => void;
  onRelocateBatch: (med: Medicine, batch: Batch) => void;
  onDeductBatch?: (med: Medicine, batch: Batch) => void;
}

export const BatchStockFefoTable: React.FC<BatchStockFefoTableProps> = ({
  medicines,
  batches,
  reservedBatches,
  quarantinedBatchNumbers,
  bonusBatches,
  onAddBatch,
  onTransferBatch,
  onQuarantineBatch,
  onReserveBatch,
  onRelocateBatch,
  onDeductBatch
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low_stock' | 'cold_chain' | 'near_expiry'>('all');
  const [expandedMedIds, setExpandedMedIds] = useState<Set<string>>(new Set());

  const todayStr = new Date().toISOString().split('T')[0];

  const toggleExpand = (id: string) => {
    const next = new Set(expandedMedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedMedIds(next);
  };

  const expandAll = () => {
    setExpandedMedIds(new Set(medicines.map(m => m.id)));
  };

  const collapseAll = () => {
    setExpandedMedIds(new Set());
  };

  // Stock calculations with FEFO priority
  const medicineData = useMemo(() => {
    return medicines.map(med => {
      const medBatches = batches.filter(b => b.medicineId === med.id);
      
      // Separate batches: physical stock vs saleable unexpired stock
      const physicalBatches = medBatches.filter(b => !quarantinedBatchNumbers.includes(b.batchNumber));
      const totalPhysicalStock = physicalBatches.reduce((acc, b) => acc + b.currentStock, 0);

      // Only unexpired batches are eligible for POS dispensing
      const saleableBatches = physicalBatches.filter(b => b.status !== 'expired' && b.expiryDate > todayStr);
      const saleableStock = saleableBatches.reduce((acc, b) => acc + b.currentStock, 0);

      // Reserved stock for this med
      const reservedCount = reservedBatches
        .filter(r => medBatches.some(b => b.batchNumber === r.batchNumber))
        .reduce((sum, r) => sum + r.quantity, 0);

      const netAvailableForSale = Math.max(0, saleableStock - reservedCount);

      // Sort batches by Expiry Date ascending for FEFO auto-picking order
      const sortedFefoBatches = [...medBatches].sort((a, b) => {
        // Expired or quarantined go last
        const aExpired = a.expiryDate <= todayStr || a.status === 'expired' || quarantinedBatchNumbers.includes(a.batchNumber);
        const bExpired = b.expiryDate <= todayStr || b.status === 'expired' || quarantinedBatchNumbers.includes(b.batchNumber);
        if (aExpired && !bExpired) return 1;
        if (!aExpired && bExpired) return -1;
        return a.expiryDate.localeCompare(b.expiryDate);
      });

      const isLowStock = netAvailableForSale <= med.reorderLevel;
      const isColdChain = med.rackLocation.toLowerCase().includes('fridge') || 
                          med.rackLocation.toLowerCase().includes('cold') ||
                          med.category === 'Ophthalmic & ENT';

      return {
        medicine: med,
        batches: sortedFefoBatches,
        totalPhysicalStock,
        reservedCount,
        netAvailableForSale,
        isLowStock,
        isColdChain
      };
    });
  }, [medicines, batches, reservedBatches, quarantinedBatchNumbers, todayStr]);

  const filteredData = useMemo(() => {
    return medicineData.filter(({ medicine, netAvailableForSale, isLowStock, isColdChain, batches }) => {
      const matchQuery = 
        medicine.name.toLowerCase().includes(search.toLowerCase()) ||
        medicine.genericName.toLowerCase().includes(search.toLowerCase()) ||
        (medicine.brandName && medicine.brandName.toLowerCase().includes(search.toLowerCase())) ||
        medicine.rackLocation.toLowerCase().includes(search.toLowerCase()) ||
        batches.some(b => b.batchNumber.toLowerCase().includes(search.toLowerCase()));

      const matchCat = categoryFilter === 'All' || medicine.category === categoryFilter;

      let matchStatus = true;
      if (stockStatusFilter === 'low_stock') {
        matchStatus = isLowStock;
      } else if (stockStatusFilter === 'cold_chain') {
        matchStatus = isColdChain;
      } else if (stockStatusFilter === 'near_expiry') {
        matchStatus = batches.some(b => {
          const days = Math.ceil((new Date(b.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          return days > 0 && days <= 90;
        });
      }

      return matchQuery && matchCat && matchStatus;
    });
  }, [medicineData, search, categoryFilter, stockStatusFilter]);

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search medicine, generic formula, batch number, or rack/shelf/bin location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent text-slate-800 font-medium focus:outline-none text-xs"
            >
              <option value="All">All Categories</option>
              <option value="Ophthalmic & ENT">Ophthalmic & ENT</option>
              <option value="Antibiotics">Antibiotics</option>
              <option value="Analgesics & Antipyretics">Analgesics & Antipyretics</option>
              <option value="Cardiovascular">Cardiovascular</option>
              <option value="Antidiabetic">Antidiabetic</option>
              <option value="Respiratory">Respiratory</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {(['all', 'low_stock', 'near_expiry', 'cold_chain'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStockStatusFilter(tab)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  stockStatusFilter === tab
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'all' && 'All'}
                {tab === 'low_stock' && 'Low Stock'}
                {tab === 'near_expiry' && 'Near Expiry (<90d)'}
                {tab === 'cold_chain' && 'Cold Chain (2-8°C)'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-500 border-l border-slate-200 pl-2">
            <button
              onClick={expandAll}
              className="px-2 py-1 hover:bg-slate-100 rounded text-slate-600 font-medium"
            >
              Expand All
            </button>
            <span>•</span>
            <button
              onClick={collapseAll}
              className="px-2 py-1 hover:bg-slate-100 rounded text-slate-600 font-medium"
            >
              Collapse
            </button>
          </div>
        </div>
      </div>

      {/* FEFO Algorithm Banner Note */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-950">
          <span className="font-bold text-emerald-900">FEFO (First Expiry, First Out) Automated Picking Active: </span>
          The system automatically sequences batches by earliest expiry date. Dispensation in the POS counter and Inpatient Wards automatically deducts from <span className="font-bold underline decoration-emerald-500">FEFO Priority #1</span> batches first, eliminating shelf expiry losses and preserving sterile drug efficacy.
        </div>
      </div>

      {/* Medicine & Batch Listing Cards */}
      <div className="space-y-3">
        {filteredData.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500">
            <Layers className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-sm">No pharmaceutical products matching your filter criteria</p>
            <p className="text-xs text-slate-400 mt-1">Try changing the search keyword, category, or stock filter above.</p>
          </div>
        ) : (
          filteredData.map(({ medicine, batches: medBatches, totalPhysicalStock, reservedCount, netAvailableForSale, isLowStock, isColdChain }) => {
            const isExpanded = expandedMedIds.has(medicine.id);

            return (
              <div 
                key={medicine.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all"
              >
                {/* Medicine Header Row */}
                <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{medicine.name}</h3>
                      {medicine.brandName && (
                        <span className="text-[10px] font-semibold bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded border border-slate-300">
                          Brand: {medicine.brandName}
                        </span>
                      )}
                      <span className="text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded">
                        {medicine.category}
                      </span>
                      {medicine.requiresPrescription && (
                        <span className="text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded">
                          Rx
                        </span>
                      )}
                      {isColdChain && (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded">
                          <Snowflake className="w-3 h-3 text-sky-500" />
                          2°C - 8°C Cold Chain
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 italic">
                      Formula: <strong className="text-slate-700 font-medium">{medicine.genericName}</strong> • {medicine.dosageForm} ({medicine.strength})
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                      <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        Rack/Bin: <strong className="text-slate-800 font-bold">{medicine.rackLocation}</strong>
                      </span>
                      <span>Mfr: <strong className="text-slate-700">{medicine.manufacturer}</strong></span>
                      <span>Pack: <strong className="text-slate-700">{medicine.packSize} / {medicine.unitOfMeasure}</strong></span>
                      <span>Reorder Lvl: <strong className="text-slate-700">{medicine.reorderLevel}</strong></span>
                    </div>
                  </div>

                  {/* Stock Counts Metric Box */}
                  <div className="flex items-center gap-4 shrink-0 flex-wrap lg:flex-nowrap justify-between lg:justify-end">
                    <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-2xs text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Physical Stock</span>
                        <span className="text-sm font-extrabold text-slate-900">{totalPhysicalStock}</span>
                      </div>
                      <div className="w-px h-6 bg-slate-200" />
                      <div>
                        <span className="text-[10px] text-amber-600 block uppercase font-bold flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> Reserved
                        </span>
                        <span className="text-sm font-bold text-amber-700">{reservedCount}</span>
                      </div>
                      <div className="w-px h-6 bg-slate-200" />
                      <div>
                        <span className="text-[10px] text-emerald-600 block uppercase font-bold">Avail for POS</span>
                        <span className={`text-base font-black ${
                          isLowStock ? 'text-amber-600 flex items-center gap-1' : 'text-emerald-700'
                        }`}>
                          {netAvailableForSale}
                          {isLowStock && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onAddBatch(medicine)}
                        className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                        title="Inward new batch entry"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Inward Batch</span>
                      </button>

                      <button
                        onClick={() => toggleExpand(medicine.id)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 cursor-pointer"
                        title={isExpanded ? 'Collapse batches' : 'View batch breakdown'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Batch-wise Expanded Table with FEFO Sequence */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-200 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Batch Inventory Matrix ({medBatches.length} Batches Tracked)
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Ranked by <strong className="text-emerald-700 font-bold">FEFO Auto-Picking Algorithm</strong>
                      </span>
                    </div>

                    {medBatches.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">No batches recorded for this medicine yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                              <th className="py-2">FEFO Priority</th>
                              <th className="py-2">Batch #</th>
                              <th className="py-2">Rack / Shelf / Bin</th>
                              <th className="py-2">Expiry Date</th>
                              <th className="py-2">Shelf Life</th>
                              <th className="py-2">Unit Cost</th>
                              <th className="py-2">MRP</th>
                              <th className="py-2">Sell Price</th>
                              <th className="py-2 text-right">Physical Qty</th>
                              <th className="py-2 text-center">Batch Status</th>
                              <th className="py-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {medBatches.map((batch, index) => {
                              const isQuarantined = quarantinedBatchNumbers.includes(batch.batchNumber) || batch.status === 'quarantined';
                              const isExpired = batch.expiryDate <= todayStr || batch.status === 'expired';
                              const daysLeft = Math.ceil((new Date(batch.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                              
                              const bonusInfo = bonusBatches.find(b => b.batchNumber === batch.batchNumber);
                              const isBonusBatch = !!bonusInfo;

                              // FEFO index: only unexpired and unquarantined active batches get priority numbers
                              const isFefoEligible = !isExpired && !isQuarantined && batch.currentStock > 0;
                              let fefoBadge = null;

                              if (isExpired) {
                                fefoBadge = <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded">EXPIRED</span>;
                              } else if (isQuarantined) {
                                fefoBadge = <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded">QUARANTINE</span>;
                              } else if (index === 0 && isFefoEligible) {
                                fefoBadge = (
                                  <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-xs flex items-center gap-1 w-max">
                                    <Sparkles className="w-2.5 h-2.5" /> #1 PICK FIRST
                                  </span>
                                );
                              } else if (index === 1 && isFefoEligible) {
                                fefoBadge = <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">#2 SEQUENCE</span>;
                              } else if (isFefoEligible) {
                                fefoBadge = <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded">#{index + 1} RESERVE</span>;
                              } else {
                                fefoBadge = <span className="text-slate-400 text-[10px]">DEPLETED</span>;
                              }

                              return (
                                <tr 
                                  key={batch.id} 
                                  className={`hover:bg-slate-50/70 transition-colors ${
                                    isExpired ? 'bg-rose-50/40 text-rose-900' : isQuarantined ? 'bg-purple-50/30' : ''
                                  }`}
                                >
                                  <td className="py-2.5">{fefoBadge}</td>
                                  <td className="py-2.5 font-mono font-bold text-slate-900 flex items-center gap-1.5">
                                    <span>{batch.batchNumber}</span>
                                    {isBonusBatch && (
                                      <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1 py-0.5 rounded flex items-center gap-0.5" title="Trade Bonus Stock">
                                        <Tag className="w-2.5 h-2.5" /> Bonus
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5">
                                    <span className="text-slate-700 font-medium flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-slate-400" />
                                      {batch.rackLocation || medicine.rackLocation}
                                    </span>
                                  </td>
                                  <td className="py-2.5 font-medium text-slate-800">{batch.expiryDate}</td>
                                  <td className="py-2.5">
                                    {isExpired ? (
                                      <span className="text-rose-600 font-bold">{Math.abs(daysLeft)}d expired</span>
                                    ) : daysLeft <= 30 ? (
                                      <span className="text-rose-600 font-bold flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" /> {daysLeft}d left (CRITICAL)
                                      </span>
                                    ) : daysLeft <= 90 ? (
                                      <span className="text-amber-600 font-semibold">{daysLeft}d left (Near)</span>
                                    ) : (
                                      <span className="text-emerald-700 font-medium">{daysLeft} days</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 text-slate-600">
                                    <MaskedCost value={batch.purchasePrice} />
                                  </td>
                                  <td className="py-2.5 text-slate-500">৳{Number(batch.mrp ?? batch.sellingPrice ?? (batch as any).unitSellingPrice ?? 0).toFixed(2)}</td>
                                  <td className="py-2.5 font-bold text-slate-900">৳{Number(batch.sellingPrice ?? (batch as any).unitSellingPrice ?? 0).toFixed(2)}</td>
                                  <td className="py-2.5 text-right font-extrabold text-slate-900">
                                    {batch.currentStock} {medicine.unitOfMeasure}s
                                  </td>
                                  <td className="py-2.5 text-center">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                      isExpired
                                        ? 'bg-rose-600 text-white'
                                        : isQuarantined
                                        ? 'bg-purple-600 text-white'
                                        : daysLeft <= 90
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                      {isExpired ? 'EXPIRED' : isQuarantined ? 'QUARANTINE' : daysLeft <= 90 ? 'NEAR EXPIRY' : 'ACTIVE'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      {onDeductBatch && batch.currentStock > 0 && (
                                        <button
                                          onClick={() => onDeductBatch(medicine, batch)}
                                          className="p-1 hover:bg-rose-100 rounded text-rose-600 cursor-pointer font-bold text-xs"
                                          title="Deduct or Write-off"
                                        >
                                          Deduct
                                        </button>
                                      )}
                                      <button
                                        onClick={() => onRelocateBatch(medicine, batch)}
                                        className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                                        title="Change Shelf/Bin Location"
                                      >
                                        <MapPin className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => onTransferBatch(medicine, batch)}
                                        className="p-1 hover:bg-slate-200 rounded text-blue-600 cursor-pointer"
                                        title="Inter-Branch / Ward Transfer"
                                      >
                                        <ArrowRightLeft className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => onReserveBatch(medicine, batch)}
                                        className="p-1 hover:bg-slate-200 rounded text-amber-600 cursor-pointer"
                                        title="Reserve for Surgery / OT"
                                      >
                                        <Lock className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => onQuarantineBatch(medicine, batch)}
                                        className="p-1 hover:bg-slate-200 rounded text-purple-600 cursor-pointer"
                                        title="Quarantine this batch"
                                      >
                                        <ShieldAlert className="w-3.5 h-3.5" />
                                      </button>
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
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
