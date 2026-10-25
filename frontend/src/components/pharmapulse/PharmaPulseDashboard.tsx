import React, { useState, useEffect, useRef } from 'react';
import { PharmaPulseSidebar } from './PharmaPulseSidebar';
import { PharmaPulseHeader } from './PharmaPulseHeader';
import { PharmaPulseKpiRow } from './PharmaPulseKpiRow';
import { PharmaPulseCart } from './PharmaPulseCart';
import { PharmaPulseCheckout } from './PharmaPulseCheckout';
import {
  F10DispatchModal,
  ThermalReceiptModal,
  GenericSubstitutionModal,
  RxWarningModal,
  REGISTERED_DOCTORS,
} from './PharmaPulseModals';
import { SmartBarcodeModal } from './SmartBarcodeModal';
import { PriceHistoryModal } from './PriceHistoryModal';
import { PharmacyCommandCenter } from './PharmacyCommandCenter';
import {
  PharmaCartItem,
  AlternativeDrug,
  FefoQueueItem,
  PharmaNavTab,
  DoctorInfo,
  GenericSubstituteOption,
} from '../../types/pharmapulse';
import { CheckCircle2, AlertTriangle, Info, X, Building2 } from 'lucide-react';
import { InventoryView } from '../inventory/InventoryView';
import { PrescriptionView } from '../prescriptions/PrescriptionView';
import { PurchaseOrdersView } from '../purchases/PurchaseOrdersView';
import { AccountingAnalyticsView } from '../accounting/AccountingAnalyticsView';
import { DashboardView } from '../dashboard/DashboardView';
import { RoleManagementView } from '../rbac/RoleManagementView';
import { SalesReturnView } from '../returns/SalesReturnView';
import { CustomerManagementView } from '../customers/CustomerManagementView';
import { StockAdjustmentAuditView } from '../inventory/StockAdjustmentAuditView';
import { BatchExpiryView } from '../batches/BatchExpiryView';
import { MultiBranchHub } from '../branches/MultiBranchHub';
import { ExecutiveDashboardView } from '../executive/ExecutiveDashboardView';
import { InventoryAnomalyModal } from '../inventory/InventoryAnomalyModal';
import { useAuth } from '../../context/AuthContext';
import { AuditService } from '../../services/auditService';
import { PharmacyService } from '../../services/pharmacyService';
import { BranchService } from '../../services/branchService';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface PharmaPulseDashboardProps {
  onNavigateToTab?: (tab: string) => void;
}

