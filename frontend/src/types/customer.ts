export type CustomerType = 
  | 'retail' 
  | 'regular' 
  | 'corporate' 
  | 'wholesale' 
  | 'institution';

export type PricingTier = 
  | 'retail' 
  | 'wholesale' 
  | 'dealer' 
  | 'institution' 
  | 'mrp';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  customerType: CustomerType;
  pricingTier: PricingTier;
  creditLimit: number; // Max allowed due balance
  outstandingBalance: number; // Current accounts receivable due
  loyaltyPoints: number; // Available active loyalty points
  totalSpent: number;
  totalOrders: number;
  taxId?: string; // GST/VAT/BIN
  institutionName?: string;
  contactPerson?: string;
  status: 'active' | 'blocked';
  notes?: string;
  createdAt: string;
}

export type CustomerLedgerEntryType = 
  | 'INVOICE_DUE'       // Credit sale invoice added to receivables
  | 'PAYMENT_RECEIVED'  // Due collection payment (reduces receivables)
  | 'CREDIT_NOTE'       // Refund / Return credit (reduces receivables)
  | 'ADJUSTMENT';       // Manual accounting write-off or adjustment

export interface CustomerLedgerEntry {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  timestamp: string;
  type: CustomerLedgerEntryType;
  referenceId: string; // Invoice number (INV-...) or Payment Receipt number (RCP-...)
  description: string;
  debit: number;  // Increases receivable balance (e.g. unpaid sale invoice)
  credit: number; // Decreases receivable balance (e.g. cash collected)
  runningBalance: number;
  paymentMethod?: 'cash' | 'bank_transfer' | 'cheque' | 'card' | 'upi_mobile';
  receiptNumber?: string;
  collectedBy?: string;
  notes?: string;
}

export interface DuePaymentReceipt {
  receiptNumber: string;
  date: string;
  timestamp: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerType: CustomerType;
  amountPaid: number;
  previousBalance: number;
  remainingBalance: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'cheque' | 'card' | 'upi_mobile';
  transactionReference?: string;
  collectedBy: string;
  notes?: string;
}

export type LoyaltyTransactionType = 
  | 'earned' 
  | 'redeemed' 
  | 'expired' 
  | 'adjusted';

export interface LoyaltyTransaction {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  timestamp: string;
  type: LoyaltyTransactionType;
  points: number; // Positive for earned, negative for redeemed/expired
  balanceAfter: number;
  saleInvoiceNumber?: string;
  monetaryEquivalent?: number; // In currency units (e.g. $1 per 10 points)
  description: string;
  processedBy: string;
}

export interface LoyaltyConfig {
  earnPointsPerUnitSpent: number; // e.g., 1 point per $10 spent
  currencySpentPerPoint: number;  // $10 spent = 1 point
  redemptionRatePerPoint: number; // 1 point = $0.25 currency discount
  minimumPointsToRedeem: number;  // Minimum points threshold (e.g., 50 points)
  maxRedemptionPercentagePerOrder: number; // e.g., max 50% of invoice can be paid with points
}

export interface TierPriceRule {
  tier: PricingTier;
  label: string;
  discountPercentageFromMRP: number; // Fallback rule if item-specific dealer price not set
  description: string;
}
