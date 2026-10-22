import React, { useState } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  User, 
  Stethoscope, 
  Building2, 
  ArrowRight,
  X,
  Trash2
} from 'lucide-react';
import { Prescription, PrescriptionMedication } from '../../types/pharmacy';
import { PharmacyService } from '../../services/pharmacyService';
import { REGISTERED_DOCTORS } from '../pharmapulse/PharmaPulseModals';

interface PrescriptionViewProps {
  onDispenseRxInPOS: (rx: Prescription) => void;
  onDataChanged?: () => void;
}

export const PrescriptionView: React.FC<PrescriptionViewProps> = ({ onDispenseRxInPOS, onDataChanged }) => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(() => PharmacyService.getPrescriptions());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'dispensed'>('all');

  // Add Prescription Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRx, setNewRx] = useState<Partial<Prescription>>({
    prescriptionNumber: `RX-${Math.floor(10000 + Math.random() * 90000)}`,
    patientName: '',
    patientAge: 30,
    patientGender: 'Male',
    patientPhone: '',
    doctorName: '',
    doctorRegNumber: '',
    clinicHospital: '',
    diagnosis: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [rxMeds, setRxMeds] = useState<PrescriptionMedication[]>([
    { medicineName: '', dosage: '1 tab daily', frequency: '1-0-1', duration: '5 days', quantity: 1, dispensed: false }
  ]);

  const refreshList = () => {
    setPrescriptions(PharmacyService.getPrescriptions());
    if (onDataChanged) onDataChanged();
  };

  const handleAddMedRow = () => {
    setRxMeds([...rxMeds, { medicineName: '', dosage: '1 tab daily', frequency: '1-0-0', duration: '7 days', quantity: 1, dispensed: false }]);
  };

  const handleRemoveMedRow = (index: number) => {
    setRxMeds(rxMeds.filter((_, i) => i !== index));
  };

  const handleSavePrescription = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRx.patientName || !newRx.doctorName) {
      alert('Please fill out patient name and doctor name.');
      return;
    }

    const rx: Prescription = {
      id: `rx-${Date.now()}`,
      prescriptionNumber: newRx.prescriptionNumber || `RX-${Math.floor(10000 + Math.random() * 90000)}`,
      patientName: newRx.patientName,
      patientAge: Number(newRx.patientAge) || 30,
      patientGender: (newRx.patientGender as any) || 'Male',
      patientPhone: newRx.patientPhone || '',
      doctorName: newRx.doctorName,
      doctorRegNumber: newRx.doctorRegNumber || 'BMDC-GEN-TEMP',
      clinicHospital: newRx.clinicHospital || 'Hospital Dispensary',
      diagnosis: newRx.diagnosis || 'Clinical evaluation',
      date: newRx.date || new Date().toISOString().split('T')[0],
      medications: rxMeds.filter(m => m.medicineName.trim().length > 0),
      status: 'pending',
      notes: newRx.notes
    };

    PharmacyService.addPrescription(rx);
    refreshList();
    setShowAddModal(false);
  };

  const filtered = prescriptions.filter(r => {
    const matchSearch = 
      r.patientName.toLowerCase().includes(search.toLowerCase()) ||
      r.doctorName.toLowerCase().includes(search.toLowerCase()) ||
      r.prescriptionNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.diagnosis.toLowerCase().includes(search.toLowerCase());
    
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-4 md:p-6 bg-slate-100 min-h-[calc(100vh-85px)] space-y-4">
      
      {/* Header ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            <span>Prescription Register & Dispensing Pipeline</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Log physician prescriptions, track Schedule H dispensing compliance, and dispense directly to POS.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Log New Prescription</span>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by patient name, doctor, Rx number, diagnosis..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {['all', 'pending', 'dispensed'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-all ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Prescriptions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(rx => {
          const isPending = rx.status === 'pending';

          return (
            <div
              key={rx.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between hover:border-emerald-500 transition-all space-y-4"
            >
              <div>
                {/* Header info */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                        {rx.prescriptionNumber}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        isPending ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {rx.status}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mt-2 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-emerald-600" />
                      <span>{rx.patientName}</span>
                      <span className="text-xs font-normal text-slate-500">
                        ({rx.patientAge}y, {rx.patientGender})
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">Contact: {rx.patientPhone || 'Not provided'}</p>
                  </div>

                  <div className="text-right text-xs text-slate-500">
                    <span className="block font-medium text-slate-700">{rx.date}</span>
                  </div>
                </div>

                {/* Doctor & Clinic */}
                <div className="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{rx.doctorName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({rx.doctorRegNumber})</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    <span>{rx.clinicHospital}</span>
                  </div>
                  {rx.diagnosis && (
                    <div className="pt-1 text-[11px] text-slate-700 font-medium">
                      Diagnosis: <span className="italic font-normal">{rx.diagnosis}</span>
                    </div>
                  )}
                </div>

                {/* Medications List */}
                <div className="mt-3 space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Prescribed Drugs:</div>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {rx.medications.map((m, idx) => (
                      <div key={idx} className="p-2 bg-white flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-800">{m.medicineName}</span>
                          <p className="text-[10px] text-slate-500">
                            {m.dosage} • {m.frequency} • {m.duration}
                          </p>
                        </div>
                        <span className="font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                          {m.quantity} units
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {rx.notes && (
                  <p className="mt-2 text-[11px] text-slate-500 italic bg-amber-50/50 p-2 rounded border border-amber-100">
                    Note: {rx.notes}
                  </p>
                )}
              </div>

              {/* Action Bar */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {isPending ? 'Awaiting pharmacist checkout' : 'Dispensed and invoiced'}
                </span>

                {isPending && (
                  <button
                    onClick={() => onDispenseRxInPOS(rx)}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Dispense in POS</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* --- ADD PRESCRIPTION MODAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Log New Patient Prescription</h3>
                <p className="text-xs text-slate-400">Register doctor orders for POS dispensing</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePrescription} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {/* Patient details */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label className="font-bold text-slate-700">Patient Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Md. Rafiqul Islam"
                    value={newRx.patientName}
                    onChange={(e) => setNewRx({ ...newRx, patientName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Age & Gender</label>
                  <div className="flex gap-1 mt-1">
                    <input
                      type="number"
                      placeholder="Age"
                      value={newRx.patientAge}
                      onChange={(e) => setNewRx({ ...newRx, patientAge: parseInt(e.target.value) || 0 })}
                      className="w-14 px-2 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                    <select
                      value={newRx.patientGender}
                      onChange={(e) => setNewRx({ ...newRx, patientGender: e.target.value as any })}
                      className="flex-1 px-1 py-2 border border-slate-300 rounded-lg text-xs"
                    >
                      <option value="Male">M</option>
                      <option value="Female">F</option>
                      <option value="Other">O</option>
                    </select>
                  </div>
                </div>

                <div className="col-span-3">
                  <label className="font-bold text-slate-700">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+880 1711-000000"
                    value={newRx.patientPhone}
                    onChange={(e) => setNewRx({ ...newRx, patientPhone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Doctor Details */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-200">
                <div className="col-span-2">
                  <label className="font-bold text-slate-700">Quick Select Registered Doctor (BMDC)</label>
                  <select
                    onChange={(e) => {
                      const doc = REGISTERED_DOCTORS.find(d => d.id === e.target.value);
                      if (doc) {
                        setNewRx({
                          ...newRx,
                          doctorName: doc.name,
                          doctorRegNumber: doc.bmdcReg,
                          clinicHospital: doc.hospital,
                        });
                      }
                    }}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                  >
                    <option value="">-- Select Registered Doctor or Fill Below --</option>
                    {REGISTERED_DOCTORS.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.bmdcReg}) • {d.hospital}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Prescribing Doctor *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Prof. Dr. Mahbubur Rahman"
                    value={newRx.doctorName}
                    onChange={(e) => setNewRx({ ...newRx, doctorName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">BMDC Registration #</label>
                  <input
                    type="text"
                    placeholder="e.g. BMDC-A-42109"
                    value={newRx.doctorRegNumber}
                    onChange={(e) => setNewRx({ ...newRx, doctorRegNumber: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="font-bold text-slate-700">Clinic / Hospital</label>
                  <input
                    type="text"
                    placeholder="e.g. Madina Eye Hospital & Medical Center"
                    value={newRx.clinicHospital}
                    onChange={(e) => setNewRx({ ...newRx, clinicHospital: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <label className="font-bold text-slate-700">Diagnosis / Indications</label>
                  <input
                    type="text"
                    placeholder="e.g. Acute Bronchitis, Essential Hypertension"
                    value={newRx.diagnosis}
                    onChange={(e) => setNewRx({ ...newRx, diagnosis: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Medications Rows */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 uppercase tracking-wide text-[11px]">
                    Prescribed Medications
                  </span>
                  <button
                    type="button"
                    onClick={handleAddMedRow}
                    className="text-emerald-600 font-bold hover:underline flex items-center gap-1 text-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {rxMeds.map((med, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Drug name (e.g. Amoxicillin)"
                        value={med.medicineName}
                        onChange={(e) => {
                          const updated = [...rxMeds];
                          updated[idx].medicineName = e.target.value;
                          setRxMeds(updated);
                        }}
                        className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold"
                      />
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={med.quantity}
                        onChange={(e) => {
                          const updated = [...rxMeds];
                          updated[idx].quantity = parseInt(e.target.value) || 1;
                          setRxMeds(updated);
                        }}
                        className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-center"
                      />
                      {rxMeds.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMedRow(idx)}
                          className="text-slate-400 hover:text-red-500 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Dosage (e.g. 500mg)"
                        value={med.dosage}
                        onChange={(e) => {
                          const updated = [...rxMeds];
                          updated[idx].dosage = e.target.value;
                          setRxMeds(updated);
                        }}
                        className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px]"
                      />
                      <input
                        type="text"
                        placeholder="Frequency (1-0-1)"
                        value={med.frequency}
                        onChange={(e) => {
                          const updated = [...rxMeds];
                          updated[idx].frequency = e.target.value;
                          setRxMeds(updated);
                        }}
                        className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px]"
                      />
                      <input
                        type="text"
                        placeholder="Duration (5 days)"
                        value={med.duration}
                        onChange={(e) => {
                          const updated = [...rxMeds];
                          updated[idx].duration = e.target.value;
                          setRxMeds(updated);
                        }}
                        className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px]"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Save Prescription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
