import React, { useState, useMemo, useEffect } from 'react';
import { 
  Truck, 
  Plus, 
  Search, 
  DollarSign, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Building, 
  X, 
  Trash2,
  Boxes,
  FileCheck,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  Eye,
  CreditCard,
  FileText,
  Check,
  Layers,
  RefreshCw,
  PackageCheck,
  Receipt,
  Scale,
  Sparkles,
  Building2,
  FileSpreadsheet
} from 'lucide-react';
import { 
  PurchaseOrder, 
  PurchaseItem, 
  Supplier, 
  Medicine, 
  SupplierLedgerEntry,
  PurchaseOrderStatusType
} from '../../types/pharmacy';
import { PharmacyService } from '../../services/pharmacyService';
import { PurchaseOrderSuggester } from './PurchaseOrderSuggester';
import { AdvancedPurchaseHub } from './AdvancedPurchaseHub';
import { CompanyStockValuationView } from './CompanyStockValuationView';
import { ExcelChalanEntryView } from './ExcelChalanEntryView';
import { supplierApi, batchApi } from '../../lib/api';
import { AuditService } from '../../services/auditService';

interface PurchaseOrdersViewProps {
  onDataChanged?: () => void;
  initialSubTab?: ActiveSubTab;
}

type ActiveSubTab = 'register' | 'create_po' | 'supplier_ledger' | 'po_suggester' | 'advanced_scm' | 'company_valuation' | 'excel_chalan';

interface GRNItemFormState {
  purchaseItemId?: string;
  medicineId: string;
  medicineName: string;
  dosageForm: string;
  unitOfMeasure?: string;
  packSize: number;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  orderedQuantity: number;
  receivedQuantity: number;
  freeQuantity: number;
  damagedQuantity: number;
  unitPurchasePrice: number;
  mrp: number;
  sellingPrice: number;
  taxRate: number;
  rackLocation: string;
}

