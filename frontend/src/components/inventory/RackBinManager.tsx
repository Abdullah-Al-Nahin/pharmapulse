import React, { useState } from 'react';
import { 
  MapPin, 
  Snowflake, 
  ShieldCheck, 
  Boxes, 
  Layers, 
  Thermometer, 
  Plus, 
  CheckCircle2, 
  AlertTriangle,
  Move,
  Lock,
  Eye,
  Activity
} from 'lucide-react';
import { RackBinLocation, StorageZone } from '../../types/inventoryAdvanced';
import { Medicine, Batch } from '../../types/pharmacy';

interface RackBinManagerProps {
  locations: RackBinLocation[];
  medicines: Medicine[];
  batches: Batch[];
  onAddLocation: (loc: RackBinLocation) => void;
  onRelocateMedicine: (medicineId: string, newLocation: string) => void;
}

export const RackBinManager: React.FC<RackBinManagerProps> = ({
  locations,
  medicines,
  batches,
  onAddLocation,
  onRelocateMedicine
}) => {
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRelocateModal, setShowRelocateModal] = useState(false);
  
  // Relocate Form State
  const [selectedMedId, setSelectedMedId] = useState<string>(medicines[0]?.id || '');
  const [targetLocation, setTargetLocation] = useState<string>(locations[0]?.rack + ' - ' + locations[0]?.bin || '');

  // Add Location Form
  const [newLoc, setNewLoc] = useState<Partial<RackBinLocation>>({
    aisle: 'Aisle 02',
    rack: 'Rack C',
    shelf: 'Shelf 1',
    bin: 'Bin 301',
    zone: 'ambient',
    capacityUnits: 400,
    currentOccupancy: 0,
    temperatureRange: '15°C - 25°C',
    notes: ''
  });

  const filteredLocations = locations.filter(loc => {
    if (selectedZone === 'all') return true;
    return loc.zone === selectedZone;
  });

  const getZoneIcon = (zone: StorageZone) => {
    switch (zone) {
      case 'cold_chain':
        return <Snowflake className="w-4 h-4 text-sky-500" />;
      case 'ophthalmic_bay':
        return <Eye className="w-4 h-4 text-emerald-600" />;
      case 'narcotic_vault':
        return <Lock className="w-4 h-4 text-purple-600" />;
      case 'ot_emergency_cart':
        return <Activity className="w-4 h-4 text-rose-600" />;
      default:
        return <MapPin className="w-4 h-4 text-slate-500" />;
    }
  };

  const getZoneBadge = (zone: StorageZone) => {
    switch (zone) {
      case 'cold_chain':
        return <span className="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded">2°C - 8°C Cold Chain</span>;
      case 'ophthalmic_bay':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">Ophthalmic Bay</span>;
      case 'narcotic_vault':
        return <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded">Controlled Vault</span>;
      case 'ot_emergency_cart':
        return <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded">OT Emergency Cart</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded">Ambient Solid</span>;
    }
  };

  const handleCreateLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoc.rack || !newLoc.bin) return;

    const loc: RackBinLocation = {
      id: `loc-${Date.now()}`,
      aisle: newLoc.aisle || 'Aisle 01',
      rack: newLoc.rack,
      shelf: newLoc.shelf || 'Shelf 1',
      bin: newLoc.bin,
      zone: (newLoc.zone as StorageZone) || 'ambient',
      capacityUnits: Number(newLoc.capacityUnits) || 300,
      currentOccupancy: 0,
      temperatureRange: newLoc.temperatureRange || '15°C - 25°C',
      notes: newLoc.notes || ''
    };

    onAddLocation(loc);
    setShowAddModal(false);
  };

  const handleExecuteRelocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedId || !targetLocation) return;
    onRelocateMedicine(selectedMedId, targetLocation);
    setShowRelocateModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Quick Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>Warehouse Spatial Mapping: Rack / Shelf / Bin Locations</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time visual map of physical storage bays, cold chain refrigerators, ophthalmic shelves, and emergency crash carts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRelocateModal(true)}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border border-slate-300"
          >
            <Move className="w-3.5 h-3.5 text-slate-600" />
            <span>Relocate Medicine to Bin</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Storage Bin</span>
          </button>
        </div>
      </div>

      {/* Zone Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'all', label: 'All Storage Zones', icon: Boxes },
          { id: 'cold_chain', label: 'Cold Storage (2°C - 8°C)', icon: Snowflake },
          { id: 'ophthalmic_bay', label: 'Ophthalmic Bay (Drops/Ointments)', icon: Eye },
          { id: 'narcotic_vault', label: 'Controlled Safe (Double Lock)', icon: Lock },
          { id: 'ot_emergency_cart', label: 'OT Crash Carts', icon: Activity },
          { id: 'ambient', label: 'Ambient Solid Aisles', icon: MapPin }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = selectedZone === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedZone(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap cursor-pointer transition-all ${
                isActive 
                  ? 'bg-slate-900 text-white shadow-xs' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Grid of Storage Locations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredLocations.map(loc => {
          const occupancyPercent = loc.capacityUnits > 0 
            ? Math.min(100, Math.round((loc.currentOccupancy / loc.capacityUnits) * 100)) 
            : 0;

          // Find medicines stored in this location
          const storedMeds = medicines.filter(m => 
            m.rackLocation.toLowerCase().includes(loc.bin.toLowerCase()) || 
            m.rackLocation.toLowerCase().includes(loc.rack.toLowerCase())
          );

          return (
            <div 
              key={loc.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                      {getZoneIcon(loc.zone)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        {loc.aisle} • {loc.rack}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-xs font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {loc.bin}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">({loc.shelf})</span>
                      </div>
                    </div>
                  </div>
                  <div>{getZoneBadge(loc.zone)}</div>
                </div>

                <div className="mt-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1">
                      <Thermometer className="w-3 h-3 text-slate-400" />
                      Temp Spec:
                    </span>
                    <strong className="text-slate-800">{loc.temperatureRange}</strong>
                  </div>

                  {loc.notes && (
                    <p className="text-[11px] text-slate-500 italic">"{loc.notes}"</p>
                  )}
                </div>

                {/* Stored Medicines preview */}
                <div className="mt-2.5 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Stored Molecules:</span>
                  {storedMeds.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">No medicines assigned to this slot.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {storedMeds.slice(0, 3).map(m => (
                        <span key={m.id} className="text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 font-medium">
                          {m.name.split(' ')[0]} {m.strength}
                        </span>
                      ))}
                      {storedMeds.length > 3 && (
                        <span className="text-[10px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                          +{storedMeds.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Occupancy Progress Bar */}
              <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Bin Capacity Utilization</span>
                  <span className="font-bold text-slate-800">
                    {loc.currentOccupancy} / {loc.capacityUnits} units ({occupancyPercent}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      occupancyPercent > 90 
                        ? 'bg-rose-500' 
                        : occupancyPercent > 70 
                        ? 'bg-amber-500' 
                        : 'bg-emerald-500'
                    }`} 
                    style={{ width: `${occupancyPercent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Relocate Medicine Modal */}
      {showRelocateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Relocate Medicine to Bin / Shelf</h3>
                <p className="text-xs text-slate-400">Update spatial location for instant POS & picker locator</p>
              </div>
              <button onClick={() => setShowRelocateModal(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleExecuteRelocation} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700">Select Pharmaceutical Product</label>
                <select
                  value={selectedMedId}
                  onChange={(e) => setSelectedMedId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                >
                  {medicines.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} (Current: {m.rackLocation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Target Warehouse Storage Location *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ophthalmic Bay Rack E-01 or Cold Storage Fridge-1"
                  value={targetLocation}
                  onChange={(e) => setTargetLocation(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRelocateModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Confirm Bin Relocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Bin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Register Storage Bin / Shelf</h3>
                <p className="text-xs text-slate-400">Add physical location in pharmacy</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateLocation} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700">Aisle / Zone</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aisle 01, Cold Vault"
                    value={newLoc.aisle}
                    onChange={(e) => setNewLoc({ ...newLoc, aisle: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Rack / Fridge</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rack A or Fridge 1"
                    value={newLoc.rack}
                    onChange={(e) => setNewLoc({ ...newLoc, rack: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700">Shelf Tier</label>
                  <input
                    type="text"
                    placeholder="e.g. Shelf 2 or Middle Tray"
                    value={newLoc.shelf}
                    onChange={(e) => setNewLoc({ ...newLoc, shelf: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Bin / Slot Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bin 104 or Slot B-2"
                    value={newLoc.bin}
                    onChange={(e) => setNewLoc({ ...newLoc, bin: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700">Storage Zone Archetype</label>
                  <select
                    value={newLoc.zone}
                    onChange={(e) => setNewLoc({ ...newLoc, zone: e.target.value as any })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="ambient">Ambient (15°C - 25°C)</option>
                    <option value="cold_chain">Cold Chain (2°C - 8°C)</option>
                    <option value="ophthalmic_bay">Ophthalmic Bay</option>
                    <option value="narcotic_vault">Controlled Substance Safe</option>
                    <option value="ot_emergency_cart">OT Emergency Cart</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Unit Capacity</label>
                  <input
                    type="number"
                    min="10"
                    value={newLoc.capacityUnits}
                    onChange={(e) => setNewLoc({ ...newLoc, capacityUnits: Number(e.target.value) || 100 })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">Temperature Specification</label>
                <input
                  type="text"
                  placeholder="e.g. 2°C - 8°C Keep Refrigerated"
                  value={newLoc.temperatureRange}
                  onChange={(e) => setNewLoc({ ...newLoc, temperatureRange: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Save Bin Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
