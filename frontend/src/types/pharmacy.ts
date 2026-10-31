export type MedicineCategory = 
  | 'Antibiotics'
  | 'Analgesics & Antipyretics'
  | 'Cardiovascular'
  | 'Antidiabetic'
  | 'Respiratory'
  | 'Gastrointestinal'
  | 'Dermatology'
  | 'Neurology & Psych'
  | 'Vitamins & Supplements'
  | 'Ophthalmic & ENT';

export type DosageForm = 
  | 'Tablet'
  | 'Capsule'
  | 'Syrup'
  | 'Suspension'
  | 'Injection'
  | 'Ointment / Cream'
  | 'Eye / Ear Drops'
  | 'Ophthalmic Drop'
  | 'Ophthalmic Ointment'
  | 'Ophthalmic Gel'
  | 'Inhaler / Respule'
  | 'IV Infusion';

export type BatchStatus = 'active' | 'quarantined' | 'expired' | 'depleted' | 'ACTIVE' | 'QUARANTINED' | 'EXPIRED' | 'DEPLETED';

export interface Batch {
  id: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  manufacturingDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  purchasePrice: number; // Cost price to pharmacy
  mrp: number; // Maximum Retail Price
  sellingPrice: number; // Actual selling price (usually <= MRP)
  initialQuantity: number;
  currentStock: number;
  status: BatchStatus;
  supplierId?: string;
  supplierName?: string;
  barcode?: string;
  rackLocation?: string;
  wholesalePrice?: number;
  dealerPrice?: number;
  institutionPrice?: number;
  branchId?: string;
  branchName?: string;
}

export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  brandName?: string;
  category: MedicineCategory;
  dosageForm: DosageForm;
  strength: string; // e.g. "500 mg", "100 ml", "10 mg/ml"
  manufacturer: string;
  unitOfMeasure: 'Strip' | 'Box' | 'Bottle' | 'Vial' | 'Tube' | 'Piece';
  packSize: number; // e.g. 10 tablets per strip
  reorderLevel: number; // Min stock before warning
  rackLocation: string; // e.g. "Rack A-04", "Fridge-B"
  defaultRackLocation?: string;
  requiresPrescription: boolean; // Schedule H / Rx
  isNarcoticOrSedative: boolean; // Strict record keeping
  taxRate: number; // e.g. 5, 12, 18%
  description?: string;
  storageInstructions?: string;
  barcode?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  companyName: string;
  contactPerson?: string;
  phone: string;
  email: string;
  address: string;
  drugLicenseNumber: string;
  taxId: string;
  paymentTermsDays: number;
  balancePayable: number;
}

export interface PurchaseItem {
  id: string;
  medicineId: string;
  medicineName: string;
  dosageForm: DosageForm;
  batchNumber?: string;
  manufacturingDate?: string;
  expiryDate?: string;
  quantity: number; // Inward/received quantity or ordered quantity
  purchasePrice: number;
  mrp: number;
  sellingPrice: number;
  taxRate: number;
  totalAmount: number;

  // Additional fields for PO & GRN workflows
  unitType?: 'Box' | 'Strip' | 'Piece';
  packSize?: number;
  orderedQuantity?: number;
  receivedQuantity?: number;
  freeQuantity?: number; // Bonus Stock from vendor
  damagedQuantity?: number; // Damaged or rejected
  expectedMrp?: number;
  discountPercent?: number;
  taxAmount?: number;
  rackLocation?: string;
  warehouse?: string;
}

export type PurchaseOrderStatusType = 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  poNumber?: string; // System PO / GRN number (e.g., PO-2026-0042)
  invoiceNumber: string; // Vendor invoice / bill number
  supplierId: string;
  supplierName: string;
  orderDate?: string;
  purchaseDate: string;
  expectedDeliveryDate?: string;
  paymentTerms?: string; // e.g. "Net 30", "Net 15", "Advance", "Cash on Delivery"
  dueDate: string;
  status?: PurchaseOrderStatusType;
  paymentStatus: 'paid' | 'partial' | 'pending';
  subtotal?: number;
  discountAmount?: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount?: number;
  items: PurchaseItem[];
  notes?: string;
  receivedAt?: string;
  branchId?: string;
  branchName?: string;
}

