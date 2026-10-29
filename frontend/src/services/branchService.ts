import { BranchInfo, BranchMetrics } from '../types/pharmapulse';
import { PharmacyService } from './pharmacyService';
import { branchApi } from '../lib/api';

const STORAGE_KEY_BRANCHES = 'pharmerp_branches_db_v3';
const STORAGE_KEY_EMPLOYEES = 'pharmerp_employees_db_v3';

type BranchListener = () => void;

const DEFAULT_BRANCHES: BranchInfo[] = [
  {
    id: 'br-snakra',
    name: 'snakra',
    bnName: 'শাঁকরা ব্রাঞ্চ',
    code: '1234',
    type: 'retail_branch',
    address: 'Shankra Main Road, Keraniganj',
    phone: '+880 1919-191919',
    managerName: 'nahin3',
    licenseNo: 'BR-177324194412969-52',
    color: '#10b981',
    metrics: {
      stockCount: 15,
      stockValue: 42500,
      todaySales: 2420.50,
      monthSales: 68500,
      monthlyPurchase: 45000,
      cashBalance: 2420.50,
      monthlyExpense: 12000,
      monthlyProfit: 11500,
      profitMargin: 16.8,
      staffCount: 1,
      activeSuppliers: 5,
      registeredCustomers: 25,
    }
  },
  {
    id: 'HQ-MAIN',
    name: 'Madina Eye Hospital & Central Pharmacy',
    bnName: 'মদিনা আই হসপিটাল ও সেন্ট্রাল ফার্মেসি',
    code: 'HQ-MAIN',
    type: 'head_office',
    address: 'Plot 12, Mirpur Main Road, Dhaka',
    phone: '+880 1711-001122',
    managerName: 'nahin3',
    licenseNo: 'DGDA-DH-10492',
    color: '#10b981',
    metrics: {
      stockCount: 45,
      stockValue: 125000,
      todaySales: 15400,
      monthSales: 340000,
      monthlyPurchase: 210000,
      cashBalance: 15400,
      monthlyExpense: 35000,
      monthlyProfit: 95000,
      profitMargin: 27.9,
      staffCount: 8,
      activeSuppliers: 12,
      registeredCustomers: 120,
    }
  },
  {
    id: 'br-dhaka-central',
    name: 'Dhaka Central Hub',
    bnName: 'ঢাকা সেন্ট্রাল হাব',
    code: 'BR-DHAKA-CENTRAL',
    type: 'head_office',
    address: 'Motijheel C/A, Dhaka',
    phone: '+880 1711-223344',
    managerName: 'nahin1',
    licenseNo: 'DGDA-DH-99120',
    color: '#3b82f6',
    metrics: {
      stockCount: 28,
      stockValue: 84000,
      todaySales: 8900,
      monthSales: 195000,
      monthlyPurchase: 120000,
      cashBalance: 8900,
      monthlyExpense: 22000,
      monthlyProfit: 53000,
      profitMargin: 27.1,
      staffCount: 2,
      activeSuppliers: 8,
      registeredCustomers: 40,
    }
  },
  {
    id: 'br-sylhet',
    name: 'Sylhet Care Center',
    bnName: 'সিলেট কেয়ার সেন্টার',
    code: 'BR-SYLHET',
    type: 'retail_branch',
    address: 'Zindabazar, Sylhet',
    phone: '+880 1819-334455',
    managerName: 'nahin',
    licenseNo: 'DGDA-SY-33102',
    color: '#8b5cf6',
    metrics: {
      stockCount: 18,
      stockValue: 39000,
      todaySales: 4100,
      monthSales: 92000,
      monthlyPurchase: 60000,
      cashBalance: 4100,
      monthlyExpense: 11000,
      monthlyProfit: 21000,
      profitMargin: 22.8,
      staffCount: 1,
      activeSuppliers: 4,
      registeredCustomers: 15,
    }
  }
];

export class BranchService {
  private static listeners: BranchListener[] = [];
  private static isEmitting = false;

