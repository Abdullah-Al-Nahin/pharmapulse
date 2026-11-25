import { cashbookApi } from '../lib/api';
import { AuditService } from './auditService';
import { CustomerService } from './customerService';
import { PharmacyService } from './pharmacyService';
import {
  CashbookDailyClosingRecord,
  CashbookVoucherRecord,
  CashbookVoucherType,
  createEmptyDenominations,
  round2,
} from '../utils/cashbookMath';

const STORAGE_KEYS = {
  VOUCHERS: 'rx_cashbook_vouchers_v1',
  DAILY_CLOSINGS: 'rx_cashbook_daily_closings_v1',
  LAST_BACKUP_META: 'rx_last_backup_meta_v1',
};

export interface BackupMeta {
  lastBackupAt: string;
  lastBackupBy: string;
  totalKeys: number;
  totalRecords: number;
}

type CashbookListener = () => void;

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    }
  } catch {
    // ignore storage errors
  }
  return fallback;
}

function writeJsonStorage(key: string, data: unknown): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch {
    // ignore storage errors
  }
}

export class CashbookService {
  private static cache: {
    vouchers: CashbookVoucherRecord[];
    dailyClosings: CashbookDailyClosingRecord[];
  } = {
    vouchers: readJsonStorage<CashbookVoucherRecord[]>(STORAGE_KEYS.VOUCHERS, []),
    dailyClosings: readJsonStorage<CashbookDailyClosingRecord[]>(
      STORAGE_KEYS.DAILY_CLOSINGS,
      []
    ),
  };

  private static listeners: CashbookListener[] = [];
  private static isEmitting = false;
  private static isInitialized = false;
  private static isSyncing = false;

  public static subscribe(listener: CashbookListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private static emitChange(): void {
    if (this.isEmitting) return;
    this.isEmitting = true;
    queueMicrotask(() => {
      this.isEmitting = false;
      const snapshot = [...this.listeners];
      snapshot.forEach((fn) => {
        try {
          fn();
        } catch (err) {
          console.error('CashbookService listener error:', err);
        }
      });
    });
  }

  public static async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
    await this.syncFromDB();
  }

