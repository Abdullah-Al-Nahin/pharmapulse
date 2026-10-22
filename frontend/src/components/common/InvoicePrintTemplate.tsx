import React from 'react';
import { Sale } from '../../types/pharmacy';
import { SvgBarcode, SvgQrCode } from './PrintBarcode';
import {
  formatCurrency,
  formatNumber,
  formatDate,
  toBanglaDigits,
  getLocalizedInvoiceLabels,
  getLocalizedPaymentMethodLabel,
  getLocalizedCopyTypeLabel,
  getCurrentLocale
} from '../../utils/i18nFormatter';

export type InvoicePrintFormat = 'thermal_80mm' | 'thermal_58mm' | 'standard_a4' | 'standard_a5';
export type InvoiceCopyType = 'customer' | 'store' | 'accounts';

export interface PharmacyOrgInfo {
  name: string;
  subtitle: string;
  branch: string;
  address: string;
  contactNo: string;
  email: string;
  drugLicenseNo: string;
  vatRegNo: string;
  tinNo: string;
}

export const DEFAULT_PHARMACY_INFO: PharmacyOrgInfo = {
  name: 'MADINA PHARMACEUTICALS & EYE HOSPITAL LTD.',
  subtitle: 'Model Pharmacy & Clinical Dispensary • DGDA Authorized',
  branch: 'Main Hospital Branch (Ground Floor Outpatient)',
  address: 'Plot 42, Hospital Road, Medical City Zone, Dhaka - 1205',
  contactNo: '+880 1711-000000 / +880 2-9842100',
  email: 'dispensary@madinahospital.org',
  drugLicenseNo: 'DL-RX-2024-008912 (Form 20B/21B)',
  vatRegNo: 'BIN: 002948174-0101',
  tinNo: 'TIN: 4891-2849-0194'
};

interface InvoicePrintTemplateProps {
  sale: Sale;
  format: InvoicePrintFormat;
  copyType?: InvoiceCopyType;
  orgInfo?: PharmacyOrgInfo;
  showBarcode?: boolean;
  showQrCode?: boolean;
  notes?: string;
  locale?: 'en' | 'bn';
}