  public static subscribe(listener: BranchListener): () => void {
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
      snapshot.forEach((l) => {
        try {
          l();
        } catch (err) {
          console.error('BranchService listener error:', err);
        }
      });
    });
  }

  private static isSyncing = false;

  public static async syncFromDB(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      const dbBranches = await branchApi.getBranches();
      if (Array.isArray(dbBranches) && dbBranches.length > 0) {
        if (typeof window !== 'undefined') {
          const prev = localStorage.getItem(STORAGE_KEY_BRANCHES);
          const next = JSON.stringify(dbBranches);
          if (prev !== next) {
            localStorage.setItem(STORAGE_KEY_BRANCHES, next);
            this.emitChange();
          }
        }
      }
    } catch (e) {
      console.error('Failed to sync branches from database:', e);
    } finally {
      this.isSyncing = false;
    }
  }

  public static getBranches(): BranchInfo[] {
    // Fire-and-forget sync on first access
    if (!this.isSyncing && typeof window !== 'undefined' && !sessionStorage.getItem('branches_synced')) {
      sessionStorage.setItem('branches_synced', 'true');
      this.syncFromDB();
    }

    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY_BRANCHES);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const existingIds = new Set(parsed.map((b: BranchInfo) => b.id));
            const missing = DEFAULT_BRANCHES.filter((b) => !existingIds.has(b.id));
            if (missing.length > 0) {
              const merged = [...parsed, ...missing];
              localStorage.setItem(STORAGE_KEY_BRANCHES, JSON.stringify(merged));
              return merged;
            }
            return parsed;
          }
        }
        localStorage.setItem(STORAGE_KEY_BRANCHES, JSON.stringify(DEFAULT_BRANCHES));
        return DEFAULT_BRANCHES;
      }
    } catch (e) {
      console.error('Failed to parse dynamic branches from localStorage', e);
    }
    return DEFAULT_BRANCHES;
  }

  public static getBranchById(branchId: string): BranchInfo | undefined {
    return this.getBranches().find((b) => b.id === branchId || b.code.toLowerCase() === branchId.toLowerCase());
  }

  public static addBranch(data: {
    name: string;
    bnName?: string;
    code: string;
    type: 'head_office' | 'retail_branch' | 'opd_counter' | 'hospital_inpatient' | 'warehouse';
    address?: string;
    phone?: string;
    managerName?: string;
    licenseNo?: string;
    color?: string;
  }): BranchInfo {
    const branches = this.getBranches();
    const newId = `br-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newBranch: BranchInfo = {
      id: newId,
      name: data.name.trim(),
      bnName: data.bnName?.trim() || data.name.trim(),
      code: data.code.trim().toUpperCase(),
      type: data.type,
      address: data.address?.trim() || 'Institutional Address Not Specified',
      phone: data.phone?.trim() || 'N/A',
      managerName: data.managerName?.trim() || 'Branch In-Charge',
      licenseNo: data.licenseNo?.trim() || 'PENDING-DGDA',
      color: data.color || 'border-emerald-500 text-emerald-400 bg-emerald-500/10',
      metrics: {
        stockCount: 0,
        stockValue: 0,
        todaySales: 0,
        monthSales: 0,
        monthlyPurchase: 0,
        cashBalance: 0,
        monthlyExpense: 0,
        monthlyProfit: 0,
        profitMargin: 0,
        staffCount: 0,
        activeSuppliers: 0,
        registeredCustomers: 0,
      },
    };

    const next = [...branches, newBranch];
    this.saveBranches(next);
    branchApi.createBranch(newBranch).catch((e) => console.error('Failed to create branch in database:', e));
    return newBranch;
  }

  public static updateBranch(id: string, updates: Partial<BranchInfo>): BranchInfo | null {
    const branches = this.getBranches();
    const idx = branches.findIndex((b) => b.id === id);
    if (idx === -1) return null;

    const updated = {
      ...branches[idx],
      ...updates,
      metrics: {
        ...branches[idx].metrics,
        ...(updates.metrics || {}),
      },
    };

    branches[idx] = updated;
    this.saveBranches(branches);
    branchApi.updateBranch(id, updates).catch((e) => console.error('Failed to update branch in database:', e));
    return updated;
  }

  public static deleteBranch(id: string): boolean {
    const branches = this.getBranches();
    const next = branches.filter((b) => b.id !== id);
    if (next.length === branches.length) return false;
    this.saveBranches(next);
    branchApi.deleteBranch(id).catch((e) => console.error('Failed to delete branch in database:', e));
    return true;
  }

  private static saveBranches(branches: BranchInfo[]): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_BRANCHES, JSON.stringify(branches));
      }
    } catch (e) {
      console.error('Failed to save branches to localStorage', e);
    }
    this.emitChange();
  }

  /**
   * Dynamically calculates metrics for a branch based on real tagged data
   */
  public static computeMetricsForBranch(branchId: string | 'all'): BranchMetrics {
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthPrefix = todayStr.substring(0, 7);

    // Get live data
    const batches = PharmacyService.getBatches();
    const sales = PharmacyService.getSales();
    const purchases = PharmacyService.getPurchases();
    const accountingTx = PharmacyService.getAccountingTransactions();

    // Load registered employees to count staff per branch
    let staffCount = 0;
    try {
      if (typeof window !== 'undefined') {
        const savedEmp = localStorage.getItem(STORAGE_KEY_EMPLOYEES);
        if (savedEmp) {
          const employees = JSON.parse(savedEmp);
          if (Array.isArray(employees)) {
            staffCount = branchId === 'all'
              ? employees.length
              : employees.filter((e) => e.branchId === branchId).length;
          }
        }
      }
    } catch { }

    // Filter Batches (Inventory)
    const branchBatches = branchId === 'all'
      ? batches
      : batches.filter((b) => !b.branchId || b.branchId === branchId);

    const stockCount = branchBatches.reduce((acc, b) => acc + (b.currentStock > 0 ? 1 : 0), 0);
    const stockValue = branchBatches.reduce((acc, b) => acc + b.currentStock * (b.purchasePrice || 0), 0);

    // Filter Sales
    const branchSales = branchId === 'all'
      ? sales
      : sales.filter((s) => !s.branchId || s.branchId === branchId);

    const todaySales = branchSales
      .filter((s) => s.date === todayStr)
      .reduce((acc, s) => acc + (s.grandTotal || 0), 0);

    const monthSales = branchSales
      .filter((s) => s.date && s.date.startsWith(currentMonthPrefix))
      .reduce((acc, s) => acc + (s.grandTotal || 0), 0);

    // Filter Purchases
    const branchPurchases = branchId === 'all'
      ? purchases
      : purchases.filter((p) => !p.branchId || p.branchId === branchId);

    const monthlyPurchase = branchPurchases
      .filter((p) => p.purchaseDate && p.purchaseDate.startsWith(currentMonthPrefix))
      .reduce((acc, p) => acc + (p.totalAmount || 0), 0);

    // Filter Accounting Transactions
    const branchTx = branchId === 'all'
      ? accountingTx
      : accountingTx.filter((t) => !t.branchId || t.branchId === branchId);

    const monthlyExpense = branchTx
      .filter((t) => t.type === 'operational_expense' && t.date.startsWith(currentMonthPrefix))
      .reduce((acc, t) => acc + (t.debit || 0), 0);

    const cashIn = branchSales.reduce((acc, s) => acc + (s.paymentMethod === 'cash' ? s.grandTotal : 0), 0);
    const cashOut = branchTx
      .filter((t) => t.account === 'Cash' || t.description.toLowerCase().includes('cash'))
      .reduce((acc, t) => acc + (t.debit || 0), 0);
    const cashBalance = Math.max(0, cashIn - cashOut);

    const grossProfit = branchSales.reduce((acc, s) => acc + (s.grossProfit || 0), 0);
    const monthlyProfit = grossProfit - monthlyExpense;
    const profitMargin = monthSales > 0 ? Math.round((monthlyProfit / monthSales) * 100 * 10) / 10 : 0;

    return {
      stockCount,
      stockValue: Math.round(stockValue),
      todaySales: Math.round(todaySales),
      monthSales: Math.round(monthSales),
      monthlyPurchase: Math.round(monthlyPurchase),
      cashBalance: Math.round(cashBalance),
      monthlyExpense: Math.round(monthlyExpense),
      monthlyProfit: Math.round(monthlyProfit),
      profitMargin,
      staffCount,
      activeSuppliers: PharmacyService.getSuppliers().length,
      registeredCustomers: 150,
    };
  }

  /**
   * Returns all branches with fresh real-time metrics computed from tagged transactions
   */
  public static getEnrichedBranches(): BranchInfo[] {
    const raw = this.getBranches();
    return raw.map((b) => ({
      ...b,
      metrics: this.computeMetricsForBranch(b.id),
    }));
  }
}