export const PharmaPulseDashboard: React.FC<PharmaPulseDashboardProps> = ({
  onNavigateToTab,
}) => {
  const { currentUser } = useAuth();

  // Navigation
  const [activeTab, setActiveTab] = useState<PharmaNavTab>('pos');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Analytics Branch Filter Scope
  const [analyticsBranchId, setAnalyticsBranchId] = useState<string>('all');
  const branches = BranchService.getBranches();

  // Theme & Language
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [language, setLanguage] = useState<'EN' | 'BN'>('EN');

  // Active Cart State featuring cold chain, 28-day open expiry, and Rx metadata
  const [cart, setCart] = useState<PharmaCartItem[]>([]);

  // Prescribing Doctor & Bengali Thermal Receipt State
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorInfo | null>(REGISTERED_DOCTORS[0]);
  const [isBengaliReceipt, setIsBengaliReceipt] = useState<boolean>(true);

  // Modals
  const [isAnomalyModalOpen, setIsAnomalyModalOpen] = useState(false);
  const [isF10ModalOpen, setIsF10ModalOpen] = useState(false);
  const [isThermalModalOpen, setIsThermalModalOpen] = useState(false);
  const [autoPrintThermal, setAutoPrintThermal] = useState(false);
  const [isRxWarningModalOpen, setIsRxWarningModalOpen] = useState(false);
  const [substituteTargetItem, setSubstituteTargetItem] = useState<PharmaCartItem | null>(null);
  const [isSmartBarcodeModalOpen, setIsSmartBarcodeModalOpen] = useState(false);
  const [isPriceHistoryModalOpen, setIsPriceHistoryModalOpen] = useState(false);
  const [priceHistoryTargetDrug, setPriceHistoryTargetDrug] = useState<string>('Napa 500');

  // Checkout calculations
  const [loyaltyApplied, setLoyaltyApplied] = useState(false);
  const [specialDiscPercent, setSpecialDiscPercent] = useState<number>(5);
  const [isVatEnabled, setIsVatEnabled] = useState<boolean>(true);
  const [vatPercent, setVatPercent] = useState<number>(5);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mfs' | 'due_credit'>('cash');
  const [tenderedAmount, setTenderedAmount] = useState<number>(1000);
  const [heldCount, setHeldCount] = useState<number>(2);

  // Search & Dialogs
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Live catalog trigger
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Toast Notification Stack
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // Synchronize Dark Mode with DOM
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Real-time calculation engine
  const subtotal = cart.reduce((sum, item) => {
    const itemTotal = item.price * item.qty * (1 - item.disc / 100);
    return sum + itemTotal;
  }, 0);

  const loyaltyDiscount = loyaltyApplied ? 42.00 : 0.00;
  const specialDiscount = (subtotal * Math.max(0, specialDiscPercent)) / 100;
  const discount = specialDiscount + loyaltyDiscount;

  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = isVatEnabled ? (taxableAmount * (vatPercent / 100)) : 0;

  const calculatedTotal = taxableAmount + tax;
  const grandTotal = Math.floor(calculatedTotal);
  const roundOff = calculatedTotal - grandTotal;

  const changeDue = Math.max(0, tenderedAmount - grandTotal);

  // Item management callbacks
  const handleUpdateQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.qty + delta;
            if (newQty <= 0) return null;
            if (item.stock !== undefined && item.stock > 0 && newQty > item.stock) {
              addToast(`Cannot exceed available stock (${item.stock} units)`, 'error');
              return item;
            }
            return { ...item, qty: newQty };
          }
          return item;
        })
        .filter(Boolean) as PharmaCartItem[]
    );
  };

  const handleSetQty = (id: number, qty: number) => {
    if (qty <= 0) {
      handleRemoveItem(id);
      return;
    }
    const target = cart.find((i) => i.id === id);
    if (target && target.stock !== undefined && target.stock > 0 && qty > target.stock) {
      addToast(`Cannot exceed available stock (${target.stock} units)`, 'error');
    }
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty } : item))
    );
  };

  const handleSetDisc = (id: number, disc: number) => {
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, disc: Math.max(0, Math.min(100, disc)) } : item))
    );
  };

  const handleRemoveItem = (id: number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
    addToast('Item removed from cart', 'info');
  };

  const handleClearCart = () => {
    setCart([]);
    addToast('Prescription cart cleared', 'info');
  };

  const handleSetPrice = (id: number, price: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, price: Math.max(0, price) } : item
      )
    );
  };

  const handleFastAddItem = (
    name: string,
    price: number,
    batch: string,
    exp: string,
    isUrgent: boolean = false,
    extra?: Partial<PharmaCartItem>
  ) => {
    const existing = cart.find((i) => i.name.toLowerCase().includes(name.toLowerCase()));
    if (existing) {
      handleUpdateQty(existing.id, 1);
      addToast(`Incremented quantity for ${name}`, 'info');
    } else {
      const newItem: PharmaCartItem = {
        id: Date.now(),
        name,
        sub: extra?.sub || 'Formulation Molecule',
        company: extra?.company || 'Certified Lab Pharma',
        batch,
        exp,
        price,
        qty: 1,
        disc: 0,
        isUrgent,
        isColdChain: extra?.isColdChain,
        storageTemp: extra?.storageTemp,
        isOphthalmic: extra?.isOphthalmic,
        afterOpeningDays: extra?.afterOpeningDays,
        isRxRequired: extra?.isRxRequired,
        dosageEn: extra?.dosageEn,
        dosageBn: extra?.dosageBn,
        medicineId: extra?.medicineId,
        batchId: extra?.batchId,
        purchasePrice: extra?.purchasePrice,
        stock: extra?.stock
      };
      setCart((prev) => [...prev, newItem]);
      addToast(`Added ${name} to active cart`, 'success');
    }
  };

  const handleSwitchAlternative = (alt: AlternativeDrug) => {
    setCart((prev) => {
      const filtered = prev.filter((i) => !i.name.toLowerCase().includes('sergel'));
      const switchedItem: PharmaCartItem = {
        id: Date.now(),
        name: alt.name,
        sub: 'Esomeprazole 20mg',
        company: alt.company,
        batch: `SW-${Math.floor(1000 + Math.random() * 9000)}`,
        exp: '10/2026',
        price: alt.price,
        qty: 30,
        disc: 0,
        isUrgent: false,
        dosageEn: '1 capsule daily 30 min before breakfast',
        dosageBn: '১টি ক্যাপসুল প্রতিদিন সকালে খাবার ৩০ মিনিট আগে',
      };
      return [...filtered, switchedItem];
    });
    addToast(`Switched molecule to ${alt.name} (${alt.company})`, 'success');
  };

  // Handle generic substitute selection from GenericSubstitutionModal with Pharmacist Confirmation Gate
  const handleSelectSubstitute = (originalItem: PharmaCartItem, alt: GenericSubstituteOption) => {
    const isInCart = cart.some((i) => i.id === originalItem.id);
    const newSubItem: PharmaCartItem = {
      id: isInCart ? originalItem.id : Date.now(),
      name: `${alt.brandName} ${alt.strength}`.trim(),
      sub: `${alt.genericName} • ${alt.strength}`,
      company: alt.company || alt.manufacturer || 'Pharma Lab',
      price: alt.price,
      batch: alt.batch || `SUB-${Math.floor(1000 + Math.random() * 9000)}`,
      exp: alt.exp || originalItem.exp || '12/2027',
      qty: originalItem.qty || 1,
      disc: 0,
      isUrgent: false,
      purchasePrice: alt.purchasePrice,
      isColdChain: alt.isColdChain ?? originalItem.isColdChain,
      storageTemp: alt.storageTemp ?? originalItem.storageTemp,
      isOphthalmic: alt.isOphthalmic ?? originalItem.isOphthalmic,
      afterOpeningDays: alt.afterOpeningDays ?? originalItem.afterOpeningDays,
      isRxRequired: alt.isRxRequired ?? originalItem.isRxRequired,
      dosageBn: alt.dosageBn ?? originalItem.dosageBn,
      dosageEn: alt.dosageEn ?? originalItem.dosageEn,
    };

    if (isInCart) {
      setCart((prev) => prev.map((item) => (item.id === originalItem.id ? newSubItem : item)));
    } else {
      setCart((prev) => [...prev, newSubItem]);
    }
    setSubstituteTargetItem(null);
    addToast(`ফার্মাসিস্ট অনুমোদিত বিকল্প: ${alt.brandName} (${alt.company || alt.manufacturer}) কার্টে যুক্ত হয়েছে`, 'success');
  };

  // Feature ① Smart Barcode item added handler
  const handleAddFromSmartBarcode = (item: PharmaCartItem) => {
    const existing = cart.find((i) => i.name.toLowerCase().trim() === item.name.toLowerCase().trim());
    if (existing) {
      handleUpdateQty(existing.id, item.qty || 1);
      addToast(`Smart Barcode: Incremented qty for ${item.name}`, 'info');
    } else {
      setCart((prev) => [...prev, item]);
      addToast(`Smart Barcode: ${item.name} (${item.batch}) added to cart`, 'success');
    }
  };

  // Feature ② Smart Substitute handler for unavailable/out-of-stock drug
  const handleOpenSubstituteForDrug = (drugName: string) => {
    setIsSmartBarcodeModalOpen(false);
    const existing = cart.find((i) => i.name.toLowerCase().includes(drugName.toLowerCase()));
    if (existing) {
      setSubstituteTargetItem(existing);
    } else {
      const isNapa = drugName.toLowerCase().includes('napa');
      const tempItem: PharmaCartItem = {
        id: Date.now(),
        name: drugName,
        sub: isNapa ? 'Paracetamol 500mg' : 'Esomeprazole 20mg',
        company: isNapa ? 'Beximco Pharmaceuticals Ltd' : 'Healthcare Pharma',
        batch: 'OOS-BATCH',
        exp: 'N/A (Out of Stock)',
        price: isNapa ? 3.50 : 7.00,
        qty: 1,
        disc: 0,
        isUrgent: false,
      };
      setSubstituteTargetItem(tempItem);
    }
  };

  // Feature ③ Price History modal opener
  const handleOpenPriceHistory = (drugName: string = 'Napa 500') => {
    setPriceHistoryTargetDrug(drugName);
    setIsPriceHistoryModalOpen(true);
  };

  const handleOpenSmartBarcode = () => {
    setIsSmartBarcodeModalOpen(true);
  };

  const handleAddFefoItem = (item: FefoQueueItem) => {
    handleFastAddItem(item.name, item.price || 22.00, item.batch, item.exp, item.isUrgent, {
      isColdChain: item.isColdChain,
      medicineId: item.medicineId,
      batchId: item.batchId,
      purchasePrice: item.purchasePrice,
    });
  };

  const handleHoldOrder = () => {
    if (cart.length === 0) {
      addToast('Cannot hold an empty cart', 'error');
      return;
    }
    const holdId = `HLD-${Date.now().toString().slice(-4)}`;
    setHeldCount((prev) => prev + 1);
    setCart([]);
    addToast(`Order #${holdId} placed on hold. Total held: ${heldCount + 1}`, 'info');
  };

  // F10 Checkout with DGDA Prescription Check Guardrail
  const handleProcessDispense = () => {
    if (cart.length === 0) {
      addToast('Cannot dispense: Prescription cart is empty', 'error');
      return;
    }

    // Over-selling Guardrail: Block dispatch if any cart item quantity exceeds stock
    const overStockItem = cart.find((i) => i.stock !== undefined && i.stock > 0 && i.qty > i.stock);
    if (overStockItem) {
      addToast(`Cannot dispense ${overStockItem.name}: Requested quantity (${overStockItem.qty}) exceeds available stock (${overStockItem.stock}).`, 'error');
      return;
    }

    // DGDA Guardrail: If any item requires a prescription and no doctor is chosen, show warning
    const rxRestrictedItems = cart.filter((i) => i.isRxRequired);
    if (rxRestrictedItems.length > 0 && !selectedDoctor) {
      setIsRxWarningModalOpen(true);
      return;
    }

    setIsF10ModalOpen(true);
  };

  const handleConfirmF10Dispatch = async (method: string) => {
    setIsF10ModalOpen(false);

    try {
      const invoiceNumber = `INV-2026-${Math.floor(9200 + Math.random() * 500)}`;
      const totalCost = cart.reduce((sum, item) => sum + ((item.purchasePrice || 0) * item.qty), 0);
      
      const newSale: any = {
        id: `sale-${Date.now()}`,
        invoiceNumber,
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        customerName: 'Walk-In Customer',
        items: cart.map(item => ({
          medicineId: item.medicineId || 'unknown-med',
          medicineName: item.name,
          genericName: item.sub,
          batchId: item.batchId || 'unknown-batch',
          batchNumber: item.batch,
          expiryDate: item.exp,
          quantity: item.qty,
          unitPrice: item.price,
          unitCost: item.purchasePrice || 0,
          mrp: item.price, // assuming MRP is price
          discountPercent: item.disc,
          taxRate: 0,
          subtotal: item.price * item.qty,
          taxAmount: 0,
          total: (item.price * item.qty) * (1 - (item.disc / 100))
        })),
        subtotal,
        discountTotal: discount,
        taxTotal: tax,
        grandTotal,
        totalCost,
        grossProfit: grandTotal - tax - totalCost,
        paymentMethod: paymentMethod === 'mobile' ? 'bkash_nagad' : (paymentMethod === 'card' ? 'card' : 'cash'),
        paymentStatus: 'paid',
        cashierName: currentUser?.name || 'Duty Pharmacist',
        branchId: currentUser?.branchId || 'main',
        branchName: currentUser?.branchName || 'Main Branch',
      };

      await PharmacyService.completeSale(newSale);
      setRefreshTrigger(prev => prev + 1); // Trigger catalog refresh

      AuditService.recordAuditLog({
        userId: currentUser?.id || 'usr-cashier-01',
        userName: currentUser?.name || 'Duty Pharmacist',
        userRole: currentUser?.roleName || 'Cashier',
        action: 'DISPENSE',
        module: 'pos',
        targetEntityId: invoiceNumber,
        targetEntityType: 'SaleInvoice',
        summary: `Dispensed & checked out ${cart.length} item(s) (৳${grandTotal.toFixed(2)}) via ${method.toUpperCase()} tender at Counter 01`,
        beforeState: null,
        afterState: {
          totalAmount: grandTotal,
          subtotal,
          discount,
          tax,
          paymentMethod,
          dispatchMethod: method,
          itemsCount: cart.length,
          doctorAssigned: selectedDoctor?.name || 'Over The Counter (OTC)',
          status: 'completed'
        }
      });
    } catch (error) {
      console.error("Checkout processing failed", error);
    }

    addToast(`Dispensed verified! Receipt dispatched via ${method.toUpperCase()}`, 'success');
    
    if (method === 'print' || method === 'both') {
      setAutoPrintThermal(true);
      setIsThermalModalOpen(true);
      // Cart will be cleared when the modal is closed
    } else {
      setCart([]);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F3') {
        e.preventDefault();
        setIsSmartBarcodeModalOpen(true);
      } else if (e.key === 'F8') {
        e.preventDefault();
        handleHoldOrder();
      } else if (e.key === 'F10') {
        e.preventDefault();
        handleProcessDispense();
      } else if (e.key === 'Escape') {
        setShowSearchDropdown(false);
        setIsF10ModalOpen(false);
        setIsThermalModalOpen(false);
        setIsRxWarningModalOpen(false);
        setSubstituteTargetItem(null);
        setIsSmartBarcodeModalOpen(false);
        setIsPriceHistoryModalOpen(false);
      } else if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        setIsThermalModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleNavSelect = (tab: PharmaNavTab) => {
    setActiveTab(tab);
    if (onNavigateToTab) {
      onNavigateToTab(tab);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#F4F7FA] dark:bg-[#0c1017] text-slate-800 dark:text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Toast Notification Stack */}
      <div className="fixed bottom-5 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg pointer-events-auto transition-all animate-slide-up ${
              t.type === 'success'
                ? 'bg-emerald-600 text-white shadow-emerald-700/25'
                : t.type === 'error'
                ? 'bg-rose-600 text-white shadow-rose-700/25'
                : 'bg-slate-900 text-white dark:bg-slate-800'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
            {t.type === 'error' && <AlertTriangle className="w-4 h-4" />}
            {t.type === 'info' && <Info className="w-4 h-4" />}
            <span>{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((toast) => toast.id !== t.id))}
              className="ml-2 hover:opacity-75"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Primary Sidebar */}
      <PharmaPulseSidebar
        activeTab={activeTab}
        onSelectTab={handleNavSelect}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main App Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top App Header */}
        <PharmaPulseHeader
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          language={language}
          onToggleLanguage={() => setLanguage(language === 'EN' ? 'BN' : 'EN')}
          onOpenSettings={() => setActiveTab('settings')}
          onOpenShortcuts={() =>
            addToast('Hotkeys: F2 (Search), F3 (Smart Barcode), F8 (Hold), F10 (Dispense), Ctrl+P (Thermal Receipt)', 'info')
          }
          onHoldOrder={handleHoldOrder}
          onOpenBarcodeScanner={handleOpenSmartBarcode}
          onOpenInventoryAnomalies={() => setIsAnomalyModalOpen(true)}
          anomalyCount={3}
          onSearchFocus={() => {
            if (activeTab !== 'pos') {
              setActiveTab('pos');
            }
            setTimeout(() => {
              searchInputRef.current?.focus();
            }, 100);
          }}
        />

        {/* Scrollable Content View */}
        <main className="flex-1 overflow-y-auto px-4 md:px-6 py-5 flex flex-col gap-5 w-full">
          {/* Main POS Interface */}
          {activeTab === 'pos' && (
            <>
              {/* Central Layout: 8 cols Cart & Search + 4 cols Checkout & Billing */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left 8 Cols: Omnibox Search, Hotkeys Ribbon & Active Cart */}
                <div className="lg:col-span-8 flex flex-col gap-4">
                  <PharmaPulseCart
                    cart={cart}
                    onUpdateQty={handleUpdateQty}
                    onSetQty={handleSetQty}
                    onSetDisc={handleSetDisc}
                    onSetPrice={handleSetPrice}
                    onRemoveItem={handleRemoveItem}
                    onClearCart={handleClearCart}
                    onFastAddItem={handleFastAddItem}
                    onSwitchAlternative={handleSwitchAlternative}
                    heldCount={heldCount}
                    onHoldCart={handleHoldOrder}
                    onProcessCheckout={handleProcessDispense}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    showSearchDropdown={showSearchDropdown}
                    onSetShowSearchDropdown={setShowSearchDropdown}
                    searchInputRef={searchInputRef}
                    onOpenSubstituteModal={(item) => setSubstituteTargetItem(item)}
                    onOpenPriceHistoryModal={handleOpenPriceHistory}
                    onOpenSmartBarcodeModal={handleOpenSmartBarcode}
                    refreshTrigger={refreshTrigger}
                  />
                </div>

                {/* Right 4 Cols: Checkout & Billing, FEFO Queue & Velocity */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                  <PharmaPulseCheckout
                    subtotal={subtotal}
                    discount={discount}
                    tax={tax}
                    roundOff={roundOff}
                    grandTotal={grandTotal}
                    loyaltyApplied={loyaltyApplied}
                    onToggleLoyalty={() => {
                      setLoyaltyApplied(!loyaltyApplied);
                      addToast(
                        loyaltyApplied
                          ? 'Removed loyalty points discount'
                          : 'Applied 420 Member Points (-৳42.00)',
                        'success'
                      );
                    }}
                    specialDiscPercent={specialDiscPercent}
                    onChangeSpecialDiscPercent={setSpecialDiscPercent}
                    onToggleSpecialDisc={() => {
                      const newDisc = specialDiscPercent === 5 ? 10 : 5;
                      setSpecialDiscPercent(newDisc);
                      addToast(`Special discount adjusted to ${newDisc}%`, 'info');
                    }}
                    isVatEnabled={isVatEnabled}
                    onToggleVat={() => {
                      setIsVatEnabled(!isVatEnabled);
                      addToast(
                        !isVatEnabled ? `Govt VAT (${vatPercent}%) applied` : 'Govt VAT removed (0%)',
                        'info'
                      );
                    }}
                    vatPercent={vatPercent}
                    onChangeVatPercent={setVatPercent}
                    paymentMethod={paymentMethod}
                    onSelectPaymentMethod={(m) => {
                      setPaymentMethod(m);
                      if (m === 'card') addToast('Card POS terminal ready', 'info');
                      if (m === 'mfs') addToast('bKash/Nagad merchant QR active', 'info');
                    }}
                    tenderedAmount={tenderedAmount}
                    onChangeTendered={setTenderedAmount}
                    changeDue={changeDue}
                    onProcessDispense={handleProcessDispense}
                    onPrintThermal={() => setIsThermalModalOpen(true)}
                    onHoldOrder={handleHoldOrder}
                    onAddFefoItem={handleAddFefoItem}
                    selectedDoctor={selectedDoctor}
                    onSelectDoctor={setSelectedDoctor}
                    isBengaliReceipt={isBengaliReceipt}
                    onToggleBengaliReceipt={() => setIsBengaliReceipt(!isBengaliReceipt)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Sub-Module Views inside PharmaPulse Enterprise Layout */}
          {activeTab === 'executive_dashboard' && (
            <div className="w-full">
              <ExecutiveDashboardView onNavigateToTab={(tab) => setActiveTab(tab as PharmaNavTab)} />
            </div>
          )}

          {activeTab === 'prescriptions' && (
            <div className="w-full">
              <PrescriptionView
                onDispenseRxInPOS={(rx) => {
                  setActiveTab('pos');
                  addToast(`Loaded prescription #${rx.id} into active cart`, 'success');
                }}
              />
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="w-full">
              <InventoryView />
            </div>
          )}

          {activeTab === 'purchases' && (
            <div className="w-full">
              <PurchaseOrdersView />
            </div>
          )}

          {activeTab === 'multi_branch' && (
            <div className="w-full">
              <MultiBranchHub onOpenPosForBranch={(_branchId) => setActiveTab('pos')} />
            </div>
          )}

          {activeTab === 'accounts' && (
            <div className="w-full">
              <AccountingAnalyticsView />
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="flex flex-col gap-5 w-full">
              {/* Pharmacy Analytics & Intelligence Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-[#161b26] border border-slate-200 dark:border-slate-800 shadow-xs">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      AI &amp; Real-Time Telemetry
                    </span>
                    <span className="text-xs text-slate-400">• DGDA / Hospital Grade</span>
                  </div>
                  <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    Pharmacy Analytics &amp; Intelligence
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Comprehensive operational intelligence, dynamic AI stock safety thresholds, margins, and sales telemetry.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Multi-Branch Filter Selector */}
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      id="analytics-branch-selector"
                      value={analyticsBranchId}
                      onChange={(e) => setAnalyticsBranchId(e.target.value)}
                      className="pl-8 pr-7 py-2 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none"
                    >
                      <option value="all">🌐 All Branches (Consolidated)</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>
                          🏥 {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => setIsAnomalyModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>AI Inventory Anomalies (5)</span>
                  </button>
                </div>
              </div>

              {/* Operational KPI Metric Strip */}
              <PharmaPulseKpiRow selectedBranchId={analyticsBranchId} />

              {/* Main Analytics Body */}
              <div className="w-full">
                <DashboardView 
                  selectedBranchId={analyticsBranchId}
                  hideHeaderBanner={true}
                  onNavigateTab={(tab) => setActiveTab(tab as PharmaNavTab)} 
                />
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="w-full">
              <RoleManagementView />
            </div>
          )}

          {/* Operations Sub-Menu Views */}
          {activeTab === 'command_center' && (
            <div className="w-full">
              <PharmacyCommandCenter
                onOpenPos={() => setActiveTab('pos')}
                onOpenBarcodeScanner={handleOpenSmartBarcode}
                onOpenPriceHistory={(name) => handleOpenPriceHistory(name || 'Napa 500')}
                onOpenSubstitute={(name) => handleOpenSubstituteForDrug(name || 'Napa 500')}
                onOpenExpiryView={() => setActiveTab('batches_expiry')}
                onNavigateTab={(tab) => setActiveTab(tab as any)}
              />
            </div>
          )}

          {activeTab === 'returns' && (
            <div className="w-full">
              <SalesReturnView />
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="w-full">
              <CustomerManagementView />
            </div>
          )}

          {activeTab === 'adjustments_audit' && (
            <div className="w-full">
              <StockAdjustmentAuditView />
            </div>
          )}

          {activeTab === 'batches_expiry' && (
            <div className="w-full">
              <BatchExpiryView />
            </div>
          )}
        </main>
      </div>

      {/* F10 Dispatch Modal */}
      <F10DispatchModal
        isOpen={isF10ModalOpen}
        onClose={() => setIsF10ModalOpen(false)}
        orderNumber="Order #RX-2026-9041"
        totalAmount={grandTotal}
        customerPhone="+880 1712-9842"
        onConfirmDispatch={handleConfirmF10Dispatch}
      />

      {/* Bengali / English Thermal Receipt Modal */}
      <ThermalReceiptModal
        isOpen={isThermalModalOpen}
        onClose={() => {
          setIsThermalModalOpen(false);
          if (autoPrintThermal) {
            setCart([]);
            setAutoPrintThermal(false);
          }
        }}
        cart={cart}
        subtotal={subtotal}
        discount={discount}
        tax={tax}
        grandTotal={grandTotal}
        orderNumber="RX-2026-9041"
        isBengaliDefault={isBengaliReceipt}
        tenderedAmount={tenderedAmount}
        changeDue={changeDue}
        doctor={selectedDoctor}
        autoPrint={autoPrintThermal}
      />

      {/* DGDA Scheduled Medicine / Prescription Guardrail Warning Modal */}
      <RxWarningModal
        isOpen={isRxWarningModalOpen}
        onClose={() => setIsRxWarningModalOpen(false)}
        restrictedItems={cart.filter((i) => i.isRxRequired)}
        doctors={REGISTERED_DOCTORS}
        selectedDoctor={selectedDoctor}
        onSelectDoctor={(doc) => setSelectedDoctor(doc)}
        onProceedWithDoctor={() => {
          setIsRxWarningModalOpen(false);
          setIsF10ModalOpen(true);
          addToast(`Proceeding with Doctor: ${selectedDoctor?.name || 'Unknown'}`, 'success');
        }}
        onProceedWithOverride={(reason) => {
          setIsRxWarningModalOpen(false);
          setIsF10ModalOpen(true);
          addToast(`Emergency Override Logged: ${reason}`, 'info');
        }}
      />

      {/* Feature ② Generic Substitution Modal with Pharmacist Gate */}
      <GenericSubstitutionModal
        isOpen={substituteTargetItem !== null}
        onClose={() => setSubstituteTargetItem(null)}
        currentItem={substituteTargetItem}
        onSelectSubstitute={(alt) => {
          if (substituteTargetItem) {
            handleSelectSubstitute(substituteTargetItem, alt);
          }
        }}
      />

      {/* Feature ① Smart Barcode Modal */}
      <SmartBarcodeModal
        isOpen={isSmartBarcodeModalOpen}
        onClose={() => setIsSmartBarcodeModalOpen(false)}
        onAddToCart={handleAddFromSmartBarcode}
        onOpenSubstituteForUnavailable={handleOpenSubstituteForDrug}
        onOpenPriceHistory={handleOpenPriceHistory}
      />

      {/* Feature ③ Price History Modal */}
      <PriceHistoryModal
        isOpen={isPriceHistoryModalOpen}
        onClose={() => setIsPriceHistoryModalOpen(false)}
        initialMedicineName={priceHistoryTargetDrug}
      />

      {/* Feature ④ AI Forecast Dynamic Inventory Anomaly Modal */}
      <InventoryAnomalyModal
        isOpen={isAnomalyModalOpen}
        onClose={() => setIsAnomalyModalOpen(false)}
        onToast={addToast}
      />
    </div>
  );
};