export const InvoicePrintTemplate: React.FC<InvoicePrintTemplateProps> = ({
  sale,
  format,
  copyType = 'customer',
  orgInfo = DEFAULT_PHARMACY_INFO,
  showBarcode = true,
  showQrCode = true,
  notes,
  locale
}) => {
  const activeLocale = locale || getCurrentLocale();
  const lbl = React.useMemo(() => getLocalizedInvoiceLabels(activeLocale), [activeLocale]);

  // Format dates & time
  const formattedDateTime = React.useMemo(() => {
    return `${formatDate(sale.date, activeLocale)} ${sale.timestamp || ''}`.trim();
  }, [sale.date, sale.timestamp, activeLocale]);

  // Copy Label
  const copyLabel = React.useMemo(() => {
    return getLocalizedCopyTypeLabel(copyType, activeLocale);
  }, [copyType, activeLocale]);

  // Payment method formatted
  const paymentMethodLabel = React.useMemo(() => {
    return getLocalizedPaymentMethodLabel(sale.paymentMethod, activeLocale);
  }, [sale.paymentMethod, activeLocale]);

  // Currency & number formatters
  const fmtCurr = (amount: number | string | null | undefined) => formatCurrency(amount, activeLocale);
  const fmtNum = (num: number | string | null | undefined, decimals: number = 0) => formatNumber(num, activeLocale, decimals);
  const dispInv = activeLocale === 'bn' ? toBanglaDigits(sale.invoiceNumber) : sale.invoiceNumber;

  // Tender & Change calculation
  const totalPaid = React.useMemo(() => {
    if (sale.paymentMethod === 'split' && sale.splitDetails) {
      const c = sale.splitDetails.cashAmount || 0;
      const m = sale.splitDetails.mobileAmount || 0;
      const cd = sale.splitDetails.cardAmount || 0;
      return c + m + cd;
    }
    return sale.cashTendered || sale.grandTotal;
  }, [sale]);

  const changeDue = React.useMemo(() => {
    return sale.changeGiven || Math.max(0, totalPaid - sale.grandTotal);
  }, [sale, totalPaid]);

  const balanceDue = React.useMemo(() => {
    return Math.max(0, sale.grandTotal - totalPaid);
  }, [sale.grandTotal, totalPaid]);

  // Generate QR Verification string
  const qrVerificationPayload = React.useMemo(() => {
    return `INV:${sale.invoiceNumber}|DATE:${sale.date}|NET:${sale.grandTotal.toFixed(2)}|VAT:${sale.taxTotal.toFixed(2)}|LIC:${orgInfo.drugLicenseNo}`;
  }, [sale, orgInfo]);

  // =========================================================================
  // 1. 58mm Thermal Mini POS Receipt Template
  // =========================================================================
  if (format === 'thermal_58mm') {
    return (
      <div
        id="printable-invoice-root"
        className="font-mono text-black bg-white leading-tight select-none p-1 text-[10px]"
        style={{ width: '48mm', margin: '0 auto', wordBreak: 'break-word' }}
      >
        {/* Header Section */}
        <div className="text-center pb-1.5 border-b border-dashed border-black">
          <h1 className="font-bold text-[11px] uppercase tracking-tighter leading-snug">
            {orgInfo.name}
          </h1>
          <p className="text-[9px]">{orgInfo.branch}</p>
          <p className="text-[8.5px]">{orgInfo.address}</p>
          <p className="text-[8.5px]">Tel: {orgInfo.contactNo}</p>
          <p className="text-[8.5px] font-semibold mt-0.5">DL: {orgInfo.drugLicenseNo}</p>
          <p className="text-[8.5px]">VAT: {orgInfo.vatRegNo}</p>
          <div className="inline-block px-1 border border-black text-[8px] font-bold mt-1">
            {copyLabel}
          </div>
        </div>

        {/* Invoice Metadata */}
        <div className="py-1 border-b border-dashed border-black text-[9px] space-y-0.5">
          <div className="flex justify-between">
            <span className="font-bold">INV #{sale.invoiceNumber}</span>
            <span>{sale.date}</span>
          </div>
          <div className="flex justify-between text-[8.5px]">
            <span>Time: {sale.timestamp}</span>
            <span>Phm: {sale.cashierName.split(',')[0]}</span>
          </div>
          <div className="text-[8.5px]">
            <span>Cust: <strong>{sale.customerName}</strong></span>
            {sale.customerPhone && <span> ({sale.customerPhone})</span>}
          </div>
          {sale.doctorName && (
            <div className="text-[8.5px] text-black">
              <span>Dr: {sale.doctorName}</span>
            </div>
          )}
        </div>

        {/* Itemized Table */}
        <div className="py-1 border-b border-dashed border-black">
          <div className="flex justify-between text-[8.5px] font-bold border-b border-black pb-0.5 mb-1">
            <span>ITEM / BATCH / EXP</span>
            <span>QTY / TOTAL</span>
          </div>

          <div className="space-y-1">
            {sale.items.map((item, idx) => {
              const unitDisplay = item.unitType === 'box' ? `${item.quantity} Box` : `${item.quantity} Pcs`;
              return (
                <div key={idx} className="leading-tight">
                  <div className="font-bold text-[9px]">{item.medicineName}</div>
                  <div className="flex justify-between text-[8px] text-gray-700">
                    <span>B:{item.batchNumber} E:{item.expiryDate}</span>
                    <span>@{fmtCurr(item.unitPrice)}</span>
                  </div>
                  <div className="flex justify-between text-[8.5px]">
                    <span>
                      Qty: {unitDisplay}
                      {item.discountPercent > 0 && ` (-${item.discountPercent}%)`}
                    </span>
                    <span className="font-bold">{fmtCurr(item.total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Financial Summary & Split Breakdown */}
        <div className="py-1 border-b border-dashed border-black text-[9px] space-y-0.5">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{fmtCurr(sale.subtotal)}</span>
          </div>
          {sale.discountTotal > 0 && (
            <div className="flex justify-between">
              <span>Discount:</span>
              <span>-{fmtCurr(sale.discountTotal)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>VAT / Tax (Incl):</span>
            <span>{fmtCurr(sale.taxTotal)}</span>
          </div>
          <div className="flex justify-between font-extrabold text-[11px] border-t border-black pt-0.5 mt-0.5">
            <span>NET PAYABLE:</span>
            <span>{fmtCurr(sale.grandTotal)}</span>
          </div>
          <div className="flex justify-between font-semibold pt-0.5">
            <span>Paid ({paymentMethodLabel}):</span>
            <span>{fmtCurr(totalPaid)}</span>
          </div>

          {/* Split details if present */}
          {sale.paymentMethod === 'split' && sale.splitDetails && (
            <div className="pl-1 border-l border-black text-[8px] space-y-0.5 my-0.5">
              {(sale.splitDetails.cashAmount || 0) > 0 && (
                <div className="flex justify-between">
                  <span>• Cash:</span>
                  <span>{fmtCurr(sale.splitDetails.cashAmount || 0)}</span>
                </div>
              )}
              {(sale.splitDetails.mobileAmount || 0) > 0 && (
                <div className="flex justify-between">
                  <span>• {sale.splitDetails.mobileProvider || 'bKash'}:</span>
                  <span>{fmtCurr(sale.splitDetails.mobileAmount || 0)}</span>
                </div>
              )}
              {(sale.splitDetails.cardAmount || 0) > 0 && (
                <div className="flex justify-between">
                  <span>• Card:</span>
                  <span>{fmtCurr(sale.splitDetails.cardAmount || 0)}</span>
                </div>
              )}
            </div>
          )}

          {changeDue > 0 && (
            <div className="flex justify-between font-bold">
              <span>Change Returned:</span>
              <span>{fmtCurr(changeDue)}</span>
            </div>
          )}
          {balanceDue > 0 && (
            <div className="flex justify-between font-bold text-red-600">
              <span>Due Balance:</span>
              <span>{fmtCurr(balanceDue)}</span>
            </div>
          )}
        </div>

        {/* Footer & Compliance Section */}
        <div className="pt-1.5 text-center space-y-1">
          {showBarcode && (
            <div className="flex justify-center my-1">
              <SvgBarcode value={sale.invoiceNumber} width={130} height={30} showText={true} />
            </div>
          )}
          {showQrCode && (
            <div className="flex justify-center my-0.5">
              <SvgQrCode value={qrVerificationPayload} size={48} />
            </div>
          )}
          <div className="text-[7.5px] leading-tight text-gray-800 space-y-0.5">
            <p className="font-bold">REGULATORY NOTICE:</p>
            <p>Goods once sold cannot be returned without original receipt. Sold medicines must be returned within 7 days.</p>
            <p className="font-semibold">Keep out of reach of children. Store below 30°C.</p>
            <p>FEFO Compliant • Cold-chain items non-returnable.</p>
            <p className="pt-0.5">*** Thank You for Visiting ***</p>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. 80mm Standard POS Thermal Receipt Template
  // =========================================================================
  if (format === 'thermal_80mm') {
    return (
      <div
        id="printable-invoice-root"
        className="font-mono text-black bg-white leading-tight select-none p-2 text-xs"
        style={{ width: '72mm', margin: '0 auto', wordBreak: 'break-word' }}
      >
        {/* Header Section */}
        <div className="text-center pb-2 border-b-2 border-dashed border-black">
          <h1 className="font-extrabold text-sm uppercase tracking-tight leading-snug">
            {orgInfo.name}
          </h1>
          <p className="text-[10px] text-gray-700 font-sans">{orgInfo.subtitle}</p>
          <p className="text-[9.5px] mt-0.5">{orgInfo.branch}</p>
          <p className="text-[9px]">{orgInfo.address}</p>
          <p className="text-[9px]">Helpdesk: {orgInfo.contactNo}</p>
          <div className="text-[9px] font-semibold mt-1 flex flex-wrap justify-center gap-x-2">
            <span>DL: {orgInfo.drugLicenseNo}</span>
            <span>{orgInfo.vatRegNo}</span>
          </div>
          <div className="inline-block mt-1 px-2 py-0.5 border border-black font-sans font-bold text-[9px] tracking-wider uppercase">
            {copyLabel}
          </div>
        </div>

        {/* Invoice Metadata */}
        <div className="py-2 border-b border-dashed border-black text-[10px] space-y-1">
          <div className="flex justify-between items-baseline">
            <span className="font-bold text-xs">INVOICE: #{sale.invoiceNumber}</span>
            <span>{sale.date}</span>
          </div>
          <div className="flex justify-between text-[9.5px]">
            <span>Time: {sale.timestamp}</span>
            <span>Cashier: <strong>{sale.cashierName}</strong></span>
          </div>
          <div className="flex justify-between text-[9.5px]">
            <span>Customer: <strong>{sale.customerName}</strong></span>
            {sale.customerPhone && <span>Ph: {sale.customerPhone}</span>}
          </div>
          {sale.doctorName && (
            <div className="text-[9.5px] text-gray-900 border-t border-dotted border-gray-400 pt-0.5">
              <span>Doctor / Prescriber: <strong>{sale.doctorName}</strong></span>
              {sale.prescriptionId && <span className="ml-1 text-[8.5px]">({sale.prescriptionId})</span>}
            </div>
          )}
        </div>

        {/* Itemized Table (Pharmacy Compliance: Batch & Expiry) */}
        <div className="py-2 border-b-2 border-dashed border-black">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-black text-[9px] font-bold uppercase tracking-wider">
                <th className="py-1">Description / Batch</th>
                <th className="py-1 text-center">Qty</th>
                <th className="py-1 text-right">Rate</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sale.items.map((item, idx) => {
                const unitStr = item.unitType === 'box' ? `${item.quantity} Box` : `${item.quantity} Pcs`;
                return (
                  <tr key={idx} className="text-[10px] align-top">
                    <td className="py-1.5 pr-1">
                      <div className="font-bold leading-tight text-[10.5px]">{item.medicineName}</div>
                      <div className="text-[9px] text-gray-700 flex items-center gap-1.5 mt-0.5">
                        <span>B: <strong>{item.batchNumber}</strong></span>
                        <span>Exp: {item.expiryDate}</span>
                        {item.discountPercent > 0 && (
                          <span className="font-semibold">(-{item.discountPercent}%)</span>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 text-center font-semibold text-[9.5px] whitespace-nowrap">
                      {unitStr}
                    </td>
                    <td className="py-1.5 text-right font-mono text-[9.5px] whitespace-nowrap">
                      {fmtCurr(item.unitPrice)}
                    </td>
                    <td className="py-1.5 text-right font-bold font-mono text-[10px] whitespace-nowrap">
                      {fmtCurr(item.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary & Payment Breakdown */}
        <div className="py-2 border-b-2 border-dashed border-black text-[10px] space-y-1">
          <div className="flex justify-between">
            <span>Items Subtotal:</span>
            <span className="font-mono">{fmtCurr(sale.subtotal)}</span>
          </div>
          {sale.discountTotal > 0 && (
            <div className="flex justify-between">
              <span>Total Discount / Savings:</span>
              <span className="font-mono">-{fmtCurr(sale.discountTotal)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>VAT / Tax (Included):</span>
            <span className="font-mono">{fmtCurr(sale.taxTotal)}</span>
          </div>

          <div className="flex justify-between font-extrabold text-sm border-t-2 border-black pt-1 mt-1">
            <span>NET PAYABLE:</span>
            <span className="font-mono text-base">{fmtCurr(sale.grandTotal)}</span>
          </div>

          {/* Payment Method Breakdown */}
          <div className="pt-1 text-[9.5px] border-t border-dotted border-gray-400 space-y-0.5">
            <div className="flex justify-between font-semibold">
              <span>Payment Mode:</span>
              <span className="uppercase">{paymentMethodLabel}</span>
            </div>

            {/* Split Details Breakdown */}
            {sale.paymentMethod === 'split' && sale.splitDetails && (
              <div className="bg-gray-50 border border-gray-300 p-1.5 rounded my-1 text-[9px] space-y-0.5">
                <div className="font-bold text-[8.5px] uppercase text-gray-700">Split Breakdown:</div>
                {(sale.splitDetails.cashAmount || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>• Cash Payment:</span>
                    <span className="font-mono">{fmtCurr(sale.splitDetails.cashAmount || 0)}</span>
                  </div>
                )}
                {(sale.splitDetails.mobileAmount || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>
                      • {sale.splitDetails.mobileProvider || 'bKash'} 
                      {sale.splitDetails.mobileTrxId ? ` (Trx: ${sale.splitDetails.mobileTrxId})` : ''}:
                    </span>
                    <span className="font-mono">{fmtCurr(sale.splitDetails.mobileAmount || 0)}</span>
                  </div>
                )}
                {(sale.splitDetails.cardAmount || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>
                      • Card ({sale.splitDetails.cardType || 'POS'}
                      {sale.splitDetails.cardAuthCode ? ` Auth: ${sale.splitDetails.cardAuthCode}` : ''}):
                    </span>
                    <span className="font-mono">{fmtCurr(sale.splitDetails.cardAmount || 0)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between">
              <span>Paid / Tendered:</span>
              <span className="font-mono font-semibold">{fmtCurr(totalPaid)}</span>
            </div>
            {changeDue > 0 && (
              <div className="flex justify-between font-bold">
                <span>Change Returned:</span>
                <span className="font-mono">{fmtCurr(changeDue)}</span>
              </div>
            )}
            {balanceDue > 0 && (
              <div className="flex justify-between font-bold text-red-600">
                <span>Due Balance:</span>
                <span className="font-mono">{fmtCurr(balanceDue)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer & Compliance Section */}
        <div className="pt-2 text-center space-y-2">
          {/* Barcode / QR Code */}
          <div className="flex items-center justify-center gap-3 my-1">
            {showBarcode && (
              <SvgBarcode value={sale.invoiceNumber} width={160} height={36} showText={true} />
            )}
            {showQrCode && (
              <div className="border border-black p-0.5 bg-white">
                <SvgQrCode value={qrVerificationPayload} size={54} />
              </div>
            )}
          </div>

          {/* Regulatory Disclaimers */}
          <div className="text-[8.5px] leading-relaxed text-gray-800 space-y-1 font-sans border-t border-dashed border-black pt-1.5">
            <p className="font-bold text-[9px] uppercase tracking-wide">Customer Instructions & Compliance</p>
            <p>• Goods once sold cannot be returned without original receipt. Sold medicines must be returned within 7 days.</p>
            <p className="font-semibold">• Keep out of reach of children. Store below 30°C.</p>
            <p>• Cold-chain items (Insulin, Vaccines, Eye Drops 2°C–8°C) are non-refundable once dispensed.</p>
            <p className="text-[8px] text-gray-600 font-mono mt-1">Computer Generated Invoice • No Signature Required</p>
            <p className="font-serif italic text-[9px] pt-1">We wish you a speedy recovery!</p>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3 & 4. A4 Standard Tax Invoice & A5 Clinic Voucher Templates
  // =========================================================================
  const isA5 = format === 'standard_a5';

  return (
    <div
      id="printable-invoice-root"
      className={`font-sans text-slate-900 bg-white select-none ${
        isA5 ? 'p-4 text-xs max-w-[210mm]' : 'p-8 text-sm max-w-[210mm]'
      } mx-auto`}
      style={{
        boxSizing: 'border-box',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
    >
      {/* Top Banner & Corporate Header */}
      <div className="border-b-2 border-slate-900 pb-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-serif font-black text-xl shadow-xs">
                ℞
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-950 uppercase">
                  {orgInfo.name}
                </h1>
                <p className="text-xs font-semibold text-emerald-800 tracking-wide">
                  {orgInfo.subtitle}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-1">{orgInfo.branch}</p>
            <p className="text-xs text-slate-600">{orgInfo.address}</p>
            <div className="flex items-center gap-3 text-xs text-slate-600 mt-0.5">
              <span><strong>Helpline:</strong> {orgInfo.contactNo}</span>
              <span>•</span>
              <span><strong>Email:</strong> {orgInfo.email}</span>
            </div>
          </div>

          <div className="text-right">
            <div className="inline-block px-3 py-1 bg-slate-900 text-white rounded-md text-xs font-extrabold uppercase tracking-wider mb-1.5">
              TAX INVOICE / CASH MEMO
            </div>
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wide">
              {copyLabel}
            </div>
            <div className="mt-2 text-xs space-y-0.5 text-slate-700">
              <p><strong>Drug License:</strong> {orgInfo.drugLicenseNo}</p>
              <p><strong>VAT Reg / BIN:</strong> {orgInfo.vatRegNo}</p>
              <p><strong>Tax ID:</strong> {orgInfo.tinNo}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Metadata 2-Column Card Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
        {/* Invoice & Dispensary Info */}
        <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/70 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Invoice Number:</span>
            <span className="font-mono font-bold text-slate-900 text-sm">#{sale.invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Date & Time:</span>
            <span className="font-semibold text-slate-800">{formattedDateTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Dispensing Pharmacist:</span>
            <span className="font-semibold text-slate-800">{sale.cashierName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Payment Mode:</span>
            <span className="font-bold text-emerald-800 uppercase">{paymentMethodLabel}</span>
          </div>
        </div>

        {/* Customer & Prescriber Info */}
        <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/70 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Customer / Patient:</span>
            <span className="font-bold text-slate-900">{sale.customerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Contact Phone:</span>
            <span className="font-semibold text-slate-800">{sale.customerPhone || 'Walk-In Customer'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Prescribing Doctor:</span>
            <span className="font-semibold text-slate-800">{sale.doctorName || 'Self / OTC Recommendation'}</span>
          </div>
          {sale.prescriptionId && (
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Prescription Ref:</span>
              <span className="font-mono font-bold text-slate-800">{sale.prescriptionId}</span>
            </div>
          )}
        </div>
      </div>

      {/* Itemized Table (Strict Page Break Avoidance) */}
      <div className="mb-4">
        <table className="w-full border-collapse border border-slate-300 text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-800 uppercase font-bold text-[11px] border-b border-slate-300">
              <th className="border border-slate-300 p-2 text-center w-8">#</th>
              <th className="border border-slate-300 p-2 text-left">Medicine Description & Strength</th>
              <th className="border border-slate-300 p-2 text-center">Batch No</th>
              <th className="border border-slate-300 p-2 text-center">Exp Date</th>
              <th className="border border-slate-300 p-2 text-center">Unit / Pack</th>
              <th className="border border-slate-300 p-2 text-center">Qty</th>
              <th className="border border-slate-300 p-2 text-right">Unit MRP</th>
              <th className="border border-slate-300 p-2 text-center">Disc %</th>
              <th className="border border-slate-300 p-2 text-center">VAT %</th>
              <th className="border border-slate-300 p-2 text-right">Net Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, idx) => {
              const unitType = item.unitType === 'box' ? 'Box' : 'Pcs';
              return (
                <tr
                  key={idx}
                  className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} border-b border-slate-300`}
                  style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                >
                  <td className="border border-slate-300 p-2 text-center font-mono text-slate-500">{idx + 1}</td>
                  <td className="border border-slate-300 p-2">
                    <div className="font-bold text-slate-900">{item.medicineName}</div>
                    {item.genericName && (
                      <div className="text-[10px] text-slate-500 italic">{item.genericName}</div>
                    )}
                  </td>
                  <td className="border border-slate-300 p-2 text-center font-mono font-semibold text-slate-800">
                    {item.batchNumber}
                  </td>
                  <td className="border border-slate-300 p-2 text-center font-mono text-slate-700">
                    {item.expiryDate}
                  </td>
                  <td className="border border-slate-300 p-2 text-center text-slate-600">
                    {unitType}
                  </td>
                  <td className="border border-slate-300 p-2 text-center font-bold text-slate-900 font-mono">
                    {item.quantity}
                  </td>
                  <td className="border border-slate-300 p-2 text-right font-mono text-slate-700">
                    {fmtCurr(item.unitPrice)}
                  </td>
                  <td className="border border-slate-300 p-2 text-center font-mono text-slate-600">
                    {item.discountPercent > 0 ? `${item.discountPercent}%` : '0%'}
                  </td>
                  <td className="border border-slate-300 p-2 text-center font-mono text-slate-600">
                    {item.taxRate > 0 ? `${item.taxRate}%` : '0%'}
                  </td>
                  <td className="border border-slate-300 p-2 text-right font-mono font-bold text-slate-900">
                    {fmtCurr(item.total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Financial Totals & Split Breakdown Section */}
      <div
        className="grid grid-cols-12 gap-4 mb-4"
        style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
      >
        {/* Left column: Split breakdown & In Words */}
        <div className="col-span-7 space-y-3">
          {/* Split Payment Breakdown */}
          {sale.paymentMethod === 'split' && sale.splitDetails && (
            <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50/60 text-xs">
              <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1.5 flex items-center gap-1.5">
                <span>Multi-Tender Payment Settlement</span>
              </h4>
              <div className="space-y-1 text-slate-700">
                {(sale.splitDetails.cashAmount || 0) > 0 && (
                  <div className="flex justify-between font-mono">
                    <span>• Cash Drawer Settlement:</span>
                    <span className="font-bold">{fmtCurr(sale.splitDetails.cashAmount || 0)}</span>
                  </div>
                )}
                {(sale.splitDetails.mobileAmount || 0) > 0 && (
                  <div className="flex justify-between font-mono">
                    <span>
                      • {sale.splitDetails.mobileProvider || 'bKash'} Digital Wallet
                      {sale.splitDetails.mobileTrxId && ` (TrxID: ${sale.splitDetails.mobileTrxId})`}:
                    </span>
                    <span className="font-bold">{fmtCurr(sale.splitDetails.mobileAmount || 0)}</span>
                  </div>
                )}
                {(sale.splitDetails.cardAmount || 0) > 0 && (
                  <div className="flex justify-between font-mono">
                    <span>
                      • POS Terminal Card ({sale.splitDetails.cardType || 'Visa'}
                      {sale.splitDetails.cardAuthCode && ` - Auth: ${sale.splitDetails.cardAuthCode}`}):
                    </span>
                    <span className="font-bold">{fmtCurr(sale.splitDetails.cardAmount || 0)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Regulatory Quality Guarantee Pill */}
          <div className="border border-emerald-300 bg-emerald-50/60 rounded-lg p-2.5 text-xs text-emerald-950 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-emerald-800 uppercase tracking-wide text-[10.5px]">
              <span>✓ Quality Assured & FEFO Compliant Dispensation</span>
            </div>
            <p className="text-[11px] text-emerald-900 leading-snug">
              Every pharmaceutical item is tracked against DGDA regulatory batch registers. All cold-chain products are maintained between 2°C and 8°C under continuous monitoring.
            </p>
          </div>
        </div>

        {/* Right column: Summary Ledger */}
        <div className="col-span-5">
          <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/70 text-xs space-y-1.5">
            <div className="flex justify-between text-slate-600">
              <span>Gross Subtotal:</span>
              <span className="font-mono font-semibold">{fmtCurr(sale.subtotal)}</span>
            </div>
            {sale.discountTotal > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Special Discount:</span>
                <span className="font-mono font-semibold">-{fmtCurr(sale.discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Applicable VAT / Tax:</span>
              <span className="font-mono font-semibold">{fmtCurr(sale.taxTotal)}</span>
            </div>

            <div className="border-t-2 border-slate-900 pt-2 mt-1 flex justify-between items-baseline text-slate-950">
              <span className="text-sm font-extrabold uppercase tracking-wide">Net Payable:</span>
              <span className="text-xl font-black font-mono text-emerald-700">
                {fmtCurr(sale.grandTotal)}
              </span>
            </div>

            <div className="border-t border-slate-200 pt-1.5 space-y-1 text-slate-700">
              <div className="flex justify-between">
                <span>Amount Paid:</span>
                <span className="font-mono font-bold">{fmtCurr(totalPaid)}</span>
              </div>
              {changeDue > 0 && (
                <div className="flex justify-between text-slate-900 font-bold">
                  <span>Change Returned:</span>
                  <span className="font-mono">{fmtCurr(changeDue)}</span>
                </div>
              )}
              {balanceDue > 0 && (
                <div className="flex justify-between text-red-600 font-bold">
                  <span>Balance Due:</span>
                  <span className="font-mono">{fmtCurr(balanceDue)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer & Compliance Section */}
      <div
        className="border-t-2 border-slate-900 pt-3 mt-4 space-y-3"
        style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
      >
        <div className="flex justify-between items-end gap-4">
          {/* Barcode & Verification QR */}
          <div className="flex items-center gap-4">
            {showBarcode && (
              <div>
                <SvgBarcode value={sale.invoiceNumber} width={180} height={42} showText={true} />
              </div>
            )}
            {showQrCode && (
              <div className="flex items-center gap-2 border border-slate-300 p-1.5 rounded-md bg-white">
                <SvgQrCode value={qrVerificationPayload} size={50} />
                <div className="text-[10px] text-slate-600 leading-tight">
                  <p className="font-bold text-slate-800">Scan for Verification</p>
                  <p>Fast Return & Audit</p>
                  <p className="font-mono text-[9px]">#{sale.invoiceNumber}</p>
                </div>
              </div>
            )}
          </div>

          {/* Pharmacist Signature & Stamp Box */}
          <div className="text-right">
            <div className="inline-block border-t border-slate-400 pt-1 text-center min-w-[160px]">
              <p className="font-bold text-xs text-slate-900">{sale.cashierName}</p>
              <p className="text-[10px] text-slate-500">Registered Pharmacist / Officer</p>
              <p className="text-[9px] text-slate-400">Authorized Signatory & Seal</p>
            </div>
          </div>
        </div>

        {/* Regulatory Disclaimers */}
        <div className="border-t border-dashed border-slate-300 pt-2 text-[10px] text-slate-600 leading-relaxed space-y-0.5">
          <p className="font-bold text-slate-800">MANDATORY PHARMACY TERMS & CONDITIONS:</p>
          <p>
            1. Goods once sold cannot be returned without original receipt. Sold medicines must be returned within 7 days.
          </p>
          <p>
            2. <strong>Storage Instruction:</strong> Keep out of reach of children. Store below 30°C in a dry place away from direct sunlight.
          </p>
          <p>
            3. Cold-chain items (biologicals, vaccines, insulin) are strictly non-returnable and non-refundable once dispended from dispensary refrigerators.
          </p>
          <p className="text-[9px] text-slate-500 pt-0.5">
            This is a computer generated tax invoice. Generated on {formattedDateTime} • MADINA PHARMACEUTICALS & EYE HOSPITAL LTD.
          </p>
        </div>
      </div>
    </div>
  );
};
