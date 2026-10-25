import React, { useState } from 'react';
import {
  Barcode,
  X,
  ShoppingCart,
  Trash2,
  Clock,
  ArrowLeftRight,
  CheckCircle2,
  Pill,
  Check,
  Snowflake,
  ShieldAlert,
  HelpCircle,
  Scan,
  TrendingUp,
  History,
  Tag,
  Glasses,
} from 'lucide-react';
import { PharmaCartItem, AlternativeDrug } from '../../types/pharmapulse';
import { PharmacyService } from '../../services/pharmacyService';
import { useAuth } from '../../context/AuthContext';

interface PharmaPulseCartProps {
  cart: PharmaCartItem[];
  onUpdateQty: (id: number, delta: number) => void;
  onSetQty: (id: number, qty: number) => void;
  onSetDisc: (id: number, disc: number) => void;
  onSetPrice?: (id: number, price: number) => void;
  onRemoveItem: (id: number) => void;
  onClearCart: () => void;
  onFastAddItem: (
    name: string,
    price: number,
    batch: string,
    exp: string,
    isUrgent?: boolean,
    extra?: Partial<PharmaCartItem>
  ) => void;
  onSwitchAlternative: (drug: AlternativeDrug) => void;
  heldCount: number;
  onHoldCart: () => void;
  onProcessCheckout: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showSearchDropdown: boolean;
  onSetShowSearchDropdown: (show: boolean) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  onOpenSubstituteModal?: (item: PharmaCartItem) => void;
  onOpenPriceHistoryModal?: (drugName?: string) => void;
  onOpenSmartBarcodeModal?: () => void;
  refreshTrigger?: number;
}