export interface SupplierLedgerEntry {
  id: string;
  supplierId: string;
  supplierName: string;
  date: string;
  type: 'INVOICE' | 'PAYMENT' | 'RETURN_CREDIT' | 'ADJUSTMENT';
  reference: string; // PO Number, Invoice Number, or Voucher Number
  description: string;
  debit: number; // Payment / Vendor settlement (reduces liability)
  credit: number; // Inward bill / Invoice (increases liability)
  runningBalance: number;
}

export interface PrescriptionMedication {
  medicineId?: string;
  medicineName: string;
  dosage: string; // e.g. "1 tab twice daily"
  frequency: string; // e.g. "1-0-1"
  duration: string; // e.g. "5 days"
  quantity: number;
  dispensed: boolean;
  instructions?: string;
}

export interface Prescription {
  id: string;
  prescriptionNumber: string;
  patientName: string;
  patientAge: number;
  patientGender: 'Male' | 'Female' | 'Other';
  patientPhone: string;
  doctorName: string;
  doctorRegNumber: string;
  clinicHospital: string;
  diagnosis: string;
  date: string;
  medications: PrescriptionMedication[];
  status: 'pending' | 'partially_dispensed' | 'dispensed';
  notes?: string;
}

export interface POSCartItem {
  id: string; // unique cart item id
  medicineId: string;
  medicineName: string;
  genericName: string;
  strength: string;
  dosageForm: DosageForm;
  rackLocation: string;
  requiresPrescription: boolean;
  
  // FEFO Batch details
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  currentBatchStock: number;
  isExpired: boolean;
  daysToExpiry: number;
  
  // Unit conversion
  unitType?: 'box' | 'pcs'; // Box/Strip vs Loose Piece/Tablet
  packSize?: number; // Pieces per Box/Strip
  
  quantity: number;
  unitPrice: number;
  unitCost: number; // for COGS and profit calculation
  mrp: number;
  discountPercent: number;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
}

export interface SaleItem {
  id?: string;
  medicineId: string;
  medicineName: string;
  genericName: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  unitType?: 'box' | 'pcs';
  packSize?: number;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  mrp: number;
  discountPercent: number;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  date: string;
  timestamp: string;
  customerName: string;
  customerPhone?: string;
  prescriptionId?: string;
  doctorName?: string;
  
  items: SaleItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  totalCost: number; // COGS
  grossProfit: number; // grandTotal - taxTotal - totalCost
  
  customerId?: string;
  pricingTier?: string;
  loyaltyPointsEarned?: number;
  loyaltyPointsRedeemed?: number;
  loyaltyDiscountAmount?: number;
  dueAmount?: number;
  
  paymentMethod: 'cash' | 'card' | 'upi_mobile' | 'bkash_nagad' | 'split' | 'due_credit';
  cashTendered?: number;
  changeGiven?: number;
  splitDetails?: {
    cashAmount?: number;
    mobileAmount?: number;
    mobileProvider?: 'bKash' | 'Nagad' | 'Rocket' | 'Other';
    mobileTrxId?: string;
    cardAmount?: number;
    cardType?: 'Visa' | 'Mastercard' | 'Amex' | 'POS';
    cardAuthCode?: string;
  };
  paymentStatus: 'completed' | 'paid' | 'refunded' | 'partially_refunded' | 'due' | 'partially_paid';
  cashierId?: string;
  cashierName: string;
  notes?: string;
  branchId?: string;
  branchName?: string;
}

export interface HeldSale {
  id: string;
  holdNumber: string;
  customerName: string;
  items: POSCartItem[];
  heldAt: string;
  totalAmount: number;
  itemCount: number;
  notes?: string;
}

