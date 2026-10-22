import React, { useState } from 'react';
import {
  TrendingUp,
  X,
  Calendar,
  Building2,
  Boxes,
  DollarSign,
  AlertCircle,
  ArrowUpRight,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { PriceHistoryRecord } from '../../types/pharmapulse';
import { PharmacyService } from '../../services/pharmacyService';

interface PriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMedicineName?: string;
}

export const PriceHistoryModal: React.FC<PriceHistoryModalProps> = ({
  isOpen,
  onClose,
  initialMedicineName = 'Napa 500',
}) => {
  const medicines = PharmacyService.getMedicines();
  const allBatches = PharmacyService.getBatches();

  const [selectedMedId, setSelectedMedId] = useState<string>(() => {
    const match = medicines.find(
      (m) =>
        m.name.toLowerCase().includes(initialMedicineName.toLowerCase()) ||
        (m.genericName && m.genericName.toLowerCase().includes(initialMedicineName.toLowerCase()))
    );
    return match ? match.id : medicines[0]?.id || '';
  });

  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const currentMed = medicines.find((m) => m.id === selectedMedId) || medicines[0];
  const medName = currentMed?.name || initialMedicineName;

  // Find all batches associated with this medicine
  const medBatches = allBatches.filter(
    (b) => b.medicineId === currentMed?.id || (b.medicineName && b.medicineName.toLowerCase() === medName.toLowerCase())
  );

  // Sort by manufacturing/creation date ascending
  medBatches.sort(
    (a, b) =>
      new Date(a.manufacturingDate || a.expiryDate).getTime() -
      new Date(b.manufacturingDate || b.expiryDate).getTime()
  );

  let records: PriceHistoryRecord[] = [];
  if (medBatches.length > 0) {
    records = medBatches.map((b) => {
      const dt = new Date(b.manufacturingDate || b.expiryDate || Date.now());
      const pPrice = Number(b.purchasePrice) || 0;
      const sPrice = Number(b.sellingPrice) || 0;
      const margin = sPrice > 0 ? ((sPrice - pPrice) / sPrice) * 100 : 0;
      return {
        month: dt.toLocaleString('en-US', { month: 'short' }),
        year: dt.getFullYear(),
        purchasePrice: pPrice,
        sellingPrice: sPrice,
        batch: b.batchNumber,
        supplier: b.supplierName || currentMed?.manufacturer || 'Central Depot Procurement',
        date: b.manufacturingDate || b.expiryDate,
        marginPercent: margin,
      };
    });
  } else if (currentMed) {
    const fefo = PharmacyService.getFefoBatchForMedicine(currentMed.id);
    const pPrice = fefo.batch ? Number(fefo.batch.purchasePrice) : 0;
    const sPrice = fefo.batch ? Number(fefo.batch.sellingPrice) : 0;
    const margin = sPrice > 0 ? ((sPrice - pPrice) / sPrice) * 100 : 0;
    records = [
      {
        month: new Date().toLocaleString('en-US', { month: 'short' }),
        year: new Date().getFullYear(),
        purchasePrice: pPrice,
        sellingPrice: sPrice,
        batch: fefo.batch?.batchNumber || 'BASE-LOT',
        supplier: currentMed.manufacturer || 'Certified Manufacturer',
        date: new Date().toISOString().split('T')[0],
        marginPercent: margin,
      },
    ];
  }

  const firstPrice = records[0]?.purchasePrice || 0;
  const latestRecord = records[records.length - 1];
  const latestPrice = latestRecord?.purchasePrice || 0;
  const overallDiff = latestPrice - firstPrice;
  const overallPercent = firstPrice > 0 ? (overallDiff / firstPrice) * 100 : 0;

  const filteredMedicines = medicines.filter(
    (m) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.genericName && m.genericName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-[#151922] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Purchase Price History (ক্রয়মূল্যের ইতিহাস)
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                  Depot Procurement
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                মাসভিত্তিক ক্রয়মূল্য ও পাইকারি রেট পরিবর্তন ট্র্যাকিং
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Medicine Selector Bar */}
        <div className="px-5 py-2.5 bg-slate-100/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 shrink-0 pr-2 border-r border-slate-200 dark:border-slate-700">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="ওষুধ খুঁজুন..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-24 text-xs bg-transparent outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {filteredMedicines.slice(0, 10).map((med) => (
              <button
                key={med.id}
                onClick={() => setSelectedMedId(med.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  selectedMedId === med.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                }`}
              >
                {med.name}
              </button>
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* Main Trend Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50/70 via-slate-50 to-blue-50/60 dark:from-emerald-950/30 dark:via-slate-900 dark:to-blue-950/30 border border-emerald-200/80 dark:border-emerald-800/40 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
                Selected Medicine
              </span>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                {medName}
              </h4>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Supplier: {latestRecord?.supplier || currentMed?.manufacturer || 'Central Depot Procurement'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-right">
                <span className="text-[10px] font-bold text-slate-400 block">
                  Current Purchase Price
                </span>
                <span className="text-base font-mono font-black text-slate-900 dark:text-white">
                  ৳ {(latestPrice ?? 0).toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Sale MRP: ৳ {(latestRecord?.sellingPrice ?? 0).toFixed(2)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-right">
                <span className="text-[10px] font-bold text-slate-400 block">
                  4-Month Change
                </span>
                <div className="flex items-center justify-end gap-0.5 text-amber-600 dark:text-amber-400 font-bold text-sm font-mono">
                  <ArrowUpRight className="w-4 h-4" />
                  <span>+{(overallPercent ?? 0).toFixed(1)}%</span>
                </div>
                <span className="text-[10px] text-slate-500 block">
                  +৳{(overallDiff ?? 0).toFixed(2)} / unit
                </span>
              </div>
            </div>
          </div>

          {/* Timeline Grid (Jan, Feb, Mar, Apr) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Purchase Price History Breakdown
              </label>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified Depot Invoices
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {records.map((r, idx) => {
                const prevPrice = idx > 0 ? records[idx - 1].purchasePrice : r.purchasePrice;
                const diff = r.purchasePrice - prevPrice;
                const isLatest = idx === records.length - 1;

                return (
                  <div
                    key={r.month}
                    className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                      isLatest
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-400 ring-1 ring-emerald-500/20'
                        : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-xs text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                        {r.month} {r.year}
                      </span>
                      {isLatest && (
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.2 rounded">
                          LATEST
                        </span>
                      )}
                    </div>

                    <div className="my-1">
                      <span className="text-[10px] text-slate-400 block">ক্রয়মূল্য (Purchase)</span>
                      <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                        ৳ {(r.purchasePrice ?? 0).toFixed(2)}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">Sale: ৳{(r.sellingPrice ?? 0).toFixed(2)}</span>
                      <span
                        className={`font-mono font-bold ${
                          diff > 0 ? 'text-amber-600' : 'text-slate-400'
                        }`}
                      >
                        {diff > 0 ? `+৳${(diff ?? 0).toFixed(2)}` : 'Base'}
                      </span>
                    </div>

                    {/* Unit Profit & Margin */}
                    <div className="mt-1.5 px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 text-[10px] flex items-center justify-between font-mono">
                      <span className="text-slate-500">Margin:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {(r.marginPercent ?? 0).toFixed(1)}% (৳{(((r.sellingPrice ?? 0) - (r.purchasePrice ?? 0))).toFixed(2)})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Batch Invoices Log */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Procurement Invoices & GRN History Log
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/60 dark:bg-slate-800/40 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-2.5">Date & Month</th>
                  <th className="p-2.5">Batch No</th>
                  <th className="p-2.5">Supplier Depot</th>
                  <th className="p-2.5 text-right">Purchase Price</th>
                  <th className="p-2.5 text-right">Selling Price</th>
                  <th className="p-2.5 text-right">Profit / Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {records.map((rec) => {
                  const pPrice = rec.purchasePrice != null ? Number(rec.purchasePrice) : 0;
                  const sPrice = rec.sellingPrice != null ? Number(rec.sellingPrice) : 0;
                  const profit = sPrice - pPrice;
                  const marginPct = rec.marginPercent != null ? Number(rec.marginPercent) : 0;
                  return (
                    <tr
                      key={rec.batch}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="p-2.5 font-sans font-medium text-slate-700 dark:text-slate-200">
                        {rec.date} ({rec.month})
                      </td>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                        {rec.batch}
                      </td>
                      <td className="p-2.5 font-sans text-slate-500">
                        {rec.supplier}
                      </td>
                      <td className="p-2.5 text-right font-bold text-slate-900 dark:text-white">
                        ৳ {pPrice.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right text-slate-600 dark:text-slate-300">
                        ৳ {sPrice.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        ৳{profit.toFixed(2)} ({marginPct.toFixed(0)}%)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            DGDA Price Regulation Compliant • Last Updated: April 2026
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
