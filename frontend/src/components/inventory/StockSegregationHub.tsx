import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Trash2, 
  Tag, 
  Lock, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  FileText, 
  UserCheck, 
  Sparkles,
  Info,
  DollarSign,
  Activity,
  Layers,
  X
} from 'lucide-react';
import { 
  QuarantineRecord, 
  DamagedStockRecord, 
  BonusStockRecord, 
  ReservedStockRecord, 
  NegativeStockConfig, 
  NegativeStockOverrideAudit 
} from '../../types/inventoryAdvanced';
import { Medicine, Batch } from '../../types/pharmacy';
import { useAuth } from '../../context/AuthContext';

interface StockSegregationHubProps {
  quarantineRecords: QuarantineRecord[];
  damagedRecords: DamagedStockRecord[];
  bonusRecords: BonusStockRecord[];
  reservedRecords: ReservedStockRecord[];
  negativeStockConfig: NegativeStockConfig;
  negativeOverrides: NegativeStockOverrideAudit[];
  medicines: Medicine[];
  batches: Batch[];
  onQuarantineBatch: (med: Medicine, batch: Batch, qty: number, reason: any, details: string, pharmacist: string) => void;
  onReleaseQuarantine: (id: string, pharmacist: string, notes: string) => void;
  onLogDamagedStock: (record: any) => void;
  onAddReservedStock: (res: any) => void;
  onReleaseReservedStock: (id: string) => void;
  onToggleNegativeStockPrevention: (enabled: boolean) => void;
}

