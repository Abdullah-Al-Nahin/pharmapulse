'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  Barcode,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  Smartphone,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
  FileText,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Wifi,
  Keyboard,
  Layers,
  Sparkles,
  MapPin,
  X,
  ArrowRight,
  Package,
  Boxes,
  RotateCcw,
  Check,
  Building2,
  Calendar,
  DollarSign,
  User,
  Phone,
  Stethoscope,
  Percent,
  Receipt,
  Award,
  Users,
  Building,
  Tag,
  Mail,
  Send,
  Printer
} from 'lucide-react';
import {
  Medicine,
  Batch,
  POSCartItem,
  Sale,
  HeldSale,
  Prescription
} from '../../types/pharmacy';
import { Customer, PricingTier } from '../../types/customer';
import { CustomerService } from '../../services/customerService';
import { calculateTierPrice } from '../../utils/pricingEngine';
import { PharmacyService } from '../../services/pharmacyService';
import { ReceiptModal } from '../common/ReceiptModal';
import { batchApi } from '../../lib/api';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatNumber, formatDate, getCurrentLocale } from '../../utils/i18nFormatter';
import { Lock, KeyRound } from 'lucide-react';

interface POSViewProps {
  onSaleCompleted?: () => void;
  initialPrescription?: Prescription | null;
  onClearInitialPrescription?: () => void;
  onHeldCountChange?: (count: number) => void;
}

type PaymentTab = 'cash' | 'mobile' | 'card' | 'split' | 'due_credit';
type MobileProvider = 'bKash' | 'Nagad' | 'Rocket' | 'Other';
type CardNetwork = 'Visa' | 'Mastercard' | 'Amex' | 'POS';

