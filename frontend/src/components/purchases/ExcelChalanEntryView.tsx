import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  ClipboardPaste, 
  RefreshCw, 
  DollarSign, 
  Boxes, 
  Sparkles, 
  Truck, 
  Calendar, 
  Building, 
  HelpCircle,
  X,
  PackageCheck
} from 'lucide-react';
import { Medicine, Supplier, Batch, PurchaseOrder, PurchaseItem, SupplierLedgerEntry } from '../../types/pharmacy';
import { PharmacyService } from '../../services/pharmacyService';
import { batchApi, supplierApi } from '../../lib/api';

interface ExcelChalanEntryViewProps {
  onSuccess?: () => void;
  onNavigateToInventory?: () => void;
}

export interface ChalanRowState {
  id: string;
  medicineId: string;
  medicineName: string;
  genericName: string;
  dosageForm: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  chalanQuantity: number;
  freeBonusQuantity: number;
  unitPurchasePrice: number;
  mrp: number;
  taxRate: number;
  rackLocation: string;
}

export const ExcelChalanEntryView: React.FC<ExcelChalanEntryViewProps> = ({ 
  onSuccess,
  onNavigateToInventory 
}) => {
  const medicines = useMemo(() => PharmacyService.getMedicines(), []);
  const suppliers = useMemo(() => PharmacyService.getSuppliers(), []);

  // Header Chalan Metadata
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [chalanNumber, setChalanNumber] = useState<string>(`CHL-${Math.floor(100000 + Math.random() * 900000)}`);
  const [chalanDate, setChalanDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [receivingWarehouse, setReceivingWarehouse] = useState<string>('Main Central Pharmacy Depot');
  const [paymentType, setPaymentType] = useState<'credit' | 'cash' | 'bank'>('credit');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  // Default dates for new rows
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultExpStr = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);
    return d.toISOString().split('T')[0];
  }, []);

  // Spreadsheet Rows
  const createEmptyRow = (customMed?: Medicine): ChalanRowState => {
    const med = customMed || medicines[0];
    return {
      id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      medicineId: med?.id || '',
      medicineName: med?.name || '',
      genericName: med?.genericName || '',
      dosageForm: med?.dosageForm || 'Tablet',
      batchNumber: `B${Math.floor(10000 + Math.random() * 90000)}`,
      manufacturingDate: todayStr,
      expiryDate: defaultExpStr,
      chalanQuantity: 100,
      freeBonusQuantity: 0,
      unitPurchasePrice: 10.50,
      mrp: 12.00,
      taxRate: med?.taxRate || 0,
      rackLocation: med?.rackLocation || 'Rack A-01'
    };
  };

  const [rows, setRows] = useState<ChalanRowState[]>([
    createEmptyRow(medicines[0]),
    createEmptyRow(medicines[1] || medicines[0]),
    createEmptyRow(medicines[2] || medicines[0]),
  ]);

  // Paste from Excel Modal State
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteRawText, setPasteRawText] = useState('');

  // UI status / Alert
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    chalanNumber: string;
    supplierName: string;
    totalUnits: number;
    totalAmount: number;
    batchesCount: number;
  } | null>(null);

  // Handlers for Row edits
  const handleUpdateRow = (id: string, field: keyof ChalanRowState, value: any) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;

      const updated = { ...r, [field]: value };

      // If user selected a different medicine from catalog
      if (field === 'medicineId') {
        const found = medicines.find(m => m.id === value);
        if (found) {
          updated.medicineName = found.name;
          updated.genericName = found.genericName;
          updated.dosageForm = found.dosageForm;
          updated.taxRate = found.taxRate || 0;
          updated.rackLocation = found.rackLocation || 'Rack A-01';
        }
      }

      return updated;
    }));
  };

  const handleAddRow = () => {
    setRows(prev => [...prev, createEmptyRow()]);
  };

  const handleAdd5Rows = () => {
    setRows(prev => [
      ...prev,
      createEmptyRow(),
      createEmptyRow(),
      createEmptyRow(),
      createEmptyRow(),
      createEmptyRow()
    ]);
  };

  const handleDeleteRow = (id: string) => {
    if (rows.length === 1) {
      alert('চালানে অন্তত ১টি ওষুধ থাকা আবশ্যক।');
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  // Load Demo Chalan
  const handleLoadDemo = () => {
    const demoMeds = medicines.slice(0, 4);
    const newRows: ChalanRowState[] = demoMeds.map((med, idx) => ({
      id: `row-demo-${idx}-${Date.now()}`,
      medicineId: med.id,
      medicineName: med.name,
      genericName: med.genericName,
      dosageForm: med.dosageForm,
      batchNumber: `SQ-${Date.now().toString().slice(-4)}-${idx + 1}`,
      manufacturingDate: todayStr,
      expiryDate: defaultExpStr,
      chalanQuantity: (idx + 1) * 100,
      freeBonusQuantity: idx === 0 ? 10 : 0, // 100+10 bonus
      unitPurchasePrice: idx === 0 ? 4.50 : idx === 1 ? 12.00 : 25.50,
      mrp: idx === 0 ? 5.50 : idx === 1 ? 14.00 : 30.00,
      taxRate: 5,
      rackLocation: med.rackLocation || 'Central Depot A'
    }));

    setRows(newRows);
    setChalanNumber(`CHL-SQUARE-${Math.floor(1000 + Math.random() * 9000)}`);
    setNotes('Demo Sample Chalan for Square Pharmaceuticals Depot with 100+10 Trade Bonus');
  };

  // Paste TSV Parser (handles copy-paste from Excel / Google Sheets)
  const handleApplyPastedData = () => {
    if (!pasteRawText.trim()) {
      setIsPasteModalOpen(false);
      return;
    }

    try {
      const lines = pasteRawText.trim().split(/\r?\n/);
      const parsedRows: ChalanRowState[] = [];

      lines.forEach((line, index) => {
        if (!line.trim()) return;

        // Split by Tab (Excel copy default) or Comma
        const cells = line.includes('\t') ? line.split('\t') : line.split(',');

        // Typical Excel Chalan Columns:
        // [0] Medicine Name / Brand
        // [1] Batch No
        // [2] Exp Date
        // [3] Qty
        // [4] Bonus Qty
        // [5] TP / Purchase Price
        // [6] MRP

        const rawMedName = (cells[0] || '').trim();
        const rawBatch = (cells[1] || `B${Date.now().toString().slice(-4)}${index}`).trim();
        const rawExp = (cells[2] || defaultExpStr).trim();
        const rawQty = parseFloat(cells[3]) || 50;
        const rawBonus = parseFloat(cells[4]) || 0;
        const rawTp = parseFloat(cells[5]) || 10;
        const rawMrp = parseFloat(cells[6]) || (rawTp * 1.18);

        // Attempt to match with existing medicine catalog
        const matched = medicines.find(m => 
          m.name.toLowerCase().includes(rawMedName.toLowerCase()) || 
          rawMedName.toLowerCase().includes(m.name.toLowerCase())
        );

        parsedRows.push({
          id: `pasted-${Date.now()}-${index}`,
          medicineId: matched?.id || medicines[0]?.id || `custom-${index}`,
          medicineName: matched?.name || rawMedName || 'Medicine Item',
          genericName: matched?.genericName || 'General Pharmaceutical',
          dosageForm: matched?.dosageForm || 'Tablet',
          batchNumber: rawBatch,
          manufacturingDate: todayStr,
          expiryDate: rawExp.length === 10 ? rawExp : defaultExpStr,
          chalanQuantity: rawQty,
          freeBonusQuantity: rawBonus,
          unitPurchasePrice: rawTp,
          mrp: rawMrp,
          taxRate: matched?.taxRate || 0,
          rackLocation: matched?.rackLocation || 'Rack A-01'
        });
      });

      if (parsedRows.length > 0) {
        setRows(parsedRows);
        setValidationError(null);
      }
      setIsPasteModalOpen(false);
      setPasteRawText('');
    } catch (err: any) {
      setValidationError('এক্সেল ডেটা পার্স করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  // Financial Computations
  const totals = useMemo(() => {
    let subtotal = 0;
    let totalTax = 0;
    let totalBilledUnits = 0;
    let totalBonusUnits = 0;

    rows.forEach(r => {
      const lineNet = (r.chalanQuantity || 0) * (r.unitPurchasePrice || 0);
      const tax = lineNet * ((r.taxRate || 0) / 100);
      subtotal += lineNet;
      totalTax += tax;
      totalBilledUnits += Number(r.chalanQuantity || 0);
      totalBonusUnits += Number(r.freeBonusQuantity || 0);
    });

    const grandTotal = subtotal + totalTax;

    return {
      subtotal,
      totalTax,
      grandTotal,
      totalBilledUnits,
      totalBonusUnits,
      totalInwardUnits: totalBilledUnits + totalBonusUnits
    };
  }, [rows]);

  // Submit and Commit Chalan to Pharmacy Stock & Batches
  const handleCommitChalan = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const supplier = suppliers.find(s => s.id === selectedSupplierId) || suppliers[0];
    if (!supplier) {
      setValidationError('অনুগ্রহ করে কোম্পানি / সাপ্লায়ার নির্বাচন করুন।');
      return;
    }

    if (!chalanNumber.trim()) {
      setValidationError('অনুগ্রহ করে চালান বা ইনভয়েস নম্বর প্রদান করুন।');
      return;
    }

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    // 1. Strict Regulatory Validation
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.medicineName.trim()) {
        setValidationError(`রো #${i + 1}: ওষুধের নাম খালি রাখা যাবে না।`);
        return;
      }
      if (!row.batchNumber.trim()) {
        setValidationError(`রো #${i + 1} (${row.medicineName}): ব্যাচ নম্বর আবশ্যক।`);
        return;
      }
      if (row.chalanQuantity <= 0) {
        setValidationError(`রো #${i + 1} (${row.medicineName}): চালান পরিমাণ শূন্য বা তার কম হতে পারে না।`);
        return;
      }
      if (!row.expiryDate) {
        setValidationError(`রো #${i + 1} (${row.medicineName}): মেয়াদোত্তীর্ণের তারিখ (Exp Date) আবশ্যক।`);
        return;
      }

      const exp = new Date(row.expiryDate);
      if (isNaN(exp.getTime()) || exp <= todayDate) {
        setValidationError(
          `রেগুলেটরি অ্যালার্ট: রো #${i + 1} (${row.medicineName}, ব্যাচ: ${row.batchNumber}) এর মেয়াদোত্তীর্ণের তারিখ (${row.expiryDate}) ইতোমধ্যে অতিক্রান্ত বা অবৈধ! মেয়াদোত্তীর্ণ ওষুধ স্টকে রিসিভ করা নিষিদ্ধ।`
        );
        return;
      }
    }

    try {
      // 2. Add batches and inward stock into PharmacyService & Backend API
      const allBatches = PharmacyService.getBatches();
      const allMedicines = PharmacyService.getMedicines();
      let createdBatchesCount = 0;

      const purchaseItems: PurchaseItem[] = [];

      // API Sync First
      for (const row of rows) {
        const totalInwardStock = Number(row.chalanQuantity) + Number(row.freeBonusQuantity || 0);
        const existingBatch = allBatches.find(
          b => b.medicineId === row.medicineId && b.batchNumber.toUpperCase() === row.batchNumber.trim().toUpperCase()
        );

        const payload = {
          productId: row.medicineId,
          batchNumber: row.batchNumber.trim().toUpperCase(),
          manufacturingDate: row.manufacturingDate ? new Date(row.manufacturingDate).toISOString() : new Date().toISOString(),
          expiryDate: new Date(row.expiryDate).toISOString(),
          purchasePrice: Number(row.unitPurchasePrice),
          mrp: Number(row.mrp),
          unitSellingPrice: Number(row.mrp),
          initialQuantity: totalInwardStock,
          currentStock: existingBatch ? existingBatch.currentStock + totalInwardStock : totalInwardStock,
          status: 'ACTIVE',
          rackLocation: `${receivingWarehouse} - ${row.rackLocation}`
        };

        if (existingBatch) {
          await batchApi.updateBatch(existingBatch.id, payload);
        } else {
          await batchApi.createBatch(payload);
        }
      }

      // Authoritative sync from Neon DB
      await PharmacyService.syncDatabase();

      // Build purchase items for PO History
      rows.forEach((row, idx) => {
        const totalInwardStock = Number(row.chalanQuantity) + Number(row.freeBonusQuantity || 0);
        const lineNet = Number(row.chalanQuantity) * Number(row.unitPurchasePrice);
        const lineTax = lineNet * (Number(row.taxRate || 0) / 100);
        const lineTotal = lineNet + lineTax;

        // Format for PO History
        purchaseItems.push({
          id: `pi-${Date.now()}-${idx}`,
          medicineId: row.medicineId,
          medicineName: row.medicineName,
          dosageForm: row.dosageForm as any,
          batchNumber: row.batchNumber.trim().toUpperCase(),
          manufacturingDate: row.manufacturingDate || todayStr,
          expiryDate: row.expiryDate,
          quantity: totalInwardStock,
          receivedQuantity: Number(row.chalanQuantity),
          freeQuantity: Number(row.freeBonusQuantity || 0),
          purchasePrice: Number(row.unitPurchasePrice),
          mrp: Number(row.mrp),
          sellingPrice: Number(row.mrp),
          taxRate: Number(row.taxRate || 0),
          taxAmount: lineTax,
          totalAmount: lineTotal,
          rackLocation: `${receivingWarehouse} - ${row.rackLocation}`
        });
      });

      // 3. Record Purchase & Supplier Ledger (skip local batch increment to prevent double addition)
      const actualPaid = paymentType === 'credit' ? paidAmount : totals.grandTotal;
      const dueAmount = Math.max(0, totals.grandTotal - actualPaid);

      const newPo: PurchaseOrder = {
        id: `po-chl-${Date.now()}`,
        poNumber: `PO-${chalanNumber}`,
        invoiceNumber: chalanNumber.trim(),
        supplierId: supplier.id,
        supplierName: supplier.name,
        orderDate: chalanDate,
        purchaseDate: chalanDate,
        dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
        receivedAt: chalanDate,
        status: 'received',
        paymentStatus: dueAmount === 0 ? 'paid' : actualPaid > 0 ? 'partial' : 'pending',
        subtotal: totals.subtotal,
        taxAmount: totals.totalTax,
        totalAmount: totals.grandTotal,
        paidAmount: actualPaid,
        dueAmount: dueAmount,
        notes: `Direct Excel-Style Chalan Entry. ${notes}`,
        items: purchaseItems
      };

      PharmacyService.recordPurchase(newPo, true);


      // 4. Update Supplier balancePayable & Ledger using PharmacyService
      // Always update supplier balance for any due amount
      if (dueAmount > 0) {
        supplier.balancePayable += dueAmount;
      }
      PharmacyService.updateSupplier(supplier);

      // Sync Supplier Balance to Backend API
      try {
        await supplierApi.updateSupplier(supplier.id, { balancePayable: supplier.balancePayable });
      } catch (e) {
        console.error("Failed to sync supplier balance to database", e);
      }

      // Always record INVOICE entry in ledger (even for fully-paid chalans)
      const allLedgers: SupplierLedgerEntry[] = JSON.parse(localStorage.getItem('rx_supplier_ledgers_v1') || '[]');
      
      const billEntry: SupplierLedgerEntry = {
        id: `led-chl-inv-${Date.now()}`,
        supplierId: supplier.id,
        supplierName: supplier.name,
        date: chalanDate,
        type: 'INVOICE',
        reference: chalanNumber,
        description: `Chalan Inward (Inv #${chalanNumber}) - Excel Grid Inward`,
        debit: 0,
        credit: totals.grandTotal,
        runningBalance: supplier.balancePayable
      };
      allLedgers.unshift(billEntry);

      // Record PAYMENT entry if paid at time of chalan
      if (actualPaid > 0) {
        const payEntry: SupplierLedgerEntry = {
          id: `led-chl-pay-${Date.now()}`,
          supplierId: supplier.id,
          supplierName: supplier.name,
          date: chalanDate,
          type: 'PAYMENT',
          reference: `PAY-${chalanNumber}`,
          description: `Payment at Chalan receipt via ${paymentType === 'cash' ? 'Cash' : paymentType === 'bank' ? 'Bank Transfer' : 'Credit Terms'}`,
          debit: actualPaid,
          credit: 0,
          runningBalance: supplier.balancePayable
        };
        allLedgers.unshift(payEntry);
      }

      localStorage.setItem('rx_supplier_ledgers_v1', JSON.stringify(allLedgers));

      setSuccessResult({
        chalanNumber,
        supplierName: supplier.name,
        totalUnits: totals.totalInwardUnits,
        totalAmount: totals.grandTotal,
        batchesCount: rows.length
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setValidationError('চালান সেভ করতে ত্রুটি ঘটেছে: ' + (err.message || 'Unknown error'));
    }
  };

  const handleResetForNext = () => {
    setSuccessResult(null);
    setChalanNumber(`CHL-${Math.floor(100000 + Math.random() * 900000)}`);
    setRows([
      createEmptyRow(medicines[0]),
      createEmptyRow(medicines[1] || medicines[0]),
      createEmptyRow(medicines[2] || medicines[0]),
    ]);
    setPaidAmount(0);
    setNotes('');
  };

  return (
    <div className="space-y-5" id="excel-chalan-entry-view">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 text-white p-5 rounded-2xl shadow-sm border border-emerald-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Interactive Spreadsheet Grid • FEFO Auto-Allocation
            </span>
            <span className="text-xs text-slate-400">• Direct Chalan Entry</span>
          </div>
          <h2 className="text-lg md:text-xl font-black tracking-tight text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <span>Excel-Style Chalan Entry &amp; Fast Stock Inward</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            সরাসরি এক্সেল ফাইলের মতো গ্রিড শিটে ওষুধ, নতুন ব্যাচ, মেয়াদ ও পরিমাণ টাইপ অথবা কপি-পেস্ট করে ১-ক্লিকে ইনভেন্টরি ও FEFO স্টক আপডেট করুন।
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={handleLoadDemo}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Load Demo Chalan</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPasteModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <ClipboardPaste className="w-4 h-4" />
            <span>Paste from Excel</span>
          </button>
        </div>
      </div>

      {/* Success Modal / Result */}
      {successResult && (
        <div className="bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-emerald-950 dark:text-emerald-200">
                ✓ চালান সফলভাবে রিসিভ এবং স্টক আপডেট সম্পন্ন হয়েছে!
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                চালান #{successResult.chalanNumber} • সাপ্লায়ার: {successResult.supplierName} • মোট <strong>{successResult.totalUnits} পিস ওষুধ</strong> এবং <strong>{successResult.batchesCount} টি ব্যাচ</strong> ফার্মাসি সেলস কাউন্টারে সক্রিয় করা হয়েছে।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onNavigateToInventory && (
              <button
                type="button"
                onClick={onNavigateToInventory}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer transition"
              >
                ইনভেন্টরি দেখুন
              </button>
            )}
            <button
              type="button"
              onClick={handleResetForNext}
              className="px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer transition"
            >
              পরবর্তী চালান এন্ট্রি
            </button>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {validationError && (
        <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl p-3.5 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="font-semibold flex-1">{validationError}</div>
          <button onClick={() => setValidationError(null)} className="text-rose-400 hover:text-rose-600">✕</button>
        </div>
      )}

      {/* Form & Spreadsheet Layout */}
      <form onSubmit={handleCommitChalan} className="space-y-4" noValidate>
        {/* Chalan Header Cards */}
        <div className="bg-white dark:bg-[#161b26] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 text-xs">
          {/* Supplier / Company Depot */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              কোম্পানি / সাপ্লায়ার ডিপো *
            </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium text-slate-900 dark:text-white cursor-pointer"
            >
              {suppliers.map(sup => (
                <option key={sup.id} value={sup.id}>
                  {sup.name} ({sup.companyName})
                </option>
              ))}
            </select>
          </div>

          {/* Chalan / Invoice No */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              চালান / ইনভয়েস নম্বর *
            </label>
            <input
              type="text"
              value={chalanNumber}
              onChange={(e) => setChalanNumber(e.target.value)}
              placeholder="e.g. SQ-INV-99201"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white"
              required
            />
          </div>

          {/* Chalan Date */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              চালানের তারিখ *
            </label>
            <input
              type="date"
              value={chalanDate}
              onChange={(e) => setChalanDate(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium text-slate-900 dark:text-white"
              required
            />
          </div>

          {/* Receiving Store */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              রিসিভিং ওয়্যারহাউস
            </label>
            <select
              value={receivingWarehouse}
              onChange={(e) => setReceivingWarehouse(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="Main Central Pharmacy Depot">Main Central Pharmacy Depot</option>
              <option value="OT Emergency Drug Store">OT Emergency Drug Store</option>
              <option value="Eye Drops Cooling Vault">Eye Drops Cooling Vault</option>
              <option value="Branch Buffer Store">Branch Buffer Store</option>
            </select>
          </div>

          {/* Payment Terms */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              পেমেন্ট টাইপ
            </label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as any)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="credit">Credit (সাপ্লায়ার বাকি লেজার)</option>
              <option value="cash">Instant Cash Paid</option>
              <option value="bank">Bank / Company Cheque</option>
            </select>
          </div>
        </div>

        {/* Spreadsheet Table Container */}
        <div className="bg-white dark:bg-[#161b26] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Spreadsheet Header Ribbon */}
          <div className="p-3 bg-slate-100/90 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-800 dark:text-white">
                চালান আইটেম গ্রিড ({rows.length} টি রো)
              </span>
              <span className="text-[11px] text-slate-500">
                (Excel এর মতো প্রতিটি ঘরে সরাসরি টাইপ করুন)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white font-bold hover:bg-slate-50 cursor-pointer text-xs"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>+ Add Row</span>
              </button>
              <button
                type="button"
                onClick={handleAdd5Rows}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white font-bold hover:bg-slate-50 cursor-pointer text-xs"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>+ 5 Rows</span>
              </button>
            </div>
          </div>

          {/* Interactive Spreadsheet Grid */}
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[10px] font-bold select-none border-b border-slate-300 dark:border-slate-700">
                <tr>
                  <th className="py-2 px-2 text-center w-8 border-r border-slate-300 dark:border-slate-700">#</th>
                  <th className="py-2 px-3 min-w-[200px] border-r border-slate-300 dark:border-slate-700">Medicine Name (ক্যাটালগ সার্চ / টাইপ)</th>
                  <th className="py-2 px-2 min-w-[120px] border-r border-slate-300 dark:border-slate-700">Batch No *</th>
                  <th className="py-2 px-2 min-w-[110px] border-r border-slate-300 dark:border-slate-700">Mfg Date</th>
                  <th className="py-2 px-2 min-w-[110px] border-r border-slate-300 dark:border-slate-700">Exp Date *</th>
                  <th className="py-2 px-2 text-right min-w-[90px] border-r border-slate-300 dark:border-slate-700">Chalan Qty *</th>
                  <th className="py-2 px-2 text-right min-w-[85px] border-r border-slate-300 dark:border-slate-700">Bonus Qty</th>
                  <th className="py-2 px-2 text-right min-w-[95px] border-r border-slate-300 dark:border-slate-700">Unit TP (৳) *</th>
                  <th className="py-2 px-2 text-right min-w-[95px] border-r border-slate-300 dark:border-slate-700">Unit MRP (৳)</th>
                  <th className="py-2 px-2 text-right min-w-[60px] border-r border-slate-300 dark:border-slate-700">VAT %</th>
                  <th className="py-2 px-3 text-right min-w-[110px] border-r border-slate-300 dark:border-slate-700">Line Total (৳)</th>
                  <th className="py-2 px-2 text-center w-10">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {rows.map((row, idx) => {
                  const lineNet = (row.chalanQuantity || 0) * (row.unitPurchasePrice || 0);
                  const lineTax = lineNet * ((row.taxRate || 0) / 100);
                  const lineTotal = lineNet + lineTax;

                  // Check date validity
                  const isExpInvalid = row.expiryDate && new Date(row.expiryDate) <= new Date(todayStr);

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 group"
                    >
                      {/* Row Index */}
                      <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[11px] bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700">
                        {idx + 1}
                      </td>

                      {/* Medicine Selector / Input */}
                      <td className="py-1 px-2 border-r border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-1">
                          <select
                            value={row.medicineId}
                            onChange={(e) => handleUpdateRow(row.id, 'medicineId', e.target.value)}
                            className="w-full text-xs font-semibold py-1 px-1.5 rounded bg-transparent border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white truncate cursor-pointer"
                          >
                            {medicines.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.strength}) - {m.manufacturer}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Batch Number */}
                      <td className="py-1 px-2 border-r border-slate-200 dark:border-slate-700">
                        <input
                          type="text"
                          value={row.batchNumber}
                          onChange={(e) => handleUpdateRow(row.id, 'batchNumber', e.target.value.toUpperCase())}
                          placeholder="BATCH-01"
                          className="w-full text-xs font-mono font-bold py-1 px-1.5 rounded bg-transparent border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white uppercase"
                        />
                      </td>

                      {/* Mfg Date */}
                      <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          type="date"
                          value={row.manufacturingDate}
                          onChange={(e) => handleUpdateRow(row.id, 'manufacturingDate', e.target.value)}
                          className="w-full text-[11px] py-1 px-1 rounded bg-transparent border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 text-slate-700 dark:text-slate-300"
                        />
                      </td>

                      {/* Exp Date */}
                      <td className={`py-1 px-1 border-r border-slate-200 dark:border-slate-700 ${isExpInvalid ? 'bg-rose-50 dark:bg-rose-950/40' : ''}`}>
                        <input
                          type="date"
                          value={row.expiryDate}
                          onChange={(e) => handleUpdateRow(row.id, 'expiryDate', e.target.value)}
                          className={`w-full text-[11px] font-bold py-1 px-1 rounded bg-transparent border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 ${
                            isExpInvalid ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                          }`}
                          required
                        />
                      </td>

                      {/* Chalan Quantity */}
                      <td className="py-1 px-2 text-right border-r border-slate-200 dark:border-slate-700">
                        <input
                          type="number"
                          min="1"
                          value={row.chalanQuantity}
                          onChange={(e) => handleUpdateRow(row.id, 'chalanQuantity', Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full text-xs font-mono font-black text-right py-1 px-1.5 rounded bg-transparent border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white"
                          required
                        />
                      </td>

                      {/* Bonus / Free Quantity */}
                      <td className="py-1 px-2 text-right border-r border-slate-200 dark:border-slate-700">
                        <input
                          type="number"
                          min="0"
                          value={row.freeBonusQuantity}
                          onChange={(e) => handleUpdateRow(row.id, 'freeBonusQuantity', Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full text-xs font-mono font-bold text-right py-1 px-1.5 rounded bg-transparent border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 text-emerald-600 dark:text-emerald-400"
                        />
                      </td>

                      {/* Unit TP (৳) */}
                      <td className="py-1 px-2 text-right border-r border-slate-200 dark:border-slate-700">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={row.unitPurchasePrice}
                          onChange={(e) => handleUpdateRow(row.id, 'unitPurchasePrice', Math.max(0.01, parseFloat(e.target.value) || 0))}
                          className="w-full text-xs font-mono font-bold text-right py-1 px-1.5 rounded bg-transparent border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 text-indigo-700 dark:text-indigo-400"
                          required
                        />
                      </td>

                      {/* Unit MRP (৳) */}
                      <td className="py-1 px-2 text-right border-r border-slate-200 dark:border-slate-700">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={row.mrp}
                          onChange={(e) => handleUpdateRow(row.id, 'mrp', Math.max(0.01, parseFloat(e.target.value) || 0))}
                          className="w-full text-xs font-mono font-bold text-right py-1 px-1.5 rounded bg-transparent border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-200"
                        />
                      </td>

                      {/* VAT % */}
                      <td className="py-1 px-1 text-right border-r border-slate-200 dark:border-slate-700">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={row.taxRate}
                          onChange={(e) => handleUpdateRow(row.id, 'taxRate', Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full text-xs font-mono text-right py-1 px-1 rounded bg-transparent border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 text-slate-500"
                        />
                      </td>

                      {/* Line Total */}
                      <td className="py-1.5 px-3 text-right font-mono font-black text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">
                        ৳ {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Delete */}
                      <td className="py-1.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition cursor-pointer"
                          title="Delete Row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-slate-100 dark:bg-slate-800 font-extrabold border-t-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white">
                <tr>
                  <td colSpan={5} className="py-2.5 px-3 text-right text-xs">
                    Grand Total ({rows.length} Items):
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-emerald-700 dark:text-emerald-400 text-xs">
                    {totals.totalBilledUnits.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-emerald-600 dark:text-emerald-400 text-xs">
                    +{totals.totalBonusUnits.toLocaleString()} Free
                  </td>
                  <td colSpan={3}></td>
                  <td className="py-2.5 px-3 text-right font-mono text-indigo-700 dark:text-indigo-400 text-sm font-black">
                    ৳ {totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Notes & Confirm Action Footer */}
        <div className="bg-white dark:bg-[#161b26] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="w-full md:w-1/2">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="মন্তব্য / নোট (ঐচ্ছিক: ড্রয়ার নম্বর, চালানের বিশেষ দ্রষ্টব্য ইত্যাদি)..."
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <div className="text-right text-xs pr-2">
              <div className="text-slate-500">মোট পরিশোধযোগ্য:</div>
              <div className="text-base font-black text-indigo-700 dark:text-indigo-400 font-mono">
                ৳ {totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition cursor-pointer"
            >
              <PackageCheck className="w-4 h-4" />
              <span>Confirm &amp; Update Stock &amp; Batches</span>
            </button>
          </div>
        </div>
      </form>

      {/* Modal: Paste from Excel / Clipboard */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#161b26] rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardPaste className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold">Paste Rows from Excel / Clipboard</h3>
              </div>
              <button 
                onClick={() => setIsPasteModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                <div className="font-bold mb-1">কলামের ক্রম (Excel Column Order):</div>
                <div className="font-mono text-[11px] text-amber-800 dark:text-amber-300">
                  Medicine Name &nbsp;|&nbsp; Batch No &nbsp;|&nbsp; Exp Date (YYYY-MM-DD) &nbsp;|&nbsp; Qty &nbsp;|&nbsp; Bonus &nbsp;|&nbsp; TP (৳) &nbsp;|&nbsp; MRP (৳)
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  * এক্সেল ফাইল থেকে রো সিলেক্ট করে কপি (Ctrl+C) করে নিচের বক্সে পেস্ট (Ctrl+V) করুন।
                </div>
              </div>

              <textarea
                rows={8}
                value={pasteRawText}
                onChange={(e) => setPasteRawText(e.target.value)}
                placeholder={`Napa Extra 500mg\tB99201\t2027-10-31\t500\t50\t2.50\t3.00\nVigamox Eye Drop\tB88102\t2028-05-15\t50\t0\t185.00\t215.00`}
                className="w-full font-mono text-xs p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasteModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyPastedData}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer"
                >
                  Apply to Spreadsheet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
