import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Lock,
  Unlock,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Barcode,
  Sparkles,
  FileText,
} from 'lucide-react';
import { Medicine, Batch, Supplier, MedicineCategory, DosageForm } from '../../types/pharmacy';
import { inventoryApi, batchApi, supplierApi } from '../../lib/api';
import { PharmacyService } from '../../services/pharmacyService';
import { getCurrentLocale, subscribeLocale, toBanglaDigits } from '../../utils/i18nFormatter';
import { AuditService } from '../../services/auditService';

interface InvoiceInwardBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicines: Medicine[];
  batches: Batch[];
  suppliers: Supplier[];
  initialMedicine?: Medicine | null;
  onSaved: () => Promise<void> | void;
}

const generateInvoiceNo = () => {
  const yr = new Date().getFullYear();
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `INV-${yr}-${rnd}`;
};

const generateBatchNo = () => {
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `BAT-${rnd}`;
};

const UNIT_BN_MAP: Record<string, string> = {
  Strip: 'স্ট্রিপ',
  Box: 'বক্স',
  Bottle: 'বোতল',
  Vial: 'ভায়াল',
  Tube: 'টিউব',
  Piece: 'পিস',
};

export const InvoiceInwardBatchModal: React.FC<InvoiceInwardBatchModalProps> = ({
  isOpen,
  onClose,
  medicines,
  batches,
  suppliers,
  initialMedicine,
  onSaved,
}) => {
  const [locale, setLocaleState] = useState<'en' | 'bn'>(() => getCurrentLocale());
  useEffect(() => subscribeLocale((loc) => setLocaleState(loc)), []);
  const isBn = locale === 'bn';

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Invoice Info State
  const [invoiceNumber, setInvoiceNumber] = useState<string>(generateInvoiceNo);
  const [invoiceDate, setInvoiceDate] = useState<string>(todayStr);
  const [selectedMedicineId, setSelectedMedicineId] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [customSupplierMode, setCustomSupplierMode] = useState<boolean>(false);
  const [customSupplierName, setCustomSupplierName] = useState<string>('');

  // Inline Quick Product Master creation state
  const [showNewProductForm, setShowNewProductForm] = useState<boolean>(false);
  const [newProd, setNewProd] = useState<{
    name: string;
    genericName: string;
    brandName: string;
    category: MedicineCategory;
    dosageForm: DosageForm | string;
    strength: string;
    manufacturer: string;
    unitOfMeasure: 'Strip' | 'Box' | 'Bottle' | 'Vial' | 'Tube' | 'Piece';
    packSize: number;
    reorderLevel: number;
    rackLocation: string;
    barcode: string;
    requiresPrescription: boolean;
    purchasePrice: number;
    mrp: number;
    sellingPrice: number;
  }>({
    name: '',
    genericName: '',
    brandName: '',
    category: 'Antibiotics',
    dosageForm: 'TABLET',
    strength: '500mg',
    manufacturer: '',
    unitOfMeasure: 'Strip',
    packSize: 10,
    reorderLevel: 20,
    rackLocation: 'Rack A-01',
    barcode: '',
    requiresPrescription: true,
    purchasePrice: 0,
    mrp: 0,
    sellingPrice: 0,
  });

  // 2. Batch, Dates & Quantity State
  const [batchNumber, setBatchNumber] = useState<string>(generateBatchNo);
  const [initialQuantity, setInitialQuantity] = useState<number>(100);
  const [manufacturingDate, setManufacturingDate] = useState<string>(todayStr);
  const [expiryDate, setExpiryDate] = useState<string>('');

  // 3. Master Pricing & Override State
  const [overridePrices, setOverridePrices] = useState<boolean>(false);
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [mrp, setMrp] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(0);

  // UI feedback state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const wasOpenRef = useRef<boolean>(false);

  // Sync defaults only when modal transitions from closed -> open
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    setErrorMsg(null);
    setSuccessMsg(null);
    setInvoiceNumber(generateInvoiceNo());
    setInvoiceDate(todayStr);
    setBatchNumber(generateBatchNo());
    setInitialQuantity(100);
    setManufacturingDate(todayStr);
    setExpiryDate('');
    setOverridePrices(false);
    setCustomSupplierMode(suppliers.length === 0);
    setCustomSupplierName('');

    if (initialMedicine) {
      setSelectedMedicineId(initialMedicine.id);
      setShowNewProductForm(false);
    } else if (medicines.length > 0) {
      setSelectedMedicineId(medicines[0].id);
      setShowNewProductForm(false);
    } else {
      setSelectedMedicineId('');
      setShowNewProductForm(true);
    }

    if (suppliers.length > 0) {
      setSelectedSupplierId(suppliers[0].id);
      setCustomSupplierMode(false);
    } else {
      setSelectedSupplierId('');
    }
  }, [isOpen, initialMedicine, medicines, suppliers, todayStr]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  const selectedMedicine = useMemo(
    () => medicines.find((m) => m.id === selectedMedicineId) || null,
    [medicines, selectedMedicineId]
  );

  // Auto-fetch Master Unit Prices when selected medicine changes
  useEffect(() => {
    if (!isOpen) return;
    if (showNewProductForm && !selectedMedicineId) {
      setPurchasePrice(Number(newProd.purchasePrice) || 0);
      setMrp(Number(newProd.mrp) || 0);
      setSellingPrice(Number(newProd.sellingPrice) || 0);
      return;
    }

    if (!selectedMedicine) {
      setPurchasePrice(0);
      setMrp(0);
      setSellingPrice(0);
      return;
    }

    const masterCost = Number(selectedMedicine.purchasePrice || 0);
    const masterMrp = Number(selectedMedicine.mrp || 0);
    const masterSell = Number(selectedMedicine.sellingPrice || 0);

    if (masterCost > 0 || masterMrp > 0 || masterSell > 0) {
      setPurchasePrice(masterCost);
      setMrp(masterMrp || masterSell);
      setSellingPrice(masterSell || masterMrp);
    } else {
      // Fallback to latest recorded batch for this medicine if Product Master prices are still 0
      const medBatches = batches.filter((b) => b.medicineId === selectedMedicine.id);
      if (medBatches.length > 0) {
        const latest = medBatches[medBatches.length - 1];
        setPurchasePrice(Number(latest.purchasePrice || 0));
        setMrp(Number(latest.mrp || 0));
        setSellingPrice(Number(latest.sellingPrice ?? (latest as any).unitSellingPrice ?? 0));
      } else {
        setPurchasePrice(0);
        setMrp(0);
        setSellingPrice(0);
      }
    }
    setOverridePrices(false);
  }, [selectedMedicineId, selectedMedicine, batches, isOpen, showNewProductForm]);

  // Keep price fields synced with inline New Product fields when override isn't active
  useEffect(() => {
    if (showNewProductForm && !overridePrices) {
      setPurchasePrice(Number(newProd.purchasePrice) || 0);
      setMrp(Number(newProd.mrp) || 0);
      setSellingPrice(Number(newProd.sellingPrice) || 0);
    }
  }, [newProd.purchasePrice, newProd.mrp, newProd.sellingPrice, showNewProductForm, overridePrices]);

  if (!isOpen) return null;

  const activeUnit = showNewProductForm
    ? newProd.unitOfMeasure
    : selectedMedicine?.unitOfMeasure || 'Strip';
  const activeUnitLabel = isBn ? UNIT_BN_MAP[activeUnit] || activeUnit : `${activeUnit}s`;
  const activeRack = showNewProductForm
    ? newProd.rackLocation || 'RACK A-01'
    : (selectedMedicine?.rackLocation || 'RACK A-01').toUpperCase();

  const headerSubtitle = showNewProductForm
    ? newProd.name
      ? `${newProd.name}${newProd.strength ? ` • ${newProd.strength}` : ''} (${activeUnit})`
      : isBn
        ? 'নতুন প্রোডাক্ট মাস্টার নিবন্ধন ও ব্যাচ এন্ট্রি'
        : 'New Product Master Registration & Batch Entry'
    : selectedMedicine
      ? `${selectedMedicine.name} • ${selectedMedicine.strength} (${selectedMedicine.unitOfMeasure})`
      : isBn
        ? 'প্রোডাক্ট নির্বাচন করুন বা নতুন যোগ করুন'
        : 'Select or register a pharmaceutical product';

  const totalInwardValue = (Number(initialQuantity) || 0) * (Number(purchasePrice) || 0);
  const formattedTotalValue = isBn
    ? toBanglaDigits(totalInwardValue.toFixed(2))
    : totalInwardValue.toFixed(2);

  // Create new product master if inline creator is active
  const ensureProductCreated = async (): Promise<Medicine | null> => {
    if (!showNewProductForm && selectedMedicine) return selectedMedicine;

    if (!newProd.name.trim() || !newProd.genericName.trim()) {
      setErrorMsg(
        isBn
          ? 'অনুগ্রহ করে ওষুধের নাম এবং জেনেরিক নাম পূরণ করুন।'
          : 'Please enter both Commercial / Product Name and Generic Name.'
      );
      return null;
    }

    const effCost = Number(overridePrices ? purchasePrice : newProd.purchasePrice) || 0;
    const effMrp = Number(overridePrices ? mrp : newProd.mrp) || 0;
    const effSell = Number(overridePrices ? sellingPrice : newProd.sellingPrice) || effMrp;

    const payload = {
      name: newProd.name.trim(),
      sku: `SKU-${Date.now()}`,
      barcode: newProd.barcode.trim() || null,
      dosageForm: newProd.dosageForm || 'TABLET',
      strength: newProd.strength || '500mg',
      unitOfMeasure: newProd.unitOfMeasure || 'Strip',
      packSize: Number(newProd.packSize) || 10,
      reorderLevel: Number(newProd.reorderLevel) || 20,
      defaultRackLocation: newProd.rackLocation || 'Rack A-01',
      requiresPrescription: !!newProd.requiresPrescription,
      isNarcoticOrSedative: false,
      vatRate: 5,
      genericName: newProd.genericName.trim(),
      categoryName: newProd.category,
      manufacturerName:
        newProd.manufacturer.trim() ||
        customSupplierName.trim() ||
        suppliers.find((s) => s.id === selectedSupplierId)?.name ||
        'General Manufacturer',
      purchasePrice: effCost,
      mrp: effMrp,
      sellingPrice: effSell,
    };

    try {
      const created = await inventoryApi.createMedicine(payload);
      const mappedCreated: Medicine = {
        id: created.id,
        sku: created.sku,
        name: created.name,
        genericName: created.generic?.name || newProd.genericName.trim(),
        brandName: newProd.brandName.trim() || created.name,
        barcode: created.barcode || undefined,
        category: (created.category?.name || newProd.category) as MedicineCategory,
        dosageForm: (created.dosageForm || newProd.dosageForm) as DosageForm,
        strength: created.strength || newProd.strength,
        manufacturer: created.manufacturer?.name || payload.manufacturerName,
        unitOfMeasure: (created.unitOfMeasure || newProd.unitOfMeasure) as Medicine['unitOfMeasure'],
        packSize: Number(created.packSize || newProd.packSize || 10),
        reorderLevel: Number(created.reorderLevel || newProd.reorderLevel || 20),
        rackLocation: created.defaultRackLocation || newProd.rackLocation || 'Rack A-01',
        requiresPrescription: !!created.requiresPrescription,
        isNarcoticOrSedative: !!created.isNarcoticOrSedative,
        taxRate: Number(created.vatRate || 5),
        purchasePrice: effCost,
        mrp: effMrp,
        sellingPrice: effSell,
        createdAt: created.createdAt || new Date().toISOString(),
      };

      setSelectedMedicineId(mappedCreated.id);
      setShowNewProductForm(false);
      await onSaved();
      return mappedCreated;
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.error ||
          err?.message ||
          (isBn ? 'প্রোডাক্ট মাস্টার সংরক্ষণ করতে ব্যর্থ হয়েছে।' : 'Failed to register Product Master.')
      );
      return null;
    }
  };

  const handleSubmit = async (keepInvoiceForNext: boolean) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!invoiceNumber.trim()) {
      setErrorMsg(isBn ? 'ইনভয়েস / চালান নম্বর আবশ্যক।' : 'Invoice / Chalan No. is required.');
      return;
    }
    if (!batchNumber.trim()) {
      setErrorMsg(isBn ? 'ব্যাচ নম্বর আবশ্যক।' : 'Batch Number is required.');
      return;
    }
    if (!initialQuantity || initialQuantity <= 0) {
      setErrorMsg(isBn ? 'সঠিক পরিমাণ (০-এর বেশি) লিখুন।' : 'Initial Received Quantity must be greater than 0.');
      return;
    }
    if (!expiryDate) {
      setErrorMsg(isBn ? 'মেয়াদ উত্তীর্ণের তারিখ (Expiry Date) নির্বাচন করুন।' : 'Expiry Date is required.');
      return;
    }

    const expObj = new Date(expiryDate);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    if (isNaN(expObj.getTime()) || expObj <= todayMidnight) {
      setErrorMsg(
        isBn
          ? 'রেগুলেটরি সতর্কতা: মেয়াদোত্তীর্ণ বা আজকের তারিখের ব্যাচ স্টকে এন্ট্রি করা নিষিদ্ধ!'
          : 'Regulatory Block: Expiry Date must be a valid future date. Expired stock cannot be received.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const targetMed = await ensureProductCreated();
      if (!targetMed) {
        setIsSubmitting(false);
        return;
      }

      // Determine Supplier ID & Name
      let supplierIdToUse = !customSupplierMode ? selectedSupplierId : '';
      let supplierNameToUse = '';

      if (customSupplierMode && customSupplierName.trim()) {
        supplierNameToUse = customSupplierName.trim();
        // Also try creating supplier on backend if none selected
        const existingSup = suppliers.find(
          (s) =>
            s.name.toLowerCase() === supplierNameToUse.toLowerCase() ||
            (s.companyName && s.companyName.toLowerCase() === supplierNameToUse.toLowerCase())
        );
        if (existingSup) {
          supplierIdToUse = existingSup.id;
        } else {
          try {
            const createdSup = await supplierApi.createSupplier({
              name: supplierNameToUse,
              companyName: supplierNameToUse,
              phone: 'N/A',
              address: '',
            });
            if (createdSup?.id) supplierIdToUse = createdSup.id;
          } catch {
            // Backend BatchService will still auto-create supplier from supplierName
          }
        }
      } else if (supplierIdToUse) {
        const supObj = suppliers.find((s) => s.id === supplierIdToUse);
        supplierNameToUse = supObj?.companyName || supObj?.name || '';
      } else if (targetMed.manufacturer) {
        supplierNameToUse = targetMed.manufacturer;
      }

      const payload = {
        productId: targetMed.id,
        batchNumber: batchNumber.trim().toUpperCase(),
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate: new Date(invoiceDate || todayStr).toISOString(),
        supplierId: supplierIdToUse || undefined,
        supplierName: supplierNameToUse || undefined,
        manufacturingDate: manufacturingDate
          ? new Date(manufacturingDate).toISOString()
          : new Date().toISOString(),
        expiryDate: new Date(expiryDate).toISOString(),
        purchasePrice: Number(purchasePrice) || 0,
        mrp: Number(mrp) || 0,
        unitSellingPrice: Number(sellingPrice) || 0,
        initialQuantity: Number(initialQuantity) || 0,
        currentStock: Number(initialQuantity) || 0,
        status: 'ACTIVE',
        rackLocation: targetMed.rackLocation || 'Rack A-01',
        updateMasterPrices: overridePrices,
        createInvoiceRecord: true,
      };

      try {
        await batchApi.createBatch(payload);
      } catch (apiErr: any) {
        // Check if backend rejected due to validation error vs network unreachable
        const serverErrMsg = apiErr?.response?.data?.error;
        if (serverErrMsg) {
          throw new Error(serverErrMsg);
        }
        // Offline / local fallback
        await PharmacyService.addBatch({
          id: `bat-${Date.now()}`,
          medicineId: targetMed.id,
          medicineName: targetMed.name,
          batchNumber: payload.batchNumber,
          invoiceNumber: payload.invoiceNumber,
          invoiceDate: invoiceDate || todayStr,
          supplierId: supplierIdToUse || undefined,
          supplierName: supplierNameToUse || undefined,
          manufacturingDate: manufacturingDate || todayStr,
          expiryDate,
          purchasePrice: payload.purchasePrice,
          mrp: payload.mrp,
          sellingPrice: payload.unitSellingPrice,
          initialQuantity: payload.initialQuantity,
          currentStock: payload.currentStock,
          status: 'active',
          rackLocation: payload.rackLocation,
        });
      }

      AuditService.recordAuditLog({
        userId: 'current-user',
        userName: 'Pharmacist / Storekeeper',
        userRole: 'Inventory Manager',
        action: 'CREATE',
        module: 'inventory',
        targetEntityId: payload.batchNumber,
        targetEntityType: 'Batch',
        summary: `Invoice-Wise Inward (${payload.invoiceNumber}): ${targetMed.name} • Batch ${payload.batchNumber} (+${payload.initialQuantity} ${targetMed.unitOfMeasure})`,
        beforeState: null,
        afterState: payload,
      });

      await PharmacyService.syncDatabase();
      await onSaved();

      if (keepInvoiceForNext) {
        // Keep Invoice No., Date & Supplier locked; reset batch fields for next entry under same invoice
        setBatchNumber(generateBatchNo());
        setExpiryDate('');
        setOverridePrices(false);
        setSuccessMsg(
          isBn
            ? `✓ ব্যাচ ${payload.batchNumber} (${targetMed.name}) ইনভয়েস ${payload.invoiceNumber}-এ সংরক্ষিত হয়েছে! পরবর্তী ব্যাচ দিন।`
            : `✓ Batch ${payload.batchNumber} (${targetMed.name}) saved under ${payload.invoiceNumber}! Ready for next batch.`
        );
      } else {
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          (isBn
            ? 'ইনভয়েস ও ব্যাচ এন্ট্রি সংরক্ষণ করতে সমস্যা হয়েছে।'
            : 'Failed to save Invoice & Batch entry.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-no-translate="true"
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inward-modal-title"
    >
      <div className="bg-white text-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col max-h-[94vh] dark:bg-[#111827] dark:text-white dark:border-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500">
        {/* Dark Navy Header matching Reference Screenshot 1 */}
        <div className="bg-[#0f172a] text-white px-5 py-4 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 id="inward-modal-title" className="text-base font-bold tracking-tight text-white">
                {isBn ? 'ইনভয়েস ভিত্তিক ইনওয়ার্ড ব্যাচ এন্ট্রি' : 'Invoice-Wise Inward Batch Entry'}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-400 text-[11px] font-bold whitespace-nowrap">
                {isBn ? 'ইনভয়েস ভিত্তিক স্টক এন্ট্রি' : 'Invoice-Based Stock Entry'}
              </span>
            </div>
            <p className="text-xs font-semibold text-emerald-400 mt-1 truncate">
              {headerSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/70 transition cursor-pointer shrink-0"
            aria-label={isBn ? 'বন্ধ করুন' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(false);
          }}
          className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs bg-slate-50/40 dark:bg-slate-900/70"
        >
          {/* Feedback Banners */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2 text-xs font-semibold dark:bg-rose-950/40 dark:border-rose-800/70 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 dark:text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2 text-xs font-semibold dark:bg-emerald-950/40 dark:border-emerald-800/70 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 dark:text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* CARD 1: 1. INVOICE / CHALAN INFO */}
          <div className="bg-emerald-50/50 border border-emerald-200/90 rounded-xl p-3.5 sm:p-4 space-y-3 dark:bg-emerald-950/40 dark:border-emerald-800/70">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold tracking-wide uppercase text-slate-800 dark:text-slate-100">
                {isBn ? '১. ইনভয়েস / চালান তথ্য (INVOICE INFO)' : '1. INVOICE / CHALAN INFO'}
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-extrabold tracking-wider uppercase">
                {isBn ? 'ইনভয়েস ভিত্তিক' : 'INVOICE-WISE'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Invoice Number */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 dark:text-slate-200">
                  {isBn ? 'ইনভয়েস / চালান নম্বর *' : 'Invoice / Chalan No. *'}
                </label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="INV-2026-2806"
                  className="w-full px-3 py-2 bg-white border-2 border-emerald-500/80 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-[#111827] dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              {/* Invoice Date */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 dark:text-slate-200">
                  {isBn ? 'ইনভয়েস তারিখ *' : 'Invoice Date *'}
                </label>
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-[#111827] dark:border-slate-700 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              {/* Product Master Dropdown + Inline + New Product toggle */}
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <label className="font-bold text-slate-700 truncate dark:text-slate-200">
                    {isBn ? 'ওষুধ / প্রোডাক্ট *' : 'Medicine / Product *'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNewProductForm((v) => !v)}
                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-0.5 cursor-pointer shrink-0 dark:text-emerald-300"
                  >
                    <Plus className="w-3 h-3" />
                    <span>
                      {showNewProductForm
                        ? isBn
                          ? 'তালিকা দেখুন'
                          : 'Select Existing'
                        : isBn
                          ? 'নতুন ওষুধ'
                          : 'New Product'}
                    </span>
                  </button>
                </div>
                <select
                  value={selectedMedicineId}
                  disabled={showNewProductForm && medicines.length === 0}
                  onChange={(e) => {
                    setSelectedMedicineId(e.target.value);
                    setShowNewProductForm(false);
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-[#111827] dark:border-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                >
                  {medicines.length === 0 ? (
                    <option value="">
                      {isBn ? '-- নিচে নতুন ওষুধ যোগ করুন --' : '-- Register new product below --'}
                    </option>
                  ) : (
                    medicines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.strength ? `(${m.strength})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Supplier / Distributor Dropdown + Custom toggle */}
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <label className="font-bold text-slate-700 truncate dark:text-slate-200">
                    {isBn ? 'সাপ্লায়ার / ডিস্ট্রিবিউটর' : 'Supplier / Distributor'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setCustomSupplierMode((v) => !v)}
                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer shrink-0 dark:text-emerald-300"
                  >
                    {customSupplierMode
                      ? isBn
                        ? 'তালিকা থেকে'
                        : 'From List'
                      : isBn
                        ? '+ নতুন লিখুন'
                        : '+ Type New'}
                  </button>
                </div>

                {customSupplierMode ? (
                  <input
                    type="text"
                    value={customSupplierName}
                    onChange={(e) => setCustomSupplierName(e.target.value)}
                    placeholder={isBn ? 'যেমন: গ্যাকো ফার্মাসিউটিক্যালস লি.' : 'e.g., Gaco Pharmaceuticals Ltd.'}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-[#111827] dark:border-slate-700 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                ) : (
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-[#111827] dark:border-slate-700 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  >
                    {suppliers.length === 0 && (
                      <option value="">{isBn ? 'সাপ্লায়ার নির্বাচন করুন' : 'Select Supplier'}</option>
                    )}
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.companyName || sup.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Inline Quick Product Master Registration Sub-Panel */}
            {showNewProductForm && (
              <div className="mt-2 p-3 bg-white rounded-xl border border-emerald-300 shadow-2xs space-y-2.5 dark:bg-[#111827] dark:border-emerald-800/70">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                  <span className="text-[11px] font-extrabold text-emerald-800 flex items-center gap-1.5 dark:text-emerald-300">
                    <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      {isBn ? 'নতুন প্রোডাক্ট মাস্টার নিবন্ধন' : 'Register New Product Master'}
                    </span>
                  </span>
                  {medicines.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowNewProductForm(false)}
                      className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer dark:text-slate-400 dark:hover:text-white"
                    >
                      {isBn ? 'বন্ধ' : 'Close'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="font-bold text-slate-700 dark:text-slate-200">
                      {isBn ? 'বাণিজ্যিক / প্রোডাক্ট নাম *' : 'Commercial / Product Name *'}
                    </label>
                    <input
                      type="text"
                      required={showNewProductForm}
                      value={newProd.name}
                      onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                      placeholder="e.g., Amoxicillin + Clavulanate 625mg"
                      className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-200">
                      {isBn ? 'জেনেরিক / রাসায়নিক নাম *' : 'Generic / Chemical Name *'}
                    </label>
                    <input
                      type="text"
                      required={showNewProductForm}
                      value={newProd.genericName}
                      onChange={(e) => setNewProd({ ...newProd, genericName: e.target.value })}
                      placeholder="e.g., Amoxicillin & Clavulanate"
                      className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs dark:border-slate-700 bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-200">
                      {isBn ? 'প্রস্তুতকারক / কোম্পানি' : 'Manufacturer / Company'}
                    </label>
                    <input
                      type="text"
                      value={newProd.manufacturer}
                      onChange={(e) => setNewProd({ ...newProd, manufacturer: e.target.value })}
                      placeholder="e.g., Square Pharmaceuticals PLC"
                      className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs dark:border-slate-700 bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-200">
                      {isBn ? 'থেরাপিউটিক ক্যাটাগরি' : 'Therapeutic Category'}
                    </label>
                    <select
                      value={newProd.category}
                      onChange={(e) =>
                        setNewProd({ ...newProd, category: e.target.value as MedicineCategory })
                      }
                      className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs dark:border-slate-700 bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
                    >
                      <option value="Antibiotics">{isBn ? 'অ্যান্টিবায়োটিক' : 'Antibiotics'}</option>
                      <option value="Analgesics & Antipyretics">
                        {isBn ? 'ব্যথানাশক ও জ্বর' : 'Analgesics & Antipyretics'}
                      </option>
                      <option value="Cardiovascular">{isBn ? 'কার্ডিওভাসকুলার' : 'Cardiovascular'}</option>
                      <option value="Antidiabetic">{isBn ? 'ডায়াবেটিস' : 'Antidiabetic'}</option>
                      <option value="Respiratory">{isBn ? 'শ্বাসতন্ত্র' : 'Respiratory'}</option>
                      <option value="Gastrointestinal">
                        {isBn ? 'গ্যাস্ট্রোইনটেস্টাইনাল' : 'Gastrointestinal'}
                      </option>
                      <option value="Dermatology">{isBn ? 'চর্মরোগ' : 'Dermatology'}</option>
                      <option value="Vitamins & Supplements">
                        {isBn ? 'ভিটামিন ও সাপ্লিমেন্ট' : 'Vitamins & Supplements'}
                      </option>
                      <option value="Ophthalmic & ENT">{isBn ? 'চক্ষু ও ইএনটি' : 'Ophthalmic & ENT'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-200">
                      {isBn ? 'ডোজের ধরন' : 'Dosage Form'}
                    </label>
                    <select
                      value={newProd.dosageForm}
                      onChange={(e) => setNewProd({ ...newProd, dosageForm: e.target.value })}
                      className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs dark:border-slate-700 bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
                    >
                      <option value="TABLET">{isBn ? 'ট্যাবলেট' : 'Tablet'}</option>
                      <option value="CAPSULE">{isBn ? 'ক্যাপসুল' : 'Capsule'}</option>
                      <option value="SYRUP">{isBn ? 'সিরাপ' : 'Syrup'}</option>
                      <option value="SUSPENSION">{isBn ? 'সাসপেনশন' : 'Suspension'}</option>
                      <option value="INJECTION">{isBn ? 'ইনজেকশন' : 'Injection'}</option>
                      <option value="OINTMENT_CREAM">{isBn ? 'মলম / ক্রিম' : 'Ointment / Cream'}</option>
                      <option value="EYE_EAR_DROPS">{isBn ? 'চোখ / কানের ড্রপ' : 'Eye / Ear Drops'}</option>
                      <option value="INHALER_RESPULE">{isBn ? 'ইনহেলার' : 'Inhaler / Respule'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-200">
                      {isBn ? 'শক্তি / স্ট্রেন্থ' : 'Strength Specification'}
                    </label>
                    <input
                      type="text"
                      value={newProd.strength}
                      onChange={(e) => setNewProd({ ...newProd, strength: e.target.value })}
                      placeholder="500mg"
                      className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs dark:border-slate-700 bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-200">
                      {isBn ? 'ইউনিট ও র‍্যাক অবস্থান' : 'Unit & Rack Location'}
                    </label>
                    <div className="flex gap-1.5 mt-0.5">
                      <select
                        value={newProd.unitOfMeasure}
                        onChange={(e) =>
                          setNewProd({
                            ...newProd,
                            unitOfMeasure: e.target.value as Medicine['unitOfMeasure'],
                          })
                        }
                        className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white dark:border-slate-700 dark:bg-[#111827] text-slate-900 dark:text-slate-100"
                      >
                        <option value="Strip">{isBn ? 'স্ট্রিপ' : 'Strip'}</option>
                        <option value="Box">{isBn ? 'বক্স' : 'Box'}</option>
                        <option value="Bottle">{isBn ? 'বোতল' : 'Bottle'}</option>
                        <option value="Vial">{isBn ? 'ভায়াল' : 'Vial'}</option>
                        <option value="Tube">{isBn ? 'টিউব' : 'Tube'}</option>
                        <option value="Piece">{isBn ? 'পিস' : 'Piece'}</option>
                      </select>
                      <input
                        type="text"
                        value={newProd.rackLocation}
                        onChange={(e) => setNewProd({ ...newProd, rackLocation: e.target.value })}
                        placeholder="Rack A-01"
                        className="flex-1 min-w-0 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs dark:border-slate-700 bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  {/* Master Prices inside Quick Product Creator */}
                  <div className="sm:col-span-2 grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <label className="font-bold text-slate-700 text-[11px] dark:text-slate-200">
                        {isBn ? 'মাস্টার ক্রয়মূল্য (৳)' : 'Master Cost (৳)'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newProd.purchasePrice}
                        onChange={(e) =>
                          setNewProd({ ...newProd, purchasePrice: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full mt-0.5 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono dark:border-slate-700 bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 text-[11px] dark:text-slate-200">
                        {isBn ? 'মাস্টার এমআরপি (৳)' : 'Master MRP (৳)'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newProd.mrp}
                        onChange={(e) =>
                          setNewProd({ ...newProd, mrp: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full mt-0.5 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono dark:border-slate-700 bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-emerald-700 text-[11px] dark:text-emerald-300">
                        {isBn ? 'মাস্টার বিক্রয়মূল্য (৳)' : 'Master Selling (৳)'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newProd.sellingPrice}
                        onChange={(e) =>
                          setNewProd({ ...newProd, sellingPrice: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full mt-0.5 px-2 py-1.5 border border-emerald-300 bg-emerald-50/40 rounded-lg text-xs font-mono font-bold text-emerald-900 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-300 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  {/* Barcode Input */}
                  <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                    <div className="relative flex-1">
                      <Barcode className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400" />
                      <input
                        type="text"
                        value={newProd.barcode}
                        onChange={(e) => setNewProd({ ...newProd, barcode: e.target.value })}
                        placeholder={
                          isBn
                            ? 'বারকোড স্ক্যান করুন অথবা লিখুন...'
                            : 'Scan barcode or enter EAN-13 / GTIN...'
                        }
                        className="w-full pl-8 pr-2.5 py-1.5 border border-emerald-300 rounded-lg text-xs font-mono dark:border-emerald-800/70 bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const rnd = Math.floor(1000000000 + Math.random() * 9000000000).toString();
                        setNewProd({ ...newProd, barcode: `890${rnd.slice(0, 10)}` });
                      }}
                      className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-800/70"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{isBn ? 'অটো' : 'Auto'}</span>
                    </button>
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-between pt-1">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={newProd.requiresPrescription}
                        onChange={(e) =>
                          setNewProd({ ...newProd, requiresPrescription: e.target.checked })
                        }
                        className="rounded text-emerald-600 focus:ring-emerald-500 dark:text-emerald-400"
                      />
                      <span>
                        {isBn
                          ? 'প্রেসক্রিপশন আবশ্যক (Schedule H / Rx)'
                          : 'Requires Prescription (Schedule H / Rx)'}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={ensureProductCreated}
                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                    >
                      {isBn ? 'প্রোডাক্ট সংরক্ষণ করুন' : 'Save Product Master'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CARD 2: 2. BATCH, DATES & QUANTITY */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-3 shadow-2xs dark:bg-[#111827] dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold tracking-wide uppercase text-slate-800 dark:text-slate-100">
                {isBn ? '২. ব্যাচ, মেয়াদ ও প্রাপ্ত পরিমাণ' : '2. BATCH, DATES & QUANTITY'}
              </span>
              <span className="text-[11px] font-mono font-bold text-slate-500 uppercase dark:text-slate-400">
                {isBn ? `র‍্যাক: ${activeRack}` : `RACK: ${activeRack}`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Batch Number */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 dark:text-slate-200">
                  {isBn ? 'ব্যাচ নম্বর *' : 'Batch Number *'}
                </label>
                <input
                  type="text"
                  required
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="BAT-4807"
                  className="w-full px-3 py-2 bg-slate-50/70 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:bg-slate-900/70 dark:border-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              {/* Initial Received Quantity */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 dark:text-slate-200">
                  {isBn
                    ? `প্রাপ্ত প্রাথমিক পরিমাণ (${activeUnitLabel}) *`
                    : `Initial Received Quantity (${activeUnitLabel}) *`}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={initialQuantity}
                  onChange={(e) => setInitialQuantity(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 bg-white border-2 border-emerald-500/80 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-[#111827] dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              {/* Manufacturing Date */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 dark:text-slate-200">
                  {isBn ? 'উৎপাদন তারিখ' : 'Manufacturing Date'}
                </label>
                <input
                  type="date"
                  value={manufacturingDate}
                  onChange={(e) => setManufacturingDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-[#111827] dark:border-slate-700 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 dark:text-slate-200">
                  {isBn ? 'মেয়াদ উত্তীর্ণের তারিখ *' : 'Expiry Date *'}
                </label>
                <input
                  type="date"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-[#111827] dark:border-slate-700 dark:text-emerald-300 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>

          {/* CARD 3: UNIT PRICING (AUTO-FETCHED FROM PRODUCT MASTER) */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-3 dark:bg-slate-900/70 dark:border-slate-800">
            <div className="flex items-start gap-2">
              {overridePrices ? (
                <Unlock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 dark:text-amber-400" />
              ) : (
                <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5 dark:text-slate-400" />
              )}
              <div className="min-w-0">
                <div className="font-bold text-slate-800 text-xs dark:text-slate-100">
                  {isBn
                    ? 'ইউনিট মূল্য (প্রোডাক্ট মাস্টার থেকে সংগৃহীত)'
                    : 'Unit Pricing (Auto-Fetched from Product Master)'}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 dark:text-slate-400">
                  {isBn
                    ? 'প্রোডাক্ট মাস্টার থেকে স্বয়ংক্রিয়ভাবে সংগৃহীত — প্রতি ব্যাচে বারবার ম্যানুয়ালি টাইপ করার প্রয়োজন নেই'
                    : 'Auto-fetched from Product Master — no need to re-type manually on every batch'}
                </p>
              </div>
            </div>

            <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition select-none dark:bg-[#111827] dark:border-slate-700 dark:hover:bg-slate-800/60">
              <input
                type="checkbox"
                checked={overridePrices}
                onChange={(e) => setOverridePrices(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 dark:text-emerald-400"
              />
              <span className="font-bold text-slate-700 text-[11px] dark:text-slate-200">
                {isBn ? 'মূল্য পরিবর্তন / ওভাররাইড' : 'Edit Prices / Override'}
              </span>
            </label>

            <div className="grid grid-cols-3 gap-2.5">
              {/* Cost Price */}
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {isBn ? 'ক্রয়মূল্য (৳)' : 'Cost Price (৳)'}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    {overridePrices ? (isBn ? 'ম্যানুয়াল' : 'EDIT') : isBn ? 'অটো' : 'AUTO'}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs dark:text-slate-400">
                    ৳
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={!overridePrices}
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                    className={`w-full pl-6 pr-2 py-2 border rounded-lg text-xs font-mono font-semibold ${
                      overridePrices
                        ? 'bg-white border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500'
                        : 'bg-slate-100/90 border-slate-200 text-slate-600 cursor-not-allowed'
                    }`}
                  />
                </div>
              </div>

              {/* MRP */}
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {isBn ? 'এমআরপি (৳)' : 'MRP (৳)'}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    {overridePrices ? (isBn ? 'ম্যানুয়াল' : 'EDIT') : isBn ? 'অটো' : 'AUTO'}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs dark:text-slate-400">
                    ৳
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={!overridePrices}
                    value={mrp}
                    onChange={(e) => setMrp(parseFloat(e.target.value) || 0)}
                    className={`w-full pl-6 pr-2 py-2 border rounded-lg text-xs font-mono font-semibold ${
                      overridePrices
                        ? 'bg-white border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500'
                        : 'bg-slate-100/90 border-slate-200 text-slate-600 cursor-not-allowed'
                    }`}
                  />
                </div>
              </div>

              {/* Selling Price */}
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {isBn ? 'বিক্রয়মূল্য (৳)' : 'Selling Price (৳)'}
                  </span>
                  <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider dark:text-emerald-400">
                    {overridePrices ? (isBn ? 'ম্যানুয়াল' : 'EDIT') : isBn ? 'মাস্টার' : 'MASTER'}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-700 font-bold text-xs dark:text-emerald-300">
                    ৳
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={!overridePrices}
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                    className={`w-full pl-6 pr-2 py-2 border rounded-lg text-xs font-mono font-bold ${
                      overridePrices
                        ? 'bg-white border-emerald-400 text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500'
                        : 'bg-emerald-50/80 border-emerald-200 text-emerald-800 cursor-not-allowed'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="pt-2 border-t border-slate-200 space-y-2.5 dark:border-slate-800">
            <div className="text-xs text-slate-600 font-semibold dark:text-slate-300">
              {isBn ? 'মোট ইনওয়ার্ড ভ্যালু: ' : 'Total Inward Value: '}
              <span className="font-mono font-extrabold text-slate-900 dark:text-white">৳{formattedTotalValue}</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 rounded-lg font-semibold text-xs cursor-pointer transition dark:border-slate-700 dark:bg-[#111827] dark:hover:bg-slate-800 dark:text-slate-200"
              >
                {isBn ? 'বাতিল করুন' : 'Cancel'}
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(true)}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg font-bold text-xs cursor-pointer transition disabled:opacity-50 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:border-indigo-800/70 dark:text-indigo-300"
                >
                  {isBn ? '+ সংরক্ষণ ও পরবর্তী ব্যাচ' : '+ Save & Next Batch'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer transition disabled:opacity-50"
                >
                  {isSubmitting
                    ? isBn
                      ? 'সংরক্ষণ হচ্ছে...'
                      : 'Saving...'
                    : isBn
                      ? 'ইনভয়েস ও ব্যাচ নিশ্চিত করুন'
                      : 'Confirm Invoice & Batch Entry'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
