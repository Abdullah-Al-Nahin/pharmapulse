import React, { useState, useEffect } from 'react';
import {
  Printer,
  Smartphone,
  Mail,
  CheckCircle2,
  X,
  Snowflake,
  Clock,
  AlertTriangle,
  FileText,
  UserCheck,
  ShieldAlert,
  ArrowLeftRight,
  Check,
  Building2,
  Phone,
  Calendar
} from 'lucide-react';
import {
  PharmaCartItem,
  DoctorInfo,
  GenericSubstituteOption
} from '../../types/pharmapulse';
import { useAuth } from '../../context/AuthContext';
import { PharmacyService } from '../../services/pharmacyService';

// Pre-registered doctors database
export const REGISTERED_DOCTORS: DoctorInfo[] = [
  {
    id: 'doc-1',
    name: 'Prof. Dr. Mahbubur Rahman',
    degrees: 'MBBS, FCPS, MS (Ophthalmology)',
    bmdcReg: 'BMDC-A-42109',
    speciality: 'Senior Consultant & Eye Surgeon',
    hospital: 'Madina Eye Hospital & Medical Center',
  },
  {
    id: 'doc-2',
    name: 'Dr. Shamima Nasrin',
    degrees: 'MBBS, FCPS (Medicine), MD',
    bmdcReg: 'BMDC-A-58294',
    speciality: 'General Medicine & Diabetologist',
    hospital: 'Dhaka Medical College & Hospital',
  },
  {
    id: 'doc-3',
    name: 'Prof. Dr. M. A. Jalil',
    degrees: 'MBBS, MD (Cardiology), FCCP',
    bmdcReg: 'BMDC-A-31084',
    speciality: 'Clinical Cardiologist',
    hospital: 'National Heart Foundation & Research Institute',
  },
  {
    id: 'doc-4',
    name: 'Dr. Tariqul Islam',
    degrees: 'MBBS, DCH, FCPS (Pediatrics)',
    bmdcReg: 'BMDC-A-67182',
    speciality: 'Child Specialist / Pediatrician',
    hospital: 'BSMMU (PG Hospital)',
  },
];

// Database of generic equivalents for smart substitution
export const GENERIC_SUBSTITUTE_DATABASE: Record<string, GenericSubstituteOption[]> = {};

// 1. F10 Post-Sale Dispatch Confirmation Modal
interface F10DispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  totalAmount: number;
  customerPhone: string;
  onConfirmDispatch: (method: 'print' | 'sms' | 'email' | 'both') => void;
}

export const F10DispatchModal: React.FC<F10DispatchModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  totalAmount,
  customerPhone,
  onConfirmDispatch,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'print' | 'sms' | 'email' | 'both'>('print');
  const [phoneInput, setPhoneInput] = useState(customerPhone || '');
  const [emailInput, setEmailInput] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-[#161b26] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Sale & Dispense Confirmed
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">{orderNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Total Billed Display */}
        <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between">
          <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
            Total Billed & Paid
          </span>
          <span className="font-mono text-xl font-extrabold text-emerald-700 dark:text-emerald-400">
            ৳ {totalAmount.toFixed(2)}
          </span>
        </div>

        {/* Dispatch Selection Options */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Select Receipt Dispatch Channel
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSelectedMethod('print')}
              className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                selectedMethod === 'print'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900 dark:text-emerald-200'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <Printer className="w-4 h-4 text-emerald-600" />
                <span>Thermal Print Only</span>
              </div>
              <span className="text-[10px] text-slate-400">80mm ESC/POS receipt</span>
            </button>

            <button
              onClick={() => setSelectedMethod('sms')}
              className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                selectedMethod === 'sms'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900 dark:text-emerald-200'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span>E-Receipt (SMS)</span>
              </div>
              <span className="text-[10px] text-slate-400">Instant SMS link</span>
            </button>

            <button
              onClick={() => setSelectedMethod('email')}
              className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                selectedMethod === 'email'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900 dark:text-emerald-200'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <Mail className="w-4 h-4 text-emerald-600" />
                <span>E-Receipt (Email)</span>
              </div>
              <span className="text-[10px] text-slate-400">Itemized PDF receipt</span>
            </button>

            <button
              onClick={() => setSelectedMethod('both')}
              className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                selectedMethod === 'both'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900 dark:text-emerald-200'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <Printer className="w-4 h-4 text-emerald-600" />
                <span>Print & E-Receipt</span>
              </div>
              <span className="text-[10px] text-slate-400">Paper + Digital copy</span>
            </button>
          </div>
        </div>

        {(selectedMethod === 'sms' || selectedMethod === 'both') && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500">Recipient Mobile Number</label>
            <input
              type="text"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500"
            />
          </div>
        )}

        {(selectedMethod === 'email' || selectedMethod === 'both') && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500">Recipient Email Address</label>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500"
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold transition"
          >
            Skip / Next Order (Esc)
          </button>
          <button
            onClick={() => onConfirmDispatch(selectedMethod)}
            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md shadow-emerald-700/20"
          >
            Confirm & Dispatch (Enter)
          </button>
        </div>
      </div>
    </div>
  );
};