export const PurchaseOrdersView: React.FC<PurchaseOrdersViewProps> = ({ onDataChanged, initialSubTab }) => {
  // Service Data
  const [purchases, setPurchases] = useState<PurchaseOrder[]>(() => PharmacyService.getPurchases());
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => PharmacyService.getSuppliers());
  const [medicines, setMedicines] = useState<Medicine[]>(() => PharmacyService.getMedicines());

  // Navigation Sub-tab
  const [activeTab, setActiveTab] = useState<ActiveSubTab>(initialSubTab || 'register');

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    return PharmacyService.subscribe(() => {
      refreshData();
    });
  }, []);

  const lowStockCount = useMemo(() => {
    return PharmacyService.getLowStockAlertMedicines().length;
  }, [purchases]);

  // Search & Filter in Register
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PurchaseOrderStatusType>('ALL');

  // Supplier Ledger Tab selection
  const [selectedSupplierForLedger, setSelectedSupplierForLedger] = useState<string>(suppliers[0]?.id || '');
  const [showPaymentModal, setShowPaymentModal] = useState<Supplier | null>(null);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState<boolean>(false);
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({
    name: '',
    companyName: '',
    phone: '',
    email: '',
    address: '',
    drugLicenseNumber: '',
    taxId: '',
    paymentTermsDays: 30,
    balancePayable: 0
  });
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Bank Transfer');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // PO Detail / View Modal
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);

  // GRN Engine Modal State
  const [grnModalPO, setGrnModalPO] = useState<PurchaseOrder | null>(null);
  const [grnVendorInvoice, setGrnVendorInvoice] = useState('');
  const [grnWarehouse, setGrnWarehouse] = useState('Main Central Pharmacy Depot');
  const [grnReceiveMode, setGrnReceiveMode] = useState<'full' | 'partial' | 'damaged'>('full');
  const [grnReceivedDate, setGrnReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [grnPaidAmount, setGrnPaidAmount] = useState<number>(0);
  const [grnPaymentMethod, setGrnPaymentMethod] = useState<'Bank Transfer' | 'Cash' | 'Card' | 'Cheque'>('Bank Transfer');
  const [grnItems, setGrnItems] = useState<GRNItemFormState[]>([]);
  const [grnError, setGrnError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // --- NEW PURCHASE ORDER FORM STATE ---
  const [poSupplierId, setPoSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [poPaymentTerms, setPoPaymentTerms] = useState<string>('Net 30');

  // Derived fallback: poSupplierId defaults to suppliers[0]?.id if not set

  const [poOrderDate, setPoOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [poExpectedDelivery, setPoExpectedDelivery] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [poProformaInv, setPoProformaInv] = useState<string>('');
  const [poNotes, setPoNotes] = useState<string>('');

  // PO Product Grid Line Items
  const [poItems, setPoItems] = useState<Array<{
    medicineId: string;
    unitType: 'Box' | 'Strip' | 'Piece';
    packSize: number;
    unitPurchasePrice: number;
    orderedQuantity: number;
    freeQuantity: number;
    expectedMrp: number;
    sellingPrice: number;
    discountPercent: number;
    taxRate: number;
  }>>([
    {
      medicineId: medicines[0]?.id || '',
      unitType: 'Box',
      packSize: medicines[0]?.packSize || 10,
      unitPurchasePrice: 5.50,
      orderedQuantity: 50,
      freeQuantity: 5,
      expectedMrp: 12.50,
      sellingPrice: 11.00,
      discountPercent: 2.5,
      taxRate: 5,
    }
  ]);

  const refreshData = () => {
    setPurchases([...PharmacyService.getPurchases()]);
    setSuppliers(PharmacyService.getSuppliers());
    setMedicines(PharmacyService.getMedicines());
    if (onDataChanged) onDataChanged();
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Selected supplier details for PO creation
  const currentPoSupplier = useMemo(() => {
    return suppliers.find(s => s.id === poSupplierId) || suppliers[0];
  }, [suppliers, poSupplierId]);

  // Filter medicines so we only show ones manufactured by the selected vendor
  const filteredMedicines = useMemo(() => {
    if (!currentPoSupplier) return medicines;
    const vendorName = (currentPoSupplier.name || '').toLowerCase();
    const companyName = (currentPoSupplier.companyName || '').toLowerCase();
    
    const matched = medicines.filter(m => {
      const rawMfr = typeof m.manufacturer === 'object' && m.manufacturer ? m.manufacturer.name : m.manufacturer;
      const mfr = (rawMfr || '').toLowerCase();
      if (!mfr) return false;
      return mfr === vendorName || mfr === companyName || 
             (vendorName && vendorName.includes(mfr)) || (companyName && companyName.includes(mfr)) || 
             mfr.includes(vendorName) || mfr.includes(companyName);
    });

    // If no medicines match this supplier perfectly, we return all as a fallback so they aren't stuck
    return matched.length > 0 ? matched : medicines;
  }, [medicines, currentPoSupplier]);

  // Calculations for PO Product Grid
  const poCalculations = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    poItems.forEach(it => {
      const lineRaw = it.unitPurchasePrice * it.orderedQuantity;
      const disc = lineRaw * (it.discountPercent / 100);
      const tax = (lineRaw - disc) * (it.taxRate / 100);

      subtotal += lineRaw;
      totalDiscount += disc;
      totalTax += tax;
    });

    const grandTotal = subtotal - totalDiscount + totalTax;

    return {
      subtotal,
      totalDiscount,
      totalTax,
      grandTotal,
      netPayable: grandTotal
    };
  }, [poItems]);

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const matchesSearch = 
        (p.poNumber && p.poNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.supplierName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || (p.status || 'received') === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [purchases, searchQuery, statusFilter]);

  // Overall KPI statistics
  const kpiStats = useMemo(() => {
    const totalOrders = purchases.length;
    const pendingDeliveries = purchases.filter(p => p.status === 'ordered' || p.status === 'draft').length;
    const totalPayable = suppliers.reduce((sum, s) => sum + (s?.balancePayable != null ? Number(s.balancePayable) : 0), 0);
    const completedGrns = purchases.filter(p => p.status === 'received' || p.status === 'partially_received').length;

    return { totalOrders, pendingDeliveries, totalPayable, completedGrns };
  }, [purchases, suppliers]);

  // --- Handlers for PO Creation ---
  const handleAddPoItemRow = () => {
    const defaultMed = medicines[0];
    setPoItems([
      ...poItems,
      {
        medicineId: defaultMed?.id || '',
        unitType: 'Box',
        packSize: defaultMed?.packSize || 10,
        unitPurchasePrice: 4.20,
        orderedQuantity: 20,
        freeQuantity: 0,
        expectedMrp: 10.00,
        sellingPrice: 9.00,
        discountPercent: 0,
        taxRate: defaultMed?.taxRate || 5,
      }
    ]);
  };

  const handleRemovePoItemRow = (index: number) => {
    if (poItems.length === 1) {
      showToast('error', 'PO must contain at least one medicine item.');
      return;
    }
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const handleUpdatePoItemField = (index: number, field: string, value: any) => {
    const updated = [...poItems];
    const item = { ...updated[index], [field]: value };

    if (field === 'medicineId') {
      const med = medicines.find(m => m.id === value);
      if (med) {
        item.packSize = med.packSize || 10;
        item.taxRate = med.taxRate || 5;
      }
    }

    updated[index] = item;
    setPoItems(updated);
  };

  const handleSubmitPurchaseOrder = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[DEBUG-PO] handleSubmitPurchaseOrder triggered! poItems count:', poItems.length, 'suppliers count:', suppliers.length, 'poSupplierId:', poSupplierId);
    try {
      if (poItems.length === 0) {
        showToast('error', 'Please add at least one medicine item to the PO.');
        return;
      }

      const formattedItems: PurchaseItem[] = poItems.map((it, idx) => {
        const targetMedId = it.medicineId || (filteredMedicines[0] || medicines[0])?.id || 'med-default';
        const med = medicines.find(m => m.id === targetMedId);
        const lineRaw = it.unitPurchasePrice * it.orderedQuantity;
        const disc = lineRaw * (it.discountPercent / 100);
        const tax = (lineRaw - disc) * (it.taxRate / 100);
        const lineTotal = lineRaw - disc + tax;

        return {
          id: `pi-${idx}-${Date.now()}`,
          medicineId: targetMedId,
          medicineName: med?.name || 'Medicine Item',
          dosageForm: (med?.dosageForm as any) || 'TABLET',
          batchNumber: `PENDING-${Date.now().toString().slice(-4)}`,
          manufacturingDate: new Date().toISOString().split('T')[0],
          expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
          quantity: it.orderedQuantity * it.packSize,
          orderedQuantity: it.orderedQuantity,
          freeQuantity: it.freeQuantity,
          unitPurchasePrice: it.unitPurchasePrice,
          purchasePrice: it.unitPurchasePrice,
          expectedMrp: it.expectedMrp,
          mrp: it.expectedMrp,
          sellingPrice: it.sellingPrice,
          discountPercent: it.discountPercent,
          taxRate: it.taxRate,
          taxAmount: tax,
          totalAmount: lineTotal,
          unitType: it.unitType,
          packSize: it.packSize,
          rackLocation: med?.rackLocation || 'Shelf-01'
        };
      });

      const effectiveSupplierId = poSupplierId || suppliers[0]?.id;
      if (!effectiveSupplierId) {
        showToast('error', 'Please select or add a supplier first.');
        return;
      }

      const newPo = PharmacyService.createPurchaseOrder({
        supplierId: effectiveSupplierId,
        paymentTerms: poPaymentTerms,
        expectedDeliveryDate: poExpectedDelivery,
        orderDate: poOrderDate,
        invoiceNumber: poProformaInv.trim() || undefined,
        notes: poNotes,
        items: formattedItems
      });

      refreshData();
      showToast('success', `Purchase Order ${newPo.poNumber} successfully generated for ${newPo.supplierName}!`);
      setActiveTab('register');
    } catch (err: any) {
      console.error('[DEBUG-PO] Failed to create PO error:', err);
      showToast('error', err.message || 'Failed to create Purchase Order.');
    }
  };

  // --- Handlers for GRN Engine Modal ---
  const handleOpenGrnModal = (po: PurchaseOrder) => {
    setGrnModalPO(po);
    setGrnVendorInvoice(po.invoiceNumber.startsWith('PROFORMA') ? `INV-${Math.floor(1000 + Math.random() * 9000)}` : po.invoiceNumber);
    setGrnWarehouse('Main Central Pharmacy Depot');
    setGrnReceiveMode('full');
    setGrnReceivedDate(new Date().toISOString().split('T')[0]);
    setGrnPaidAmount(po.paymentStatus === 'paid' ? po.totalAmount : 0);
    setGrnError(null);

    // Build GRN line item states from PO items
    const futureYear = new Date();
    futureYear.setFullYear(futureYear.getFullYear() + 2);
    const defaultFutureExp = futureYear.toISOString().split('T')[0];

    const initialGrnRows: GRNItemFormState[] = po.items.map(it => {
      const med = medicines.find(m => m.id === it.medicineId);
      return {
        purchaseItemId: it.id,
        medicineId: it.medicineId,
        medicineName: it.medicineName,
        dosageForm: it.dosageForm,
        unitOfMeasure: med?.unitOfMeasure,
        packSize: it.packSize || med?.packSize || 1,
        batchNumber: it.batchNumber.startsWith('PENDING') ? `BTH-${Math.floor(100 + Math.random() * 900)}` : it.batchNumber,
        manufacturingDate: it.manufacturingDate || new Date().toISOString().split('T')[0],
        expiryDate: it.expiryDate || defaultFutureExp,
        orderedQuantity: it.orderedQuantity || it.quantity,
        receivedQuantity: it.orderedQuantity || it.quantity,
        freeQuantity: it.freeQuantity || 0,
        damagedQuantity: 0,
        unitPurchasePrice: it.purchasePrice,
        mrp: it.mrp || (it.purchasePrice * 1.5),
        sellingPrice: it.sellingPrice || (it.purchasePrice * 1.3),
        taxRate: it.taxRate || 5,
        rackLocation: it.rackLocation || med?.rackLocation || 'Rack A-01'
      };
    });

    setGrnItems(initialGrnRows);
  };

  const handleUpdateGrnItem = (index: number, field: keyof GRNItemFormState, value: any) => {
    const updated = [...grnItems];
    updated[index] = { ...updated[index], [field]: value };
    setGrnItems(updated);
  };

  const handleConfirmGrnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGrnError(null);

    if (!grnModalPO) return;

    if (!grnVendorInvoice.trim()) {
      setGrnError('Vendor Invoice / Bill Number is mandatory for Goods Receipt.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Regulatory Expiry Date check before submission
    for (const it of grnItems) {
      if (it.expiryDate <= todayStr) {
        setGrnError(`REGULATORY BREACH: Expiry date (${it.expiryDate}) for ${it.medicineName} (Batch ${it.batchNumber}) is in the past! Expired goods cannot be committed to inventory.`);
        return;
      }
      if (it.expiryDate <= it.manufacturingDate) {
        setGrnError(`Chronological Error: Expiry date must be after manufacturing date for batch ${it.batchNumber}.`);
        return;
      }
    }

    try {
      // 1. Sync Batches to Postgres Backend FIRST
      const allBatches = PharmacyService.getBatches();
      for (const it of grnItems) {
        const totalInwardStock = Number(it.receivedQuantity) + Number(it.freeQuantity);
        const existingBatch = allBatches.find(
          b => b.medicineId === it.medicineId && b.batchNumber.toUpperCase() === it.batchNumber.trim().toUpperCase()
        );

        const payload = {
          productId: it.medicineId,
          batchNumber: it.batchNumber.trim().toUpperCase(),
          manufacturingDate: it.manufacturingDate ? new Date(it.manufacturingDate).toISOString() : new Date().toISOString(),
          expiryDate: new Date(it.expiryDate).toISOString(),
          purchasePrice: Number(it.unitPurchasePrice),
          mrp: Number(it.mrp),
          unitSellingPrice: Number(it.sellingPrice),
          initialQuantity: totalInwardStock,
          currentStock: existingBatch ? existingBatch.currentStock + totalInwardStock : totalInwardStock,
          status: 'ACTIVE',
          rackLocation: `${grnWarehouse} - ${it.rackLocation}`
        };

        if (existingBatch) {
          await batchApi.updateBatch(existingBatch.id, payload);
        } else {
          await batchApi.createBatch(payload);
        }
      }

      // 2. Perform Local Updates (PharmacyService)
      const result = PharmacyService.receiveGoodsReceiptNote({
        poId: grnModalPO.id,
        vendorInvoiceNumber: grnVendorInvoice,
        receivedDate: grnReceivedDate,
        receivingWarehouse: grnWarehouse,
        receiveMode: grnReceiveMode,
        paidAmount: grnPaidAmount,
        paymentMethod: grnPaymentMethod,
        items: grnItems.map(it => ({
          purchaseItemId: it.purchaseItemId,
          medicineId: it.medicineId,
          medicineName: it.medicineName,
          dosageForm: it.dosageForm,
          batchNumber: it.batchNumber,
          manufacturingDate: it.manufacturingDate,
          expiryDate: it.expiryDate,
          receivedQuantity: Number(it.receivedQuantity),
          freeQuantity: Number(it.freeQuantity),
          damagedQuantity: Number(it.damagedQuantity),
          unitPurchasePrice: Number(it.unitPurchasePrice),
          mrp: Number(it.mrp),
          sellingPrice: Number(it.sellingPrice),
          taxRate: Number(it.taxRate),
          rackLocation: it.rackLocation
        }))
      });

      // 3. Sync Supplier Balance to Backend API
      const updatedSupplier = PharmacyService.getSuppliers().find(s => s.id === result.po.supplierId);
      if (updatedSupplier) {
        try {
          await supplierApi.updateSupplier(updatedSupplier.id, { balancePayable: updatedSupplier.balancePayable });
        } catch (e) {
          console.error("Failed to sync supplier balance:", e);
        }
      }

      // 4. Record Audit Log for Inward Batches
      grnItems.forEach(it => {
        AuditService.recordAuditLog({
          userId: 'usr-storekeeper-01',
          userName: 'Dr. Shahabuddin Ahmed',
          userRole: 'Storekeeper',
          action: 'CREATE',
          module: 'inventory',
          targetEntityId: it.batchNumber,
          targetEntityType: 'Batch',
          summary: `Inward Batch ${it.batchNumber} (${it.medicineName}) via GRN for PO #${result.po.poNumber} — ${Number(it.receivedQuantity) + Number(it.freeQuantity)} pcs, Exp: ${it.expiryDate}`,
          beforeState: null,
          afterState: {
            batchNumber: it.batchNumber,
            medicineName: it.medicineName,
            receivedQuantity: it.receivedQuantity,
            freeQuantity: it.freeQuantity,
            poNumber: result.po.poNumber,
            expiryDate: it.expiryDate
          }
        });
      });

      refreshData();
      setGrnModalPO(null);
      showToast('success', `GRN Confirmed for PO ${result.po.poNumber}. ${result.batchesCreatedCount} batches added to active stock. Supplier ledger updated.`);
    } catch (err: any) {
      console.error(err);
      setGrnError(err.message || err.response?.data?.error || 'Failed to confirm Goods Receipt in Database.');
    }
  };

  // --- Handlers for Supplier Payment ---
  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPaymentModal) return;

    if (paymentAmount <= 0) {
      showToast('error', 'Payment amount must be greater than zero.');
      return;
    }

    try {
      const supplierIdToUpdate = showPaymentModal.id;
      PharmacyService.recordSupplierPayment(
        supplierIdToUpdate,
        paymentAmount,
        paymentMethod,
        paymentRef,
        paymentNotes
      );

      // Sync Supplier Balance to Backend API
      const updatedSupplier = PharmacyService.getSuppliers().find(s => s.id === supplierIdToUpdate);
      if (updatedSupplier) {
        try {
          await supplierApi.updateSupplier(updatedSupplier.id, { balancePayable: updatedSupplier.balancePayable });
        } catch (e) {
          console.error("Failed to sync supplier balance:", e);
        }
      }

      refreshData();
      setShowPaymentModal(null);
      setPaymentAmount(0);
      setPaymentRef('');
      setPaymentNotes('');
      showToast('success', `Settlement payment of $${(paymentAmount != null ? Number(paymentAmount) : 0).toFixed(2)} recorded for ${showPaymentModal.name}.`);
    } catch (err: any) {
      showToast('error', err.message || 'Payment recording failed.');
    }
  };

  // Supplier Ledger Entries for selected supplier
  const supplierLedgerEntries = useMemo(() => {
    if (!selectedSupplierForLedger) return [];
    return PharmacyService.getSupplierLedger(selectedSupplierForLedger);
  }, [selectedSupplierForLedger, purchases, suppliers]);

  const activeSupplierData = useMemo(() => {
    return suppliers.find(s => s.id === selectedSupplierForLedger) || suppliers[0];
  }, [suppliers, selectedSupplierForLedger]);

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name?.trim() || !newSupplier.companyName?.trim()) {
      showToast('error', 'Please provide both contact person name and pharmaceutical company name.');
      return;
    }

    try {
      const supplierData = {
        name: newSupplier.name.trim(),
        companyName: newSupplier.companyName.trim(),
        phone: newSupplier.phone?.trim() || '+880 1700-000000',
        email: newSupplier.email?.trim() || `supply@${newSupplier.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        address: newSupplier.address?.trim() || 'Dhaka, Bangladesh',
        tradeLicenseNo: newSupplier.drugLicenseNumber?.trim() || `DL-DGDA-${Math.floor(1000 + Math.random() * 9000)}`,
        taxId: newSupplier.taxId?.trim() || `TIN-${Math.floor(100000000 + Math.random() * 900000000)}`,
        paymentTermsDays: Number(newSupplier.paymentTermsDays) || 30,
        balancePayable: Number(newSupplier.balancePayable) || 0
      };

      const createdSupplierFromDb = await supplierApi.createSupplier(supplierData);

      // Map backend fields to frontend interface
      const createdSupplier: Supplier = {
        id: createdSupplierFromDb.id,
        name: createdSupplierFromDb.name,
        companyName: createdSupplierFromDb.companyName || '',
        phone: createdSupplierFromDb.phone,
        email: createdSupplierFromDb.email || '',
        address: createdSupplierFromDb.address || '',
        drugLicenseNumber: createdSupplierFromDb.tradeLicenseNo || supplierData.tradeLicenseNo,
        taxId: createdSupplierFromDb.taxId || '',
        paymentTermsDays: createdSupplierFromDb.paymentTermsDays,
        balancePayable: Number(createdSupplierFromDb.balancePayable)
      };

      PharmacyService.addSupplier(createdSupplier);
      refreshData();
      setSelectedSupplierForLedger(createdSupplier.id);
      setPoSupplierId(createdSupplier.id);
      setShowAddSupplierModal(false);
      setNewSupplier({
        name: '',
        companyName: '',
        phone: '',
        email: '',
        address: '',
        drugLicenseNumber: '',
        taxId: '',
        paymentTermsDays: 30,
        balancePayable: 0
      });
      showToast('success', `New company/supplier "${createdSupplier.companyName}" successfully registered!`);
    } catch (error: any) {
      console.error("Failed to add supplier:", error);
      showToast('error', error.response?.data?.error || 'Failed to create supplier in database. Please check your connection.');
    }
  };

  return (
    <div className="space-y-4 w-full">
      
      {/* Toast Notification */}
      {notification && (
        <div 
          id="toast-notification"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold animate-fade-in ${
            notification.type === 'success' 
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{notification.message}</span>
          <button 
            onClick={() => setNotification(null)}
            className="ml-2 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-900">
                Supplier Management & Purchase Inward Workflow
              </h2>
              <p className="text-xs text-slate-500">
                End-to-end Purchase Orders (PO), Goods Received Note (GRN) batch registration with future-expiry validation, and double-entry Supplier Ledgers.
              </p>
            </div>
          </div>
        </div>

        {/* Sub-tab Pill Navigation & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              id="tab-btn-register"
              onClick={() => setActiveTab('register')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'register' 
                  ? 'bg-white text-slate-900 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>PO & GRN Register</span>
            </button>

            <button
              id="tab-btn-create-po"
              onClick={() => setActiveTab('create_po')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'create_po' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Purchase Order</span>
            </button>

            <button
              id="tab-btn-ledger"
              onClick={() => setActiveTab('supplier_ledger')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'supplier_ledger' 
                  ? 'bg-white text-slate-900 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-indigo-600" />
              <span>Supplier Ledger & Payables</span>
            </button>

            <button
              id="tab-btn-suggester"
              onClick={() => setActiveTab('po_suggester')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'po_suggester' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Auto PO Suggester</span>
              {lowStockCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'po_suggester' ? 'bg-white text-emerald-800' : 'bg-rose-500 text-white'
                }`}>
                  {lowStockCount}
                </span>
              )}
            </button>

            <button
              id="tab-btn-advanced-scm"
              onClick={() => setActiveTab('advanced_scm')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'advanced_scm' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>PR, GRN &amp; Price Matrix</span>
            </button>

            <button
              id="tab-btn-company-valuation"
              onClick={() => setActiveTab('company_valuation')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'company_valuation' 
                  ? 'bg-indigo-700 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Company Stock Valuation</span>
            </button>

            <button
              id="tab-btn-excel-chalan"
              onClick={() => setActiveTab('excel_chalan')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'excel_chalan' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
              <span>Excel Chalan Entry</span>
            </button>
          </div>

          <button
            id="btn-add-supplier-top"
            type="button"
            onClick={() => setShowAddSupplierModal(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
            title="Register a new pharmaceutical company or vendor"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Purchase Orders</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-900">{kpiStats.totalOrders}</span>
            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium">All Time</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Awaiting GRN Inward</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-amber-600">{kpiStats.pendingDeliveries}</span>
            <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-bold">Action Required</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Accounts Payable</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-rose-600">${(kpiStats?.totalPayable != null ? Number(kpiStats.totalPayable) : 0).toFixed(2)}</span>
            <span className="text-[10px] text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded font-bold">Vendor Liability</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Received GRN Batches</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-emerald-600">{kpiStats.completedGrns}</span>
            <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-medium">Stock Active</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PURCHASE ORDERS & GRN REGISTER */}
      {/* ========================================================================= */}
      {activeTab === 'register' && (
        <div className="space-y-4">
          {/* Automated Replenishment Notification Banner */}
          {lowStockCount > 0 && (
            <div id="banner-reorder-alert" className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2.5 text-amber-900">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold">Automated Replenishment Alert: </span>
                  <span className="text-amber-800">
                    <strong>{lowStockCount} item(s)</strong> are at or below reorder threshold. Run the Auto PO Suggester to calculate optimal quantities by supplier.
                  </span>
                </div>
              </div>
              <button
                id="btn-goto-suggester-from-banner"
                type="button"
                onClick={() => setActiveTab('po_suggester')}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 cursor-pointer flex items-center gap-1.5 shadow-xs transition"
              >
                <span>Launch PO Suggester</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Filter and Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="search-po-input"
                type="text"
                placeholder="Search by PO #, Vendor Invoice, or Supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(['ALL', 'ordered', 'partially_received', 'received', 'draft'] as const).map(st => (
                <button
                  key={st}
                  id={`filter-st-${st}`}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-colors cursor-pointer whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px]">
                    <th className="py-3 px-4">PO & Bill Reference</th>
                    <th className="py-3 px-4">Distributor / Supplier</th>
                    <th className="py-3 px-4">Order / Delivery Date</th>
                    <th className="py-3 px-4">Line Items</th>
                    <th className="py-3 px-4">GRN Status</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Grand Total</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No purchase orders match your query.
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map(po => {
                      const isReceived = po.status === 'received';
                      const isPartial = po.status === 'partially_received';
                      const isOrdered = po.status === 'ordered' || po.status === 'draft';

                      return (
                        <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-slate-900">{po.poNumber || po.id}</div>
                            <div className="text-[11px] text-slate-500 font-mono">Inv: {po.invoiceNumber}</div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{po.supplierName}</div>
                            {po.paymentTerms && (
                              <div className="text-[10px] text-slate-500">Terms: {po.paymentTerms}</div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="text-slate-700">{po.purchaseDate}</div>
                            {po.expectedDeliveryDate && (
                              <div className="text-[10px] text-slate-500">ETA: {po.expectedDeliveryDate}</div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-slate-600">
                            <div>{po.items.length} product(s)</div>
                            <div className="text-[10px] text-slate-500">
                              {po.items.reduce((s, it) => s + (it.receivedQuantity || it.quantity), 0)} base units
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              isReceived
                                ? 'bg-emerald-100 text-emerald-800'
                                : isPartial
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {isReceived && <Check className="w-2.5 h-2.5" />}
                              {isPartial && <Clock className="w-2.5 h-2.5" />}
                              {isOrdered && <PackageCheck className="w-2.5 h-2.5" />}
                              <span>{po.status || 'received'}</span>
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                              po.paymentStatus === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : po.paymentStatus === 'partial'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {po.paymentStatus}
                            </span>
                            {po.dueAmount != null && Number(po.dueAmount) > 0 && (
                              <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
                                Due: ${Number(po.dueAmount).toFixed(2)}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                            ${(po.totalAmount != null ? Number(po.totalAmount) : 0).toFixed(2)}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Receive GRN Action Button */}
                              {!isReceived && (
                                <button
                                  id={`btn-receive-grn-${po.id}`}
                                  onClick={() => handleOpenGrnModal(po)}
                                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap"
                                  title="Perform Goods Receipt and Batch Entry"
                                >
                                  <PackageCheck className="w-3.5 h-3.5" />
                                  <span>Receive GRN</span>
                                </button>
                              )}

                              {/* View Details Button */}
                              <button
                                id={`btn-view-po-${po.id}`}
                                onClick={() => {
                                  // Always re-read from source to get latest paid/due amounts
                                  const freshPurchases = PharmacyService.getPurchases();
                                  const freshPO = freshPurchases.find(p => p.id === po.id) || po;
                                  setViewingPO(freshPO);
                                }}
                                className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors cursor-pointer"
                                title="View Purchase Inward Voucher"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CREATE PURCHASE ORDER (PO) FORM */}
      {/* ========================================================================= */}
      {activeTab === 'create_po' && (
        <form onSubmit={handleSubmitPurchaseOrder} className="space-y-4">
          {/* Suggester Shortcut Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-emerald-900">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Want automated replenishment recommendations? Use the <strong>Auto PO Suggester</strong> to analyze 30-day sales velocity and generate multi-supplier requisitions in one click.
              </span>
            </div>
            <button
              id="btn-goto-suggester-from-create-tab"
              type="button"
              onClick={() => setActiveTab('po_suggester')}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 cursor-pointer flex items-center gap-1.5 shadow-xs transition"
            >
              <span>Launch PO Suggester</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Header Card: Supplier Details & Payment Terms */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building className="w-4 h-4 text-emerald-600" />
                <span>Supplier Information & Commercial Terms</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono">Step 1 of 2</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              {/* Supplier Selection */}
              <div>
                <label className="font-bold text-slate-700">Vendor / Distributor *</label>
                <select
                  id="po-supplier-select"
                  value={poSupplierId}
                  onChange={(e) => setPoSupplierId(e.target.value)}
                  className="w-full mt-1.5 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.companyName})</option>
                  ))}
                </select>
                <div className="mt-1 text-[11px] text-slate-500">
                  DL: {currentPoSupplier?.drugLicenseNumber} | TIN: {currentPoSupplier?.taxId}
                </div>
              </div>

              {/* Payment Terms */}
              <div>
                <label className="font-bold text-slate-700">Payment Terms *</label>
                <select
                  id="po-terms-select"
                  value={poPaymentTerms}
                  onChange={(e) => setPoPaymentTerms(e.target.value)}
                  className="w-full mt-1.5 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Net 15">Net 15 Days</option>
                  <option value="Net 30">Net 30 Days (Standard)</option>
                  <option value="Net 60">Net 60 Days</option>
                  <option value="Cash on Delivery">Cash on Delivery (COD)</option>
                  <option value="Advance">100% Advance Payment</option>
                </select>
                <div className="mt-1 text-[11px] text-slate-500">
                  Credit Window: {currentPoSupplier?.paymentTermsDays || 30} days
                </div>
              </div>

              {/* PO Date */}
              <div>
                <label className="font-bold text-slate-700">Order Date *</label>
                <input
                  id="po-order-date"
                  type="date"
                  required
                  value={poOrderDate}
                  onChange={(e) => setPoOrderDate(e.target.value)}
                  className="w-full mt-1.5 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Expected Delivery Date */}
              <div>
                <label className="font-bold text-slate-700">Expected Delivery Date *</label>
                <input
                  id="po-expected-delivery"
                  type="date"
                  required
                  value={poExpectedDelivery}
                  onChange={(e) => setPoExpectedDelivery(e.target.value)}
                  className="w-full mt-1.5 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Optional Proforma / Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
              <div>
                <label className="font-bold text-slate-700">Vendor Proforma Quote / Ref # (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. QUOTE-2026-981"
                  value={poProformaInv}
                  onChange={(e) => setPoProformaInv(e.target.value)}
                  className="w-full mt-1.5 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700">Order Instructions & Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Ensure cold-chain temperature monitor included during transit."
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  className="w-full mt-1.5 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Product Grid Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-emerald-600" />
                  <span>Pharmaceutical Product Grid & Unit Pricing</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Select unit/box size, purchase rate, bonus items, trade discount, and VAT.
                </p>
              </div>

              <button
                type="button"
                id="btn-add-po-row"
                onClick={handleAddPoItemRow}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Medicine Row</span>
              </button>
            </div>

            {/* Itemized Grid Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px]">
                    <th className="py-2.5 px-3 w-64">Medicine & Generic</th>
                    <th className="py-2.5 px-3 w-28">Unit / Pack</th>
                    <th className="py-2.5 px-3 w-24">Unit Cost ($)</th>
                    <th className="py-2.5 px-3 w-20">Order Qty</th>
                    <th className="py-2.5 px-3 w-20 text-emerald-700">Free Bonus</th>
                    <th className="py-2.5 px-3 w-24">Exp. MRP ($)</th>
                    <th className="py-2.5 px-3 w-20">Disc %</th>
                    <th className="py-2.5 px-3 w-20">VAT %</th>
                    <th className="py-2.5 px-3 text-right w-28">Net Line Total</th>
                    <th className="py-2.5 px-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {poItems.map((row, idx) => {
                    const lineRaw = row.unitPurchasePrice * row.orderedQuantity;
                    const disc = lineRaw * (row.discountPercent / 100);
                    const tax = (lineRaw - disc) * (row.taxRate / 100);
                    const lineTotal = lineRaw - disc + tax;
                    const selectedMed = medicines.find(m => m.id === row.medicineId);

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        {/* Medicine Selector */}
                        <td className="py-2 px-3">
                          <select
                            value={row.medicineId}
                            onChange={(e) => handleUpdatePoItemField(idx, 'medicineId', e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-emerald-500"
                          >
                            {filteredMedicines.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.strength}) - {typeof m.manufacturer === 'object' && m.manufacturer ? m.manufacturer.name : m.manufacturer}
                              </option>
                            ))}
                          </select>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            {selectedMed?.genericName} • Stock: {selectedMed?.packSize || 1} units/pack
                          </div>
                        </td>

                        {/* Unit / Pack Size Selection */}
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            <select
                              value={row.unitType}
                              onChange={(e) => handleUpdatePoItemField(idx, 'unitType', e.target.value)}
                              className="px-1.5 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                            >
                              <option value="Box">Box</option>
                              <option value="Strip">Strip</option>
                              <option value="Piece">Pcs</option>
                            </select>
                            <input
                              type="number"
                              min="1"
                              value={row.packSize}
                              onChange={(e) => handleUpdatePoItemField(idx, 'packSize', Math.max(1, Number(e.target.value)))}
                              className="w-12 px-1.5 py-1 bg-slate-50 border border-slate-300 rounded text-xs text-center"
                              title="Units per box/pack"
                            />
                          </div>
                        </td>

                        {/* Unit Purchase Cost */}
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={row.unitPurchasePrice}
                            onChange={(e) => handleUpdatePoItemField(idx, 'unitPurchasePrice', Number(e.target.value))}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono font-bold text-slate-800"
                          />
                        </td>

                        {/* Order Quantity */}
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="1"
                            value={row.orderedQuantity}
                            onChange={(e) => handleUpdatePoItemField(idx, 'orderedQuantity', Math.max(1, Number(e.target.value)))}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-center"
                          />
                        </td>

                        {/* Free / Bonus Quantity */}
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="0"
                            value={row.freeQuantity}
                            onChange={(e) => handleUpdatePoItemField(idx, 'freeQuantity', Math.max(0, Number(e.target.value)))}
                            className="w-full px-2 py-1 bg-emerald-50 border border-emerald-300 rounded text-xs font-bold text-emerald-800 text-center"
                            placeholder="0"
                          />
                        </td>

                        {/* Expected MRP */}
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={row.expectedMrp}
                            onChange={(e) => handleUpdatePoItemField(idx, 'expectedMrp', Number(e.target.value))}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
                          />
                        </td>

                        {/* Discount % */}
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={row.discountPercent}
                            onChange={(e) => handleUpdatePoItemField(idx, 'discountPercent', Number(e.target.value))}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs text-center"
                          />
                        </td>

                        {/* Tax / VAT % */}
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="0"
                            max="30"
                            value={row.taxRate}
                            onChange={(e) => handleUpdatePoItemField(idx, 'taxRate', Number(e.target.value))}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs text-center"
                          />
                        </td>

                        {/* Net Line Total */}
                        <td className="py-2 px-3 text-right font-mono font-extrabold text-slate-900">
                          ${(lineTotal != null ? Number(lineTotal) : 0).toFixed(2)}
                        </td>

                        {/* Delete Action */}
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemovePoItemRow(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Financial Summary Calculation Banner */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-end md:items-center justify-between gap-4">
              <div className="text-xs text-slate-500 space-y-1">
                <div>Total Product Rows: <span className="font-bold text-slate-800">{poItems.length}</span></div>
                <div>Total Pack Units: <span className="font-bold text-slate-800">{poItems.reduce((s, it) => s + (it.orderedQuantity * it.packSize), 0)} units</span></div>
                <div>Bonus Stock Units: <span className="font-bold text-emerald-700">+{poItems.reduce((s, it) => s + (it.freeQuantity * it.packSize), 0)} free units</span></div>
              </div>

              <div className="w-full md:w-80 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono font-bold">${(poCalculations?.subtotal != null ? Number(poCalculations.subtotal) : 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Trade Discount:</span>
                  <span className="font-mono font-bold">-${(poCalculations?.totalDiscount != null ? Number(poCalculations.totalDiscount) : 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Applicable Tax / VAT:</span>
                  <span className="font-mono font-bold">+${(poCalculations?.totalTax != null ? Number(poCalculations.totalTax) : 0).toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-slate-300 flex justify-between text-sm font-black text-slate-900">
                  <span>Net Payable Grand Total:</span>
                  <span className="font-mono text-emerald-600">${(poCalculations?.grandTotal != null ? Number(poCalculations.grandTotal) : 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Submit & Cancel Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('register')}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                id="btn-submit-po"
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <FileCheck className="w-4 h-4" />
                <span>Confirm & Issue Purchase Order</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SUPPLIER LEDGER & ACCOUNTS PAYABLE */}
      {/* ========================================================================= */}
      {activeTab === 'supplier_ledger' && (
        <div className="space-y-4">
          {/* Supplier Selector and Summary Header */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 max-w-sm">
              <label className="text-xs font-bold text-slate-700">Select Supplier Account:</label>
              <select
                id="ledger-supplier-select"
                value={selectedSupplierForLedger}
                onChange={(e) => setSelectedSupplierForLedger(e.target.value)}
                className="w-full mt-1.5 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.companyName})</option>
                ))}
              </select>
            </div>

            {/* Balance Badge and Settlement Button */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Current Balance Due</span>
                <div className="text-xl font-black text-rose-600 font-mono">
                  ${(activeSupplierData?.balancePayable != null ? Number(activeSupplierData.balancePayable) : 0).toFixed(2)}
                </div>
              </div>

              <button
                id="btn-open-payment-modal"
                onClick={() => {
                  setShowPaymentModal(activeSupplierData);
                  setPaymentAmount(activeSupplierData?.balancePayable != null ? Number(activeSupplierData.balancePayable) : 0);
                  setPaymentRef(`PAY-VOUCH-${Date.now().toString().slice(-4)}`);
                }}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                <CreditCard className="w-4 h-4" />
                <span>Record Vendor Payment</span>
              </button>

              <button
                id="btn-open-add-supplier-ledger"
                type="button"
                onClick={() => setShowAddSupplierModal(true)}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Supplier</span>
              </button>
            </div>
          </div>

          {/* Supplier Profile Info Card */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 font-medium">Drug License Number:</span>
              <p className="font-mono font-bold text-slate-800">{activeSupplierData.drugLicenseNumber}</p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Tax BIN / TIN:</span>
              <p className="font-mono font-bold text-slate-800">{activeSupplierData.taxId}</p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Phone / Contact:</span>
              <p className="text-slate-800 font-semibold">{activeSupplierData.phone}</p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Payment Terms:</span>
              <p className="text-slate-800 font-semibold">{activeSupplierData.paymentTermsDays} Days Credit</p>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span>Vendor Statement of Account & Transaction History</span>
              </h4>
              <span className="text-[11px] text-slate-500 font-mono">
                {supplierLedgerEntries.length} Transactions Recorded
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Reference #</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right text-emerald-700">Debit (Payment Out)</th>
                    <th className="py-3 px-4 text-right text-rose-700">Credit (Invoice Inward)</th>
                    <th className="py-3 px-4 text-right">Running Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supplierLedgerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No transactions found for this supplier.
                      </td>
                    </tr>
                  ) : (
                    supplierLedgerEntries.map((entry) => {
                      const isInvoice = entry.type === 'INVOICE';
                      return (
                        <tr key={entry.id} className="hover:bg-slate-50 transition-colors font-mono">
                          <td className="py-2.5 px-4 text-slate-700 font-sans">{entry.date}</td>
                          <td className="py-2.5 px-4 font-sans">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              isInvoice 
                                ? 'bg-amber-100 text-amber-900' 
                                : 'bg-emerald-100 text-emerald-900'
                            }`}>
                              {entry.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-900">{entry.reference}</td>
                          <td className="py-2.5 px-4 text-slate-600 font-sans">{entry.description}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-emerald-700">
                            {entry.debit != null && Number(entry.debit) > 0 ? `$${Number(entry.debit).toFixed(2)}` : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-rose-700">
                            {entry.credit != null && Number(entry.credit) > 0 ? `$${Number(entry.credit).toFixed(2)}` : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-extrabold text-slate-900">
                            ${(entry.runningBalance != null ? Number(entry.runningBalance) : 0).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: AUTOMATED PURCHASE ORDER SUGGESTER                                  */}
      {/* ========================================================================= */}
      {activeTab === 'po_suggester' && (
        <PurchaseOrderSuggester
          onNavigateToPoRegister={(poId) => {
            refreshData();
            setActiveTab('register');
            if (poId) {
              const target = PharmacyService.getPurchases().find(p => p.id === poId);
              if (target) {
                setViewingPO(target);
              }
            }
          }}
          onDataChanged={() => {
            refreshData();
            if (onDataChanged) onDataChanged();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 5: ADVANCED PURCHASE REQUISITION, GRN & PRICE MATRIX                  */}
      {/* ========================================================================= */}
      {activeTab === 'advanced_scm' && (
        <AdvancedPurchaseHub
          onConvertToPO={(_items, supplierName) => {
            setActiveTab('create_po');
            const matchedSup = suppliers.find(s => 
              s.name.toLowerCase().includes(supplierName.toLowerCase()) || 
              supplierName.toLowerCase().includes(s.name.toLowerCase())
            );
            if (matchedSup) {
              setPoSupplierId(matchedSup.id);
            }
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 6: COMPANY-WISE STOCK VALUATION & PRODUCT INVENTORY                    */}
      {/* ========================================================================= */}
      {activeTab === 'company_valuation' && (
        <CompanyStockValuationView
          onNavigateToPo={(supplierName) => {
            setActiveTab('create_po');
            const matchedSup = suppliers.find(s => 
              s.name.toLowerCase().includes(supplierName.toLowerCase()) || 
              supplierName.toLowerCase().includes(s.name.toLowerCase())
            );
            if (matchedSup) {
              setPoSupplierId(matchedSup.id);
            }
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 7: EXCEL-STYLE DIRECT CHALAN ENTRY & FAST STOCK INWARD                 */}
      {/* ========================================================================= */}
      {activeTab === 'excel_chalan' && (
        <ExcelChalanEntryView
          onSuccess={() => {
            refreshData();
            if (onDataChanged) onDataChanged();
            showToast('success', 'এক্সেল চালান সফলভাবে স্টকে যোগ হয়েছে এবং সাপ্লায়ার লেজার আপডেট হয়েছে!');
          }}
          onNavigateToInventory={() => {
            setActiveTab('register');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: GOODS RECEIVE NOTE (GRN) & BATCH ENTRY ENGINE */}
      {/* ========================================================================= */}
      {grnModalPO && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden border border-slate-200 my-auto">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <PackageCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <span>Goods Received Note (GRN) & Batch Verification Engine</span>
                    <span className="text-[10px] bg-emerald-500/30 text-emerald-300 font-mono px-2 py-0.5 rounded">
                      PO #{grnModalPO.poNumber}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Strict Regulatory Validation: Expiry date must strictly be in the future to commit batches into inventory.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setGrnModalPO(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Banner if any */}
            {grnError && (
              <div className="bg-rose-50 border-b border-rose-200 p-3.5 text-xs text-rose-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="font-semibold">{grnError}</div>
              </div>
            )}

            <form onSubmit={handleConfirmGrnSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              
              {/* GRN Configuration Row */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="font-bold text-slate-700">Vendor Bill / Invoice # *</label>
                  <input
                    id="grn-invoice-num"
                    type="text"
                    required
                    value={grnVendorInvoice}
                    onChange={(e) => setGrnVendorInvoice(e.target.value)}
                    placeholder="e.g. INV-VENDOR-8821"
                    className="w-full mt-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Receiving Warehouse *</label>
                  <select
                    id="grn-warehouse"
                    value={grnWarehouse}
                    onChange={(e) => setGrnWarehouse(e.target.value)}
                    className="w-full mt-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Main Central Pharmacy Depot">Main Central Pharmacy Depot</option>
                    <option value="Cold Storage Safe (2-8°C)">Cold Storage Safe (2-8°C)</option>
                    <option value="Dispensary Floor Storage">Dispensary Floor Storage</option>
                    <option value="Emergency Quarantine Bay">Emergency Quarantine Bay</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Receive Mode</label>
                  <select
                    id="grn-receive-mode"
                    value={grnReceiveMode}
                    onChange={(e) => setGrnReceiveMode(e.target.value as any)}
                    className="w-full mt-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="full">Full Receive (All goods arrived intact)</option>
                    <option value="partial">Partial Receive (Pending backorder)</option>
                    <option value="damaged">Damaged / Transit Loss Reported</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Inward Date *</label>
                  <input
                    type="date"
                    required
                    value={grnReceivedDate}
                    onChange={(e) => setGrnReceivedDate(e.target.value)}
                    className="w-full mt-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Line-by-Line Batch Entry Form */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Batch Identification & Regulatory Quality Gate</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {grnItems.length} Products to Inward
                  </span>
                </div>

                {grnItems.map((row, idx) => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const isExpired = row.expiryDate && row.expiryDate <= todayStr;
                  const daysToExpiry = Math.ceil((new Date(row.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));

                  return (
                    <div 
                      key={idx} 
                      className={`p-4 rounded-xl border transition-all space-y-3 ${
                        isExpired 
                          ? 'bg-rose-50/70 border-rose-300' 
                          : 'bg-white border-slate-200 shadow-xs'
                      }`}
                    >
                      {/* Top Medicine details and Regulatory status indicator */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{row.medicineName}</div>
                          <div className="text-[11px] text-slate-500">
                            {row.dosageForm} • Ordered: <span className="font-bold text-slate-700">{row.orderedQuantity}</span> units
                          </div>
                        </div>

                        {/* Shelf Life Status Badge */}
                        <div className="flex items-center gap-2">
                          {isExpired ? (
                            <span className="text-[11px] font-bold text-rose-700 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                              EXPIRED: Regulatory Violation
                            </span>
                          ) : daysToExpiry <= 90 ? (
                            <span className="text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Near Expiry Alert ({daysToExpiry}d shelf life)
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Safe Stock ({daysToExpiry}d shelf life)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Input Fields Grid for Batch */}
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                        {/* Batch Number */}
                        <div className="col-span-2 sm:col-span-1">
                          <label className="font-bold text-slate-700">Batch # *</label>
                          <input
                            type="text"
                            required
                            value={row.batchNumber}
                            onChange={(e) => handleUpdateGrnItem(idx, 'batchNumber', e.target.value.toUpperCase())}
                            className="w-full mt-1 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900"
                            placeholder="e.g. BTH-902"
                          />
                        </div>

                        {/* Manufacturing Date */}
                        <div className="col-span-2 sm:col-span-1">
                          <label className="font-bold text-slate-700">Mfg Date *</label>
                          <input
                            type="date"
                            required
                            value={row.manufacturingDate}
                            onChange={(e) => handleUpdateGrnItem(idx, 'manufacturingDate', e.target.value)}
                            className="w-full mt-1 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded"
                          />
                        </div>

                        {/* Expiry Date with Future Validation Warning */}
                        <div className="col-span-2 sm:col-span-1">
                          <label className={`font-bold ${isExpired ? 'text-rose-700' : 'text-slate-700'}`}>
                            Expiry Date *
                          </label>
                          <input
                            type="date"
                            required
                            value={row.expiryDate}
                            onChange={(e) => handleUpdateGrnItem(idx, 'expiryDate', e.target.value)}
                            className={`w-full mt-1 px-2 py-1.5 border rounded font-bold ${
                              isExpired 
                                ? 'bg-rose-100 border-rose-400 text-rose-900' 
                                : 'bg-slate-50 border-slate-300 text-slate-900'
                            }`}
                          />
                        </div>

                        {/* Received Quantity */}
                        <div>
                          <label className="font-bold text-slate-700">Received Qty</label>
                          <input
                            type="number"
                            min="0"
                            required
                            value={row.receivedQuantity}
                            onChange={(e) => handleUpdateGrnItem(idx, 'receivedQuantity', Math.max(0, Number(e.target.value)))}
                            className="w-full mt-1 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-center font-bold"
                          />
                        </div>

                        {/* Free / Bonus Quantity */}
                        <div>
                          <label className="font-bold text-emerald-700">Bonus Qty</label>
                          <input
                            type="number"
                            min="0"
                            value={row.freeQuantity}
                            onChange={(e) => handleUpdateGrnItem(idx, 'freeQuantity', Math.max(0, Number(e.target.value)))}
                            className="w-full mt-1 px-2 py-1.5 bg-emerald-50 border border-emerald-300 rounded text-center font-bold text-emerald-800"
                          />
                        </div>

                        {/* Rack / Shelf Location */}
                        <div>
                          <label className="font-bold text-slate-700">Rack / Shelf</label>
                          <input
                            type="text"
                            value={row.rackLocation}
                            onChange={(e) => handleUpdateGrnItem(idx, 'rackLocation', e.target.value)}
                            className="w-full mt-1 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-800"
                            placeholder="Rack A-01"
                          />
                        </div>
                      </div>

                      {/* Pricing Row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-slate-100 text-[11px]">
                        <div>
                          <span className="text-slate-500">Unit Purchase Rate:</span>
                          <input
                            type="number"
                            step="0.01"
                            value={row.unitPurchasePrice}
                            onChange={(e) => handleUpdateGrnItem(idx, 'unitPurchasePrice', Number(e.target.value))}
                            className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono font-bold"
                          />
                        </div>

                        <div>
                          <span className="text-slate-500">Maximum Retail Price (MRP):</span>
                          <input
                            type="number"
                            step="0.01"
                            value={row.mrp}
                            onChange={(e) => handleUpdateGrnItem(idx, 'mrp', Number(e.target.value))}
                            className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono"
                          />
                        </div>

                        <div>
                          <span className="text-slate-500">POS Selling Price:</span>
                          <input
                            type="number"
                            step="0.01"
                            value={row.sellingPrice}
                            onChange={(e) => handleUpdateGrnItem(idx, 'sellingPrice', Number(e.target.value))}
                            className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-emerald-700 font-bold"
                          />
                        </div>

                        <div>
                          <span className="text-slate-500">Damaged / Quarantine Qty:</span>
                          <input
                            type="number"
                            min="0"
                            value={row.damagedQuantity}
                            onChange={(e) => handleUpdateGrnItem(idx, 'damagedQuantity', Math.max(0, Number(e.target.value)))}
                            className="w-full mt-0.5 px-2 py-1 bg-rose-50 border border-rose-200 rounded font-bold text-rose-800 text-center"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Payment Settlement for GRN */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Immediate Disbursement ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={grnPaidAmount}
                    onChange={(e) => setGrnPaidAmount(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900"
                    placeholder="0.00 for Credit Inward"
                  />
                  <div className="text-[10px] text-slate-500 mt-1">Leave 0 for standard credit invoice.</div>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Payment Method</label>
                  <select
                    value={grnPaymentMethod}
                    onChange={(e) => setGrnPaymentMethod(e.target.value as any)}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash Drawer</option>
                    <option value="Card">Corporate Card</option>
                    <option value="Cheque">Company Cheque</option>
                  </select>
                </div>

                <div className="flex flex-col justify-center bg-white p-3 rounded-lg border border-slate-200 text-right">
                  <span className="text-slate-500 font-medium">Added to Supplier Liability:</span>
                  <span className="text-sm font-black text-rose-600 font-mono">
                    ${Math.max(0, grnModalPO.totalAmount - grnPaidAmount).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setGrnModalPO(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  id="btn-confirm-grn-submit"
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm GRN & Commit Batch Inventory</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD SUPPLIER PAYMENT */}
      {/* ========================================================================= */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Record Supplier Settlement</h3>
                <p className="text-xs text-slate-400">Payable to: {showPaymentModal.name}</p>
              </div>
              <button onClick={() => setShowPaymentModal(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="p-5 space-y-3.5 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                <span className="text-slate-600 font-medium">Outstanding Balance:</span>
                <span className="font-mono font-black text-rose-600 text-sm">
                  ${(showPaymentModal?.balancePayable != null ? Number(showPaymentModal.balancePayable) : 0).toFixed(2)}
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700">Settlement Amount ($) *</label>
                <input
                  id="pay-amount-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Payment Instrument</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="Bank Transfer">Bank Transfer (EFT / NEFT)</option>
                  <option value="Company Cheque">Company Cheque</option>
                  <option value="Cash Drawer">Cash Drawer</option>
                  <option value="bKash / Mobile Banking">Mobile Banking (bKash/Nagad)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Transaction / Cheque Reference #</label>
                <input
                  type="text"
                  required
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. TR-99402 or CHQ-00129"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Remarks & Voucher Notes</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Payment for invoice batch #INV-881"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-confirm-payment-submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-xs cursor-pointer"
                >
                  Post Payment to Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VIEW PURCHASE ORDER / INWARD VOUCHER */}
      {/* ========================================================================= */}
      {viewingPO && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <span>Goods Inward Voucher & PO Details</span>
                  <span className="font-mono text-emerald-400">#{viewingPO.poNumber || viewingPO.id}</span>
                </h3>
                <p className="text-xs text-slate-400">Invoice: {viewingPO.invoiceNumber} • Supplier: {viewingPO.supplierName}</p>
              </div>
              <button onClick={() => setViewingPO(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 font-medium">Order Date:</span>
                  <p className="font-bold text-slate-800">{viewingPO.purchaseDate}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Payment Status:</span>
                  <p className="font-bold uppercase text-emerald-700">{viewingPO.paymentStatus}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Paid vs Due:</span>
                  <p className="font-bold text-slate-800 font-mono">
                    ${((viewingPO.paidAmount || 0)).toFixed(2)} / ${((viewingPO.dueAmount || 0)).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Items List */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Medicine</th>
                      <th className="py-2.5 px-3">Batch #</th>
                      <th className="py-2.5 px-3">Expiry</th>
                      <th className="py-2.5 px-3 text-center">Inward Units</th>
                      <th className="py-2.5 px-3 text-right">Cost Rate</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingPO.items.map((it, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-800">{it.medicineName}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-700">{it.batchNumber}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{it.expiryDate}</td>
                        <td className="py-2 px-3 text-center font-bold text-slate-800">{it.quantity}</td>
                        <td className="py-2 px-3 text-right font-mono">${(it.purchasePrice != null ? Number(it.purchasePrice) : 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">${(it.totalAmount != null ? Number(it.totalAmount) : 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                <span className="text-slate-600 font-semibold">Grand Invoice Total:</span>
                <span className="font-mono text-base font-black text-slate-900">
                  ${(viewingPO?.totalAmount != null ? Number(viewingPO.totalAmount) : 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="bg-slate-100 px-5 py-3 flex justify-end">
              <button
                onClick={() => setViewingPO(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Close Voucher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD NEW SUPPLIER / PHARMACEUTICAL COMPANY */}
      {/* ========================================================================= */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-400" />
                  <span>Register New Supplier / Company</span>
                </h3>
                <p className="text-xs text-slate-400">Add a new pharmaceutical manufacturer or distributor to the master register</p>
              </div>
              <button 
                onClick={() => setShowAddSupplierModal(false)} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="font-bold text-slate-700">Company / Brand Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Square Pharmaceuticals PLC, Beximco, Incepta, Renata"
                    value={newSupplier.companyName}
                    onChange={(e) => setNewSupplier({ ...newSupplier, companyName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="font-bold text-slate-700">Authorized Contact Person / Representative *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Md. Rafiqul Islam (Senior MPO)"
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="font-bold text-slate-700">Contact Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +880 1711-234567"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="font-bold text-slate-700">Official Email</label>
                  <input
                    type="email"
                    placeholder="e.g. sales@squarepharma.com.bd"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="font-bold text-slate-700">Credit Payment Terms (Days)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="30"
                    value={newSupplier.paymentTermsDays}
                    onChange={(e) => setNewSupplier({ ...newSupplier, paymentTermsDays: parseInt(e.target.value) || 30 })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="font-bold text-slate-700">DGDA Drug License #</label>
                  <input
                    type="text"
                    placeholder="e.g. DL-DGDA-7890"
                    value={newSupplier.drugLicenseNumber}
                    onChange={(e) => setNewSupplier({ ...newSupplier, drugLicenseNumber: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="font-bold text-slate-700">Tax BIN / TIN Number</label>
                  <input
                    type="text"
                    placeholder="e.g. BIN-002391029-01"
                    value={newSupplier.taxId}
                    onChange={(e) => setNewSupplier({ ...newSupplier, taxId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="col-span-2">
                  <label className="font-bold text-slate-700">Depot / Warehouse Address</label>
                  <input
                    type="text"
                    placeholder="e.g. Tejgaon Industrial Area, Dhaka-1208"
                    value={newSupplier.address}
                    onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="font-bold text-slate-700">Initial Opening Balance Due ($ / ৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newSupplier.balancePayable}
                    onChange={(e) => setNewSupplier({ ...newSupplier, balancePayable: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">If there is any previous pending credit/balance with this supplier, enter it here.</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save Supplier</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default PurchaseOrdersView;
