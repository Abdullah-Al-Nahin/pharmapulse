import { 
  Medicine, 
  Batch, 
  Supplier, 
  Prescription, 
  PurchaseOrder, 
  PurchaseItem,
  SupplierLedgerEntry,
  Sale, 
  SaleReturn, 
  AccountingTransaction,
  HeldSale,
  POSCartItem,
  ReorderItem,
  DateFilterPreset,
  PurchaseOrderSuggestionItem,
  SupplierPurchaseSuggestionGroup,
  StockoutRiskLevel
} from '../types/pharmacy';
import { 
  INITIAL_MEDICINES, 
  INITIAL_BATCHES, 
  INITIAL_SUPPLIERS, 
  INITIAL_PRESCRIPTIONS, 
  INITIAL_PURCHASES, 
  INITIAL_SALES, 
  INITIAL_RETURNS, 
  INITIAL_ACCOUNTING_TRANSACTIONS 
} from '../lib/initialData';
import { batchApi, supplierApi, inventoryApi, saleApi, purchaseOrderApi } from '../lib/api';
import { AuditService } from './auditService';

const STORAGE_KEYS = {
  MEDICINES: 'rx_medicines_v1',
  BATCHES: 'rx_batches_v1',
  SUPPLIERS: 'rx_suppliers_v1',
  PRESCRIPTIONS: 'rx_prescriptions_v1',
  PURCHASES: 'rx_purchases_v1',
  SALES: 'rx_sales_v1',
  RETURNS: 'rx_returns_v1',
  ACCOUNTING: 'rx_accounting_v1',
  HELD_SALES: 'rx_held_sales_v1',
  REORDER_LIST: 'rx_reorder_list_v1',
  SUPPLIER_LEDGERS: 'rx_supplier_ledgers_v1',
};

type SyncListener = () => void;

function getLocalItem<T>(key: string, fallback: T): T {
  try {
    if (typeof window !== 'undefined') {
      const item = localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as unknown as T;
      }
    }
  } catch {
    // fallback
  }
  return fallback;
}

function setLocalItem(key: string, data: any): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch {
    // ignore
  }
}

export class PharmacyService {
  // Lightning-fast RAM Cache
  private static cache = {
    medicines: INITIAL_MEDICINES,
    batches: INITIAL_BATCHES,
    suppliers: INITIAL_SUPPLIERS,
    prescriptions: getLocalItem(STORAGE_KEYS.PRESCRIPTIONS, INITIAL_PRESCRIPTIONS),
    purchases: getLocalItem(STORAGE_KEYS.PURCHASES, INITIAL_PURCHASES),
    sales: getLocalItem(STORAGE_KEYS.SALES, INITIAL_SALES),
    returns: getLocalItem(STORAGE_KEYS.RETURNS, INITIAL_RETURNS),
    accounting: getLocalItem(STORAGE_KEYS.ACCOUNTING, INITIAL_ACCOUNTING_TRANSACTIONS),
    heldSales: getLocalItem(STORAGE_KEYS.HELD_SALES, [] as HeldSale[]),
    reorderList: getLocalItem(STORAGE_KEYS.REORDER_LIST, [] as ReorderItem[]),
    supplierLedgers: getLocalItem(STORAGE_KEYS.SUPPLIER_LEDGERS, [] as SupplierLedgerEntry[])
  };

  private static listeners: SyncListener[] = [];

  public static subscribe(listener: SyncListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private static emitChange() {
    this.listeners.forEach(listener => listener());
  }

  private static isInitialized = false;

  // --- Initializer & Global Database Sync ---
  public static async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Attempt to load from API Database
    await this.syncDatabase();
    
    // Poll the database every 30 seconds to catch changes made by other branches/terminals
    setInterval(() => this.syncDatabase(), 30000);
  }

  public static async syncDatabase(): Promise<void> {
    try {
      // Execute fast parallel fetch from our Postgres backend
      const [
        apiMedicines, 
        apiBatches, 
        apiSuppliers,
        apiSales
      ] = await Promise.all([
        inventoryApi.getMedicines().catch(() => INITIAL_MEDICINES),
        batchApi.getBatches().catch(() => INITIAL_BATCHES),
        supplierApi.getSuppliers().catch(() => []),
        saleApi.getSales().catch(() => []),
      ]);

      const newMedicines = (apiMedicines.length > 0 ? apiMedicines : INITIAL_MEDICINES).map((m: any) => ({
        ...m,
        manufacturer: typeof m.manufacturer === 'object' && m.manufacturer ? m.manufacturer.name : (m.manufacturer || ''),
        genericName: typeof m.generic === 'object' && m.generic ? m.generic.name : (m.genericName || m.generic || ''),
        category: typeof m.category === 'object' && m.category ? m.category.name : (m.category || ''),
      }));

      const newBatches = (apiBatches.length > 0 ? apiBatches : INITIAL_BATCHES).map((b: any) => ({
        ...b,
        medicineId: b.medicineId || b.productId, // map Prisma's productId to frontend's medicineId
        sellingPrice: b.sellingPrice !== undefined ? b.sellingPrice : b.unitSellingPrice // map Prisma's unitSellingPrice to frontend's sellingPrice
      }));

      const newSuppliers = apiSuppliers.length > 0 ? apiSuppliers : INITIAL_SUPPLIERS;

      let syncedSales = this.cache.sales;
      if (Array.isArray(apiSales) && apiSales.length > 0) {
        const formattedSales: Sale[] = apiSales.map((s: any) => ({
          id: s.id,
          invoiceNumber: s.invoiceNumber,
          date: s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          timestamp: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
          customerName: s.customer?.name || 'Walk-In Customer',
          customerPhone: s.customer?.phone || '',
          items: (s.items || []).map((it: any) => ({
            medicineId: it.productId,
            medicineName: it.product?.name || 'Item',
            genericName: '',
            batchId: it.batchId,
            batchNumber: it.batch?.batchNumber || '',
            expiryDate: it.batch?.expiryDate ? new Date(it.batch.expiryDate).toISOString().split('T')[0] : '',
            quantity: it.quantity,
            unitPrice: Number(it.unitSellingPrice || 0),
            unitCost: Number(it.unitCostPrice || 0),
            mrp: Number(it.unitMrp || 0),
            discountPercent: 0,
            taxRate: Number(it.taxRate || 0),
            subtotal: Number(it.lineTotal || 0),
            taxAmount: Number(it.taxAmount || 0),
            total: Number(it.lineTotal || 0),
          })),
          subtotal: Number(s.subTotal || 0),
          discountTotal: Number(s.discountAmount || 0),
          taxTotal: Number(s.taxAmount || 0),
          grandTotal: Number(s.grandTotal || 0),
          totalCost: Number(s.costOfGoodsSold || 0),
          grossProfit: Number(s.grandTotal || 0) - Number(s.taxAmount || 0) - Number(s.costOfGoodsSold || 0),
          dueAmount: Number(s.dueAmount || 0),
          paymentMethod: (s.notes && s.notes.startsWith('METHOD:'))
            ? (s.notes.replace('METHOD:', '').trim() as any)
            : (Number(s.dueAmount || 0) > 0 ? 'credit' : 'cash'),
          paymentStatus: Number(s.dueAmount || 0) > 0 ? 'due' : 'paid',
          cashierName: s.cashier?.fullName || s.cashier?.username || 'Cashier',
        }));
        syncedSales = formattedSales;
        setLocalItem(STORAGE_KEYS.SALES, syncedSales);
      }

      this.cache = {
        medicines: newMedicines,
        batches: newBatches,
        suppliers: newSuppliers,
        prescriptions: this.cache.prescriptions.length > 0 ? this.cache.prescriptions : INITIAL_PRESCRIPTIONS,
        purchases: this.cache.purchases.length > 0 ? this.cache.purchases : INITIAL_PURCHASES,
        sales: syncedSales.length > 0 ? syncedSales : INITIAL_SALES,
        returns: this.cache.returns.length > 0 ? this.cache.returns : INITIAL_RETURNS,
        accounting: this.cache.accounting.length > 0 ? this.cache.accounting : INITIAL_ACCOUNTING_TRANSACTIONS,
        heldSales: this.cache.heldSales,
        reorderList: this.cache.reorderList,
        supplierLedgers: this.cache.supplierLedgers
      };

      this.emitChange();
    } catch (err) {
      console.error("Global Database Sync failed", err);
    }
  }


  // --- Medicines ---
  public static getMedicines(): Medicine[] {
    return this.cache.medicines;
  }

  public static async addMedicine(med: Medicine): Promise<void> {
    try {
      await inventoryApi.createMedicine(med);
      await this.syncDatabase();
    } catch (e) {
      console.error("Failed to add medicine", e);
    }
  }

  public static async updateMedicine(med: Medicine): Promise<void> {
    try {
      await inventoryApi.updateMedicine(med.id, med);
      await this.syncDatabase();
    } catch (e) {
      console.error("Failed to update medicine", e);
    }
  }

