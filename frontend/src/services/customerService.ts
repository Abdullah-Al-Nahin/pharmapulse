import { 
  Customer, 
  CustomerLedgerEntry, 
  DuePaymentReceipt, 
  LoyaltyTransaction, 
  LoyaltyConfig, 
  PricingTier,
  CustomerType
} from '../types/customer';
import { 
  INITIAL_CUSTOMERS, 
  INITIAL_CUSTOMER_LEDGERS, 
  INITIAL_LOYALTY_TRANSACTIONS, 
  DEFAULT_LOYALTY_CONFIG 
} from '../lib/customerInitialData';
import { PharmacyService } from './pharmacyService';
import { AccountingTransaction } from '../types/pharmacy';
import { customerApi } from '../lib/api';

const STORAGE_KEYS = {
  CUSTOMERS: 'rx_customers_db_v2',
  CUSTOMER_LEDGERS: 'rx_customer_ledgers_db_v2',
  LOYALTY_HISTORY: 'rx_loyalty_history_db_v2',
  LOYALTY_CONFIG: 'rx_loyalty_config_db_v2',
};

type CustomerListener = () => void;

export class CustomerService {
  private static listeners: CustomerListener[] = [];

  public static subscribe(listener: CustomerListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private static emitChange(): void {
    this.listeners.forEach((l) => l());
  }

  private static getLocal<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(key);
      if (data) return JSON.parse(data);
    } catch {
      // LocalStorage or SSR fallback
    }
    return fallback;
  }

  private static isInitialized = false;

  private static setLocal<T>(key: string, data: T): void {
    try {
      const prev = localStorage.getItem(key);
      const next = JSON.stringify(data);
      if (prev !== next) {
        localStorage.setItem(key, next);
        this.emitChange();
      }
    } catch {
      // LocalStorage error fallback
    }
  }

  private static isSyncing = false;

  public static async syncFromDB(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      const dbCustomers = await customerApi.getCustomers();
      if (Array.isArray(dbCustomers) && dbCustomers.length > 0) {
        const current = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
        const next = JSON.stringify(dbCustomers);
        if (current !== next) {
          localStorage.setItem(STORAGE_KEYS.CUSTOMERS, next);
          this.emitChange();
        }
      }
    } catch (e) {
      console.error('Failed to sync customers from database:', e);
    } finally {
      this.isSyncing = false;
    }
  }

  public static initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (typeof window !== 'undefined' && !sessionStorage.getItem('cust_synced_v2')) {
      sessionStorage.setItem('cust_synced_v2', 'true');
      this.syncFromDB();
    }

    try {
      if (!localStorage.getItem(STORAGE_KEYS.CUSTOMERS)) {
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(INITIAL_CUSTOMERS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.CUSTOMER_LEDGERS)) {
        localStorage.setItem(STORAGE_KEYS.CUSTOMER_LEDGERS, JSON.stringify(INITIAL_CUSTOMER_LEDGERS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.LOYALTY_HISTORY)) {
        localStorage.setItem(STORAGE_KEYS.LOYALTY_HISTORY, JSON.stringify(INITIAL_LOYALTY_TRANSACTIONS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.LOYALTY_CONFIG)) {
        localStorage.setItem(STORAGE_KEYS.LOYALTY_CONFIG, JSON.stringify(DEFAULT_LOYALTY_CONFIG));
      }
    } catch {}
  }

  // ==========================================
  // CUSTOMER CRUD
  // ==========================================
  public static getCustomers(): Customer[] {
    this.initialize();
    return this.getLocal<Customer[]>(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
  }

  public static getCustomerById(id: string): Customer | undefined {
    return this.getCustomers().find((c) => c.id === id);
  }

  public static getCustomerByPhone(phone: string): Customer | undefined {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone) return undefined;
    return this.getCustomers().find((c) => c.phone.replace(/[^0-9]/g, '').includes(cleanPhone));
  }

  public static createCustomer(data: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    customerType: CustomerType;
    pricingTier?: PricingTier;
    creditLimit?: number;
    taxId?: string;
    institutionName?: string;
    contactPerson?: string;
    notes?: string;
  }): Customer {
    const list = this.getCustomers();
    
    // Default tier matching customerType
    let defaultTier: PricingTier = 'retail';
    let defaultCreditLimit = 0;

    switch (data.customerType) {
      case 'wholesale':
        defaultTier = 'wholesale';
        defaultCreditLimit = 5000;
        break;
      case 'corporate':
        defaultTier = 'dealer';
        defaultCreditLimit = 3000;
        break;
      case 'institution':
        defaultTier = 'institution';
        defaultCreditLimit = 10000;
        break;
      case 'regular':
        defaultTier = 'retail';
        defaultCreditLimit = 300;
        break;
      default:
        defaultTier = 'retail';
        defaultCreditLimit = 0;
    }

    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email?.trim() || undefined,
      address: data.address?.trim() || undefined,
      customerType: data.customerType,
      pricingTier: data.pricingTier || defaultTier,
      creditLimit: data.creditLimit !== undefined ? data.creditLimit : defaultCreditLimit,
      outstandingBalance: 0,
      loyaltyPoints: 0,
      totalSpent: 0,
      totalOrders: 0,
      taxId: data.taxId?.trim() || undefined,
      institutionName: data.institutionName?.trim() || undefined,
      contactPerson: data.contactPerson?.trim() || undefined,
      status: 'active',
      notes: data.notes?.trim() || undefined,
      createdAt: new Date().toISOString().split('T')[0],
    };

    list.unshift(newCustomer);
    this.setLocal(STORAGE_KEYS.CUSTOMERS, list);
    customerApi.createCustomer(newCustomer).catch((e) => console.error('Failed to save customer to DB:', e));
    return newCustomer;
  }

  public static updateCustomer(id: string, updates: Partial<Customer>): Customer | undefined {
    const list = this.getCustomers();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;

    list[idx] = { ...list[idx], ...updates };
    this.setLocal(STORAGE_KEYS.CUSTOMERS, list);
    customerApi.updateCustomer(id, updates).catch((e) => console.error('Failed to update customer in DB:', e));
    return list[idx];
  }

  public static deleteCustomer(id: string): boolean {
    const list = this.getCustomers();
    const filtered = list.filter((c) => c.id !== id);
    if (filtered.length === list.length) return false;
    this.setLocal(STORAGE_KEYS.CUSTOMERS, filtered);
    return true;
  }

  // ==========================================
  // DUE / RECEIVABLES LEDGER & CREDIT LIMITS
  // ==========================================
  public static getCustomerLedger(customerId?: string): CustomerLedgerEntry[] {
    this.initialize();
    const ledgers = this.getLocal<CustomerLedgerEntry[]>(STORAGE_KEYS.CUSTOMER_LEDGERS, INITIAL_CUSTOMER_LEDGERS);
    if (customerId) {
      return ledgers.filter((l) => l.customerId === customerId);
    }
    return ledgers;
  }

  public static checkCreditLimit(
    customerId: string, 
    additionalDue: number
  ): { 
    allowed: boolean; 
    currentBalance: number; 
    creditLimit: number; 
    projectedBalance: number; 
    availableCredit: number; 
    warning?: string;
  } {
    const customer = this.getCustomerById(customerId);
    if (!customer) {
      return {
        allowed: false,
        currentBalance: 0,
        creditLimit: 0,
        projectedBalance: additionalDue,
        availableCredit: 0,
        warning: 'Customer record not found.',
      };
    }

    if (customer.status === 'blocked') {
      return {
        allowed: false,
        currentBalance: customer.outstandingBalance,
        creditLimit: customer.creditLimit,
        projectedBalance: customer.outstandingBalance + additionalDue,
        availableCredit: 0,
        warning: 'Customer account is suspended/blocked. Credit transactions forbidden.',
      };
    }

    const currentBalance = customer.outstandingBalance;
    const creditLimit = customer.creditLimit;
    const projectedBalance = currentBalance + additionalDue;
    const availableCredit = Math.max(0, creditLimit - currentBalance);

    if (projectedBalance > creditLimit) {
      return {
        allowed: false,
        currentBalance,
        creditLimit,
        projectedBalance,
        availableCredit,
        warning: `Credit limit exceeded! Customer limit is $${creditLimit.toFixed(2)}, currently owing $${currentBalance.toFixed(2)}. This transaction would bring balance to $${projectedBalance.toFixed(2)} (Exceeds by $${(projectedBalance - creditLimit).toFixed(2)}).`,
      };
    }

    return {
      allowed: true,
      currentBalance,
      creditLimit,
      projectedBalance,
      availableCredit,
    };
  }

  /**
   * Record a sale made on credit (or partial credit/due)
   */
  public static recordCreditSale(params: {
    customerId: string;
    invoiceNumber: string;
    totalAmount: number;
    amountPaidNow: number;
    dueAmount: number;
    collectedBy?: string;
    notes?: string;
  }): { success: boolean; customer?: Customer; ledgerEntry?: CustomerLedgerEntry; error?: string } {
    const customer = this.getCustomerById(params.customerId);
    if (!customer) {
      return { success: false, error: 'Customer not found' };
    }

    if (params.dueAmount <= 0) {
      // Fully paid sale, just update customer statistics
      this.updateCustomer(customer.id, {
        totalSpent: customer.totalSpent + params.totalAmount,
        totalOrders: customer.totalOrders + 1,
      });
      return { success: true, customer };
    }

    const newOutstanding = customer.outstandingBalance + params.dueAmount;
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const ledgerEntry: CustomerLedgerEntry = {
      id: `cldg-${Date.now()}`,
      customerId: customer.id,
      customerName: customer.name,
      date,
      timestamp,
      type: 'INVOICE_DUE',
      referenceId: params.invoiceNumber,
      description: params.amountPaidNow > 0
        ? `Partial credit sale invoice: $${params.amountPaidNow.toFixed(2)} paid now, $${params.dueAmount.toFixed(2)} added to receivables`
        : `Full credit sale invoice: $${params.dueAmount.toFixed(2)} added to receivables`,
      debit: params.dueAmount,
      credit: 0,
      runningBalance: newOutstanding,
      collectedBy: params.collectedBy || 'Pharmacy Staff',
      notes: params.notes,
    };

    const ledgers = this.getCustomerLedger();
    ledgers.unshift(ledgerEntry);
    this.setLocal(STORAGE_KEYS.CUSTOMER_LEDGERS, ledgers);

    const updatedCustomer = this.updateCustomer(customer.id, {
      outstandingBalance: newOutstanding,
      totalSpent: customer.totalSpent + params.totalAmount,
      totalOrders: customer.totalOrders + 1,
    });

    return { success: true, customer: updatedCustomer, ledgerEntry };
  }

  /**
   * Due Collection API: Record customer payment, reduce outstanding balance,
   * write to customer ledger, generate payment receipt, and post to General Accounting.
   */
  public static collectDuePayment(params: {
    customerId: string;
    amountPaid: number;
    paymentMethod: 'cash' | 'bank_transfer' | 'cheque' | 'card' | 'upi_mobile';
    transactionReference?: string;
    referenceNotes?: string;
    collectedBy?: string;
  }): { receipt: DuePaymentReceipt; customer: Customer; ledgerEntry: CustomerLedgerEntry } {
    const customer = this.getCustomerById(params.customerId);
    if (!customer) {
      throw new Error('Customer record not found.');
    }

    if (params.amountPaid <= 0) {
      throw new Error('Payment collection amount must be greater than zero.');
    }

    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const receiptNumber = `RCP-${date.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const previousBalance = customer.outstandingBalance;
    const remainingBalance = Math.max(0, previousBalance - params.amountPaid);

    // 1. Create Due Payment Receipt
    const receipt: DuePaymentReceipt = {
      receiptNumber,
      date,
      timestamp,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerType: customer.customerType,
      amountPaid: params.amountPaid,
      previousBalance,
      remainingBalance,
      paymentMethod: params.paymentMethod,
      transactionReference: params.transactionReference,
      collectedBy: params.collectedBy || 'Authorized Cashier',
      notes: params.referenceNotes,
    };

    // 2. Create Ledger Entry
    const ledgerEntry: CustomerLedgerEntry = {
      id: `cldg-${Date.now()}`,
      customerId: customer.id,
      customerName: customer.name,
      date,
      timestamp,
      type: 'PAYMENT_RECEIVED',
      referenceId: receiptNumber,
      receiptNumber,
      description: `Payment received via ${params.paymentMethod.replace('_', ' ').toUpperCase()} (${params.transactionReference || 'Direct'})`,
      debit: 0,
      credit: params.amountPaid,
      runningBalance: remainingBalance,
      paymentMethod: params.paymentMethod,
      collectedBy: params.collectedBy || 'Authorized Cashier',
      notes: params.referenceNotes,
    };

    const ledgers = this.getCustomerLedger();
    ledgers.unshift(ledgerEntry);
    this.setLocal(STORAGE_KEYS.CUSTOMER_LEDGERS, ledgers);

    // 3. Update Customer Balance
    const updatedCustomer = this.updateCustomer(customer.id, {
      outstandingBalance: remainingBalance,
    })!;

    // 4. Record to General Accounting Ledger
    try {
      const accountingTransactions: AccountingTransaction[] = PharmacyService.getAccountingTransactions();
      const newAccTx: AccountingTransaction = {
        id: `tx-due-${Date.now()}`,
        date,
        type: 'sale_revenue',
        referenceId: receiptNumber,
        description: `Customer Due Collection: ${customer.name} (Receipt ${receiptNumber})`,
        debit: params.amountPaid,
        credit: 0,
        account: params.paymentMethod === 'bank_transfer' ? 'Bank' : 'Cash',
      };
      accountingTransactions.unshift(newAccTx);
      localStorage.setItem('rx_accounting_v1', JSON.stringify(accountingTransactions));
    } catch {
      // Non-blocking fallback
    }

    return { receipt, customer: updatedCustomer, ledgerEntry };
  }

  // ==========================================
  // LOYALTY POINTS PROGRAM
  // ==========================================
  public static getLoyaltyConfig(): LoyaltyConfig {
    this.initialize();
    return this.getLocal<LoyaltyConfig>(STORAGE_KEYS.LOYALTY_CONFIG, DEFAULT_LOYALTY_CONFIG);
  }

  public static updateLoyaltyConfig(updates: Partial<LoyaltyConfig>): LoyaltyConfig {
    const current = this.getLoyaltyConfig();
    const updated = { ...current, ...updates };
    this.setLocal(STORAGE_KEYS.LOYALTY_CONFIG, updated);
    return updated;
  }

  public static getLoyaltyHistory(customerId?: string): LoyaltyTransaction[] {
    this.initialize();
    const history = this.getLocal<LoyaltyTransaction[]>(STORAGE_KEYS.LOYALTY_HISTORY, INITIAL_LOYALTY_TRANSACTIONS);
    if (customerId) {
      return history.filter((h) => h.customerId === customerId);
    }
    return history;
  }

  /**
   * Award loyalty points based on net eligible spend
   */
  public static awardLoyaltyPoints(
    customerId: string,
    invoiceNumber: string,
    eligibleSpend: number,
    processedBy?: string
  ): { pointsEarned: number; newBalance: number } {
    const customer = this.getCustomerById(customerId);
    if (!customer || customer.customerType === 'retail' && customer.id === 'cust-walkin') {
      // Anonymous counter walk-in doesn't track points
      return { pointsEarned: 0, newBalance: 0 };
    }

    const config = this.getLoyaltyConfig();
    if (eligibleSpend < config.currencySpentPerPoint) {
      return { pointsEarned: 0, newBalance: customer.loyaltyPoints };
    }

    const multiplier = Math.floor(eligibleSpend / config.currencySpentPerPoint);
    const pointsEarned = multiplier * config.earnPointsPerUnitSpent;

    if (pointsEarned <= 0) {
      return { pointsEarned: 0, newBalance: customer.loyaltyPoints };
    }

    const newBalance = customer.loyaltyPoints + pointsEarned;
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const transaction: LoyaltyTransaction = {
      id: `loy-${Date.now()}`,
      customerId: customer.id,
      customerName: customer.name,
      date,
      timestamp,
      type: 'earned',
      points: pointsEarned,
      balanceAfter: newBalance,
      saleInvoiceNumber: invoiceNumber,
      monetaryEquivalent: Math.round(pointsEarned * config.redemptionRatePerPoint * 100) / 100,
      description: `Earned ${pointsEarned} points for $${eligibleSpend.toFixed(2)} purchase on Invoice ${invoiceNumber}`,
      processedBy: processedBy || 'Pharmacy POS',
    };

    const history = this.getLoyaltyHistory();
    history.unshift(transaction);
    this.setLocal(STORAGE_KEYS.LOYALTY_HISTORY, history);

    this.updateCustomer(customer.id, { loyaltyPoints: newBalance });

    return { pointsEarned, newBalance };
  }

  /**
   * Redeem loyalty points for immediate POS cart discount
   */
  public static redeemLoyaltyPoints(
    customerId: string,
    pointsToRedeem: number,
    invoiceNumber: string,
    processedBy?: string
  ): { success: boolean; discountAmount: number; remainingPoints: number; error?: string } {
    const customer = this.getCustomerById(customerId);
    if (!customer) {
      return { success: false, discountAmount: 0, remainingPoints: 0, error: 'Customer not found' };
    }

    const config = this.getLoyaltyConfig();

    if (pointsToRedeem < config.minimumPointsToRedeem) {
      return {
        success: false,
        discountAmount: 0,
        remainingPoints: customer.loyaltyPoints,
        error: `Minimum redemption threshold is ${config.minimumPointsToRedeem} points.`,
      };
    }

    if (pointsToRedeem > customer.loyaltyPoints) {
      return {
        success: false,
        discountAmount: 0,
        remainingPoints: customer.loyaltyPoints,
        error: `Insufficient loyalty points. Customer only has ${customer.loyaltyPoints} points available.`,
      };
    }

    const discountAmount = Math.round(pointsToRedeem * config.redemptionRatePerPoint * 100) / 100;
    const remainingPoints = customer.loyaltyPoints - pointsToRedeem;
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const transaction: LoyaltyTransaction = {
      id: `loy-${Date.now()}`,
      customerId: customer.id,
      customerName: customer.name,
      date,
      timestamp,
      type: 'redeemed',
      points: -pointsToRedeem,
      balanceAfter: remainingPoints,
      saleInvoiceNumber: invoiceNumber,
      monetaryEquivalent: discountAmount,
      description: `Redeemed ${pointsToRedeem} points for $${discountAmount.toFixed(2)} discount on Invoice ${invoiceNumber}`,
      processedBy: processedBy || 'Pharmacy POS',
    };

    const history = this.getLoyaltyHistory();
    history.unshift(transaction);
    this.setLocal(STORAGE_KEYS.LOYALTY_HISTORY, history);

    this.updateCustomer(customer.id, { loyaltyPoints: remainingPoints });

    return { success: true, discountAmount, remainingPoints };
  }

  /**
   * Manual Loyalty Adjustment (Add/Subtract bonus or expired points)
   */
  public static adjustLoyaltyPoints(
    customerId: string,
    pointsDelta: number,
    type: 'adjusted' | 'expired',
    reason: string,
    processedBy?: string
  ): { customer: Customer; transaction: LoyaltyTransaction } {
    const customer = this.getCustomerById(customerId);
    if (!customer) throw new Error('Customer not found');

    const config = this.getLoyaltyConfig();
    const newBalance = Math.max(0, customer.loyaltyPoints + pointsDelta);
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const transaction: LoyaltyTransaction = {
      id: `loy-${Date.now()}`,
      customerId: customer.id,
      customerName: customer.name,
      date,
      timestamp,
      type,
      points: pointsDelta,
      balanceAfter: newBalance,
      monetaryEquivalent: Math.round(Math.abs(pointsDelta) * config.redemptionRatePerPoint * 100) / 100,
      description: reason || `Manual loyalty adjustment of ${pointsDelta} points`,
      processedBy: processedBy || 'Pharmacy Manager',
    };

    const history = this.getLoyaltyHistory();
    history.unshift(transaction);
    this.setLocal(STORAGE_KEYS.LOYALTY_HISTORY, history);

    const updatedCustomer = this.updateCustomer(customer.id, { loyaltyPoints: newBalance })!;
    return { customer: updatedCustomer, transaction };
  }
}
