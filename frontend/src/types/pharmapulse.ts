export interface PharmaCartItem {
  id: number;
  medicineId?: string;
  batchId?: string;
  name: string;
  sub: string;
  company: string;
  batch: string;
  exp: string;
  price: number;
  purchasePrice?: number; // Purchase / Procurement cost
  qty: number;
  disc: number;
  isUrgent?: boolean;
  urgentText?: string;
  // Ophthalmic, Specialty & Cold Chain extensions
  isColdChain?: boolean;
  storageTemp?: string; // e.g. '2°C - 8°C (Refrigerated)'
  isOphthalmic?: boolean;
  afterOpeningDays?: number; // e.g. 28 days for eye drops/insulin
  isRxRequired?: boolean; // DGDA Rx warning / antibiotic mandate
  genericMolecule?: string;
  dosageEn?: string; // e.g. "1 drop 3 times daily (eyes)" or "1+0+1 after meals"
  dosageBn?: string; // e.g. "১ ফোঁটা দিনে ৩ বার (চোখে)" বা "১+০+১ খাওয়ার পর"
  barcode?: string;
  strength?: string;
  stock?: number;
  // Optical / Glasses Extensions
  isNegotiable?: boolean;
  frameModel?: string;
  frameBrand?: string;
}

export interface PriceHistoryRecord {
  month: string;
  year: number;
  purchasePrice: number;
  sellingPrice: number;
  batch: string;
  supplier: string;
  date: string;
  marginPercent: number;
  note?: string;
}

export interface SmartBarcodeItem {
  barcode: string;
  brandName: string;
  genericName: string;
  strength: string;
  batch: string;
  exp: string;
  stock: number;
  sellingPrice: number;
  purchasePrice: number;
  company: string;
  isColdChain?: boolean;
  storageTemp?: string;
  isOphthalmic?: boolean;
  afterOpeningDays?: number;
  isRxRequired?: boolean;
  dosageBn?: string;
  dosageEn?: string;
}

export interface PharmacistConfirmation {
  pharmacistName: string;
  regNumber: string;
  pin: string;
  reason: string;
  patientConsented: boolean;
  timestamp: string;
}

export interface DoctorInfo {
  id: string;
  name: string;
  degrees: string;
  bmdcReg: string;
  speciality: string;
  hospital: string;
}

export interface GenericSubstituteOption {
  id: string;
  brandName: string;
  genericName: string;
  strength: string;
  company: string;
  manufacturer?: string;
  price: number;
  purchasePrice?: number;
  stock: number;
  form: string;
  batch?: string;
  exp?: string;
  isColdChain?: boolean;
  storageTemp?: string;
  isOphthalmic?: boolean;
  afterOpeningDays?: number;
  isRxRequired?: boolean;
  dosageBn?: string;
  dosageEn?: string;
}

export interface AlternativeDrug {
  id: string;
  name: string;
  company: string;
  inStock: number;
  price: number;
  unit: string;
  isActive?: boolean;
}

export interface FefoQueueItem {
  id: string;
  name: string;
  badge?: 'Urgent' | 'Priority' | 'Warning';
  daysLeft: number;
  batch: string;
  qty: number;
  unit: string;
  exp: string;
  isUrgent?: boolean;
  isColdChain?: boolean;
  price?: number;
  purchasePrice?: number;
  medicineId?: string;
  batchId?: string;
}

export type PharmaNavTab =
  | 'executive_dashboard'
  | 'pos'
  | 'command_center'
  | 'prescriptions'
  | 'inventory'
  | 'purchases'
  | 'multi_branch'
  | 'accounts'
  | 'analytics'
  | 'settings'
  | 'returns'
  | 'customers'
  | 'adjustments_audit'
  | 'batches_expiry';

// ==========================================
// --- Multi-Branch Management & IBT Types ---
// ==========================================
export type BranchId = string;

export interface BranchMetrics {
  stockCount: number;
  stockValue: number;
  todaySales: number;
  monthSales: number;
  monthlyPurchase: number;
  cashBalance: number;
  monthlyExpense: number;
  monthlyProfit: number;
  profitMargin: number;
  staffCount: number;
  activeSuppliers: number;
  registeredCustomers: number;
}

export interface BranchInfo {
  id: BranchId;
  name: string;
  bnName: string;
  code: string;
  type: 'head_office' | 'retail_branch' | 'opd_counter' | 'hospital_inpatient' | 'warehouse';
  address: string;
  phone: string;
  managerName: string;
  licenseNo: string;
  color: string;
  metrics: BranchMetrics;
}

export interface InterBranchTransferItem {
  medicineId: string;
  medicineName: string;
  strength: string;
  batchNumber: string;
  expiryDate: string;
  requestedQty: number;
  approvedQty: number;
  receivedQty: number;
  unitPrice: number;
  totalValue: number;
}

