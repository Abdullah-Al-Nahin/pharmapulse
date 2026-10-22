import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  X,
  CheckCircle2,
  FileText,
  Smartphone,
  Layers,
  Copy,
  Check,
  Eye,
  Settings2,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Barcode as BarcodeIcon,
  QrCode as QrCodeIcon,
  RotateCcw
} from 'lucide-react';
import { Sale } from '../../types/pharmacy';
import {
  InvoicePrintTemplate,
  InvoicePrintFormat,
  InvoiceCopyType,
  DEFAULT_PHARMACY_INFO
} from './InvoicePrintTemplate';
import {
  getCurrentLocale,
  formatCurrency,
  formatDate,
  toBanglaDigits,
  getLocalizedInvoiceLabels,
  getLocalizedPaymentMethodLabel
} from '../../utils/i18nFormatter';

interface ReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
  defaultFormat?: InvoicePrintFormat;
  autoPrint?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  onClose,
  defaultFormat = 'thermal_80mm',
  autoPrint = false
}) => {
  const [selectedFormat, setSelectedFormat] = useState<InvoicePrintFormat>(defaultFormat);
  const [selectedCopy, setSelectedCopy] = useState<InvoiceCopyType>('customer');
  const [printLocale, setPrintLocale] = useState<'en' | 'bn'>(() => getCurrentLocale());
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showBarcode, setShowBarcode] = useState<boolean>(true);
  const [showQrCode, setShowQrCode] = useState<boolean>(true);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);

  useEffect(() => {
    if (sale && autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [sale, autoPrint]);

  // Sync default format if prop updates
  useEffect(() => {
    if (defaultFormat) {
      setSelectedFormat(defaultFormat);
    }
  }, [defaultFormat]);

  // Keyboard shortcut listener (ESC to close, P / F10 to print)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'F10' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, selectedFormat]);

  if (!sale) return null;

  // Print handler with dynamic @page sizing injection
  const handlePrint = () => {
    window.print();
  };

  // Copy plain text receipt to clipboard
  const handleCopyText = () => {
    const lines: string[] = [
      `*** ${DEFAULT_PHARMACY_INFO.name} ***`,
      `${DEFAULT_PHARMACY_INFO.branch}`,
      `DL: ${DEFAULT_PHARMACY_INFO.drugLicenseNo} | VAT: ${DEFAULT_PHARMACY_INFO.vatRegNo}`,
      `----------------------------------------`,
      `INVOICE: #${sale.invoiceNumber}`,
      `Date: ${sale.date} ${sale.timestamp || ''}`,
      `Customer: ${sale.customerName} (${sale.customerPhone || 'Walk-In'})`,
      `Pharmacist: ${sale.cashierName}`,
      sale.doctorName ? `Doctor: ${sale.doctorName}` : '',
      `----------------------------------------`,
      `ITEMS & BATCH COMPLIANCE:`,
      ...sale.items.map(
        (it) =>
          `• ${it.medicineName} | B:${it.batchNumber} Exp:${it.expiryDate} | ${it.quantity} ${
            it.unitType || 'Pcs'
          } x $${it.unitPrice.toFixed(2)} = $${it.total.toFixed(2)}`
      ),
      `----------------------------------------`,
      `Subtotal: $${sale.subtotal.toFixed(2)}`,
      sale.discountTotal > 0 ? `Discount: -$${sale.discountTotal.toFixed(2)}` : '',
      `VAT / Tax: $${sale.taxTotal.toFixed(2)}`,
      `NET PAYABLE: $${sale.grandTotal.toFixed(2)}`,
      `Payment Mode: ${sale.paymentMethod.toUpperCase()}`,
      `----------------------------------------`,
      `Goods once sold cannot be returned without original receipt.`,
      `Store below 30°C. Keep away from children.`
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  // Determine media print @page CSS dynamically
  const getPageStyle = () => {
    switch (selectedFormat) {
      case 'thermal_58mm':
        return '@page { size: 58mm auto; margin: 0; }';
      case 'thermal_80mm':
        return '@page { size: 80mm auto; margin: 0; }';
      case 'standard_a5':
        return '@page { size: A5 landscape; margin: 8mm; }';
      case 'standard_a4':
      default:
        return '@page { size: A4 portrait; margin: 10mm 12mm; }';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      
      {/* Inject clean Print CSS rules for page breaks and dimensions */}
      <style>{`
        ${getPageStyle()}
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide all UI Chrome */
          body * {
            visibility: hidden;
          }
          /* Show ONLY the printable invoice root */
          #printable-invoice-container,
          #printable-invoice-container * {
            visibility: visible;
          }
          #printable-invoice-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          /* Crucial table page break rules */
          table {
            page-break-inside: auto !important;
            border-collapse: collapse !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          td, th {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
          .avoid-page-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Modal Card */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-5xl w-full flex flex-col max-h-[96vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-white">
        
        {/* ========================================================================= */}
        {/* 1. TOP TOOLBAR: Status, Format Selector, Copy, Actions                     */}
        {/* ========================================================================= */}
        <div className="print:hidden bg-slate-900 border-b border-slate-800 p-3 sm:px-5 sm:py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Left: Invoice status */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  Invoice #{sale.invoiceNumber}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {sale.paymentStatus.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {sale.date} • {sale.customerName} • ${sale.grandTotal.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Center: Format Switcher Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedFormat('thermal_80mm')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedFormat === 'thermal_80mm'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>80mm POS</span>
            </button>

            <button
              onClick={() => setSelectedFormat('thermal_58mm')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedFormat === 'thermal_58mm'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>58mm Mini</span>
            </button>

            <button
              onClick={() => setSelectedFormat('standard_a4')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedFormat === 'standard_a4'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>A4 Invoice</span>
            </button>

            <button
              onClick={() => setSelectedFormat('standard_a5')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedFormat === 'standard_a5'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>A5 Voucher</span>
            </button>
          </div>

          {/* Right: Print (F10) & Close */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-700/30 transition-all cursor-pointer active:scale-95"
              title="Print Invoice (F10 / Ctrl+P)"
            >
              <Printer className="w-4 h-4" />
              <span>Print (F10)</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Preview (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. SUB-BAR: Copy selection, Barcode toggle, Zoom Controls                 */}
        {/* ========================================================================= */}
        <div className="print:hidden bg-slate-950/60 border-b border-slate-800/80 px-4 py-2 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-3">
          {/* Copy Selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px]">Copy:</span>
              <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-0.5">
                {(['customer', 'store', 'accounts'] as InvoiceCopyType[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedCopy(c)}
                    className={`px-2 py-0.5 rounded text-[10.5px] font-medium capitalize transition-colors cursor-pointer ${
                      selectedCopy === c ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Language Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">Print Lang:</span>
              <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-0.5">
                <button
                  type="button"
                  onClick={() => setPrintLocale('en')}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-medium transition-colors cursor-pointer ${
                    printLocale === 'en' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setPrintLocale('bn')}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-medium transition-colors cursor-pointer ${
                    printLocale === 'bn' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  বাংলা
                </button>
              </div>
            </div>
          </div>

          {/* Toggles: Barcode, QR Code, Copy Text */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-slate-400 hover:text-white">
              <input
                type="checkbox"
                checked={showBarcode}
                onChange={(e) => setShowBarcode(e.target.checked)}
                className="rounded border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
              />
              <BarcodeIcon className="w-3.5 h-3.5" />
              <span>Barcode</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-slate-400 hover:text-white">
              <input
                type="checkbox"
                checked={showQrCode}
                onChange={(e) => setShowQrCode(e.target.checked)}
                className="rounded border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
              />
              <QrCodeIcon className="w-3.5 h-3.5" />
              <span>QR Code</span>
            </label>

            <div className="h-4 w-px bg-slate-800" />

            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoomLevel((z) => Math.max(75, z - 10))}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] text-slate-400 min-w-[36px] text-center">
                {zoomLevel}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-4 w-px bg-slate-800" />

            {/* Copy Plain Text */}
            <button
              onClick={handleCopyText}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] transition-colors cursor-pointer"
              title="Copy receipt summary as text"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Copied' : 'Copy Text'}</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. MAIN PREVIEW CANVAS: Rendered Invoice Inside Scrollable Viewport        */}
        {/* ========================================================================= */}
        <div className="flex-1 bg-slate-950 p-4 sm:p-8 overflow-y-auto flex items-start justify-center">
          <div
            id="printable-invoice-container"
            style={{
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease'
            }}
            className="shadow-2xl transition-all duration-150"
          >
            <div className="bg-white rounded-lg overflow-hidden border border-slate-200">
              <InvoicePrintTemplate
                sale={sale}
                format={selectedFormat}
                copyType={selectedCopy}
                showBarcode={showBarcode}
                showQrCode={showQrCode}
                locale={printLocale}
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. MODAL FOOTER: Printer Guides & Quick Next Sale                         */}
        {/* ========================================================================= */}
        <div className="print:hidden bg-slate-900 border-t border-slate-800 px-5 py-3 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-300">Format:</span>
            <span>
              {selectedFormat === 'thermal_80mm' && 'Standard 80mm (ESC/POS Continuous Roll)'}
              {selectedFormat === 'thermal_58mm' && 'Compact 58mm (Mobile / Bluetooth POS)'}
              {selectedFormat === 'standard_a4' && 'Standard A4 Laser / Inkjet Tax Invoice'}
              {selectedFormat === 'standard_a5' && 'A5 Half-Sheet Outpatient Voucher'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-slate-500">Press ESC to dismiss</span>
            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer"
            >
              Start Next Sale
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
