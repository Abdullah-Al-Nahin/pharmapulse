import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  GitCompare,
  ArrowRightLeft,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  PackageCheck,
  AlertTriangle,
  Eye,
  FileText,
  Printer,
  ShieldCheck,
  DollarSign,
  Users,
  Store,
  Layers,
  ArrowUpRight,
  Sparkles,
  ThermometerSnowflake,
  X,
  Edit2,
  Trash2,
  MapPin,
  Phone,
  UserCheck
} from 'lucide-react';
import {
  BranchId,
  BranchInfo,
  InterBranchTransfer,
} from '../../types/pharmapulse';
import { BranchService } from '../../services/branchService';
import { PharmacyService } from '../../services/pharmacyService';
import { transferApi } from '../../lib/api';

const IBT_STORAGE_KEY = 'pharmerp_ibt_transfers_db_v3';

interface MultiBranchHubProps {
  currentBranchId?: BranchId;
  onSelectBranch?: (branchId: BranchId) => void;
  onOpenPosForBranch?: (branchId: BranchId) => void;
}

export const MultiBranchHub: React.FC<MultiBranchHubProps> = ({
  currentBranchId,
  onSelectBranch,
  onOpenPosForBranch,
}) => {
  // Load branches from BranchService with live computed metrics
  const [branches, setBranches] = useState<BranchInfo[]>(() => BranchService.getEnrichedBranches());
  const [selectedBranchId, setSelectedBranchId] = useState<BranchId | 'all'>(() => {
    if (currentBranchId) return currentBranchId;
    const initial = BranchService.getBranches();
    return initial.length > 0 ? initial[0].id : 'all';
  });

  const [transfers, setTransfers] = useState<InterBranchTransfer[]>(() => {
    try {
      const saved = localStorage.getItem(IBT_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  useEffect(() => {
    transferApi.getTransfers().then((dbTransfers) => {
      if (Array.isArray(dbTransfers) && dbTransfers.length > 0) {
        const mapped: InterBranchTransfer[] = dbTransfers.map((t: any) => ({
          id: t.id,
          transferNumber: t.transferNumber,
          requisitionNumber: t.challanNumber || `TRQ-${t.id.slice(-4)}`,
          fromBranchId: t.fromBranchId,
          fromBranchName: t.fromBranchName,
          toBranchId: t.toBranchId,
          toBranchName: t.toBranchName,
          requestDate: t.requestedAt ? new Date(t.requestedAt).toLocaleString() : new Date().toLocaleString(),
          dispatchDate: t.dispatchedAt ? new Date(t.dispatchedAt).toLocaleString() : undefined,
          receiveDate: t.receivedAt ? new Date(t.receivedAt).toLocaleString() : undefined,
          status: (t.status || 'REQUESTED').toUpperCase(),
          urgency: 'Routine',
          requestedBy: t.requestedBy || 'Branch Dispenser',
          dispatchedBy: t.dispatchedBy,
          receivedBy: t.receivedBy,
          transferChallanNo: t.challanNumber,
          coldChainVerified: Boolean(t.isColdChain),
          notes: t.notes,
          items: Array.isArray(t.items) ? t.items.map((it: any) => ({
            medicineId: it.medicineId || 'med-01',
            medicineName: it.medicineName || 'Medicine',
            strength: it.strength || '',
            batchNumber: it.batchNumber || 'BAT-01',
            expiryDate: it.expiryDate || '12/2026',
            requestedQty: it.quantity || 10,
            approvedQty: it.quantity || 10,
            receivedQty: it.quantity || 10,
            unitPrice: it.unitPrice || 100,
            totalValue: it.totalCost || (it.quantity ? it.quantity * 100 : 1000)
          })) : []
        }));
        setTransfers(mapped);
        try {
          localStorage.setItem(IBT_STORAGE_KEY, JSON.stringify(mapped));
        } catch {}
      }
    }).catch(() => {});
  }, []);

  // Sub-tabs: 'overview' | 'transfers' | 'comparison'
  const [subTab, setSubTab] = useState<'overview' | 'transfers' | 'comparison'>('overview');

  // Filter state
  const [transferFilter, setTransferFilter] = useState<'ALL' | 'REQUESTED' | 'IN_TRANSIT' | 'RECEIVED'>('ALL');
  const [searchTransfer, setSearchTransfer] = useState('');

  // Modals state
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchInfo | null>(null);
  const [showNewTransferModal, setShowNewTransferModal] = useState(false);
  const [viewingTransfer, setViewingTransfer] = useState<InterBranchTransfer | null>(null);

  // New Branch Form state
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchBnName, setNewBranchBnName] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newBranchType, setNewBranchType] = useState<BranchInfo['type']>('retail_branch');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('');
  const [newBranchManager, setNewBranchManager] = useState('');
  const [newBranchLicense, setNewBranchLicense] = useState('');
  const [newBranchColor, setNewBranchColor] = useState('border-emerald-500 text-emerald-400 bg-emerald-500/10');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Transfer form state
  const [fromBranch, setFromBranch] = useState<BranchId>('');
  const [toBranch, setToBranch] = useState<BranchId>('');
  const [urgency, setUrgency] = useState<'Routine' | 'Urgent' | 'OT_Emergency'>('Urgent');
  const [medName, setMedName] = useState('Moxifloxacin 0.5% Eye Drops');
  const [strength, setStrength] = useState('5ml Solution');
  const [batchNo, setBatchNo] = useState('AR-9932');
  const [qty, setQty] = useState(40);
  const [notes, setNotes] = useState('');

  // Refresh helper
  const reloadData = () => {
    const fresh = BranchService.getEnrichedBranches();
    setBranches(fresh);
    if (selectedBranchId !== 'all' && !fresh.some((b) => b.id === selectedBranchId)) {
      setSelectedBranchId(fresh.length > 0 ? fresh[0].id : 'all');
    }
  };

  // Subscribe to updates from BranchService and PharmacyService
  useEffect(() => {
    const unsubBranches = BranchService.subscribe(reloadData);
    const unsubPharmacy = PharmacyService.subscribe(reloadData);
    return () => {
      unsubBranches();
      unsubPharmacy();
    };
  }, [selectedBranchId]);

  // Set default from/to branch for transfers when branches load
  useEffect(() => {
    if (branches.length >= 2) {
      if (!fromBranch) setFromBranch(branches[0].id);
      if (!toBranch) setToBranch(branches[1].id);
    } else if (branches.length === 1) {
      if (!fromBranch) setFromBranch(branches[0].id);
      if (!toBranch) setToBranch(branches[0].id);
    }
  }, [branches.length, fromBranch, toBranch]);

  // Active branch resolution
  const activeBranch = useMemo(() => {
    if (branches.length === 0) return null;
    return branches.find((b) => b.id === selectedBranchId) || branches[0];
  }, [branches, selectedBranchId]);

  // Aggregated Consolidated Metrics across all branches
  const consolidatedMetrics = useMemo(() => {
    return BranchService.computeMetricsForBranch('all');
  }, [branches]);

  const handleSelectBranch = (bId: BranchId | 'all') => {
    setSelectedBranchId(bId);
    if (bId !== 'all' && onSelectBranch) {
      onSelectBranch(bId);
    }
  };

  // Add Branch Handler
  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim() || !newBranchCode.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Branch Name and Unique Code are required.' });
      return;
    }

    // Check duplicate code
    const existing = branches.find((b) => b.code.toUpperCase() === newBranchCode.trim().toUpperCase());
    if (existing) {
      setFeedbackMsg({ type: 'error', text: `Branch code '${newBranchCode.toUpperCase()}' is already used by ${existing.name}.` });
      return;
    }

    const created = BranchService.addBranch({
      name: newBranchName,
      bnName: newBranchBnName || newBranchName,
      code: newBranchCode,
      type: newBranchType,
      address: newBranchAddress,
      phone: newBranchPhone,
      managerName: newBranchManager,
      licenseNo: newBranchLicense,
      color: newBranchColor,
    });

    setFeedbackMsg({ type: 'success', text: `Branch '${created.name}' (${created.code}) created successfully!` });
    setShowAddBranchModal(false);
    setSelectedBranchId(created.id);
    resetForm();

    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Update Branch Handler
  const handleUpdateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;

    BranchService.updateBranch(editingBranch.id, {
      name: newBranchName,
      bnName: newBranchBnName || newBranchName,
      code: newBranchCode.toUpperCase(),
      type: newBranchType,
      address: newBranchAddress,
      phone: newBranchPhone,
      managerName: newBranchManager,
      licenseNo: newBranchLicense,
      color: newBranchColor,
    });

    setFeedbackMsg({ type: 'success', text: `Branch '${newBranchName}' updated!` });
    setEditingBranch(null);
    resetForm();
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleStartEdit = (branch: BranchInfo) => {
    setEditingBranch(branch);
    setNewBranchName(branch.name);
    setNewBranchBnName(branch.bnName);
    setNewBranchCode(branch.code);
    setNewBranchType(branch.type);
    setNewBranchAddress(branch.address);
    setNewBranchPhone(branch.phone);
    setNewBranchManager(branch.managerName);
    setNewBranchLicense(branch.licenseNo);
    setNewBranchColor(branch.color);
  };

  const handleDeleteBranch = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete branch '${name}'? All tagged records will remain in ledger.`)) {
      BranchService.deleteBranch(id);
      setFeedbackMsg({ type: 'success', text: `Branch '${name}' removed.` });
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  const resetForm = () => {
    setNewBranchName('');
    setNewBranchBnName('');
    setNewBranchCode('');
    setNewBranchType('retail_branch');
    setNewBranchAddress('');
    setNewBranchPhone('');
    setNewBranchManager('');
    setNewBranchLicense('');
    setNewBranchColor('border-emerald-500 text-emerald-400 bg-emerald-500/10');
  };

  // Transfer Handlers
  const handleApproveTransfer = (transferId: string) => {
    setTransfers((prev) => {
      const updated = prev.map((t) => {
        if (t.id === transferId) {
          return {
            ...t,
            status: 'IN_TRANSIT' as const,
            dispatchDate: new Date().toLocaleString(),
            approvedBy: 'Head Office Dispatch Manager',
            transferChallanNo: `TC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
            coldChainVerified: true,
            items: t.items.map((it) => ({
              ...it,
              approvedQty: it.requestedQty,
            })),
          };
        }
        return t;
      });
      try {
        localStorage.setItem(IBT_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleReceiveTransfer = (transferId: string) => {
    transferApi.receiveTransfer(transferId)
      .then(() => PharmacyService.syncDatabase())
      .catch((e) => console.error('Failed to receive transfer in DB:', e));

    const targetTransfer = transfers.find((t) => t.id === transferId);
    if (targetTransfer && targetTransfer.items) {
      targetTransfer.items.forEach((item) => {
        PharmacyService.transferBatchStock({
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          batchNumber: item.batchNumber,
          fromBranchId: targetTransfer.fromBranchId,
          fromBranchName: targetTransfer.fromBranchName,
          toBranchId: targetTransfer.toBranchId,
          toBranchName: targetTransfer.toBranchName,
          quantity: item.approvedQty || item.requestedQty,
          expiryDate: item.expiryDate,
        });
      });
    }

    setTransfers((prev) => {
      const updated = prev.map((t) => {
        if (t.id === transferId) {
          return {
            ...t,
            status: 'RECEIVED' as const,
            receiveDate: new Date().toLocaleString(),
            receivedBy: 'Branch Pharmacist On-Duty',
            items: t.items.map((it) => ({
              ...it,
              receivedQty: it.approvedQty || it.requestedQty,
            })),
          };
        }
        return t;
      });
      try {
        localStorage.setItem(IBT_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setFeedbackMsg({
      type: 'success',
      text: `Transfer received! Stock and critical expiry batches incorporated into destination branch inventory with FEFO priority.`,
    });
  };

  const handleCreateTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const actualFrom = fromBranch || (branches.length > 0 ? branches[0].id : '');
    const actualTo = toBranch || (branches.length > 1 ? branches[1].id : actualFrom);

    if (actualFrom === actualTo) {
      alert('Source and destination branches must be different. Please select two different branches.');
      return;
    }

    const fromB = branches.find((b) => b.id === actualFrom);
    const toB = branches.find((b) => b.id === actualTo);

    const newTransfer: InterBranchTransfer = {
      id: `ibt-2026-${Date.now()}`,
      transferNumber: `IBT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      requisitionNumber: `TRQ-2026-${Math.floor(100 + Math.random() * 900)}`,
      fromBranchId: actualFrom,
      fromBranchName: fromB ? fromB.name : actualFrom,
      toBranchId: actualTo,
      toBranchName: toB ? toB.name : actualTo,
      requestDate: new Date().toLocaleString(),
      status: 'REQUESTED',
      urgency,
      requestedBy: 'Duty Dispenser',
      notes: notes || 'Stock replenishment request.',
      items: [
        {
          medicineId: `med-${Date.now()}`,
          medicineName: medName,
          strength,
          batchNumber: batchNo,
          expiryDate: '12/2026',
          requestedQty: Number(qty),
          approvedQty: 0,
          receivedQty: 0,
          unitPrice: 120.0,
          totalValue: Number(qty) * 120.0,
        },
      ],
    };

    const updated = [newTransfer, ...transfers];
    setTransfers(updated);
    try {
      localStorage.setItem(IBT_STORAGE_KEY, JSON.stringify(updated));
    } catch {}

    transferApi.createTransfer({
      transferType: 'branch_to_branch',
      fromBranchId: newTransfer.fromBranchId,
      fromBranchName: newTransfer.fromBranchName,
      toBranchId: newTransfer.toBranchId,
      toBranchName: newTransfer.toBranchName,
      status: 'requested',
      totalUnits: Number(qty),
      totalValue: Number(qty) * 120.0,
      isColdChain: false,
      challanNumber: newTransfer.requisitionNumber,
      requestedBy: newTransfer.requestedBy,
      items: newTransfer.items,
      notes: newTransfer.notes
    }).then((res: any) => {
      if (res && res.id) {
        setTransfers((prev) => {
          const list = prev.map((t) => (t.id === newTransfer.id ? { ...t, id: res.id } : t));
          try {
            localStorage.setItem(IBT_STORAGE_KEY, JSON.stringify(list));
          } catch {}
          return list;
        });
      }
    }).catch(e => console.error('Failed to sync transfer to DB:', e));

    setShowNewTransferModal(false);
    setNotes('');
    setFeedbackMsg({
      type: 'success',
      text: `Transfer order ${newTransfer.transferNumber} created successfully!`,
    });
  };

  const filteredTransfers = transfers.filter((t) => {
    const matchesFilter =
      transferFilter === 'ALL' || t.status === transferFilter;
    const matchesSearch =
      t.transferNumber.toLowerCase().includes(searchTransfer.toLowerCase()) ||
      t.fromBranchName.toLowerCase().includes(searchTransfer.toLowerCase()) ||
      t.toBranchName.toLowerCase().includes(searchTransfer.toLowerCase()) ||
      t.items.some((it) =>
        it.medicineName.toLowerCase().includes(searchTransfer.toLowerCase())
      );
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl text-white shadow-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Dynamic Multi-Branch Tagging
            </span>
            <span className="text-xs text-slate-300">
              DGDA Pharmacy Network Compliance
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Multi-Branch Pharmacy Management &amp; Inter-Branch Transfer (IBT)
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-3xl">
            Create custom branches to tag employees, inward inventory, sales receipts, and accounting transactions for strict branch-wise isolation and reporting.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              resetForm();
              setShowAddBranchModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add New Branch
          </button>

          {branches.length >= 2 && (
            <button
              onClick={() => {
                setSubTab('transfers');
                setShowNewTransferModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4" />
              New Transfer Request (IBT)
            </button>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all shadow-sm ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* When NO branches are created yet: Clean empty state */}
      {branches.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center max-w-xl mx-auto space-y-5 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">No Branches Configured</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              All demo branches have been removed. Add your first pharmacy branch below. Once added, you can assign employees to it, and all sales, inventory inward, and ledger entries will be automatically tagged.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowAddBranchModal(true);
            }}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Branch</span>
          </button>
        </div>
      ) : (
        <>
          {/* Branch Selector Navigation Chips */}
          <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => handleSelectBranch('all')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedBranchId === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>All Branches (Consolidated)</span>
              <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
                {branches.length}
              </span>
            </button>

            {branches.map((b) => (
              <div key={b.id} className="flex items-center">
                <button
                  onClick={() => handleSelectBranch(b.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    selectedBranchId === b.id
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs border border-slate-300 dark:border-slate-600 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>{b.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({b.code})
                  </span>
                </button>
              </div>
            ))}
          </div>

          {/* Sub-tab Switcher: Overview vs Inter-Branch Transfer vs Comparison */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSubTab('overview')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  subTab === 'overview'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Store className="w-4 h-4" />
                Branch Metrics &amp; Ledger
              </button>

              <button
                onClick={() => setSubTab('transfers')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  subTab === 'transfers'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ArrowRightLeft className="w-4 h-4" />
                Inter-Branch Transfer (IBT)
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px]">
                  {transfers.filter((t) => t.status !== 'RECEIVED').length} Active
                </span>
              </button>

              <button
                onClick={() => setSubTab('comparison')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  subTab === 'comparison'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <GitCompare className="w-4 h-4" />
                Branch Comparison Matrix
              </button>
            </div>

            {selectedBranchId !== 'all' && activeBranch && onOpenPosForBranch && (
              <button
                onClick={() => onOpenPosForBranch(selectedBranchId as BranchId)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Switch POS to {activeBranch.name}
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* VIEW 1: Branch Overview & Isolated Metrics */}
          {subTab === 'overview' && (
            <div className="space-y-6">
              {/* Branch Details Banner */}
              {selectedBranchId !== 'all' && activeBranch ? (
                <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        {activeBranch.name}
                      </h2>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono font-bold">
                        {activeBranch.code}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
                        {activeBranch.type.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activeBranch.address} • Tel: {activeBranch.phone} • License: {activeBranch.licenseNo}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      In-Charge: <span className="font-semibold">{activeBranch.managerName}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                        Operating Margin
                      </span>
                      <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {activeBranch.metrics.profitMargin}%
                      </span>
                    </div>

                    <button
                      onClick={() => handleStartEdit(activeBranch)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition cursor-pointer"
                      title="Edit Branch Information"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteBranch(activeBranch.id, activeBranch.name)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                      title="Delete Branch"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-xs">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    All-Branches Consolidated Operations
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Aggregated performance across {branches.length} registered pharmacy branches.
                  </p>
                </div>
              )}

              {/* 9 Isolated Pillars: Stock, Sales, Purchase, Cash, Expense, Profit, Staff, Supplier, Customer */}
              {(() => {
                const curMetrics = selectedBranchId === 'all' || !activeBranch ? consolidatedMetrics : activeBranch.metrics;
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* 1. Stock */}
                    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          1. Inventory &amp; Stock
                        </span>
                        <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                          <Layers className="w-4 h-4" />
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                          {curMetrics.stockCount.toLocaleString()}{' '}
                          <span className="text-sm font-sans font-normal text-slate-400">Batches</span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Total Valuation:{' '}
                          <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                            ৳{curMetrics.stockValue.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Sales */}
                    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          2. Sales Revenue
                        </span>
                        <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                          <DollarSign className="w-4 h-4" />
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                          ৳{curMetrics.todaySales.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Month to Date:{' '}
                          <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                            ৳{curMetrics.monthSales.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Purchase */}
                    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          3. Procurement / Purchase
                        </span>
                        <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                          <Truck className="w-4 h-4" />
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                          ৳{curMetrics.monthlyPurchase.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Direct Invoices &amp; Warehouse Challans
                        </div>
                      </div>
                    </div>

                    {/* 4. Cash */}
                    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          4. Cash Drawer &amp; Float
                        </span>
                        <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                          <DollarSign className="w-4 h-4" />
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                          ৳{curMetrics.cashBalance.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Includes physical register till &amp; digital float
                        </div>
                      </div>
                    </div>

                    {/* 5. Expense */}
                    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          5. Monthly Expenses
                        </span>
                        <span className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
                          <FileText className="w-4 h-4" />
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                          ৳{curMetrics.monthlyExpense.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Rent, power backup, staff allowances &amp; logistics
                        </div>
                      </div>
                    </div>

                    {/* 6. Net Profit */}
                    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          6. Net Monthly Profit
                        </span>
                        <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
                          <Sparkles className="w-4 h-4" />
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
                          ৳{curMetrics.monthlyProfit.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Operating Margin:{' '}
                          <span className="font-bold text-purple-700 dark:text-purple-300 font-mono">
                            {curMetrics.profitMargin}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 7. Staff Count */}
                    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          7. Assigned Staff
                        </span>
                        <span className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400">
                          <Users className="w-4 h-4" />
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                          {curMetrics.staffCount}{' '}
                          <span className="text-sm font-sans font-normal text-slate-400">Personnel</span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Tagged Pharmacists &amp; Cashiers
                        </div>
                      </div>
                    </div>

                    {/* 8. Active Suppliers */}
                    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          8. Active Suppliers
                        </span>
                        <span className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400">
                          <Truck className="w-4 h-4" />
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                          {curMetrics.activeSuppliers}{' '}
                          <span className="text-sm font-sans font-normal text-slate-400">Vendors</span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Pharmaceutical manufacturers
                        </div>
                      </div>
                    </div>

                    {/* 9. Registered Customers */}
                    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          9. Registered Patients
                        </span>
                        <span className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
                          <UserCheck className="w-4 h-4" />
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                          {curMetrics.registeredCustomers}{' '}
                          <span className="text-sm font-sans font-normal text-slate-400">Profiles</span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Active hospital &amp; retail patient base
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* VIEW 2: Inter-Branch Transfers (IBT) */}
          {subTab === 'transfers' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search IBT Number, challan, branch or medicine..."
                    value={searchTransfer}
                    onChange={(e) => setSearchTransfer(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {(['ALL', 'REQUESTED', 'IN_TRANSIT', 'RECEIVED'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setTransferFilter(filter)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                        transferFilter === filter
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transfers Table */}
              <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
                {filteredTransfers.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No transfers found. Click &quot;New Transfer Request&quot; above to initiate a stock transfer between your branches.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-3 px-4">Transfer #</th>
                        <th className="py-3 px-4">From Branch</th>
                        <th className="py-3 px-4">To Branch</th>
                        <th className="py-3 px-4">Items / Meds</th>
                        <th className="py-3 px-4 text-center">Urgency</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {filteredTransfers.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {t.transferNumber}
                            <div className="text-[10px] text-slate-400 font-sans font-normal">
                              {t.requestDate}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-medium">{t.fromBranchName}</td>
                          <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                            {t.toBranchName}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold">{t.items[0]?.medicineName}</span>
                            {t.items.length > 1 && (
                              <span className="text-[10px] text-slate-400 ml-1">
                                +{t.items.length - 1} more
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                t.urgency === 'OT_Emergency'
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                  : t.urgency === 'Urgent'
                                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {t.urgency}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                t.status === 'RECEIVED'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : t.status === 'IN_TRANSIT'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-purple-100 text-purple-700'
                              }`}
                            >
                              {t.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {t.status === 'REQUESTED' && (
                                <button
                                  onClick={() => handleApproveTransfer(t.id)}
                                  className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  Dispatch
                                </button>
                              )}
                              {t.status === 'IN_TRANSIT' && (
                                <button
                                  onClick={() => handleReceiveTransfer(t.id)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  Receive
                                </button>
                              )}
                              <button
                                onClick={() => setViewingTransfer(t)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                                title="View Challan & Gate Pass"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* VIEW 3: Branch Comparison Matrix */}
          {subTab === 'comparison' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-xs">
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  Multi-Branch Financial &amp; Operational Matrix
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Side-by-side benchmark comparing stock holding, monthly gross revenue, expenses, net profits, and staff efficiency across all registered locations.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-3 px-4">Branch Entity</th>
                        <th className="py-3 px-4">Location Type</th>
                        <th className="py-3 px-4 text-right">Stock Valuation</th>
                        <th className="py-3 px-4 text-right">Today Sales</th>
                        <th className="py-3 px-4 text-right">Month Sales</th>
                        <th className="py-3 px-4 text-right">Expenses</th>
                        <th className="py-3 px-4 text-right">Net Profit</th>
                        <th className="py-3 px-4 text-right">Margin %</th>
                        <th className="py-3 px-4 text-center">Staff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {branches.map((b) => (
                        <tr
                          key={b.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                            {b.name}
                            <div className="text-[10px] text-slate-400 font-mono font-normal">
                              {b.code}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {b.type.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                            ৳{b.metrics.stockValue.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            ৳{b.metrics.todaySales.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                            ৳{b.metrics.monthSales.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-rose-600 dark:text-rose-400">
                            ৳{b.metrics.monthlyExpense.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ৳{b.metrics.monthlyProfit.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {b.metrics.profitMargin}%
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono">
                            {b.metrics.staffCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD / EDIT BRANCH */}
      {/* ======================================================== */}
      {(showAddBranchModal || editingBranch) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-bold">
                  {editingBranch ? `Edit Branch: ${editingBranch.name}` : 'Register New Pharmacy Branch'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddBranchModal(false);
                  setEditingBranch(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editingBranch ? handleUpdateBranch : handleCreateBranch} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Branch Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Branch A / Dhanmondi Outlet"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Unique Branch Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BR-A / DMD-01"
                    value={newBranchCode}
                    onChange={(e) => setNewBranchCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Bengali / Localized Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. ব্রাঞ্চ এ / ধানমন্ডি শাখা"
                  value={newBranchBnName}
                  onChange={(e) => setNewBranchBnName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Branch Facility Type *
                  </label>
                  <select
                    value={newBranchType}
                    onChange={(e) => setNewBranchType(e.target.value as BranchInfo['type'])}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="retail_branch">Retail Pharmacy Outlet</option>
                    <option value="hospital_inpatient">Inpatient Hospital &amp; OT Pharmacy</option>
                    <option value="opd_counter">Ground Floor OPD Fast Counter</option>
                    <option value="head_office">Head Office &amp; Central Depot</option>
                    <option value="warehouse">Storage &amp; Distribution Warehouse</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Branch In-Charge / Pharmacist
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Marcus Vance, BPharm"
                    value={newBranchManager}
                    onChange={(e) => setNewBranchManager(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Physical Address
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Road 27, House 14, Dhanmondi"
                    value={newBranchAddress}
                    onChange={(e) => setNewBranchAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+880 1711-223344"
                    value={newBranchPhone}
                    onChange={(e) => setNewBranchPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  DGDA Drug License Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. DGDA-R-88190"
                  value={newBranchLicense}
                  onChange={(e) => setNewBranchLicense(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddBranchModal(false);
                    setEditingBranch(null);
                  }}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold cursor-pointer text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-sm cursor-pointer"
                >
                  {editingBranch ? 'Save Changes' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: INITIATE INTER-BRANCH TRANSFER */}
      {/* ======================================================== */}
      {showNewTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Initiate Inter-Branch Transfer (IBT)
                </h3>
              </div>
              <button
                onClick={() => setShowNewTransferModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Source Branch (From)
                  </label>
                  <select
                    value={fromBranch}
                    onChange={(e) => setFromBranch(e.target.value as BranchId)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Destination Branch (To)
                  </label>
                  <select
                    value={toBranch}
                    onChange={(e) => setToBranch(e.target.value as BranchId)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Medicine / Item Name
                  </label>
                  <input
                    type="text"
                    value={medName}
                    onChange={(e) => setMedName(e.target.value)}
                    required
                    placeholder="e.g. Moxifloxacin 0.5% Drops"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Urgency Level
                  </label>
                  <select
                    value={urgency}
                    onChange={(e) =>
                      setUrgency(e.target.value as 'Routine' | 'Urgent' | 'OT_Emergency')
                    }
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="Routine">Routine Buffer</option>
                    <option value="Urgent">Urgent Out-of-Stock</option>
                    <option value="OT_Emergency">OT / Eye Surgery Emergency</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Batch Number
                  </label>
                  <input
                    type="text"
                    value={batchNo}
                    onChange={(e) => setBatchNo(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Strength / Form
                  </label>
                  <input
                    type="text"
                    value={strength}
                    onChange={(e) => setStrength(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Requested Qty
                  </label>
                  <input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    min={1}
                    required
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Clinical / Operational Justification
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Critical stockout risk in OT. High prescription demand."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewTransferModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Submit Requisition to Source Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: View Transfer Details */}
      {viewingTransfer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Transfer Challan &amp; Gate Pass #{viewingTransfer.transferNumber}
                </h3>
              </div>
              <button
                onClick={() => setViewingTransfer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">From Branch:</span>
                <span className="font-bold text-slate-900 dark:text-white">{viewingTransfer.fromBranchName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">To Branch:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{viewingTransfer.toBranchName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Challan / Gate Pass:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{viewingTransfer.transferChallanNo || 'Pending Dispatch'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Urgency:</span>
                <span className="font-bold">{viewingTransfer.urgency}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Print Challan
              </button>

              <button
                onClick={() => setViewingTransfer(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