export interface InterBranchTransfer {
  id: string;
  transferNumber: string;
  requisitionNumber: string;
  fromBranchId: BranchId;
  fromBranchName: string;
  toBranchId: BranchId;
  toBranchName: string;
  requestDate: string;
  dispatchDate?: string;
  receiveDate?: string;
  status: 'REQUESTED' | 'HO_APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'REJECTED';
  urgency: 'Routine' | 'Urgent' | 'OT_Emergency';
  requestedBy: string;
  approvedBy?: string;
  receivedBy?: string;
  transferChallanNo?: string;
  coldChainVerified?: boolean;
  notes?: string;
  discrepancyNotes?: string;
  items: InterBranchTransferItem[];
}

// ==========================================
// --- Advanced Returns & Refunds Types ---
// ==========================================
export interface CreditNoteRecord {
  id: string;
  creditNoteNumber: string;
  originalInvoiceNumber: string;
  customerName: string;
  customerPhone?: string;
  issuedDate: string;
  expiryDate: string;
  totalAmount: number;
  remainingBalance: number;
  status: 'ACTIVE' | 'PARTIALLY_REDEEMED' | 'FULLY_REDEEMED' | 'EXPIRED';
  barcode: string;
  issuedBy: string;
  notes?: string;
}

export interface PurchaseReturnItemRecord {
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  unitPurchasePrice: number;
  totalAmount: number;
  reason: string;
  condition: 'sealed_expired' | 'damaged_vial' | 'leaked_blister' | 'defective_packaging';
}

export interface PurchaseReturnRecord {
  id: string;
  returnNumber: string;
  debitNoteNumber: string;
  supplierId: string;
  supplierName: string;
  originalInvoiceOrGrn: string;
  date: string;
  returnType: 'expiry_return' | 'damaged_return' | 'recall_return' | 'excess_return';
  creditAdjustmentType: 'deduct_payable' | 'bank_refund' | 'replacement_stock';
  status: 'draft' | 'approved' | 'dispatched' | 'credited';
  totalAmount: number;
  processedBy: string;
  notes?: string;
  items: PurchaseReturnItemRecord[];
}

// ==========================================
// --- Advanced Purchase Management Types ---
// ==========================================
export interface PurchaseRequisition {
  id: string;
  requisitionNumber: string;
  departmentBranch: string;
  requestedBy: string;
  requestDate: string;
  urgency: 'Normal' | 'High' | 'Emergency';
  status: 'PENDING' | 'APPROVED' | 'CONVERTED_TO_PO' | 'REJECTED';
  approvedBy?: string;
  totalEstimatedAmount: number;
  items: {
    medicineName: string;
    genericName: string;
    currentStock: number;
    requestedQty: number;
    estimatedUnitPrice: number;
    preferredSupplier: string;
    justification: string;
  }[];
}

export interface GoodsReceivedNote {
  id: string;
  grnNumber: string;
  poNumber: string;
  supplierName: string;
  challanNumber: string;
  receivedDate: string;
  receivedBy: string;
  storageLocation: string;
  coldChainTemperature?: string;
  physicalInspectionPassed: boolean;
  totalReceivedAmount: number;
  items: {
    medicineName: string;
    orderedQty: number;
    receivedQty: number;
    bonusFreeQty: number;
    damagedQty: number;
    batchNumber: string;
    mfgDate: string;
    expDate: string;
    purchasePrice: number;
    mrp: number;
  }[];
}

export interface MoleculePriceComparison {
  id: string;
  moleculeName: string;
  strengthForm: string;
  benchmarkPrice: number;
  competitors: {
    supplierName: string;
    brandName: string;
    packSize: number;
    tradePricePerPack: number;
    effectiveUnitPrice: number;
    tradeDiscountPercent: number;
    retailPrice: number;
    marginPercent: number;
    creditDays: number;
    leadTimeDays: number;
    isBestPrice: boolean;
  }[];
}

export interface SupplierPerformanceMetric {
  supplierId: string;
  supplierName: string;
  category: string;
  onTimeDeliveryRate: number; // e.g. 96.5%
  fillRatePercent: number; // e.g. 98.2%
  defectReturnRate: number; // e.g. 0.4%
  creditDaysAllowed: number;
  totalMonthlySpend: number;
  outstandingPayable: number;
  ratingGrade: 'A+' | 'A' | 'B+' | 'B';
  lastDeliveryDate: string;
}

export interface AutoPurchaseSuggestionItem {
  id: string;
  medicineName: string;
  genericName: string;
  strength: string;
  currentStock: number;
  reorderLevel: number;
  dailyConsumptionVelocity: number; // units per day
  suggestedPurchase: number;
  preferredSupplier: string;
  unitPurchasePrice: number;
  totalEstimatedCost: number;
  urgencyLevel: 'CRITICAL_OUT' | 'URGENT_REORDER' | 'ROUTINE_BUFFER';
  reason: string;
}