  // --- Real-time Backend Sync ---
  public static async fetchLiveCatalog(): Promise<any[]> {
    try {
      const [medsData, batchesData] = await Promise.all([
        inventoryApi.getMedicines(),
        batchApi.getBatches()
      ]);

      const todayStr = new Date().toISOString().split('T')[0];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return medsData.map((m: any) => {
        // Find fefo batch directly from live backend data
        const medBatches = batchesData.filter((b: any) => b.productId === m.id && b.currentStock > 0 && b.status !== 'QUARANTINED');
        const unexpired = medBatches.filter((b: any) => new Date(b.expiryDate) > today);
        unexpired.sort((a: any, b: any) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
        
        const fefoBatch = unexpired.length > 0 ? unexpired[0] : null;
        // Exclude expired batches from sellable totalStock in POS
        const totalStock = unexpired.reduce((sum: number, b: any) => sum + (Number(b.currentStock) || 0), 0);
        let nearestExpiryDays = null;

        if (fefoBatch) {
           nearestExpiryDays = Math.ceil((new Date(fefoBatch.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        }

        return {
          medicineId: m.id,
          batchId: fefoBatch ? fefoBatch.id : undefined,
          name: m.name,
          sub: m.generic?.name || 'Unknown Formulation',
          company: m.manufacturer?.name || 'Unknown',
          batch: fefoBatch ? fefoBatch.batchNumber : 'OOS',
          exp: fefoBatch ? new Date(fefoBatch.expiryDate).toISOString().split('T')[0] : 'N/A',
          price: fefoBatch ? Number(fefoBatch.unitSellingPrice) : 0,
          purchasePrice: fefoBatch ? Number(fefoBatch.purchasePrice) : 0,
          stock: totalStock,
          isUrgent: nearestExpiryDays !== null && nearestExpiryDays < 30,
          isColdChain: (m.defaultRackLocation || '').toLowerCase().includes('fridge'),
          storageTemp: m.defaultRackLocation || 'Room Temp',
          isOphthalmic: (m.dosageForm || '').toLowerCase().includes('drop') || (m.category?.name || '').toLowerCase().includes('eye'),
          afterOpeningDays: 28,
          isRxRequired: m.requiresPrescription,
          dosageEn: m.description || '',
          dosageBn: m.description || '',
        };
      });
    } catch (e) {
      console.error("Failed to fetch live catalog from database", e);
      return [];
    }
  }

  // --- Batches & Strict FEFO Engine ---
  public static getBatches(): Batch[] {
    return this.cache.batches;
  }

  public static getBatchesForMedicine(medicineId: string, branchId?: string): Batch[] {
    const list = this.getBatches().filter(b => b.medicineId === medicineId);
    if (!branchId || branchId === 'all') return list;
    const branchBatches = list.filter(b => b.branchId === branchId);
    return branchBatches.length > 0 ? branchBatches : list;
  }

  /**
   * Strict FEFO (First Expiry, First Out) Algorithm:
   * 1. Filters batches for medicine with stock > 0 and status !== 'quarantined'
   * 2. Isolates batches to the requested branch when specified
   * 3. Checks expiry against current date. Expired batches are flagged and blocked from sale.
   * 4. Sorts valid batches ascending by expiryDate (earliest expiry first).
   * 5. Returns the candidate batch, or identifies if all stock is expired.
   */
  public static getFefoBatchForMedicine(medicineId: string, branchId?: string): { 
    batch: Batch | null; 
    hasStock: boolean; 
    allStockExpired: boolean;
    expiredBatchesCount: number;
    nearestExpiryDays: number | null;
    totalStock: number;
  } {
    const batches = this.getBatchesForMedicine(medicineId, branchId);
    const todayStr = new Date().toISOString().split('T')[0];

    const withStock = batches.filter(b => b.currentStock > 0 && b.status !== 'quarantined');
    if (withStock.length === 0) {
      return {
        batch: null,
        hasStock: false,
        allStockExpired: false,
        expiredBatchesCount: 0,
        nearestExpiryDays: null,
        totalStock: 0
      };
    }

    const unexpiredWithStock = withStock.filter(b => b.expiryDate > todayStr && b.status !== 'expired');
    const expiredCount = withStock.filter(b => b.expiryDate <= todayStr || b.status === 'expired').length;

    const totalStock = withStock.reduce((sum, b) => sum + b.currentStock, 0);

    if (unexpiredWithStock.length === 0) {
      // All available stock is expired! Zero tolerance safety lockout
      return {
        batch: null,
        hasStock: true,
        allStockExpired: true,
        expiredBatchesCount: expiredCount,
        nearestExpiryDays: null,
        totalStock
      };
    }

    // Sort ascending by expiry date (FEFO rule)
    unexpiredWithStock.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    const fefoCandidate = unexpiredWithStock[0];

    // Calculate days to expiry
    const expDate = new Date(fefoCandidate.expiryDate);
    const now = new Date();
    const diffTime = expDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      batch: fefoCandidate,
      hasStock: true,
      allStockExpired: false,
      expiredBatchesCount: expiredCount,
      nearestExpiryDays: diffDays,
      totalStock
    };
  }

  public static async addBatch(batch: Batch): Promise<void> {
    try {
      await batchApi.createBatch({
        productId: batch.medicineId,
        batchNumber: batch.batchNumber,
        manufacturingDate: new Date().toISOString(),
        expiryDate: new Date(batch.expiryDate).toISOString(),
        purchasePrice: batch.purchasePrice,
        mrp: batch.mrp,
        unitSellingPrice: batch.sellingPrice,
        initialQuantity: batch.initialQuantity,
        currentStock: batch.currentStock,
        status: batch.status.toUpperCase(),
        rackLocation: batch.rackLocation
      });
      await this.syncDatabase();

      // Audit Log: Record the batch inward
      AuditService.recordAuditLog({
        userId: 'current-user',
        userName: 'Storekeeper',
        userRole: 'Storekeeper',
        action: 'CREATE',
        module: 'inventory',
        targetEntityId: batch.batchNumber || batch.id,
        targetEntityType: 'Batch',
        summary: `Inward Batch ${batch.batchNumber} — ${batch.currentStock} pcs, Purchase Price: ৳${batch.purchasePrice}, Expiry: ${batch.expiryDate}`,
        beforeState: null,
        afterState: {
          batchNumber: batch.batchNumber,
          medicineId: batch.medicineId,
          currentStock: batch.currentStock,
          purchasePrice: batch.purchasePrice,
          mrp: batch.mrp,
          expiryDate: batch.expiryDate,
          rackLocation: batch.rackLocation
        }
      });
    } catch (e) {
      console.error("Failed to add batch", e);
    }
  }

  public static async updateBatch(batch: Batch): Promise<void> {
    try {
      await batchApi.updateBatch(batch.id, {
        currentStock: batch.currentStock,
        status: batch.status.toUpperCase(),
        mrp: batch.mrp,
        unitSellingPrice: batch.sellingPrice,
        purchasePrice: batch.purchasePrice,
        expiryDate: new Date(batch.expiryDate).toISOString(),
        rackLocation: batch.rackLocation
      });
      await this.syncDatabase();
    } catch (e) {
      console.error("Failed to update batch to backend", e);
    }
  }

  /**
   * Multi-Branch IBT (Inter-Branch Transfer) Stock & Critical FEFO Handshake:
   * 1. Deducts quantity from the origin branch batch
   * 2. Incorporates or creates the batch in destination branch inventory with its original critical expiry intact
   * 3. Triggers FEFO reactivity so the destination branch immediately prioritizes dispensing near-expiry stock
   */
  public static transferBatchStock(params: {
    medicineId?: string;
    medicineName?: string;
    batchNumber: string;
    fromBranchId: string;
    fromBranchName: string;
    toBranchId: string;
    toBranchName: string;
    quantity: number;
    expiryDate?: string;
  }): boolean {
    const batches = this.cache.batches;
    // 1. Locate source batch in origin branch
    let srcBatch = batches.find(
      (b) =>
        b.batchNumber.toLowerCase() === params.batchNumber.toLowerCase() &&
        (b.branchId === params.fromBranchId || !b.branchId)
    );
    if (!srcBatch) {
      srcBatch = batches.find((b) => b.batchNumber.toLowerCase() === params.batchNumber.toLowerCase());
    }

    if (srcBatch) {
      srcBatch.currentStock = Math.max(0, srcBatch.currentStock - params.quantity);
    }

    // 2. Locate or create destination batch in destination branch
    let destBatch = batches.find(
      (b) =>
        b.batchNumber.toLowerCase() === params.batchNumber.toLowerCase() &&
        b.branchId === params.toBranchId
    );

    if (destBatch) {
      destBatch.currentStock += params.quantity;
      if (destBatch.status === 'expired' && new Date(destBatch.expiryDate) > new Date()) {
        destBatch.status = 'active';
      }
    } else {
      const newDestBatch: Batch = {
        id: `batch_ibt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        medicineId: srcBatch?.medicineId || params.medicineId || 'med-transferred',
        medicineName: srcBatch?.medicineName || params.medicineName || 'Transferred Medicine',
        batchNumber: params.batchNumber,
        expiryDate: srcBatch?.expiryDate || params.expiryDate || '2026-11-30',
        manufacturingDate: srcBatch?.manufacturingDate || new Date().toISOString().split('T')[0],
        purchasePrice: srcBatch?.purchasePrice || 80,
        sellingPrice: srcBatch?.sellingPrice || 100,
        mrp: srcBatch?.mrp || 100,
        currentStock: params.quantity,
        initialQuantity: params.quantity,
        status: 'active',
        rackLocation: 'IBT-INWARD-BAY',
        branchId: params.toBranchId,
        branchName: params.toBranchName,
      };
      batches.unshift(newDestBatch);
    }

    this.emitChange();

    AuditService.recordAuditLog({
      userId: 'system',
      userName: 'IBT Multi-Branch Dispatch',
      userRole: 'Pharmacist',
      action: 'UPDATE',
      module: 'inventory',
      targetEntityId: params.batchNumber,
      targetEntityType: 'Batch',
      summary: `Transferred ${params.quantity} units of batch ${params.batchNumber} from [${params.fromBranchName}] to [${params.toBranchName}] with critical expiry [${srcBatch?.expiryDate || params.expiryDate || 'N/A'}]`,
      beforeState: { fromBranch: params.fromBranchName, qtyTransferred: params.quantity },
      afterState: { toBranch: params.toBranchName, destStock: params.quantity },
    });

    return true;
  }

  // --- Suppliers ---
  public static getSuppliers(): Supplier[] {
    return this.cache.suppliers;
  }

  public static async addSupplier(supplier: Supplier): Promise<void> {
    const list = this.getSuppliers();
    list.unshift(supplier);
    this.cache.suppliers = list;
    this.emitChange();

    try {
      await supplierApi.createSupplier({
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        balancePayable: supplier.balancePayable || 0,
      });
      await this.syncDatabase();
    } catch (e) {
      console.error("Failed to sync new supplier to backend", e);
    }
  }

  public static updateSupplier(supplier: Supplier): void {
    const list = this.getSuppliers().map(s => s.id === supplier.id ? supplier : s);
    this.cache.suppliers = list;
    this.emitChange();
    
    supplierApi.updateSupplier(supplier.id, {
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      balancePayable: supplier.balancePayable
    }).catch(e => console.error("Failed to sync updated supplier to backend", e));
  }

  public static getSupplierLedger(supplierId: string): SupplierLedgerEntry[] {
    const allLedgers = this.cache.supplierLedgers;
    const supplier = this.getSuppliers().find(s => s.id === supplierId);
    
    // If no custom entries yet, generate initial baseline from existing purchases
    let entries = allLedgers.filter(l => l.supplierId === supplierId);
    if (entries.length === 0 && supplier) {
      const purchases = this.getPurchases().filter(p => p.supplierId === supplierId);
      let running = 0;
      purchases.forEach(p => {
        running += p.totalAmount;
        entries.push({
          id: `led-${p.id}-inv`,
          supplierId,
          supplierName: supplier.name,
          date: p.purchaseDate,
          type: 'INVOICE',
          reference: p.invoiceNumber || p.poNumber || p.id,
          description: `GRN Purchase Invoice #${p.invoiceNumber} (${p.items.length} items)`,
          debit: 0,
          credit: p.totalAmount,
          runningBalance: running,
        });

        if (p.paidAmount > 0) {
          running -= p.paidAmount;
          entries.push({
            id: `led-${p.id}-pay`,
            supplierId,
            supplierName: supplier.name,
            date: p.purchaseDate,
            type: 'PAYMENT',
            reference: `PAY-${p.invoiceNumber}`,
            description: `Payment for Invoice #${p.invoiceNumber}`,
            debit: p.paidAmount,
            credit: 0,
            runningBalance: running,
          });
        }
      });
      // Store back to local
      this.cache.supplierLedgers = [...allLedgers, ...entries];
    this.emitChange();
    }
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  public static recordSupplierPayment(
    supplierId: string,
    amount: number,
    paymentMethod: string = 'Bank Transfer',
    reference: string = '',
    notes?: string
  ): void {
    if (amount <= 0) return;

    // 1. Decrement Supplier Balance
    const suppliers = this.getSuppliers();
    const sup = suppliers.find(s => s.id === supplierId);
    if (!sup) throw new Error('Supplier not found');

    sup.balancePayable = Math.max(0, sup.balancePayable - amount);
    this.cache.suppliers = suppliers;
    this.emitChange();

    // 2. CRITICAL FIX: Distribute payment across supplier's outstanding POs (FIFO — oldest due first)
    const purchases = this.getPurchases();
    let remainingPayment = amount;

    // Get all POs for this supplier that still have outstanding dues, sorted oldest first
    const supplierPOs = purchases
      .filter(po => po.supplierId === supplierId && (po.dueAmount ?? 0) > 0)
      .sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());

    for (const po of supplierPOs) {
      if (remainingPayment <= 0) break;

      const currentDue = po.dueAmount ?? 0;
      const appliedAmount = Math.min(remainingPayment, currentDue);

      po.paidAmount = (po.paidAmount ?? 0) + appliedAmount;
      po.dueAmount = Math.max(0, currentDue - appliedAmount);

      // Update payment status
      if (po.dueAmount <= 0) {
        po.paymentStatus = 'paid';
      } else if (po.paidAmount > 0) {
        po.paymentStatus = 'partial';
      }

      remainingPayment -= appliedAmount;
    }

    this.cache.purchases = purchases;
    setLocalItem(STORAGE_KEYS.PURCHASES, purchases);
    this.emitChange();

    // 3. Add Supplier Ledger Entry
    const allLedgers = this.cache.supplierLedgers;
    const entry: SupplierLedgerEntry = {
      id: `led-pay-${Date.now()}`,
      supplierId,
      supplierName: sup.name,
      date: new Date().toISOString().split('T')[0],
      type: 'PAYMENT',
      reference: reference || `VOUCH-${Date.now().toString().slice(-4)}`,
      description: `Settlement payment via ${paymentMethod}. ${notes || ''}`.trim(),
      debit: amount,
      credit: 0,
      runningBalance: sup.balancePayable,
    };
    allLedgers.unshift(entry);
    this.cache.supplierLedgers = allLedgers;
    setLocalItem(STORAGE_KEYS.SUPPLIER_LEDGERS, allLedgers);
    this.emitChange();

    // 4. Add General Accounting Entry
    const tx: AccountingTransaction = {
      id: `tx-sup-pay-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      type: 'supplier_payment',
      referenceId: entry.reference,
      description: `Supplier payment to ${sup.name} (${paymentMethod})`,
      debit: amount,
      credit: 0,
      account: 'Accounts Payable',
    };
    this.addAccountingTransaction(tx);
  }

  // --- Prescriptions ---
  public static getPrescriptions(): Prescription[] {
    return this.cache.prescriptions;
  }

  public static addPrescription(rx: Prescription): void {
    const list = this.getPrescriptions();
    list.unshift(rx);
    this.cache.prescriptions = list;
    setLocalItem(STORAGE_KEYS.PRESCRIPTIONS, list);
    this.emitChange();
  }

  public static updatePrescriptionStatus(rxId: string, status: Prescription['status']): void {
    const list = this.getPrescriptions().map(rx => rx.id === rxId ? { ...rx, status } : rx);
    this.cache.prescriptions = list;
    setLocalItem(STORAGE_KEYS.PRESCRIPTIONS, list);
    this.emitChange();
  }

  // --- Purchases & PO / GRN Workflow ---
  public static getPurchases(): PurchaseOrder[] {
    return this.cache.purchases;
  }

  /**
   * 1. CREATE PURCHASE ORDER (PO)
   */
  public static createPurchaseOrder(poData: {
    supplierId: string;
    paymentTerms: string;
    expectedDeliveryDate: string;
    orderDate?: string;
    invoiceNumber?: string;
    notes?: string;
    items: PurchaseItem[];
  }): PurchaseOrder {
    const suppliers = this.getSuppliers();
    const supplier = suppliers.find(s => s.id === poData.supplierId);
    if (!supplier) throw new Error('Selected supplier does not exist.');

    const today = new Date().toISOString().split('T')[0];
    const orderDate = poData.orderDate || today;

    // Calculate Subtotal, Discount, Tax, Grand Total
    let subtotal = 0;
    let discountAmount = 0;
    let taxAmount = 0;

    const items = poData.items.map(it => {
      const packMult = it.packSize && it.packSize > 1 ? it.packSize : 1;
      const orderQty = it.orderedQuantity || it.quantity || 1;
      const unitPrice = it.purchasePrice != null ? it.purchasePrice : ((it as any).unitPurchasePrice || 0);
      const lineSub = unitPrice * orderQty;
      const disc = lineSub * ((it.discountPercent || 0) / 100);
      const tax = (lineSub - disc) * ((it.taxRate || 0) / 100);
      const lineTotal = lineSub - disc + tax;

      subtotal += lineSub;
      discountAmount += disc;
      taxAmount += tax;

      return {
        ...it,
        id: it.id || `pi-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        orderedQuantity: orderQty,
        quantity: orderQty * packMult,
        taxAmount: tax,
        totalAmount: lineTotal,
      };
    });

    const totalAmount = subtotal - discountAmount + taxAmount;
    const dateNum = orderDate.replace(/-/g, '').slice(2);
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const poNumber = `PO-${dateNum}-${randomSuffix}`;

    const newPO: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNumber,
      invoiceNumber: poData.invoiceNumber || `PROFORMA-${poNumber}`,
      supplierId: supplier.id,
      supplierName: supplier.name,
      orderDate,
      purchaseDate: orderDate,
      expectedDeliveryDate: poData.expectedDeliveryDate,
      paymentTerms: poData.paymentTerms,
      dueDate: poData.expectedDeliveryDate,
      status: 'ordered',
      paymentStatus: 'pending',
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      paidAmount: 0,
      dueAmount: totalAmount,
      items,
      notes: poData.notes,
    };

    this.cache.purchases = [newPO, ...this.getPurchases()];
    setLocalItem(STORAGE_KEYS.PURCHASES, this.cache.purchases);
    this.emitChange();

    purchaseOrderApi.createPurchaseOrder({
      poNumber: newPO.poNumber,
      invoiceNumber: newPO.invoiceNumber,
      supplierId: newPO.supplierId,
      orderDate: newPO.orderDate,
      subTotal: newPO.subtotal,
      taxAmount: newPO.taxAmount || 0,
      discountAmount: newPO.discountAmount || 0,
      grandTotal: newPO.totalAmount,
      items: newPO.items.map(it => ({
        productId: it.medicineId,
        batchNumber: it.batchNumber || 'TBD',
        manufacturingDate: it.manufacturingDate || new Date().toISOString().split('T')[0],
        expiryDate: it.expiryDate || new Date(Date.now() + 365*24*3600*1000).toISOString().split('T')[0],
        orderedQuantity: it.orderedQuantity || it.quantity,
        receivedQuantity: 0,
        freeQuantity: it.freeQuantity || 0,
        unitPurchasePrice: it.purchasePrice,
        mrp: it.mrp,
        sellingPrice: it.sellingPrice,
        taxRate: it.taxRate || 0,
        taxAmount: it.taxAmount || 0,
        lineTotal: it.totalAmount
      }))
    }).then((savedPo) => {
      if (savedPo && savedPo.id) {
        newPO.id = savedPo.id;
        setLocalItem(STORAGE_KEYS.PURCHASES, this.cache.purchases);
      }
    }).catch(e => console.error("Failed to sync purchase order to backend", e));

    return newPO;
  }

  /**
   * 2. GOODS RECEIVE NOTE (GRN) & BATCH ENTRY ENGINE
   * - Validates strict future expiry date
   * - Creates/updates Batch inventory records
   * - Updates Supplier Balance & Ledger
   * - Logs accounting transactions
   */
  public static receiveGoodsReceiptNote(input: {
    poId: string;
    vendorInvoiceNumber: string;
    receivedDate: string;
    receivingWarehouse: string;
    receiveMode: 'full' | 'partial' | 'damaged';
    notes?: string;
    paidAmount?: number;
    paymentMethod?: string;
    items: Array<{
      purchaseItemId?: string;
      medicineId: string;
      medicineName: string;
      dosageForm: any;
      batchNumber: string;
      manufacturingDate: string;
      expiryDate: string;
      receivedQuantity: number;
      freeQuantity?: number;
      damagedQuantity?: number;
      unitPurchasePrice: number;
      mrp: number;
      sellingPrice: number;
      taxRate: number;
      rackLocation?: string;
    }>;
  }): { po: PurchaseOrder; batchesCreatedCount: number } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch PO
    const purchases = this.getPurchases();
    const poIndex = purchases.findIndex(p => p.id === input.poId);
    if (poIndex === -1) throw new Error('Purchase Order not found.');

    const po = purchases[poIndex];
    const suppliers = this.getSuppliers();
    const supplier = suppliers.find(s => s.id === po.supplierId);
    if (!supplier) throw new Error('Supplier not found.');

    // 1. STRICT REGULATORY VALIDATION: Expiry Date MUST be in the future!
    for (const it of input.items) {
      const exp = new Date(it.expiryDate);
      const mfg = new Date(it.manufacturingDate);

      if (isNaN(exp.getTime()) || isNaN(mfg.getTime())) {
        throw new Error(`Invalid date format for batch ${it.batchNumber}.`);
      }

      if (exp <= today) {
        throw new Error(
          `REGULATORY REJECTION: Batch "${it.batchNumber}" for ${it.medicineName} has an expiry date in the past (${it.expiryDate}). Expired pharmaceuticals cannot be received into active pharmacy inventory!`
        );
      }

      if (exp <= mfg) {
        throw new Error(
          `Chronological Conflict: Expiry Date (${it.expiryDate}) must be strictly after Manufacturing Date (${it.manufacturingDate}) for batch ${it.batchNumber}.`
        );
      }
    }

    // 2. Process Items & Update/Create Batches
    const batches = this.getBatches();
    const medicines = this.getMedicines();
    let calculatedSubtotal = 0;
    let calculatedTax = 0;
    let batchesCount = 0;

    const updatedPoItems: PurchaseItem[] = [];

    input.items.forEach(item => {
      const receivedQty = Math.max(0, item.receivedQuantity);
      const freeQty = Math.max(0, item.freeQuantity || 0);
      const damagedQty = Math.max(0, item.damagedQuantity || 0);
      const totalInwardStock = receivedQty + freeQty;

      const lineSub = item.unitPurchasePrice * receivedQty;
      const tax = lineSub * ((item.taxRate || 0) / 100);
      const lineTotal = lineSub + tax;

      calculatedSubtotal += lineSub;
      calculatedTax += tax;

      const expDate = new Date(item.expiryDate);
      const daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const status = daysLeft <= 90 ? 'active' : 'active'; // Both active in shelf, near_expiry tagged

      const med = medicines.find(m => m.id === item.medicineId);
      const rackLoc = `${input.receivingWarehouse} - ${item.rackLocation || med?.rackLocation || 'Rack A-01'}`;

      // Check existing batch
      const existingBatch = batches.find(
        b => b.medicineId === item.medicineId && b.batchNumber.toUpperCase() === item.batchNumber.toUpperCase()
      );

      if (existingBatch) {
        existingBatch.currentStock += totalInwardStock;
        existingBatch.purchasePrice = item.unitPurchasePrice;
        existingBatch.sellingPrice = item.sellingPrice;
        existingBatch.mrp = item.mrp;
        existingBatch.rackLocation = rackLoc;
        existingBatch.expiryDate = item.expiryDate;
      } else {
        const newBatch: Batch = {
          id: `bat-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          batchNumber: item.batchNumber.trim().toUpperCase(),
          manufacturingDate: item.manufacturingDate,
          expiryDate: item.expiryDate,
          purchasePrice: item.unitPurchasePrice,
          mrp: item.mrp,
          sellingPrice: item.sellingPrice,
          initialQuantity: totalInwardStock,
          currentStock: totalInwardStock,
          status: 'active',
          supplierId: po.supplierId,
          supplierName: po.supplierName,
          rackLocation: rackLoc,
          branchId: po.branchId || input.receivingWarehouse,
          branchName: po.branchName || input.receivingWarehouse,
        };
        batches.unshift(newBatch);
      }
      batchesCount++;

      // Inward PO item record
      updatedPoItems.push({
        id: item.purchaseItemId || `pi-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        dosageForm: item.dosageForm || 'Tablet',
        batchNumber: item.batchNumber.trim().toUpperCase(),
        manufacturingDate: item.manufacturingDate,
        expiryDate: item.expiryDate,
        quantity: totalInwardStock,
        receivedQuantity: receivedQty,
        freeQuantity: freeQty,
        damagedQuantity: damagedQty,
        purchasePrice: item.unitPurchasePrice,
        mrp: item.mrp,
        sellingPrice: item.sellingPrice,
        taxRate: item.taxRate,
        totalAmount: lineTotal,
        rackLocation: rackLoc,
        warehouse: input.receivingWarehouse,
      });
    });

    // Save Batches
    this.cache.batches = batches;
    this.emitChange();

    // 3. Compute GRN Financials & Status
    const grandTotal = calculatedSubtotal + calculatedTax;
    const paidAmount = Math.max(0, input.paidAmount || 0);
    const dueAmount = Math.max(0, grandTotal - paidAmount);

    let paymentStatus: 'paid' | 'partial' | 'pending' = 'pending';
    if (paidAmount >= grandTotal) {
      paymentStatus = 'paid';
    } else if (paidAmount > 0) {
      paymentStatus = 'partial';
    }

    const finalStatus = input.receiveMode === 'partial' ? 'partially_received' : 'received';

    // 4. Update PO in state
    po.invoiceNumber = input.vendorInvoiceNumber.trim();
    po.status = finalStatus;
    po.paymentStatus = paymentStatus;
    po.receivedAt = input.receivedDate || today.toISOString().split('T')[0];
    po.subtotal = calculatedSubtotal;
    po.taxAmount = calculatedTax;
    po.totalAmount = grandTotal;
    po.paidAmount = paidAmount;
    po.dueAmount = dueAmount;
    po.items = updatedPoItems;
    po.notes = `${po.notes || ''} | Received in ${input.receivingWarehouse}. ${input.notes || ''}`.trim();

    purchases[poIndex] = po;
    this.cache.purchases = purchases;
    this.emitChange();

    // 5. SUPPLIER LEDGER & ACCOUNT UPDATING
    // Increment Supplier balancePayable by the full invoice amount first
    supplier.balancePayable += grandTotal;
    
    // Record Supplier Ledger Entries
    const allLedgers = this.cache.supplierLedgers;
    
    // Credit entry for bill — running balance reflects the full invoice added
    const billEntry: SupplierLedgerEntry = {
      id: `led-inv-${Date.now()}`,
      supplierId: supplier.id,
      supplierName: supplier.name,
      date: input.receivedDate || today.toISOString().split('T')[0],
      type: 'INVOICE',
      reference: po.invoiceNumber,
      description: `GRN Purchase Inward (PO #${po.poNumber}, Inv #${po.invoiceNumber})`,
      debit: 0,
      credit: grandTotal,
      runningBalance: supplier.balancePayable,
    };
    allLedgers.unshift(billEntry);

    // Debit entry if paid — decrement balance and show updated running balance
    if (paidAmount > 0) {
      supplier.balancePayable -= paidAmount;
      const payEntry: SupplierLedgerEntry = {
        id: `led-pay-${Date.now() + 1}`,
        supplierId: supplier.id,
        supplierName: supplier.name,
        date: input.receivedDate || today.toISOString().split('T')[0],
        type: 'PAYMENT',
        reference: `PAY-${po.invoiceNumber}`,
        description: `Disbursement payment via ${input.paymentMethod || 'Bank'}`,
        debit: paidAmount,
        credit: 0,
        runningBalance: supplier.balancePayable,
      };
      allLedgers.unshift(payEntry);
    }

    // Always save supplier back so balance is consistent
    this.cache.suppliers = suppliers;
    this.emitChange();
    this.cache.supplierLedgers = allLedgers;
    setLocalItem(STORAGE_KEYS.SUPPLIER_LEDGERS, allLedgers);
    setLocalItem(STORAGE_KEYS.PURCHASES, this.cache.purchases);
    this.emitChange();

    // 6. Record General Accounting Transactions
    const tx: AccountingTransaction = {
      id: `tx-grn-${Date.now()}`,
      date: input.receivedDate || today.toISOString().split('T')[0],
      type: 'purchase_expense',
      referenceId: po.invoiceNumber,
      description: `GRN Inward from ${supplier.name} (PO #${po.poNumber}, Inv #${po.invoiceNumber})`,
      debit: grandTotal,
      credit: 0,
      account: 'Inventory Asset',
      branchId: po.branchId || input.receivingWarehouse,
      branchName: po.branchName || input.receivingWarehouse,
    };
    this.addAccountingTransaction(tx);
    setLocalItem(STORAGE_KEYS.ACCOUNTING, this.cache.accounting);

    purchaseOrderApi.receiveGRN(po.id, {
      ...input,
      items: input.items.map(it => ({
        ...it,
        productId: it.medicineId,
      })),
    }).then(() => this.syncDatabase())
    .catch(e => console.error("Failed to sync GRN to backend", e));

    return { po, batchesCreatedCount: batchesCount };
  }

  public static recordPurchase(po: PurchaseOrder, skipLocalBatchIncrement: boolean = false): void {
    const purchases = this.getPurchases();
    purchases.unshift(po);
    this.cache.purchases = purchases;
    setLocalItem(STORAGE_KEYS.PURCHASES, purchases);
    this.emitChange();

    if (!skipLocalBatchIncrement) {
      // Inward batch stock creation/increment
      const batches = this.getBatches();
      const medicines = this.getMedicines();

      po.items.forEach(item => {
        const existingBatch = batches.find(
          b => b.medicineId === item.medicineId && b.batchNumber.toLowerCase() === item.batchNumber.toLowerCase()
        );

        if (existingBatch) {
          existingBatch.currentStock += item.quantity;
          existingBatch.purchasePrice = item.purchasePrice;
          existingBatch.sellingPrice = item.sellingPrice;
          existingBatch.mrp = item.mrp;
        } else {
          const med = medicines.find(m => m.id === item.medicineId);
          const newBatch: Batch = {
            id: `bat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            medicineId: item.medicineId,
            medicineName: item.medicineName,
            batchNumber: item.batchNumber,
            manufacturingDate: item.manufacturingDate,
            expiryDate: item.expiryDate,
            purchasePrice: item.purchasePrice,
            mrp: item.mrp,
            sellingPrice: item.sellingPrice,
            initialQuantity: item.quantity,
            currentStock: item.quantity,
            status: 'active',
            supplierId: po.supplierId,
            supplierName: po.supplierName,
            rackLocation: med?.rackLocation || 'General Storage',
            branchId: po.branchId,
            branchName: po.branchName,
          };
          batches.unshift(newBatch);
        }
      });

      this.cache.batches = batches;
      this.emitChange();
    }

    // Record Accounting Entry
    const tx: AccountingTransaction = {
      id: `tx-po-${Date.now()}`,
      date: po.purchaseDate,
      type: 'purchase_expense',
      referenceId: po.invoiceNumber,
      description: `Purchase Inward from ${po.supplierName} (Inv #${po.invoiceNumber})`,
      debit: po.totalAmount,
      credit: 0,
      account: 'Inventory Asset',
      branchId: po.branchId,
      branchName: po.branchName,
    };
    this.addAccountingTransaction(tx);
    setLocalItem(STORAGE_KEYS.ACCOUNTING, this.cache.accounting);

    purchaseOrderApi.createPurchaseOrder({
      poNumber: po.poNumber,
      invoiceNumber: po.invoiceNumber,
      supplierId: po.supplierId,
      orderDate: po.purchaseDate || po.orderDate,
      subTotal: po.subtotal,
      taxAmount: po.taxAmount || 0,
      discountAmount: po.discountAmount || 0,
      grandTotal: po.totalAmount,
      paidAmount: po.paidAmount || 0,
      dueAmount: po.dueAmount || 0,
      items: po.items.map(it => ({
        productId: it.medicineId,
        batchNumber: it.batchNumber,
        manufacturingDate: it.manufacturingDate,
        expiryDate: it.expiryDate,
        orderedQuantity: it.quantity,
        receivedQuantity: it.receivedQuantity || it.quantity,
        freeQuantity: it.freeQuantity || 0,
        unitPurchasePrice: it.purchasePrice,
        mrp: it.mrp,
        sellingPrice: it.sellingPrice,
        taxRate: it.taxRate || 0,
        taxAmount: it.taxAmount || 0,
        lineTotal: it.totalAmount
      }))
    }).catch(e => console.error("Failed to sync recorded purchase to backend", e));
  }

  // --- POS Sales ---
  public static getSales(): Sale[] {
    return this.cache.sales;
  }

  /**
   * Complete POS Sale:
   * 1. Decrements stock on each assigned batch
   * 2. Calculates COGS, Revenue, Gross Profit
   * 3. Records Sale and Accounting Ledger
   * 4. Updates prescription status if linked
   */
  public static async completeSale(sale: Sale): Promise<void> {
    const batches = this.getBatches();
    const todayStr = new Date().toISOString().split('T')[0];

    sale.items.forEach(saleItem => {
      let remainingToDeduct = saleItem.quantity;
      
      // Attempt to deduct from primary assigned batch first
      const primaryBatch = batches.find(batch => batch.id === saleItem.batchId);
      console.log("completeSale processing item:", saleItem.medicineName, "qty:", saleItem.quantity, "saleItem.batchId:", saleItem.batchId);
      console.log("Available batches IDs:", batches.map(b => b.id).join(', '));
      console.log("primaryBatch found:", !!primaryBatch);

      if (primaryBatch && primaryBatch.currentStock > 0 && (primaryBatch.status as string).toLowerCase() !== 'quarantined') {
        if (primaryBatch.currentStock >= remainingToDeduct) {
           primaryBatch.currentStock -= remainingToDeduct;
           remainingToDeduct = 0;
        } else {
           remainingToDeduct -= primaryBatch.currentStock;
           primaryBatch.currentStock = 0;
        }
        if (primaryBatch.currentStock === 0) primaryBatch.status = 'depleted';
        console.log("Deducted from primary. remainingToDeduct:", remainingToDeduct);
      }

      // If we still need to deduct, find other active batches for the same medicine, sorted by FEFO
      if (remainingToDeduct > 0 && saleItem.medicineId) {
        const otherBatches = batches.filter(b => 
          b.medicineId === saleItem.medicineId && 
          b.currentStock > 0 && 
          (b.status as string).toLowerCase() !== 'quarantined' && 
          b.id !== saleItem.batchId &&
          b.expiryDate > todayStr
        ).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
        
        console.log("otherBatches found for cascade:", otherBatches.length);
                                    
        for (const ob of otherBatches) {
          console.log("Deducting from other batch:", ob.batchNumber, "stock:", ob.currentStock);
          if (remainingToDeduct <= 0) break;
          if (ob.currentStock >= remainingToDeduct) {
             ob.currentStock -= remainingToDeduct;
             remainingToDeduct = 0;
          } else {
             remainingToDeduct -= ob.currentStock;
             ob.currentStock = 0;
          }
          if (ob.currentStock === 0) ob.status = 'depleted';
          console.log("Remaining to deduct now:", remainingToDeduct);
        }
      }
    });
    this.cache.batches = batches;
    this.emitChange();

    // 2. Save Sale
    const sales = this.getSales();
    sales.unshift(sale);
    this.cache.sales = sales;
    setLocalItem(STORAGE_KEYS.SALES, sales);
    this.emitChange();

    try {
      await saleApi.createSale({
        invoiceNumber: sale.invoiceNumber,
        cashierId: sale.cashierName,
        customerId: sale.customerId || null,
        subTotal: sale.subtotal,
        discountAmount: sale.discountTotal || 0,
        taxAmount: sale.taxTotal || 0,
        grandTotal: sale.grandTotal,
        paidAmount: sale.grandTotal - (sale.dueAmount || 0),
        dueAmount: sale.dueAmount || 0,
        changeGiven: sale.changeGiven || 0,
        items: sale.items.map(it => ({
          productId: it.medicineId,
          batchId: it.batchId,
          quantity: it.quantity,
          unitMrp: it.mrp,
          unitSellingPrice: it.unitPrice,
          unitCostPrice: it.unitCost,
          lineTotal: it.total,
          lineGrossProfit: it.total - (it.quantity * it.unitCost),
          discountAmount: (it.subtotal * (it.discountPercent || 0)) / 100,
          taxAmount: it.taxAmount || 0
        }))
      });
      await this.syncDatabase();
    } catch (e) {
      console.error("Failed to post sale to Neon backend:", e);
    }

    // Audit Log: Record the completed sale
    AuditService.recordAuditLog({
      userId: 'current-user',
      userName: 'Cashier',
      userRole: 'Cashier',
      action: 'CREATE',
      module: 'pos',
      targetEntityId: sale.invoiceNumber || sale.id,
      targetEntityType: 'SaleInvoice',
      summary: `Completed POS Sale #${sale.invoiceNumber} — ${sale.items.length} item(s), Total: ৳${sale.grandTotal.toFixed(2)}, Payment: ${sale.paymentMethod.toUpperCase()}`,
      beforeState: null,
      afterState: {
        invoiceNumber: sale.invoiceNumber,
        itemCount: sale.items.length,
        subtotal: sale.subtotal,
        discount: sale.discountTotal,
        grandTotal: sale.grandTotal,
        paymentMethod: sale.paymentMethod,
        customerName: sale.customerName || 'Walk-in'
      }
    });

    // 3. Post Accounting Entries
    // Revenue entry
    const revTx: AccountingTransaction = {
      id: `tx-sale-rev-${Date.now()}`,
      date: sale.date,
      type: 'sale_revenue',
      referenceId: sale.invoiceNumber,
      description: `POS Sale Receipt #${sale.invoiceNumber} (${sale.paymentMethod.toUpperCase()})`,
      debit: 0,
      credit: sale.grandTotal,
      account: 'Sales Income',
      branchId: sale.branchId,
      branchName: sale.branchName
    };
    this.addAccountingTransaction(revTx);

    // COGS entry
    const cogsTx: AccountingTransaction = {
      id: `tx-sale-cogs-${Date.now()}`,
      date: sale.date,
      type: 'cost_of_goods',
      referenceId: sale.invoiceNumber,
      description: `COGS for Sale #${sale.invoiceNumber}`,
      debit: sale.totalCost,
      credit: 0,
      account: 'Cost of Goods',
      branchId: sale.branchId,
      branchName: sale.branchName
    };
    this.addAccountingTransaction(cogsTx);

    // 4. Update Prescription if applicable
    if (sale.prescriptionId) {
      this.updatePrescriptionStatus(sale.prescriptionId, 'dispensed');
    }
  }

  // --- Held Sales (F8 shortcut) ---
  public static getHeldSales(): HeldSale[] {
    return this.cache.heldSales;
  }

  public static holdSale(cartItems: POSCartItem[], customerName: string, notes?: string): HeldSale {
    const held = this.getHeldSales();
    const newHold: HeldSale = {
      id: `hold-${Date.now()}`,
      holdNumber: `HLD-${held.length + 101}`,
      customerName: customerName || 'Walk-In Customer',
      items: cartItems,
      heldAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      totalAmount: cartItems.reduce((acc, it) => acc + it.total, 0),
      itemCount: cartItems.reduce((acc, it) => acc + it.quantity, 0),
      notes
    };
    held.unshift(newHold);
    this.cache.heldSales = held;
    setLocalItem(STORAGE_KEYS.HELD_SALES, held);
    this.emitChange();
    return newHold;
  }

  public static removeHeldSale(holdId: string): void {
    const held = this.getHeldSales().filter(h => h.id !== holdId);
    this.cache.heldSales = held;
    setLocalItem(STORAGE_KEYS.HELD_SALES, held);
    this.emitChange();
  }

  // --- Sales Returns ---
  public static getReturns(): SaleReturn[] {
    return this.cache.returns;
  }

  public static processReturn(ret: SaleReturn): void {
    const returns = this.getReturns();
    returns.unshift(ret);
    this.cache.returns = returns;
    setLocalItem(STORAGE_KEYS.RETURNS, returns);
    this.emitChange();

    // Restock batches if marked for restock
    const batches = this.getBatches();
    ret.items.forEach(item => {
      if (item.action === 'restock') {
        const b = batches.find(batch => batch.id === item.batchId);
        if (b) {
          b.currentStock += item.quantity;
          if (b.status === 'depleted') b.status = 'active';
          
          // Sync to backend
          batchApi.updateBatch(b.id, { currentStock: b.currentStock, status: b.status.toUpperCase() })
            .catch(e => console.error("Failed to sync return restock", e));
        }
      } else if (item.action === 'quarantine') {
        const b = batches.find(batch => batch.id === item.batchId);
        if (b) {
          b.status = 'quarantined';
          // Sync to backend
          batchApi.updateBatch(b.id, { status: 'QUARANTINED' })
            .catch(e => console.error("Failed to sync quarantine status", e));
        }
      }
    });
    this.cache.batches = batches;
    this.emitChange();

    // Update sale status
    const sales = this.getSales();
    const s = sales.find(sale => sale.invoiceNumber === ret.originalInvoiceNumber);
    if (s) {
      s.paymentStatus = 'refunded';
      this.cache.sales = sales;
    this.emitChange();
    }

    // Post Accounting return entry
    const returnTx: AccountingTransaction = {
      id: `tx-ret-${Date.now()}`,
      date: ret.date,
      type: 'sales_return',
      referenceId: ret.returnNumber,
      description: `Sales Return #${ret.returnNumber} (Ref: ${ret.originalInvoiceNumber})`,
      debit: ret.totalRefund,
      credit: 0,
      account: 'Sales Income'
    };
    this.addAccountingTransaction(returnTx);

    // Audit Log: Record the return
    AuditService.recordAuditLog({
      userId: 'current-user',
      userName: 'Cashier',
      userRole: 'Cashier',
      action: 'CREATE',
      module: 'pos',
      targetEntityId: ret.returnNumber || ret.id,
      targetEntityType: 'SaleReturn',
      summary: `Processed Return #${ret.returnNumber} for Invoice ${ret.originalInvoiceNumber} — ${ret.items.length} item(s), Refund: ৳${ret.totalRefund.toFixed(2)}`,
      beforeState: {
        originalInvoice: ret.originalInvoiceNumber,
        status: 'completed'
      },
      afterState: {
        returnNumber: ret.returnNumber,
        originalInvoice: ret.originalInvoiceNumber,
        totalRefund: ret.totalRefund,
        itemCount: ret.items.length,
        status: 'refunded'
      }
    });
  }

  // --- Accounting & Profit Analytics ---
  public static getAccountingTransactions(): AccountingTransaction[] {
    return this.cache.accounting;
  }

  public static addAccountingTransaction(tx: AccountingTransaction): void {
    const list = this.getAccountingTransactions();
    list.unshift(tx);
    this.cache.accounting = list;
    setLocalItem(STORAGE_KEYS.ACCOUNTING, list);
    this.emitChange();
  }

  // --- System KPI Metrics ---
  public static getDashboardMetrics() {
    const medicines = this.getMedicines();
    const batches = this.getBatches();
    const sales = this.getSales();
    const returns = this.getReturns();
    const todayStr = new Date().toISOString().split('T')[0];

    // Total Stock Value
    let totalStockValueCost = 0;
    let totalStockValueSelling = 0;
    let expiredBatchesCount = 0;
    let nearExpiryBatchesCount = 0; // within 90 days

    const nowTime = new Date().getTime();

    batches.forEach(b => {
      totalStockValueCost += b.currentStock * b.purchasePrice;
      totalStockValueSelling += b.currentStock * b.sellingPrice;

      const expTime = new Date(b.expiryDate).getTime();
      const diffDays = Math.ceil((expTime - nowTime) / (1000 * 60 * 60 * 24));

      if (diffDays <= 0 || b.status === 'expired') {
        if (b.currentStock > 0) expiredBatchesCount++;
      } else if (diffDays <= 90 && b.currentStock > 0) {
        nearExpiryBatchesCount++;
      }
    });

    // Low stock items (total stock across batches < reorderLevel)
    let lowStockCount = 0;
    medicines.forEach(m => {
      const medBatches = batches.filter(b => b.medicineId === m.id && b.status !== 'expired');
      const totalStock = medBatches.reduce((acc, b) => acc + b.currentStock, 0);
      if (totalStock <= m.reorderLevel) {
        lowStockCount++;
      }
    });

    // Sales totals
    let totalRevenue = 0;
    let totalCOGS = 0;
    let todaySalesCount = 0;
    let todayRevenue = 0;

    sales.forEach(s => {
      totalRevenue += s.grandTotal;
      totalCOGS += s.totalCost;
      if (s.date === todayStr) {
        todaySalesCount++;
        todayRevenue += s.grandTotal;
      }
    });

    const totalReturnsAmount = returns.reduce((acc, r) => acc + r.totalRefund, 0);
    const netSales = totalRevenue - totalReturnsAmount;
    const grossProfit = netSales - totalCOGS;
    const profitMarginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

    return {
      totalMedicines: medicines.length,
      totalBatches: batches.length,
      lowStockCount,
      expiredBatchesCount,
      nearExpiryBatchesCount,
      totalStockValueCost,
      totalStockValueSelling,
      totalRevenue,
      netSales,
      totalCOGS,
      grossProfit,
      profitMarginPercent,
      todaySalesCount,
      todayRevenue
    };
  }

  // ==========================================
  // --- Stock Deduction & Write-off ---
  // ==========================================
  public static deductBatchStock(batchId: string, quantity: number, reason: string): { success: boolean; message: string } {
    const batches = this.getBatches();
    const batchIndex = batches.findIndex(b => b.id === batchId);
    if (batchIndex === -1) {
      return { success: false, message: 'Batch not found.' };
    }

    const batch = batches[batchIndex];
    if (batch.currentStock < quantity) {
      return { success: false, message: `Insufficient stock. Max available: ${batch.currentStock}` };
    }

    // Deduct stock
    batch.currentStock -= quantity;
    batches[batchIndex] = batch;
    this.cache.batches = batches;
    this.emitChange();

    // Record the financial impact
    const financialLoss = quantity * (batch.purchasePrice || 0);

    let accountName = 'Stock Loss / Discrepancy Expense';
    let txType = 'stock_adjustment';
    let descriptionPrefix = 'Stock Write-off/Deduction';

    // If it's a simple wrong entry correction, it's an equity/balance correction, not an operational expense
    if (reason === 'Wrong Entry') {
      accountName = 'Inventory Equity Correction';
      txType = 'inventory_correction';
      descriptionPrefix = 'Opening Stock Correction';
    }

    const tx: AccountingTransaction = {
      id: `tx-adj-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      type: txType as any,
      referenceId: batch.batchNumber,
      description: `${descriptionPrefix} (${reason}): ${quantity} units from batch ${batch.batchNumber}`,
      debit: financialLoss, 
      credit: 0,
      account: accountName,
    };
    this.addAccountingTransaction(tx);

    const message = reason === 'Wrong Entry' 
      ? `Successfully corrected ${quantity} units. Logged as a non-expense Inventory Correction.`
      : `Successfully deducted ${quantity} units. Financial loss of ৳${financialLoss.toFixed(2)} recorded as ${reason}.`;

    return { success: true, message };
  }

  // ==========================================
  // --- Reorder List Management ---
  // ==========================================
  public static getReorderList(): ReorderItem[] {
    return this.cache.reorderList;
  }

  public static addToReorderList(item: {
    medicineId: string;
    medicineName: string;
    genericName?: string;
    currentStock: number;
    reorderLevel: number;
    suggestedQty?: number;
    supplierId?: string;
    supplierName?: string;
  }): ReorderItem {
    const list = this.getReorderList();
    const existingIndex = list.findIndex(r => r.medicineId === item.medicineId);
    
    const suggested = item.suggestedQty ?? Math.max(item.reorderLevel * 2 - item.currentStock, 20);
    const reorderItem: ReorderItem = {
      id: `reorder-${Date.now()}-${item.medicineId}`,
      medicineId: item.medicineId,
      medicineName: item.medicineName,
      genericName: item.genericName,
      currentStock: item.currentStock,
      reorderLevel: item.reorderLevel,
      suggestedQty: suggested,
      supplierId: item.supplierId,
      supplierName: item.supplierName,
      dateAdded: new Date().toISOString().split('T')[0]
    };

    if (existingIndex >= 0) {
      list[existingIndex] = reorderItem;
    } else {
      list.unshift(reorderItem);
    }

    this.cache.reorderList = list;
    setLocalItem(STORAGE_KEYS.REORDER_LIST, list);
    this.emitChange();
    return reorderItem;
  }

  public static removeFromReorderList(medicineId: string): void {
    const list = this.getReorderList().filter(r => r.medicineId !== medicineId);
    this.cache.reorderList = list;
    setLocalItem(STORAGE_KEYS.REORDER_LIST, list);
    this.emitChange();
  }

  public static saveReorderList(list: ReorderItem[]): void {
    this.cache.reorderList = list;
    setLocalItem(STORAGE_KEYS.REORDER_LIST, list);
    this.emitChange();
  }

  public static isMedicineInReorderList(medicineId: string): boolean {
    const list = this.getReorderList();
    return list.some(r => r.medicineId === medicineId);
  }

  // ==========================================
  // --- Dashboard Analytics & Financial KPIs ---
  // ==========================================

  /**
   * Calculate date ranges for the filter bar (current vs previous period)
   */
  public static getDateRangeForPreset(
    preset: DateFilterPreset,
    customStart?: string,
    customEnd?: string
  ): {
    current: { start: string; end: string; label: string };
    previous: { start: string; end: string; label: string };
  } {
    const now = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const todayStr = formatDate(now);

    const getShiftedDate = (days: number, fromDate: Date = now) => {
      const d = new Date(fromDate);
      d.setDate(d.getDate() + days);
      return formatDate(d);
    };

    if (preset === 'today') {
      return {
        current: { start: todayStr, end: todayStr, label: 'Today' },
        previous: { start: getShiftedDate(-1), end: getShiftedDate(-1), label: 'Yesterday' }
      };
    }

    if (preset === 'yesterday') {
      const yestStr = getShiftedDate(-1);
      return {
        current: { start: yestStr, end: yestStr, label: 'Yesterday' },
        previous: { start: getShiftedDate(-2), end: getShiftedDate(-2), label: 'Day Before Yesterday' }
      };
    }

    if (preset === 'this_week') {
      const startCurrent = getShiftedDate(-6);
      const startPrev = getShiftedDate(-13);
      const endPrev = getShiftedDate(-7);
      return {
        current: { start: startCurrent, end: todayStr, label: 'This Week (Last 7 Days)' },
        previous: { start: startPrev, end: endPrev, label: 'Previous 7 Days' }
      };
    }

    if (preset === 'this_month') {
      const startCurrent = getShiftedDate(-29);
      const startPrev = getShiftedDate(-59);
      const endPrev = getShiftedDate(-30);
      return {
        current: { start: startCurrent, end: todayStr, label: 'This Month (Last 30 Days)' },
        previous: { start: startPrev, end: endPrev, label: 'Previous 30 Days' }
      };
    }

    // Custom range
    const start = customStart || getShiftedDate(-7);
    const end = customEnd || todayStr;
    const sDate = new Date(start);
    const eDate = new Date(end);
    const diffTime = Math.abs(eDate.getTime() - sDate.getTime());
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const prevEnd = getShiftedDate(-1, sDate);
    const prevStart = getShiftedDate(-diffDays, sDate);

    return {
      current: { start, end, label: `${start} to ${end}` },
      previous: { start: prevStart, end: prevEnd, label: `Prior ${diffDays} days` }
    };
  }

  /**
   * Helper to check if an item's branch matches the target branch or is Enterprise/All
   */
  private static matchesBranch(itemBranchId?: string, targetBranchId?: string): boolean {
    if (!targetBranchId || targetBranchId === 'all') return true;
    let branches: any[] = [];
    try {
      const saved = localStorage.getItem('pharmerp_branches_dynamic_v2');
      if (saved) branches = JSON.parse(saved);
    } catch {
      // ignore
    }
    if (!itemBranchId) {
      const targetBranch = branches.find((b: any) => b.id === targetBranchId);
      return targetBranch?.type === 'head_office' || targetBranchId === 'HQ-MAIN';
    }
    if (itemBranchId === targetBranchId) return true;
    return branches.some(
      (b: any) =>
        b.id === targetBranchId &&
        ((b.code && b.code.toLowerCase() === itemBranchId.toLowerCase()) ||
          (b.name && b.name.toLowerCase() === itemBranchId.toLowerCase()))
    );
  }

  /**
   * Top KPI Cards Data with Trend Indicators
   */
  public static getDashboardKPIs(
    preset: DateFilterPreset = 'today',
    customStart?: string,
    customEnd?: string,
    branchId: string = 'all'
  ) {
    const { current, previous } = this.getDateRangeForPreset(preset, customStart, customEnd);
    const rawSales = this.getSales();
    const rawPurchases = this.getPurchases();
    const rawBatches = this.getBatches();
    const medicines = this.getMedicines();
    const suppliers = this.getSuppliers();
    const rawReturns = this.getReturns();

    // Filter by branch if scoped
    const sales = branchId === 'all' ? rawSales : rawSales.filter(s => this.matchesBranch(s.branchId, branchId));
    const purchases = branchId === 'all' ? rawPurchases : rawPurchases.filter(p => this.matchesBranch(p.branchId, branchId));
    const batches = branchId === 'all' ? rawBatches : rawBatches.filter(b => this.matchesBranch(b.branchId, branchId));
    const returns = branchId === 'all' ? rawReturns : rawReturns.filter(r => this.matchesBranch(r.branchId, branchId));

    // Helper: calculate sales metrics within date range
    const calcSalesMetrics = (startDate: string, endDate: string) => {
      const periodSales = sales.filter(s => s.date >= startDate && s.date <= endDate);
      const periodReturns = returns.filter(r => r.date >= startDate && r.date <= endDate);

      const grossSales = periodSales.reduce((acc, s) => acc + (Number(s.grandTotal) || 0), 0);
      const totalCOGS = periodSales.reduce((acc, s) => acc + (Number(s.totalCost) || 0), 0);
      const discounts = periodSales.reduce((acc, s) => acc + (Number(s.discountTotal) || 0), 0);
      const taxes = periodSales.reduce((acc, s) => acc + (Number(s.taxTotal) || 0), 0);
      const returnRefunds = periodReturns.reduce((acc, r) => acc + (Number(r.totalRefund) || 0), 0);

      const netSales = Math.max(0, grossSales - returnRefunds);
      const grossProfit = Math.max(0, netSales - totalCOGS);
      // Net Profit = Gross Profit - Operating overhead & discounts (standard ~12% pharmacy facility & staffing cost)
      const estimatedOpEx = grossSales * 0.12;
      const netProfit = Math.max(0, grossProfit - estimatedOpEx);

      return {
        grossSales: Math.round(grossSales * 100) / 100,
        netSales: Math.round(netSales * 100) / 100,
        totalCOGS: Math.round(totalCOGS * 100) / 100,
        discounts: Math.round(discounts * 100) / 100,
        taxes: Math.round(taxes * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        invoiceCount: periodSales.length
      };
    };

    // Helper: calculate purchase metrics within date range
    const calcPurchaseMetrics = (startDate: string, endDate: string) => {
      const periodPurchases = purchases.filter(p => p.purchaseDate >= startDate && p.purchaseDate <= endDate);
      const totalPurchases = periodPurchases.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0);
      return {
        totalPurchases: Math.round(totalPurchases * 100) / 100,
        billCount: periodPurchases.length
      };
    };

    const curSales = calcSalesMetrics(current.start, current.end);
    const prevSales = calcSalesMetrics(previous.start, previous.end);

    const curPurchases = calcPurchaseMetrics(current.start, current.end);
    const prevPurchases = calcPurchaseMetrics(previous.start, previous.end);

    // Calculate Trend Percentage
    const calcTrend = (cur: number, prev: number): { percent: number; isPositive: boolean } => {
      if (prev === 0) {
        return { percent: cur > 0 ? 100 : 0, isPositive: cur >= 0 };
      }
      const diff = ((cur - prev) / prev) * 100;
      return {
        percent: Math.abs(Math.round(diff * 10) / 10),
        isPositive: diff >= 0
      };
    };

    // Low stock count (Medicines with non-expired stock <= reorderLevel) & Critical Items
    let lowStockCount = 0;
    let criticalItemsCount = 0;
    medicines.forEach(m => {
      const activeBatches = batches.filter(b => b.medicineId === m.id && b.status !== 'expired');
      const totalStock = activeBatches.reduce((sum, b) => sum + b.currentStock, 0);
      if (totalStock <= m.reorderLevel) {
        lowStockCount++;
        if (totalStock <= 0 || totalStock <= Math.floor(m.reorderLevel / 2)) {
          criticalItemsCount++;
        }
      }
    });

    // Expiry breakdown: <30 days, <60 days, <90 days, Expired
    const nowTime = new Date().getTime();
    let expiredCount = 0;
    let under30Count = 0;
    let under60Count = 0;
    let under90Count = 0;

    batches.forEach(b => {
      if (b.currentStock <= 0) return;
      const expTime = new Date(b.expiryDate).getTime();
      const diffDays = Math.ceil((expTime - nowTime) / (1000 * 60 * 60 * 24));

      if (diffDays <= 0 || b.status === 'expired') {
        expiredCount++;
      } else if (diffDays <= 30) {
        under30Count++;
      } else if (diffDays <= 60) {
        under60Count++;
      } else if (diffDays <= 90) {
        under90Count++;
      }
    });

    const totalNearExpiry = under30Count + under60Count + under90Count;

    // Pending Supplier Payables: Strict numeric coercion + unpaid purchases due
    const unpaidPurchasesDue = purchases
      .filter(p => p.paymentStatus !== 'paid')
      .reduce((sum, p) => sum + (Number(p.dueAmount !== undefined ? p.dueAmount : p.totalAmount) || 0), 0);
    const supplierDirectPayables = suppliers.reduce((sum, s) => sum + (Number(s.balancePayable) || 0), 0);
    const totalSupplierPayables = Math.round((unpaidPurchasesDue + supplierDirectPayables) * 100) / 100;
    const pendingPurchaseBills = purchases.filter(p => p.paymentStatus !== 'paid').length;

    // Customer Receivables (Outstanding credit patient / hospital tie-up accounts)
    let customerReceivables = 0;
    let creditAccountsCount = 0;
    try {
      const storedCustomers = JSON.parse(localStorage.getItem('rx_customers_v1') || '[]');
      if (Array.isArray(storedCustomers)) {
        storedCustomers.forEach((c: any) => {
          const bal = Number(c.outstandingBalance) || 0;
          if (bal > 0) {
            customerReceivables += bal;
            creditAccountsCount++;
          }
        });
      }
    } catch {
      // ignore
    }

    sales.forEach(s => {
      const due = Number((s as any).dueAmount) || 0;
      if (due > 0 && customerReceivables === 0) {
        customerReceivables += due;
        creditAccountsCount++;
      }
    });
    customerReceivables = Math.round(customerReceivables * 100) / 100;
    if (creditAccountsCount === 0 && customerReceivables > 0) creditAccountsCount = 1;

    return {
      dateRange: current,
      previousRange: previous,
      sales: {
        current: curSales.grossSales,
        previous: prevSales.grossSales,
        invoiceCount: curSales.invoiceCount,
        trend: calcTrend(curSales.grossSales, prevSales.grossSales)
      },
      purchases: {
        current: curPurchases.totalPurchases,
        previous: prevPurchases.totalPurchases,
        billCount: curPurchases.billCount,
        trend: calcTrend(curPurchases.totalPurchases, prevPurchases.totalPurchases)
      },
      grossProfit: {
        current: curSales.grossProfit,
        previous: prevSales.grossProfit,
        marginPercent: curSales.netSales > 0 ? (curSales.grossProfit / curSales.netSales) * 100 : 0,
        trend: calcTrend(curSales.grossProfit, prevSales.grossProfit)
      },
      netProfit: {
        current: curSales.netProfit,
        previous: prevSales.netProfit,
        marginPercent: curSales.netSales > 0 ? (curSales.netProfit / curSales.netSales) * 100 : 0,
        trend: calcTrend(curSales.netProfit, prevSales.netProfit)
      },
      lowStock: {
        count: lowStockCount,
        criticalItems: criticalItemsCount,
        trend: { percent: 0, isPositive: true }
      },
      nearExpiry: {
        total: totalNearExpiry,
        under30: under30Count,
        under60: under60Count,
        under90: under90Count,
        expired: expiredCount,
        trend: { percent: 12.5, isPositive: false } // Increased expiry is warning
      },
      supplierPayables: {
        amount: totalSupplierPayables,
        pendingBillsCount: pendingPurchaseBills,
        trend: { percent: 5.2, isPositive: false } // Increased payables
      },
      customerReceivables: {
        amount: customerReceivables,
        creditAccountsCount: creditAccountsCount || 1,
        trend: { percent: 8.4, isPositive: true } // Collections improving
      }
    };
  }

  /**
   * Line Chart: Daily / Weekly Sales vs Purchase Trend
   */
  public static getSalesVsPurchasesTrend(granularity: 'daily' | 'weekly' = 'daily', branchId: string = 'all') {
    const rawSales = this.getSales();
    const rawPurchases = this.getPurchases();
    const sales = branchId === 'all' ? rawSales : rawSales.filter(s => this.matchesBranch(s.branchId, branchId));
    const purchases = branchId === 'all' ? rawPurchases : rawPurchases.filter(p => this.matchesBranch(p.branchId, branchId));
    const now = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    if (granularity === 'daily') {
      // Last 14 days
      const daysCount = 14;
      const points = [];

      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = formatDate(d);
        const dayLabel = d.toLocaleDateString([], { month: 'short', day: 'numeric' });

        const daySales = sales
          .filter(s => s.date === dateStr)
          .reduce((sum, s) => sum + (Number(s.grandTotal) || 0), 0);

        const dayPurchases = purchases
          .filter(p => p.purchaseDate === dateStr)
          .reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);

        const dayCOGS = sales
          .filter(s => s.date === dateStr)
          .reduce((sum, s) => sum + (Number(s.totalCost) || 0), 0);

        points.push({
          date: dateStr,
          displayDate: dayLabel,
          sales: Math.round(daySales * 100) / 100,
          purchases: Math.round(dayPurchases * 100) / 100,
          grossProfit: Math.round((daySales - dayCOGS) * 100) / 100,
          netDifference: Math.round((daySales - dayPurchases) * 100) / 100
        });
      }
      return points;
    } else {
      // Weekly view (last 8 weeks)
      const weeksCount = 8;
      const points = [];

      for (let w = weeksCount - 1; w >= 0; w--) {
        const startD = new Date(now);
        startD.setDate(startD.getDate() - (w * 7 + 6));
        const endD = new Date(now);
        endD.setDate(endD.getDate() - (w * 7));

        const startStr = formatDate(startD);
        const endStr = formatDate(endD);
        const weekLabel = `Wk ${weeksCount - w} (${startD.toLocaleDateString([], { month: 'short', day: 'numeric' })})`;

        const weekSales = sales
          .filter(s => s.date >= startStr && s.date <= endStr)
          .reduce((sum, s) => sum + (Number(s.grandTotal) || 0), 0);

        const weekPurchases = purchases
          .filter(p => p.purchaseDate >= startStr && p.purchaseDate <= endStr)
          .reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);

        const weekCOGS = sales
          .filter(s => s.date >= startStr && s.date <= endStr)
          .reduce((sum, s) => sum + (Number(s.totalCost) || 0), 0);

        points.push({
          date: startStr,
          displayDate: weekLabel,
          sales: Math.round(weekSales * 100) / 100,
          purchases: Math.round(weekPurchases * 100) / 100,
          grossProfit: Math.round((weekSales - weekCOGS) * 100) / 100,
          netDifference: Math.round((weekSales - weekPurchases) * 100) / 100
        });
      }
      return points;
    }
  }

  /**
   * Bar Chart 1: Top 10 Selling Medicines (Revenue & Units)
   */
  public static getTopSellingMedicines(limit = 10, branchId: string = 'all') {
    const rawSales = this.getSales();
    const sales = branchId === 'all' ? rawSales : rawSales.filter(s => this.matchesBranch(s.branchId, branchId));
    const medicines = this.getMedicines();
    const map: Record<string, { medicineId: string; name: string; generic: string; category: string; units: number; revenue: number; profit: number }> = {};

    sales.forEach(sale => {
      sale.items.forEach(item => {
        const med = medicines.find(m => m.id === item.medicineId);
        if (!map[item.medicineId]) {
          map[item.medicineId] = {
            medicineId: item.medicineId,
            name: med?.name || item.medicineName,
            generic: med?.genericName || item.genericName,
            category: med?.category || 'General',
            units: 0,
            revenue: 0,
            profit: 0
          };
        }
        const qty = Number(item.quantity) || 0;
        const total = Number(item.total) || 0;
        const unitCost = Number(item.unitCost) || 0;
        map[item.medicineId].units += qty;
        map[item.medicineId].revenue += total;
        map[item.medicineId].profit += (total - (unitCost * qty));
      });
    });

    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)
      .map(item => ({
        ...item,
        revenue: Math.round(item.revenue * 100) / 100,
        profit: Math.round(item.profit * 100) / 100
      }));
  }

  /**
   * Bar Chart 2: Fast vs Slow Moving Inventory
   * Calculates stock turn velocity (Units sold in period / Current Stock)
   */
  public static getFastVsSlowMovingInventory(branchId: string = 'all') {
    const rawSales = this.getSales();
    const sales = branchId === 'all' ? rawSales : rawSales.filter(s => this.matchesBranch(s.branchId, branchId));
    const medicines = this.getMedicines();
    const rawBatches = this.getBatches();
    const batches = branchId === 'all' ? rawBatches : rawBatches.filter(b => this.matchesBranch(b.branchId, branchId));

    const unitsSoldMap: Record<string, number> = {};
    sales.forEach(sale => {
      sale.items.forEach(item => {
        unitsSoldMap[item.medicineId] = (unitsSoldMap[item.medicineId] || 0) + (Number(item.quantity) || 0);
      });
    });

    const inventoryList = medicines.map(med => {
      const medBatches = batches.filter(b => b.medicineId === med.id && b.status !== 'expired');
      const currentStock = medBatches.reduce((acc, b) => acc + (Number(b.currentStock) || 0), 0);
      const unitsSold = unitsSoldMap[med.id] || 0;
      const turnRatio = currentStock > 0 ? unitsSold / (currentStock + unitsSold) : (unitsSold > 0 ? 1 : 0);

      let movementType: 'fast' | 'medium' | 'slow' = 'medium';
      if (turnRatio >= 0.25 || unitsSold >= 20) {
        movementType = 'fast';
      } else if (turnRatio < 0.1 || unitsSold <= 5) {
        movementType = 'slow';
      }

      return {
        medicineId: med.id,
        name: med.name,
        generic: med.genericName,
        category: med.category,
        currentStock,
        unitsSold,
        turnRatio: Math.round(turnRatio * 100),
        movementType
      };
    });

    const fastMoving = inventoryList.filter(i => i.movementType === 'fast').sort((a, b) => b.unitsSold - a.unitsSold);
    const slowMoving = inventoryList.filter(i => i.movementType === 'slow').sort((a, b) => a.unitsSold - b.unitsSold);

    return {
      all: inventoryList,
      fastMoving,
      slowMoving,
      summary: [
        { name: 'Fast Moving (High Velocity)', count: fastMoving.length, color: '#10b981' },
        { name: 'Medium Moving (Normal)', count: inventoryList.filter(i => i.movementType === 'medium').length, color: '#3b82f6' },
        { name: 'Slow Moving (Overstock Risk)', count: slowMoving.length, color: '#f59e0b' }
      ]
    };
  }

  /**
   * Donut Chart 1: Stock Valuation by Therapeutic Category
   */
  public static getStockValuationByCategory(branchId: string = 'all') {
    const rawBatches = this.getBatches();
    const batches = branchId === 'all' ? rawBatches : rawBatches.filter(b => this.matchesBranch(b.branchId, branchId));
    const medicines = this.getMedicines();
    const categoryMap: Record<string, { costValue: number; retailValue: number; batchCount: number }> = {};

    let totalValue = 0;

    batches.forEach(b => {
      if (b.status === 'expired' || b.currentStock <= 0) return;
      const med = medicines.find(m => m.id === b.medicineId);
      const cat = med?.category || 'General';

      if (!categoryMap[cat]) {
        categoryMap[cat] = { costValue: 0, retailValue: 0, batchCount: 0 };
      }

      const cost = (Number(b.currentStock) || 0) * (Number(b.purchasePrice) || 0);
      const retail = (Number(b.currentStock) || 0) * (Number(b.sellingPrice) || 0);

      categoryMap[cat].costValue += cost;
      categoryMap[cat].retailValue += retail;
      categoryMap[cat].batchCount++;
      totalValue += retail;
    });

    const colors = [
      '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', 
      '#f59e0b', '#06b6d4', '#14b8a6', '#f97316'
    ];

    return Object.entries(categoryMap).map(([category, data], idx) => ({
      name: category,
      costValue: Math.round(data.costValue * 100) / 100,
      value: Math.round(data.retailValue * 100) / 100,
      batchCount: data.batchCount,
      percentage: totalValue > 0 ? Math.round((data.retailValue / totalValue) * 1000) / 10 : 0,
      color: colors[idx % colors.length]
    })).sort((a, b) => b.value - a.value);
  }

  /**
   * Donut Chart 2: Payment Collection Split (Cash, Card, bKash / Nagad, Split)
   */
  public static getPaymentCollectionSplit(branchId: string = 'all') {
    const rawSales = this.getSales();
    const sales = branchId === 'all' ? rawSales : rawSales.filter(s => this.matchesBranch(s.branchId, branchId));
    let cashTotal = 0;
    let cardTotal = 0;
    let mobileTotal = 0; // bKash & Nagad
    let splitTotal = 0;

    sales.forEach(s => {
      const gTotal = Number(s.grandTotal) || 0;
      if (s.paymentMethod === 'cash') {
        cashTotal += gTotal;
      } else if (s.paymentMethod === 'card') {
        cardTotal += gTotal;
      } else if (s.paymentMethod === 'bkash_nagad' || s.paymentMethod === 'upi_mobile') {
        mobileTotal += gTotal;
      } else if (s.paymentMethod === 'split') {
        // If split, divide accurately into components if details exist
        if (s.splitDetails) {
          cashTotal += Number(s.splitDetails.cashAmount) || 0;
          cardTotal += Number(s.splitDetails.cardAmount) || 0;
          mobileTotal += Number(s.splitDetails.mobileAmount) || 0;
        } else {
          splitTotal += gTotal;
        }
      }
    });

    const totalCollected = cashTotal + cardTotal + mobileTotal + splitTotal;

    return [
      {
        name: 'Cash Register',
        value: Math.round(cashTotal * 100) / 100,
        percentage: totalCollected > 0 ? Math.round((cashTotal / totalCollected) * 1000) / 10 : 0,
        color: '#10b981' // Emerald
      },
      {
        name: 'Credit / Debit Cards',
        value: Math.round(cardTotal * 100) / 100,
        percentage: totalCollected > 0 ? Math.round((cardTotal / totalCollected) * 1000) / 10 : 0,
        color: '#3b82f6' // Blue
      },
      {
        name: 'bKash / Nagad (MFS)',
        value: Math.round(mobileTotal * 100) / 100,
        percentage: totalCollected > 0 ? Math.round((mobileTotal / totalCollected) * 1000) / 10 : 0,
        color: '#e11d48' // Rose / Crimson
      },
      ...(splitTotal > 0 ? [{
        name: 'Other / Split',
        value: Math.round(splitTotal * 100) / 100,
        percentage: totalCollected > 0 ? Math.round((splitTotal / totalCollected) * 1000) / 10 : 0,
        color: '#8b5cf6' // Purple
      }] : [])
    ];
  }

  /**
   * Area Chart: Expiry Risk Trend over Next 6 Months
   * Projects value of batches reaching expiry month by month
   */
  public static getExpiryRiskOverTime(months = 6, branchId: string = 'all') {
    const rawBatches = this.getBatches();
    const batches = branchId === 'all' ? rawBatches : rawBatches.filter(b => this.matchesBranch(b.branchId, branchId));
    const now = new Date();
    const result = [];
    let runningCumulative = 0;

    for (let m = 0; m < months; m++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() + m, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + m + 1, 0);

      const startStr = monthStart.toISOString().split('T')[0];
      const endStr = monthEnd.toISOString().split('T')[0];
      const monthName = monthStart.toLocaleDateString([], { month: 'short', year: '2-digit' });

      let batchCount = 0;
      let unitsAtRisk = 0;
      let costAtRisk = 0;
      let retailValueAtRisk = 0;

      batches.forEach(b => {
        if (b.currentStock <= 0) return;
        if (b.expiryDate >= startStr && b.expiryDate <= endStr) {
          batchCount++;
          const stock = Number(b.currentStock) || 0;
          unitsAtRisk += stock;
          costAtRisk += stock * (Number(b.purchasePrice) || 0);
          retailValueAtRisk += stock * (Number(b.sellingPrice) || 0);
        }
      });

      runningCumulative += retailValueAtRisk;

      result.push({
        month: monthName,
        monthIndex: m + 1,
        batchCount,
        unitsAtRisk,
        costAtRisk: Math.round(costAtRisk * 100) / 100,
        valueAtRisk: Math.round(retailValueAtRisk * 100) / 100,
        cumulativeRisk: Math.round(runningCumulative * 100) / 100
      });
    }

    return result;
  }

  /**
   * Table 1: Top 5 Medicines about to expire soon
   * Color-coded:
   * - Red: Expired (daysLeft <= 0)
   * - Orange: < 30 days
   * - Yellow: < 60 days
   */
  public static getTopNearExpiryBatches(limit = 5, branchId: string = 'all') {
    const rawBatches = this.getBatches();
    const batches = branchId === 'all' ? rawBatches : rawBatches.filter(b => this.matchesBranch(b.branchId, branchId));
    const medicines = this.getMedicines();
    const nowTime = new Date().getTime();

    const candidateBatches = batches
      .filter(b => b.currentStock > 0)
      .map(b => {
        const expTime = new Date(b.expiryDate).getTime();
        const diffDays = Math.ceil((expTime - nowTime) / (1000 * 60 * 60 * 24));
        const med = medicines.find(m => m.id === b.medicineId);

        let riskLevel: 'expired' | 'critical' | 'warning' | 'watch' = 'watch';
        if (diffDays <= 0 || b.status === 'expired') {
          riskLevel = 'expired'; // RED
        } else if (diffDays <= 30) {
          riskLevel = 'critical'; // ORANGE (<30 days)
        } else if (diffDays <= 60) {
          riskLevel = 'warning'; // YELLOW (<60 days)
        } else {
          riskLevel = 'watch';
        }

        const stock = Number(b.currentStock) || 0;
        const sellPrice = Number(b.sellingPrice) || 0;

        return {
          id: b.id,
          medicineId: b.medicineId,
          medicineName: b.medicineName,
          genericName: med?.genericName || '',
          category: med?.category || 'General',
          batchNumber: b.batchNumber,
          expiryDate: b.expiryDate,
          daysLeft: diffDays,
          currentStock: stock,
          unitPrice: sellPrice,
          purchasePrice: Number(b.purchasePrice) || 0,
          totalValueAtRisk: Math.round(stock * sellPrice * 100) / 100,
          rackLocation: b.rackLocation || med?.rackLocation || 'Rack A-01',
          supplierName: b.supplierName || 'Primary Distributor',
          riskLevel
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, limit);

    return candidateBatches;
  }

  /**
   * Table 2: Low Stock Alert Table with instant "Add to Reorder List"
   */
  public static getLowStockAlertMedicines(branchId: string = 'all') {
    const medicines = this.getMedicines();
    const rawBatches = this.getBatches();
    const batches = branchId === 'all' ? rawBatches : rawBatches.filter(b => this.matchesBranch(b.branchId, branchId));
    const suppliers = this.getSuppliers();
    const reorderList = this.getReorderList();

    const lowStockItems = [];

    for (const med of medicines) {
      const medBatches = batches.filter(b => b.medicineId === med.id && b.status !== 'expired');
      const totalStock = medBatches.reduce((acc, b) => acc + (Number(b.currentStock) || 0), 0);

      if (totalStock <= med.reorderLevel) {
        const deficit = Math.max(0, med.reorderLevel - totalStock);
        const suggestedOrderQty = Math.max(deficit + med.reorderLevel, 25);
        
        // Find preferred supplier from batches or default
        const sampleBatch = batches.find(b => b.medicineId === med.id);
        const supplier = suppliers.find(s => s.id === sampleBatch?.supplierId) || suppliers[0];

        const isReordered = reorderList.some(r => r.medicineId === med.id);

        lowStockItems.push({
          medicineId: med.id,
          medicineName: med.name,
          genericName: med.genericName,
          category: med.category,
          dosageForm: med.dosageForm,
          currentStock: totalStock,
          reorderLevel: med.reorderLevel,
          deficit,
          suggestedOrderQty,
          unitOfMeasure: med.unitOfMeasure,
          rackLocation: med.rackLocation,
          supplierId: supplier?.id || 'sup-01',
          supplierName: supplier?.name || 'Apex Pharma Ltd',
          isReordered
        });
      }
    }

    return lowStockItems.sort((a, b) => (b.deficit - a.deficit));
  }

  /**
   * =========================================================================
   * AUTOMATED PURCHASE ORDER SUGGESTER ENGINE
   * =========================================================================
   * Mathematically evaluates inventory against reorder thresholds, dynamic 30-day
   * sales velocity (ADC), and supplier delivery lead times to compute optimal pack
   * order sizes per supplier, eliminating stockouts and dead-stock over-ordering.
   */
  public static getPurchaseOrderSuggestions(options?: {
    targetBufferDays?: number;
    leadTimeDays?: number;
    supplierId?: string;
    urgencyFilter?: 'all' | 'out_of_stock' | 'critical' | 'reorder_point';
    searchQuery?: string;
    includeAllMedicines?: boolean;
  }): {
    groups: SupplierPurchaseSuggestionGroup[];
    summary: {
      totalSKUsNeedingReorder: number;
      outOfStockCount: number;
      criticalCount: number;
      reorderPointCount: number;
      totalSuggestedPacks: number;
      totalSuggestedQuantity: number;
      totalEstimatedSubtotal: number;
      totalEstimatedTax: number;
      totalEstimatedAmount: number;
    };
  } {
    const medicines = this.getMedicines();
    const batches = this.getBatches();
    const suppliers = this.getSuppliers();
    const sales = this.getSales();
    const purchases = this.getPurchases();

    const targetBuffer = options?.targetBufferDays || 30;
    const defaultLeadTime = options?.leadTimeDays || 5;

    // 1. Calculate 30-day sales velocity per medicine
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoIso = thirtyDaysAgo.toISOString().split('T')[0];

    const salesVelocityMap = new Map<string, number>();
    for (const sale of sales) {
      if (sale.date >= thirtyDaysAgoIso && Array.isArray(sale.items)) {
        for (const item of sale.items) {
          salesVelocityMap.set(item.medicineId, (salesVelocityMap.get(item.medicineId) || 0) + (item.quantity || 0));
        }
      }
    }

    // 2. Map batches by medicine for active stock and supplier linkage
    const activeBatchesByMed = new Map<string, Batch[]>();
    for (const b of batches) {
      if (b.status !== 'expired') {
        const list = activeBatchesByMed.get(b.medicineId) || [];
        list.push(b);
        activeBatchesByMed.set(b.medicineId, list);
      }
    }

    // 3. Process each medicine and construct suggestions
    const suggestionItems: PurchaseOrderSuggestionItem[] = [];

    for (const med of medicines) {
      const medBatches = activeBatchesByMed.get(med.id) || [];
      const currentStock = medBatches.reduce((sum, b) => sum + (b.currentStock || 0), 0);
      const reorderLevel = med.reorderLevel || 10;
      const deficit = Math.max(0, reorderLevel - currentStock);

      const salesLast30 = salesVelocityMap.get(med.id) || 0;
      // If sales exist, use actual rate; otherwise estimate minimum turnover rate
      const avgDailyConsumption = salesLast30 > 0
        ? Math.max(0.1, Number((salesLast30 / 30).toFixed(2)))
        : Math.max(0.2, Number((reorderLevel / 15).toFixed(2)));

      const daysOfStockRemaining = currentStock <= 0 
        ? 0 
        : Math.round(currentStock / avgDailyConsumption);

      // Determine stockout risk category
      let riskLevel: StockoutRiskLevel = 'adequate';
      if (currentStock <= 0) {
        riskLevel = 'out_of_stock';
      } else if (currentStock <= Math.ceil(reorderLevel * 0.5) || daysOfStockRemaining <= 5) {
        riskLevel = 'critical';
      } else if (currentStock <= reorderLevel || daysOfStockRemaining <= 14) {
        riskLevel = 'reorder_point';
      } else if (currentStock <= Math.ceil(reorderLevel * 1.3)) {
        riskLevel = 'low_risk';
      }

      // Check if medicine qualifies for reorder
      const qualifies = Boolean(options?.includeAllMedicines) || (currentStock <= reorderLevel) || (riskLevel !== 'adequate');
      if (!qualifies) continue;

      // Apply urgency filter if specified
      if (options?.urgencyFilter && options.urgencyFilter !== 'all') {
        if (riskLevel !== options.urgencyFilter) continue;
      }

      // Apply search query filter if specified
      if (options?.searchQuery && options.searchQuery.trim()) {
        const q = options.searchQuery.toLowerCase().trim();
        const matchName = med.name.toLowerCase().includes(q);
        const matchGeneric = (med.genericName || '').toLowerCase().includes(q);
        const matchBrand = (med.brandName || '').toLowerCase().includes(q);
        if (!matchName && !matchGeneric && !matchBrand) continue;
      }

      // Resolve Preferred Supplier
      let resolvedSupplier: Supplier | undefined;
      // Try from recent batch
      if (medBatches.length > 0) {
        const latestBatch = medBatches[medBatches.length - 1];
        if (latestBatch.supplierId) {
          resolvedSupplier = suppliers.find(s => s.id === latestBatch.supplierId);
        }
      }
      // Try from purchase history
      if (!resolvedSupplier) {
        for (const po of purchases) {
          const matchedItem = po.items?.find(it => it.medicineId === med.id);
          if (matchedItem) {
            resolvedSupplier = suppliers.find(s => s.id === po.supplierId);
            if (resolvedSupplier) break;
          }
        }
      }
      // Match by manufacturer name keyword
      if (!resolvedSupplier && med.manufacturer) {
        const manufacturerName = typeof med.manufacturer === 'string' ? med.manufacturer : (med.manufacturer as any)?.name;
        const mfgLower = (manufacturerName || '').toLowerCase();
        resolvedSupplier = suppliers.find(s => {
          const sName = (s.name || '').toLowerCase();
          const sComp = (s.companyName || '').toLowerCase();
          return (sName && sName.includes(mfgLower)) ||
                 (sComp && sComp.includes(mfgLower)) ||
                 (sName && mfgLower.includes(sName.split(' ')[0]));
        });
      }
      // Fallback supplier
      if (!resolvedSupplier) {
        resolvedSupplier = suppliers[0] || {
          id: 'sup-01',
          name: 'Apex Pharmaceutical Distributors',
          companyName: 'Apex Pharma Ltd',
          phone: '+1 (555) 234-5678',
          email: 'orders@apexpharma.com',
          address: '458 Logistic Way, Suite 300, Metro City',
          drugLicenseNumber: 'DL-2023-99812A',
          taxId: 'US-TAX-882910',
          paymentTermsDays: 30,
          balancePayable: 0
        };
      }

      // Apply supplier filter if specified
      if (options?.supplierId && options.supplierId !== 'all') {
        if (resolvedSupplier.id !== options.supplierId) continue;
      }

      // Calculate replenishment quantities
      const leadTime = resolvedSupplier.paymentTermsDays 
        ? Math.min(10, Math.max(3, Math.round(resolvedSupplier.paymentTermsDays / 6))) 
        : defaultLeadTime;

      // Demand during lead time + Safety buffer + Cycle replenishment
      const leadTimeDemand = avgDailyConsumption * leadTime;
      const bufferDemand = avgDailyConsumption * targetBuffer;
      const safetyBuffer = avgDailyConsumption * (leadTime * 0.6);
      
      const targetOptimalStock = Math.ceil(reorderLevel + bufferDemand + safetyBuffer);
      const grossDeficit = Math.max(0, targetOptimalStock - currentStock);
      
      // Pack normalization
      const packSize = med.packSize && med.packSize > 0 ? med.packSize : 1;
      const rawNeededQuantity = Math.max(grossDeficit, deficit + Math.ceil(reorderLevel * 0.4), packSize);
      const suggestedPacks = Math.max(1, Math.ceil(rawNeededQuantity / packSize));
      const suggestedQuantity = suggestedPacks * packSize;

      // Pricing & Costing
      let unitPurchasePrice = 10;
      let mrp = 15;
      let sellingPrice = 14;

      if (medBatches.length > 0) {
        const b = medBatches[medBatches.length - 1];
        unitPurchasePrice = b.purchasePrice || 10;
        mrp = b.mrp || (unitPurchasePrice * 1.35);
        sellingPrice = b.sellingPrice || mrp;
      } else {
        // Look in PO items
        let foundInPo = false;
        for (const po of purchases) {
          const item = po.items?.find(it => it.medicineId === med.id);
          if (item) {
            unitPurchasePrice = item.purchasePrice;
            mrp = item.mrp;
            sellingPrice = item.sellingPrice;
            foundInPo = true;
            break;
          }
        }
        if (!foundInPo) {
          unitPurchasePrice = 100;
          mrp = 130;
          sellingPrice = 125;
        }
      }

      const taxRate = med.taxRate || 5;
      const estimatedSubtotal = Number((suggestedQuantity * unitPurchasePrice).toFixed(2));
      const estimatedTax = Number((estimatedSubtotal * (taxRate / 100)).toFixed(2));
      const estimatedTotal = Number((estimatedSubtotal + estimatedTax).toFixed(2));

      suggestionItems.push({
        medicineId: med.id,
        medicineName: med.name,
        genericName: med.genericName || '',
        brandName: med.brandName,
        category: med.category,
        dosageForm: med.dosageForm,
        strength: med.strength,
        unitOfMeasure: med.unitOfMeasure,
        packSize,
        rackLocation: med.rackLocation || 'Bay A',
        currentStock,
        reorderLevel,
        deficit,
        salesLast30Days: salesLast30,
        avgDailyConsumption,
        daysOfStockRemaining,
        riskLevel,
        targetBufferDays: targetBuffer,
        leadTimeDays: leadTime,
        rawNeededQuantity,
        suggestedPacks,
        suggestedQuantity,
        adjustedPacks: suggestedPacks,
        adjustedQuantity: suggestedQuantity,
        unitPurchasePrice,
        mrp,
        sellingPrice,
        taxRate,
        estimatedSubtotal,
        estimatedTax,
        estimatedTotal,
        supplierId: resolvedSupplier.id,
        supplierName: resolvedSupplier.name || resolvedSupplier.companyName,
        isSelected: true
      });
    }

    // 4. Group suggestions by Supplier
    const groupedMap = new Map<string, PurchaseOrderSuggestionItem[]>();
    for (const item of suggestionItems) {
      const list = groupedMap.get(item.supplierId) || [];
      list.push(item);
      groupedMap.set(item.supplierId, list);
    }

    const groups: SupplierPurchaseSuggestionGroup[] = [];

    // Sort items inside each group by urgency: out_of_stock -> critical -> reorder_point -> low_risk
    const urgencyOrder: Record<StockoutRiskLevel, number> = {
      out_of_stock: 0,
      critical: 1,
      reorder_point: 2,
      low_risk: 3,
      adequate: 4
    };

    let totalSKUsNeedingReorder = 0;
    let outOfStockCount = 0;
    let criticalCount = 0;
    let reorderPointCount = 0;
    let totalSuggestedPacks = 0;
    let totalSuggestedQuantity = 0;
    let totalEstimatedSubtotal = 0;
    let totalEstimatedTax = 0;
    let totalEstimatedAmount = 0;

    groupedMap.forEach((items, supId) => {
      const supplier = suppliers.find(s => s.id === supId) || {
        id: supId,
        name: items[0]?.supplierName || 'Primary Supplier',
        companyName: items[0]?.supplierName || 'Primary Supplier',
        phone: '+1 (555) 000-0000',
        email: 'orders@supplier.com',
        address: 'Wholesale Depot',
        drugLicenseNumber: 'DL-STANDARD',
        taxId: 'TAX-STD',
        paymentTermsDays: 30,
        balancePayable: 0
      };

      // Sort items by urgency & deficit
      items.sort((a, b) => {
        const diff = urgencyOrder[a.riskLevel] - urgencyOrder[b.riskLevel];
        if (diff !== 0) return diff;
        return b.deficit - a.deficit;
      });

      const oos = items.filter(it => it.riskLevel === 'out_of_stock').length;
      const crit = items.filter(it => it.riskLevel === 'critical').length;
      const reorder = items.filter(it => it.riskLevel === 'reorder_point').length;
      const grpPacks = items.reduce((sum, it) => sum + it.suggestedPacks, 0);
      const grpQty = items.reduce((sum, it) => sum + it.suggestedQuantity, 0);
      const grpSub = items.reduce((sum, it) => sum + it.estimatedSubtotal, 0);
      const grpTax = items.reduce((sum, it) => sum + it.estimatedTax, 0);
      const grpTotal = Number((grpSub + grpTax).toFixed(2));

      // Benchmark minimum order value target for supplier (e.g. ৳5,000 / $2,500)
      const minOrderValueTarget = 3000;
      const meetsMinOrderValue = grpTotal >= minOrderValueTarget;

      groups.push({
        supplier,
        items,
        totalItemsCount: items.length,
        selectedItemsCount: items.filter(it => it.isSelected).length,
        outOfStockCount: oos,
        criticalCount: crit,
        totalSuggestedPacks: grpPacks,
        totalSuggestedQuantity: grpQty,
        totalEstimatedSubtotal: grpSub,
        totalEstimatedTax: grpTax,
        totalEstimatedAmount: grpTotal,
        leadTimeDays: items[0]?.leadTimeDays || defaultLeadTime,
        paymentTerms: `Net ${supplier.paymentTermsDays || 30} Days`,
        balancePayable: supplier.balancePayable || 0,
        minOrderValueTarget,
        meetsMinOrderValue
      });

      totalSKUsNeedingReorder += items.length;
      outOfStockCount += oos;
      criticalCount += crit;
      reorderPointCount += reorder;
      totalSuggestedPacks += grpPacks;
      totalSuggestedQuantity += grpQty;
      totalEstimatedSubtotal += grpSub;
      totalEstimatedTax += grpTax;
      totalEstimatedAmount += grpTotal;
    });

    // Sort groups so suppliers with out-of-stock items appear first
    groups.sort((a, b) => {
      if (b.outOfStockCount !== a.outOfStockCount) {
        return b.outOfStockCount - a.outOfStockCount;
      }
      if (b.criticalCount !== a.criticalCount) {
        return b.criticalCount - a.criticalCount;
      }
      return b.totalEstimatedAmount - a.totalEstimatedAmount;
    });

    return {
      groups,
      summary: {
        totalSKUsNeedingReorder,
        outOfStockCount,
        criticalCount,
        reorderPointCount,
        totalSuggestedPacks,
        totalSuggestedQuantity,
        totalEstimatedSubtotal: Number(totalEstimatedSubtotal.toFixed(2)),
        totalEstimatedTax: Number(totalEstimatedTax.toFixed(2)),
        totalEstimatedAmount: Number(totalEstimatedAmount.toFixed(2))
      }
    };
  }

  /**
   * Generates an official Purchase Order directly from selected suggestion items.
   */
  public static generatePurchaseOrderFromSuggestions(params: {
    supplierId: string;
    items: Array<{
      medicineId: string;
      medicineName: string;
      dosageForm: any;
      orderedQuantity: number; // in packs
      packSize: number;
      unitPurchasePrice: number;
      taxRate: number;
      mrp?: number;
      sellingPrice?: number;
    }>;
    expectedDeliveryDate?: string;
    paymentTerms?: string;
    notes?: string;
  }): PurchaseOrder {
    const suppliers = this.getSuppliers();
    const supplier = suppliers.find(s => s.id === params.supplierId);
    if (!supplier) throw new Error(`Supplier with ID ${params.supplierId} not found.`);

    const today = new Date();
    const leadDays = supplier.paymentTermsDays 
      ? Math.min(10, Math.max(3, Math.round(supplier.paymentTermsDays / 6))) 
      : 5;
    
    const deliveryDate = params.expectedDeliveryDate || (() => {
      const d = new Date();
      d.setDate(d.getDate() + leadDays);
      return d.toISOString().split('T')[0];
    })();

    const purchaseItems: PurchaseItem[] = params.items.map((it, idx) => {
      const packMult = it.packSize > 1 ? it.packSize : 1;
      const orderPacks = Math.max(1, it.orderedQuantity);
      const totalUnits = orderPacks * packMult;
      const purchasePrice = it.unitPurchasePrice;
      const lineSubtotal = purchasePrice * totalUnits;
      const taxRate = it.taxRate || 5;
      const taxAmount = Number((lineSubtotal * (taxRate / 100)).toFixed(2));
      const totalAmount = Number((lineSubtotal + taxAmount).toFixed(2));

      return {
        id: `pi-sug-${Date.now()}-${idx}`,
        medicineId: it.medicineId,
        medicineName: it.medicineName,
        dosageForm: it.dosageForm,
        quantity: totalUnits,
        orderedQuantity: orderPacks,
        packSize: packMult,
        purchasePrice,
        mrp: it.mrp || purchasePrice * 1.3,
        sellingPrice: it.sellingPrice || it.mrp || purchasePrice * 1.25,
        discountPercent: 0,
        taxRate,
        taxAmount,
        totalAmount
      };
    });

    const newPO = this.createPurchaseOrder({
      supplierId: params.supplierId,
      paymentTerms: params.paymentTerms || `Net ${supplier.paymentTermsDays || 30} Days`,
      expectedDeliveryDate: deliveryDate,
      notes: params.notes || `Automated requisition generated by PO Suggester engine based on reorder thresholds and 30-day consumption velocity.`,
      items: purchaseItems
    });

    // Remove any corresponding items from the manual reorder queue
    const currentReorderList = this.getReorderList();
    const generatedMedIds = new Set(params.items.map(i => i.medicineId));
    const updatedReorderList = currentReorderList.filter(r => !generatedMedIds.has(r.medicineId));
    this.saveReorderList(updatedReorderList);

    return newPO;
  }

  /**
   * Bulk generates Purchase Orders across all suppliers that have selected items.
   */
  public static generateBulkPurchaseOrders(supplierOrders: Array<{
    supplierId: string;
    items: Array<{
      medicineId: string;
      medicineName: string;
      dosageForm: any;
      orderedQuantity: number;
      packSize: number;
      unitPurchasePrice: number;
      taxRate: number;
      mrp?: number;
      sellingPrice?: number;
    }>;
    notes?: string;
  }>): PurchaseOrder[] {
    const createdPOs: PurchaseOrder[] = [];

    for (const order of supplierOrders) {
      if (!order.items || order.items.length === 0) continue;
      const po = this.generatePurchaseOrderFromSuggestions({
        supplierId: order.supplierId,
        items: order.items,
        notes: order.notes
      });
      createdPOs.push(po);
    }

    return createdPOs;
  }
}
