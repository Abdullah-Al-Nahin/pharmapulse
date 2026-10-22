/**
 * Stock Adjustment Engine & Multi-Tier Approval Service
 * Enterprise Regulatory Controls for Physical Damage, Reconciliation, Expiry, Theft, and Internal Usage
 */

import { StockAdjustment, StockAdjustmentType } from '../types/stockAdjustment';
import { PharmacyService } from './pharmacyService';
import { AuditService } from './auditService';

const ADJUSTMENT_STORAGE_KEY = 'rx_stock_adjustments_v1';
const APPROVAL_THRESHOLD = 100.00; // Monetary value threshold in USD / 10,000 BDT

function initializeStockAdjustments(): StockAdjustment[] {
  const existing = localStorage.getItem(ADJUSTMENT_STORAGE_KEY);
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch {
      // fallback
    }
  }

  const initial: StockAdjustment[] = [
    {
      id: 'ADJ-20260908-01',
      adjustmentNumber: 'ADJ-20260908-001',
      medicineId: 'med-01',
      medicineName: 'Paracetamol 500mg',
      genericName: 'Acetaminophen',
      batchId: 'batch-01',
      batchNumber: 'PARA-2024-01',
      expiryDate: '2026-11-30',
      rackLocation: 'Rack A-01',
      type: 'physical_damage',
      direction: 'decrease',
      quantityAdjusted: 15,
      quantityChange: -15,
      previousStock: 450,
      newStock: 435,
      unitCost: 1.20,
      totalMonetaryValue: 18.00,
      reason: 'Water leakage from AC unit damaged 15 blister packs on lower shelf',
      notes: 'Logged during routine morning shelf audit. Damaged packages discarded safely.',
      status: 'approved',
      requiresApproval: false,
      requestedBy: {
        userId: 'usr-cashier-01',
        userName: 'Tanvir Ahmed',
        userRole: 'Chief Pharmacist'
      },
      approvedBy: {
        userId: 'usr-mgr-01',
        userName: 'Dr. Shahabuddin Ahmed',
        userRole: 'Pharmacy Manager',
        approvedAt: '2026-09-08T10:15:00.000Z'
      },
      createdAt: '2026-09-08T09:30:00.000Z',
      updatedAt: '2026-09-08T10:15:00.000Z'
    },
    {
      id: 'ADJ-20260908-02',
      adjustmentNumber: 'ADJ-20260908-002',
      medicineId: 'med-04',
      medicineName: 'Azithromycin 500mg',
      genericName: 'Azithromycin',
      batchId: 'batch-06',
      batchNumber: 'AZI-2024-A1',
      expiryDate: '2025-10-15',
      rackLocation: 'Rack B-02',
      type: 'inventory_reconciliation',
      direction: 'increase',
      quantityAdjusted: 20,
      quantityChange: 20,
      previousStock: 80,
      newStock: 100,
      unitCost: 6.50,
      totalMonetaryValue: 130.00,
      reason: 'Physical count surplus discovered during quarterly stock audit',
      notes: 'Unopened manufacturer box misplaced behind Vitamin rack found intact.',
      status: 'pending_approval',
      requiresApproval: true,
      requestedBy: {
        userId: 'usr-cashier-01',
        userName: 'Tanvir Ahmed',
        userRole: 'Staff Pharmacist'
      },
      createdAt: '2026-09-08T14:20:00.000Z',
      updatedAt: '2026-09-08T14:20:00.000Z'
    },
    {
      id: 'ADJ-20260907-03',
      adjustmentNumber: 'ADJ-20260907-003',
      medicineId: 'med-03',
      medicineName: 'Amoxicillin + Clavulanic Acid 625mg',
      genericName: 'Amoxicillin + Clavulanate',
      batchId: 'batch-04',
      batchNumber: 'MOX-2024-C2',
      expiryDate: '2025-08-30',
      rackLocation: 'Fridge-A (Cold Chain)',
      type: 'quarantine',
      direction: 'decrease',
      quantityAdjusted: 10,
      quantityChange: -10,
      previousStock: 120,
      newStock: 110,
      unitCost: 8.00,
      totalMonetaryValue: 80.00,
      reason: 'Temporary cold chain temperature fluctuation logged on data logger',
      notes: 'Quarantined for stability verification as per DGDA standard operating procedure.',
      status: 'approved',
      requiresApproval: false,
      requestedBy: {
        userId: 'usr-mgr-01',
        userName: 'Dr. Shahabuddin Ahmed',
        userRole: 'Pharmacy Manager'
      },
      approvedBy: {
        userId: 'user-super-admin',
        userName: 'Dr. Alexander Wright',
        userRole: 'Super Admin',
        approvedAt: '2026-09-07T11:45:00.000Z'
      },
      createdAt: '2026-09-07T11:00:00.000Z',
      updatedAt: '2026-09-07T11:45:00.000Z'
    }
  ];

  localStorage.setItem(ADJUSTMENT_STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

export class StockAdjustmentService {
  public static getApprovalThreshold(): number {
    return APPROVAL_THRESHOLD;
  }

  public static getAdjustments(): StockAdjustment[] {
    const raw = localStorage.getItem(ADJUSTMENT_STORAGE_KEY);
    if (!raw) {
      return initializeStockAdjustments();
    }
    try {
      return JSON.parse(raw);
    } catch {
      return initializeStockAdjustments();
    }
  }

  /**
   * Create a new stock adjustment request.
   * If monetary value exceeds threshold and requester is not Admin/Manager, status is pending_approval.
   * If approved immediately (under threshold or authorized), batch currentStock is updated immediately.
   */
  public static createAdjustment(params: {
    medicineId: string;
    batchId: string;
    type: StockAdjustmentType;
    direction: 'decrease' | 'increase';
    quantityAdjusted: number;
    reason: string;
    notes?: string;
    requester: {
      userId: string;
      userName: string;
      userRole: string;
    };
    forceApproval?: boolean;
  }): { adjustment: StockAdjustment; autoApproved: boolean } {
    const medicines = PharmacyService.getMedicines();
    const batches = PharmacyService.getBatches();

    const med = medicines.find(m => m.id === params.medicineId);
    const batch = batches.find(b => b.id === params.batchId);

    if (!med || !batch) {
      throw new Error('Medicine or Batch not found for adjustment.');
    }

    if (params.quantityAdjusted <= 0) {
      throw new Error('Adjustment quantity must be greater than zero.');
    }

    if (params.direction === 'decrease' && params.quantityAdjusted > batch.currentStock) {
      throw new Error(`Cannot decrease stock by ${params.quantityAdjusted}. Batch only has ${batch.currentStock} units available.`);
    }

    const unitCost = batch.purchasePrice || (batch.mrp * 0.7);
    const totalMonetaryValue = Math.round(params.quantityAdjusted * unitCost * 100) / 100;
    const requiresApproval = totalMonetaryValue > APPROVAL_THRESHOLD && !params.forceApproval;

    const quantityChange = params.direction === 'increase' ? params.quantityAdjusted : -params.quantityAdjusted;
    const previousStock = batch.currentStock;
    const newStock = previousStock + quantityChange;

    const count = this.getAdjustments().length + 1;
    const dateTag = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const adjustmentNumber = `ADJ-${dateTag}-${String(count).padStart(3, '0')}`;

    const newAdjustment: StockAdjustment = {
      id: `adj-${Date.now()}`,
      adjustmentNumber,
      medicineId: med.id,
      medicineName: med.name,
      genericName: med.genericName,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      rackLocation: batch.rackLocation || med.rackLocation || 'General Rack',
      type: params.type,
      direction: params.direction,
      quantityAdjusted: params.quantityAdjusted,
      quantityChange,
      previousStock,
      newStock,
      unitCost,
      totalMonetaryValue,
      reason: params.reason,
      notes: params.notes,
      status: requiresApproval ? 'pending_approval' : 'approved',
      requiresApproval,
      requestedBy: params.requester,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!requiresApproval) {
      newAdjustment.approvedBy = {
        userId: params.requester.userId,
        userName: params.requester.userName,
        userRole: params.requester.userRole,
        approvedAt: new Date().toISOString()
      };

      // Commit stock change immediately to Batch
      this.applyStockChangeToBatch(batch.id, newStock);

      // Record immutable audit log
      AuditService.recordAuditLog({
        userId: params.requester.userId,
        userName: params.requester.userName,
        userRole: params.requester.userRole,
        action: 'ADJUST',
        module: 'stock_adjustment',
        targetEntityId: newAdjustment.adjustmentNumber,
        targetEntityType: 'StockAdjustment',
        summary: `Auto-approved ${params.type.replace('_', ' ')} for ${med.name} (Batch ${batch.batchNumber}): ${quantityChange > 0 ? '+' : ''}${quantityChange} units`,
        beforeState: {
          batchNumber: batch.batchNumber,
          currentStock: previousStock,
          medicineName: med.name,
        },
        afterState: {
          batchNumber: batch.batchNumber,
          currentStock: newStock,
          medicineName: med.name,
          adjustmentReason: params.reason,
        }
      });
    } else {
      // Record submission audit log
      AuditService.recordAuditLog({
        userId: params.requester.userId,
        userName: params.requester.userName,
        userRole: params.requester.userRole,
        action: 'CREATE',
        module: 'stock_adjustment',
        targetEntityId: newAdjustment.adjustmentNumber,
        targetEntityType: 'StockAdjustment',
        summary: `Submitted high-value stock adjustment ($${totalMonetaryValue.toFixed(2)}) for ${med.name} (Batch ${batch.batchNumber}). Awaiting Manager Approval.`,
        beforeState: {
          batchNumber: batch.batchNumber,
          currentStock: previousStock,
          status: 'pending_approval',
        },
        afterState: {
          adjustmentNumber,
          pendingQuantityChange: quantityChange,
          totalMonetaryValue,
        }
      });
    }

    const list = this.getAdjustments();
    list.unshift(newAdjustment);
    localStorage.setItem(ADJUSTMENT_STORAGE_KEY, JSON.stringify(list));

    return {
      adjustment: newAdjustment,
      autoApproved: !requiresApproval,
    };
  }

  /**
   * Manager / Admin Approves a pending adjustment
   */
  public static approveAdjustment(
    adjustmentId: string,
    approver: { userId: string; userName: string; userRole: string }
  ): StockAdjustment {
    const list = this.getAdjustments();
    const adjIndex = list.findIndex(a => a.id === adjustmentId);

    if (adjIndex === -1) {
      throw new Error('Stock adjustment request not found.');
    }

    const adj = list[adjIndex];
    if (adj.status !== 'pending_approval') {
      throw new Error(`Cannot approve adjustment with status "${adj.status}".`);
    }

    // Check batch current stock again
    const batches = PharmacyService.getBatches();
    const batch = batches.find(b => b.id === adj.batchId);
    if (!batch) {
      throw new Error('Batch linked to this adjustment no longer exists.');
    }

    const previousStock = batch.currentStock;
    const newStock = previousStock + adj.quantityChange;

    if (newStock < 0) {
      throw new Error(`Insufficient batch stock remaining to process adjustment deduction. Current: ${previousStock}, Requested change: ${adj.quantityChange}`);
    }

    // Apply to batch
    this.applyStockChangeToBatch(batch.id, newStock);

    const updatedAdj: StockAdjustment = {
      ...adj,
      status: 'approved',
      previousStock,
      newStock,
      approvedBy: {
        userId: approver.userId,
        userName: approver.userName,
        userRole: approver.userRole,
        approvedAt: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    };

    list[adjIndex] = updatedAdj;
    localStorage.setItem(ADJUSTMENT_STORAGE_KEY, JSON.stringify(list));

    // Record Immutable Audit Log
    AuditService.recordAuditLog({
      userId: approver.userId,
      userName: approver.userName,
      userRole: approver.userRole,
      action: 'APPROVE',
      module: 'stock_adjustment',
      targetEntityId: adj.adjustmentNumber,
      targetEntityType: 'StockAdjustment',
      summary: `Approved high-value stock adjustment (${adj.adjustmentNumber}) for ${adj.medicineName} (Batch ${adj.batchNumber}). Stock updated to ${newStock}.`,
      beforeState: {
        adjustmentNumber: adj.adjustmentNumber,
        status: 'pending_approval',
        batchCurrentStock: previousStock
      },
      afterState: {
        adjustmentNumber: adj.adjustmentNumber,
        status: 'approved',
        batchCurrentStock: newStock,
        approvedBy: approver.userName
      }
    });

    return updatedAdj;
  }

  /**
   * Manager / Admin Rejects a pending adjustment
   */
  public static rejectAdjustment(
    adjustmentId: string,
    rejectionReason: string,
    rejector: { userId: string; userName: string; userRole: string }
  ): StockAdjustment {
    const list = this.getAdjustments();
    const adjIndex = list.findIndex(a => a.id === adjustmentId);

    if (adjIndex === -1) {
      throw new Error('Stock adjustment request not found.');
    }

    const adj = list[adjIndex];
    if (adj.status !== 'pending_approval') {
      throw new Error(`Cannot reject adjustment with status "${adj.status}".`);
    }

    const updatedAdj: StockAdjustment = {
      ...adj,
      status: 'rejected',
      rejectionReason: rejectionReason || 'Disapproved by manager',
      rejectedBy: {
        userId: rejector.userId,
        userName: rejector.userName,
        userRole: rejector.userRole,
        rejectedAt: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    };

    list[adjIndex] = updatedAdj;
    localStorage.setItem(ADJUSTMENT_STORAGE_KEY, JSON.stringify(list));

    // Record Immutable Audit Log
    AuditService.recordAuditLog({
      userId: rejector.userId,
      userName: rejector.userName,
      userRole: rejector.userRole,
      action: 'REJECT',
      module: 'stock_adjustment',
      targetEntityId: adj.adjustmentNumber,
      targetEntityType: 'StockAdjustment',
      summary: `Rejected stock adjustment (${adj.adjustmentNumber}) for ${adj.medicineName}. Reason: ${rejectionReason}`,
      beforeState: {
        adjustmentNumber: adj.adjustmentNumber,
        status: 'pending_approval',
      },
      afterState: {
        adjustmentNumber: adj.adjustmentNumber,
        status: 'rejected',
        rejectionReason,
        rejectedBy: rejector.userName
      }
    });

    return updatedAdj;
  }

  private static applyStockChangeToBatch(batchId: string, newStock: number): void {
    const batches = PharmacyService.getBatches();
    const batch = batches.find(b => b.id === batchId);
    if (batch) {
      batch.currentStock = Math.max(0, newStock);
      if (batch.currentStock === 0) {
        batch.status = 'depleted';
      } else if (batch.status === 'depleted' && batch.currentStock > 0) {
        batch.status = 'active';
      }
      PharmacyService.updateBatch(batch);
    }
  }
}