  public static async syncFromDB(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      const [remoteVouchers, remoteClosings] = await Promise.all([
        cashbookApi.getVouchers().catch(() => null),
        cashbookApi.getDailyClosings().catch(() => null),
      ]);

      let changed = false;

      if (Array.isArray(remoteVouchers)) {
        const mappedVouchers: CashbookVoucherRecord[] = remoteVouchers.map((v: any) => ({
          id: v.id,
          voucherNo: v.voucherNo,
          voucherDate: v.voucherDate,
          voucherType: v.voucherType as CashbookVoucherType,
          direction: (v.direction === 'IN' ? 'IN' : 'OUT') as 'IN' | 'OUT',
          category: v.category || 'General',
          amount: Number(v.amount || 0),
          partyName: v.partyName || 'Counter Cash',
          partyId: v.partyId || undefined,
          referenceNo: v.referenceNo || undefined,
          paymentMethod: v.paymentMethod || 'CASH',
          description: v.description || '',
          branchId: v.branchId || 'HQ-MAIN',
          branchName: v.branchName || 'Main Branch',
          createdBy: v.createdBy || 'Cashier',
          createdAt: v.createdAt || new Date().toISOString(),
        }));

        // Preserve any unsynced local vouchers created offline while keeping DB source of truth
        const remoteIds = new Set(mappedVouchers.map((r) => r.voucherNo));
        const localOnly = this.cache.vouchers.filter((l) => !remoteIds.has(l.voucherNo));
        const merged = [...mappedVouchers, ...localOnly];
        if (JSON.stringify(merged) !== JSON.stringify(this.cache.vouchers)) {
          this.cache.vouchers = merged;
          writeJsonStorage(STORAGE_KEYS.VOUCHERS, merged);
          changed = true;
        }
      }

      if (Array.isArray(remoteClosings)) {
        const mappedClosings: CashbookDailyClosingRecord[] = remoteClosings.map((c: any) => ({
          id: c.id,
          cashbookDate: c.cashbookDate,
          branchId: c.branchId || 'HQ-MAIN',
          branchName: c.branchName || 'Main Branch',
          openingCash: Number(c.openingCash ?? 15000),
          posCashSales: Number(c.posCashSales || 0),
          dueAndMiscCashIn: Number(c.dueAndMiscCashIn || 0),
          dailyShopExpense: Number(c.dailyShopExpense || 0),
          supplierCashPaid: Number(c.supplierCashPaid || 0),
          expectedClosingCash: Number(c.expectedClosingCash || 0),
          countedPhysicalCash: Number(c.countedPhysicalCash || 0),
          variance: Number(c.variance || 0),
          vaultTransfer: Number(c.vaultTransfer || 0),
          carryForwardFloat: Number(c.carryForwardFloat || 0),
          denominations: c.denominations || createEmptyDenominations(),
          status: (c.status || 'OPEN') as CashbookDailyClosingRecord['status'],
          closedBy: c.closedBy || undefined,
          notes: c.notes || undefined,
          closedAt: c.closedAt || undefined,
          updatedAt: c.updatedAt || undefined,
        }));

        const keySet = new Set(
          mappedClosings.map((c) => `${c.cashbookDate}__${c.branchId}`)
        );
        const localOnly = this.cache.dailyClosings.filter(
          (l) => !keySet.has(`${l.cashbookDate}__${l.branchId}`)
        );
        const merged = [...mappedClosings, ...localOnly];
        if (JSON.stringify(merged) !== JSON.stringify(this.cache.dailyClosings)) {
          this.cache.dailyClosings = merged;
          writeJsonStorage(STORAGE_KEYS.DAILY_CLOSINGS, merged);
          changed = true;
        }
      }

      if (changed) {
        this.emitChange();
      }
    } finally {
      this.isSyncing = false;
    }
  }

  public static getVouchers(): CashbookVoucherRecord[] {
    return this.cache.vouchers;
  }

  public static getDailyClosings(): CashbookDailyClosingRecord[] {
    return this.cache.dailyClosings;
  }

  public static getClosingRecord(
    cashbookDate: string,
    branchId: string
  ): CashbookDailyClosingRecord | undefined {
    const resolvedBranch = branchId === 'all' ? 'HQ-MAIN' : branchId;
    return this.cache.dailyClosings.find(
      (c) => c.cashbookDate === cashbookDate && c.branchId === resolvedBranch
    );
  }

  public static getOpeningCash(cashbookDate: string, branchId: string): number {
    const resolvedBranch = branchId === 'all' ? 'HQ-MAIN' : branchId;

    if (branchId === 'all') {
      const sameDayAll = this.cache.dailyClosings.filter(
        (c) => c.cashbookDate === cashbookDate
      );
      if (sameDayAll.length > 0) {
        return round2(sameDayAll.reduce((s, c) => s + Number(c.openingCash || 0), 0));
      }
    }

    const exact = this.cache.dailyClosings.find(
      (c) => c.cashbookDate === cashbookDate && c.branchId === resolvedBranch
    );
    if (exact && exact.openingCash !== undefined) {
      return round2(exact.openingCash);
    }

    // Carry forward from most recent prior closing for this branch
    const prior = this.cache.dailyClosings
      .filter((c) => c.branchId === resolvedBranch && c.cashbookDate < cashbookDate)
      .sort((a, b) => b.cashbookDate.localeCompare(a.cashbookDate))[0];

    if (prior) {
      if (prior.status !== 'OPEN') {
        const carry =
          prior.carryForwardFloat > 0 || prior.vaultTransfer > 0
            ? prior.carryForwardFloat
            : prior.countedPhysicalCash > 0
            ? prior.countedPhysicalCash
            : prior.expectedClosingCash;
        return round2(carry);
      }
      return round2(prior.openingCash);
    }

    return 15000.0;
  }

  public static async setOpeningCash(params: {
    cashbookDate: string;
    branchId: string;
    branchName: string;
    openingCash: number;
    updatedBy?: string;
  }): Promise<void> {
    const resolvedBranch = params.branchId === 'all' ? 'HQ-MAIN' : params.branchId;
    const val = round2(Math.max(0, Number(params.openingCash || 0)));

    const list = [...this.cache.dailyClosings];
    const idx = list.findIndex(
      (c) => c.cashbookDate === params.cashbookDate && c.branchId === resolvedBranch
    );

    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        openingCash: val,
        branchName: params.branchName || list[idx].branchName,
        updatedAt: new Date().toISOString(),
      };
    } else {
      list.unshift({
        id: `cls-${params.cashbookDate}-${resolvedBranch}`,
        cashbookDate: params.cashbookDate,
        branchId: resolvedBranch,
        branchName: params.branchName || 'Main Branch',
        openingCash: val,
        posCashSales: 0,
        dueAndMiscCashIn: 0,
        dailyShopExpense: 0,
        supplierCashPaid: 0,
        expectedClosingCash: val,
        countedPhysicalCash: 0,
        variance: 0,
        vaultTransfer: 0,
        carryForwardFloat: val,
        denominations: createEmptyDenominations(),
        status: 'OPEN',
        updatedAt: new Date().toISOString(),
      });
    }

    this.cache.dailyClosings = list;
    writeJsonStorage(STORAGE_KEYS.DAILY_CLOSINGS, list);
    this.emitChange();

    AuditService.recordAuditLog({
      userId: 'current-user',
      userName: params.updatedBy || 'Pharmacist',
      userRole: 'Pharmacist',
      action: 'UPDATE',
      module: 'pos',
      targetEntityId: `${params.cashbookDate}-${resolvedBranch}`,
      targetEntityType: 'OpeningDrawerCash',
      summary: `Set Opening Drawer Cash for ${params.cashbookDate} (${params.branchName}) to ৳${val.toFixed(2)}`,
      beforeState: null,
      afterState: { cashbookDate: params.cashbookDate, branchId: resolvedBranch, openingCash: val },
    });

    await cashbookApi
      .saveOpeningCash({
        cashbookDate: params.cashbookDate,
        branchId: resolvedBranch,
        branchName: params.branchName,
        openingCash: val,
      })
      .catch((e) => console.error('Failed to sync opening cash to backend:', e));
  }

  public static async addVoucher(input: {
    voucherDate: string;
    voucherType: CashbookVoucherType;
    category: string;
    amount: number;
    partyName: string;
    partyId?: string;
    referenceNo?: string;
    description: string;
    branchId: string;
    branchName: string;
    createdBy: string;
  }): Promise<CashbookVoucherRecord> {
    const amount = round2(Math.max(0, Number(input.amount || 0)));
    if (amount <= 0) {
      throw new Error('Voucher amount must be greater than zero.');
    }

    const prefix =
      input.voucherType === 'SHOP_EXPENSE'
        ? 'EXP'
        : input.voucherType === 'SUPPLIER_CASH_PAID'
        ? 'SUP'
        : input.voucherType === 'DUE_COLLECTION'
        ? 'DUE'
        : 'CIN';

    const dateTag = input.voucherDate.replace(/-/g, '').slice(2);
    const suffix = String(Math.floor(100 + Math.random() * 900));
    const voucherNo = `${prefix}-${dateTag}-${suffix}`;
    const direction: 'IN' | 'OUT' =
      input.voucherType === 'DUE_COLLECTION' || input.voucherType === 'MISC_CASH_IN'
        ? 'IN'
        : 'OUT';
    const resolvedBranch = input.branchId === 'all' ? 'HQ-MAIN' : input.branchId;

    const record: CashbookVoucherRecord = {
      id: `cbv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      voucherNo,
      voucherDate: input.voucherDate,
      voucherType: input.voucherType,
      direction,
      category: input.category.trim() || prefix,
      amount,
      partyName: input.partyName.trim() || 'Counter Cash',
      partyId: input.partyId || undefined,
      referenceNo: input.referenceNo?.trim() || undefined,
      paymentMethod: 'CASH',
      description: input.description.trim() || input.category,
      branchId: resolvedBranch,
      branchName: input.branchName || 'Main Branch',
      createdBy: input.createdBy || 'Cashier',
      createdAt: new Date().toISOString(),
    };

    const nextVouchers = [record, ...this.cache.vouchers];
    this.cache.vouchers = nextVouchers;
    writeJsonStorage(STORAGE_KEYS.VOUCHERS, nextVouchers);
    this.emitChange();

    // Cross-module integrations
    if (input.voucherType === 'SHOP_EXPENSE') {
      PharmacyService.addAccountingTransaction({
        id: `tx-cb-exp-${Date.now()}`,
        date: input.voucherDate,
        type: 'operational_expense',
        referenceId: voucherNo,
        description: `${input.category}: ${record.description} (Paid to ${record.partyName})`,
        debit: amount,
        credit: 0,
        account: 'Cash',
        branchId: resolvedBranch,
        branchName: record.branchName,
      });
    } else if (input.voucherType === 'MISC_CASH_IN') {
      PharmacyService.addAccountingTransaction({
        id: `tx-cb-in-${Date.now()}`,
        date: input.voucherDate,
        type: 'sale_revenue',
        referenceId: voucherNo,
        description: `${input.category}: ${record.description} (From ${record.partyName})`,
        debit: 0,
        credit: amount,
        account: 'Cash',
        branchId: resolvedBranch,
        branchName: record.branchName,
      });
    } else if (input.voucherType === 'SUPPLIER_CASH_PAID') {
      if (input.partyId) {
        const sup = PharmacyService.getSuppliers().find((s) => s.id === input.partyId);
        if (sup) {
          PharmacyService.recordSupplierPayment(
            sup.id,
            amount,
            'Cash Drawer',
            voucherNo,
            record.description
          );
        } else {
          PharmacyService.addAccountingTransaction({
            id: `tx-cb-sup-${Date.now()}`,
            date: input.voucherDate,
            type: 'supplier_payment',
            referenceId: voucherNo,
            description: `Supplier cash payment to ${record.partyName}`,
            debit: amount,
            credit: 0,
            account: 'Cash',
            branchId: resolvedBranch,
            branchName: record.branchName,
          });
        }
      } else {
        PharmacyService.addAccountingTransaction({
          id: `tx-cb-sup-${Date.now()}`,
          date: input.voucherDate,
          type: 'supplier_payment',
          referenceId: voucherNo,
          description: `Supplier cash payment to ${record.partyName}`,
          debit: amount,
          credit: 0,
          account: 'Cash',
          branchId: resolvedBranch,
          branchName: record.branchName,
        });
      }
    } else if (input.voucherType === 'DUE_COLLECTION') {
      let settledViaInvoice = false;
      if (input.referenceNo) {
        const sale = PharmacyService.getSales().find(
          (s) =>
            (s.invoiceNumber === input.referenceNo || s.id === input.referenceNo) &&
            Number(s.dueAmount || 0) > 0
        );
        if (sale) {
          settledViaInvoice = true;
          await PharmacyService.collectInvoiceDue({
            saleId: sale.id,
            amountPaid: amount,
            method: 'cash',
            trxRef: voucherNo,
            collectedBy: input.createdBy,
          });
        }
      }
      if (input.partyId) {
        const cust = CustomerService.getCustomerById(input.partyId);
        if (cust && cust.outstandingBalance > 0) {
          try {
            CustomerService.collectDuePayment({
              customerId: cust.id,
              amountPaid: Math.min(amount, cust.outstandingBalance),
              paymentMethod: 'cash',
              transactionReference: voucherNo,
              referenceNotes: record.description,
              collectedBy: input.createdBy,
            });
            settledViaInvoice = true;
          } catch {
            // fallback below if customer has no outstanding balance
          }
        }
      }
      if (!settledViaInvoice) {
        PharmacyService.addAccountingTransaction({
          id: `tx-cb-due-${Date.now()}`,
          date: input.voucherDate,
          type: 'sale_revenue',
          referenceId: voucherNo,
          description: `Customer due cash collection from ${record.partyName}`,
          debit: 0,
          credit: amount,
          account: 'Cash',
          branchId: resolvedBranch,
          branchName: record.branchName,
        });
      }
    }

    AuditService.recordAuditLog({
      userId: 'current-user',
      userName: record.createdBy,
      userRole: 'Cashier',
      action: 'CREATE',
      module: 'pos',
      targetEntityId: record.voucherNo,
      targetEntityType: 'CashbookVoucher',
      summary: `${record.direction === 'IN' ? 'Cash-In' : 'Cash-Out'} Voucher ${record.voucherNo} (${record.category}): ৳${amount.toFixed(2)} — ${record.partyName}`,
      beforeState: null,
      afterState: record,
    });

    await cashbookApi
      .createVoucher(record)
      .catch((e) => console.error('Failed to sync cashbook voucher to backend:', e));

    return record;
  }

  public static async deleteVoucher(id: string, deletedBy?: string): Promise<void> {
    const target = this.cache.vouchers.find((v) => v.id === id);
    if (!target) return;

    this.cache.vouchers = this.cache.vouchers.filter((v) => v.id !== id);
    writeJsonStorage(STORAGE_KEYS.VOUCHERS, this.cache.vouchers);
    this.emitChange();

    AuditService.recordAuditLog({
      userId: 'current-user',
      userName: deletedBy || 'Pharmacist',
      userRole: 'Pharmacist',
      action: 'DELETE',
      module: 'pos',
      targetEntityId: target.voucherNo,
      targetEntityType: 'CashbookVoucher',
      summary: `Deleted Cashbook Voucher ${target.voucherNo} (৳${target.amount.toFixed(2)})`,
      beforeState: target,
      afterState: null,
    });

    await cashbookApi
      .deleteVoucher(target.id)
      .catch((e) => console.error('Failed to delete voucher in backend:', e));
  }

  public static async closeDay(
    payload: Omit<CashbookDailyClosingRecord, 'id' | 'closedAt' | 'updatedAt'>
  ): Promise<CashbookDailyClosingRecord> {
    const resolvedBranch = payload.branchId === 'all' ? 'HQ-MAIN' : payload.branchId;
    const nowIso = new Date().toISOString();

    const record: CashbookDailyClosingRecord = {
      ...payload,
      id: `cls-${payload.cashbookDate}-${resolvedBranch}`,
      branchId: resolvedBranch,
      closedAt: nowIso,
      updatedAt: nowIso,
    };

    const list = [...this.cache.dailyClosings];
    const idx = list.findIndex(
      (c) => c.cashbookDate === record.cashbookDate && c.branchId === resolvedBranch
    );
    if (idx >= 0) list[idx] = record;
    else list.unshift(record);

    // Pre-seed next day opening cash from carryForwardFloat if next day doesn't already have an explicit entry
    const dt = new Date(payload.cashbookDate + 'T00:00:00');
    dt.setDate(dt.getDate() + 1);
    const nextDay = dt.toISOString().split('T')[0];
    const nextExists = list.some(
      (c) => c.cashbookDate === nextDay && c.branchId === resolvedBranch
    );
    if (!nextExists && record.carryForwardFloat >= 0) {
      list.unshift({
        id: `cls-${nextDay}-${resolvedBranch}`,
        cashbookDate: nextDay,
        branchId: resolvedBranch,
        branchName: record.branchName,
        openingCash: round2(record.carryForwardFloat),
        posCashSales: 0,
        dueAndMiscCashIn: 0,
        dailyShopExpense: 0,
        supplierCashPaid: 0,
        expectedClosingCash: round2(record.carryForwardFloat),
        countedPhysicalCash: 0,
        variance: 0,
        vaultTransfer: 0,
        carryForwardFloat: round2(record.carryForwardFloat),
        denominations: createEmptyDenominations(),
        status: 'OPEN',
        updatedAt: nowIso,
      });
    }

    this.cache.dailyClosings = list;
    writeJsonStorage(STORAGE_KEYS.DAILY_CLOSINGS, list);
    this.emitChange();

    AuditService.recordAuditLog({
      userId: 'current-user',
      userName: payload.closedBy || 'Pharmacist',
      userRole: 'Pharmacist',
      action: 'CREATE',
      module: 'pos',
      targetEntityId: record.id,
      targetEntityType: 'CashbookDailyClosing',
      summary: `Day-End Closing (${record.cashbookDate} • ${record.branchName}): Expected ৳${record.expectedClosingCash.toFixed(2)}, Physical ৳${record.countedPhysicalCash.toFixed(2)}, Variance ৳${record.variance.toFixed(2)} [${record.status}]`,
      beforeState: null,
      afterState: record,
    });

    await cashbookApi
      .closeDay(record)
      .catch((e) => console.error('Failed to sync day-end closing to backend:', e));

    return record;
  }

  public static getBackupMeta(): BackupMeta | null {
    return readJsonStorage<BackupMeta | null>(STORAGE_KEYS.LAST_BACKUP_META, null);
  }

  public static createSystemBackupSnapshot(operatorName: string): {
    jsonString: string;
    meta: BackupMeta;
    summaryCounts: Record<string, number>;
  } {
    const storeDump: Record<string, unknown> = {};
    let totalKeys = 0;

    if (typeof window !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (
          key.startsWith('rx_') ||
          key.startsWith('pharmerp_')
        ) {
          const raw = localStorage.getItem(key);
          if (raw !== null) {
            try {
              storeDump[key] = JSON.parse(raw);
            } catch {
              storeDump[key] = raw;
            }
            totalKeys++;
          }
        }
      }
    }

    const summaryCounts = {
      medicines: PharmacyService.getMedicines().length,
      batches: PharmacyService.getBatches().length,
      sales: PharmacyService.getSales().length,
      purchases: PharmacyService.getPurchases().length,
      suppliers: PharmacyService.getSuppliers().length,
      customers: CustomerService.getCustomers().length,
      vouchers: this.cache.vouchers.length,
      closings: this.cache.dailyClosings.length,
    };

    const totalRecords = Object.values(summaryCounts).reduce((a, b) => a + b, 0);
    const meta: BackupMeta = {
      lastBackupAt: new Date().toISOString(),
      lastBackupBy: operatorName || 'Admin',
      totalKeys,
      totalRecords,
    };
    writeJsonStorage(STORAGE_KEYS.LAST_BACKUP_META, meta);

    const payload = {
      app: 'PharmaPulse ERP',
      formatVersion: '2.1',
      exportedAt: meta.lastBackupAt,
      exportedBy: meta.lastBackupBy,
      summaryCounts,
      storage: storeDump,
    };

    AuditService.recordAuditLog({
      userId: 'current-user',
      userName: meta.lastBackupBy,
      userRole: 'Admin',
      action: 'CREATE',
      module: 'accounting',
      targetEntityId: `BKP-${Date.now()}`,
      targetEntityType: 'SystemBackup',
      summary: `Exported Full System JSON Backup (${totalRecords} records across ${totalKeys} stores)`,
      beforeState: null,
      afterState: summaryCounts,
    });

    return {
      jsonString: JSON.stringify(payload, null, 2),
      meta,
      summaryCounts,
    };
  }

  public static restoreSystemBackupSnapshot(
    parsedBackup: any,
    mode: 'merge' | 'replace',
    operatorName: string
  ): { restoredKeys: number } {
    if (!parsedBackup || typeof parsedBackup !== 'object' || !parsedBackup.storage) {
      throw new Error('Invalid PharmaPulse backup JSON structure (missing "storage" object).');
    }

    const storageEntries = Object.entries(parsedBackup.storage as Record<string, unknown>);
    let restoredKeys = 0;

    storageEntries.forEach(([key, val]) => {
      if (!key.startsWith('rx_') && !key.startsWith('pharmerp_')) return;

      if (mode === 'merge' && Array.isArray(val)) {
        const existing = readJsonStorage<any[]>(key, []);
        if (Array.isArray(existing)) {
          const existingIds = new Set(
            existing.map((item: any) => item?.id || item?.voucherNo || item?.invoiceNumber)
          );
          const merged = [
            ...existing,
            ...val.filter((item: any) => {
              const id = item?.id || item?.voucherNo || item?.invoiceNumber;
              return !id || !existingIds.has(id);
            }),
          ];
          writeJsonStorage(key, merged);
          restoredKeys++;
          return;
        }
      }

      writeJsonStorage(key, val);
      restoredKeys++;
    });

    // Reload CashbookService in-memory cache immediately
    this.cache.vouchers = readJsonStorage<CashbookVoucherRecord[]>(STORAGE_KEYS.VOUCHERS, []);
    this.cache.dailyClosings = readJsonStorage<CashbookDailyClosingRecord[]>(
      STORAGE_KEYS.DAILY_CLOSINGS,
      []
    );
    this.emitChange();

    AuditService.recordAuditLog({
      userId: 'current-user',
      userName: operatorName || 'Admin',
      userRole: 'Admin',
      action: 'UPDATE',
      module: 'accounting',
      targetEntityId: `RST-${Date.now()}`,
      targetEntityType: 'SystemRestore',
      summary: `Restored System Backup (${mode.toUpperCase()}) across ${restoredKeys} data stores`,
      beforeState: null,
      afterState: { mode, restoredKeys },
    });

    return { restoredKeys };
  }
}