// 2. Thermal Bill ESC/POS Simulation Modal (English & Bengali Support)
interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: PharmaCartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  orderNumber: string;
  isBengaliDefault?: boolean;
  tenderedAmount?: number;
  changeDue?: number;
  doctor?: DoctorInfo | null;
  autoPrint?: boolean;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  isOpen,
  onClose,
  cart,
  subtotal,
  discount,
  tax,
  grandTotal,
  orderNumber,
  isBengaliDefault = false,
  tenderedAmount = 1000,
  changeDue = 133,
  doctor = null,
  autoPrint = false
}) => {
  const [isBengali, setIsBengali] = useState(isBengaliDefault);

  useEffect(() => {
    if (isOpen && autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoPrint]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 flex flex-col gap-3 max-h-[90vh]">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold text-xs">
            <Printer className="w-4 h-4 text-emerald-600" />
            <span>Thermal Bill (80mm ESC/POS)</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Bengali/English Mode Switcher */}
            <button
              onClick={() => setIsBengali(!isBengali)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold border transition ${
                isBengali
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300'
              }`}
            >
              {isBengali ? 'বাংলা রসিদ ✓' : 'English Receipt'}
            </button>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Realistic Thermal Paper Roll Simulation */}
        <div className="p-4 bg-slate-50 dark:bg-black rounded-xl border border-dashed border-slate-300 dark:border-slate-700 font-mono text-[11px] leading-tight text-slate-800 dark:text-slate-200 shadow-inner flex flex-col gap-2 overflow-y-auto">
          {/* Header */}
          <div className="text-center pb-2 border-b border-dashed border-slate-300 dark:border-slate-700">
            {isBengali ? (
              <>
                <p className="font-bold text-sm tracking-wide text-slate-900 dark:text-white font-sans">
                  মদিনা চক্ষু হাসপাতাল ও ফার্মাসিউটিক্যালস
                </p>
                <p className="text-[10px] text-slate-600 dark:text-slate-400">
                  ফার্মাপালস ওএস এন্টারপ্রাইজ • ব্রাঞ্চ #০৪৮
                </p>
                <p className="text-[9px] text-slate-500">ডিজিডিএ রেজি: ৬৮৪১-ডিএইচ-২০২৬</p>
                <p className="text-[10px] font-semibold mt-1">ইনভয়েস: {orderNumber}</p>
                <p className="text-[9px] text-slate-400">
                  তারিখ: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' })}
                </p>
                {doctor && (
                  <div className="mt-1 pt-1 border-t border-dotted border-slate-300 dark:border-slate-700 text-[10px] text-left">
                    <p className="font-bold text-slate-700 dark:text-slate-300 font-sans">
                      চিকিৎসক: {doctor.name} ({doctor.bmdcReg})
                    </p>
                    <p className="text-[9px] text-slate-500">{doctor.speciality}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                  PharmaPulse Enterprise
                </p>
                <p className="text-[10px] text-slate-500">
                  Madina Eye Hospital Ltd. & Central Dispensary
                </p>
                <p className="text-[10px] text-slate-500">Store #048 • DGDA Reg: 6841-DH-2026</p>
                <p className="text-[10px] font-semibold mt-1">Invoice: {orderNumber}</p>
                <p className="text-[9px] text-slate-400">
                  Date: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' })}
                </p>
                {doctor && (
                  <div className="mt-1 pt-1 border-t border-dotted border-slate-300 dark:border-slate-700 text-[10px] text-left">
                    <p className="font-bold text-slate-700 dark:text-slate-300">
                      Prescriber: {doctor.name} ({doctor.bmdcReg})
                    </p>
                    <p className="text-[9px] text-slate-500">{doctor.speciality}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Itemized Table */}
          <div className="flex flex-col gap-1.5 py-1 border-b border-dashed border-slate-300 dark:border-slate-700">
            <div className="flex justify-between font-bold text-[10px] uppercase text-slate-500">
              <span>{isBengali ? 'ওষুধের বিবরণ' : 'Item Description'}</span>
              <span>{isBengali ? 'পরিমাণ x দর' : 'Qty x Price'}</span>
              <span>{isBengali ? 'মোট' : 'Total'}</span>
            </div>
            {cart.map((item) => (
              <div key={item.id} className="flex flex-col text-[10px] py-1 border-b border-slate-200/50 dark:border-slate-800/60 last:border-b-0">
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-slate-900 dark:text-white truncate max-w-[160px]">
                    {item.name}
                  </span>
                  <div className="flex gap-2">
                    <span className="text-slate-500">
                      {item.qty} x ৳{item.price.toFixed(2)}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      ৳{(item.price * item.qty).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Batch & Expiry */}
                <div className="flex flex-wrap items-center gap-x-2 text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                  <span>ব্যাচ: {item.batch} (মেয়াদ: {item.exp})</span>
                </div>

                {/* 28-Day After Opening Alert */}
                {(item.afterOpeningDays || item.isOphthalmic) && (
                  <div className="flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-400 font-sans font-semibold mt-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    <span>
                      {isBengali
                        ? 'সতর্কতা: বোতল খোলার পর ২৮ দিনের মধ্যে ব্যবহার করুন।'
                        : 'Notice: Use within 28 days after opening.'}
                    </span>
                  </div>
                )}

                {/* Cold Chain Storage Alert */}
                {item.isColdChain && (
                  <div className="flex items-center gap-1 text-[9px] text-sky-600 dark:text-sky-400 font-sans font-semibold mt-0.5">
                    <Snowflake className="w-2.5 h-2.5" />
                    <span>
                      {isBengali
                        ? 'সংরক্ষণ: ২°-৮° সে. তাপমাত্রায় ফ্রিজে রাখুন ও আইস-প্যাকে বহন করুন।'
                        : 'Keep Refrigerated (2°C - 8°C). Pack with Ice-Pack.'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="flex flex-col gap-1 text-[11px] pt-1">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{isBengali ? 'সাবটোটাল:' : 'Subtotal:'}</span>
              <span className="font-mono">৳ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-orange-600">
              <span>{isBengali ? 'বিশেষ ছাড় (৫%):' : 'Discount (5%):'}</span>
              <span className="font-mono">-৳ {discount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{isBengali ? 'ভ্যাট / কর (৫%):' : 'VAT / Tax (5%):'}</span>
              <span className="font-mono">+৳ {tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-xs border-t border-dashed border-slate-300 dark:border-slate-700 pt-1 text-emerald-700 dark:text-emerald-400">
              <span>{isBengali ? 'নিট প্রদেয়:' : 'NET PAYABLE:'}</span>
              <span className="font-mono text-sm">৳ {grandTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-0.5 border-t border-dotted border-slate-200 dark:border-slate-800">
              <span>{isBengali ? 'গৃহীত নগদ:' : 'Cash Tendered:'}</span>
              <span className="font-mono">৳ {tenderedAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-300">
              <span>{isBengali ? 'ফেরতযোগ্য টাকা (Change):' : 'Change Due:'}</span>
              <span className="font-mono">৳ {changeDue.toFixed(2)}</span>
            </div>
          </div>

          <div className="text-center pt-2 border-t border-dashed border-slate-300 dark:border-slate-700 text-[9px] text-slate-400">
            {isBengali ? (
              <>
                <p className="font-bold text-slate-600 dark:text-slate-300 font-sans">
                  *** আপনার দ্রুত আরোগ্য কাম্য ***
                </p>
                <p>ডিজিডিএ ও FEFO নীতি অনুযায়ী আসল ওষুধ নিশ্চিতকৃত।</p>
                <p>মেয়াদোত্তীর্ণ ঔষধ ফেরত বা পরিবর্তনযোগ্য নয়।</p>
              </>
            ) : (
              <>
                <p className="font-bold text-slate-600 dark:text-slate-300">
                  *** THANK YOU FOR YOUR VISIT ***
                </p>
                <p>FEFO Verified • Genuine Medicines Guaranteed</p>
                <p>Strict Cold-Chain and Quality Ensured</p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
          >
            Close
          </button>
          <button
            onClick={() => {
              window.print();
            }}
            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-700/20"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print {isBengali ? 'বাংলা রসিদ' : 'Slip'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// 3. Generic Substitution Modal (Same Generic Molecule & Strength)
interface GenericSubstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentItem: PharmaCartItem | null;
  onSelectSubstitute: (sub: GenericSubstituteOption) => void;
}

export const GenericSubstitutionModal: React.FC<GenericSubstitutionModalProps> = ({
  isOpen,
  onClose,
  currentItem,
  onSelectSubstitute,
}) => {
  if (!isOpen || !currentItem) return null;

  // Derive generic key
  let moleculeKey = 'esomeprazole-20';
  const nameLower = currentItem.name.toLowerCase();
  const subLower = currentItem.sub.toLowerCase();

  if (nameLower.includes('napa 500') || (nameLower.includes('napa') && !nameLower.includes('extra') && !subLower.includes('caffeine'))) {
    moleculeKey = 'paracetamol-500';
  } else if (nameLower.includes('sergel') || subLower.includes('esomeprazole')) {
    moleculeKey = 'esomeprazole-20';
  } else if (nameLower.includes('napa') || subLower.includes('paracetamol')) {
    moleculeKey = 'paracetamol-caffeine';
  } else if (nameLower.includes('cipro') || subLower.includes('ciprofloxacin')) {
    moleculeKey = 'ciprofloxacin-500';
  } else if (nameLower.includes('azith') || subLower.includes('azithromycin')) {
    moleculeKey = 'azithromycin-500';
  } else if (nameLower.includes('monas') || subLower.includes('montelukast')) {
    moleculeKey = 'montelukast-10';
  } else if (nameLower.includes('lata') || subLower.includes('latanoprost')) {
    moleculeKey = 'latanoprost-ophthalmic';
  } else if (nameLower.includes('moxi') || subLower.includes('moxifloxacin')) {
    moleculeKey = 'moxifloxacin-ophthalmic';
  } else if (nameLower.includes('insulin') || nameLower.includes('lantus')) {
    moleculeKey = 'insulin-glargine';
  }

  let substitutes: GenericSubstituteOption[] = GENERIC_SUBSTITUTE_DATABASE[moleculeKey] || [];

  // Query live inventory medicines matching generic name
  if (substitutes.length === 0) {
    const liveMeds = PharmacyService.getMedicines();
    const querySub = (currentItem.sub || '').toLowerCase();
    const queryName = (currentItem.name || '').toLowerCase();

    const matches = liveMeds.filter((m) => {
      if (m.name.toLowerCase() === queryName) return false;
      const genLower = (m.genericName || '').toLowerCase();
      return genLower && (querySub.includes(genLower) || genLower.includes(querySub));
    });

    substitutes = matches.map((m) => {
      const fefoInfo = PharmacyService.getFefoBatchForMedicine(m.id);
      return {
        id: m.id,
        brandName: m.name,
        genericName: m.genericName || currentItem.sub,
        strength: m.strength || '',
        company: m.manufacturer || 'Approved Manufacturer',
        price: fefoInfo.batch ? Number(fefoInfo.batch.sellingPrice) : 0,
        purchasePrice: fefoInfo.batch ? Number(fefoInfo.batch.purchasePrice) : 0,
        stock: fefoInfo.totalStock || 0,
        batch: fefoInfo.batch?.batchNumber || 'OOS',
        exp: fefoInfo.batch?.expiryDate || 'N/A',
        form: m.dosageForm || 'Tablet',
        isRxRequired: m.requiresPrescription,
      };
    });
  }

  const { currentUser } = useAuth();
  const [pendingSub, setPendingSub] = useState<GenericSubstituteOption | null>(null);
  const [pharmacistPin, setPharmacistPin] = useState('');
  const [pharmacistName, setPharmacistName] = useState(
    currentUser?.name ? `${currentUser.name} (${currentUser.roleName || 'Duty Pharmacist'})` : 'Duty Pharmacist'
  );
  const [subReason, setSubReason] = useState('Prescribed brand out-of-stock — Equivalent therapeutic bioequivalence');
  const [isConsentChecked, setIsConsentChecked] = useState(false);
  const [pinError, setPinError] = useState('');

  const isOutOfStockOriginal = currentItem.stock === 0 || currentItem.name.toLowerCase().includes('napa 500');

  const handleInitiateSwap = (sub: GenericSubstituteOption) => {
    setPendingSub(sub);
    setPinError('');
  };

  const handleFinalPharmacistApproval = () => {
    if (!pharmacistPin.trim()) {
      setPinError('ফার্মাসিস্টের সিকিউরিটি পিন (PIN) প্রদান করা বাধ্যতামূলক');
      return;
    }
    if (!isConsentChecked) {
      setPinError('সম্মতি ও বায়োইকুইভ্যালেন্স নিশ্চিতকরণ চেকবক্সে টিক দিন');
      return;
    }
    if (pendingSub) {
      onSelectSubstitute(pendingSub);
      setPendingSub(null);
      setPharmacistPin('');
      setIsConsentChecked(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-xl bg-white dark:bg-[#161b26] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 flex flex-col gap-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Smart Substitute (বিকল্প ওষুধ প্রতিস্থাপন)
                </h3>
                <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 text-[9px] font-mono font-bold">
                  PHARMACIST MANDATORY
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Active Molecule: <strong className="text-emerald-600">{currentItem.sub}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Cart / Requested Item Summary */}
        <div className={`p-3 rounded-xl border flex items-center justify-between ${
          isOutOfStockOriginal
            ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50'
            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Requested Item
              </span>
              {isOutOfStockOriginal && (
                <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[9px] font-bold">
                  Out of Stock (মজুদ নেই)
                </span>
              )}
            </div>
            <span className="font-bold text-xs text-slate-900 dark:text-white">
              {currentItem.name}
            </span>
            <span className="text-[11px] text-slate-500 block">
              {currentItem.company} • Qty: {currentItem.qty}
            </span>
          </div>
          <div className="text-right">
            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 block">
              ৳ {currentItem.price.toFixed(2)} / unit
            </span>
            <span className="text-[10px] text-slate-400">
              {isOutOfStockOriginal ? 'বিকল্প ব্র্যান্ড প্রয়োজন' : 'Active in cart'}
            </span>
          </div>
        </div>

        {/* Conditional View: Available Alternatives OR Mandatory Pharmacist Gate */}
        {!pendingSub ? (
          <div className="flex flex-col gap-2 overflow-y-auto pr-1 flex-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Available Alternatives in Stock ({substitutes.length})
              </label>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                * Pharmacist confirmation mandatory for all swaps
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {substitutes.map((sub) => {
                const isCurrent = currentItem.name.toLowerCase().includes(sub.brandName.toLowerCase().split(' ')[0]);
                const priceDiff = sub.price - currentItem.price;

                return (
                  <div
                    key={sub.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      isCurrent
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-400/80 ring-1 ring-emerald-500/20'
                        : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {sub.brandName}
                        </span>
                        {sub.isColdChain && (
                          <span className="px-1.5 py-0.2 rounded bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 border border-sky-200 text-[9px] font-bold flex items-center gap-0.5">
                            <Snowflake className="w-2.5 h-2.5" /> 2°-8°C
                          </span>
                        )}
                        {sub.afterOpeningDays && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 text-[9px] font-bold flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> 28 Days
                          </span>
                        )}
                        {isCurrent && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 text-[9px] font-bold">
                            CURRENT
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {sub.company} • {sub.strength} ({sub.form})
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        Available Stock:{' '}
                        <strong className="text-slate-700 dark:text-slate-300 font-mono">
                          {sub.stock} units
                        </strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right flex flex-col">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          ৳ {sub.price.toFixed(2)}
                        </span>
                        {priceDiff < 0 ? (
                          <span className="text-[10px] text-emerald-600 font-bold">
                            Saves ৳{Math.abs(priceDiff).toFixed(2)}
                          </span>
                        ) : priceDiff > 0 ? (
                          <span className="text-[10px] text-orange-600 font-bold">
                            +৳{priceDiff.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Same Price</span>
                        )}
                      </div>

                      {!isCurrent && (
                        <button
                          onClick={() => handleInitiateSwap(sub)}
                          className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1"
                        >
                          <span>Select & Verify</span>
                          <ArrowLeftRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* MANDATORY PHARMACIST CONFIRMATION SCREEN */
          <div className="flex flex-col gap-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-amber-200 dark:border-amber-900/40">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h4 className="font-bold text-xs text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                  Pharmacist Confirmation Required (বাধ্যতামূলক নিশ্চিতকরণ)
                </h4>
              </div>
              <button
                onClick={() => setPendingSub(null)}
                className="text-xs text-slate-500 hover:text-slate-800 underline"
              >
                Change Selection
              </button>
            </div>

            {/* Substitution Comparison Pair */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  Original / Unavailable
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-100 block">
                  {currentItem.name}
                </span>
                <span className="text-[11px] text-slate-500">{currentItem.company}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800">
                <span className="text-[10px] font-bold text-emerald-600 uppercase block">
                  Approved Substitute
                </span>
                <span className="font-bold text-slate-900 dark:text-white block">
                  {pendingSub.brandName}
                </span>
                <span className="text-[11px] text-slate-500">
                  {pendingSub.company} • ৳{pendingSub.price.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Pharmacist Credentials & Reason */}
            <div className="flex flex-col gap-2.5">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                  On-Duty Registered Pharmacist
                </label>
                <input
                  type="text"
                  value={pharmacistName}
                  onChange={(e) => setPharmacistName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                  Clinical Substitution Reason (প্রতিস্থাপনের যৌক্তিক কারণ)
                </label>
                <select
                  value={subReason}
                  onChange={(e) => setSubReason(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white outline-none"
                >
                  <option value="Prescribed brand out-of-stock — Equivalent therapeutic bioequivalence">
                    মূল ওষুধ স্টকে নেই (Out of Stock) — সমমানের থেরাপিউটিক বায়োইকুইভ্যালেন্স
                  </option>
                  <option value="Patient requested cost-effective bioequivalent generic">
                    রোগী অধিক সাশ্রয়ী বিকল্প ওষুধ গ্রহণের অনুরোধ করেছেন
                  </option>
                  <option value="Physician tele-consulted & authorized brand replacement">
                    প্রেসক্রিপশনকারী চিকিৎসকের সাথে ফোনে কথা বলে বিকল্প অনুমোদন নেওয়া হয়েছে
                  </option>
                </select>
              </div>

              {/* Security PIN Field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Pharmacist Security PIN (পাসওয়ার্ড/পিন) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setPharmacistPin('1234')}
                    className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                  >
                    Quick PIN (1234)
                  </button>
                </div>
                <input
                  type="password"
                  placeholder="Enter 4-digit PIN (e.g. 1234)..."
                  value={pharmacistPin}
                  onChange={(e) => {
                    setPharmacistPin(e.target.value);
                    setPinError('');
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Mandatory Consent Checkbox */}
              <label className="flex items-start gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isConsentChecked}
                  onChange={(e) => setIsConsentChecked(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-[11px] text-slate-700 dark:text-slate-300 leading-tight">
                  আমি নিশ্চিত করছি যে প্রস্তাবিত বিকল্পটি একই সক্রিয় উপাদান (Active Molecule) ও স্ট্রেন্থ বহন করে এবং ডিজিডিএ ও ফার্মেসি কাউন্সিলের আইন অনুযায়ী রোগীর সাথে আলোচনা করে প্রতিস্থাপন করা হচ্ছে।
                </span>
              </label>

              {pinError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">
                  {pinError}
                </p>
              )}
            </div>

            {/* Confirmation Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-amber-200 dark:border-amber-900/40">
              <button
                onClick={() => setPendingSub(null)}
                className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
              >
                Back to List
              </button>
              <button
                onClick={handleFinalPharmacistApproval}
                disabled={!pharmacistPin || !isConsentChecked}
                className={`flex-1 py-2 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
                  pharmacistPin && isConsentChecked
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-700/20'
                    : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>Authorize & Swap Into Cart (ফার্মাসিস্ট নিশ্চিতকরণ)</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>DGDA & Pharmacy Council of Bangladesh Compliant</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// 4. DGDA Prescription & Antibiotic Guardrail Warning Modal
interface RxWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  restrictedItems: PharmaCartItem[];
  doctors: DoctorInfo[];
  selectedDoctor: DoctorInfo | null;
  onSelectDoctor: (doc: DoctorInfo) => void;
  onProceedWithOverride: (reason: string) => void;
  onProceedWithDoctor: () => void;
}

export const RxWarningModal: React.FC<RxWarningModalProps> = ({
  isOpen,
  onClose,
  restrictedItems,
  doctors,
  selectedDoctor,
  onSelectDoctor,
  onProceedWithOverride,
  onProceedWithDoctor,
}) => {
  const [overrideReason, setOverrideReason] = useState('Emergency Relief');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-[#161b26] rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-2xl p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-rose-100 dark:border-rose-950">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span>Prescription Guardrail Warning</span>
                <span className="px-1.5 py-0.2 rounded bg-rose-500 text-white text-[9px] font-mono">
                  DGDA MANDATE
                </span>
              </h3>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                কার্টে অ্যান্টিবায়োটিক বা নিয়ন্ত্রিত ড্রাগ অন্তর্ভুক্ত রয়েছে
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Restricted items in cart */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Restricted Scheduled Drugs Detected in Cart:
          </label>
          <div className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 flex flex-col gap-1.5">
            {restrictedItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.2 rounded bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 font-bold text-[9px]">
                    Rx Required
                  </span>
                  <span className="font-bold text-slate-800 dark:text-white">{item.name}</span>
                  <span className="text-[11px] text-slate-500">({item.sub})</span>
                </div>
                <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                  Qty: {item.qty}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Doctor Selection Section */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Select Prescribing Doctor / নিবন্ধিত চিকিৎসক নির্বাচন করুন:
          </label>
          <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
            {doctors.map((doc) => {
              const isSelected = selectedDoctor?.id === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => onSelectDoctor(doc)}
                  className={`p-2 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/20'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <UserCheck className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 dark:text-white">
                        {doc.name}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {doc.speciality} • BMDC: {doc.bmdcReg}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            disabled={!selectedDoctor}
            onClick={onProceedWithDoctor}
            className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
              selectedDoctor
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-700/20'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Attach Doctor & Proceed (Enter)</span>
          </button>

          {/* Pharmacist Over-The-Counter Override */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <select
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="Emergency Relief">Override: Emergency Relief (জরুরি প্রাথমিক সেবা)</option>
              <option value="Chronic Rx Refill">Override: Chronic Patient Verified Refill</option>
              <option value="Hospital Inpatient">Override: Hospital Internal Ward Order</option>
              <option value="Phone Consulted">Override: Verified by Tele-Consultation</option>
            </select>
            <button
              onClick={() => onProceedWithOverride(overrideReason)}
              className="py-1.5 px-3 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition whitespace-nowrap"
            >
              Pharmacist Override
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
