import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  AlertTriangle, 
  Boxes, 
  MapPin, 
  Snowflake, 
  FileText, 
  Layers, 
  Clock, 
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  X,
  Filter,
  ArrowRightLeft,
  ShieldAlert,
  Calculator,
  ClipboardCheck,
  PackageCheck,
  Barcode,
  Sparkles
} from 'lucide-react';
import { Medicine, Batch, MedicineCategory, DosageForm, Supplier } from '../../types/pharmacy';
import { MaskedCost, PermissionGuard } from '../common/PermissionGuard';
import { usePermission } from '../../hooks/usePermission';
import { BatchStockFefoTable } from './BatchStockFefoTable';
import { inventoryApi, batchApi, supplierApi } from '../../lib/api';
import { PharmacyService } from '../../services/pharmacyService';

interface InventoryViewProps {
  onDataChanged?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ onDataChanged }) => {
  const { canViewCosts } = usePermission();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Module Tab
  const [activeModule, setActiveModule] = useState<'batch_fefo' | 'master_catalog'>('batch_fefo');

  // Search & Filter
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState<'all' | 'low_stock' | 'cold_chain' | 'rx_only'>('all');

  // Accordion expanded medicine IDs
  const [expandedMedIds, setExpandedMedIds] = useState<Set<string>>(new Set());

  // Add Medicine Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMed, setNewMed] = useState<Partial<Medicine>>({
    name: '',
    genericName: '',
    brandName: '',
    barcode: '',
    category: 'Antibiotics',
    dosageForm: 'TABLET',
    strength: '500mg',
    manufacturer: '',
    unitOfMeasure: 'Strip',
    packSize: 10,
    reorderLevel: 20,
    rackLocation: 'Rack A-01',
    requiresPrescription: true,
    isNarcoticOrSedative: false,
    taxRate: 5,
    description: ''
  });

  // Add Batch Modal
  const [batchModalMed, setBatchModalMed] = useState<Medicine | null>(null);
  const [newBatch, setNewBatch] = useState<Partial<Batch>>({
    batchNumber: '',
    manufacturingDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
    purchasePrice: 0,
    mrp: 0,
    sellingPrice: 0,
    initialQuantity: 100,
    currentStock: 100,
    status: 'active'
  });

  // Deduct Batch Modal
  const [deductModal, setDeductModal] = useState<{ batch: any; med: Medicine } | null>(null);
  const [deductForm, setDeductForm] = useState({ quantity: 1, reason: 'Wrong Entry' });

  const refreshData = async () => {
    try {
      setLoading(true);
      const [medsData, batchesData, suppliersData] = await Promise.all([
        inventoryApi.getMedicines(),
        batchApi.getBatches(),
        supplierApi.getSuppliers()
      ]);
      
      // Map backend products to frontend Medicine interface
      const mappedMeds = medsData.map((p: any) => ({
        id: p.id,
        name: p.name,
        genericName: p.generic?.name || 'Unknown',
        brandName: p.name,
        barcode: p.barcode,
        category: p.category?.name || 'Other',
        dosageForm: p.dosageForm,
        strength: p.strength,
        manufacturer: p.manufacturer?.name || 'Unknown',
        unitOfMeasure: p.unitOfMeasure,
        packSize: p.packSize,
        reorderLevel: p.reorderLevel,
        rackLocation: p.defaultRackLocation || 'Unassigned',
        requiresPrescription: p.requiresPrescription,
        isNarcoticOrSedative: p.isNarcoticOrSedative,
        taxRate: p.vatRate,
        description: p.description,
        createdAt: p.createdAt
      }));

      // Map backend batches to frontend Batch interface
      const mappedBatches = batchesData.map((b: any) => ({
        id: b.id,
        medicineId: b.productId,
        medicineName: b.product?.name || 'Unknown',
        batchNumber: b.batchNumber,
        manufacturingDate: b.manufacturingDate,
        expiryDate: b.expiryDate,
        purchasePrice: b.purchasePrice,
        mrp: b.mrp,
        sellingPrice: b.unitSellingPrice,
        initialQuantity: b.initialQuantity,
        currentStock: b.currentStock,
        status: b.status.toLowerCase(),
        supplierId: b.supplierId,
        supplierName: b.supplier?.name || 'Unknown',
        rackLocation: b.rackLocation,
      }));

      const mappedSuppliers = suppliersData.map((s: any) => ({
        ...s,
        balancePayable: Number(s.balancePayable) || 0
      }));

      setMedicines(mappedMeds);
      setBatches(mappedBatches);
      setSuppliers(mappedSuppliers);

      // Sync backend data to localStorage for PharmacyService (so POS and Purchase tabs get real-time updates)
      localStorage.setItem('rx_medicines_v1', JSON.stringify(mappedMeds));
      localStorage.setItem('rx_batches_v1', JSON.stringify(mappedBatches));
      localStorage.setItem('rx_suppliers_v1', JSON.stringify(mappedSuppliers));

      if (onDataChanged) onDataChanged();
    } catch (error) {
      console.error("Failed to load inventory data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Toggle accordion
  const toggleExpand = (id: string) => {
    const next = new Set(expandedMedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedMedIds(next);
  };

  // Calculate stock per medicine
  const medStockMap = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const map: Record<string, { totalStock: number; activeBatches: Batch[]; isLowStock: boolean }> = {};
    medicines.forEach(m => {
      const medBatches = batches.filter(b => b.medicineId === m.id);
      const nonExpiredStock = medBatches
        .filter(b => b.status !== 'expired' && b.expiryDate > todayStr)
        .reduce((sum, b) => sum + b.currentStock, 0);
      map[m.id] = {
        totalStock: nonExpiredStock,
        activeBatches: medBatches,
        isLowStock: nonExpiredStock <= m.reorderLevel
      };
    });
    return map;
  }, [medicines, batches]);

  // Filtered medicines
  const filteredMedicines = useMemo(() => {
    return medicines.filter(m => {
      const matchSearch = 
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.genericName.toLowerCase().includes(search.toLowerCase()) ||
        (m.brandName && m.brandName.toLowerCase().includes(search.toLowerCase())) ||
        (m.barcode && m.barcode.toLowerCase().includes(search.toLowerCase())) ||
        m.rackLocation.toLowerCase().includes(search.toLowerCase());

      const matchCat = categoryFilter === 'All' || m.category === categoryFilter;

      let matchFilter = true;
      if (stockFilter === 'low_stock') {
        matchFilter = (medStockMap[m.id]?.totalStock || 0) <= m.reorderLevel;
      } else if (stockFilter === 'cold_chain') {
        matchFilter = m.rackLocation.toLowerCase().includes('fridge') || m.rackLocation.toLowerCase().includes('cold');
      } else if (stockFilter === 'rx_only') {
        matchFilter = m.requiresPrescription;
      }

      return matchSearch && matchCat && matchFilter;
    });
  }, [medicines, search, categoryFilter, stockFilter, medStockMap]);

  // Submit Add Medicine
  const handleSaveMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMed.name || !newMed.genericName) {
      alert('Please fill out medicine name and generic name.');
      return;
    }

    try {
      const payload = {
        name: newMed.name,
        sku: `SKU-${Date.now()}`,
        dosageForm: newMed.dosageForm || 'TABLET',
        strength: newMed.strength || '500mg',
        unitOfMeasure: newMed.unitOfMeasure || 'Strip',
        packSize: Number(newMed.packSize) || 10,
        reorderLevel: Number(newMed.reorderLevel) || 20,
        defaultRackLocation: newMed.rackLocation || 'Rack A-01',
        requiresPrescription: !!newMed.requiresPrescription,
        isNarcoticOrSedative: !!newMed.isNarcoticOrSedative,
        vatRate: Number(newMed.taxRate) || 5,
        description: newMed.description || '',
        genericName: newMed.genericName,
        categoryName: newMed.category,
        manufacturerName: newMed.manufacturer || 'General Manufacturer',
      };

      await inventoryApi.createMedicine(payload);
      refreshData();
      setShowAddModal(false);
      setNewMed({
        name: '',
        genericName: '',
        brandName: '',
        barcode: '',
        category: 'Antibiotics',
        dosageForm: 'TABLET',
        strength: '500mg',
        manufacturer: '',
        unitOfMeasure: 'Strip',
        packSize: 10,
        reorderLevel: 20,
        rackLocation: 'Rack A-01',
        requiresPrescription: true,
        isNarcoticOrSedative: false,
        taxRate: 5,
        description: ''
      });
    } catch (e) {
      console.error("Failed to add medicine", e);
      alert("Failed to add medicine. See console.");
    }
  };

  // Submit Add Batch to existing medicine
  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchModalMed || !newBatch.batchNumber || !newBatch.expiryDate) {
      alert('Please provide batch number and expiry date.');
      return;
    }

    try {
      const payload = {
        productId: batchModalMed.id,
        batchNumber: newBatch.batchNumber,
        manufacturingDate: newBatch.manufacturingDate ? new Date(newBatch.manufacturingDate).toISOString() : new Date().toISOString(),
        expiryDate: new Date(newBatch.expiryDate).toISOString(),
        purchasePrice: Number(newBatch.purchasePrice) || 0,
        mrp: Number(newBatch.mrp) || 0,
        unitSellingPrice: Number(newBatch.sellingPrice) || 0,
        initialQuantity: Number(newBatch.initialQuantity) || 100,
        currentStock: Number(newBatch.initialQuantity) || 100,
        status: 'ACTIVE',
        rackLocation: batchModalMed.rackLocation
      };

      await batchApi.createBatch(payload);
      refreshData();
      setBatchModalMed(null);
    } catch (e) {
      console.error("Failed to add batch", e);
      alert("Failed to add batch. See console.");
    }
  };

  // Submit Stock Deduction / Write-off
  const handleDeductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deductModal) return;
    
    try {
      const quantityToDeduct = Number(deductForm.quantity);
      if (quantityToDeduct <= 0 || quantityToDeduct > deductModal.batch.currentStock) {
        alert("Invalid quantity or exceeds available stock.");
        return;
      }
      
      const newQuantity = deductModal.batch.currentStock - quantityToDeduct;
      
      // Update backend
      await batchApi.updateBatch(deductModal.batch.id, { currentStock: newQuantity });
      
      // Update local storage and create accounting entry
      PharmacyService.deductBatchStock(deductModal.batch.id, quantityToDeduct, deductForm.reason);
      
      refreshData();
      setDeductModal(null);
      setDeductForm({ quantity: 1, reason: 'Wrong Entry' });
    } catch (e) {
      console.error("Failed to deduct stock", e);
      alert("Failed to deduct stock. See console.");
    }
  };

  return (
    <div className="space-y-4 w-full">
      
      {/* Advanced Inventory Master Navigation Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
          <button
            onClick={() => setActiveModule('batch_fefo')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeModule === 'batch_fefo'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Batch Stock & FEFO</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${activeModule === 'batch_fefo' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {batches.length}
            </span>
          </button>

          <button
            onClick={() => setActiveModule('master_catalog')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeModule === 'master_catalog'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Medicine Master</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGuard permission="inventory:product:create">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add Medicine</span>
            </button>
          </PermissionGuard>
        </div>
      </div>

      {/* MODULE 1: BATCH STOCK & FEFO AUTO-PICKING */}
      {activeModule === 'batch_fefo' && (
        <BatchStockFefoTable
          medicines={medicines}
          batches={batches}
          reservedBatches={[]}
          quarantinedBatchNumbers={[]}
          bonusBatches={[]}
          onAddBatch={(med) => {
            setBatchModalMed(med);
            setNewBatch({
              batchNumber: `BAT-${Date.now().toString().slice(-4)}`,
              manufacturingDate: new Date().toISOString().split('T')[0],
              expiryDate: '',
              purchasePrice: 0,
              mrp: 0,
              sellingPrice: 0,
              initialQuantity: 100,
              currentStock: 100,
              status: 'active'
            });
          }}
          onTransferBatch={() => {}}
          onQuarantineBatch={() => {}}
          onReserveBatch={() => {}}
          onRelocateBatch={() => {}}
          onDeductBatch={(med, batch) => {
            setDeductModal({ med, batch });
          }}
        />
      )}



      {/* MODULE 7: MEDICINE MASTER CATALOG */}
      {activeModule === 'master_catalog' && (
        <div className="space-y-4">
          {/* Header ribbon */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Boxes className="w-5 h-5 text-emerald-600" />
                <span>Medicine Master & Stock Directory</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage pharmaceutical formulas, rack locations, reorder thresholds, and active batch inventories.
              </p>
            </div>

            <PermissionGuard permission="inventory:product:create">
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Medicine</span>
              </button>
            </PermissionGuard>
          </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by drug name, generic formula, brand or rack location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1 bg-slate-50 px-2 py-1.5 border border-slate-300 rounded-lg text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-transparent text-slate-800 font-medium focus:outline-none text-xs"
              >
                <option value="All">All Categories</option>
                <option value="Antibiotics">Antibiotics</option>
                <option value="Analgesics & Antipyretics">Analgesics & Antipyretics</option>
                <option value="Cardiovascular">Cardiovascular</option>
                <option value="Antidiabetic">Antidiabetic</option>
                <option value="Respiratory">Respiratory</option>
                <option value="Gastrointestinal">Gastrointestinal</option>
              </select>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto">
              {[
                { id: 'all', label: 'All Items' },
                { id: 'low_stock', label: 'Low Stock' },
                { id: 'cold_chain', label: 'Cold Storage' },
                { id: 'rx_only', label: 'Rx Required' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setStockFilter(f.id as any)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                    stockFilter === f.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Medicines Listing Table / Cards */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="divide-y divide-slate-200">
          {filteredMedicines.map(med => {
            const stockInfo = medStockMap[med.id] || { totalStock: 0, activeBatches: [], isLowStock: false };
            const isExpanded = expandedMedIds.has(med.id);
            const isColdChain = med.rackLocation.toLowerCase().includes('fridge') || med.rackLocation.toLowerCase().includes('cold');

            return (
              <div key={med.id} className="transition-colors hover:bg-slate-50/50">
                {/* Main Row */}
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{med.name}</h3>
                      {med.brandName && (
                        <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                          Brand: {med.brandName}
                        </span>
                      )}
                      <span className="text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded">
                        {med.category}
                      </span>
                      {med.requiresPrescription && (
                        <span className="text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded">
                          Rx
                        </span>
                      )}
                      {med.barcode && (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-300" title="EAN-13 / GTIN Barcode">
                          <Barcode className="w-3 h-3 text-slate-500" />
                          {med.barcode}
                        </span>
                      )}
                      {isColdChain && (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded">
                          <Snowflake className="w-3 h-3 text-sky-500" />
                          2°C-8°C
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 italic">
                      Formula: <strong className="text-slate-700 font-medium">{med.genericName}</strong> • {med.dosageForm} ({med.strength})
                    </p>

                    <div className="flex items-center gap-3 text-xs text-slate-500 pt-0.5">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        Rack: <strong className="text-slate-700">{med.rackLocation}</strong>
                      </span>
                      <span>•</span>
                      <span>Mfr: {med.manufacturer}</span>
                      <span>•</span>
                      <span>Pack: {med.packSize} / {med.unitOfMeasure}</span>
                      <span>•</span>
                      <span>Tax: {med.taxRate}%</span>
                    </div>
                  </div>

                  {/* Right: Stock Status & Controls */}
                  <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end">
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        {stockInfo.isLowStock && (
                          <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                        )}
                        <span className={`text-base font-extrabold ${
                          stockInfo.isLowStock ? 'text-amber-600' : 'text-slate-900'
                        }`}>
                          {stockInfo.totalStock} {med.unitOfMeasure}s
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Min threshold: {med.reorderLevel} | {stockInfo.activeBatches.length} batch(es)
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setBatchModalMed(med)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                      >
                        + Batch
                      </button>

                      <button
                        onClick={() => toggleExpand(med.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer"
                        title="Expand Batches"
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collapsible Batches Drawer */}
                {isExpanded && (
                  <div className="bg-slate-50/80 px-4 py-3 border-t border-slate-200">
                    <div className="flex items-center justify-between pb-2">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-500" />
                        <span>Batches for {med.name} (FEFO Ordered)</span>
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        Earliest expiring batches are automatically prioritized in POS
                      </span>
                    </div>

                    {stockInfo.activeBatches.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">No active batches recorded for this medicine.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                              <th className="py-1.5">Batch #</th>
                              <th className="py-1.5">Expiry Date</th>
                              <th className="py-1.5">Days Left</th>
                              <th className="py-1.5">Cost Price</th>
                              <th className="py-1.5">MRP</th>
                              <th className="py-1.5">Sell Price</th>
                              <th className="py-1.5 text-right">Available Stock</th>
                              <th className="py-1.5 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/60">
                            {stockInfo.activeBatches.map(b => {
                              const todayStr = new Date().toISOString().split('T')[0];
                              const isExpired = b.expiryDate <= todayStr || b.status === 'expired';
                              const daysLeft = Math.ceil((new Date(b.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

                              return (
                                <tr key={b.id} className={isExpired ? 'bg-red-50/70 text-red-900' : ''}>
                                  <td className="py-2 font-mono font-bold text-slate-800">{b.batchNumber}</td>
                                  <td className="py-2">{b.expiryDate}</td>
                                  <td className="py-2">
                                    {isExpired ? (
                                      <span className="font-bold text-red-600">Expired ({Math.abs(daysLeft)}d ago)</span>
                                    ) : (
                                      <span className={daysLeft <= 90 ? 'text-amber-600 font-semibold' : 'text-emerald-700'}>
                                        {daysLeft} days
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 text-slate-600 font-medium">
                                    <MaskedCost value={b.purchasePrice} />
                                  </td>
                                  <td className="py-2 text-slate-600">${Number(b.mrp ?? b.sellingPrice ?? 0).toFixed(2)}</td>
                                  <td className="py-2 font-bold text-slate-900">${Number(b.sellingPrice ?? 0).toFixed(2)}</td>
                                  <td className="py-2 text-right font-extrabold">{b.currentStock}</td>
                                  <td className="py-2 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                        isExpired
                                          ? 'bg-red-600 text-white'
                                          : daysLeft <= 90
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-emerald-100 text-emerald-800'
                                      }`}>
                                        {isExpired ? 'EXPIRED' : daysLeft <= 90 ? 'NEAR EXPIRY' : 'HEALTHY'}
                                      </span>
                                      {b.currentStock > 0 && (
                                        <button
                                          onClick={() => setDeductModal({ batch: b, med })}
                                          className="text-[10px] bg-red-100 hover:bg-red-200 text-red-700 px-2 py-0.5 rounded font-bold cursor-pointer transition-colors"
                                          title="Deduct or write-off stock"
                                        >
                                          Deduct
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
    )}

      {/* --- ADD MEDICINE MODAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Add New Pharmaceutical Product</h3>
                <p className="text-xs text-slate-400">Register master medicine specifications</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMedicine} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="font-bold text-slate-700">Commercial / Product Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Amoxicillin + Clavulanate 625mg"
                    value={newMed.name}
                    onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Generic / Chemical Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Amoxicillin & Potassium Clavulanate"
                    value={newMed.genericName}
                    onChange={(e) => setNewMed({ ...newMed, genericName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Brand Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g., Augmentin Duo"
                    value={newMed.brandName}
                    onChange={(e) => setNewMed({ ...newMed, brandName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Therapeutic Category</label>
                  <select
                    value={newMed.category}
                    onChange={(e) => setNewMed({ ...newMed, category: e.target.value as any })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="Antibiotics">Antibiotics</option>
                    <option value="Analgesics & Antipyretics">Analgesics & Antipyretics</option>
                    <option value="Cardiovascular">Cardiovascular</option>
                    <option value="Antidiabetic">Antidiabetic</option>
                    <option value="Respiratory">Respiratory</option>
                    <option value="Gastrointestinal">Gastrointestinal</option>
                    <option value="Dermatology">Dermatology</option>
                    <option value="Vitamins & Supplements">Vitamins & Supplements</option>
                    <option value="Ophthalmic & ENT">Ophthalmic & ENT</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Dosage Form</label>
                  <select
                    value={newMed.dosageForm}
                    onChange={(e) => setNewMed({ ...newMed, dosageForm: e.target.value as any })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="TABLET">Tablet</option>
                    <option value="CAPSULE">Capsule</option>
                    <option value="SYRUP">Syrup</option>
                    <option value="SUSPENSION">Suspension</option>
                    <option value="INJECTION">Injection</option>
                    <option value="OINTMENT_CREAM">Ointment / Cream</option>
                    <option value="EYE_EAR_DROPS">Eye / Ear Drops</option>
                    <option value="INHALER_RESPULE">Inhaler / Respule</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Strength Specification</label>
                  <input
                    type="text"
                    placeholder="e.g. 500mg, 10ml, 100mcg"
                    value={newMed.strength}
                    onChange={(e) => setNewMed({ ...newMed, strength: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700">Manufacturer / Company</label>
                    <span className="text-[10px] text-emerald-600 font-semibold">Select or type new</span>
                  </div>
                  <input
                    type="text"
                    list="registered-suppliers-list"
                    placeholder="e.g. Square Pharmaceuticals PLC, Beximco, Incepta"
                    value={newMed.manufacturer}
                    onChange={(e) => setNewMed({ ...newMed, manufacturer: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <datalist id="registered-suppliers-list">
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.companyName}>
                        {sup.companyName} ({sup.name})
                      </option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Rack / Storage Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Rack A-01 or Cold Storage"
                    value={newMed.rackLocation}
                    onChange={(e) => setNewMed({ ...newMed, rackLocation: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Reorder Alert Level</label>
                  <input
                    type="number"
                    min="1"
                    value={newMed.reorderLevel}
                    onChange={(e) => setNewMed({ ...newMed, reorderLevel: parseInt(e.target.value) || 10 })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                {/* Product Barcode / GTIN Integration */}
                <div className="col-span-2 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                      <Barcode className="w-4 h-4 text-emerald-600" />
                      <span>Product Barcode / GTIN / EAN-13 (বারকোড নম্বর)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000).toString();
                        setNewMed({ ...newMed, barcode: `890${randomDigits.slice(0, 10)}` });
                      }}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Auto Generate Barcode</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Scan with barcode gun or type EAN-13 / GTIN code..."
                      value={newMed.barcode || ''}
                      onChange={(e) => setNewMed({ ...newMed, barcode: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500">
                    <span>💡 ইউএসবি বারকোড স্ক্যানার দিয়ে ড্রাগ বক্সের বারকোড সরাসরি স্ক্যান করতে পারেন অথবা অটো-জেনারেট বাটনে ক্লিক করুন।</span>
                    {newMed.barcode && (
                      <span className="font-mono text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 shrink-0">
                        GTIN: {newMed.barcode}
                      </span>
                    )}
                  </div>
                </div>

                <div className="col-span-2 flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newMed.requiresPrescription}
                      onChange={(e) => setNewMed({ ...newMed, requiresPrescription: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-bold text-slate-800">Requires Prescription (Schedule H / Rx)</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Save Medicine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD BATCH MODAL --- */}
      {batchModalMed && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Inward Batch Entry</h3>
                <p className="text-xs text-slate-400">{batchModalMed.name}</p>
              </div>
              <button onClick={() => setBatchModalMed(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBatch} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700">Batch Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BTH-2026-901"
                  value={newBatch.batchNumber}
                  onChange={(e) => setNewBatch({ ...newBatch, batchNumber: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700">Manufacturing Date</label>
                  <input
                    type="date"
                    value={newBatch.manufacturingDate}
                    onChange={(e) => setNewBatch({ ...newBatch, manufacturingDate: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={newBatch.expiryDate}
                    onChange={(e) => setNewBatch({ ...newBatch, expiryDate: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-emerald-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-700">Cost Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newBatch.purchasePrice}
                    onChange={(e) => setNewBatch({ ...newBatch, purchasePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">MRP ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newBatch.mrp}
                    onChange={(e) => setNewBatch({ ...newBatch, mrp: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Selling Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newBatch.sellingPrice}
                    onChange={(e) => setNewBatch({ ...newBatch, sellingPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">Initial Received Quantity ({batchModalMed.unitOfMeasure}s)</label>
                <input
                  type="number"
                  min="1"
                  value={newBatch.initialQuantity}
                  onChange={(e) => setNewBatch({ ...newBatch, initialQuantity: parseInt(e.target.value) || 1 })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBatchModalMed(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Confirm Inward Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DEDUCT BATCH MODAL --- */}
      {deductModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-red-200">
            <div className="bg-red-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Deduct / Write-off Stock</h3>
                <p className="text-xs text-red-200">{deductModal.med.name} (Batch {deductModal.batch.batchNumber})</p>
              </div>
              <button onClick={() => setDeductModal(null)} className="text-red-300 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeductSubmit} className="p-5 space-y-4 text-sm">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Quantity to Deduct (Max: {deductModal.batch.currentStock})</label>
                <input
                  type="number"
                  min="1"
                  max={deductModal.batch.currentStock}
                  value={deductForm.quantity}
                  onChange={(e) => setDeductForm({ ...deductForm, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Reason for Deduction</label>
                <select
                  value={deductForm.reason}
                  onChange={(e) => setDeductForm({ ...deductForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                >
                  <option value="Damaged / Broken">Damaged / Broken</option>
                  <option value="Expired Stock Write-off">Expired Stock Write-off</option>
                  <option value="Wrong Entry">Wrong Entry / Discrepancy</option>
                  <option value="Promotional Sample">Promotional Sample</option>
                  <option value="Stolen / Lost">Stolen / Lost</option>
                </select>
              </div>

              <div className={`p-3 rounded-lg border text-xs ${deductForm.reason === 'Wrong Entry' ? 'bg-blue-50 border-blue-100 text-blue-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                <span className="font-bold">Financial Impact:</span> {deductForm.reason === 'Wrong Entry' 
                  ? `This will log a non-expense Inventory Correction of ৳${((deductForm.quantity || 0) * (deductModal.batch.purchasePrice || 0)).toFixed(2)}. It will not hit the profit & loss statement.`
                  : `Deducting this stock will automatically log an accounting expense (loss) of ৳${((deductForm.quantity || 0) * (deductModal.batch.purchasePrice || 0)).toFixed(2)} to keep your profit reports accurate.`
                }
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeductModal(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Confirm Deduction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