export const POSView: React.FC<POSViewProps> = ({
  onSaleCompleted,
  initialPrescription,
  onClearInitialPrescription,
  onHeldCountChange
}) => {
  const { t } = useTranslation();
  const locale = getCurrentLocale();

  // --- Master Catalog & Local State ---
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);

  // --- Header Live Status ---
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [isCashDrawerOpen, setIsCashDrawerOpen] = useState(false);
  const [tillCashBalance] = useState<number>(0);

  // --- RBAC & Security Guardrails ---
  const { user, canViewCosts, canViewProfits, maxDiscountPercent, checkDiscountAllowed } = usePermission();
  const { currentUser, isSuperAdmin } = useAuth();
  const isAdmin = isSuperAdmin || currentUser?.roleCode === 'admin' || currentUser?.roleCode === 'super_admin' || currentUser?.roleName === 'Super Admin' || user?.roleCode === 'admin' || user?.roleCode === 'super_admin';
  const [adminPinInput, setAdminPinInput] = useState('');
  const [isAdminPinAuthorized, setIsAdminPinAuthorized] = useState(false);
  const [adminPinError, setAdminPinError] = useState('');

  const [managerOverrideModal, setManagerOverrideModal] = useState<{
    isOpen: boolean;
    requestedDiscount: number;
    type: 'order' | 'item';
    itemIndex?: number;
  } | null>(null);
  const [managerPin, setManagerPin] = useState('');
  const [managerPinError, setManagerPinError] = useState('');

  // --- Customer & Prescriber Details ---
  const [customerName, setCustomerName] = useState('Walk-In Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | undefined>(undefined);
  const [orderDiscountPercent, setOrderDiscountPercent] = useState<number>(0);

  // --- Customer, Multi-Tier Pricing, Credit Limit & Loyalty Management ---
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [redeemedPoints, setRedeemedPoints] = useState<number>(0);

  // --- Search & Navigation ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [highlightedSearchIndex, setHighlightedSearchIndex] = useState<number>(-1);

  // --- Modals ---
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [showRxModal, setShowRxModal] = useState(false);
  const [showBatchSelectorForIndex, setShowBatchSelectorForIndex] = useState<number | null>(null);
  const [expiredLockoutAlert, setExpiredLockoutAlert] = useState<{
    medicineName: string;
    batchNumber?: string;
    reason: string;
  } | null>(null);
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);
  const [f10ConfirmationSale, setF10ConfirmationSale] = useState<Sale | null>(null);
  const [eReceiptDeliveryMode, setEReceiptDeliveryMode] = useState<'both' | 'fiscal_only' | 'sms_only' | 'email_only'>('both');
  const [eReceiptPhone, setEReceiptPhone] = useState<string>('');
  const [eReceiptEmail, setEReceiptEmail] = useState<string>('');
  const [eReceiptSending, setEReceiptSending] = useState<boolean>(false);
  const [eReceiptSentMsg, setEReceiptSentMsg] = useState<string | null>(null);
  const [showRecentInvoicesModal, setShowRecentInvoicesModal] = useState(false);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');

  const handleOpenRecentInvoices = () => {
    setRecentSales(PharmacyService.getSales());
    setInvoiceSearchQuery('');
    setShowRecentInvoicesModal(true);
  };

  // --- Split & Single Payment State ---
  const [paymentTab, setPaymentTab] = useState<PaymentTab>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');

  // Split Breakdown
  const [splitCashAmount, setSplitCashAmount] = useState<string>('0');
  const [splitMobileAmount, setSplitMobileAmount] = useState<string>('0');
  const [splitMobileProvider, setSplitMobileProvider] = useState<MobileProvider>('bKash');
  const [splitMobileTrxId, setSplitMobileTrxId] = useState<string>('');
  const [splitCardAmount, setSplitCardAmount] = useState<string>('0');
  const [splitCardNetwork, setSplitCardNetwork] = useState<CardNetwork>('Visa');
  const [splitCardAuthCode, setSplitCardAuthCode] = useState<string>('');

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);

  // --- Initialize Data ---
  const loadData = useCallback(() => {
    setMedicines(PharmacyService.getMedicines());
    setBatches(PharmacyService.getBatches());
    setHeldSales(PharmacyService.getHeldSales());
    setCustomers(CustomerService.getCustomers());
  }, []);

  useEffect(() => {
    loadData();

    // Clock
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [loadData]);

  // Sync held count to parent
  useEffect(() => {
    if (onHeldCountChange) {
      onHeldCountChange(heldSales.length);
    }
  }, [heldSales, onHeldCountChange]);

  // Initial Prescription dispenser handler
  useEffect(() => {
    if (initialPrescription && medicines.length > 0) {
      handleDispensePrescription(initialPrescription);
      if (onClearInitialPrescription) {
        onClearInitialPrescription();
      }
    }
  }, [initialPrescription, medicines]);

  // --- Cart Financial Calculations with Loyalty Points Offset ---
  const loyaltyConfig = useMemo(() => CustomerService.getLoyaltyConfig(), []);

  const cartSummary = useMemo(() => {
    const rawSubtotal = cart.reduce((acc, it) => acc + (it.unitPrice * it.quantity), 0);
    const itemDiscountTotal = cart.reduce(
      (acc, it) => acc + ((it.unitPrice * it.quantity * it.discountPercent) / 100),
      0
    );
    const subtotalAfterItemDisc = rawSubtotal - itemDiscountTotal;
    const globalOrderDiscount = (subtotalAfterItemDisc * Math.max(0, Math.min(100, orderDiscountPercent))) / 100;
    const totalDiscount = itemDiscountTotal + globalOrderDiscount;

    // Loyalty Discount calculation: 1 point = loyaltyConfig.redemptionRatePerPoint ($0.25)
    const maxLoyaltyOffset = (subtotalAfterItemDisc * loyaltyConfig.maxRedemptionPercentagePerOrder) / 100;
    const requestedLoyaltyValue = redeemedPoints * loyaltyConfig.redemptionRatePerPoint;
    const loyaltyDiscountAmount = Math.round(Math.min(requestedLoyaltyValue, maxLoyaltyOffset, subtotalAfterItemDisc) * 100) / 100;

    const taxTotal = cart.reduce((acc, it) => acc + it.taxAmount, 0);
    const netPayableRaw = Math.max(0, rawSubtotal - totalDiscount - loyaltyDiscountAmount + taxTotal);
    const netPayable = Math.round(netPayableRaw * 100) / 100;
    const roundOff = Math.round((netPayable - netPayableRaw) * 100) / 100;

    const totalCost = cart.reduce((acc, it) => acc + (it.unitCost * it.quantity), 0);
    const estimatedGrossMargin = Math.max(0, netPayable - taxTotal - totalCost);
    const totalUnits = cart.reduce((acc, it) => acc + it.quantity, 0);

    return {
      rawSubtotal,
      itemDiscountTotal,
      globalOrderDiscount,
      totalDiscount,
      loyaltyDiscountAmount,
      taxTotal,
      netPayable,
      roundOff,
      totalCost,
      estimatedGrossMargin,
      totalUnits,
      itemCount: cart.length
    };
  }, [cart, orderDiscountPercent, redeemedPoints, loyaltyConfig]);

  // Credit Limit Check & Instant Warning Calculation
  const creditCheck = useMemo(() => {
    if (!selectedCustomer) return null;
    return CustomerService.checkCreditLimit(selectedCustomer.id, cartSummary.netPayable);
  }, [selectedCustomer, cartSummary.netPayable]);

  // Handle Customer Selection & Dynamic Pricing Recalculation
  const handleSelectCustomer = (cust: Customer | null) => {
    setSelectedCustomer(cust);
    setRedeemedPoints(0);
    if (!cust) {
      setCustomerName('Walk-In Customer');
      setCustomerPhone('');
    } else {
      setCustomerName(cust.name);
      setCustomerPhone(cust.phone);
    }

    // Dynamic Multi-Tier Pricing: Recalculate cart item prices based on customer's assigned pricing tier!
    const targetTier: PricingTier = cust ? cust.pricingTier : 'retail';
    setCart((prevCart) =>
      prevCart.map((item) => {
        const batch = batches.find((b) => b.id === item.batchId);
        if (!batch) return item;
        const packSize = item.packSize || 10;
        const isBox = (item.unitType || 'box') === 'box';
        const pricing = calculateTierPrice(batch, targetTier);
        const unitPrice = isBox
          ? pricing.unitPrice
          : Math.round((pricing.unitPrice / packSize) * 100) / 100;
        const netUnit = unitPrice * (1 - item.discountPercent / 100);
        const subtotal = unitPrice * item.quantity;
        const taxAmount = (netUnit * item.quantity * item.taxRate) / 100;
        const total = netUnit * item.quantity + taxAmount;
        return {
          ...item,
          unitPrice,
          subtotal,
          taxAmount,
          total,
        };
      })
    );
    setShowCustomerModal(false);
  };

  // Initialize Payment Fields when Payment Modal Opens
  useEffect(() => {
    if (showPaymentModal) {
      setCashTendered(cartSummary.netPayable.toString());
      setSplitCashAmount(cartSummary.netPayable.toString());
      setSplitMobileAmount('0');
      setSplitCardAmount('0');
      setSplitMobileTrxId('');
      setSplitCardAuthCode('');
      setTimeout(() => {
        cashInputRef.current?.focus();
        cashInputRef.current?.select();
      }, 50);
    }
  }, [showPaymentModal, cartSummary.netPayable]);

  // --- Search Catalog Engine ---
  const filteredMedicines = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return medicines.filter((m) => {
      const matchCat = selectedCategory === 'All' || m.category === selectedCategory;
      if (!query) return matchCat;

      const matchName = (m.name || '').toLowerCase().includes(query);
      const matchGeneric = (m.genericName || '').toLowerCase().includes(query);
      const matchBrand = (m.brandName || '').toLowerCase().includes(query);
      const matchRack = (m.rackLocation || '').toLowerCase().includes(query);

      // Search inside batches for barcode or batch number match
      const medBatches = batches.filter((b) => b.medicineId === m.id);
      const matchBatch = medBatches.some(
        (b) =>
          (b.batchNumber || '').toLowerCase().includes(query) ||
          (b.barcode && b.barcode.toLowerCase().includes(query))
      );

      return (matchName || matchGeneric || matchBrand || matchRack || matchBatch) && matchCat;
    });
  }, [medicines, batches, searchQuery, selectedCategory]);

  // --- Add Medicine to Cart (FEFO Prioritized) ---
  const handleAddMedicineToCart = (med: Medicine, forcedBatch?: Batch, unitType: 'box' | 'pcs' = 'box') => {
    // FEFO Batch Selection isolated to active branch
    const assignedBatch = forcedBatch || PharmacyService.getFefoBatchForMedicine(med.id, currentUser?.branchId).batch;

    if (!assignedBatch) {
      const fefoInfo = PharmacyService.getFefoBatchForMedicine(med.id, currentUser?.branchId);
      if (fefoInfo.allStockExpired) {
        setExpiredLockoutAlert({
          medicineName: med.name,
          reason: `ALL batches for "${med.name}" are expired (${fefoInfo.expiredBatchesCount} batches). Regulatory safety lock strictly blocks dispensing expired pharmaceuticals.`
        });
      } else {
        alert(`Out of stock: No available active batch for "${med.name}".`);
      }
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (assignedBatch.expiryDate <= todayStr || assignedBatch.status === 'expired') {
      setExpiredLockoutAlert({
        medicineName: med.name,
        batchNumber: assignedBatch.batchNumber,
        reason: `Batch ${assignedBatch.batchNumber} has expired on ${assignedBatch.expiryDate}. Zero-tolerance lockout strictly prevents dispensing expired drugs.`
      });
      return;
    }

    const packSize = med.packSize || 10;
    const isBox = unitType === 'box';

    // Dynamic Multi-Tier Pricing: resolve tier price based on assigned customer tier
    const activeTier: PricingTier = selectedCustomer ? selectedCustomer.pricingTier : 'retail';
    const tierPricing = calculateTierPrice(assignedBatch, activeTier);
    const baseSellingPrice = tierPricing.unitPrice;
    const unitPrice = isBox ? baseSellingPrice : Math.round((baseSellingPrice / packSize) * 100) / 100;
    const unitCost = isBox ? assignedBatch.purchasePrice : Math.round((assignedBatch.purchasePrice / packSize) * 100) / 100;
    const mrp = isBox ? assignedBatch.mrp : Math.round((assignedBatch.mrp / packSize) * 100) / 100;

    // Check if already in cart with same batch and unitType
    const existingIndex = cart.findIndex(
      (c) => c.medicineId === med.id && c.batchId === assignedBatch.id && (c.unitType || 'box') === unitType
    );

    const diffDays = Math.ceil(
      (new Date(assignedBatch.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    if (existingIndex >= 0) {
      const existing = cart[existingIndex];
      const nextQty = existing.quantity + 1;
      const stockCeiling = isBox ? Math.floor(assignedBatch.currentStock / packSize) || 1 : assignedBatch.currentStock;

      if (nextQty > stockCeiling) {
        alert(`Cannot exceed available batch stock (${stockCeiling} ${unitType === 'box' ? 'Boxes' : 'Pcs'}).`);
        return;
      }
      updateCartItemQty(existingIndex, nextQty);
    } else {
      const discountPercent = 0;
      const netUnit = unitPrice * (1 - discountPercent / 100);
      const taxAmount = (netUnit * med.taxRate) / 100;
      const total = netUnit + taxAmount;

      const newItem: POSCartItem = {
        id: `pos-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        medicineId: med.id,
        medicineName: med.name,
        genericName: med.genericName,
        strength: med.strength,
        dosageForm: med.dosageForm,
        rackLocation: med.rackLocation,
        requiresPrescription: med.requiresPrescription,

        batchId: assignedBatch.id,
        batchNumber: assignedBatch.batchNumber,
        expiryDate: assignedBatch.expiryDate,
        currentBatchStock: assignedBatch.currentStock,
        isExpired: false,
        daysToExpiry: diffDays,

        unitType,
        packSize,

        quantity: 1,
        unitPrice,
        unitCost,
        mrp,
        discountPercent: 0,
        taxRate: med.taxRate,
        subtotal: unitPrice,
        taxAmount,
        total
      };

      setCart((prev) => [...prev, newItem]);
    }

    setSearchQuery('');
    setHighlightedSearchIndex(-1);
    searchInputRef.current?.focus();
  };

  // --- Cart Item Management ---
  const updateCartItemQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }
    const item = cart[index];
    const isBox = (item.unitType || 'box') === 'box';
    const packSize = item.packSize || 10;
    const maxStock = isBox ? Math.floor(item.currentBatchStock / packSize) || 1 : item.currentBatchStock;

    if (newQty > maxStock) {
      alert(`Cannot exceed batch stock (${maxStock} ${isBox ? 'Boxes' : 'Pcs'}).`);
      return;
    }

    const netUnit = item.unitPrice * (1 - item.discountPercent / 100);
    const subtotal = item.unitPrice * newQty;
    const taxAmount = (netUnit * newQty * item.taxRate) / 100;
    const total = netUnit * newQty + taxAmount;

    const updated = [...cart];
    updated[index] = {
      ...item,
      quantity: newQty,
      subtotal,
      taxAmount,
      total
    };
    setCart(updated);
  };

  const toggleCartItemUnit = (index: number) => {
    const item = cart[index];
    const newUnit: 'box' | 'pcs' = (item.unitType || 'box') === 'box' ? 'pcs' : 'box';
    const packSize = item.packSize || 10;

    // Find original batch to recalculate correct pricing
    const batch = batches.find((b) => b.id === item.batchId);
    if (!batch) return;

    const isNowBox = newUnit === 'box';
    const activeTier: PricingTier = selectedCustomer ? selectedCustomer.pricingTier : 'retail';
    const tierPricing = calculateTierPrice(batch, activeTier);
    const unitPrice = isNowBox ? tierPricing.unitPrice : Math.round((tierPricing.unitPrice / packSize) * 100) / 100;
    const unitCost = isNowBox ? batch.purchasePrice : Math.round((batch.purchasePrice / packSize) * 100) / 100;
    const mrp = isNowBox ? batch.mrp : Math.round((batch.mrp / packSize) * 100) / 100;

    // Convert quantity reasonably
    const nextQty = isNowBox ? Math.max(1, Math.floor(item.quantity / packSize) || 1) : item.quantity * packSize;

    const netUnit = unitPrice * (1 - item.discountPercent / 100);
    const subtotal = unitPrice * nextQty;
    const taxAmount = (netUnit * nextQty * item.taxRate) / 100;
    const total = netUnit * nextQty + taxAmount;

    const updated = [...cart];
    updated[index] = {
      ...item,
      unitType: newUnit,
      quantity: nextQty,
      unitPrice,
      unitCost,
      mrp,
      subtotal,
      taxAmount,
      total
    };
    setCart(updated);
  };

  const updateCartItemDiscount = (index: number, discountPercent: number) => {
    const item = cart[index];
    const clampedDiscount = Math.max(0, Math.min(100, discountPercent));
    const netUnit = item.unitPrice * (1 - clampedDiscount / 100);
    const subtotal = item.unitPrice * item.quantity;
    const taxAmount = (netUnit * item.quantity * item.taxRate) / 100;
    const total = netUnit * item.quantity + taxAmount;

    const updated = [...cart];
    updated[index] = {
      ...item,
      discountPercent: clampedDiscount,
      subtotal,
      taxAmount,
      total
    };
    setCart(updated);
  };

  // Guardrail Handlers for Discount Thresholds (e.g. Cashier max 5%)
  const handleAttemptItemDiscount = (index: number, discountPercent: number) => {
    const check = checkDiscountAllowed(discountPercent);
    if (!check.allowed) {
      setManagerOverrideModal({
        isOpen: true,
        requestedDiscount: discountPercent,
        type: 'item',
        itemIndex: index,
      });
      setManagerPin('');
      setManagerPinError('');
      return;
    }
    updateCartItemDiscount(index, discountPercent);
  };

  const handleAttemptOrderDiscount = (discountPercent: number) => {
    const check = checkDiscountAllowed(discountPercent);
    if (!check.allowed) {
      setManagerOverrideModal({
        isOpen: true,
        requestedDiscount: discountPercent,
        type: 'order',
      });
      setManagerPin('');
      setManagerPinError('');
      return;
    }
    setOrderDiscountPercent(discountPercent);
  };

  const handleAuthorizeManagerOverride = () => {
    const validPins = ['9999', '1234', '8888'];
    if (!validPins.includes(managerPin.trim())) {
      setManagerPinError('Invalid Manager Authorization PIN.');
      return;
    }

    if (managerOverrideModal) {
      if (managerOverrideModal.type === 'order') {
        setOrderDiscountPercent(managerOverrideModal.requestedDiscount);
      } else if (managerOverrideModal.type === 'item' && managerOverrideModal.itemIndex !== undefined) {
        updateCartItemDiscount(managerOverrideModal.itemIndex, managerOverrideModal.requestedDiscount);
      }
    }

    setManagerOverrideModal(null);
    setManagerPin('');
    setManagerPinError('');
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedPrescriptionId(undefined);
    setDoctorName('');
    setOrderDiscountPercent(0);
  };

  // --- Change Batch in Cart ---
  const handleSelectBatch = (cartIndex: number, newBatch: Batch) => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (newBatch.expiryDate <= todayStr || newBatch.status === 'expired') {
      setExpiredLockoutAlert({
        medicineName: newBatch.medicineName,
        batchNumber: newBatch.batchNumber,
        reason: `Batch #${newBatch.batchNumber} has expired on ${newBatch.expiryDate}. Regulators forbid dispensing expired medication.`
      });
      return;
    }

    const item = cart[cartIndex];
    const diffDays = Math.ceil(
      (new Date(newBatch.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    const isBox = (item.unitType || 'box') === 'box';
    const packSize = item.packSize || 10;
    const unitPrice = isBox ? newBatch.sellingPrice : Math.round((newBatch.sellingPrice / packSize) * 100) / 100;
    const unitCost = isBox ? newBatch.purchasePrice : Math.round((newBatch.purchasePrice / packSize) * 100) / 100;
    const mrp = isBox ? newBatch.mrp : Math.round((newBatch.mrp / packSize) * 100) / 100;

    const netUnit = unitPrice * (1 - item.discountPercent / 100);
    const subtotal = unitPrice * item.quantity;
    const taxAmount = (netUnit * item.quantity * item.taxRate) / 100;
    const total = netUnit * item.quantity + taxAmount;

    const updated = [...cart];
    updated[cartIndex] = {
      ...item,
      batchId: newBatch.id,
      batchNumber: newBatch.batchNumber,
      expiryDate: newBatch.expiryDate,
      currentBatchStock: newBatch.currentStock,
      daysToExpiry: diffDays,
      unitPrice,
      unitCost,
      mrp,
      subtotal,
      taxAmount,
      total
    };

    setCart(updated);
    setShowBatchSelectorForIndex(null);
  };

  // --- Hold & Recall (F8) ---
  const handleHoldSale = () => {
    if (cart.length === 0) return;
    const held = PharmacyService.holdSale(cart, customerName);
    setHeldSales(PharmacyService.getHeldSales());
    clearCart();
    alert(`Active cart ticket held as [${held.holdNumber}]. You can recall it anytime with F8.`);
  };

  const handleRecallSale = (held: HeldSale) => {
    setCart(held.items);
    setCustomerName(held.customerName);
    PharmacyService.removeHeldSale(held.id);
    setHeldSales(PharmacyService.getHeldSales());
    setShowHeldModal(false);
  };

  // --- Dispense from Prescription ---
  const handleDispensePrescription = (rx: Prescription) => {
    const newCartItems: POSCartItem[] = [];
    let hasLockouts = false;

    rx.medications.forEach((medItem) => {
      const med = medicines.find(
        (m) =>
          m.id === medItem.medicineId ||
          m.name.toLowerCase() === medItem.medicineName.toLowerCase()
      );
      if (!med) return;

      const fefoResult = PharmacyService.getFefoBatchForMedicine(med.id, currentUser?.branchId);
      if (fefoResult.allStockExpired || !fefoResult.batch) {
        hasLockouts = true;
        return;
      }

      const assignedBatch = fefoResult.batch;
      const qty = Math.min(medItem.quantity, assignedBatch.currentStock);
      const unitPrice = assignedBatch.sellingPrice;
      const netUnit = unitPrice;
      const taxAmount = (netUnit * qty * med.taxRate) / 100;
      const total = netUnit * qty + taxAmount;

      newCartItems.push({
        id: `cart-rx-${Date.now()}-${Math.random()}`,
        medicineId: med.id,
        medicineName: med.name,
        genericName: med.genericName,
        strength: med.strength,
        dosageForm: med.dosageForm,
        rackLocation: med.rackLocation,
        requiresPrescription: true,
        batchId: assignedBatch.id,
        batchNumber: assignedBatch.batchNumber,
        expiryDate: assignedBatch.expiryDate,
        currentBatchStock: assignedBatch.currentStock,
        isExpired: false,
        daysToExpiry: fefoResult.nearestExpiryDays || 0,
        unitType: 'box',
        packSize: med.packSize || 10,
        quantity: qty,
        unitPrice: assignedBatch.sellingPrice,
        unitCost: assignedBatch.purchasePrice,
        mrp: assignedBatch.mrp,
        discountPercent: 0,
        taxRate: med.taxRate,
        subtotal: unitPrice * qty,
        taxAmount,
        total
      });
    });

    if (newCartItems.length > 0) {
      setCart(newCartItems);
      setCustomerName(rx.patientName);
      setCustomerPhone(rx.patientPhone);
      setDoctorName(`${rx.doctorName} (${rx.clinicHospital})`);
      setSelectedPrescriptionId(rx.id);
      setShowRxModal(false);

      if (hasLockouts) {
        alert('Some prescribed items were omitted due to zero stock or expired batches.');
      }
    } else {
      alert('Could not dispense: All items in this prescription are out of stock or expired.');
    }
  };

  // --- Complete Checkout (F10) ---
  const handleCompleteCheckout = async () => {
    if (cart.length === 0) return;

    let finalPaymentMethod: 'cash' | 'card' | 'upi_mobile' | 'bkash_nagad' | 'split' | 'due_credit' = 'cash';
    let tenderedCash = 0;
    let changeGiven = 0;
    let splitDetailsObj = undefined;

    if (paymentTab === 'cash') {
      finalPaymentMethod = 'cash';
      tenderedCash = parseFloat(cashTendered) || cartSummary.netPayable;
      if (tenderedCash < cartSummary.netPayable) {
        alert(`Insufficient cash tendered. Total net payable is ৳${cartSummary.netPayable.toFixed(2)}.`);
        return;
      }
      changeGiven = Math.max(0, tenderedCash - cartSummary.netPayable);
    } else if (paymentTab === 'mobile') {
      finalPaymentMethod = 'upi_mobile';
      splitDetailsObj = {
        mobileAmount: cartSummary.netPayable,
        mobileProvider: splitMobileProvider,
        mobileTrxId: splitMobileTrxId || `TRX-${Math.floor(100000 + Math.random() * 900000)}`
      };
    } else if (paymentTab === 'card') {
      finalPaymentMethod = 'card';
      splitDetailsObj = {
        cardAmount: cartSummary.netPayable,
        cardType: splitCardNetwork,
        cardAuthCode: splitCardAuthCode || `AUTH-${Math.floor(1000 + Math.random() * 9000)}`
      };
    } else if (paymentTab === 'split') {
      finalPaymentMethod = 'split';
      const c = parseFloat(splitCashAmount) || 0;
      const m = parseFloat(splitMobileAmount) || 0;
      const card = parseFloat(splitCardAmount) || 0;
      const totalSplitPaid = c + m + card;

      if (totalSplitPaid < cartSummary.netPayable - 0.01) {
        alert(
          `Incomplete Split Tender: Total paid (৳${totalSplitPaid.toFixed(2)}) is less than Net Payable (৳${cartSummary.netPayable.toFixed(2)}).`
        );
        return;
      }

      tenderedCash = c;
      changeGiven = Math.max(0, totalSplitPaid - cartSummary.netPayable);

      splitDetailsObj = {
        cashAmount: c,
        mobileAmount: m,
        mobileProvider: splitMobileProvider,
        mobileTrxId: splitMobileTrxId || (m > 0 ? `TRX-${Math.floor(100000 + Math.random() * 900000)}` : undefined),
        cardAmount: card,
        cardType: splitCardNetwork,
        cardAuthCode: splitCardAuthCode || (card > 0 ? `AUTH-${Math.floor(1000 + Math.random() * 9000)}` : undefined)
      };
    } else if (paymentTab === 'due_credit') {
      if (!isAdmin && !isAdminPinAuthorized) {
        alert('অননুমোদিত অ্যাক্সেস: ADMIN প্যানেল ব্যাতিত অন্য কেউ বাকিতে বিল করতে পারবে না। (Unauthorized: Credit/Due billing is restricted to Admin only).');
        return;
      }
      if (!selectedCustomer) {
        alert('Please select a registered customer profile to bill on Credit / Due Account.');
        return;
      }
      if (creditCheck && !creditCheck.allowed) {
        alert(
          `Credit Limit Exceeded! Customer credit ceiling is ৳${creditCheck.creditLimit.toFixed(2)}. Projected total due would be ৳${creditCheck.projectedBalance.toFixed(2)}.`
        );
        return;
      }
      finalPaymentMethod = 'due_credit';
    }

    const newSale: Sale = {
      id: `sale-${Date.now()}`,
      invoiceNumber: `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      customerId: selectedCustomer?.id,
      customerName: customerName || 'Walk-In Customer',
      customerPhone: customerPhone || undefined,
      pricingTier: selectedCustomer?.pricingTier || 'retail',
      prescriptionId: selectedPrescriptionId,
      doctorName: doctorName || undefined,
      items: cart.map((item) => ({
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        genericName: item.genericName,
        batchId: item.batchId,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        unitType: item.unitType,
        packSize: item.packSize,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        mrp: item.mrp,
        discountPercent: item.discountPercent,
        taxRate: item.taxRate,
        subtotal: item.subtotal,
        taxAmount: item.taxAmount,
        total: item.total
      })),
      subtotal: cartSummary.rawSubtotal,
      discountTotal: cartSummary.totalDiscount,
      loyaltyPointsRedeemed: redeemedPoints > 0 ? redeemedPoints : undefined,
      loyaltyDiscountAmount: cartSummary.loyaltyDiscountAmount > 0 ? cartSummary.loyaltyDiscountAmount : undefined,
      taxTotal: cartSummary.taxTotal,
      grandTotal: cartSummary.netPayable,
      totalCost: cartSummary.totalCost,
      grossProfit: cartSummary.estimatedGrossMargin,
      paymentMethod: finalPaymentMethod,
      dueAmount: finalPaymentMethod === 'due_credit' ? cartSummary.netPayable : undefined,
      cashTendered: tenderedCash > 0 ? tenderedCash : undefined,
      changeGiven: changeGiven > 0 ? changeGiven : undefined,
      splitDetails: splitDetailsObj,
      paymentStatus: finalPaymentMethod === 'due_credit' ? 'due' : 'completed',
      cashierName: user ? `${user.name} (${user.roleName})` : (currentUser ? `${currentUser.name} (${currentUser.roleName})` : 'Duty Pharmacist'),
      branchId: currentUser?.branchId || (user as any)?.branchId || 'main',
      branchName: currentUser?.branchName || (user as any)?.branchName || 'Main Branch',
    };

    // Deduct inventory & persist locally
    PharmacyService.completeSale(newSale);

    // Sync updated stock to Backend API
    const updatedBatches = PharmacyService.getBatches();
    for (const item of newSale.items) {
      const b = updatedBatches.find(batch => batch.id === item.batchId);
      if (b) {
        try {
          await batchApi.updateBatch(b.id, { currentStock: b.currentStock, status: b.status });
        } catch (e) {
          console.error("Failed to sync stock deduction to database", e);
        }
      }
    }

    // Customer Ledger & Loyalty Points Update
    if (selectedCustomer) {
      if (finalPaymentMethod === 'due_credit') {
        CustomerService.recordCreditSale({
          customerId: selectedCustomer.id,
          invoiceNumber: newSale.invoiceNumber,
          totalAmount: newSale.grandTotal,
          amountPaidNow: 0,
          dueAmount: newSale.grandTotal,
          collectedBy: user ? `${user.name} (${user.roleName || user.role})` : 'POS Cashier',
          notes: `POS credit sale - Invoice #${newSale.invoiceNumber}`,
        });
      } else {
        const earned = CustomerService.awardLoyaltyPoints(
          selectedCustomer.id,
          newSale.invoiceNumber,
          newSale.grandTotal,
          user ? `${user.name}` : 'POS Cashier'
        );
        if (earned && earned.pointsEarned > 0) {
          newSale.loyaltyPointsEarned = earned.pointsEarned;
        }
      }

      if (redeemedPoints > 0) {
        CustomerService.redeemLoyaltyPoints(
          selectedCustomer.id,
          redeemedPoints,
          newSale.invoiceNumber,
          user ? `${user.name}` : 'POS Cashier'
        );
      }
    }

    setShowPaymentModal(false);
    setRedeemedPoints(0);
    clearCart();
    loadData();

    // Trigger F10 Confirmation Dialog (Print Fiscal Receipt vs E-Receipt via SMS/Email)
    setF10ConfirmationSale(newSale);
    setEReceiptPhone(customerPhone || selectedCustomer?.phone || '+880 1712-984210');
    setEReceiptEmail(selectedCustomer?.email || 'patient.care@dhakahospital.org');
    setEReceiptDeliveryMode('both');
    setEReceiptSentMsg(null);

    if (onSaleCompleted) {
      onSaleCompleted();
    }
  };

  // --- Keyboard Shortcut Listener (F2, F8, F9, F10, ESC) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2: Focus Search / Barcode Bar
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        setIsSearchFocused(true);
      }
      // F7: Open Invoices & Thermal/A4 Reprint
      else if (e.key === 'F7') {
        e.preventDefault();
        handleOpenRecentInvoices();
      }
      // F8: Hold / Recall Cart
      else if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0) {
          handleHoldSale();
        } else {
          setShowHeldModal(true);
        }
      }
      // F9: Open Payment Modal
      else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) {
          setShowPaymentModal(true);
        }
      }
      // F10: Complete Checkout or Print
      else if (e.key === 'F10') {
        e.preventDefault();
        if (cart.length > 0) {
          if (!showPaymentModal) {
            setShowPaymentModal(true);
          } else {
            handleCompleteCheckout();
          }
        }
      }
      // ESC: Close open modals or clear search
      else if (e.key === 'Escape') {
        if (showRecentInvoicesModal) setShowRecentInvoicesModal(false);
        else if (showPaymentModal) setShowPaymentModal(false);
        else if (showHeldModal) setShowHeldModal(false);
        else if (showRxModal) setShowRxModal(false);
        else if (showBatchSelectorForIndex !== null) setShowBatchSelectorForIndex(null);
        else if (expiredLockoutAlert) setExpiredLockoutAlert(null);
        else if (searchQuery) {
          setSearchQuery('');
          setHighlightedSearchIndex(-1);
        }
      }
      // Arrow navigation in search dropdown
      else if (isSearchFocused && filteredMedicines.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHighlightedSearchIndex((prev) => (prev < filteredMedicines.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHighlightedSearchIndex((prev) => (prev > 0 ? prev - 1 : filteredMedicines.length - 1));
        } else if (e.key === 'Enter' && highlightedSearchIndex >= 0) {
          e.preventDefault();
          const target = filteredMedicines[highlightedSearchIndex];
          if (target) {
            handleAddMedicineToCart(target);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cart,
    showPaymentModal,
    showHeldModal,
    showRxModal,
    showBatchSelectorForIndex,
    expiredLockoutAlert,
    searchQuery,
    isSearchFocused,
    highlightedSearchIndex,
    filteredMedicines
  ]);

  // Expiry color helper
  const getExpiryColorBadge = (expiryDateStr: string) => {
    const today = new Date();
    const exp = new Date(expiryDateStr);
    const days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (days <= 0) {
      return {
        bg: 'bg-rose-100 text-rose-800 border-rose-300',
        text: 'Expired',
        dot: 'bg-rose-600',
        days
      };
    }
    if (days <= 30) {
      return {
        bg: 'bg-red-100 text-red-800 border-red-300',
        text: `< ${days}d (Critical)`,
        dot: 'bg-red-600',
        days
      };
    }
    if (days <= 90) {
      return {
        bg: 'bg-amber-100 text-amber-800 border-amber-300',
        text: `${days}d (Alert)`,
        dot: 'bg-amber-500',
        days
      };
    }
    return {
      bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      text: `${days}d (Safe)`,
      dot: 'bg-emerald-500',
      days
    };
  };

  const pendingPrescriptions = PharmacyService.getPrescriptions().filter((r) => r.status !== 'dispensed');

  return (
    <div className="flex-1 flex flex-col bg-slate-100 overflow-hidden min-h-[calc(100vh-68px)]">
      
      {/* ========================================================================= */}
      {/* 1. TOP BAR: Quick Status, Cash Register Indicator, Hotkey Guides         */}
      {/* ========================================================================= */}
      <header className="bg-slate-900 border-b border-slate-800 text-white px-4 py-2.5 shadow-md shrink-0 select-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Left: Quick Status & Register Indicator */}
          <div className="flex items-center gap-3">
            {/* Live Register Indicator */}
            <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-lg">
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-bold text-xs text-white">Register #{currentUser?.branchId === 'HQ-MAIN' ? '01' : '02'}</span>
                  <span className="text-[10px] text-emerald-400 font-medium">ONLINE</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {currentUser?.branchName || 'Main Branch'}
                </span>
              </div>
            </div>

            {/* Shift & Pharmacist Indicator */}
            <div className="hidden sm:flex items-center gap-2 border-l border-slate-800 pl-3">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
                {(currentUser?.name || user?.name || 'PH').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-200 leading-none">{currentUser?.name || user?.name || 'Duty Pharmacist'}</span>
                <span className="text-[10px] text-slate-400">{currentUser?.roleName || user?.roleName || 'Pharmacist'} • {currentUser?.branchName || 'Main Branch'}</span>
              </div>
            </div>

            {/* Sync & Timestamp */}
            <div className="hidden md:flex items-center gap-2 border-l border-slate-800 pl-3 text-slate-400 text-xs">
              <div className="flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] text-slate-300">Sync: Realtime</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400 ml-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{currentTime || '00:00:00'}</span>
              </div>
            </div>
          </div>

          {/* Right: Hotkey Guides Pills (F2, F8, F9, F10, ESC) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => searchInputRef.current?.focus()}
                className="group flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                title="Focus Barcode & Product Search"
              >
                <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-600 rounded text-[10px] font-mono text-emerald-400 font-bold">
                  F2
                </kbd>
                <span className="text-slate-300 text-[11px] font-medium hidden sm:inline">Search</span>
              </button>

              <button
                onClick={handleOpenRecentInvoices}
                className="group flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                title="Recent Invoices & Thermal/A4 Reprint (F7)"
              >
                <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-600 rounded text-[10px] font-mono text-sky-400 font-bold">
                  F7
                </kbd>
                <span className="text-slate-300 text-[11px] font-medium hidden sm:inline">Reprint</span>
              </button>

              <button
                onClick={() => {
                  if (cart.length > 0) handleHoldSale();
                  else setShowHeldModal(true);
                }}
                className="group flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                title="Hold or Recall Cart"
              >
                <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-600 rounded text-[10px] font-mono text-amber-400 font-bold">
                  F8
                </kbd>
                <span className="text-slate-300 text-[11px] font-medium hidden sm:inline">Hold/Recall</span>
                {heldSales.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 bg-amber-500 text-slate-950 font-bold text-[9px] rounded-full">
                    {heldSales.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  if (cart.length > 0) setShowPaymentModal(true);
                }}
                disabled={cart.length === 0}
                className="group flex items-center gap-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                title="Open Payment & Tender Dialog"
              >
                <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-600 rounded text-[10px] font-mono text-sky-400 font-bold">
                  F9
                </kbd>
                <span className="text-slate-300 text-[11px] font-medium hidden sm:inline">Pay</span>
              </button>

              <button
                onClick={() => {
                  if (cart.length > 0) {
                    if (showPaymentModal) handleCompleteCheckout();
                    else setShowPaymentModal(true);
                  }
                }}
                disabled={cart.length === 0}
                className="group flex items-center gap-1 bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-40 border border-emerald-600 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                title="Finalize & Complete Sale"
              >
                <kbd className="px-1.5 py-0.5 bg-slate-900 border border-emerald-500 rounded text-[10px] font-mono text-emerald-300 font-bold">
                  F10
                </kbd>
                <span className="text-white text-[11px] font-bold hidden sm:inline">Complete</span>
              </button>

              <button
                onClick={() => {
                  if (showPaymentModal) setShowPaymentModal(false);
                  else if (showHeldModal) setShowHeldModal(false);
                  else if (showRxModal) setShowRxModal(false);
                  else if (searchQuery) setSearchQuery('');
                }}
                className="group flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-1 rounded-md transition-colors cursor-pointer"
                title="Cancel or Dismiss"
              >
                <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-600 rounded text-[10px] font-mono text-rose-400 font-bold">
                  ESC
                </kbd>
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN WORKSPACE: Split Layout (Left: Search/Catalog, Right: Cart/Checkout)*/}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* ----------------------------------------------------------------------- */}
        {/* LEFT SECTION: Search & Medicine Selector                                */}
        {/* ----------------------------------------------------------------------- */}
        <div className="flex-1 flex flex-col border-r border-slate-200 bg-slate-50 overflow-hidden">
          
          {/* Fast Search Header */}
          <div className="p-3 bg-white border-b border-slate-200 shadow-xs space-y-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Barcode className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={t('pos.search_placeholder', 'Scan barcode or type medicine / generic name... (Press F2)')}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedSearchIndex(0);
                  }}
                  onFocus={() => setIsSearchFocused(true)}
                  className="w-full pl-10 pr-24 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white shadow-inner transition-all"
                  autoFocus
                />
                
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                    F2
                  </span>
                </div>
              </div>

              {/* Load Prescription Trigger */}
              <button
                onClick={() => setShowRxModal(true)}
                className="flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 px-3 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
              >
                <FileText className="w-4 h-4 text-sky-600" />
                <span>Dispense Rx ({pendingPrescriptions.length})</span>
              </button>

              {/* Recall Held Queue */}
              <button
                onClick={() => setShowHeldModal(true)}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap border ${
                  heldSales.length > 0
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                <PauseCircle className="w-4 h-4 text-amber-600" />
                <span>Held ({heldSales.length})</span>
              </button>
              
              {/* Sync Data */}
              <button
                onClick={loadData}
                className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 px-3 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
                title="Sync Inventory Data"
              >
                <RotateCcw className="w-4 h-4 text-indigo-600" />
                <span className="hidden sm:inline">Sync</span>
              </button>
            </div>

            {/* Quick Category Filter Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
              {[
                'All',
                'Antibiotics',
                'Analgesics & Antipyretics',
                'Cardiovascular',
                'Antidiabetic',
                'Respiratory',
                'Gastrointestinal',
                'Dermatology',
                'Vitamins & Supplements'
              ].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg transition-all whitespace-nowrap font-medium text-xs cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white font-semibold shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Instant Search Results Dropdown / Table List */}
          <div className="flex-1 p-3 overflow-y-auto">
            {filteredMedicines.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 p-8 text-center">
                <Search className="w-10 h-10 text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">No matching medicines found</p>
                <p className="text-xs text-slate-400 max-w-sm">
                  Try searching by generic formula (e.g., Amoxicillin, Paracetamol, Metformin) or scan a barcode.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMedicines.map((med, idx) => {
                  const fefoInfo = PharmacyService.getFefoBatchForMedicine(med.id, currentUser?.branchId);
                  const isAllExpired = fefoInfo.allStockExpired;
                  const currentBatch = fefoInfo.batch;
                  const hasStock = fefoInfo.hasStock && !isAllExpired && currentBatch;
                  const isHighlighted = idx === highlightedSearchIndex;

                  const expBadge = currentBatch ? getExpiryColorBadge(currentBatch.expiryDate) : null;

                  return (
                    <div
                      key={med.id}
                      onClick={() => hasStock && handleAddMedicineToCart(med, currentBatch, 'box')}
                      className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none ${
                        isHighlighted
                          ? 'ring-2 ring-emerald-500 bg-emerald-50/40 border-emerald-400'
                          : isAllExpired
                          ? 'bg-red-50/60 border-red-200 opacity-90 cursor-not-allowed'
                          : hasStock
                          ? 'bg-white border-slate-200 hover:border-emerald-500 hover:shadow-md'
                          : 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      {/* Left: Product & Generic Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 truncate">{med.name}</h4>
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                            {med.strength}
                          </span>
                          <span className="text-[10px] text-slate-500">{med.dosageForm}</span>
                          {med.requiresPrescription && (
                            <span className="text-[9px] font-black bg-rose-100 text-rose-700 border border-rose-300 px-1.5 py-0.2 rounded uppercase">
                              Rx Required
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                          <span className="italic truncate font-medium text-slate-600">
                            {med.genericName}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-500">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {med.manufacturer}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-500">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {med.rackLocation}
                          </span>
                        </div>
                      </div>

                      {/* Middle: Active FEFO Batch & Expiry Date (Color-Coded) */}
                      <div className="flex items-center gap-3 sm:border-l sm:border-slate-200 sm:pl-3">
                        {isAllExpired ? (
                          <div className="flex items-center gap-1 text-red-600 font-bold text-xs">
                            <ShieldAlert className="w-4 h-4" />
                            <span>EXPIRED LOCKOUT</span>
                          </div>
                        ) : currentBatch ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-slate-700">
                                Batch: <strong className="font-mono text-slate-900">{currentBatch.batchNumber}</strong>
                              </span>
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1 py-0.2 rounded uppercase">
                                FEFO #1
                              </span>
                            </div>

                            {expBadge && (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`inline-block w-2 h-2 rounded-full ${expBadge.dot}`} />
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${expBadge.bg}`}>
                                  Exp: {currentBatch.expiryDate} ({expBadge.text})
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">Out of Stock</span>
                        )}
                      </div>

                      {/* Right: Price, Stock & Quick Add */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:border-l sm:border-slate-200 sm:pl-3">
                        <div className="text-right">
                          <div className="text-sm font-black text-slate-900">
                            ৳{(currentBatch?.sellingPrice != null ? Number(currentBatch.sellingPrice) : 0).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            MRP: ৳{(currentBatch?.mrp != null ? Number(currentBatch.mrp) : (currentBatch?.sellingPrice != null ? Number(currentBatch.sellingPrice) : 0)).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-600 font-medium">
                            Stock: <strong className="text-slate-900">{currentBatch ? currentBatch.currentStock : 0}</strong> pcs
                          </div>
                        </div>

                        {/* Quick Add Buttons */}
                        {hasStock && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddMedicineToCart(med, currentBatch, 'pcs');
                              }}
                              className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                              title="Add loose piece/tablet"
                            >
                              + Pcs
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddMedicineToCart(med, currentBatch, 'box');
                              }}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                              title="Add full strip/box"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Box</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Stats Ribbon */}
          <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between font-mono shrink-0">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>FEFO Strict Auto-Allocation • Zero-Tolerance Expiry Lock Active</span>
            </span>
            <span className="text-[11px] text-slate-500">
              Showing {filteredMedicines.length} of {medicines.length} medicines
            </span>
          </div>

        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* RIGHT SECTION: Billing Cart & Checkout Terminal                         */}
        {/* ----------------------------------------------------------------------- */}
        <div className="w-full lg:w-[480px] xl:w-[540px] flex flex-col bg-white shadow-xl shrink-0">
          
          {/* Customer & Multi-Tier Pricing Header */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Active Billing Cart
                </span>
              </div>
              <span className="text-xs font-mono font-bold bg-white text-emerald-700 px-2.5 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                {cartSummary.itemCount} Items ({cartSummary.totalUnits} Units)
              </span>
            </div>

            {/* Customer Selector Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {selectedCustomer ? selectedCustomer.name : 'Walk-In Customer'}
                  </span>
                  {selectedCustomer && (
                    <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 shrink-0">
                      {selectedCustomer.customerType}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowCustomerModal(true)}
                    className="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 cursor-pointer"
                  >
                    {selectedCustomer ? 'Switch' : 'Select Customer'}
                  </button>
                  {selectedCustomer && (
                    <button
                      type="button"
                      onClick={() => handleSelectCustomer(null)}
                      className="px-1.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                      title="Clear back to Walk-In"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {selectedCustomer ? (
                <div className="pt-1.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Tag className="w-3 h-3 text-indigo-600" />
                    <span>Tier:</span>
                    <span className="font-bold capitalize text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded">
                      {selectedCustomer.pricingTier} Pricing
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {(selectedCustomer.creditLimit ?? 0) > 0 && (
                      <span className="text-slate-600 font-mono text-[10px]">
                        Credit Avail: <strong className="text-slate-900">৳{Math.max(0, (selectedCustomer.creditLimit ?? 0) - (selectedCustomer.outstandingBalance ?? 0)).toFixed(0)}</strong>
                      </span>
                    )}
                    <span className="flex items-center gap-0.5 text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 text-[10px]">
                      <Award className="w-3 h-3 text-amber-500" />
                      {selectedCustomer.loyaltyPoints ?? 0} pts
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Customer Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:font-normal"
                    />
                  </div>

                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Phone (Optional)"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:font-normal"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Instant Credit Limit Warning Alert */}
            {creditCheck && !creditCheck.allowed && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1 animate-pulse">
                <div className="flex items-center gap-1.5 font-bold text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Credit Limit Exceeded!</span>
                </div>
                <div className="text-[11px] text-rose-700 leading-tight">
                  Limit: <strong>৳{(creditCheck.creditLimit ?? 0).toFixed(2)}</strong> • Current Due: <strong>৳{(creditCheck.currentBalance ?? 0).toFixed(2)}</strong>
                  <br />
                  Projected with this order: <strong>৳{(creditCheck.projectedBalance ?? 0).toFixed(2)}</strong> (Exceeds by <strong>৳{(creditCheck.excessAmount ?? 0).toFixed(2)}</strong>)
                </div>
              </div>
            )}

            {creditCheck && creditCheck.allowed && creditCheck.warning && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-[11px]">
                  <strong>Credit Warning:</strong> High utilization ({(((creditCheck.projectedBalance ?? 0) / (creditCheck.creditLimit || 1)) * 100).toFixed(0)}% of limit). Remaining capacity: <strong>৳{(creditCheck.remainingCredit ?? 0).toFixed(2)}</strong>.
                </span>
              </div>
            )}

            {selectedPrescriptionId && (
              <div className="flex items-center justify-between bg-sky-50 border border-sky-200 px-2.5 py-1.5 rounded-lg text-xs text-sky-900">
                <div className="flex items-center gap-1.5 truncate">
                  <Stethoscope className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span className="font-semibold truncate">Prescription: {doctorName || 'Linked Rx'}</span>
                </div>
                <button
                  onClick={() => {
                    setSelectedPrescriptionId(undefined);
                    setDoctorName('');
                  }}
                  className="text-sky-600 hover:text-sky-800 text-[11px] underline cursor-pointer shrink-0 ml-2"
                >
                  Unlink
                </button>
              </div>
            )}
          </div>

          {/* Itemized Cart Table */}
          <div className="flex-1 p-3 overflow-y-auto divide-y divide-slate-100">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                  <Package className="w-7 h-7" />
                </div>
                <p className="text-sm font-bold text-slate-700">Billing Cart is Empty</p>
                <p className="text-xs text-slate-400 max-w-[260px] leading-relaxed">
                  Scan barcode (F2) or select medicine from the catalog to add with strict FEFO batch allocation.
                </p>
              </div>
            ) : (
              cart.map((item, idx) => {
                const isBox = (item.unitType || 'box') === 'box';
                const expBadge = getExpiryColorBadge(item.expiryDate);

                return (
                  <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 space-y-2">
                    {/* Item Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{item.medicineName}</h4>
                          <span className="text-[10px] text-slate-500 font-medium">{item.strength}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 italic truncate">{item.genericName}</p>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-black text-slate-900">৳{item.total.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-400">@৳{item.unitPrice.toFixed(2)}</div>
                      </div>
                    </div>

                    {/* Batch No & Expiry Badge with Change Batch Trigger */}
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-2 py-1 rounded-md text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700 font-mono">
                          {t('pos.batch_no', 'Batch')}: <strong>{item.batchNumber}</strong>
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${expBadge.bg}`}>
                          {t('pos.expiry_date', 'Exp')}: {formatDate(item.expiryDate, locale)} ({expBadge.text})
                        </span>
                      </div>

                      <button
                        onClick={() => setShowBatchSelectorForIndex(idx)}
                        className="text-emerald-700 hover:text-emerald-800 font-bold text-[10px] underline cursor-pointer"
                      >
                        Switch Batch
                      </button>
                    </div>

                    {/* Quantity Controls with Unit Box/Pcs conversion toggle */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="flex items-center gap-2">
                        {/* Unit Mode Toggle (Box vs Pcs) */}
                        <button
                          type="button"
                          onClick={() => toggleCartItemUnit(idx)}
                          className={`px-2 py-1 rounded text-[11px] font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                            isBox
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-indigo-50 text-indigo-800 border-indigo-300'
                          }`}
                          title={`Toggle Unit: Currently ${isBox ? 'Box' : 'Pcs'} (${item.packSize} pcs/pack)`}
                        >
                          <Boxes className="w-3 h-3" />
                          <span>{isBox ? 'Box (Pack)' : 'Pcs (Loose)'}</span>
                        </button>

                        {/* Qty Counter */}
                        <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                          <button
                            onClick={() => updateCartItemQty(idx, item.quantity - 1)}
                            className="p-1 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateCartItemQty(idx, parseInt(e.target.value) || 1)}
                            className="w-10 text-center text-xs font-bold text-slate-900 focus:outline-none"
                          />
                          <button
                            onClick={() => updateCartItemQty(idx, item.quantity + 1)}
                            className="p-1 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Discount & Remove Action */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-[11px] text-slate-600">
                          <Percent className="w-3 h-3 text-slate-400" />
                          <span>Disc%:</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discountPercent}
                            onChange={(e) => handleAttemptItemDiscount(idx, parseFloat(e.target.value) || 0)}
                            className="w-10 px-1 py-0.5 border border-slate-300 rounded text-center text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            title={`Max discount without manager PIN: ${maxDiscountPercent}%`}
                          />
                        </div>

                        <button
                          onClick={() => removeFromCart(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Financial Calculation Box */}
          <div className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-2 text-xs shrink-0">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold">৳{cartSummary.rawSubtotal.toFixed(2)}</span>
            </div>

            {/* Order Level Manual Discount Field */}
            <div className="flex justify-between items-center text-slate-600">
              <div className="flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-slate-400" />
                <span>Order Discount (%):</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={orderDiscountPercent}
                  onChange={(e) => handleAttemptOrderDiscount(parseFloat(e.target.value) || 0)}
                  className="w-12 px-1.5 py-0.5 border border-slate-300 rounded text-right text-xs font-bold focus:ring-1 focus:ring-emerald-500"
                  title={`Max discount without manager PIN: ${maxDiscountPercent}%`}
                />
                <span className="text-[11px] text-slate-400 font-mono">%</span>
              </div>
            </div>

            {cartSummary.totalDiscount > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Total Discount Applied</span>
                <span>-৳{cartSummary.totalDiscount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600">
              <span>VAT / Tax</span>
              <span className="font-semibold">৳{cartSummary.taxTotal.toFixed(2)}</span>
            </div>

            {cartSummary.roundOff !== 0 && (
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Round Off</span>
                <span>{cartSummary.roundOff > 0 ? `+${cartSummary.roundOff.toFixed(2)}` : cartSummary.roundOff.toFixed(2)}</span>
              </div>
            )}

            {/* Net Payable Ribbon */}
            <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
              <span className="text-sm font-extrabold text-slate-900">{t('pos.net_payable', 'Net Payable')}</span>
              <span className="text-2xl font-black text-emerald-600">
                {formatCurrency(cartSummary.netPayable, locale)}
              </span>
            </div>

            {/* Financial Masking Guardrail: Hide COGS & Margin for Cashier / Non-Admins */}
            <div className="flex justify-between text-[11px] text-slate-500 pt-0.5 font-mono">
              <span>
                Estimated COGS:{' '}
                {canViewCosts ? (
                  <span className="text-slate-700 font-bold">৳{cartSummary.totalCost.toFixed(2)}</span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-slate-400 font-sans italic text-[10px]">
                    <Lock className="w-2.5 h-2.5" /> Restricted (Admin)
                  </span>
                )}
              </span>
              <span>
                Margin:{' '}
                {canViewProfits ? (
                  <span className="text-emerald-700 font-bold">
                    +৳{cartSummary.estimatedGrossMargin.toFixed(2)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-slate-400 font-sans italic text-[10px]">
                    <Lock className="w-2.5 h-2.5" /> Restricted
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Action Bar (Clear, Hold F8, Pay F9) */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="px-3 py-2.5 border border-slate-300 hover:bg-slate-100 disabled:opacity-40 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer"
            >
              Clear
            </button>

            <button
              onClick={handleHoldSale}
              disabled={cart.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <PauseCircle className="w-4 h-4" />
              <span>Hold (F8)</span>
            </button>

            <button
              onClick={() => setShowPaymentModal(true)}
              disabled={cart.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-700/20 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>Pay / Tender (F9)</span>
            </button>
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. PAYMENT MODAL (F9 Trigger, Split Payment Support)                       */}
      {/* ========================================================================= */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                  <span>POS Payment & Tender</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Customer: {customerName} • Net Payable: <strong className="text-emerald-400">৳{cartSummary.netPayable.toFixed(2)}</strong>
                </p>
              </div>

              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payment Method Selector Tabs */}
            <div className="p-5 space-y-4">
              {/* Loyalty Points Redemption Box */}
              {selectedCustomer && selectedCustomer.loyaltyPoints > 0 && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shrink-0">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span>Loyalty Points Redemption</span>
                        <span className="text-[10px] bg-amber-200 text-amber-900 font-extrabold px-1.5 py-0.5 rounded">
                          {selectedCustomer.loyaltyPoints} Available
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        1 pt = ৳{loyaltyConfig.redemptionRatePerPoint.toFixed(2)} discount • Max {loyaltyConfig.maxRedemptionPercentagePerOrder}% order value
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-28">
                      <input
                        type="number"
                        min="0"
                        max={selectedCustomer.loyaltyPoints}
                        value={redeemedPoints || ''}
                        onChange={(e) => {
                          const pts = Math.min(
                            selectedCustomer.loyaltyPoints,
                            Math.max(0, parseInt(e.target.value) || 0)
                          );
                          setRedeemedPoints(pts);
                        }}
                        placeholder="0 pts"
                        className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-800 text-center focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const subtotalAfterItemDisc = cartSummary.rawSubtotal - cartSummary.itemDiscountTotal;
                        const maxPointsAllowed = Math.floor(
                          ((subtotalAfterItemDisc * loyaltyConfig.maxRedemptionPercentagePerOrder) / 100) /
                            loyaltyConfig.redemptionRatePerPoint
                        );
                        setRedeemedPoints(Math.min(selectedCustomer.loyaltyPoints, maxPointsAllowed));
                      }}
                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      Max
                    </button>
                    {redeemedPoints > 0 && (
                      <button
                        type="button"
                        onClick={() => setRedeemedPoints(0)}
                        className="text-xs text-amber-800 hover:underline cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              )}

              {cartSummary.loyaltyDiscountAmount > 0 && (
                <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Loyalty Points Discount Applied ({redeemedPoints} pts)
                  </span>
                  <span className="font-mono font-bold text-emerald-700">
                    -৳{cartSummary.loyaltyDiscountAmount.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: 'cash', label: 'Cash', icon: Banknote },
                  { id: 'mobile', label: 'bKash / Nagad', icon: Smartphone },
                  { id: 'card', label: 'Card / POS', icon: CreditCard },
                  { id: 'split', label: 'Split Pay', icon: Layers },
                  { id: 'due_credit', label: 'Due / Account', icon: Building }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = paymentTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setPaymentTab(tab.id as PaymentTab)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-xs font-bold cursor-pointer ${
                        isActive
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-800 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4 mb-1" />
                      <span className="truncate w-full text-center text-[11px]">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Mode A: Single Cash Tender */}
              {paymentTab === 'cash' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <label className="text-xs font-bold text-slate-700 block">
                    Cash Tendered From Customer
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">
                      ৳
                    </span>
                    <input
                      ref={cashInputRef}
                      type="number"
                      step="any"
                      placeholder={cartSummary.netPayable.toFixed(2)}
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                      autoFocus
                    />
                  </div>

                  {/* Quick Denominations */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      cartSummary.netPayable,
                      Math.ceil(cartSummary.netPayable),
                      Math.ceil(cartSummary.netPayable / 10) * 10,
                      50,
                      100,
                      500,
                      1000
                    ]
                      .filter((v, i, a) => a.indexOf(v) === i && v >= cartSummary.netPayable)
                      .slice(0, 5)
                      .map((denom) => (
                        <button
                          key={denom}
                          type="button"
                          onClick={() => setCashTendered(denom.toString())}
                          className="flex-1 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded text-xs font-bold text-slate-700 cursor-pointer transition-colors"
                        >
                          ৳{denom.toFixed(0)}
                        </button>
                      ))}
                  </div>

                  {/* Change Due Indicator */}
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold">
                    <span className="text-slate-600">Change Due:</span>
                    <span className="text-emerald-700 text-xl font-black">
                      ৳{Math.max(0, (parseFloat(cashTendered) || cartSummary.netPayable) - cartSummary.netPayable).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Mode B: Mobile Banking (bKash / Nagad / Rocket) */}
              {paymentTab === 'mobile' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2">
                    {(['bKash', 'Nagad', 'Rocket'] as MobileProvider[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSplitMobileProvider(p)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          splitMobileProvider === p
                            ? 'bg-pink-600 text-white border-pink-600 shadow-xs'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Customer Payment Reference / Transaction ID (TrxID)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 9J283H491"
                      value={splitMobileTrxId}
                      onChange={(e) => setSplitMobileTrxId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>

                  <div className="bg-pink-50 border border-pink-200 p-2.5 rounded-lg text-xs text-pink-900">
                    Prompt customer to pay <strong>৳{cartSummary.netPayable.toFixed(2)}</strong> via {splitMobileProvider} Merchant QR or Mobile Wallet.
                  </div>
                </div>
              )}

              {/* Mode C: Card / POS Terminal */}
              {paymentTab === 'card' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2">
                    {(['Visa', 'Mastercard', 'Amex', 'POS'] as CardNetwork[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSplitCardNetwork(c)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          splitCardNetwork === c
                            ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Terminal Authorization / Approval Code (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. AUTH-884102"
                      value={splitCardAuthCode}
                      onChange={(e) => setSplitCardAuthCode(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="bg-sky-50 border border-sky-200 p-2.5 rounded-lg text-xs text-sky-900">
                    Ready for customer card tap/insert on POS terminal for <strong>৳{cartSummary.netPayable.toFixed(2)}</strong>.
                  </div>
                </div>
              )}

              {/* Mode D: SPLIT PAYMENT (Multi-Tender Cash + Mobile + Card) */}
              {paymentTab === 'split' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-700">Split Payment Allocation</span>
                    <span className="text-emerald-700 font-mono">Due: ৳{cartSummary.netPayable.toFixed(2)}</span>
                  </div>

                  {/* Cash Allocation */}
                  <div className="flex items-center gap-2">
                    <div className="w-28 text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Banknote className="w-4 h-4 text-emerald-600" />
                      <span>Cash:</span>
                    </div>
                    <input
                      type="number"
                      step="any"
                      value={splitCashAmount}
                      onChange={(e) => setSplitCashAmount(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Mobile Banking Allocation */}
                  <div className="flex items-center gap-2">
                    <div className="w-28 text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Smartphone className="w-4 h-4 text-pink-600" />
                      <span>{splitMobileProvider}:</span>
                    </div>
                    <input
                      type="number"
                      step="any"
                      value={splitMobileAmount}
                      onChange={(e) => setSplitMobileAmount(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-pink-500"
                    />
                  </div>

                  {/* Card Allocation */}
                  <div className="flex items-center gap-2">
                    <div className="w-28 text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <CreditCard className="w-4 h-4 text-sky-600" />
                      <span>Card / POS:</span>
                    </div>
                    <input
                      type="number"
                      step="any"
                      value={splitCardAmount}
                      onChange={(e) => setSplitCardAmount(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>

                  {/* Split Summary Bar */}
                  {(() => {
                    const totalSplit =
                      (parseFloat(splitCashAmount) || 0) +
                      (parseFloat(splitMobileAmount) || 0) +
                      (parseFloat(splitCardAmount) || 0);
                    const diff = cartSummary.netPayable - totalSplit;

                    return (
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-bold">
                        <span>Total Allocated: ৳{totalSplit.toFixed(2)}</span>
                        {diff > 0.01 ? (
                          <span className="text-amber-600">Remaining: ৳{diff.toFixed(2)}</span>
                        ) : (
                          <span className="text-emerald-700">Change Due: ৳{Math.abs(diff).toFixed(2)}</span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Mode E: DUE / ON ACCOUNT CREDIT SALE */}
              {paymentTab === 'due_credit' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  {/* Admin Authorization Security Guard */}
                  {(!isAdmin && !isAdminPinAuthorized) ? (
                    <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl space-y-2.5">
                      <div className="flex items-start gap-2.5 text-rose-900">
                        <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-xs text-rose-950">
                            ADMIN প্যানেল ব্যাতিত অন্য কেউ বাকিতে বিল করতে পারবে না।
                          </h4>
                          <p className="text-[11px] text-rose-700 mt-0.5">
                            ক্যাশিয়ার বা স্টাফ একাউন্ট থেকে বাকিতে বিল করা নিষিদ্ধ। বাকি বিল সম্পন্ন করতে অ্যাডমিন পিন (PIN: 9999) দিন অথবা অ্যাডমিন প্যানেল থেকে অ্যাক্সেস করুন।
                          </p>
                        </div>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-rose-200 flex flex-col sm:flex-row items-center gap-2">
                        <div className="relative flex-1 w-full">
                          <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="password"
                            placeholder="Enter Admin Authorization PIN (e.g. 9999)..."
                            value={adminPinInput}
                            onChange={(e) => {
                              setAdminPinInput(e.target.value);
                              setAdminPinError('');
                            }}
                            className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (adminPinInput === '9999' || adminPinInput === 'admin' || adminPinInput === '1234') {
                              setIsAdminPinAuthorized(true);
                              setAdminPinError('');
                            } else {
                              setAdminPinError('ভুল অ্যাডমিন পিন! শুধুমাত্র অ্যাডমিন প্যানেল বাকিতে বিল অনুমোদন করতে পারে।');
                            }
                          }}
                          className="w-full sm:w-auto px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors shadow-2xs"
                        >
                          Authorize PIN
                        </button>
                      </div>
                      {adminPinError && (
                        <p className="text-[11px] font-bold text-rose-700">{adminPinError}</p>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-900 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>অ্যাডমিন অনুমোদিত: বাকিতে বিল সম্পন্ন করার অনুমতি সক্রিয়।</span>
                      </span>
                      <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-mono font-bold">
                        ADMIN_APPROVED
                      </span>
                    </div>
                  )}

                  {!selectedCustomer ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <strong>No Customer Selected:</strong> Billing on credit requires an active registered customer profile. Please switch from Walk-In to a customer first.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2 text-xs">
                        <div className="flex justify-between font-bold text-slate-700">
                          <span>Customer Account:</span>
                          <span className="text-slate-900">{selectedCustomer.name} ({selectedCustomer.customerType})</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Credit Limit:</span>
                          <span className="font-mono font-bold">৳{(selectedCustomer.creditLimit ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Current Outstanding Due:</span>
                          <span className="font-mono font-bold text-rose-600">৳{(selectedCustomer.outstandingBalance ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>This Invoice Net Payable:</span>
                          <span className="font-mono font-bold text-indigo-600">৳{(cartSummary.netPayable ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-slate-800 text-sm">
                          <span>Projected Total Balance:</span>
                          <span className="font-mono">৳{((selectedCustomer.outstandingBalance ?? 0) + (cartSummary.netPayable ?? 0)).toFixed(2)}</span>
                        </div>
                      </div>

                      {creditCheck && !creditCheck.allowed ? (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <strong className="block">Credit Limit Exceeded!</strong>
                            <span>
                              This invoice exceeds the allowed credit ceiling of ৳{(creditCheck.creditLimit ?? 0).toFixed(2)} by ৳{(creditCheck.excessAmount ?? 0).toFixed(2)}. Credit billing is restricted without manager approval.
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Credit limit check approved. Remaining capacity after checkout: <strong>৳{(creditCheck?.remainingCredit ?? 0).toFixed(2)}</strong>.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Action Bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Back (ESC)
              </button>

              <button
                onClick={handleCompleteCheckout}
                disabled={paymentTab === 'due_credit' && !isAdmin && !isAdminPinAuthorized}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer ${
                  paymentTab === 'due_credit' && !isAdmin && !isAdminPinAuthorized
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-700/20'
                }`}
              >
                <span>
                  {paymentTab === 'due_credit' && !isAdmin && !isAdminPinAuthorized
                    ? '🔒 Admin Approval Required for Due Bill'
                    : 'Finalize & Print Invoice'}
                </span>
                <span className="font-mono text-[10px] bg-emerald-800 px-1.5 py-0.5 rounded text-emerald-200">
                  F10
                </span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODALS: Batch Selector, Held Sales, Rx Dispenser, Expiry Alert Lockout  */}
      {/* ========================================================================= */}

      {/* Change Batch Modal */}
      {showBatchSelectorForIndex !== null && cart[showBatchSelectorForIndex] && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Select Active Batch</h3>
                <p className="text-xs text-slate-400">
                  {cart[showBatchSelectorForIndex].medicineName} (FEFO Priority Order)
                </p>
              </div>
              <button
                onClick={() => setShowBatchSelectorForIndex(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto space-y-2">
              {PharmacyService.getBatchesForMedicine(cart[showBatchSelectorForIndex].medicineId).map((batch) => {
                const todayStr = new Date().toISOString().split('T')[0];
                const isExpired = batch.expiryDate <= todayStr || batch.status === 'expired';
                const isCurrent = batch.id === cart[showBatchSelectorForIndex].batchId;
                const expBadge = getExpiryColorBadge(batch.expiryDate);

                return (
                  <div
                    key={batch.id}
                    onClick={() => !isExpired && handleSelectBatch(showBatchSelectorForIndex, batch)}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      isExpired
                        ? 'bg-red-50 border-red-200 opacity-80 cursor-not-allowed'
                        : isCurrent
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 cursor-default'
                        : 'bg-white border-slate-200 hover:border-emerald-400 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 font-mono">{batch.batchNumber}</span>
                        {isExpired ? (
                          <span className="text-[9px] font-black bg-red-600 text-white px-1.5 py-0.2 rounded">
                            EXPIRED • LOCKED
                          </span>
                        ) : isCurrent ? (
                          <span className="text-[9px] font-bold bg-emerald-600 text-white px-1.5 py-0.2 rounded">
                            Active in Cart
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                        <span>Mfg: {batch.manufacturingDate}</span>
                        <span>•</span>
                        <span className={`font-bold px-1.5 py-0.2 rounded border ${expBadge.bg}`}>
                          Exp: {batch.expiryDate} ({expBadge.text})
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-900">৳{(batch.sellingPrice ?? 0).toFixed(2)}</div>
                      <div className="text-[10px] text-slate-500 font-medium">Stock: {batch.currentStock} pcs</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                onClick={() => setShowBatchSelectorForIndex(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close (ESC)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Held Sales Recall Queue Modal */}
      {showHeldModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <PauseCircle className="w-4 h-4 text-amber-400" />
                  <span>Held Sales Tickets (F8)</span>
                </h3>
                <p className="text-xs text-slate-400">Resume paused customer checkout sessions</p>
              </div>
              <button
                onClick={() => setShowHeldModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto space-y-2.5">
              {heldSales.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">No held sales tickets in queue.</p>
              ) : (
                heldSales.map((h) => (
                  <div
                    key={h.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between hover:bg-white hover:border-emerald-500 transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 font-mono">{h.holdNumber}</span>
                        <span className="text-[10px] text-slate-500">at {h.heldAt}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">{h.customerName}</p>
                      <p className="text-[10px] text-slate-500">
                        {h.itemCount} items • ৳{h.totalAmount.toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRecallSale(h)}
                        className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>Resume</span>
                      </button>
                      <button
                        onClick={() => {
                          PharmacyService.removeHeldSale(h.id);
                          setHeldSales(PharmacyService.getHeldSales());
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                onClick={() => setShowHeldModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close (ESC)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispense Prescription Modal */}
      {showRxModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-400" />
                  <span>Select Doctor Prescription</span>
                </h3>
                <p className="text-xs text-slate-400">Loads medications directly into POS cart with FEFO priority</p>
              </div>
              <button
                onClick={() => setShowRxModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto space-y-3">
              {pendingPrescriptions.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">No pending prescriptions found.</p>
              ) : (
                pendingPrescriptions.map((rx) => (
                  <div
                    key={rx.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-white transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 font-mono">{rx.prescriptionNumber}</span>
                          <span className="text-[10px] bg-sky-100 text-sky-800 font-semibold px-1.5 py-0.2 rounded">
                            {rx.status.toUpperCase()}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 mt-1">
                          {rx.patientName} ({rx.patientAge}y, {rx.patientGender})
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {rx.doctorName} • {rx.clinicHospital}
                        </p>
                      </div>

                      <button
                        onClick={() => handleDispensePrescription(rx)}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                      >
                        <span>Dispense into Cart</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 text-[11px] space-y-1">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Prescribed Items:</div>
                      {rx.medications.map((m, mIdx) => (
                        <div key={mIdx} className="flex justify-between text-slate-700">
                          <span>• {m.medicineName} ({m.dosage})</span>
                          <span className="font-bold">{m.quantity} units</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                onClick={() => setShowRxModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close (ESC)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Selection Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold">Select Customer & Dynamic Pricing Tier</h3>
                  <p className="text-xs text-slate-400">
                    Automatically applies wholesale, corporate, or institutional tier pricing & validates credit limits
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search and Quick Filters */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-3 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by customer name, phone, company, or institution..."
                  value={customerSearchTerm}
                  onChange={(e) => setCustomerSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              {/* Quick Walk-in Option */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleSelectCustomer(null)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset to Walk-In Customer (Default Retail MRP)</span>
                </button>
                <span className="text-[11px] text-slate-500">
                  {customers.length} Registered Accounts
                </span>
              </div>
            </div>

            {/* Customer List */}
            <div className="p-4 overflow-y-auto divide-y divide-slate-100 space-y-2 flex-1">
              {customers
                .filter((c) => {
                  if (!customerSearchTerm.trim()) return true;
                  const term = customerSearchTerm.toLowerCase();
                  return (
                    c.name.toLowerCase().includes(term) ||
                    c.phone.includes(term) ||
                    (c.email && c.email.toLowerCase().includes(term)) ||
                    (c.companyName && c.companyName.toLowerCase().includes(term)) ||
                    (c.institutionName && c.institutionName.toLowerCase().includes(term)) ||
                    c.customerType.toLowerCase().includes(term)
                  );
                })
                .map((cust) => {
                  const isCurrent = selectedCustomer?.id === cust.id;

                  return (
                    <div
                      key={cust.id}
                      onClick={() => handleSelectCustomer(cust)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20'
                          : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{cust.name}</span>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {cust.customerType}
                          </span>
                          <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                            {cust.pricingTier} Tier
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-3">
                          <span>📞 {cust.phone}</span>
                          {cust.companyName && <span>🏢 {cust.companyName}</span>}
                          {cust.institutionName && <span>🏥 {cust.institutionName}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <div className="text-right text-[11px]">
                          <div>
                            <span className="text-slate-500">Due: </span>
                            <span className={`font-bold font-mono ${(cust.outstandingBalance ?? 0) > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                              ৳{(cust.outstandingBalance ?? 0).toFixed(2)}
                            </span>
                            {(cust.creditLimit ?? 0) > 0 && (
                              <span className="text-slate-400"> / ৳{(cust.creditLimit ?? 0).toFixed(0)}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-end gap-1 text-amber-700 font-semibold text-[10px]">
                            <Award className="w-3 h-3 text-amber-500" />
                            <span>{cust.loyaltyPoints ?? 0} pts (৳{((cust.loyaltyPoints ?? 0) * 0.25).toFixed(2)})</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700'
                          }`}
                        >
                          {isCurrent ? 'Selected' : 'Select'}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Selecting a customer automatically updates prices of all current cart items to their assigned tier.
              </span>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close (ESC)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expired Batch Lockout Alert Modal */}
      {expiredLockoutAlert && (
        <div className="fixed inset-0 z-50 bg-rose-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border-2 border-rose-500 animate-in zoom-in-95 duration-150">
            <div className="bg-rose-600 text-white p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-700 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight">EXPIRED BATCH LOCKOUT</h3>
                <p className="text-xs text-rose-100 font-medium">Regulatory Safety Enforcement</p>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 leading-relaxed font-medium">
                {expiredLockoutAlert.reason}
              </div>

              <div className="text-xs text-slate-700 space-y-1">
                <p><strong>Medicine:</strong> {expiredLockoutAlert.medicineName}</p>
                {expiredLockoutAlert.batchNumber && (
                  <p><strong>Attempted Batch:</strong> {expiredLockoutAlert.batchNumber}</p>
                )}
                <p className="text-[11px] text-slate-500 pt-1">
                  Action required: Mark batch as QUARANTINED in inventory to initiate destruction or supplier return.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setExpiredLockoutAlert(null)}
                className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                Acknowledge Lockout (ESC)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Invoices & Thermal/A4 Reprint Dialog (F7) */}
      {showRecentInvoicesModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Past Invoices & Thermal/A4 Reprint</h3>
                  <p className="text-xs text-slate-400">Select any transaction to preview and print in 58mm, 80mm, A4, or A5</p>
                </div>
              </div>
              <button
                onClick={() => setShowRecentInvoicesModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search filter */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={invoiceSearchQuery}
                  onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                  placeholder="Search by Invoice #, Customer Name, Phone, or Doctor..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Invoices List */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
              {recentSales
                .filter((s) => {
                  const q = invoiceSearchQuery.toLowerCase();
                  if (!q) return true;
                  return (
                    s.invoiceNumber.toLowerCase().includes(q) ||
                    s.customerName.toLowerCase().includes(q) ||
                    (s.customerPhone && s.customerPhone.toLowerCase().includes(q)) ||
                    (s.doctorName && s.doctorName.toLowerCase().includes(q)) ||
                    s.items.some((it) => it.medicineName.toLowerCase().includes(q))
                  );
                })
                .map((sale) => (
                  <div
                    key={sale.id}
                    className="py-3 px-3 hover:bg-slate-50 rounded-xl transition-colors flex flex-wrap items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          #{sale.invoiceNumber}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {sale.paymentMethod.toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500">{sale.date} {sale.timestamp}</span>
                      </div>
                      <div className="text-xs text-slate-700 flex items-center gap-2">
                        <span>Cust: <strong>{sale.customerName}</strong></span>
                        {sale.doctorName && (
                          <span className="text-slate-500">| Dr: {sale.doctorName}</span>
                        )}
                        <span className="text-slate-400">({sale.items.length} items)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-mono font-bold text-sm text-slate-900">
                          ৳{sale.grandTotal.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Paid: ৳{(sale.cashTendered || sale.grandTotal).toFixed(2)}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setLastCompletedSale(sale);
                          setShowRecentInvoicesModal(false);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold shadow transition-all cursor-pointer"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Print Invoice</span>
                      </button>
                    </div>
                  </div>
                ))}

              {recentSales.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No sales invoices recorded yet.
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 shrink-0">
              <span>Press ESC to close</span>
              <button
                onClick={() => setShowRecentInvoicesModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manager Override Security Dialog for Discount Threshold Exceeded */}
      {managerOverrideModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-amber-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-200" />
                <h3 className="font-bold text-sm">Manager Override Required</h3>
              </div>
              <button
                onClick={() => setManagerOverrideModal(null)}
                className="text-amber-200 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-amber-900">
                <div className="font-bold">Security Guardrail: Discount Limit Exceeded</div>
                <p>
                  Your current role (<strong className="uppercase">{user.roleName}</strong>) is authorized for up to <strong>{maxDiscountPercent}%</strong> manual discount.
                </p>
                <p>
                  Requested Discount: <strong className="text-rose-600 font-bold text-sm">{managerOverrideModal.requestedDiscount}%</strong>
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                  <span>Enter Manager Security PIN:</span>
                </label>
                <input
                  type="password"
                  autoFocus
                  maxLength={6}
                  placeholder="Enter 4-digit PIN"
                  value={managerPin}
                  onChange={(e) => setManagerPin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAuthorizeManagerOverride()}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-center text-lg font-mono font-bold tracking-widest focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                {managerPinError && (
                  <p className="text-rose-600 font-semibold text-[11px]">{managerPinError}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setManagerOverrideModal(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAuthorizeManagerOverride}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Authorize Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: F10 Complete Sale - Fiscal Print vs E-Receipt SMS/Email */}
      {f10ConfirmationSale && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-auto animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-700 to-teal-800 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shadow-xs">
                  <CheckCircle2 className="w-6 h-6 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <span>Sale Completed Successfully</span>
                    <span className="text-xs bg-white/20 font-mono px-2 py-0.5 rounded text-emerald-200">
                      {f10ConfirmationSale.invoiceNumber}
                    </span>
                  </h3>
                  <p className="text-xs text-emerald-100">
                    Total: <strong className="text-white text-sm">{formatCurrency(f10ConfirmationSale.grandTotal, locale)}</strong> • {f10ConfirmationSale.items.length} items
                  </p>
                </div>
              </div>
              <button
                onClick={() => setF10ConfirmationSale(null)}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Select Receipt Dispatch Method:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Both: Fiscal + E-Receipt */}
                  <button
                    type="button"
                    onClick={() => setEReceiptDeliveryMode('both')}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      eReceiptDeliveryMode === 'both'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        Print & E-Receipt
                      </span>
                      {eReceiptDeliveryMode === 'both' && <Check className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <span className="text-[11px] text-slate-500 leading-tight">
                      ESC/POS thermal slip + SMS/Email to patient
                    </span>
                  </button>

                  {/* Print Fiscal Only */}
                  <button
                    type="button"
                    onClick={() => setEReceiptDeliveryMode('fiscal_only')}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      eReceiptDeliveryMode === 'fiscal_only'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <Printer className="w-4 h-4 text-slate-600" />
                        Fiscal Print Only
                      </span>
                      {eReceiptDeliveryMode === 'fiscal_only' && <Check className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <span className="text-[11px] text-slate-500 leading-tight">
                      Physical 80mm thermal paper receipt
                    </span>
                  </button>

                  {/* SMS Only */}
                  <button
                    type="button"
                    onClick={() => setEReceiptDeliveryMode('sms_only')}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      eReceiptDeliveryMode === 'sms_only'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4 text-sky-600" />
                        E-Receipt (SMS)
                      </span>
                      {eReceiptDeliveryMode === 'sms_only' && <Check className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <span className="text-[11px] text-slate-500 leading-tight">
                      SMS text with secure bill verification link
                    </span>
                  </button>

                  {/* Email Only */}
                  <button
                    type="button"
                    onClick={() => setEReceiptDeliveryMode('email_only')}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      eReceiptDeliveryMode === 'email_only'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-indigo-600" />
                        E-Receipt (Email)
                      </span>
                      {eReceiptDeliveryMode === 'email_only' && <Check className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <span className="text-[11px] text-slate-500 leading-tight">
                      Detailed itemized PDF receipt to customer
                    </span>
                  </button>
                </div>
              </div>

              {/* Recipient inputs when E-receipt is included */}
              {(eReceiptDeliveryMode === 'both' || eReceiptDeliveryMode === 'sms_only' || eReceiptDeliveryMode === 'email_only') && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col gap-2.5">
                  <span className="text-xs font-bold text-slate-700">Recipient Contact Details:</span>
                  {(eReceiptDeliveryMode === 'both' || eReceiptDeliveryMode === 'sms_only') && (
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        value={eReceiptPhone}
                        onChange={(e) => setEReceiptPhone(e.target.value)}
                        placeholder="Mobile number (e.g. +880 1712-984210)"
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono outline-hidden focus:border-emerald-500"
                      />
                    </div>
                  )}
                  {(eReceiptDeliveryMode === 'both' || eReceiptDeliveryMode === 'email_only') && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <input
                        type="email"
                        value={eReceiptEmail}
                        onChange={(e) => setEReceiptEmail(e.target.value)}
                        placeholder="Customer Email (e.g. patient@example.com)"
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-hidden focus:border-emerald-500"
                      />
                    </div>
                  )}

                  {eReceiptSentMsg && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-100/70 px-2.5 py-1.5 rounded-lg font-medium border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{eReceiptSentMsg}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setF10ConfirmationSale(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
              >
                Skip / Close (Esc)
              </button>

              <div className="flex items-center gap-2">
                {/* Send E-Receipt action */}
                {(eReceiptDeliveryMode === 'sms_only' || eReceiptDeliveryMode === 'email_only') && (
                  <button
                    type="button"
                    disabled={eReceiptSending}
                    onClick={() => {
                      setEReceiptSending(true);
                      setTimeout(() => {
                        setEReceiptSending(false);
                        setEReceiptSentMsg(`E-Receipt dispatched successfully to ${eReceiptDeliveryMode === 'sms_only' ? eReceiptPhone : eReceiptEmail}`);
                        setTimeout(() => {
                          setF10ConfirmationSale(null);
                        }, 1200);
                      }, 600);
                    }}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{eReceiptSending ? 'Sending...' : 'Send E-Receipt'}</span>
                  </button>
                )}

                {/* Print Fiscal Receipt / Both */}
                {(eReceiptDeliveryMode === 'fiscal_only' || eReceiptDeliveryMode === 'both') && (
                  <button
                    type="button"
                    onClick={() => {
                      if (eReceiptDeliveryMode === 'both' && (eReceiptPhone || eReceiptEmail)) {
                        setEReceiptSentMsg(`E-Receipt queued for ${eReceiptPhone}`);
                      }
                      const saleToPrint = f10ConfirmationSale;
                      setF10ConfirmationSale(null);
                      setAutoPrintReceipt(true);
                      setLastCompletedSale(saleToPrint);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-700/20 transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>
                      {eReceiptDeliveryMode === 'both' ? 'Print & Send (F10)' : 'Print Fiscal Receipt'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable Thermal Receipt Modal */}
      <ReceiptModal
        sale={lastCompletedSale}
        onClose={() => {
          setLastCompletedSale(null);
          setAutoPrintReceipt(false);
        }}
        autoPrint={autoPrintReceipt}
      />

    </div>
  );
};

export default POSView;
