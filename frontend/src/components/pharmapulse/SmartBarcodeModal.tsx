import React, { useState, useEffect, useRef } from 'react';
import {
  Scan,
  Barcode,
  CheckCircle2,
  AlertTriangle,
  X,
  Package,
  Boxes,
  Calendar,
  DollarSign,
  Plus,
  Snowflake,
  Clock,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { SmartBarcodeItem, PharmaCartItem } from '../../types/pharmapulse';
import { SMART_BARCODE_DATABASE } from './data/smartPharmaData';
import { PharmacyService } from '../../services/pharmacyService';
import { useAuth } from '../../context/AuthContext';

interface SmartBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: PharmaCartItem) => void;
  onOpenSubstituteForUnavailable?: (drugName: string) => void;
  onOpenPriceHistory?: (drugName: string) => void;
}

// Audio beep synthesizer using Web Audio API for authentic hardware barcode sound
const playScannerBeep = (type: 'success' | 'alert' = 'success') => {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime); // High pitch crisp beep
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else {
      // Alert double beep
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // AudioContext blocked or not supported
  }
};

export const SmartBarcodeModal: React.FC<SmartBarcodeModalProps> = ({
  isOpen,
  onClose,
  onAddToCart,
  onOpenSubstituteForUnavailable,
  onOpenPriceHistory,
}) => {
  const { currentUser } = useAuth();
  const liveMedicines = PharmacyService.getMedicines();
  const medicinesWithBarcodes = liveMedicines.filter((m) => m.barcode);

  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedItem, setScannedItem] = useState<SmartBarcodeItem | null>(() => {
    const firstMed = medicinesWithBarcodes[0] || liveMedicines[0];
    if (!firstMed) return null;
    const fefoInfo = PharmacyService.getFefoBatchForMedicine(firstMed.id);
    return {
      barcode: firstMed.barcode || 'N/A',
      brandName: firstMed.name,
      genericName: firstMed.genericName || '',
      strength: firstMed.strength || '',
      batch: fefoInfo.batch?.batchNumber || 'LOT-2026',
      exp: fefoInfo.batch?.expiryDate || 'N/A',
      stock: fefoInfo.batch ? fefoInfo.batch.currentStock : 0,
      sellingPrice: fefoInfo.batch ? Number(fefoInfo.batch.sellingPrice) : 0,
      purchasePrice: fefoInfo.batch ? Number(fefoInfo.batch.purchasePrice) : 0,
      company: firstMed.manufacturer || '',
      isRxRequired: firstMed.requiresPrescription,
      dosageEn: firstMed.description,
      dosageBn: firstMed.description,
      isColdChain: (firstMed.rackLocation || '').toLowerCase().includes('fridge'),
      storageTemp: firstMed.rackLocation,
    };
  });
  const [addQty, setAddQty] = useState(1);
  const [scanStatus, setScanStatus] = useState<'idle' | 'found' | 'not_found'>('found');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleScanOrSubmit = (codeToSearch?: string) => {
    const code = (codeToSearch || barcodeInput).trim();
    if (!code) return;
    
    const searchLower = code.toLowerCase();

    // 1. Search in real database
    const realMedicines = PharmacyService.getMedicines();
    let matchedMedicine = realMedicines.find(
      (m) => (m.barcode && m.barcode.toLowerCase() === searchLower) || 
             (m.name && m.name.toLowerCase().includes(searchLower)) ||
             (m.genericName && m.genericName.toLowerCase().includes(searchLower)) ||
             (m.brandName && m.brandName.toLowerCase().includes(searchLower))
    );
    
    let matched: SmartBarcodeItem | undefined;

    if (matchedMedicine) {
      const fefoInfo = PharmacyService.getFefoBatchForMedicine(matchedMedicine.id, currentUser?.branchId);
      matched = {
        barcode: matchedMedicine.barcode || 'N/A',
        brandName: matchedMedicine.name,
        genericName: matchedMedicine.genericName || '',
        strength: matchedMedicine.strength || '',
        batch: fefoInfo.batch?.batchNumber || 'OOS',
        exp: fefoInfo.batch?.expiryDate || 'N/A',
        stock: fefoInfo.batch ? fefoInfo.batch.currentStock : 0,
        sellingPrice: fefoInfo.batch ? Number(fefoInfo.batch.sellingPrice) : 0,
        purchasePrice: fefoInfo.batch ? Number(fefoInfo.batch.purchasePrice) : 0,
        company: matchedMedicine.manufacturer || '',
        isRxRequired: matchedMedicine.requiresPrescription,
        dosageEn: matchedMedicine.description,
        dosageBn: matchedMedicine.description,
        isColdChain: (matchedMedicine.rackLocation || '').toLowerCase().includes('fridge'),
        storageTemp: matchedMedicine.rackLocation,
      };
    }

    if (matched) {
      setScannedItem(matched);
      setScanStatus('found');
      if (matched.stock <= 0) {
        playScannerBeep('alert');
      } else {
        playScannerBeep('success');
      }
    } else {
      setScanStatus('not_found');
      playScannerBeep('alert');
    }
  };

  const handleQuickScan = (item: SmartBarcodeItem) => {
    setBarcodeInput(item.barcode);
    setScannedItem(item);
    setScanStatus('found');
    if (item.stock <= 0) {
      playScannerBeep('alert');
    } else {
      playScannerBeep('success');
    }
  };

  const handleConfirmAddToCart = () => {
    if (!scannedItem || scannedItem.stock <= 0) return;

    const cartItem: PharmaCartItem = {
      id: Date.now(),
      name: `${scannedItem.brandName} ${scannedItem.strength}`,
      sub: `${scannedItem.genericName} • ${scannedItem.strength}`,
      company: scannedItem.company,
      batch: scannedItem.batch,
      exp: scannedItem.exp,
      price: scannedItem.sellingPrice,
      purchasePrice: scannedItem.purchasePrice,
      qty: addQty,
      disc: 0,
      isColdChain: scannedItem.isColdChain,
      storageTemp: scannedItem.storageTemp,
      isOphthalmic: scannedItem.isOphthalmic,
      afterOpeningDays: scannedItem.afterOpeningDays,
      isRxRequired: scannedItem.isRxRequired,
      dosageBn: scannedItem.dosageBn,
      dosageEn: scannedItem.dosageEn,
      barcode: scannedItem.barcode,
      strength: scannedItem.strength,
      stock: scannedItem.stock,
    };

    onAddToCart(cartItem);
    onClose();
  };

  const unitProfit = scannedItem ? scannedItem.sellingPrice - scannedItem.purchasePrice : 0;
  const marginPercent = scannedItem && scannedItem.sellingPrice > 0 ? (unitProfit / scannedItem.sellingPrice) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-[#151922] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
              <Scan className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Smart Barcode Scanner (স্মার্ট বারকোড শনাক্তকারী)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[9px] font-mono font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  SCANNER ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                বারকোড স্ক্যান করলেই Brand, Generic, Strength, Batch, Expiry, Stock ও Selling Price স্বয়ংক্রিয়ভাবে চিহ্নিত হবে
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Scanner Input Bar */}
        <div className="p-4 bg-slate-100/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Barcode className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => {
                  setBarcodeInput(e.target.value);
                  handleScanOrSubmit(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleScanOrSubmit();
                }}
                placeholder="বারকোড স্ক্যান করুন অথবা লিখুন (যেমন: 8941100223019)..."
                className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
              />
              <button
                onClick={() => handleScanOrSubmit()}
                className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs"
              >
                <span>Identify</span>
              </button>
            </div>
          </div>

          {/* Quick Real Barcode Scan Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] scrollbar-none">
            <span className="text-slate-400 shrink-0 font-medium">ইনভেন্টরি বারকোড:</span>
            {medicinesWithBarcodes.slice(0, 6).map((med) => (
              <button
                key={med.id}
                onClick={() => handleScanOrSubmit(med.barcode)}
                className={`px-2 py-0.5 rounded-lg border font-mono whitespace-nowrap transition ${
                  scannedItem?.barcode === med.barcode
                    ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                }`}
              >
                {med.name} ({med.barcode})
              </button>
            ))}
          </div>
        </div>

        {/* Identified Drug Presentation Area */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {scanStatus === 'not_found' ? (
            <div className="p-8 rounded-2xl border border-dashed border-rose-300 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 flex flex-col items-center justify-center text-center">
              <AlertTriangle className="w-10 h-10 text-rose-500 mb-2" />
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                বারকোড পাওয়া যায়নি (Barcode Not Recognized)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                সিস্টেমে এই বারকোডটি নিবন্ধিত নেই। অনুগ্রহ করে ডিজিডিএ রেজিস্ট্রি থেকে ম্যানুয়াল এন্ট্রি করুন।
              </p>
            </div>
          ) : scannedItem ? (
            <div className="flex flex-col gap-4">
              {/* Out of Stock Warning Banner */}
              {scannedItem.stock <= 0 && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-200 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-rose-900 dark:text-rose-200 block">
                        {scannedItem.brandName} — Out of Stock (মজুদ নেই)
                      </span>
                      <span className="text-[11px] text-rose-600 dark:text-rose-300">
                        সিস্টেম বিকল্প ওষুধ খুঁজে দিতে প্রস্তুত (ফার্মাসিস্ট নিশ্চিতকরণ প্রযোজ্য)
                      </span>
                    </div>
                  </div>
                  {onOpenSubstituteForUnavailable && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenSubstituteForUnavailable(scannedItem.brandName);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs shrink-0"
                    >
                      <span>বিকল্প বিকল্পসমূহ</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* 7 Core Smart Identified Elements Grid */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col gap-3.5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                      Barcode: {scannedItem.barcode}
                    </span>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{scannedItem.brandName}</span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono">
                        {scannedItem.strength}
                      </span>
                    </h2>
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      Generic Molecule: {scannedItem.genericName}
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Manufacturer: {scannedItem.company}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {scannedItem.isColdChain && (
                      <span className="px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 text-[10px] font-bold flex items-center gap-1">
                        <Snowflake className="w-3 h-3" /> 2°C - 8°C Cold Chain
                      </span>
                    )}
                    {scannedItem.afterOpeningDays && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 text-[10px] font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" /> খোলার পর ২৮ দিন মেয়াদ
                      </span>
                    )}
                    {scannedItem.isRxRequired && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 text-[10px] font-bold flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> Rx Required
                      </span>
                    )}
                  </div>
                </div>

                {/* 7 Required Metrics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                  {/* ① Brand + Generic */}
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      ① Brand & Generic
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white truncate block">
                      {scannedItem.brandName}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate block">
                      {scannedItem.genericName}
                    </span>
                  </div>

                  {/* ② Strength & Form */}
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      ② Strength / শক্তি
                    </span>
                    <span className="font-black text-slate-900 dark:text-white font-mono text-sm block">
                      {scannedItem.strength}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold">
                      Standard Unit Dose
                    </span>
                  </div>

                  {/* ③ Batch No */}
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      ③ Batch No / লট
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono block">
                      {scannedItem.batch}
                    </span>
                    <span className="text-[10px] text-slate-400">DGDA Verified</span>
                  </div>

                  {/* ④ Expiry Date */}
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      ④ Expiry Date / মেয়াদ
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono block">
                      {scannedItem.exp}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold">
                      FEFO Approved
                    </span>
                  </div>

                  {/* ⑤ Stock Available */}
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      ⑤ Current Stock / মজুদ
                    </span>
                    <span
                      className={`font-black font-mono text-sm block ${
                        scannedItem.stock <= 0
                          ? 'text-rose-600'
                          : scannedItem.stock < 100
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {scannedItem.stock} units
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {scannedItem.stock <= 0 ? 'Out of Stock' : 'In Dispensary'}
                    </span>
                  </div>

                  {/* ⑥ Selling Price */}
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      ⑥ Selling Price (MRP)
                    </span>
                    <span className="font-black font-mono text-slate-900 dark:text-white text-sm block">
                      ৳ {scannedItem.sellingPrice.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Govt MRP Regulated
                    </span>
                  </div>

                  {/* ⑦ Purchase Cost & Margin (Feature ④) */}
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        ⑦ Profit by Medicine
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.2 rounded">
                        Margin: {marginPercent.toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between font-mono text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Purchase Cost</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          ৳ {scannedItem.purchasePrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Profit / Unit</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          +৳ {unitProfit.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Directions in Bengali & English */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    নির্দেশনা (Dosage & Instructions)
                  </span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {scannedItem.dosageBn || scannedItem.dosageEn}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Action Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {scannedItem && onOpenPriceHistory && (
              <button
                onClick={() => {
                  onClose();
                  onOpenPriceHistory(scannedItem.brandName);
                }}
                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition"
              >
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Price History (Jan-Apr)</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {scannedItem && scannedItem.stock > 0 && (
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
                <span className="text-xs text-slate-400 font-bold px-1.5">Qty:</span>
                <input
                  type="number"
                  min="1"
                  max={scannedItem.stock}
                  value={addQty}
                  onChange={(e) => setAddQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 text-center font-mono font-bold text-xs bg-transparent outline-none text-slate-900 dark:text-white"
                />
              </div>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200"
            >
              Cancel
            </button>

            {scannedItem && scannedItem.stock > 0 ? (
              <button
                onClick={handleConfirmAddToCart}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-700/20 flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add to Bill / কার্টে যোগ করুন (Enter)</span>
              </button>
            ) : scannedItem && scannedItem.stock <= 0 ? (
              <button
                onClick={() => {
                  onClose();
                  if (onOpenSubstituteForUnavailable) {
                    onOpenSubstituteForUnavailable(scannedItem.brandName);
                  }
                }}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-700/20 flex items-center gap-1.5 transition"
              >
                <span>Find Substitute (বিকল্প খুঁজুন)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
