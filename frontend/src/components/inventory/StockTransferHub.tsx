import React, { useState } from 'react';
import { 
  ArrowRightLeft, 
  Plus, 
  Truck, 
  CheckCircle2, 
  Clock, 
  Building, 
  Snowflake, 
  FileText, 
  ChevronRight, 
  Printer, 
  AlertCircle,
  X
} from 'lucide-react';
import { StockTransfer, StockTransferItem, TransferType } from '../../types/inventoryAdvanced';
import { Medicine, Batch } from '../../types/pharmacy';

interface StockTransferHubProps {
  transfers: StockTransfer[];
  medicines: Medicine[];
  batches: Batch[];
  onCreateTransfer: (transfer: StockTransfer) => void;
  onDispatchTransfer: (id: string, dispatcherName: string) => void;
  onReceiveTransfer: (id: string, receiverName: string) => void;
}

export const StockTransferHub: React.FC<StockTransferHubProps> = ({
  transfers,
  medicines,
  batches,
  onCreateTransfer,
  onDispatchTransfer,
  onReceiveTransfer
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'in_transit' | 'received' | 'new_transfer'>('all');
  const [selectedTransferForView, setSelectedTransferForView] = useState<StockTransfer | null>(null);

  // New Transfer Form State
  const [transferType, setTransferType] = useState<TransferType>('branch_to_branch');
  const [fromBranch, setFromBranch] = useState('Head Office (Central Depot)');
  const [toBranch, setToBranch] = useState('Dhanmondi Main Branch');
  const [isColdChain, setIsColdChain] = useState(false);
  const [transitTemp, setTransitTemp] = useState('3.8°C Insulated Cooler Bag');
  const [requestedBy, setRequestedBy] = useState('Dr. Kabir (Branch In-Charge)');
  const [notes, setNotes] = useState('');

  // Transfer Items Builder
  const [transferItems, setTransferItems] = useState<StockTransferItem[]>([]);
  const [selectedMedId, setSelectedMedId] = useState<string>(medicines[0]?.id || '');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [transferQty, setTransferQty] = useState<number>(10);

  // Available batches for selected medicine
  const availableBatchesForMed = batches.filter(b => b.medicineId === selectedMedId && b.currentStock > 0);

  const handleAddItemToTransfer = () => {
    const med = medicines.find(m => m.id === selectedMedId);
    const batch = batches.find(b => b.id === (selectedBatchId || availableBatchesForMed[0]?.id));
    if (!med || !batch) return;

    if (transferQty <= 0 || transferQty > batch.currentStock) {
      alert(`Transfer quantity must be between 1 and ${batch.currentStock}`);
      return;
    }

    const newItem: StockTransferItem = {
      id: `ti-${Date.now()}`,
      medicineId: med.id,
      medicineName: med.name,
      dosageForm: med.dosageForm,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      quantity: transferQty,
      unitCost: batch.purchasePrice,
      totalCost: transferQty * batch.purchasePrice,
      fromRackLocation: batch.rackLocation || med.rackLocation,
      toRackLocation: 'Receiving Dock / Transit Bin'
    };

    setTransferItems([...transferItems, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    setTransferItems(transferItems.filter(i => i.id !== id));
  };

  const handleSubmitTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (transferItems.length === 0) {
      alert('Please add at least one item to the transfer requisition.');
      return;
    }

    const totalUnits = transferItems.reduce((sum, i) => sum + i.quantity, 0);
    const totalValue = transferItems.reduce((sum, i) => sum + i.totalCost, 0);

    const newTransfer: StockTransfer = {
      id: `trf-${Date.now()}`,
      transferNumber: `TRF-${new Date().getFullYear()}-${String(transfers.length + 1).padStart(4, '0')}`,
      transferType,
      fromBranchId: 'br-from',
      fromBranchName: fromBranch,
      toBranchId: 'br-to',
      toBranchName: toBranch,
      status: 'requested',
      items: transferItems,
      totalUnits,
      totalValue,
      isColdChain,
      transitTemperature: isColdChain ? transitTemp : undefined,
      challanNumber: `CH-TRF-${Math.floor(1000 + Math.random() * 9000)}`,
      requestedBy,
      requestedAt: new Date().toISOString(),
      notes
    };

    onCreateTransfer(newTransfer);
    setTransferItems([]);
    setNotes('');
    setActiveSubTab('all');
  };

  const filteredTransfers = transfers.filter(t => {
    if (activeSubTab === 'in_transit') return t.status === 'in_transit';
    if (activeSubTab === 'received') return t.status === 'received';
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header & Sub-Nav */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
            <span>Stock Transfer & Branch-to-Branch Logistics Hub</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Inter-branch replenishment, departmental ward transfers, and cold-chain transport tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveSubTab('all')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${
                activeSubTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Transfers ({transfers.length})
            </button>
            <button
              onClick={() => setActiveSubTab('in_transit')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${
                activeSubTab === 'in_transit' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              In Transit ({transfers.filter(t => t.status === 'in_transit').length})
            </button>
            <button
              onClick={() => setActiveSubTab('received')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${
                activeSubTab === 'received' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Received ({transfers.filter(t => t.status === 'received').length})
            </button>
          </div>

          <button
            onClick={() => setActiveSubTab('new_transfer')}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Create Transfer</span>
          </button>
        </div>
      </div>

      {/* New Transfer Creator View */}
      {activeSubTab === 'new_transfer' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Initiate New Stock Transfer Order</h4>
              <p className="text-xs text-slate-500">Allocate batches and specify shipping route</p>
            </div>
            <button 
              onClick={() => setActiveSubTab('all')} 
              className="text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmitTransfer} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700">Transfer Type</label>
                <select
                  value={transferType}
                  onChange={(e) => setTransferType(e.target.value as any)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                >
                  <option value="branch_to_branch">Branch-to-Branch Transfer (External)</option>
                  <option value="department_transfer">Department / Ward Transfer (Internal)</option>
                  <option value="bin_relocation">Intra-Store Bin Relocation</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Origin Facility / Counter</label>
                <select
                  value={fromBranch}
                  onChange={(e) => setFromBranch(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="Head Office (Central Depot)">Head Office (Central Depot)</option>
                  <option value="Dhanmondi Main Branch">Dhanmondi Main Branch</option>
                  <option value="Mirpur Model Branch">Mirpur Model Branch</option>
                  <option value="Central Pharmacy Store">Central Pharmacy Store</option>
                  <option value="OPD Counter Ground Floor">OPD Counter Ground Floor</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Destination Facility / Ward</label>
                <select
                  value={toBranch}
                  onChange={(e) => setToBranch(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-emerald-800"
                >
                  <option value="Dhanmondi Main Branch">Dhanmondi Main Branch</option>
                  <option value="Mirpur Model Branch">Mirpur Model Branch</option>
                  <option value="Uttara Diagnostic Branch">Uttara Diagnostic Branch</option>
                  <option value="Madina Eye Hospital Inpatient Ward">Madina Eye Hospital Inpatient Ward</option>
                  <option value="Operation Theatre (OT) Emergency Cart">Operation Theatre (OT) Emergency Cart</option>
                </select>
              </div>
            </div>

            {/* Cold Chain Toggle */}
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isColdChain}
                  onChange={(e) => setIsColdChain(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <span className="font-bold text-sky-950 flex items-center gap-1.5">
                    <Snowflake className="w-3.5 h-3.5 text-sky-600" />
                    Maintain Cold Chain (2°C - 8°C Monitored Transport)
                  </span>
                  <p className="text-[11px] text-sky-700">Required for Insulins, Prostaglandin Eye Drops, and Biologics.</p>
                </div>
              </label>

              {isColdChain && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-sky-900">Transport Logger:</span>
                  <input
                    type="text"
                    value={transitTemp}
                    onChange={(e) => setTransitTemp(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-sky-300 rounded text-xs font-semibold text-sky-900"
                  />
                </div>
              )}
            </div>

            {/* Item Allocation Builder */}
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-3">
              <h5 className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
                Allocate Medicines & Batches to Transfer
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-600">Product</label>
                  <select
                    value={selectedMedId}
                    onChange={(e) => setSelectedMedId(e.target.value)}
                    className="w-full mt-0.5 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    {medicines.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.genericName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600">Available Batch</label>
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="w-full mt-0.5 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  >
                    {availableBatchesForMed.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.batchNumber} (Stock: {b.currentStock}, Exp: {b.expiryDate})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600">Quantity</label>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <input
                      type="number"
                      min="1"
                      value={transferQty}
                      onChange={(e) => setTransferQty(Number(e.target.value) || 1)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                    />
                    <button
                      type="button"
                      onClick={handleAddItemToTransfer}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer"
                    >
                      + Add Item
                    </button>
                  </div>
                </div>
              </div>

              {/* Items List */}
              {transferItems.length > 0 && (
                <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white mt-3">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                        <th className="p-2">Item</th>
                        <th className="p-2">Batch #</th>
                        <th className="p-2">Expiry</th>
                        <th className="p-2">Current Location</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Transfer Value</th>
                        <th className="p-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transferItems.map(item => (
                        <tr key={item.id}>
                          <td className="p-2 font-bold text-slate-900">{item.medicineName}</td>
                          <td className="p-2 font-mono">{item.batchNumber}</td>
                          <td className="p-2">{item.expiryDate}</td>
                          <td className="p-2 text-slate-500">{item.fromRackLocation}</td>
                          <td className="p-2 text-right font-extrabold text-emerald-800">{item.quantity}</td>
                          <td className="p-2 text-right font-medium">৳{item.totalCost.toFixed(2)}</td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-rose-600 hover:text-rose-800 font-bold"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700">Requisitioned By (Pharmacist / Doctor)</label>
                <input
                  type="text"
                  required
                  value={requestedBy}
                  onChange={(e) => setRequestedBy(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Dispatch Notes / Gate Pass Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. Deliver before 2:00 PM for OT shift"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setActiveSubTab('all')}
                className="px-4 py-2 border border-slate-300 rounded-lg font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
              >
                Generate Transfer Challan ({transferItems.length} Items)
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Transfer Orders List */}
      <div className="space-y-3">
        {filteredTransfers.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500">
            <Truck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-sm">No transfer records found</p>
          </div>
        ) : (
          filteredTransfers.map(trf => {
            const isReceived = trf.status === 'received';
            const isInTransit = trf.status === 'in_transit';

            return (
              <div 
                key={trf.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {trf.transferNumber}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">
                      Challan: {trf.challanNumber}
                    </span>
                    {trf.isColdChain && (
                      <span className="flex items-center gap-1 text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded">
                        <Snowflake className="w-3 h-3 text-sky-500" />
                        Cold Chain {trf.transitTemperature && `(${trf.transitTemperature})`}
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      isReceived 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : isInTransit 
                        ? 'bg-blue-100 text-blue-800 animate-pulse' 
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {trf.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
                    <span>{trf.fromBranchName}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-emerald-800">{trf.toBranchName}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>Total: <strong className="text-slate-800">{trf.totalUnits} units</strong></span>
                    <span>•</span>
                    <span>Value: <strong className="text-slate-800">৳{trf.totalValue.toFixed(2)}</strong></span>
                    <span>•</span>
                    <span>Requested by: {trf.requestedBy}</span>
                    {trf.receivedBy && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-700 font-medium">Received by: {trf.receivedBy}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedTransferForView(trf)}
                    className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Challan</span>
                  </button>

                  {trf.status === 'requested' && (
                    <button
                      onClick={() => onDispatchTransfer(trf.id, 'Central Warehouse Dispatcher')}
                      className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>Dispatch Order</span>
                    </button>
                  )}

                  {trf.status === 'in_transit' && (
                    <button
                      onClick={() => onReceiveTransfer(trf.id, 'Destination Pharmacist')}
                      className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Receive & Bin Stock</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Challan View Modal */}
      {selectedTransferForView && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Inter-Branch Transfer Challan / Gate Pass</h3>
                <p className="text-xs text-slate-400">{selectedTransferForView.transferNumber}</p>
              </div>
              <button onClick={() => setSelectedTransferForView(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Origin (Sender)</span>
                  <p className="font-bold text-slate-900">{selectedTransferForView.fromBranchName}</p>
                  <p className="text-[11px] text-slate-500">Requested: {new Date(selectedTransferForView.requestedAt).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Destination (Recipient)</span>
                  <p className="font-bold text-emerald-800">{selectedTransferForView.toBranchName}</p>
                  <p className="text-[11px] text-slate-500">Challan: {selectedTransferForView.challanNumber}</p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-800">Transferred Items Breakdown:</span>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2">Item</th>
                        <th className="p-2">Batch #</th>
                        <th className="p-2">Expiry</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedTransferForView.items.map(item => (
                        <tr key={item.id}>
                          <td className="p-2 font-bold text-slate-900">{item.medicineName}</td>
                          <td className="p-2 font-mono">{item.batchNumber}</td>
                          <td className="p-2">{item.expiryDate}</td>
                          <td className="p-2 text-right font-extrabold">{item.quantity}</td>
                          <td className="p-2 text-right font-semibold">৳{item.totalCost.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-200 text-xs text-slate-500">
                <div>
                  <span>Total Units: <strong className="text-slate-900">{selectedTransferForView.totalUnits}</strong></span>
                  <span className="ml-3">Total Value: <strong className="text-slate-900">৳{selectedTransferForView.totalValue.toFixed(2)}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1 bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Gate Pass</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
