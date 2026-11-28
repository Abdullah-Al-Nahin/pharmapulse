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
import { BranchService } from '../../services/branchService';

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

function amountToEnglishWords(amount: number): string {
  const num = Math.max(0, Number(amount) || 0);
  const whole = Math.floor(num);
  const paisa = Math.round((num - whole) * 100);

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertBelowThousand = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`;
    return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${convertBelowThousand(n % 100)}` : ''}`;
  };

  const convertInt = (n: number): string => {
    if (n === 0) return 'Zero';
    const parts: string[] = [];
    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const rem = n % 1000;
    if (crore > 0) parts.push(`${convertInt(crore)} Crore`);
    if (lakh > 0) parts.push(`${convertBelowThousand(lakh)} Lakh`);
    if (thousand > 0) parts.push(`${convertBelowThousand(thousand)} Thousand`);
    if (rem > 0) parts.push(convertBelowThousand(rem));
    return parts.join(' ');
  };

  const wholeWords = `${convertInt(whole)} Taka`;
  if (paisa > 0) {
    return `${wholeWords} and ${convertBelowThousand(paisa)} Paisa Only`;
  }
  return `${wholeWords} Only`;
}

function buildBarcodeBars(code: string): Array<{ x: number; w: number }> {
  const safe = (code || 'INV-0000').toUpperCase();
  const bars: Array<{ x: number; w: number }> = [];
  let cursor = 4;
  // Quiet start guard
  bars.push({ x: cursor, w: 2 }); cursor += 4;
  bars.push({ x: cursor, w: 1 }); cursor += 3;

  for (let i = 0; i < safe.length; i++) {
    const ch = safe.charCodeAt(i);
    const pattern = [
      (ch % 3) + 1,
      ((ch >> 1) % 2) + 1,
      ((ch >> 2) % 3) + 1,
      ((ch >> 4) % 2) + 1,
    ];
    for (let j = 0; j < pattern.length; j++) {
      const width = pattern[j];
      if (j % 2 === 0) {
        bars.push({ x: cursor, w: width });
      }
      cursor += width + 1;
    }
  }
  // End guard
  bars.push({ x: cursor, w: 2 }); cursor += 4;
  bars.push({ x: cursor, w: 1 });
  return bars;
}

const InvoiceBarcodeSvg: React.FC<{ value: string }> = ({ value }) => {
  const bars = buildBarcodeBars(value);
  const lastBar = bars[bars.length - 1];
  const totalWidth = Math.max(160, (lastBar ? lastBar.x + lastBar.w + 4 : 160));
  return (
    <svg
      viewBox={`0 0 ${totalWidth} 32`}
      className="h-8 w-auto max-w-full mx-auto"
      role="img"
      aria-label={`Invoice Barcode ${value}`}
    >
      <rect x={0} y={0} width={totalWidth} height={32} fill="#ffffff" />
      {bars.map((b, idx) => (
        <rect key={idx} x={b.x} y={2} width={b.w} height={28} fill="#0f172a" />
      ))}
    </svg>
  );
};

const escapeHtml = (v: string | number | undefined | null): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// 2. Official English Pharmacy Sales Memo / Tax Invoice Modal (80mm Thermal & A4 Formats)
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
  invoiceDate?: string;
  roundOff?: number;
  vatPercent?: number;
  discountPercent?: number;
  paymentMethod?: string;
  paymentStatus?: 'paid' | 'partially_paid' | 'due' | 'draft';
  cashPaid?: number;
  mfsOrCardPaid?: number;
  mfsOrCardRef?: string;
  dueAmount?: number;
  customerName?: string;
  customerPhone?: string;
  customerCode?: string;
  customerLoyaltyPoints?: number;
  cashierName?: string;
  cashierRole?: string;
  branchId?: string;
  branchName?: string;
  branchCode?: string;
  branchAddress?: string;
  branchPhone?: string;
  dgdaLicense?: string;
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
  tenderedAmount = 0,
  changeDue = 0,
  doctor = null,
  autoPrint = false,
  invoiceDate,
  roundOff,
  vatPercent,
  discountPercent,
  paymentMethod = 'cash',
  paymentStatus = 'paid',
  cashPaid,
  mfsOrCardPaid = 0,
  mfsOrCardRef,
  dueAmount = 0,
  customerName = 'Walk-In Customer',
  customerPhone = '',
  customerCode,
  customerLoyaltyPoints,
  cashierName,
  cashierRole,
  branchId,
  branchName,
  branchCode,
  branchAddress,
  branchPhone,
  dgdaLicense,
}) => {
  const { currentUser } = useAuth();
  const [paperFormat, setPaperFormat] = useState<'80mm' | 'a4'>('80mm');

  const resolvedBranch =
    BranchService.getBranchById(branchId || currentUser?.branchId || 'HQ-MAIN') ||
    BranchService.getBranches()[0];

  const orgName = 'Madina Eye Hospital & Central Pharmacy';
  const displayBranchName = branchName || resolvedBranch?.name || 'Central Dispensary';
  const displayBranchCode = branchCode || resolvedBranch?.code || 'HQ-MAIN';
  const displayAddress = branchAddress || resolvedBranch?.address || 'Plot 12, Mirpur Main Road, Dhaka';
  const displayPhone = branchPhone || resolvedBranch?.phone || '+880 1711-001122';
  const displayLicense = dgdaLicense || resolvedBranch?.licenseNo || 'DGDA-DH-10492';
  const vatBinNo = '00482910-0201 (Mushak-6.3)';

  const issuedDateObj = invoiceDate ? new Date(invoiceDate) : new Date();
  const safeIssuedDate = Number.isNaN(issuedDateObj.getTime()) ? new Date() : issuedDateObj;
  const formattedDateTime = `${safeIssuedDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}, ${safeIssuedDate.toLocaleTimeString('en-US', {
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}`;

  const totalUnits = cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const taxableNet = Math.max(0, subtotal - discount);
  const computedRoundOff =
    roundOff !== undefined ? roundOff : grandTotal - (taxableNet + tax);

  const normalizedPayMethod = (paymentMethod || 'cash').toLowerCase();
  const paymentMethodLabel =
    normalizedPayMethod === 'due_credit' || normalizedPayMethod === 'credit'
      ? 'CREDIT / DUE'
      : normalizedPayMethod === 'bkash_nagad' || normalizedPayMethod === 'mfs'
      ? 'MFS (bKash / Nagad)'
      : normalizedPayMethod === 'card'
      ? 'CARD POS'
      : normalizedPayMethod === 'split'
      ? 'SPLIT SETTLEMENT'
      : 'CASH';

  const statusBadge =
    dueAmount > 0.01 || paymentStatus === 'due'
      ? { label: 'CREDIT DUE', cls: 'bg-rose-100 text-rose-800 border-rose-300' }
      : paymentStatus === 'partially_paid'
      ? { label: 'PARTIAL PAID', cls: 'bg-amber-100 text-amber-800 border-amber-300' }
      : paymentStatus === 'draft'
      ? { label: 'DRAFT PREVIEW', cls: 'bg-slate-200 text-slate-800 border-slate-300' }
      : { label: 'PAID & VERIFIED', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' };

  const effectiveCashPaid =
    grandTotal <= 0
      ? 0
      : cashPaid !== undefined
      ? cashPaid
      : normalizedPayMethod === 'cash'
      ? Math.max(0, grandTotal - dueAmount)
      : 0;
  const effectiveCashTendered =
    grandTotal <= 0
      ? 0
      : normalizedPayMethod === 'cash' && tenderedAmount > 0
      ? tenderedAmount
      : effectiveCashPaid;
  const effectiveChangeDue =
    grandTotal <= 0
      ? 0
      : normalizedPayMethod === 'cash'
      ? Math.max(0, changeDue > 0 ? changeDue : effectiveCashTendered - effectiveCashPaid)
      : 0;

  const effectiveCashier = cashierName || currentUser?.name || 'Duty Pharmacist';
  const effectiveRole = cashierRole || currentUser?.roleName || 'Pharmacist';
  const effectiveDiscountPct =
    discountPercent !== undefined
      ? discountPercent
      : subtotal > 0
      ? Number(((discount / subtotal) * 100).toFixed(1))
      : 0;
  const effectiveVatPct =
    vatPercent !== undefined
      ? vatPercent
      : taxableNet > 0
      ? Number(((tax / taxableNet) * 100).toFixed(1))
      : 0;

  const handlePrintMemo = (formatToPrint: '80mm' | 'a4' = paperFormat) => {
    const popup = window.open('', '_blank', 'width=920,height=780');
    if (!popup) {
      window.print();
      return;
    }

    const bars = buildBarcodeBars(orderNumber);
    const lastBar = bars[bars.length - 1];
    const barcodeWidth = Math.max(160, lastBar ? lastBar.x + lastBar.w + 4 : 160);
    const barcodeSvgHtml = `<svg width="${barcodeWidth}" height="32" viewBox="0 0 ${barcodeWidth} 32" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${barcodeWidth}" height="32" fill="#ffffff"/>${bars
      .map((b) => `<rect x="${b.x}" y="2" width="${b.w}" height="28" fill="#0f172a"/>`)
      .join('')}</svg>`;

    const itemsRowsHtml = cart
      .map((item, idx) => {
        const lineGross = item.price * item.qty;
        const lineNet = lineGross * (1 - (item.disc || 0) / 100);
        const notes: string[] = [];
        if (item.isRxRequired) notes.push('Rx Prescribed');
        if (item.isColdChain) notes.push('Cold Chain 2°C–8°C');
        if (item.isOphthalmic || item.afterOpeningDays) notes.push('Use within 28d of opening');

        if (formatToPrint === 'a4') {
          return `
            <tr>
              <td style="text-align:center;color:#475569;">${idx + 1}</td>
              <td>
                <div style="font-weight:700;color:#0f172a;">${escapeHtml(item.name)}</div>
                <div style="font-size:10px;color:#475569;">${escapeHtml(item.sub)}${item.company ? ` • ${escapeHtml(item.company)}` : ''}</div>
                ${notes.length ? `<div style="font-size:9px;color:#b45309;font-weight:600;margin-top:2px;">${escapeHtml(notes.join(' | '))}</div>` : ''}
              </td>
              <td style="font-family:monospace;font-size:10.5px;">
                <div>Batch: <strong>${escapeHtml(item.batch || 'N/A')}</strong></div>
                <div style="color:#475569;">Exp: ${escapeHtml(item.exp || 'N/A')}</div>
              </td>
              <td style="text-align:center;font-family:monospace;font-weight:700;">${item.qty}</td>
              <td style="text-align:right;font-family:monospace;">Tk ${item.price.toFixed(2)}</td>
              <td style="text-align:center;font-family:monospace;">${item.disc ? `${item.disc}%` : '—'}</td>
              <td style="text-align:right;font-family:monospace;font-weight:700;color:#0f172a;">Tk ${lineNet.toFixed(2)}</td>
            </tr>
          `;
        }

        return `
          <tr>
            <td style="padding:5px 0;border-bottom:1px dotted #cbd5e1;">
              <div style="display:flex;justify-content:space-between;font-weight:700;color:#0f172a;font-size:11px;">
                <span>${idx + 1}. ${escapeHtml(item.name)}</span>
                <span style="font-family:monospace;">Tk ${lineNet.toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:9.5px;color:#475569;margin-top:1px;">
                <span>${escapeHtml(item.sub)}${item.company ? ` • ${escapeHtml(item.company)}` : ''}</span>
                <span style="font-family:monospace;">${item.qty} x ${item.price.toFixed(2)}${item.disc ? ` (-${item.disc}%)` : ''}</span>
              </div>
              <div style="font-size:9px;color:#334155;font-family:monospace;margin-top:1px;">
                Batch: ${escapeHtml(item.batch || 'N/A')} | Exp: ${escapeHtml(item.exp || 'N/A')}
              </div>
              ${notes.length ? `<div style="font-size:8.5px;color:#b45309;font-weight:600;margin-top:1px;">* ${escapeHtml(notes.join(' • '))}</div>` : ''}
            </td>
          </tr>
        `;
      })
      .join('');

    const html =
      formatToPrint === 'a4'
        ? `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Sales Memo - ${escapeHtml(orderNumber)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body, button, input, select, textarea, table, th, td { font-family: Arial, Helvetica, sans-serif; }
    body { margin: 0; color: #0f172a; background: #ffffff; font-size: 11.5px; line-height: 1.4; }
    .toolbar { display:flex; justify-content:flex-end; gap:8px; margin-bottom:12px; }
    .btn { padding:7px 14px; border-radius:6px; border:1px solid #059669; background:#059669; color:#fff; font-weight:700; font-size:12px; cursor:pointer; }
    .btn-sec { background:#f1f5f9; color:#0f172a; border-color:#cbd5e1; }
    @media print { .toolbar { display:none !important; } }
    .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0f172a; padding-bottom:10px; margin-bottom:12px; }
    .title-pill { display:inline-block; background:#0f172a; color:#fff; font-size:10px; font-weight:800; letter-spacing:0.08em; padding:3px 10px; border-radius:4px; text-transform:uppercase; }
    .meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px; }
    .meta-box { border:1px solid #cbd5e1; border-radius:6px; padding:8px 10px; background:#f8fafc; font-size:11px; }
    .meta-row { display:flex; justify-content:space-between; margin-bottom:3px; }
    .meta-row:last-child { margin-bottom:0; }
    table { width:100%; border-collapse:collapse; margin-bottom:12px; }
    th { background:#0f172a; color:#fff; text-align:left; padding:6px 8px; font-size:10px; text-transform:uppercase; letter-spacing:0.04em; }
    td { padding:6px 8px; border-bottom:1px solid #e2e8f0; vertical-align:top; font-size:11px; }
    .bottom-grid { display:grid; grid-template-columns:1.15fr 0.85fr; gap:14px; margin-top:8px; }
    .box { border:1px solid #cbd5e1; border-radius:6px; padding:10px; }
    .tot-row { display:flex; justify-content:space-between; padding:3px 0; font-size:11.5px; }
    .tot-net { border-top:2px solid #0f172a; border-bottom:1px solid #cbd5e1; padding:6px 0; margin:4px 0; font-size:14px; font-weight:800; color:#065f46; }
    .sig-row { display:flex; justify-content:space-between; margin-top:28px; padding-top:6px; font-size:10.5px; color:#475569; }
    .sig-line { width:190px; border-top:1px solid #64748b; text-align:center; padding-top:4px; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn btn-sec" onclick="window.close()">Close</button>
    <button class="btn" onclick="window.print()">Print A4 Memo</button>
  </div>
  <div class="header">
    <div>
      <div style="font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:-0.01em;">${escapeHtml(orgName)}</div>
      <div style="font-size:11.5px;font-weight:600;color:#334155;">${escapeHtml(displayBranchName)} (${escapeHtml(displayBranchCode)})</div>
      <div style="font-size:10.5px;color:#475569;">${escapeHtml(displayAddress)} | Helpline: ${escapeHtml(displayPhone)}</div>
      <div style="font-size:10px;color:#334155;font-family:monospace;margin-top:2px;">DGDA License: ${escapeHtml(displayLicense)} | VAT/BIN: ${escapeHtml(vatBinNo)}</div>
    </div>
    <div style="text-align:right;">
      <span class="title-pill">OFFICIAL SALES MEMO / TAX INVOICE</span>
      <div style="font-family:monospace;font-size:15px;font-weight:900;margin-top:6px;">${escapeHtml(orderNumber)}</div>
      <div style="font-size:10.5px;color:#475569;">${escapeHtml(formattedDateTime)}</div>
      <div style="margin-top:4px;font-size:10px;font-weight:800;color:${dueAmount > 0 ? '#be123c' : '#047857'};">${escapeHtml(statusBadge.label)}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-box">
      <div style="font-weight:800;font-size:10px;text-transform:uppercase;color:#475569;margin-bottom:4px;">Patient & Prescriber Tracking</div>
      <div class="meta-row"><span>Customer / Patient:</span><strong>${escapeHtml(customerName)}</strong></div>
      ${customerPhone ? `<div class="meta-row"><span>Contact Phone:</span><span style="font-family:monospace;">${escapeHtml(customerPhone)}</span></div>` : ''}
      ${customerCode ? `<div class="meta-row"><span>Customer Ref ID:</span><span style="font-family:monospace;">${escapeHtml(customerCode)}</span></div>` : ''}
      <div class="meta-row"><span>Prescribing Doctor:</span><strong>${escapeHtml(doctor ? `${doctor.name} (${doctor.bmdcReg})` : 'Over-The-Counter (OTC)')}</strong></div>
      ${doctor?.speciality ? `<div class="meta-row"><span>Speciality / Hospital:</span><span>${escapeHtml(doctor.speciality)}</span></div>` : ''}
    </div>
    <div class="meta-box">
      <div style="font-weight:800;font-size:10px;text-transform:uppercase;color:#475569;margin-bottom:4px;">Counter & Audit Reference</div>
      <div class="meta-row"><span>Dispensed By:</span><strong>${escapeHtml(effectiveCashier)} (${escapeHtml(effectiveRole)})</strong></div>
      <div class="meta-row"><span>Payment Channel:</span><strong>${escapeHtml(paymentMethodLabel)}</strong></div>
      ${mfsOrCardRef ? `<div class="meta-row"><span>Txn / Slip Reference:</span><span style="font-family:monospace;">${escapeHtml(mfsOrCardRef)}</span></div>` : ''}
      <div class="meta-row"><span>Dispense Summary:</span><span>${cart.length} Line Item(s) • ${totalUnits} Total Units</span></div>
      ${typeof customerLoyaltyPoints === 'number' ? `<div class="meta-row"><span>Loyalty Balance:</span><span>${customerLoyaltyPoints} pts</span></div>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:32px;text-align:center;">#</th>
        <th>Medicine Name, Generic & Manufacturer</th>
        <th style="width:155px;">Batch & Expiry (FEFO)</th>
        <th style="width:52px;text-align:center;">Qty</th>
        <th style="width:82px;text-align:right;">Unit MRP</th>
        <th style="width:56px;text-align:center;">Disc</th>
        <th style="width:94px;text-align:right;">Net Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRowsHtml || '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:16px;">No items on invoice</td></tr>'}
    </tbody>
  </table>

  <div class="bottom-grid">
    <div class="box" style="display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        <div style="font-weight:800;font-size:10px;text-transform:uppercase;color:#0f172a;margin-bottom:4px;">Return, Traceability & Regulatory Terms</div>
        <ul style="margin:0;padding-left:16px;font-size:10px;color:#475569;line-height:1.45;">
          <li>Exchange or return accepted within <strong>7 days</strong> only with this original memo, intact seal, and matching Batch/Lot number.</li>
          <li>Cold-chain (2°C–8°C), insulin, opened vials/drops, surgical consumables, and loose/cut strips are strictly non-returnable.</li>
          <li>All medicines are DGDA-verified and dispensed under strict FEFO (First Expiry, First Out) tracking.</li>
        </ul>
      </div>
      <div style="margin-top:10px;padding-top:8px;border-top:1px dashed #cbd5e1;text-align:center;">
        ${barcodeSvgHtml}
        <div style="font-family:monospace;font-size:9.5px;font-weight:700;color:#334155;margin-top:2px;">TRACKING REF: ${escapeHtml(orderNumber)}</div>
      </div>
    </div>

    <div class="box">
      <div style="font-weight:800;font-size:10px;text-transform:uppercase;color:#0f172a;margin-bottom:6px;">Financial & Settlement Summary</div>
      <div class="tot-row"><span>Gross MRP Subtotal:</span><span style="font-family:monospace;">Tk ${subtotal.toFixed(2)}</span></div>
      <div class="tot-row" style="color:#c2410c;"><span>Total Discount${effectiveDiscountPct > 0 ? ` (${effectiveDiscountPct}%)` : ''}:</span><span style="font-family:monospace;">-Tk ${discount.toFixed(2)}</span></div>
      <div class="tot-row"><span>Taxable Amount:</span><span style="font-family:monospace;">Tk ${taxableNet.toFixed(2)}</span></div>
      <div class="tot-row"><span>Govt. VAT / Tax${effectiveVatPct > 0 ? ` (${effectiveVatPct}%)` : ''}:</span><span style="font-family:monospace;">+Tk ${tax.toFixed(2)}</span></div>
      ${Math.abs(computedRoundOff) >= 0.005 ? `<div class="tot-row"><span>Round-Off Adjustment:</span><span style="font-family:monospace;">${computedRoundOff >= 0 ? '+' : '-'}Tk ${Math.abs(computedRoundOff).toFixed(2)}</span></div>` : ''}
      <div class="tot-row tot-net"><span>NET PAYABLE (BDT):</span><span style="font-family:monospace;">Tk ${grandTotal.toFixed(2)}</span></div>
      <div style="font-size:10px;color:#334155;font-style:italic;margin-bottom:6px;">In Words: <strong>${escapeHtml(amountToEnglishWords(grandTotal))}</strong></div>
      ${effectiveCashPaid > 0 ? `<div class="tot-row"><span>Cash Tendered / Paid:</span><span style="font-family:monospace;">Tk ${effectiveCashTendered.toFixed(2)}</span></div>` : ''}
      ${effectiveChangeDue > 0 ? `<div class="tot-row" style="color:#047857;font-weight:700;"><span>Change Returned:</span><span style="font-family:monospace;">Tk ${effectiveChangeDue.toFixed(2)}</span></div>` : ''}
      ${mfsOrCardPaid > 0 ? `<div class="tot-row"><span>Digital / Card Paid:</span><span style="font-family:monospace;">Tk ${mfsOrCardPaid.toFixed(2)}</span></div>` : ''}
      ${dueAmount > 0 ? `<div class="tot-row" style="color:#be123c;font-weight:800;"><span>Balance Due (Receivable):</span><span style="font-family:monospace;">Tk ${dueAmount.toFixed(2)}</span></div>` : ''}
    </div>
  </div>

  <div class="sig-row">
    <div class="sig-line">Customer / Receiver Signature</div>
    <div class="sig-line">Authorized Pharmacist & Counter Seal</div>
  </div>
</body>
</html>`
        : `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>POS Memo - ${escapeHtml(orderNumber)}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    * { box-sizing: border-box; }
    body, button, table, th, td { font-family: Arial, Helvetica, sans-serif; }
    body { margin: 0 auto; width: 74mm; color: #0f172a; background: #ffffff; font-size: 10.5px; line-height: 1.35; }
    .toolbar { display:flex; justify-content:space-between; margin-bottom:8px; }
    .btn { padding:5px 10px; border-radius:4px; border:1px solid #059669; background:#059669; color:#fff; font-weight:700; font-size:11px; cursor:pointer; }
    .btn-sec { background:#f1f5f9; color:#0f172a; border-color:#cbd5e1; }
    @media print { .toolbar { display:none !important; } body { width: 100%; } }
    .center { text-align:center; }
    .divider { border-top:1px dashed #64748b; margin:6px 0; }
    .row { display:flex; justify-content:space-between; margin-bottom:2px; }
    table { width:100%; border-collapse:collapse; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn btn-sec" onclick="window.close()">Close</button>
    <button class="btn" onclick="window.print()">Print 80mm Slip</button>
  </div>
  <div class="center">
    <div style="font-size:12.5px;font-weight:900;text-transform:uppercase;">${escapeHtml(orgName)}</div>
    <div style="font-size:10px;font-weight:600;">${escapeHtml(displayBranchName)} (${escapeHtml(displayBranchCode)})</div>
    <div style="font-size:9px;color:#475569;">${escapeHtml(displayAddress)}</div>
    <div style="font-size:9px;color:#475569;">Tel: ${escapeHtml(displayPhone)} | Lic: ${escapeHtml(displayLicense)}</div>
    <div style="font-size:8.5px;color:#475569;">BIN/VAT: ${escapeHtml(vatBinNo)}</div>
    <div style="margin-top:4px;font-size:10px;font-weight:900;border-top:1px solid #0f172a;border-bottom:1px solid #0f172a;padding:2px 0;">SALES MEMO / TAX INVOICE</div>
  </div>
  <div style="margin-top:6px;font-size:9.5px;">
    <div class="row"><span>Invoice No:</span><strong style="font-family:monospace;">${escapeHtml(orderNumber)}</strong></div>
    <div class="row"><span>Date & Time:</span><span>${escapeHtml(formattedDateTime)}</span></div>
    <div class="row"><span>Served By:</span><span>${escapeHtml(effectiveCashier)}</span></div>
    <div class="row"><span>Patient/Cust:</span><strong>${escapeHtml(customerName)}${customerPhone ? ` (${escapeHtml(customerPhone)})` : ''}</strong></div>
    <div class="row"><span>Prescriber:</span><span>${escapeHtml(doctor ? `${doctor.name} (${doctor.bmdcReg})` : 'OTC Dispense')}</span></div>
    <div class="row"><span>Payment:</span><strong>${escapeHtml(paymentMethodLabel)} [${escapeHtml(statusBadge.label)}]</strong></div>
  </div>
  <div class="divider"></div>
  <table>
    <tbody>${itemsRowsHtml}</tbody>
  </table>
  <div class="divider"></div>
  <div style="font-size:10px;">
    <div class="row"><span>Items / Total Qty:</span><span>${cart.length} item(s) / ${totalUnits} unit(s)</span></div>
    <div class="row"><span>Gross MRP Subtotal:</span><span style="font-family:monospace;">Tk ${subtotal.toFixed(2)}</span></div>
    <div class="row" style="color:#c2410c;"><span>Discount${effectiveDiscountPct > 0 ? ` (${effectiveDiscountPct}%)` : ''}:</span><span style="font-family:monospace;">-Tk ${discount.toFixed(2)}</span></div>
    <div class="row"><span>Taxable Amount:</span><span style="font-family:monospace;">Tk ${taxableNet.toFixed(2)}</span></div>
    <div class="row"><span>VAT / Tax${effectiveVatPct > 0 ? ` (${effectiveVatPct}%)` : ''}:</span><span style="font-family:monospace;">+Tk ${tax.toFixed(2)}</span></div>
    ${Math.abs(computedRoundOff) >= 0.005 ? `<div class="row"><span>Round-Off:</span><span style="font-family:monospace;">${computedRoundOff >= 0 ? '+' : '-'}Tk ${Math.abs(computedRoundOff).toFixed(2)}</span></div>` : ''}
    <div class="row" style="border-top:1px solid #0f172a;padding-top:3px;margin-top:3px;font-size:12px;font-weight:900;">
      <span>NET PAYABLE:</span><span style="font-family:monospace;">Tk ${grandTotal.toFixed(2)}</span>
    </div>
    <div style="font-size:8.5px;color:#334155;font-style:italic;margin:2px 0 4px;">${escapeHtml(amountToEnglishWords(grandTotal))}</div>
    ${effectiveCashPaid > 0 ? `<div class="row"><span>Cash Tendered:</span><span style="font-family:monospace;">Tk ${effectiveCashTendered.toFixed(2)}</span></div>` : ''}
    ${effectiveChangeDue > 0 ? `<div class="row" style="font-weight:700;"><span>Change Due:</span><span style="font-family:monospace;">Tk ${effectiveChangeDue.toFixed(2)}</span></div>` : ''}
    ${mfsOrCardPaid > 0 ? `<div class="row"><span>Digital / Card Paid:</span><span style="font-family:monospace;">Tk ${mfsOrCardPaid.toFixed(2)}</span></div>` : ''}
    ${dueAmount > 0 ? `<div class="row" style="color:#be123c;font-weight:800;"><span>Balance Due:</span><span style="font-family:monospace;">Tk ${dueAmount.toFixed(2)}</span></div>` : ''}
  </div>
  <div class="divider"></div>
  <div class="center">
    ${barcodeSvgHtml}
    <div style="font-family:monospace;font-size:8.5px;font-weight:700;margin-top:2px;">REF: ${escapeHtml(orderNumber)}</div>
    <div style="font-size:8.5px;color:#334155;margin-top:4px;line-height:1.35;">
      <strong>RETURN POLICY:</strong> Exchange within 7 days with original memo, intact seal &amp; matching Batch No. Cold-chain, insulin, opened bottles &amp; cut strips are non-returnable.<br/>
      FEFO &amp; DGDA Quality Verified • Thank you for trusting us.
    </div>
  </div>
</body>
</html>`;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    setTimeout(() => {
      try {
        popup.print();
      } catch {
        // user can click Print button in preview window
      }
    }, 300);
  };

  useEffect(() => {
    if (isOpen && autoPrint) {
      const timer = setTimeout(() => {
        handlePrintMemo(paperFormat);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoPrint]);

  if (!isOpen) return null;

  return (
    <div
      data-no-translate="true"
      data-english-memo="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in"
    >
      <div
        className={`w-full ${
          paperFormat === 'a4' ? 'max-w-3xl' : 'max-w-md'
        } bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 flex flex-col gap-3 max-h-[92vh] transition-all`}
      >
        {/* Top Modal Controls */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <div className="font-extrabold text-xs text-slate-900 dark:text-white">
                Official Sales Memo / Tax Invoice
              </div>
              <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Pure English Format • Full Batch, Regulatory &amp; Audit Traceability
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Format Switcher: 80mm POS vs A4 Official Memo */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setPaperFormat('80mm')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  paperFormat === '80mm'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                80mm POS
              </button>
              <button
                type="button"
                onClick={() => setPaperFormat('a4')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  paperFormat === 'a4'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                A4 Memo
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close receipt modal"
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Crisp Paper Preview Sheet (Always clean light paper styling for true-to-print appearance) */}
        <div className="p-5 bg-white text-slate-900 rounded-xl border border-slate-300 shadow-inner flex flex-col gap-3 overflow-y-auto text-[11px] leading-snug">
          {/* Corporate Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 pb-3 border-b-2 border-slate-900">
            <div className={paperFormat === '80mm' ? 'text-center sm:text-left' : 'text-left'}>
              <h2 className="font-black text-sm tracking-tight uppercase text-slate-900">
                {orgName}
              </h2>
              <p className="text-[11px] font-semibold text-slate-700">
                {displayBranchName} <span className="memo-mono text-[10px] font-bold text-slate-500">({displayBranchCode})</span>
              </p>
              <p className="text-[10px] text-slate-600">{displayAddress}</p>
              <p className="text-[10px] text-slate-600">
                Helpline: <span className="memo-mono">{displayPhone}</span> • DGDA Lic:{' '}
                <span className="memo-mono font-semibold">{displayLicense}</span>
              </p>
              <p className="text-[9.5px] text-slate-500 memo-mono">VAT / BIN: {vatBinNo}</p>
            </div>

            <div className={`${paperFormat === '80mm' ? 'text-center sm:text-right' : 'text-right'} shrink-0`}>
              <span className="inline-block px-2 py-0.5 rounded bg-slate-900 text-white text-[9.5px] font-black tracking-wider uppercase">
                OFFICIAL SALES MEMO / INVOICE
              </span>
              <div className="memo-mono text-sm font-black text-slate-900 mt-1">{orderNumber}</div>
              <div className="text-[10px] text-slate-500">{formattedDateTime}</div>
              <span
                className={`inline-block mt-1 px-2 py-0.5 rounded border text-[9px] font-extrabold uppercase tracking-wide ${statusBadge.cls}`}
              >
                {statusBadge.label}
              </span>
            </div>
          </div>

          {/* Patient, Prescriber & Audit Metadata Block */}
          <div className={`grid ${paperFormat === 'a4' ? 'grid-cols-2' : 'grid-cols-1'} gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[10.5px]`}>
            <div className="space-y-1">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 font-medium">Customer / Patient:</span>
                <span className="font-bold text-slate-900 text-right">{customerName}</span>
              </div>
              {customerPhone && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 font-medium">Contact Phone:</span>
                  <span className="memo-mono font-semibold text-slate-800">{customerPhone}</span>
                </div>
              )}
              {customerCode && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 font-medium">Customer ID:</span>
                  <span className="memo-mono text-slate-700">{customerCode}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 font-medium">Prescribing Doctor:</span>
                <span className="font-semibold text-slate-900 text-right">
                  {doctor ? `${doctor.name} (${doctor.bmdcReg})` : 'Over-The-Counter (OTC)'}
                </span>
              </div>
              {doctor?.speciality && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 font-medium">Speciality:</span>
                  <span className="text-slate-700 text-right">{doctor.speciality}</span>
                </div>
              )}
            </div>

            <div className={`space-y-1 ${paperFormat === 'a4' ? 'sm:border-l sm:border-slate-200 sm:pl-3' : 'border-t border-slate-200 pt-1.5'}`}>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 font-medium">Served By:</span>
                <span className="font-semibold text-slate-900 text-right">
                  {effectiveCashier} ({effectiveRole})
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 font-medium">Payment Mode:</span>
                <span className="font-bold text-slate-900">{paymentMethodLabel}</span>
              </div>
              {mfsOrCardRef && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 font-medium">Txn / Card Ref:</span>
                  <span className="memo-mono font-semibold text-slate-800">{mfsOrCardRef}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 font-medium">Items / Units:</span>
                <span className="memo-mono font-semibold text-slate-800">
                  {cart.length} Line(s) • {totalUnits} Units
                </span>
              </div>
              {typeof customerLoyaltyPoints === 'number' && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 font-medium">Loyalty Points:</span>
                  <span className="memo-mono font-semibold text-emerald-700">{customerLoyaltyPoints} pts</span>
                </div>
              )}
            </div>
          </div>

          {/* Itemized Medication & Batch Schedule */}
          {paperFormat === 'a4' ? (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-[10.5px]">
                <thead>
                  <tr className="bg-slate-900 text-white text-[9.5px] uppercase tracking-wider">
                    <th className="py-2 px-2 text-center w-8">#</th>
                    <th className="py-2 px-2.5">Medicine Description &amp; Generic</th>
                    <th className="py-2 px-2.5">Batch &amp; Expiry</th>
                    <th className="py-2 px-2 text-center">Qty</th>
                    <th className="py-2 px-2 text-right">Unit MRP</th>
                    <th className="py-2 px-2 text-center">Disc</th>
                    <th className="py-2 px-2.5 text-right">Net Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-5 text-center text-slate-400">
                        No items present in this memo.
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, idx) => {
                      const lineNet = item.price * item.qty * (1 - (item.disc || 0) / 100);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70">
                          <td className="py-2 px-2 text-center text-slate-500 memo-mono">{idx + 1}</td>
                          <td className="py-2 px-2.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900">{item.name}</span>
                              {item.isRxRequired && (
                                <span className="px-1 py-0.2 rounded bg-rose-100 text-rose-800 text-[8.5px] font-bold">
                                  Rx
                                </span>
                              )}
                            </div>
                            <div className="text-[9.5px] text-slate-500">
                              {item.sub}
                              {item.company ? ` • ${item.company}` : ''}
                            </div>
                            {(item.afterOpeningDays || item.isOphthalmic) && (
                              <div className="flex items-center gap-1 text-[9px] text-amber-700 font-semibold mt-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                <span>Ophthalmic: Use within 28 days of opening.</span>
                              </div>
                            )}
                            {item.isColdChain && (
                              <div className="flex items-center gap-1 text-[9px] text-sky-700 font-semibold mt-0.5">
                                <Snowflake className="w-2.5 h-2.5" />
                                <span>Cold Chain: Store at 2°C–8°C (Pack with Ice-Pack).</span>
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2.5 memo-mono text-[10px]">
                            <div className="font-bold text-slate-800">{item.batch || 'N/A'}</div>
                            <div className="text-slate-500">Exp: {item.exp || 'N/A'}</div>
                          </td>
                          <td className="py-2 px-2 text-center memo-mono font-bold text-slate-900">
                            {item.qty}
                          </td>
                          <td className="py-2 px-2 text-right memo-mono text-slate-700">
                            Tk {item.price.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-center memo-mono text-slate-600">
                            {item.disc > 0 ? `${item.disc}%` : '—'}
                          </td>
                          <td className="py-2 px-2.5 text-right memo-mono font-bold text-slate-900">
                            Tk {lineNet.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-dotted divide-slate-300 border-y border-dashed border-slate-300 py-1">
              <div className="flex justify-between font-bold text-[9.5px] uppercase text-slate-500 pb-1">
                <span>Medicine / Batch &amp; Expiry</span>
                <span>Qty x MRP</span>
                <span>Net (Tk)</span>
              </div>
              {cart.length === 0 ? (
                <div className="py-4 text-center text-slate-400 text-[10.5px]">
                  No items present in this memo.
                </div>
              ) : (
                cart.map((item, idx) => {
                  const lineNet = item.price * item.qty * (1 - (item.disc || 0) / 100);
                  return (
                    <div key={item.id} className="py-1.5 flex flex-col gap-0.5">
                      <div className="flex justify-between items-baseline gap-2">
                        <span className="font-bold text-slate-900 truncate flex-1">
                          {idx + 1}. {item.name}
                          {item.isRxRequired ? ' [Rx]' : ''}
                        </span>
                        <span className="text-slate-500 memo-mono text-[10px] shrink-0">
                          {item.qty} x {item.price.toFixed(2)}
                          {item.disc > 0 ? ` (-${item.disc}%)` : ''}
                        </span>
                        <span className="font-bold text-slate-900 memo-mono shrink-0 w-16 text-right">
                          {lineNet.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[9.5px] text-slate-500 flex flex-wrap justify-between gap-x-2">
                        <span>
                          {item.sub}
                          {item.company ? ` • ${item.company}` : ''}
                        </span>
                        <span className="memo-mono text-slate-600">
                          Batch: {item.batch || 'N/A'} | Exp: {item.exp || 'N/A'}
                        </span>
                      </div>
                      {(item.afterOpeningDays || item.isOphthalmic) && (
                        <div className="flex items-center gap-1 text-[9px] text-amber-700 font-semibold">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Ophthalmic Notice: Discard 28 days after opening.</span>
                        </div>
                      )}
                      {item.isColdChain && (
                        <div className="flex items-center gap-1 text-[9px] text-sky-700 font-semibold">
                          <Snowflake className="w-2.5 h-2.5" />
                          <span>Cold Chain: Keep refrigerated at 2°C–8°C.</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Totals & Settlement Reconciliation */}
          <div className="flex flex-col gap-1 text-[10.5px] bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex justify-between text-slate-600">
              <span>Gross MRP Subtotal:</span>
              <span className="memo-mono font-semibold text-slate-900">Tk {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-amber-700">
              <span>
                Less: Total Discount{effectiveDiscountPct > 0 ? ` (${effectiveDiscountPct}%)` : ''}:
              </span>
              <span className="memo-mono font-semibold">-Tk {discount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Taxable Net Amount:</span>
              <span className="memo-mono font-semibold text-slate-900">Tk {taxableNet.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Add: Govt. VAT / Tax{effectiveVatPct > 0 ? ` (${effectiveVatPct}%)` : ''}:</span>
              <span className="memo-mono font-semibold text-slate-900">+Tk {tax.toFixed(2)}</span>
            </div>
            {Math.abs(computedRoundOff) >= 0.005 && (
              <div className="flex justify-between text-slate-600">
                <span>Round-Off Adjustment:</span>
                <span className="memo-mono font-semibold text-slate-900">
                  {computedRoundOff >= 0 ? '+' : '-'}Tk {Math.abs(computedRoundOff).toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex justify-between items-baseline font-black text-xs border-t-2 border-slate-900 pt-1.5 mt-1 text-emerald-800">
              <span>NET PAYABLE (BDT):</span>
              <span className="memo-mono text-sm">Tk {grandTotal.toFixed(2)}</span>
            </div>

            <div className="text-[9.5px] text-slate-600 italic border-b border-dotted border-slate-300 pb-1.5">
              In Words: <span className="font-semibold text-slate-800">{amountToEnglishWords(grandTotal)}</span>
            </div>

            <div className="pt-1 space-y-0.5">
              {effectiveCashPaid > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>Cash Tendered / Paid:</span>
                  <span className="memo-mono font-semibold">Tk {effectiveCashTendered.toFixed(2)}</span>
                </div>
              )}
              {effectiveChangeDue > 0 && (
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Change Returned:</span>
                  <span className="memo-mono">Tk {effectiveChangeDue.toFixed(2)}</span>
                </div>
              )}
              {mfsOrCardPaid > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>Digital / Card Settled:</span>
                  <span className="memo-mono font-semibold">Tk {mfsOrCardPaid.toFixed(2)}</span>
                </div>
              )}
              {dueAmount > 0 && (
                <div className="flex justify-between font-extrabold text-rose-700">
                  <span>Balance Due (Credit Receivable):</span>
                  <span className="memo-mono">Tk {dueAmount.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tracking Barcode & Pharmacy Return Policy */}
          <div className="pt-2 border-t border-dashed border-slate-300 text-center space-y-2">
            <div>
              <InvoiceBarcodeSvg value={orderNumber} />
              <div className="memo-mono text-[9.5px] font-bold text-slate-700 mt-1">
                TRACKING REF: {orderNumber}
              </div>
            </div>

            <div className="text-[9px] text-slate-500 text-left bg-slate-50 px-2.5 py-2 rounded-lg border border-slate-200 leading-relaxed">
              <div className="font-bold text-slate-700 uppercase tracking-wide mb-0.5">
                Return, Exchange &amp; Quality Compliance Policy
              </div>
              <div>
                • Exchange or return eligible within <strong>7 days</strong> with original sales memo,
                unbroken seal, and matching Batch/Lot number.
              </div>
              <div>
                • Cold-chain items (2°C–8°C), insulin, opened bottles/drops, surgicals &amp; cut
                strips are non-returnable.
              </div>
              <div>
                • Verified under strict DGDA authenticity &amp; FEFO (First Expiry, First Out) protocol.
              </div>
            </div>

            {paperFormat === 'a4' && (
              <div className="flex items-center justify-between pt-6 px-4 text-[10px] text-slate-600">
                <div className="w-44 border-t border-slate-400 pt-1 text-center font-medium">
                  Customer / Receiver Signature
                </div>
                <div className="w-44 border-t border-slate-400 pt-1 text-center font-medium">
                  Authorized Pharmacist &amp; Seal
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 pt-1 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => handlePrintMemo(paperFormat)}
            className="flex-[1.5] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-700/20 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{paperFormat === 'a4' ? 'Print Official A4 Memo' : 'Print 80mm POS Slip'}</span>
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

    substitutes = matches
      .map((m) => {
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
      })
      .filter((s) => s.stock > 0);
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
                </div>
                <input
                  type="password"
                  placeholder="Enter Pharmacist Security PIN..."
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
