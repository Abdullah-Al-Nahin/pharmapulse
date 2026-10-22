import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { PharmacyService } from '../../services/pharmacyService';
import { StockAdjustmentService } from '../../services/stockAdjustmentService';
import { AuditService } from '../../services/auditService';
import { AuditLogView } from '../audit/AuditLogView';
import { 
  StockAdjustment, 
  StockAdjustmentType, 
  ImmutableAuditLog 
} from '../../types/stockAdjustment';
import { Medicine, Batch } from '../../types/pharmacy';
import { 
  formatCurrency, 
  formatNumber, 
  formatDate, 
  getCurrentLocale 
} from '../../utils/i18nFormatter';
import {
  SlidersHorizontal,
  PlusCircle,
  History,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Eye,
  FileCode,
  ArrowRight,
  Package,
  Layers,
  MapPin,
  Calendar,
  DollarSign,
  UserCheck,
  RefreshCw,
  X,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';

interface StockAdjustmentAuditViewProps {
  initialSubTab?: 'new_adjustment' | 'history' | 'audit_trail';
}

export const StockAdjustmentAuditView: React.FC<StockAdjustmentAuditViewProps> = ({
  initialSubTab = 'audit_trail'
}) => {
  const { t } = useTranslation();
  const { currentUser, hasPermission, isSuperAdmin } = useAuth();
  const locale = getCurrentLocale();

  const [activeSubTab, setActiveSubTab] = useState<'new_adjustment' | 'history' | 'audit_trail'>(initialSubTab);

  // Medicines & Batches Data
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // Adjustments & Audit Logs Data
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [auditLogs, setAuditLogs] = useState<ImmutableAuditLog[]>([]);

  // Adjustment Form State
  const [selectedMedicineId, setSelectedMedicineId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<StockAdjustmentType>('inventory_reconciliation');
  const [direction, setDirection] = useState<'decrease' | 'increase'>('decrease');
  const [quantityInput, setQuantityInput] = useState<string>('1');
  const [reasonInput, setReasonInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // History Filters
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('all');

  // Audit Log Filters
  const [auditSearch, setAuditSearch] = useState('');
  const [auditModuleFilter, setAuditModuleFilter] = useState('all');
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');

  // Visual Diff Modal State
  const [selectedLogForDiff, setSelectedLogForDiff] = useState<ImmutableAuditLog | null>(null);
  const [copiedDiff, setCopiedDiff] = useState(false);

  // Rejection Modal State
  const [rejectionTargetAdj, setRejectionTargetAdj] = useState<StockAdjustment | null>(null);
  const [rejectionReasonText, setRejectionReasonText] = useState('');

  // Load Data
  const refreshData = () => {
    setMedicines(PharmacyService.getMedicines());
    setBatches(PharmacyService.getBatches());
    setAdjustments(StockAdjustmentService.getAdjustments());
    setAuditLogs(AuditService.getAllLogs());
  };

  useEffect(() => {
    refreshData();
    StockAdjustmentService.syncFromDB();
    const unsubscribe = StockAdjustmentService.subscribe(refreshData);
    return () => unsubscribe();
  }, []);

  // Selected Medicine and Batches
  const selectedMed = medicines.find(m => m.id === selectedMedicineId);
  const availableBatchesForMed = batches.filter(b => b.medicineId === selectedMedicineId);
  const selectedBatch = availableBatchesForMed.find(b => b.id === selectedBatchId);

  // Auto-select first batch if medicine changes
  useEffect(() => {
    if (availableBatchesForMed.length > 0 && (!selectedBatchId || !availableBatchesForMed.some(b => b.id === selectedBatchId))) {
      setSelectedBatchId(availableBatchesForMed[0].id);
    } else if (availableBatchesForMed.length === 0) {
      setSelectedBatchId('');
    }
  }, [selectedMedicineId, availableBatchesForMed]);

  // Calculations for Form
  const qty = parseInt(quantityInput, 10) || 0;
  const unitCost = selectedBatch ? (selectedBatch.purchasePrice || (selectedBatch.mrp * 0.7)) : 0;
  const totalMonetaryValue = Math.round(qty * unitCost * 100) / 100;
  const currentPhysicalStock = selectedBatch ? selectedBatch.currentStock : 0;
  const newProjectedStock = direction === 'increase' 
    ? currentPhysicalStock + qty 
    : Math.max(0, currentPhysicalStock - qty);
  const isHighValue = totalMonetaryValue > StockAdjustmentService.getApprovalThreshold();

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!selectedMedicineId || !selectedBatchId) {
      setFormError('Please select both a medicine and a specific FEFO batch.');
      return;
    }

    if (qty <= 0) {
      setFormError('Adjustment quantity must be at least 1 unit.');
      return;
    }

    if (direction === 'decrease' && qty > currentPhysicalStock) {
      setFormError(`Cannot decrease stock by ${qty}. Only ${currentPhysicalStock} units currently in batch stock.`);
      return;
    }

    if (!reasonInput.trim()) {
      setFormError('Please state the primary reason for this stock adjustment.');
      return;
    }

    try {
      const requester = {
        userId: currentUser?.id || 'usr-system',
        userName: currentUser?.name || 'Authorized Staff',
        userRole: currentUser?.roleName || currentUser?.role || 'Staff Pharmacist'
      };

      const result = StockAdjustmentService.createAdjustment({
        medicineId: selectedMedicineId,
        batchId: selectedBatchId,
        type: adjustmentType,
        direction,
        quantityAdjusted: qty,
        reason: reasonInput.trim(),
        notes: notesInput.trim() || undefined,
        requester
      });

      refreshData();

      if (result.autoApproved) {
        setFormSuccess(`Stock adjustment ${result.adjustment.adjustmentNumber} successfully applied! Current batch stock updated to ${result.adjustment.newStock} units.`);
      } else {
        setFormSuccess(`High-value adjustment ${result.adjustment.adjustmentNumber} (${formatCurrency(totalMonetaryValue, locale)}) submitted for Pharmacy Manager approval.`);
      }

      // Reset form
      setQuantityInput('1');
      setReasonInput('');
      setNotesInput('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit stock adjustment.');
    }
  };

  const handleApproveAdjustment = (adj: StockAdjustment) => {
    try {
      const approver = {
        userId: currentUser?.id || 'usr-admin',
        userName: currentUser?.name || 'Administrator',
        userRole: currentUser?.roleName || currentUser?.role || 'Pharmacy Manager'
      };
      StockAdjustmentService.approveAdjustment(adj.id, approver);
      refreshData();
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    }
  };

  const handleConfirmReject = () => {
    if (!rejectionTargetAdj) return;
    try {
      const rejector = {
        userId: currentUser?.id || 'usr-admin',
        userName: currentUser?.name || 'Administrator',
        userRole: currentUser?.roleName || currentUser?.role || 'Pharmacy Manager'
      };
      StockAdjustmentService.rejectAdjustment(rejectionTargetAdj.id, rejectionReasonText, rejector);
      setRejectionTargetAdj(null);
      setRejectionReasonText('');
      refreshData();
    } catch (err: any) {
      alert(err.message || 'Rejection failed');
    }
  };

  // Filtered History
  const filteredAdjustments = adjustments.filter(adj => {
    if (historyStatusFilter !== 'all' && adj.status !== historyStatusFilter) return false;
    if (historyTypeFilter !== 'all' && adj.type !== historyTypeFilter) return false;
    return true;
  });

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter(log => {
    if (auditModuleFilter !== 'all' && log.module !== auditModuleFilter) return false;
    if (auditActionFilter !== 'all' && log.action !== auditActionFilter) return false;
    if (auditStartDate) {
      if (new Date(log.timestamp).getTime() < new Date(auditStartDate).getTime()) return false;
    }
    if (auditEndDate) {
      if (new Date(log.timestamp).getTime() > new Date(auditEndDate).getTime() + 86400000) return false;
    }
    if (auditSearch.trim()) {
      const q = auditSearch.toLowerCase().trim();
      const match = 
        log.summary.toLowerCase().includes(q) ||
        log.targetEntityId.toLowerCase().includes(q) ||
        log.targetEntityType.toLowerCase().includes(q) ||
        log.userName.toLowerCase().includes(q) ||
        log.clientIp.toLowerCase().includes(q) ||
        log.id.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const canApprove = hasPermission('inventory:stock:adjust') || isSuperAdmin;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                {t('adjustments.title', 'Stock Adjustment Engine')}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('adjustments.subtitle', 'Controlled batch-level quantity reconciliations and immutable audit trail')}
              </p>
            </div>
          </div>
        </div>

        {/* Top Navigation SubTabs */}
        <div className="flex items-center gap-1.5 bg-slate-800/90 p-1.5 rounded-lg border border-slate-700/80">
          <button
            type="button"
            onClick={() => setActiveSubTab('new_adjustment')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeSubTab === 'new_adjustment'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('adjustments.new_adjustment', 'New Adjustment')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('history')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors relative ${
              activeSubTab === 'history'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{t('adjustments.history_approvals', 'History & Approvals')}</span>
            {adjustments.filter(a => a.status === 'pending_approval').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('audit_trail')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeSubTab === 'audit_trail'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{t('adjustments.audit_trail', 'Immutable Audit Trail')}</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: NEW ADJUSTMENT FORM */}
      {activeSubTab === 'new_adjustment' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-6">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                <span>{t('adjustments.new_adjustment', 'Initiate Controlled Stock Adjustment')}</span>
              </h2>
              <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-mono">
                Threshold: {formatCurrency(StockAdjustmentService.getApprovalThreshold(), locale)}
              </span>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2.5 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-xs text-emerald-700">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Medicine Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t('adjustments.select_medicine', '1. Select Medicine')} *
                </label>
                <select
                  value={selectedMedicineId}
                  onChange={(e) => setSelectedMedicineId(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                  required
                >
                  <option value="">-- Choose Pharmaceutical Product --</option>
                  {medicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.genericName}) — {m.category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Batch Selector (Specific Batch, Expiry, Rack) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t('adjustments.select_batch', '2. Select Specific Batch (FEFO Tracked)')} *
                </label>
                {selectedMedicineId ? (
                  availableBatchesForMed.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {availableBatchesForMed.map((b) => {
                        const isSelected = b.id === selectedBatchId;
                        return (
                          <div
                            key={b.id}
                            onClick={() => setSelectedBatchId(b.id)}
                            className={`cursor-pointer p-3 rounded-lg border text-xs transition-all ${
                              isSelected
                                ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500 text-emerald-950'
                                : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold">
                              <span>Batch: {b.batchNumber}</span>
                              <span className="px-1.5 py-0.5 rounded text-[11px] bg-white border border-slate-200">
                                Stock: {formatNumber(b.currentStock, locale)}
                              </span>
                            </div>
                            <div className="mt-1 text-slate-500 flex items-center justify-between text-[11px]">
                              <span>Exp: {formatDate(b.expiryDate, locale)}</span>
                              <span>Rack: {b.rackLocation || 'A-01'}</span>
                            </div>
                            <div className="mt-1 text-[11px] text-slate-600 font-medium">
                              Unit Cost: {formatCurrency(b.purchasePrice || (b.mrp * 0.7), locale)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                      No active batches found for this product.
                    </div>
                  )
                ) : (
                  <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-xs text-slate-400 text-center">
                    Select a medicine above to load its FEFO tracked batches.
                  </div>
                )}
              </div>

              {/* Adjustment Type & Direction */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('adjustments.adjustment_type', '3. Adjustment Type')} *
                  </label>
                  <select
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value as StockAdjustmentType)}
                    className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                  >
                    <option value="inventory_reconciliation">{t('adjustments.inventory_reconciliation', 'Inventory Count Reconciliation')}</option>
                    <option value="physical_damage">{t('adjustments.physical_damage', 'Physical Damage')}</option>
                    <option value="expired_clearance">{t('adjustments.expired_clearance', 'Expired Goods Clearance')}</option>
                    <option value="theft_loss">{t('adjustments.theft_loss', 'Theft / Pilferage / Loss')}</option>
                    <option value="quarantine">{t('adjustments.quarantine', 'Quarantine / Recalled Batch')}</option>
                    <option value="internal_usage">{t('adjustments.internal_usage', 'Internal Clinic / Hospital Usage')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('adjustments.direction', '4. Adjustment Direction')} *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDirection('decrease')}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                        direction === 'decrease'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {t('adjustments.decrease', 'Decrease (Write-off)')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection('increase')}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                        direction === 'increase'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {t('adjustments.increase', 'Increase (Surplus)')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Quantity to Adjust */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t('adjustments.quantity_to_adjust', '5. Quantity to Adjust (Units)')} *
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max={direction === 'decrease' ? currentPhysicalStock : 9999}
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(e.target.value)}
                    className="w-48 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                    required
                  />
                  {selectedBatch && direction === 'decrease' && (
                    <span className="text-xs text-slate-500">
                      Available: <strong className="text-slate-800 font-mono">{currentPhysicalStock}</strong> units
                    </span>
                  )}
                </div>
              </div>

              {/* Reason & Audit Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t('adjustments.reason', '6. Primary Reason')} *
                </label>
                <input
                  type="text"
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="e.g., Physical damage due to broken shelf, or monthly count reconciliation"
                  className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t('adjustments.notes', '7. Detailed Audit Notes / Observation')}
                </label>
                <textarea
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  rows={2}
                  placeholder="Additional context, incident report number, or batch verification notes..."
                  className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!selectedMedicineId || !selectedBatchId || qty <= 0}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold text-sm rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>{t('adjustments.submit_adjustment', 'Submit Stock Adjustment')}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Summary & Guardrail Calculation Box */}
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-white shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Adjustment Calculation Preview</span>
              </h3>

              <div className="space-y-3 text-xs divide-y divide-slate-800">
                <div className="flex justify-between items-center pt-2">
                  <span className="text-slate-400">{t('inventory.current_stock', 'Current Stock')}</span>
                  <span className="font-mono font-bold text-slate-200">{formatNumber(currentPhysicalStock, locale)} units</span>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-slate-400">{t('adjustments.quantity_to_adjust', 'Adjustment Qty')}</span>
                  <span className={`font-mono font-bold ${direction === 'decrease' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {direction === 'decrease' ? '-' : '+'}{formatNumber(qty, locale)} units
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-slate-400">{t('adjustments.new_stock', 'New Resulting Stock')}</span>
                  <span className="font-mono font-bold text-sky-400 text-sm">{formatNumber(newProjectedStock, locale)} units</span>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-slate-400">{t('adjustments.unit_cost', 'Unit Cost')}</span>
                  <span className="font-mono text-slate-200">{formatCurrency(unitCost, locale)}</span>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-700">
                  <span className="font-semibold text-slate-200">{t('adjustments.total_value', 'Total Adjustment Value')}</span>
                  <span className="font-mono text-base font-bold text-amber-400">
                    {formatCurrency(totalMonetaryValue, locale)}
                  </span>
                </div>
              </div>

              {/* Approval Guardrail Warning */}
              <div className="mt-5 pt-4 border-t border-slate-800">
                <div className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{t('adjustments.approval_threshold_notice', 'Approval Workflow Guardrail')}</span>
                </div>

                {isHighValue ? (
                  <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-lg text-amber-300 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Manager Approval Required</p>
                      <p className="text-[11px] text-amber-300/80 mt-0.5">
                        {t('adjustments.high_value_warning', 'High-Value Adjustment (Over $100.00): Requires Pharmacy Manager or Admin approval before active stock is updated.')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Within Auto-Approval Limit</p>
                      <p className="text-[11px] text-emerald-300/80 mt-0.5">
                        {t('adjustments.auto_approval_notice', 'Within Auto-Approval Threshold ($100.00 max). Stock and accounting balances will be updated immediately upon submission.')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Regulatory Compliance Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-2">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-slate-500" />
                <span>Regulatory Audit Standard</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                All quantity updates execute in an append-only transaction. An immutable audit record will log your User ID ({currentUser?.id}), Role, and before/after inventory states.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: HISTORY & APPROVALS */}
      {activeSubTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Filters Bar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Filter Status:</span>
              </div>
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden"
              >
                <option value="all">All Statuses</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={historyTypeFilter}
                onChange={(e) => setHistoryTypeFilter(e.target.value)}
                className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden"
              >
                <option value="all">All Adjustment Types</option>
                <option value="inventory_reconciliation">Count Reconciliation</option>
                <option value="physical_damage">Physical Damage</option>
                <option value="expired_clearance">Expired Goods</option>
                <option value="theft_loss">Theft / Loss</option>
                <option value="quarantine">Quarantine</option>
                <option value="internal_usage">Internal Usage</option>
              </select>
            </div>

            <div className="text-xs text-slate-500">
              Showing <strong className="text-slate-800">{filteredAdjustments.length}</strong> adjustments
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 font-semibold">
                  <th className="py-3 px-4">Adjustment #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Medicine & Batch</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Qty & Stock Change</th>
                  <th className="py-3 px-4 text-right">Value</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Requester / Approver</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAdjustments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                      No stock adjustments match the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAdjustments.map((adj) => {
                    const isPending = adj.status === 'pending_approval';
                    const isApproved = adj.status === 'approved';
                    const isRejected = adj.status === 'rejected';

                    return (
                      <tr key={adj.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {adj.adjustmentNumber}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {formatDate(adj.createdAt, locale, true)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{adj.medicineName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Batch: {adj.batchNumber} • Exp: {formatDate(adj.expiryDate, locale)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 font-medium capitalize">
                            {adj.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          <div className={`font-bold ${adj.direction === 'decrease' ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {adj.direction === 'decrease' ? '-' : '+'}{formatNumber(adj.quantityAdjusted, locale)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {formatNumber(adj.previousStock, locale)} → {formatNumber(adj.newStock, locale)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                          {formatCurrency(adj.totalMonetaryValue, locale)}
                        </td>
                        <td className="py-3 px-4">
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                              Pending Approval
                            </span>
                          )}
                          {isApproved && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Approved
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-300">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              Rejected
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-600">
                          <div>Req: <strong>{adj.requestedBy.userName}</strong></div>
                          {adj.approvedBy && (
                            <div className="text-emerald-700 mt-0.5">
                              Appr: {adj.approvedBy.userName}
                            </div>
                          )}
                          {adj.rejectedBy && (
                            <div className="text-rose-700 mt-0.5">
                              Rej: {adj.rejectedBy.userName} ({adj.rejectionReason})
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isPending && canApprove ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleApproveAdjustment(adj)}
                                className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-xs"
                                title="Approve Adjustment"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectionTargetAdj(adj)}
                                className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded shadow-xs"
                                title="Reject Adjustment"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: IMMUTABLE AUDIT TRAIL */}
      {activeSubTab === 'audit_trail' && (
        <div className="w-full">
          <AuditLogView onNavigateToAdjustment={() => setActiveSubTab('new_adjustment')} />
        </div>
      )}

      {/* VISUAL DIFF VIEWER MODAL */}
      {selectedLogForDiff && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl text-white">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-emerald-400" />
                  <span>{t('audit.visual_diff_title', 'Visual State Diff Comparison')}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Log ID: <span className="font-mono text-emerald-400">{selectedLogForDiff.id}</span> • {selectedLogForDiff.summary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLogForDiff(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Side-by-side Before / After Diff */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              {/* Diff Summary Table */}
              {selectedLogForDiff.diffSummary && selectedLogForDiff.diffSummary.length > 0 ? (
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-3.5 py-2 bg-slate-800/80 font-semibold text-slate-300 border-b border-slate-800 flex items-center justify-between">
                    <span>Field-Level Attribute Modifications</span>
                    <span className="text-[11px] text-slate-400">
                      {selectedLogForDiff.diffSummary.length} fields modified
                    </span>
                  </div>
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 bg-slate-900/50">
                        <th className="py-2 px-3">Field</th>
                        <th className="py-2 px-3 text-rose-400">Before State (Previous)</th>
                        <th className="py-2 px-3 text-emerald-400">After State (Updated)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {selectedLogForDiff.diffSummary.map((d, i) => (
                        <tr key={i} className="hover:bg-slate-900">
                          <td className="py-2 px-3 font-semibold text-sky-400">{d.field}</td>
                          <td className="py-2 px-3 bg-rose-950/20 text-rose-300">
                            <span className="line-through">{JSON.stringify(d.oldValue)}</span>
                          </td>
                          <td className="py-2 px-3 bg-emerald-950/20 text-emerald-300">
                            <span>{JSON.stringify(d.newValue)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {/* Full JSON Side-by-side comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Before State (Red highlight) */}
                <div className="border border-rose-900/40 bg-rose-950/10 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2 text-rose-400 font-semibold text-xs pb-1.5 border-b border-rose-900/30">
                    <span>{t('audit.before_state', 'Before State (Old Value)')}</span>
                    <span className="text-[10px] bg-rose-900/40 text-rose-300 px-1.5 py-0.5 rounded">PREVIOUS</span>
                  </div>
                  <pre className="text-[11px] font-mono text-rose-200/90 whitespace-pre-wrap overflow-x-auto max-h-64">
                    {selectedLogForDiff.beforeState 
                      ? JSON.stringify(selectedLogForDiff.beforeState, null, 2)
                      : '(No previous state / Entity created)'}
                  </pre>
                </div>

                {/* After State (Green highlight) */}
                <div className="border border-emerald-900/40 bg-emerald-950/10 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2 text-emerald-400 font-semibold text-xs pb-1.5 border-b border-emerald-900/30">
                    <span>{t('audit.after_state', 'After State (New Value)')}</span>
                    <span className="text-[10px] bg-emerald-900/40 text-emerald-300 px-1.5 py-0.5 rounded">NEW</span>
                  </div>
                  <pre className="text-[11px] font-mono text-emerald-200/90 whitespace-pre-wrap overflow-x-auto max-h-64">
                    {selectedLogForDiff.afterState 
                      ? JSON.stringify(selectedLogForDiff.afterState, null, 2)
                      : '(Entity deleted)'}
                  </pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedLogForDiff, null, 2));
                  setCopiedDiff(true);
                  setTimeout(() => setCopiedDiff(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
              >
                {copiedDiff ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedDiff ? 'Copied Full Audit JSON!' : 'Copy Full Audit Record'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedLogForDiff(null)}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
              >
                {t('common.close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {rejectionTargetAdj && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                <span>Reject Stock Adjustment</span>
              </h3>
              <button
                type="button"
                onClick={() => setRejectionTargetAdj(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Rejecting adjustment <strong className="font-mono">{rejectionTargetAdj.adjustmentNumber}</strong> for {rejectionTargetAdj.medicineName} ({formatCurrency(rejectionTargetAdj.totalMonetaryValue, locale)}).
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Rejection *
              </label>
              <textarea
                value={rejectionReasonText}
                onChange={(e) => setRejectionReasonText(e.target.value)}
                rows={3}
                placeholder="Specify audit rationale (e.g. physical count re-verified; discrepancy resolved)..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-rose-500"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectionTargetAdj(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectionReasonText.trim()}
                onClick={handleConfirmReject}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-lg shadow-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
