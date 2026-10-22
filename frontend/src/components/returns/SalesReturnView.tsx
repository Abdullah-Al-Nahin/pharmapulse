import React, { useState } from 'react';
import {
  RotateCcw,
  Search,
  Plus,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Layers,
  X,
  ArrowRight,
  Printer,
  Receipt,
  Truck,
  ShieldCheck,
  CreditCard,
  Barcode,
  PackageX,
  HelpCircle,
  Eye,
  Check,
  Calendar,
  Sparkles,
} from 'lucide-react';
import {
  SaleReturn,
  ReturnItem,
  Sale,
  Supplier,
} from '../../types/pharmacy';
import {
  PurchaseReturnRecord,
  CreditNoteRecord,
} from '../../types/pharmapulse';
import { PharmacyService } from '../../services/pharmacyService';
import { useAuth } from '../../context/AuthContext';

interface SalesReturnViewProps {
  onDataChanged?: () => void;
}

export const SalesReturnView: React.FC<SalesReturnViewProps> = ({
  onDataChanged,
}) => {
  // Main view tab: 'sales_returns' | 'purchase_returns' | 'credit_notes'
  const [activeTab, setActiveTab] = useState<'sales_returns' | 'purchase_returns' | 'credit_notes'>('sales_returns');

  // Sales Returns Data
  const [returns, setReturns] = useState<SaleReturn[]>(() => PharmacyService.getReturns());
  const [sales] = useState<Sale[]>(() => PharmacyService.getSales());
  const [searchSales, setSearchSales] = useState('');

  // Purchase Returns Data
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturnRecord[]>([]);
  const [searchPurchaseReturns, setSearchPurchaseReturns] = useState('');

  // Credit Notes Data
  const [creditNotes, setCreditNotes] = useState<CreditNoteRecord[]>([]);

  // ------------------------------------
  // Sales Return Modal State
  // ------------------------------------
  const [showSalesReturnModal, setShowSalesReturnModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<string>('');
  const [isFullReturn, setIsFullReturn] = useState(false);
  const [returnItems, setReturnItems] = useState<
    (ReturnItem & { isBatchVerified?: boolean; selected?: boolean })[]
  >([]);
  const [salesRefundMethod, setSalesRefundMethod] = useState<
    'cash' | 'original_payment' | 'store_credit' | 'mfs_bkash'
  >('cash');
  const [mfsTrxId, setMfsTrxId] = useState('');
  const [salesReturnNotes, setSalesReturnNotes] = useState('');

  // ------------------------------------
  // Purchase Return Modal State
  // ------------------------------------
  const { currentUser } = useAuth();
  const currentUserName = currentUser?.name
    ? `${currentUser.name} (${currentUser.roleName || 'Duty Pharmacist'})`
    : 'Duty Pharmacist';

  const [showPurchaseReturnModal, setShowPurchaseReturnModal] = useState(false);
  const [prSupplier, setPrSupplier] = useState('');
  const [prInvoiceOrGrn, setPrInvoiceOrGrn] = useState('');
  const [prReturnType, setPrReturnType] = useState<
    'expiry_return' | 'damaged_return' | 'recall_return' | 'excess_return'
  >('expiry_return');
  const [prCreditAdjType, setPrCreditAdjType] = useState<
    'deduct_payable' | 'bank_refund' | 'replacement_stock'
  >('deduct_payable');
  const [prDrugName, setPrDrugName] = useState('');
  const [prBatchNo, setPrBatchNo] = useState('');
  const [prExpiryDate, setPrExpiryDate] = useState('');
  const [prQty, setPrQty] = useState(1);
  const [prUnitPrice, setPrUnitPrice] = useState(0);
  const [prCondition, setPrCondition] = useState<
    'sealed_expired' | 'damaged_vial' | 'leaked_blister' | 'defective_packaging'
  >('sealed_expired');
  const [prNotes, setPrNotes] = useState('');

  // Detail / Print Modal State
  const [viewingCreditNote, setViewingCreditNote] = useState<CreditNoteRecord | null>(null);
  const [viewingPurchaseReturn, setViewingPurchaseReturn] = useState<PurchaseReturnRecord | null>(null);

  // ------------------------------------
  // Sales Return Logic
  // ------------------------------------
  const handleSelectInvoice = (invNum: string) => {
    setSelectedInvoice(invNum);
    const sale = sales.find((s) => s.invoiceNumber === invNum);
    if (sale) {
      const items = sale.items.map((it) => ({
        medicineId: it.medicineId,
        medicineName: it.medicineName,
        batchId: it.batchId,
        batchNumber: it.batchNumber,
        expiryDate: it.expiryDate,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        refundAmount: it.quantity * it.unitPrice,
        reason: 'doctor_changed' as const,
        action: 'restock' as const,
        isBatchVerified: true,
        selected: true,
      }));
      setReturnItems(items);
      setIsFullReturn(true);
    }
  };

  const toggleFullReturn = (full: boolean) => {
    setIsFullReturn(full);
    const sale = sales.find((s) => s.invoiceNumber === selectedInvoice);
    if (!sale) return;

    if (full) {
      setReturnItems((prev) =>
        prev.map((it, idx) => {
          const orig = sale.items[idx];
          const maxQ = orig ? orig.quantity : it.quantity;
          return {
            ...it,
            selected: true,
            quantity: maxQ,
            refundAmount: maxQ * it.unitPrice,
          };
        })
      );
    }
  };

  const updateItemQty = (index: number, newQty: number) => {
    const sale = sales.find((s) => s.invoiceNumber === selectedInvoice);
    const maxQty = sale?.items[index]?.quantity || 1;
    const clamped = Math.max(0, Math.min(maxQty, newQty));

    setReturnItems((prev) =>
      prev.map((it, idx) => {
        if (idx === index) {
          return {
            ...it,
            quantity: clamped,
            refundAmount: clamped * it.unitPrice,
            selected: clamped > 0,
          };
        }
        return it;
      })
    );
    setIsFullReturn(false);
  };

  const updateItemReason = (index: number, reason: any) => {
    setReturnItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, reason } : it))
    );
  };

  const updateItemAction = (index: number, action: 'restock' | 'quarantine') => {
    setReturnItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, action } : it))
    );
  };

  const handleConfirmSalesReturn = (e: React.FormEvent) => {
    e.preventDefault();
    const activeItems = returnItems.filter((it) => it.selected && it.quantity > 0);
    if (activeItems.length === 0) {
      alert('Please select at least 1 item with quantity > 0.');
      return;
    }

    const sale = sales.find((s) => s.invoiceNumber === selectedInvoice);
    const totalRefund = activeItems.reduce((acc, it) => acc + it.refundAmount, 0);
    const returnNumber = `RET-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    // Create return record
    const retRecord: SaleReturn = {
      id: `ret-${Date.now()}`,
      returnNumber,
      originalInvoiceNumber: selectedInvoice,
      originalSaleId: sale?.id || 'sale-unknown',
      date: new Date().toISOString().split('T')[0],
      customerName: sale?.customerName || 'Customer',
      items: activeItems.map(({ isBatchVerified, selected, ...rest }) => rest),
      totalRefund,
      refundMethod: salesRefundMethod === 'mfs_bkash' ? 'original_payment' : salesRefundMethod,
      notes: salesReturnNotes || (isFullReturn ? 'Full Invoice Return' : 'Partial Return'),
      processedBy: currentUserName,
    };

    PharmacyService.processReturn(retRecord);
    setReturns([retRecord, ...returns]);

    // If customer selected Credit Note, issue verifiable Credit Note
    if (salesRefundMethod === 'store_credit') {
      const cnNumber = `CN-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const newCreditNote: CreditNoteRecord = {
        id: `cn-${Date.now()}`,
        creditNoteNumber: cnNumber,
        originalInvoiceNumber: selectedInvoice,
        customerName: sale?.customerName || 'Customer',
        customerPhone: sale?.customerPhone || '',
        issuedDate: new Date().toISOString().split('T')[0],
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        totalAmount: totalRefund,
        remainingBalance: totalRefund,
        status: 'ACTIVE',
        barcode: `${cnNumber.replace(/-/g, '')}`,
        issuedBy: currentUserName,
        notes: `Issued against return ${returnNumber}. Valid for 90 days across all counters.`,
      };
      setCreditNotes([newCreditNote, ...creditNotes]);
      setViewingCreditNote(newCreditNote);
    }

    setShowSalesReturnModal(false);
    setSelectedInvoice('');
    setReturnItems([]);
    if (onDataChanged) onDataChanged();
  };

  // ------------------------------------
  // Purchase Return Logic
  // ------------------------------------
  const handleConfirmPurchaseReturn = (e: React.FormEvent) => {
    e.preventDefault();
    const totalVal = Number(prQty) * Number(prUnitPrice);
    const returnNumber = `PRT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const debitNoteNumber = `DN-2026-${Math.floor(100 + Math.random() * 900)}`;

    const newPrRecord: PurchaseReturnRecord = {
      id: `pret-${Date.now()}`,
      returnNumber,
      debitNoteNumber,
      supplierId: `sup-${Date.now()}`,
      supplierName: prSupplier,
      originalInvoiceOrGrn: prInvoiceOrGrn,
      date: new Date().toISOString().split('T')[0],
      returnType: prReturnType,
      creditAdjustmentType: prCreditAdjType,
      status: 'approved',
      totalAmount: totalVal,
      processedBy: currentUserName,
      notes: prNotes || `${prReturnType.replace('_', ' ').toUpperCase()} processed.`,
      items: [
        {
          medicineName: prDrugName,
          batchNumber: prBatchNo,
          expiryDate: prExpiryDate,
          quantity: Number(prQty),
          unitPurchasePrice: Number(prUnitPrice),
          totalAmount: totalVal,
          reason: prNotes || 'Distributor credit adjustment',
          condition: prCondition,
        },
      ],
    };

    setPurchaseReturns([newPrRecord, ...purchaseReturns]);
    setShowPurchaseReturnModal(false);
    setViewingPurchaseReturn(newPrRecord);
  };

  const filteredSalesReturns = returns.filter(
    (r) =>
      r.returnNumber.toLowerCase().includes(searchSales.toLowerCase()) ||
      r.originalInvoiceNumber.toLowerCase().includes(searchSales.toLowerCase()) ||
      r.customerName.toLowerCase().includes(searchSales.toLowerCase())
  );

  const filteredPurchaseReturns = purchaseReturns.filter(
    (r) =>
      r.returnNumber.toLowerCase().includes(searchPurchaseReturns.toLowerCase()) ||
      r.debitNoteNumber.toLowerCase().includes(searchPurchaseReturns.toLowerCase()) ||
      r.supplierName.toLowerCase().includes(searchPurchaseReturns.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-linear-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl text-white shadow-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              Institutional Reverse Logistics
            </span>
            <span className="text-xs text-slate-300">
              Batch Verification &amp; Stock Reconciliation
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Returns, Refunds &amp; Credit Notes (Sales &amp; Purchase)
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl">
            Seamlessly execute Full or Partial Sales Returns, Batch Validation, Cash/MFS/Credit Note Refunds, and Supplier Purchase Returns with automatic Debit Note adjustments.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowPurchaseReturnModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-600 transition-all cursor-pointer"
          >
            <Truck className="w-4 h-4 text-indigo-400" />
            Supplier Purchase Return
          </button>

          <button
            onClick={() => setShowSalesReturnModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Process Sales Return
          </button>
        </div>
      </div>

      {/* View Switcher: Sales Returns vs Purchase Returns vs Credit Notes */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('sales_returns')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'sales_returns'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            Sales Returns &amp; Patient Refunds
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px]">
              {returns.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('purchase_returns')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'purchase_returns'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Truck className="w-4 h-4" />
            Purchase Returns (Supplier Debit Notes)
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[10px]">
              {purchaseReturns.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('credit_notes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'credit_notes'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Barcode className="w-4 h-4" />
            Customer Credit Notes (Store Credit)
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px]">
              {creditNotes.filter((c) => c.status === 'ACTIVE').length} Active
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: Sales Returns & Patient Refunds */}
      {activeTab === 'sales_returns' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchSales}
                onChange={(e) => setSearchSales(e.target.value)}
                placeholder="Search Return #, Invoice #, or Patient Name..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div className="text-xs text-slate-500">
              Total Refunds Issued:{' '}
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                ৳{returns.reduce((a, b) => a + b.totalRefund, 0).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Return Note #</th>
                    <th className="py-3 px-4">Original Invoice</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Returned Items &amp; Batch</th>
                    <th className="py-3 px-4">Refund Mode</th>
                    <th className="py-3 px-4 text-right">Refund Amount</th>
                    <th className="py-3 px-4">Action Taken</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredSalesReturns.map((ret) => (
                    <tr
                      key={ret.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {ret.returnNumber}
                        <div className="text-[10px] text-slate-400 font-normal">
                          {ret.date}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        {ret.originalInvoiceNumber}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {ret.customerName}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          By: {ret.processedBy}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {ret.items.map((it, idx) => (
                            <div key={idx} className="font-medium text-slate-800 dark:text-slate-200">
                              {it.medicineName}{' '}
                              <span className="text-slate-400 font-normal font-mono text-[11px]">
                                ({it.quantity}x • Batch: {it.batchNumber})
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            ret.refundMethod === 'cash'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : ret.refundMethod === 'store_credit'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          }`}
                        >
                          {ret.refundMethod === 'store_credit'
                            ? 'Credit Note (CN)'
                            : ret.refundMethod.toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white text-sm">
                        ৳{ret.totalRefund.toFixed(2)}
                      </td>

                      <td className="py-3 px-4">
                        {ret.items.some((it) => it.action === 'restock') ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Restocked to Shelf
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Quarantined / Scrap
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

      {/* TAB 2: Purchase Returns (Supplier Debit Notes) */}
      {activeTab === 'purchase_returns' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchPurchaseReturns}
                onChange={(e) => setSearchPurchaseReturns(e.target.value)}
                placeholder="Search Return #, Debit Note #, or Supplier..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div className="text-xs text-slate-500">
              Total Supplier Credits Adjusted:{' '}
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                ৳{purchaseReturns.reduce((a, b) => a + b.totalAmount, 0).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Debit Note # / PRT</th>
                    <th className="py-3 px-4">Supplier &amp; Source</th>
                    <th className="py-3 px-4">Returned Medicines &amp; Batch</th>
                    <th className="py-3 px-4">Return Classification</th>
                    <th className="py-3 px-4">Credit Adjustment Mode</th>
                    <th className="py-3 px-4 text-right">Debit Note Value</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Voucher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredPurchaseReturns.map((pr) => (
                    <tr
                      key={pr.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-indigo-600 dark:text-indigo-400">
                          {pr.debitNoteNumber}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          PRT: {pr.returnNumber}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {pr.date}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {pr.supplierName}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {pr.originalInvoiceOrGrn}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {pr.items.map((it, idx) => (
                            <div key={idx} className="font-medium text-slate-800 dark:text-slate-200">
                              {it.medicineName}{' '}
                              <span className="text-slate-400 font-normal font-mono text-[11px]">
                                ({it.quantity}x • Batch: {it.batchNumber} • Exp: {it.expiryDate})
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            pr.returnType === 'expiry_return'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : pr.returnType === 'damaged_return'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                          }`}
                        >
                          {pr.returnType.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {pr.creditAdjustmentType === 'deduct_payable'
                          ? 'Deduct from Monthly Payable'
                          : pr.creditAdjustmentType === 'replacement_stock'
                          ? 'Replacement Stock from Distributor'
                          : 'Bank / Cheque Refund'}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white text-sm">
                        ৳{pr.totalAmount.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {pr.status.toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setViewingPurchaseReturn(pr)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title="View Debit Note"
                        >
                          <Eye className="w-4 h-4" />
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

      {/* TAB 3: Customer Credit Notes */}
      {activeTab === 'credit_notes' && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-4 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Barcode className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Store Credit Notes</strong> can be scanned or entered during POS Checkout to deduct bill amount directly. Each voucher carries a 90-day validity and security PIN.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {creditNotes.map((cn) => (
              <div
                key={cn.id}
                className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Credit Note Voucher
                    </span>
                    <h3 className="font-mono font-black text-lg text-slate-900 dark:text-white">
                      {cn.creditNoteNumber}
                    </h3>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      cn.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {cn.status}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Customer:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {cn.customerName} ({cn.customerPhone})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Original Invoice:</span>
                    <span className="font-mono text-emerald-600">
                      {cn.originalInvoiceNumber}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Issued On:</span>
                    <span className="font-mono">{cn.issuedDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Valid Until:</span>
                    <span className="font-mono font-semibold text-rose-600">
                      {cn.expiryDate}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">
                      Remaining Balance
                    </span>
                    <span className="font-mono text-xl font-black text-emerald-600 dark:text-emerald-400">
                      ৳{cn.remainingBalance.toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={() => setViewingCreditNote(cn)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Voucher
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: Process Sales Return */}
      {showSalesReturnModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Process Sales Return &amp; Customer Refund
                </h3>
              </div>
              <button
                onClick={() => setShowSalesReturnModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmSalesReturn} className="space-y-4">
              {/* Select Invoice */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Original Sale Invoice #
                </label>
                <select
                  value={selectedInvoice}
                  onChange={(e) => handleSelectInvoice(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="">-- Choose an Invoice to Return --</option>
                  {sales.map((s) => (
                    <option key={s.id} value={s.invoiceNumber}>
                      {s.invoiceNumber} — {s.customerName} (৳{(s.grandTotal ?? 0).toFixed(2)} • {s.date})
                    </option>
                  ))}
                </select>
              </div>

              {selectedInvoice && (
                <>
                  {/* Full Return vs Partial Return Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white block">
                        Return Scope Mode
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Choose whether to return the complete invoice or specific items
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleFullReturn(true)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          isFullReturn
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        Full Return (Entire Bill)
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFullReturn(false)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          !isFullReturn
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        Partial Return (Custom Qty)
                      </button>
                    </div>
                  </div>

                  {/* Return Items Selection Table */}
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase text-[10px]">
                        <tr>
                          <th className="p-2.5">Medicine</th>
                          <th className="p-2.5">Batch &amp; Validation</th>
                          <th className="p-2.5 text-center">Return Qty</th>
                          <th className="p-2.5">Return Reason</th>
                          <th className="p-2.5">Stock Action</th>
                          <th className="p-2.5 text-right">Refund</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-900 dark:text-slate-200">
                        {returnItems.map((item, idx) => (
                          <tr key={idx} className={item.quantity === 0 ? 'opacity-40' : ''}>
                            <td className="p-2.5 font-medium">
                              {item.medicineName}
                            </td>

                            <td className="p-2.5 font-mono">
                              <span className="font-semibold">{item.batchNumber}</span>
                              <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
                                <CheckCircle2 className="w-3 h-3" />
                                Batch Verified (Authentic)
                              </div>
                            </td>

                            <td className="p-2.5 text-center">
                              <input
                                type="number"
                                min={0}
                                value={item.quantity}
                                onChange={(e) => updateItemQty(idx, Number(e.target.value))}
                                className="w-16 p-1 text-center rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono font-bold"
                              />
                            </td>

                            <td className="p-2.5">
                              <select
                                value={item.reason}
                                onChange={(e) => updateItemReason(idx, e.target.value)}
                                className="p-1 rounded text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                              >
                                <option value="doctor_changed">Doctor Changed Drug</option>
                                <option value="adverse_reaction">Adverse Reaction / Side Effects</option>
                                <option value="wrong_item">Dispensing Error / Wrong Item</option>
                                <option value="customer_cancelled">Excess Medicine (Course Complete)</option>
                                <option value="other">Damaged Foil / Broken Ampoule</option>
                              </select>
                            </td>

                            <td className="p-2.5">
                              <select
                                value={item.action}
                                onChange={(e) =>
                                  updateItemAction(idx, e.target.value as 'restock' | 'quarantine')
                                }
                                className={`p-1 rounded text-xs font-semibold ${
                                  item.action === 'restock'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                                }`}
                              >
                                <option value="restock">Restock to Shelf (Sealed)</option>
                                <option value="quarantine">Quarantine Bin (Damaged/Opened)</option>
                              </select>
                            </td>

                            <td className="p-2.5 text-right font-mono font-bold">
                              ৳{item.refundAmount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Refund Method & Credit Note Options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Refund Method
                      </label>
                      <select
                        value={salesRefundMethod}
                        onChange={(e) =>
                          setSalesRefundMethod(
                            e.target.value as 'cash' | 'original_payment' | 'store_credit' | 'mfs_bkash'
                          )
                        }
                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                      >
                        <option value="cash">Instant Cash Refund (Drawer)</option>
                        <option value="store_credit">
                          Issue Store Credit Note (CN Voucher - Redeemable in POS)
                        </option>
                        <option value="mfs_bkash">bKash / Nagad Instant Send-Money</option>
                        <option value="original_payment">Original Payment Reversal (Card / POS)</option>
                      </select>
                    </div>

                    {salesRefundMethod === 'mfs_bkash' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          bKash / Nagad TrxID
                        </label>
                        <input
                          type="text"
                          value={mfsTrxId}
                          onChange={(e) => setMfsTrxId(e.target.value)}
                          placeholder="e.g. 9J8812AXQ"
                          required
                          className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Return Notes / Pharmacist Remarks
                    </label>
                    <input
                      type="text"
                      value={salesReturnNotes}
                      onChange={(e) => setSalesReturnNotes(e.target.value)}
                      placeholder="e.g. Blister seal inspected under magnifying lamp; verified tamper-free."
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Summary & Submit */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-900">
                    <div>
                      <span className="text-xs text-slate-500">Total Refund Payable:</span>
                      <span className="ml-2 font-mono text-xl font-black text-emerald-600 dark:text-emerald-400">
                        ৳
                        {returnItems
                          .filter((it) => it.selected)
                          .reduce((a, b) => a + b.refundAmount, 0)
                          .toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowSalesReturnModal(false)}
                        className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        Confirm &amp; Issue Refund
                      </button>
                    </div>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Process Supplier Purchase Return */}
      {showPurchaseReturnModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Issue Supplier Purchase Return &amp; Debit Note
                </h3>
              </div>
              <button
                onClick={() => setShowPurchaseReturnModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPurchaseReturn} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Select Supplier / Distributor
                  </label>
                  <select
                    value={prSupplier}
                    onChange={(e) => setPrSupplier(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="Square Pharmaceuticals Ltd.">Square Pharmaceuticals Ltd.</option>
                    <option value="Beximco Pharmaceuticals Ltd.">Beximco Pharmaceuticals Ltd.</option>
                    <option value="Incepta Pharmaceuticals Ltd.">Incepta Pharmaceuticals Ltd.</option>
                    <option value="Healthcare Pharmaceuticals Ltd.">Healthcare Pharmaceuticals Ltd.</option>
                    <option value="Renata Limited">Renata Limited</option>
                    <option value="Aristopharma Ltd. (Ophthalmic)">Aristopharma Ltd. (Ophthalmic)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Original Invoice / GRN Reference
                  </label>
                  <input
                    type="text"
                    value={prInvoiceOrGrn}
                    onChange={(e) => setPrInvoiceOrGrn(e.target.value)}
                    required
                    placeholder="e.g. GRN-2026-0551 (Inv #SQ-881)"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Return Classification
                  </label>
                  <select
                    value={prReturnType}
                    onChange={(e) => setPrReturnType(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="expiry_return">Expiry Return (Near Expiry buffer)</option>
                    <option value="damaged_return">Damaged in Transit / Leaking</option>
                    <option value="recall_return">DGDA Quality Recall</option>
                    <option value="excess_return">Excess / Over-Shipment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Credit Adjustment Mode
                  </label>
                  <select
                    value={prCreditAdjType}
                    onChange={(e) => setPrCreditAdjType(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="deduct_payable">Deduct from Supplier Payable Ledger</option>
                    <option value="replacement_stock">Replacement Stock Delivery</option>
                    <option value="bank_refund">Bank / Cheque Refund</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Medicine / Drug Name
                  </label>
                  <input
                    type="text"
                    value={prDrugName}
                    onChange={(e) => setPrDrugName(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Batch Number
                  </label>
                  <input
                    type="text"
                    value={prBatchNo}
                    onChange={(e) => setPrBatchNo(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="text"
                    value={prExpiryDate}
                    onChange={(e) => setPrExpiryDate(e.target.value)}
                    required
                    placeholder="MM/YYYY"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Return Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={prQty}
                    onChange={(e) => setPrQty(Number(e.target.value))}
                    required
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Unit Purchase Price (৳)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={prUnitPrice}
                    onChange={(e) => setPrUnitPrice(Number(e.target.value))}
                    required
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Physical Condition of Item
                </label>
                <select
                  value={prCondition}
                  onChange={(e) => setPrCondition(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                >
                  <option value="sealed_expired">Sealed Original Blister / Bottle (Expired)</option>
                  <option value="damaged_vial">Cracked / Broken Glass Ampoule / Bottle</option>
                  <option value="leaked_blister">Crushed or Leaking Blister Foils</option>
                  <option value="defective_packaging">Defective Seal / Unprinted Batch</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason &amp; Distributor Representative Contact
                </label>
                <input
                  type="text"
                  value={prNotes}
                  onChange={(e) => setPrNotes(e.target.value)}
                  placeholder="e.g. Handed over to Area Sales Officer. Debit Note generated."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Total Debit Note Value */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Debit Note Adjustment:
                  </span>
                  <div className="font-mono text-xl font-black text-indigo-700 dark:text-indigo-300">
                    ৳{(Number(prQty) * Number(prUnitPrice)).toFixed(2)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPurchaseReturnModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Generate Debit Note
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Printable Customer Credit Note Voucher */}
      {viewingCreditNote && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <Barcode className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Official Store Credit Voucher
                </h3>
              </div>
              <button
                onClick={() => setViewingCreditNote(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl border border-dashed border-emerald-500/60 bg-emerald-50/40 dark:bg-emerald-950/20 text-center space-y-2">
              <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                PharmaPulse OS Enterprise
              </div>
              <h2 className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                {viewingCreditNote.creditNoteNumber}
              </h2>
              <div className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                ৳{viewingCreditNote.remainingBalance.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-500">
                Bearer: <strong>{viewingCreditNote.customerName}</strong>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Valid until {viewingCreditNote.expiryDate} (90 Days)
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold hover:bg-slate-200 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print Voucher
              </button>
              <button
                onClick={() => setViewingCreditNote(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Printable Supplier Debit Note Voucher */}
      {viewingPurchaseReturn && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Supplier Debit Note #{viewingPurchaseReturn.debitNoteNumber}
                </h3>
              </div>
              <button
                onClick={() => setViewingPurchaseReturn(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Supplier:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {viewingPurchaseReturn.supplierName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Return Type:</span>
                <span className="font-bold uppercase text-amber-600">
                  {viewingPurchaseReturn.returnType.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Adjustment Mode:</span>
                <span className="text-slate-800 dark:text-slate-200">
                  {viewingPurchaseReturn.creditAdjustmentType === 'deduct_payable'
                    ? 'Deduct from Monthly Payable Ledger'
                    : 'Replacement Stock'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Adjusted Amount:</span>
                <span className="font-mono text-lg font-black text-indigo-600">
                  ৳{viewingPurchaseReturn.totalAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold hover:bg-slate-200 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print Debit Note
              </button>
              <button
                onClick={() => setViewingPurchaseReturn(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
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