export const StockSegregationHub: React.FC<StockSegregationHubProps> = ({
  quarantineRecords,
  damagedRecords,
  bonusRecords,
  reservedRecords,
  negativeStockConfig,
  negativeOverrides,
  medicines,
  batches,
  onQuarantineBatch,
  onReleaseQuarantine,
  onLogDamagedStock,
  onAddReservedStock,
  onReleaseReservedStock,
  onToggleNegativeStockPrevention
}) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'quarantine' | 'damaged_expired' | 'bonus_stock' | 'reserved_stock' | 'negative_prevention'>('quarantine');

  // Quarantine Modal State
  const [showQuarantineModal, setShowQuarantineModal] = useState(false);
  const [selectedMedId, setSelectedMedId] = useState<string>(medicines[0]?.id || '');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [quarantineQty, setQuarantineQty] = useState<number>(5);
  const [quarantineReason, setQuarantineReason] = useState<any>('quality_inspection_pending');
  const [quarantineDetails, setQuarantineDetails] = useState('');
  const [quarantinePharmacist, setQuarantinePharmacist] = useState(currentUser?.name || 'Farhana Islam');

  // Damaged Stock Modal State
  const [showDamagedModal, setShowDamagedModal] = useState(false);
  const [dmgMedId, setDmgMedId] = useState<string>(medicines[0]?.id || '');
  const [dmgBatchId, setDmgBatchId] = useState<string>('');
  const [dmgQty, setDmgQty] = useState<number>(2);
  const [dmgType, setDmgType] = useState<any>('broken_vial_ampoule');
  const [dmgLocation, setDmgLocation] = useState('Ophthalmic Bay Rack E-01');
  const [dmgReporter, setDmgReporter] = useState('Pharmacist In-Charge');

  // Reserved Stock Modal State
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [resMedId, setResMedId] = useState<string>(medicines[0]?.id || '');
  const [resBatchId, setResBatchId] = useState<string>('');
  const [resQty, setResQty] = useState<number>(4);
  const [resFor, setResFor] = useState('OT Scheduled Cataract Surgery - Bed 201');
  const [resPatient, setResPatient] = useState('Md. Rafiqul Islam');
  const [resDoctor, setResDoctor] = useState('Prof. Dr. Mahbubur Rahman');

  // Active batches for pickers
  const availableBatchesForMed = batches.filter(b => b.medicineId === selectedMedId);
  const availableBatchesForDmg = batches.filter(b => b.medicineId === dmgMedId);
  const availableBatchesForRes = batches.filter(b => b.medicineId === resMedId && b.currentStock > 0);

  const handleCreateQuarantine = (e: React.FormEvent) => {
    e.preventDefault();
    const med = medicines.find(m => m.id === selectedMedId);
    const batch = batches.find(b => b.id === (selectedBatchId || availableBatchesForMed[0]?.id));
    if (!med || !batch) return;

    onQuarantineBatch(med, batch, quarantineQty, quarantineReason, quarantineDetails, quarantinePharmacist);
    setShowQuarantineModal(false);
    setQuarantineDetails('');
  };

  const handleCreateDamaged = (e: React.FormEvent) => {
    e.preventDefault();
    const med = medicines.find(m => m.id === dmgMedId);
    const batch = batches.find(b => b.id === (dmgBatchId || availableBatchesForDmg[0]?.id));
    if (!med || !batch) return;

    onLogDamagedStock({
      medicineId: med.id,
      medicineName: med.name,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      quantity: dmgQty,
      unitCost: batch.purchasePrice,
      totalLossValue: dmgQty * batch.purchasePrice,
      type: dmgType,
      location: dmgLocation,
      reportedBy: dmgReporter,
      disposalStatus: 'pending_disposal'
    });
    setShowDamagedModal(false);
  };

  const handleCreateReserved = (e: React.FormEvent) => {
    e.preventDefault();
    const med = medicines.find(m => m.id === resMedId);
    const batch = batches.find(b => b.id === (resBatchId || availableBatchesForRes[0]?.id));
    if (!med || !batch) return;

    onAddReservedStock({
      medicineId: med.id,
      medicineName: med.name,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      quantity: resQty,
      reservedFor: resFor,
      patientName: resPatient,
      doctorName: resDoctor,
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
    setShowReserveModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Tab Selector Ribbon */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
        {[
          { id: 'quarantine', label: 'Quarantine Vault', count: quarantineRecords.filter(r => r.status === 'quarantined').length, icon: ShieldAlert, color: 'text-purple-600' },
          { id: 'damaged_expired', label: 'Damaged & Expired Stock', count: damagedRecords.length, icon: Trash2, color: 'text-rose-600' },
          { id: 'bonus_stock', label: 'Free / Bonus Stock Ledger', count: bonusRecords.length, icon: Tag, color: 'text-amber-600' },
          { id: 'reserved_stock', label: 'Reserved Stock (Surgeries & OT)', count: reservedRecords.filter(r => r.status === 'active').length, icon: Lock, color: 'text-blue-600' },
          { id: 'negative_prevention', label: 'Negative Stock Prevention', count: negativeStockConfig.preventNegativeSales ? 'ACTIVE' : 'OFF', icon: ShieldCheck, color: 'text-emerald-600' },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap cursor-pointer transition-all ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : tab.color}`} />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 1. QUARANTINE VAULT */}
      {activeTab === 'quarantine' && (
        <div className="space-y-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-purple-600" />
                <span>Quarantine Stock Isolation Console</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Isolates defective, cold-chain compromised, or DGDA recall batches. Quarantined stock is automatically locked out of POS billing.
              </p>
            </div>

            <button
              onClick={() => setShowQuarantineModal(true)}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Quarantine a Batch</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Record #</th>
                  <th className="p-3">Medicine & Batch</th>
                  <th className="p-3">Reason for Hold</th>
                  <th className="p-3 text-right">Quarantined Qty</th>
                  <th className="p-3 text-right">Locked Capital</th>
                  <th className="p-3">Authorized Officer</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quarantineRecords.map(rec => (
                  <tr key={rec.id} className={rec.status === 'quarantined' ? 'bg-purple-50/20' : ''}>
                    <td className="p-3 font-mono font-bold text-slate-800">{rec.recordNumber}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{rec.medicineName}</div>
                      <div className="font-mono text-[11px] text-slate-500">Batch: {rec.batchNumber} (Exp: {rec.expiryDate})</div>
                    </td>
                    <td className="p-3 max-w-xs">
                      <div className="font-bold text-purple-900 capitalize">{rec.reason.replace(/_/g, ' ')}</div>
                      <div className="text-[11px] text-slate-500 truncate">{rec.reasonDetails}</div>
                    </td>
                    <td className="p-3 text-right font-extrabold text-purple-900">{rec.quantity}</td>
                    <td className="p-3 text-right font-bold text-slate-900">৳{rec.totalValue.toFixed(2)}</td>
                    <td className="p-3 text-slate-600">{rec.quarantinedBy}</td>
                    <td className="p-3 text-center">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                        rec.status === 'quarantined' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {rec.status === 'quarantined' && (
                        <button
                          onClick={() => onReleaseQuarantine(rec.id, 'Chief Pharmacist', 'Lab QC cleared - cold chain re-certified')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded text-xs font-bold cursor-pointer"
                        >
                          Release to Shelf
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. DAMAGED & EXPIRED STOCK */}
      {activeTab === 'damaged_expired' && (
        <div className="space-y-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Damaged, Expired & Write-Off Stock Registry</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Segregates expired bottles, broken ampoules, and wet blister strips for vendor debit notes or DGDA destruction.
              </p>
            </div>

            <button
              onClick={() => setShowDamagedModal(true)}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Log Damaged / Expired Item</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Incident #</th>
                  <th className="p-3">Medicine & Batch</th>
                  <th className="p-3">Incident Type</th>
                  <th className="p-3 text-right">Damaged Qty</th>
                  <th className="p-3 text-right">Financial Loss</th>
                  <th className="p-3">Location Found</th>
                  <th className="p-3 text-center">Disposal / Debit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {damagedRecords.map(dmg => (
                  <tr key={dmg.id}>
                    <td className="p-3 font-mono font-bold text-slate-800">{dmg.recordNumber}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{dmg.medicineName}</div>
                      <div className="font-mono text-[11px] text-slate-500">Batch: {dmg.batchNumber}</div>
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-rose-800 capitalize">{dmg.type.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="p-3 text-right font-black text-rose-700">{dmg.quantity}</td>
                    <td className="p-3 text-right font-extrabold text-slate-900">৳{dmg.totalLossValue.toFixed(2)}</td>
                    <td className="p-3 text-slate-600">{dmg.location}</td>
                    <td className="p-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        dmg.disposalStatus === 'vendor_debit_claimed'
                          ? 'bg-blue-100 text-blue-800'
                          : dmg.disposalStatus === 'dgda_biohazard_destroyed'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {dmg.disposalStatus.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. FREE / BONUS STOCK LEDGER */}
      {activeTab === 'bonus_stock' && (
        <div className="space-y-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-600" />
                <span>Pharmaceutical Trade Bonus & Free Stock Ledger</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Tracks manufacturer trade incentives (100+10, 50+5), bonus stock allocation, and effective unit cost dilution.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {bonusRecords.map(bon => (
              <div key={bon.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h5 className="font-bold text-sm text-slate-900">{bon.medicineName}</h5>
                    <p className="text-xs text-slate-500">Supplier: <strong className="text-slate-700">{bon.supplierName}</strong></p>
                    <p className="font-mono text-xs text-emerald-700 font-bold mt-0.5">Batch: {bon.batchNumber} • PO: {bon.poNumber}</p>
                  </div>
                  <span className="bg-amber-100 text-amber-900 text-xs font-black px-2.5 py-1 rounded-lg border border-amber-300">
                    {bon.dealRatio}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Standard Cost</span>
                    <span className="font-bold text-slate-800">৳{bon.standardPurchasePrice.toFixed(2)} / unit</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-600 block uppercase font-bold">Effective Diluted Cost</span>
                    <span className="font-black text-emerald-700">৳{bon.effectiveAverageCost.toFixed(2)} / unit</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Purchased Units</span>
                    <span className="font-bold text-slate-800">{bon.purchasedQuantity} units</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-700 block uppercase font-bold">Free Bonus Units</span>
                    <span className="font-black text-amber-800">+{bon.bonusQuantity} FREE</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <span className="text-slate-500">Remaining Bonus Stock on Hand:</span>
                  <span className="font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {bon.remainingBonusStock} Units Available
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. RESERVED STOCK CONSOLE */}
      {activeTab === 'reserved_stock' && (
        <div className="space-y-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-600" />
                <span>Reserved Stock: Operation Theatre, Surgeries & ICU Carts</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Pre-allocates stock for scheduled surgeries and hospital admissions, deducting from POS Available Stock so it cannot be accidentally sold.
              </p>
            </div>

            <button
              onClick={() => setShowReserveModal(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Reserve Stock for Surgery</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Medicine & Batch</th>
                  <th className="p-3">Reserved Purpose / Procedure</th>
                  <th className="p-3">Patient / Surgeon</th>
                  <th className="p-3 text-right">Reserved Units</th>
                  <th className="p-3">Reservation Expiry</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservedRecords.map(res => (
                  <tr key={res.id}>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{res.medicineName}</div>
                      <div className="font-mono text-[11px] text-slate-500">Batch: {res.batchNumber}</div>
                    </td>
                    <td className="p-3 font-semibold text-blue-900">{res.reservedFor}</td>
                    <td className="p-3 text-slate-700">
                      <div>{res.patientName || 'Clinical Patient'}</div>
                      <div className="text-[11px] text-slate-500">{res.doctorName}</div>
                    </td>
                    <td className="p-3 text-right font-extrabold text-blue-900">{res.quantity} units</td>
                    <td className="p-3 text-slate-600">{new Date(res.validUntil).toLocaleString()}</td>
                    <td className="p-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        res.status === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {res.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {res.status === 'active' && (
                        <button
                          onClick={() => onReleaseReservedStock(res.id)}
                          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded cursor-pointer"
                        >
                          Release Hold
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. NEGATIVE STOCK PREVENTION ENGINE */}
      {activeTab === 'negative_prevention' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl ${negativeStockConfig.preventNegativeSales ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Enterprise Negative Stock Prevention Engine</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Strictly prevents cashier checkout or ward dispensation when physically verified batch inventory is zero.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-700">
                  Enforcement Mode:
                </span>
                <button
                  onClick={() => onToggleNegativeStockPrevention(!negativeStockConfig.preventNegativeSales)}
                  className={`px-4 py-2 rounded-lg font-extrabold text-xs cursor-pointer transition-all shadow-xs ${
                    negativeStockConfig.preventNegativeSales
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  {negativeStockConfig.preventNegativeSales ? 'ACTIVE (Zero-Stock Blocked)' : 'DISABLED (Warning Only)'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <h5 className="font-bold text-slate-800">1. POS Zero-Stock Lock</h5>
                <p className="text-slate-600 text-[11px]">
                  When an item's Net Available Stock reaches 0, the POS barcode scanner and manual entry buttons are locked with a red validation banner.
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <h5 className="font-bold text-slate-800">2. Emergency Inpatient Override</h5>
                <p className="text-slate-600 text-[11px]">
                  Permits emergency bypass for ICU and emergency cataract patients only when authorized by Chief Pharmacist PIN with mandatory audit reason.
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <h5 className="font-bold text-slate-800">3. Physical Count Audit</h5>
                <p className="text-slate-600 text-[11px]">
                  Prevents inventory books from falling into negative values, ensuring 100% compliance with DGDA pharmaceutical auditing standards.
                </p>
              </div>
            </div>
          </div>

          {/* Override Audit Trail Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
            <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>Negative Stock Emergency Override Audit Trail</span>
            </h5>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Timestamp</th>
                    <th className="p-2.5">Medicine</th>
                    <th className="p-2.5 text-right">Attempted Qty</th>
                    <th className="p-2.5 text-right">Stock on Record</th>
                    <th className="p-2.5">Authorized Officer</th>
                    <th className="p-2.5">Emergency Justification</th>
                    <th className="p-2.5">Station</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {negativeOverrides.map(ovr => (
                    <tr key={ovr.id}>
                      <td className="p-2.5 text-slate-500">{new Date(ovr.timestamp).toLocaleString()}</td>
                      <td className="p-2.5 font-bold text-slate-900">{ovr.medicineName}</td>
                      <td className="p-2.5 text-right font-black text-rose-600">{ovr.attemptedQuantity}</td>
                      <td className="p-2.5 text-right font-bold text-slate-700">{ovr.availableStock}</td>
                      <td className="p-2.5 font-semibold text-emerald-800">{ovr.authorizedBy}</td>
                      <td className="p-2.5 text-slate-600 max-w-sm">{ovr.overrideReason}</td>
                      <td className="p-2.5 text-slate-500 font-medium">{ovr.station}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* QUARANTINE MODAL */}
      {showQuarantineModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Quarantine Batch for Safety Investigation</h3>
                <p className="text-xs text-slate-400">Locks stock from all POS billing terminals</p>
              </div>
              <button onClick={() => setShowQuarantineModal(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateQuarantine} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700">Select Pharmaceutical Product</label>
                <select
                  value={selectedMedId}
                  onChange={(e) => setSelectedMedId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                >
                  {medicines.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.genericName})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Select Batch</label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                >
                  {availableBatchesForMed.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.batchNumber} (Current Stock: {b.currentStock}, Exp: {b.expiryDate})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700">Quarantine Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={quarantineQty}
                    onChange={(e) => setQuarantineQty(Number(e.target.value) || 1)}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Quarantine Trigger Reason</label>
                  <select
                    value={quarantineReason}
                    onChange={(e) => setQuarantineReason(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="quality_inspection_pending">Quality Inspection Pending</option>
                    <option value="dgda_regulatory_recall">DGDA Regulatory Alert / Recall</option>
                    <option value="cold_chain_breach">Cold Chain Temperature Excursion</option>
                    <option value="packaging_compromised">Packaging Compromised</option>
                    <option value="patient_adverse_reaction">Patient Adverse Reaction Report</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">Detailed Investigation Notes *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe reason, batch temperature readings, or DGDA notification reference..."
                  value={quarantineDetails}
                  onChange={(e) => setQuarantineDetails(e.target.value)}
                  className="w-full mt-1 p-2.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuarantineModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Lock into Quarantine Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DAMAGED MODAL */}
      {showDamagedModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Log Damaged / Expired Stock</h3>
                <p className="text-xs text-slate-400">Records write-off and prepares vendor debit claims</p>
              </div>
              <button onClick={() => setShowDamagedModal(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateDamaged} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700">Select Pharmaceutical Product</label>
                <select
                  value={dmgMedId}
                  onChange={(e) => setDmgMedId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                >
                  {medicines.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Select Batch</label>
                <select
                  value={dmgBatchId}
                  onChange={(e) => setDmgBatchId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                >
                  {availableBatchesForDmg.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.batchNumber} (Stock: {b.currentStock}, Exp: {b.expiryDate})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700">Damaged Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={dmgQty}
                    onChange={(e) => setDmgQty(Number(e.target.value) || 1)}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Damage Classification</label>
                  <select
                    value={dmgType}
                    onChange={(e) => setDmgType(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="broken_vial_ampoule">Broken Vial / Ampoule</option>
                    <option value="expired_on_shelf">Expired on Shelf</option>
                    <option value="liquid_spillage">Liquid Spillage / Leak</option>
                    <option value="seal_damaged">Seal Damaged / Tampered</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDamagedModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Confirm Damaged Stock Write-off
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESERVED MODAL */}
      {showReserveModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Reserve Stock for Scheduled Eye Surgery</h3>
                <p className="text-xs text-slate-400">Holds items so they cannot be sold at OPD counter</p>
              </div>
              <button onClick={() => setShowReserveModal(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateReserved} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700">Select Pharmaceutical Product</label>
                <select
                  value={resMedId}
                  onChange={(e) => setResMedId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                >
                  {medicines.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Select Active Batch</label>
                <select
                  value={resBatchId}
                  onChange={(e) => setResBatchId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                >
                  {availableBatchesForRes.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.batchNumber} (Available: {b.currentStock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700">Reserved Units</label>
                  <input
                    type="number"
                    min="1"
                    value={resQty}
                    onChange={(e) => setResQty(Number(e.target.value) || 1)}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Patient Name</label>
                  <input
                    type="text"
                    required
                    value={resPatient}
                    onChange={(e) => setResPatient(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">Surgical Procedure / Reservation Purpose</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. OT Cataract Surgery (Phaco) - Tomorrow 10:00 AM"
                  value={resFor}
                  onChange={(e) => setResFor(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReserveModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Lock Reservation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