export interface ReturnItem {
  medicineId: string;
  medicineName: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  unitPrice: number;
  refundAmount: number;
  reason: 'wrong_item' | 'customer_cancelled' | 'doctor_changed' | 'adverse_reaction' | 'other';
  action: 'restock' | 'quarantine';
}

export interface SaleReturn {
  id: string;
  returnNumber: string;
  originalInvoiceNumber: string;
  originalSaleId: string;
  date: string;
  customerName: string;
  items: ReturnItem[];
  totalRefund: number;
  refundMethod: 'cash' | 'original_payment' | 'store_credit';
  notes?: string;
  processedBy: string;
  branchId?: string;
  branchName?: string;
}

export interface AccountingTransaction {
  id: string;
  date: string;
  type: 'sale_revenue' | 'cost_of_goods' | 'supplier_payment' | 'purchase_expense' | 'sales_return' | 'operational_expense';
  referenceId: string; // Sale ID, Purchase ID, Return ID
  description: string;
  debit: number; // Money out / Asset increase
  credit: number; // Money in / Revenue
  account: 'Cash' | 'Bank' | 'Accounts Payable' | 'Inventory Asset' | 'Sales Income' | 'Cost of Goods' | 'Stock Loss / Discrepancy Expense' | 'Inventory Equity Correction' | (string & {});
  branchId?: string;
  branchName?: string;
}

export interface ReorderItem {
  id: string;
  medicineId: string;
  medicineName: string;
  genericName?: string;
  currentStock: number;
  reorderLevel: number;
  suggestedQty: number;
  supplierId?: string;
  supplierName?: string;
  dateAdded: string;
}

// ==========================================
// --- Purchase Order Suggester Types ---
// ==========================================
export type StockoutRiskLevel = 'out_of_stock' | 'critical' | 'reorder_point' | 'low_risk' | 'adequate';

export interface PurchaseOrderSuggestionItem {
  medicineId: string;
  medicineName: string;
  genericName: string;
  brandName?: string;
  category: MedicineCategory;
  dosageForm: DosageForm;
  strength: string;
  unitOfMeasure: string;
  packSize: number;
  rackLocation: string;
  currentStock: number;
  reorderLevel: number;
  deficit: number;
  
  // Consumption & Velocity
  salesLast30Days: number;
  avgDailyConsumption: number; // ADC
  daysOfStockRemaining: number;
  riskLevel: StockoutRiskLevel;
  
  // Replenishment Calculation
  targetBufferDays: number;
  leadTimeDays: number;
  rawNeededQuantity: number;
  suggestedPacks: number;
  suggestedQuantity: number;
  adjustedQuantity: number; // Editable by user
  adjustedPacks: number;
  
  // Costing
  unitPurchasePrice: number;
  mrp: number;
  sellingPrice: number;
  taxRate: number;
  estimatedSubtotal: number;
  estimatedTax: number;
  estimatedTotal: number;
  
  // Supplier mapping
  supplierId: string;
  supplierName: string;
  isSelected: boolean;
}

export interface SupplierPurchaseSuggestionGroup {
  supplier: Supplier;
  items: PurchaseOrderSuggestionItem[];
  totalItemsCount: number;
  selectedItemsCount: number;
  outOfStockCount: number;
  criticalCount: number;
  totalSuggestedPacks: number;
  totalSuggestedQuantity: number;
  totalEstimatedSubtotal: number;
  totalEstimatedTax: number;
  totalEstimatedAmount: number;
  leadTimeDays: number;
  paymentTerms: string;
  balancePayable: number;
  minOrderValueTarget: number;
  meetsMinOrderValue: boolean;
}

export type DateFilterPreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

export type ActiveTab = 
  | 'dashboard'
  | 'pos'
  | 'inventory'
  | 'batches_expiry'
  | 'prescriptions'
  | 'purchases'
  | 'returns'
  | 'customers'
  | 'accounting_analytics'
  | 'adjustments_audit'
  | 'rbac';

export * from './customer';

