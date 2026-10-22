/**
 * Stock Adjustment & Immutable Audit Logging System Types
 * Enterprise Regulatory Pharmacy ERP & Audit Trail Engine
 */

export type StockAdjustmentType = 
  | 'inventory_reconciliation'  // Physical inventory count reconciliation
  | 'physical_damage'           // Dropped, broken ampoule/bottle, wet strip
  | 'expired_clearance'         // Expired goods removal from active shelves
  | 'theft_loss'                // Pilferage or unaccounted shrinkage
  | 'quarantine'                // Quality alert or batch recall isolation
  | 'internal_usage';           // Hospital ward / clinic internal consumption

export type StockAdjustmentStatus = 
  | 'pending_approval'          // Adjustments exceeding approval threshold (> $100)
  | 'approved'                  // Approved and committed to batch stock
  | 'rejected';                 // Disapproved by Pharmacy Manager/Admin

export interface StockAdjustment {
  id: string;
  adjustmentNumber: string;     // e.g. "ADJ-20260909-001"
  medicineId: string;
  medicineName: string;
  genericName?: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  rackLocation: string;
  type: StockAdjustmentType;
  direction: 'decrease' | 'increase';
  quantityAdjusted: number;     // Absolute quantity
  quantityChange: number;       // Negative for decrease, positive for increase
  previousStock: number;
  newStock: number;
  unitCost: number;             // Batch purchase price
  totalMonetaryValue: number;   // quantityAdjusted * unitCost
  reason: string;
  notes?: string;
  status: StockAdjustmentStatus;
  requiresApproval: boolean;    // true if totalMonetaryValue > threshold
  requestedBy: {
    userId: string;
    userName: string;
    userRole: string;
  };
  approvedBy?: {
    userId: string;
    userName: string;
    userRole: string;
    approvedAt: string;
  };
  rejectionReason?: string;
  rejectedBy?: {
    userId: string;
    userName: string;
    userRole: string;
    rejectedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type AuditActionType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ADJUST'
  | 'APPROVE'
  | 'REJECT'
  | 'LOGIN'
  | 'LOGOUT'
  | 'OVERRIDE'
  | 'QUARANTINE'
  | 'VOID'
  | 'DISPENSE'
  | 'REFUND';

export type AuditModule =
  | 'stock_adjustment'
  | 'inventory'
  | 'pos'
  | 'purchases'
  | 'returns'
  | 'customers'
  | 'accounting'
  | 'rbac';

export interface ImmutableAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: AuditActionType;
  module: AuditModule;
  targetEntityId: string;
  targetEntityType: string;       // e.g. 'StockAdjustment', 'Batch', 'Sale', 'Customer'
  clientIp: string;
  userAgent?: string;
  summary: string;
  beforeState: Record<string, any> | null;
  afterState: Record<string, any> | null;
  diffSummary?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  metadata?: Record<string, any>;
}

export interface AuditLogFilterParams {
  startDate?: string;
  endDate?: string;
  module?: string;
  action?: string;
  userId?: string;
  userRole?: string;
  searchQuery?: string;
}