export const PharmaPulseCart: React.FC<PharmaPulseCartProps> = ({
  cart,
  onUpdateQty,
  onSetQty,
  onSetDisc,
  onSetPrice,
  onRemoveItem,
  onClearCart,
  onFastAddItem,
  onSwitchAlternative,
  heldCount,
  onHoldCart,
  onProcessCheckout,
  searchQuery,
  onSearchChange,
  showSearchDropdown,
  onSetShowSearchDropdown,
  searchInputRef,
  onOpenSubstituteModal,
  onOpenPriceHistoryModal,
  onOpenSmartBarcodeModal,
  refreshTrigger = 0
}) => {
  const { canViewProfits, canViewCosts } = useAuth();
  const [showProfitBreakdown, setShowProfitBreakdown] = useState<boolean>(true);
  const totalUnits = cart.reduce((sum, item) => sum + item.qty, 0);

  // Calculate cart profit economics
  const totalCartCost = cart.reduce((sum, item) => {
    const cost = item.purchasePrice ?? (item.price * 0.8);
    return sum + (cost * item.qty);
  }, 0);

  const totalCartRevenue = cart.reduce((sum, item) => {
    return sum + (item.price * item.qty * (1 - item.disc / 100));
  }, 0);

  const totalCartProfit = totalCartRevenue - totalCartCost;
  const overallCartMargin = totalCartRevenue > 0 ? ((totalCartProfit / totalCartRevenue) * 100) : 0;

  const alternativeDrugs: AlternativeDrug[] = [
    {
      id: 'nexum-20',
      name: 'Nexum 20',
      company: 'Square Pharmaceuticals',
      inStock: 380,
      price: 7.00,
      unit: 'cap',
    },
    {
      id: 'maxpro-20',
      name: 'Maxpro 20',
      company: 'Renata Limited',
      inStock: 120,
      price: 7.00,
      unit: 'cap',
    },
    {
      id: 'sergel-20',
      name: 'Sergel 20 (Current)',
      company: 'Healthcare Pharma',
      inStock: 30,
      price: 7.00,
      unit: 'cap',
      isActive: true,
    },
  ];

  // Live catalog from backend
  const [searchCatalog, setSearchCatalog] = React.useState<any[]>([]);

  React.useEffect(() => {
    let mounted = true;
    PharmacyService.fetchLiveCatalog().then(data => {
      if (mounted) {
        setSearchCatalog(data);
      }
    });
    return () => { mounted = false; };
  }, [refreshTrigger]);

  const filteredCatalog = searchQuery.trim()
    ? searchCatalog.filter(
        (m) =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.sub.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.batch.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : searchCatalog;

  return (
    <div className="flex flex-col gap-4">
      {/* Keyboard Hotkeys Ribbon */}
      <div className="p-3 rounded-2xl bg-white dark:bg-[#161b26] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <button
            onClick={() => searchInputRef.current?.focus()}
            className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1.5 shadow-2xs hover:bg-white dark:hover:bg-slate-700 transition"
          >
            <kbd className="text-emerald-600 dark:text-emerald-400 font-mono font-bold bg-white dark:bg-slate-900 px-1 rounded border border-slate-200 dark:border-slate-700 text-[10px]">
              F2
            </kbd>
            <span>Quick Search</span>
          </button>
          <button
            onClick={onOpenSmartBarcodeModal}
            className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1.5 shadow-2xs hover:bg-emerald-100 transition"
          >
            <kbd className="text-emerald-700 dark:text-emerald-300 font-mono font-bold bg-white dark:bg-slate-900 px-1 rounded border border-emerald-300 text-[10px]">
              F3
            </kbd>
            <Scan className="w-3 h-3 text-emerald-600" />
            <span>Smart Barcode</span>
          </button>
          {canViewCosts && (
            <button
              onClick={() => onOpenPriceHistoryModal && onOpenPriceHistoryModal('Napa 500')}
              className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1.5 shadow-2xs hover:bg-white dark:hover:bg-slate-700 transition"
            >
              <History className="w-3 h-3 text-indigo-600" />
              <span>Price History</span>
            </button>
          )}
          <div className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1.5 shadow-2xs">
            <kbd className="text-emerald-600 dark:text-emerald-400 font-mono font-bold bg-white dark:bg-slate-900 px-1 rounded border border-slate-200 dark:border-slate-700 text-[10px]">
              F4
            </kbd>
            <span>Prescribing Doctor</span>
          </div>
          <button
            onClick={onHoldCart}
            className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1.5 shadow-2xs hover:bg-white dark:hover:bg-slate-700 transition"
          >
            <kbd className="text-orange-600 dark:text-orange-400 font-mono font-bold bg-white dark:bg-slate-900 px-1 rounded border border-slate-200 dark:border-slate-700 text-[10px]">
              F8
            </kbd>
            <span>Hold Cart ({heldCount})</span>
          </button>
          <button
            onClick={onProcessCheckout}
            className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1.5 shadow-2xs hover:bg-white dark:hover:bg-slate-700 transition"
          >
            <kbd className="text-emerald-600 dark:text-emerald-400 font-mono font-bold bg-white dark:bg-slate-900 px-1 rounded border border-slate-200 dark:border-slate-700 text-[10px]">
              F10
            </kbd>
            <span>Complete ↵</span>
          </button>
          <button
            onClick={onClearCart}
            className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1.5 shadow-2xs hover:bg-white dark:hover:bg-slate-700 transition"
          >
            <kbd className="text-rose-600 dark:text-rose-400 font-mono font-bold bg-white dark:bg-slate-900 px-1 rounded border border-slate-200 dark:border-slate-700 text-[10px]">
              Esc
            </kbd>
            <span>Clear</span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-[11px] font-medium">
          <span className="flex items-center gap-1">
            <Snowflake className="w-3.5 h-3.5 text-sky-500" />
            <span>Cold Chain Monitor Active</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Scanner Ready</span>
          </span>
        </div>
      </div>

      {/* Omnibox Search Section with Dropdown & Fast Add Pills */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#161b26] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-3 relative">
        <div className="relative w-full">
          <div className="flex items-center bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 transition-all focus-within:border-emerald-500 focus-within:bg-white dark:focus-within:bg-slate-800">
            <Barcode className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mr-2.5 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                onSetShowSearchDropdown(true);
              }}
              onFocus={() => onSetShowSearchDropdown(true)}
              placeholder="Scan Barcode (UPC) or Search Medicine, Generic (e.g. Latanoprost, Moxacin, Insulin, Sergel)... [F2]"
              className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  onSearchChange('');
                  onSetShowSearchDropdown(false);
                }}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown with Rich Specialty Badges */}
          {showSearchDropdown && filteredCatalog.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-30 bg-white dark:bg-[#161b26] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-h-72 overflow-y-auto p-1.5 flex flex-col gap-1 animate-scale-in">
              {filteredCatalog.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    onFastAddItem(item.name, item.price, item.batch, item.exp, item.isUrgent, {
                      medicineId: (item as any).medicineId,
                      batchId: (item as any).batchId,
                      sub: item.sub,
                      company: item.company,
                      isColdChain: item.isColdChain,
                      storageTemp: item.storageTemp,
                      isOphthalmic: item.isOphthalmic,
                      afterOpeningDays: item.afterOpeningDays,
                      isRxRequired: item.isRxRequired,
                      dosageEn: item.dosageEn,
                      dosageBn: item.dosageBn,
                      purchasePrice: (item as any).purchasePrice,
                      stock: item.stock
                    });
                    onSetShowSearchDropdown(false);
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer ${
                    item.isUrgent
                      ? 'bg-orange-50/70 dark:bg-orange-950/40 hover:bg-orange-100/70 border border-orange-200 dark:border-orange-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-1.5 rounded-lg ${
                        item.isColdChain
                          ? 'bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400'
                          : item.isUrgent
                          ? 'bg-orange-100 text-orange-600'
                          : 'bg-emerald-50 text-emerald-600'
                      }`}
                    >
                      {item.isColdChain ? <Snowflake className="w-4 h-4" /> : <Pill className="w-4 h-4" />}
                    </div>
                    <div className="flex flex-col text-left">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {item.name}
                        </span>
                        {item.isColdChain && (
                          <span className="px-1.5 py-0.2 rounded bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 border border-sky-200 text-[9px] font-bold flex items-center gap-0.5">
                            <Snowflake className="w-2.5 h-2.5" /> ২°-৮° সে.
                          </span>
                        )}
                        {item.afterOpeningDays && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 text-[9px] font-bold flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> খোলার পর ২৮ দিন
                          </span>
                        )}
                        {item.isRxRequired && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 text-[9px] font-bold">
                            💊 Rx
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.sub} • {item.company}
                      </span>
                      {item.dosageBn && (
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-sans">
                          মাত্রা: {item.dosageBn}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        ৳ {item.price.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Stock: {item.stock}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        item.isUrgent
                          ? 'bg-orange-500 text-white'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {item.batch} ({item.exp})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Active Prescription Cart Table */}
      <div className="rounded-2xl bg-white dark:bg-[#161b26] border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
        {/* Table Header Bar */}
        <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-bold text-xs text-slate-800 dark:text-white">
              Active Prescription Cart
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
              {cart.length} Items
            </span>
            {/* Profit by Medicine Indicator (Admin/Manager only) */}
            {canViewProfits && (
              <button
                onClick={() => setShowProfitBreakdown(!showProfitBreakdown)}
                title="Toggle Profit by Medicine breakdown"
                className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold flex items-center gap-1 hover:bg-emerald-200 transition"
              >
                <TrendingUp className="w-3 h-3 text-emerald-600" />
                <span>Profit by Medicine ({showProfitBreakdown ? 'ON' : 'OFF'})</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs">
            {canViewProfits && (
              <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                Profit: ৳{totalCartProfit.toFixed(2)} ({overallCartMargin.toFixed(0)}%)
              </span>
            )}
            <span className="font-mono text-[11px] text-slate-400 font-semibold">
              Order #RX-2026-9041
            </span>
            <button
              onClick={onClearCart}
              title="Clear Cart"
              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-2.5 px-4">{canViewProfits ? 'Medicine, Specialty & Profit Breakdown' : 'Medicine & Specialty Details'}</th>
                <th className="py-2.5 px-2.5">Batch & FEFO</th>
                <th className="py-2.5 px-2.5">Exp. Date</th>
                <th className="py-2.5 px-2.5 text-right">Unit (৳)</th>
                <th className="py-2.5 px-2.5 text-center">Qty</th>
                <th className="py-2.5 px-2.5 text-right">Disc %</th>
                <th className="py-2.5 px-3.5 text-right">Total (৳)</th>
                <th className="py-2.5 px-2.5 text-center">Substitute</th>
                <th className="py-2.5 px-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {cart.map((item) => {
                const lineTotal = item.price * item.qty * (1 - item.disc / 100);

                // Feature ④ Profit by Medicine calculation
                const pPrice = item.purchasePrice ?? (
                  item.price === 3.5 ? 2.8 :
                  item.price === 3.0 ? 2.4 :
                  item.price === 7.0 ? 5.6 :
                  item.price === 15.0 ? 12.0 :
                  item.price === 420.0 ? 340.0 :
                  item.price === 820.0 ? 680.0 :
                  Number((item.price * 0.8).toFixed(2))
                );
                const sPrice = item.price;
                const unitProfit = Number((sPrice - pPrice).toFixed(2));
                const marginPct = sPrice > 0 ? ((unitProfit / sPrice) * 100).toFixed(0) : '0';

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      item.isUrgent
                        ? 'bg-orange-50/50 dark:bg-orange-950/20 hover:bg-orange-100/40'
                        : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {item.name}
                          </span>
                          {item.isUrgent && (
                            <span className="px-1.5 py-0.2 rounded bg-orange-500 text-white font-bold text-[9px] uppercase tracking-wider shadow-2xs">
                              FEFO Priority
                            </span>
                          )}
                          {/* Cold Chain ❄️ Badge */}
                          {item.isColdChain && (
                            <span className="px-1.5 py-0.2 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 font-bold text-[9px] flex items-center gap-0.5">
                              <Snowflake className="w-2.5 h-2.5" />
                              ২°-৮° সে. (Cold Chain)
                            </span>
                          )}
                          {/* 28-day after-opening expiry badge */}
                          {(item.afterOpeningDays || item.isOphthalmic) && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-bold text-[9px] flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              খোলার পর ২৮ দিন
                            </span>
                          )}
                          {/* Rx Required DGDA Badge */}
                          {item.isRxRequired && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-bold text-[9px] flex items-center gap-0.5">
                              <ShieldAlert className="w-2.5 h-2.5" />
                              Rx Required
                            </span>
                          )}
                          {/* Negotiable Optical Frame Badge */}
                          {item.isNegotiable && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-bold text-[9px] flex items-center gap-1">
                              <Glasses className="w-2.5 h-2.5" />
                              Negotiable Frame (দরদাম)
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-slate-400">
                          {item.sub} • {item.company}
                        </span>

                        {/* Feature ④ Profit by Medicine display (Masked for Cashiers) */}
                        {showProfitBreakdown && canViewProfits && (
                          <div className="mt-1 p-1.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40 flex items-center justify-between text-[10px] text-emerald-900 dark:text-emerald-300 font-mono">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-slate-500 dark:text-slate-400">
                                Purchase: <strong className="text-slate-800 dark:text-slate-200 font-bold">৳{pPrice.toFixed(2)}</strong>
                              </span>
                              <span>•</span>
                              <span className="text-slate-500 dark:text-slate-400">
                                Sale: <strong className="text-slate-800 dark:text-slate-200 font-bold">৳{sPrice.toFixed(2)}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Profit: <strong className="text-emerald-700 dark:text-emerald-400 font-bold">৳{unitProfit.toFixed(2)}</strong>
                              </span>
                              <span>•</span>
                              <span className="font-bold bg-emerald-100 dark:bg-emerald-900/60 px-1 py-0.2 rounded">
                                Margin: {marginPct}%
                              </span>
                            </div>
                            <button
                              onClick={() => onOpenPriceHistoryModal && onOpenPriceHistoryModal(item.name)}
                              title="Purchase Price Trend History"
                              className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 ml-2 font-sans font-semibold shrink-0"
                            >
                              <History className="w-2.5 h-2.5" />
                              <span>Trend</span>
                            </button>
                          </div>
                        )}

                        {/* Dosage guidance in Bengali & English */}
                        {(item.dosageBn || item.dosageEn) && (
                          <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 dark:text-emerald-400 font-sans mt-0.5">
                            <span className="font-semibold">মাত্রা:</span>
                            <span>{item.dosageBn || item.dosageEn}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2.5">
                      <span
                        className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                          item.isUrgent
                            ? 'text-orange-600 bg-white dark:bg-slate-800 border border-orange-200'
                            : 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800'
                        }`}
                      >
                        {item.batch}
                      </span>
                    </td>
                    <td className="py-3 px-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 w-fit ${
                          item.isUrgent
                            ? 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-bold border border-orange-200'
                            : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200'
                        }`}
                      >
                        {item.isUrgent && <Clock className="w-3 h-3" />}
                        <span>{item.exp}</span>
                      </span>
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono text-slate-600 dark:text-slate-300 font-medium">
                      {item.isNegotiable ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center gap-1 justify-end">
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">৳</span>
                            <input
                              type="number"
                              min="0"
                              step="10"
                              value={item.price}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                onSetPrice?.(item.id, val);
                              }}
                              className="w-20 px-1.5 py-0.5 text-right font-mono font-bold text-xs bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-md focus:ring-1 focus:ring-amber-500 focus:outline-hidden text-amber-950 dark:text-amber-200"
                              title="Negotiated Price: Click to adjust agreed price"
                            />
                          </div>
                          <span className="text-[8.5px] font-sans text-amber-600 dark:text-amber-400 font-bold">
                            Negotiated (দরদাম)
                          </span>
                        </div>
                      ) : (
                        <span>{(item.price || 0).toFixed(2)}</span>
                      )}
                    </td>
                    <td className="py-3 px-2.5">
                      <div className="flex items-center justify-center gap-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 w-24 mx-auto">
                        <button
                          onClick={() => onUpdateQty(item.id, -1)}
                          className="w-5 h-5 rounded bg-white dark:bg-slate-700 hover:bg-emerald-600 hover:text-white flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-xs shadow-2xs"
                        >
                          -
                        </button>
                        <input
                          type="text"
                          value={item.qty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            onSetQty(item.id, isNaN(val) ? 1 : val);
                          }}
                          className="w-8 bg-transparent text-center font-mono text-xs font-bold text-slate-900 dark:text-white outline-none border-0 p-0"
                        />
                        <button
                          onClick={() => onUpdateQty(item.id, 1)}
                          className="w-5 h-5 rounded bg-white dark:bg-slate-700 hover:bg-emerald-600 hover:text-white flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-xs shadow-2xs"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-2.5 text-right">
                      <input
                        type="number"
                        value={item.disc}
                        onChange={(e) => onSetDisc(item.id, parseFloat(e.target.value) || 0)}
                        className="w-10 text-right bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-slate-800 dark:text-slate-200 font-mono text-xs outline-none"
                      />
                    </td>
                    <td
                      className={`py-3 px-3.5 text-right font-mono text-xs font-bold ${
                        item.isUrgent ? 'text-orange-600' : 'text-emerald-600'
                      }`}
                    >
                      {lineTotal.toFixed(2)}
                    </td>

                    {/* Generic Substitute Trigger */}
                    <td className="py-3 px-2.5 text-center">
                      <button
                        onClick={() => onOpenSubstituteModal && onOpenSubstituteModal(item)}
                        title="Generic Substitution / বিকল্প ওষুধ খুঁজুন"
                        className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 dark:text-slate-300 font-medium text-[11px] border border-slate-200 dark:border-slate-700 flex items-center gap-1 mx-auto transition"
                      >
                        <ArrowLeftRight className="w-3 h-3 text-emerald-600" />
                        <span>বিকল্প</span>
                      </button>
                    </td>

                    <td className="py-3 px-2.5 text-center">
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Dynamic Cart Bottom Status Bar with Profit Economics */}
        <div className="p-3 bg-slate-50/70 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span>
              Total Units:{' '}
              <strong className="text-slate-800 dark:text-slate-200 font-mono font-bold">
                {totalUnits} units
              </strong>
            </span>
            {canViewProfits && (
              <>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-mono">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Bill Profit: <strong className="font-bold">৳{totalCartProfit.toFixed(2)}</strong> ({overallCartMargin.toFixed(1)}% Margin)
                </span>
              </>
            )}
            {canViewCosts && (
              <>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="text-slate-500">
                  Purchase Cost: <strong className="font-mono text-slate-700 dark:text-slate-300">৳{totalCartCost.toFixed(2)}</strong>
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-semibold">
              <Snowflake className="w-3 h-3" />
              Cold Chain Packaging Enforced
            </span>
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>FEFO Enforced</span>
            </div>
          </div>
        </div>
      </div>

      {/* Generic Alternative & Price Comparison Card */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#161b26] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-bold text-xs text-slate-800 dark:text-white">
              Generic Alternative & Price Comparison
            </span>
          </div>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
            Active Molecule: Esomeprazole 20mg
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {alternativeDrugs.map((drug) => (
            <div
              key={drug.id}
              className={`p-3 rounded-xl flex flex-col justify-between transition-all ${
                drug.isActive
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-500'
                  : 'bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-emerald-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    {drug.name}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      drug.isActive
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {drug.isActive ? 'In Cart (30)' : `In Stock (${drug.inStock})`}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">{drug.company}</span>
              </div>

              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200/70 dark:border-slate-700/60">
                <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                  ৳ {drug.price.toFixed(2)} / {drug.unit}
                </span>
                {drug.isActive ? (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> ACTIVE
                  </span>
                ) : (
                  <button
                    onClick={() => onSwitchAlternative(drug)}
                    className="px-2.5 py-1 rounded bg-white dark:bg-slate-700 hover:bg-emerald-600 hover:text-white border border-slate-200 dark:border-slate-600 text-[10px] font-bold text-slate-700 dark:text-slate-200 transition shadow-2xs"
                  >
                    + Switch
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
