export type StorageZone = 
  | 'ambient'           // Room temp 15°C - 25°C
  | 'cold_chain'        // Refrigerated 2°C - 8°C (Insulin, Eye Drops, Vaccines)
  | 'frozen'            // Deep freeze < -10°C
  | 'narcotic_vault'    // Controlled Substances / Double Lock Safe
  | 'ophthalmic_bay'    // Sterile eye drops & ointments
  | 'ot_emergency_cart'; // Operation Theatre Crash Cart

export interface RackBinLocation {
  id: string;
  aisle: string;         // e.g. "Aisle 01", "Aisle 02", "Cold Room"
  rack: string;          // e.g. "Rack A", "Rack B", "Fridge 1"
  shelf: string;         // e.g. "Shelf 1", "Shelf 2", "Tier 3"
  bin: string;           // e.g. "Bin 101", "Bin 102", "Slot B-4"
  zone: StorageZone;
  capacityUnits: number;
  currentOccupancy: number;
  temperatureRange: string;
  notes?: string;
}

export type TransferType = 
  | 'branch_to_branch'    // e.g., Central Depot to Dhanmondi Branch
  | 'department_transfer' // e.g., Main Store to Inpatient Hospital Ward
  | 'bin_relocation';     // e.g., Rack A-01 to Cold Storage Fridge-2

export type TransferStatus = 
  | 'draft'
  | 'requested'
  | 'in_transit'
  | 'received'
  | 'cancelled';

export interface StockTransferItem {
  id: string;
  medicineId: string;
  medicineName: string;
  dosageForm: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  fromRackLocation: string;
  toRackLocation: string;
}

export interface StockTransfer {
  id: string;
  transferNumber: string; // e.g. "TRF-2026-0089"
  transferType: TransferType;
  fromBranchId: string;
  fromBranchName: string;
  toBranchId: string;
  toBranchName: string;
  status: TransferStatus;
  items: StockTransferItem[];
  totalUnits: number;
  totalValue: number;
  isColdChain: boolean;
  transitTemperature?: string; // e.g. "4.2°C Cold Box Verified"
  challanNumber: string;
  requestedBy: string;
  dispatchedBy?: string;
  receivedBy?: string;
  requestedAt: string;
  dispatchedAt?: string;
  receivedAt?: string;
  notes?: string;
}

export type QuarantineReason = 
  | 'quality_inspection_pending'
  | 'dgda_regulatory_recall'
  | 'cold_chain_breach'
  | 'packaging_compromised'
  | 'patient_adverse_reaction'
  | 'suspected_counterfeit';

export interface QuarantineRecord {
  id: string;
  recordNumber: string;
  medicineId: string;
  medicineName: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  reason: QuarantineReason;
  reasonDetails: string;
  quarantinedAt: string;
  quarantinedBy: string;
  status: 'quarantined' | 'released' | 'condemned_disposal';
  releasedAt?: string;
  releasedBy?: string;
  releaseNotes?: string;
}

export type DamageType = 
  | 'expired_on_shelf'
  | 'broken_vial_ampoule'
  | 'liquid_spillage'
  | 'seal_damaged'
  | 'temperature_excursion_loss';

export interface DamagedStockRecord {
  id: string;
  recordNumber: string;
  medicineId: string;
  medicineName: string;
  batchId: string;
  batchNumber: string;
  quantity: number;
  unitCost: number;
  totalLossValue: number;
  type: DamageType;
  location: string;
  reportedAt: string;
  reportedBy: string;
  disposalStatus: 'pending_disposal' | 'vendor_debit_claimed' | 'dgda_biohazard_destroyed';
  certificateNumber?: string;
  vendorCreditNote?: string;
}

export interface BonusStockRecord {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  dealRatio: string; // e.g. "100 + 10 Free (10%)"
  purchasedQuantity: number;
  bonusQuantity: number;
  standardPurchasePrice: number;
  effectiveAverageCost: number; // Diluted cost per unit
  remainingBonusStock: number;
  receivedDate: string;
  notes?: string;
}

export interface ReservedStockRecord {
  id: string;
  medicineId: string;
  medicineName: string;
  batchId: string;
  batchNumber: string;
  quantity: number;
  reservedFor: string; // e.g. "OT Cataract Surgery - Dr. Mahbub", "ICU Crash Trolley Bed 3"
  patientName?: string;
  doctorName?: string;
  reservedAt: string;
  validUntil: string;
  status: 'active' | 'dispensed' | 'released';
}

export interface NegativeStockConfig {
  preventNegativeSales: boolean; // Enforce zero-stock block
  allowEmergencyOverride: boolean;
  requireSupervisorPin: boolean;
}

export interface NegativeStockOverrideAudit {
  id: string;
  timestamp: string;
  medicineId: string;
  medicineName: string;
  attemptedQuantity: number;
  availableStock: number;
  authorizedBy: string;
  overrideReason: string;
  station: string;
}

export type FSNCategory = 'F' | 'S' | 'N'; // Fast, Slow, Non-Moving (Dead)

export interface FSNAnalysisItem {
  medicineId: string;
  medicineName: string;
  genericName: string;
  category: string;
  currentStock: number;
  unitOfMeasure: string;
  purchasePrice: number;
  sellingPrice: number;
  totalStockValue: number;
  dailyVelocity: number; // units sold/day
  monthlySalesUnits: number;
  daysOfInventoryRemaining: number;
  daysWithoutSale: number;
  fsnCategory: FSNCategory;
  isDeadStock: boolean;
  liquidationAction?: string;
}

export interface EOQCalculation {
  medicineId: string;
  medicineName: string;
  annualDemandUnits: number; // D
  orderingCostPerOrder: number; // S (e.g. 350 BDT)
  unitPurchasePrice: number;
  holdingCostPercent: number; // e.g. 20%
  holdingCostPerUnitYear: number; // H = unitPurchasePrice * holdingCostPercent
  eoqUnits: number; // sqrt((2*D*S)/H)
  optimalOrdersPerYear: number;
  cycleTimeDays: number;
  totalAnnualHoldingCost: number;
  totalAnnualOrderingCost: number;
  totalAnnualInventoryCost: number;
  leadTimeDays: number;
  safetyStockUnits: number;
  reorderPoint: number; // (Daily Demand * Lead Time) + Safety Stock
  minStock: number;
  maxStock: number;
}

export interface StockAgingBucket {
  bracket: '0-30 days' | '31-60 days' | '61-90 days' | '91-180 days' | '>180 days';
  itemCount: number;
  totalQuantity: number;
  totalValuation: number;
  percentageOfInventory: number;
  riskLevel: 'low' | 'moderate' | 'elevated' | 'critical';
}

export interface StockValuationComparison {
  valuationDate: string;
  totalItemsTracked: number;
  totalUnitsInStock: number;
  fifoValuation: number;
  weightedAverageValuation: number;
  varianceAmount: number;
  variancePercent: number;
  retailValueMRP: number;
  unrealizedGrossMarginFIFO: number;
  unrealizedGrossMarginWAC: number;
}
