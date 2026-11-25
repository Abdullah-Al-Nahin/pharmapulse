import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Wallet,
  Plus,
  Printer,
  Download,
  Calendar,
  FileText,
  Edit3,
  TrendingUp,
  PlusCircle,
  MinusCircle,
  Lock,
  Building2,
  CreditCard,
  Smartphone,
  Percent,
  Trash2,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  Barcode,
  Database,
  Upload,
  Sparkles,
  X,
  Check,
  Receipt,
  Coins,
  Layers,
} from 'lucide-react';
import { PharmacyService } from '../../services/pharmacyService';
import { BranchService } from '../../services/branchService';
import { CustomerService } from '../../services/customerService';
import { CashbookService, BackupMeta } from '../../services/cashbookService';
import { useAuth } from '../../context/AuthContext';
import {
  AccountingTransaction,
  Batch,
  Medicine,
  Sale,
  SaleReturn,
  Supplier,
} from '../../types/pharmacy';
import { BranchInfo } from '../../types/pharmapulse';
import {
  getCurrentLocale,
  subscribeLocale,
  toBanglaDigits,
} from '../../utils/i18nFormatter';
import {
  BDT_DENOMINATIONS,
  CashbookDailyClosingRecord,
  CashbookVoucherRecord,
  CashbookVoucherType,
  DenominationCounts,
  DenominationNote,
  autoAllocateDenominations,
  computeDailyCashbookSheet,
  computeDenominationReconciliation,
  createEmptyDenominations,
  encodeCode128B,
  generateValidEan13,
  round2,
} from '../../utils/cashbookMath';

interface DailyCashbookExpensesViewProps {
  onNavigateTab?: (tab: string) => void;
  onOpenFullPos?: () => void;
}

type CashbookInnerTab =
  | 'sheet'
  | 'vouchers'
  | 'denomination'
  | 'barcodes'
  | 'backup';

type LabelFormatPreset = '38x25' | '50x30' | 'a4_40' | 'shelf_tag';

interface BarcodePrintQueueItem {
  id: string;
  medicineId: string;
  medicineName: string;
  genericName: string;
  strength: string;
  batchNumber: string;
  expiryDate: string;
  mrp: number;
  sellingPrice: number;
  rackLocation: string;
  barcode: string;
  copies: number;
}

const SHOP_EXPENSE_CATEGORIES = [
  'Refreshment & Tea',
  'Transport & Courier',
  'Utility & Electricity',
  'Shop Maintenance',
  'Packaging & Polybags',
  'Staff Allowance',
  'Cleaning & Disinfection',
  'Misc Operating Expense',
];

const CASH_IN_CATEGORIES = [
  'Customer Due Collection',
  'Owner Capital Top-Up',
  'Drawer Float Adjustment',
  'Bank Cash Withdrawal',
  'Misc Cash Receipt',
];

export const DailyCashbookExpensesView: React.FC<DailyCashbookExpensesViewProps> = ({
  onNavigateTab,
}) => {
  const { currentUser, isSuperAdmin } = useAuth();
  const [locale, setLocaleState] = useState<'en' | 'bn'>(() => getCurrentLocale());
  useEffect(() => subscribeLocale((l) => setLocaleState(l)), []);
  const isBn = locale === 'bn';

  const fmtNum = (val: number, decimals = 2) => {
    const str = Number(val || 0).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return isBn ? toBanglaDigits(str) : str;
  };
  const fmtInt = (val: number) => {
    const str = Math.round(Number(val || 0)).toLocaleString('en-US');
    return isBn ? toBanglaDigits(str) : str;
  };
  const fmtCur = (val: number) => `৳${fmtNum(val, 2)}`;

  // Live reactive stores
  const [sales, setSales] = useState<Sale[]>(() => PharmacyService.getSales());
  const [medicines, setMedicines] = useState<Medicine[]>(() => PharmacyService.getMedicines());
  const [batches, setBatches] = useState<Batch[]>(() => PharmacyService.getBatches());
  const [returns, setReturns] = useState<SaleReturn[]>(() => PharmacyService.getReturns());
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => PharmacyService.getSuppliers());
  const [accountingTx, setAccountingTx] = useState<AccountingTransaction[]>(() =>
    PharmacyService.getAccountingTransactions()
  );
  const [branches, setBranches] = useState<BranchInfo[]>(() => BranchService.getBranches());
  const [customers, setCustomers] = useState(() => CustomerService.getCustomers());
  const [vouchers, setVouchers] = useState<CashbookVoucherRecord[]>(() =>
    CashbookService.getVouchers()
  );
  const [dailyClosings, setDailyClosings] = useState<CashbookDailyClosingRecord[]>(() =>
    CashbookService.getDailyClosings()
  );

  useEffect(() => {
    CashbookService.initialize();
    const unsub1 = PharmacyService.subscribe(() => {
      setSales([...PharmacyService.getSales()]);
      setMedicines([...PharmacyService.getMedicines()]);
      setBatches([...PharmacyService.getBatches()]);
      setReturns([...PharmacyService.getReturns()]);
      setSuppliers([...PharmacyService.getSuppliers()]);
      setAccountingTx([...PharmacyService.getAccountingTransactions()]);
    });
    const unsub2 = BranchService.subscribe(() => setBranches([...BranchService.getBranches()]));
    const unsub3 = CustomerService.subscribe(() => setCustomers([...CustomerService.getCustomers()]));
    const unsub4 = CashbookService.subscribe(() => {
      setVouchers([...CashbookService.getVouchers()]);
      setDailyClosings([...CashbookService.getDailyClosings()]);
    });
    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, []);

  const canSwitchBranch =
    isSuperAdmin ||
    currentUser?.roleCode === 'super_admin' ||
    currentUser?.roleCode === 'pharmacy_manager' ||
    currentUser?.roleCode === 'accountant';

  const todayStr = new Date().toISOString().split('T')[0];
  const [cashbookDate, setCashbookDate] = useState<string>(todayStr);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() =>
    canSwitchBranch ? 'all' : currentUser?.branchId || 'HQ-MAIN'
  );
  const [activeInnerTab, setActiveInnerTab] = useState<CashbookInnerTab>('sheet');
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    msg: string;
  } | null>(null);

  const showNotice = (type: 'success' | 'error', msg: string) => {
    setStatusBanner({ type, msg });
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const activeBranchObj = useMemo(() => {
    if (selectedBranchId === 'all') return null;
    return branches.find((b) => b.id === selectedBranchId) || branches[0] || null;
  }, [selectedBranchId, branches]);

  // Resolved Opening Cash for selected date & branch
  const openingCash = useMemo(() => {
    return CashbookService.getOpeningCash(cashbookDate, selectedBranchId);
  }, [cashbookDate, selectedBranchId, dailyClosings]);

  // Core daily cashbook computation
  const sheet = useMemo(
    () =>
      computeDailyCashbookSheet({
        cashbookDate,
        branchId: selectedBranchId,
        openingCash,
        sales,
        medicines,
        batches,
        branches,
        vouchers,
        returns,
        accountingTx,
      }),
    [
      cashbookDate,
      selectedBranchId,
      openingCash,
      sales,
      medicines,
      batches,
      branches,
      vouchers,
      returns,
      accountingTx,
    ]
  );

  const savedClosing = useMemo(
    () => CashbookService.getClosingRecord(cashbookDate, selectedBranchId),
    [cashbookDate, selectedBranchId, dailyClosings]
  );

  // =========================================================================
  // MODAL 1: EDIT OPENING DRAWER CASH
  // =========================================================================
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [editOpeningVal, setEditOpeningVal] = useState<number>(openingCash);

  const openEditOpeningModal = () => {
    setEditOpeningVal(openingCash);
    setShowOpeningModal(true);
  };

  const handleSaveOpeningCash = async (e: React.FormEvent) => {
    e.preventDefault();
    await CashbookService.setOpeningCash({
      cashbookDate,
      branchId: selectedBranchId === 'all' ? 'HQ-MAIN' : selectedBranchId,
      branchName: activeBranchObj?.name || 'Central Dispensary & Main Branch',
      openingCash: editOpeningVal,
      updatedBy: currentUser?.name || 'Pharmacist',
    });
    setShowOpeningModal(false);
    showNotice(
      'success',
      isBn
        ? `প্রারম্ভিক ক্যাশ ৳${editOpeningVal.toFixed(2)} সংরক্ষিত হয়েছে।`
        : `Updated Opening Drawer Cash to ৳${editOpeningVal.toFixed(2)}.`
    );
  };

  // =========================================================================
  // MODAL 2: ADD DAILY EXPENSE / SUPPLIER CASH PAID
  // =========================================================================
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expVoucherType, setExpVoucherType] = useState<'SHOP_EXPENSE' | 'SUPPLIER_CASH_PAID'>(
    'SHOP_EXPENSE'
  );
  const [expCategory, setExpCategory] = useState<string>(SHOP_EXPENSE_CATEGORIES[0]);
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expPartyName, setExpPartyName] = useState<string>('');
  const [expSupplierId, setExpSupplierId] = useState<string>('');
  const [expRefNo, setExpRefNo] = useState<string>('');
  const [expDesc, setExpDesc] = useState<string>('');
  const [isSavingVoucher, setIsSavingVoucher] = useState(false);

  const openExpenseModal = () => {
    setExpVoucherType('SHOP_EXPENSE');
    setExpCategory(SHOP_EXPENSE_CATEGORIES[0]);
    setExpAmount(0);
    setExpPartyName('');
    setExpSupplierId('');
    setExpRefNo('');
    setExpDesc('');
    setShowExpenseModal(true);
  };

  const handleSaveExpenseVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expAmount <= 0) {
      showNotice('error', isBn ? 'সঠিক টাকার পরিমাণ লিখুন।' : 'Enter a valid amount > 0.');
      return;
    }
    setIsSavingVoucher(true);
    try {
      const supObj = suppliers.find((s) => s.id === expSupplierId);
      const resolvedParty =
        expVoucherType === 'SUPPLIER_CASH_PAID'
          ? supObj?.name || expPartyName || 'Pharma Supplier'
          : expPartyName || expCategory;

      const created = await CashbookService.addVoucher({
        voucherDate: cashbookDate,
        voucherType: expVoucherType,
        category:
          expVoucherType === 'SUPPLIER_CASH_PAID' ? 'Supplier Cash Settlement' : expCategory,
        amount: expAmount,
        partyName: resolvedParty,
        partyId: expVoucherType === 'SUPPLIER_CASH_PAID' ? expSupplierId || undefined : undefined,
        referenceNo: expRefNo,
        description:
          expDesc ||
          (expVoucherType === 'SUPPLIER_CASH_PAID'
            ? `Cash paid to supplier ${resolvedParty}`
            : expCategory),
        branchId: selectedBranchId === 'all' ? currentUser?.branchId || 'HQ-MAIN' : selectedBranchId,
        branchName: activeBranchObj?.name || currentUser?.branchName || 'Main Branch',
        createdBy: currentUser?.name || 'Duty Pharmacist',
      });

      setShowExpenseModal(false);
      showNotice(
        'success',
        isBn
          ? `ভাউচার ${created.voucherNo} (-৳${created.amount.toFixed(2)}) ক্যাশবুকে যুক্ত হয়েছে।`
          : `Saved voucher ${created.voucherNo} (-৳${created.amount.toFixed(2)}) to cashbook.`
      );
    } finally {
      setIsSavingVoucher(false);
    }
  };

  // =========================================================================
  // MODAL 3: ADD CASH IN / CUSTOMER DUE COLLECTION
  // =========================================================================
  const [showCashInModal, setShowCashInModal] = useState(false);
  const [inVoucherType, setInVoucherType] = useState<'DUE_COLLECTION' | 'MISC_CASH_IN'>(
    'DUE_COLLECTION'
  );
  const [inCategory, setInCategory] = useState<string>(CASH_IN_CATEGORIES[0]);
  const [inAmount, setInAmount] = useState<number>(0);
  const [inPartyName, setInPartyName] = useState<string>('');
  const [inCustomerId, setInCustomerId] = useState<string>('');
  const [inSaleInvoiceRef, setInSaleInvoiceRef] = useState<string>('');
  const [inDesc, setInDesc] = useState<string>('');

  const openDueInvoices = useMemo(
    () =>
      sales.filter(
        (s) =>
          Number(s.dueAmount || 0) > 0.01 &&
          (selectedBranchId === 'all' || !s.branchId || s.branchId === selectedBranchId)
      ),
    [sales, selectedBranchId]
  );

  const openCashInModal = () => {
    setInVoucherType('DUE_COLLECTION');
    setInCategory('Customer Due Collection');
    setInAmount(0);
    setInPartyName('');
    setInCustomerId('');
    setInSaleInvoiceRef('');
    setInDesc('');
    setShowCashInModal(true);
  };

  const handleSaveCashInVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inAmount <= 0) {
      showNotice('error', isBn ? 'সঠিক টাকার পরিমাণ লিখুন।' : 'Enter a valid amount > 0.');
      return;
    }
    setIsSavingVoucher(true);
    try {
      const custObj = customers.find((c) => c.id === inCustomerId);
      const resolvedParty = custObj?.name || inPartyName || 'Counter Cash Receipt';

      const created = await CashbookService.addVoucher({
        voucherDate: cashbookDate,
        voucherType: inVoucherType,
        category: inVoucherType === 'DUE_COLLECTION' ? 'Customer Due Collection' : inCategory,
        amount: inAmount,
        partyName: resolvedParty,
        partyId: inCustomerId || undefined,
        referenceNo: inSaleInvoiceRef || undefined,
        description:
          inDesc ||
          (inVoucherType === 'DUE_COLLECTION'
            ? `Due cash collected from ${resolvedParty}`
            : inCategory),
        branchId: selectedBranchId === 'all' ? currentUser?.branchId || 'HQ-MAIN' : selectedBranchId,
        branchName: activeBranchObj?.name || currentUser?.branchName || 'Main Branch',
        createdBy: currentUser?.name || 'Duty Pharmacist',
      });

      setShowCashInModal(false);
      showNotice(
        'success',
        isBn
          ? `ক্যাশ-ইন ভাউচার ${created.voucherNo} (+৳${created.amount.toFixed(2)}) সংরক্ষিত হয়েছে।`
          : `Saved cash receipt ${created.voucherNo} (+৳${created.amount.toFixed(2)}).`
      );
    } finally {
      setIsSavingVoucher(false);
    }
  };

  // =========================================================================
  // MODAL 4: DUAL A4 & 80mm THERMAL PRINT ENGINE
  // =========================================================================
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printMode, setPrintMode] = useState<'a4' | '80mm'>('a4');

  const triggerThermalOrA4Print = (mode: 'a4' | '80mm') => {
    const branchTitle = activeBranchObj?.name || 'PharmaPulse Consolidated Counter';
    const branchMeta = activeBranchObj
      ? `${activeBranchObj.address} | ${activeBranchObj.phone} | DGDA: ${activeBranchObj.licenseNo}`
      : 'Central Dispensary & Multi-Branch Enterprise Network';

    const win = window.open('', '_blank', mode === '80mm' ? 'width=420,height=720' : 'width=980,height=760');
    if (!win) {
      window.print();
      return;
    }

    const debitHtml = sheet.debitLines
      .map(
        (l) => `
        <tr>
          <td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;">
            <div style="font-weight:700;">${l.title}</div>
            <div style="font-size:${mode === '80mm' ? '9px' : '10px'};color:#64748b;">${l.subtitle}</div>
          </td>
          <td style="padding:4px 6px;text-align:right;font-family:monospace;font-weight:700;color:#047857;border-bottom:1px solid #e2e8f0;">৳${l.amount.toFixed(2)}</td>
        </tr>`
      )
      .join('');

    const creditHtml =
      sheet.creditLines.length === 0
        ? `<tr><td colspan="2" style="padding:10px;text-align:center;color:#64748b;">No cash expenses recorded for ${cashbookDate}</td></tr>`
        : sheet.creditLines
            .map(
              (l) => `
          <tr>
            <td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;">
              <div style="font-weight:700;">${l.title}</div>
              <div style="font-size:${mode === '80mm' ? '9px' : '10px'};color:#64748b;">${l.subtitle}</div>
            </td>
            <td style="padding:4px 6px;text-align:right;font-family:monospace;font-weight:700;color:#be123c;border-bottom:1px solid #e2e8f0;">-৳${l.amount.toFixed(2)}</td>
          </tr>`
            )
            .join('');

    if (mode === '80mm') {
      win.document.write(`
        <!doctype html>
        <html>
          <head>
            <title>80mm Cashbook Z-Report (${cashbookDate})</title>
            <style>
              @page { size: 80mm auto; margin: 3mm; }
              body { font-family: 'Courier New', monospace; width: 74mm; margin: 0 auto; font-size: 11px; color: #000; }
              .center { text-align: center; }
              .hr { border-top: 1px dashed #000; margin: 6px 0; }
              .row { display: flex; justify-content: space-between; margin: 3px 0; }
              .bold { font-weight: 700; }
              table { width: 100%; border-collapse: collapse; font-size: 10px; }
              @media print { .no-print { display: none; } }
            </style>
          </head>
          <body>
            <div class="center">
              <div class="bold" style="font-size:13px;">${branchTitle}</div>
              <div style="font-size:9px;">${branchMeta}</div>
              <div class="bold" style="margin-top:4px;">DAILY CASHBOOK REGISTER</div>
              <div>Date: ${cashbookDate}</div>
            </div>
            <div class="hr"></div>
            <div class="row"><span>1. Opening Cash:</span><span class="bold">৳${sheet.openingCash.toFixed(2)}</span></div>
            <div class="row"><span>2. POS Cash (${sheet.invoiceCount}):</span><span class="bold">+৳${sheet.posCashSales.toFixed(2)}</span></div>
            <div class="row"><span>3. Due & Misc In:</span><span class="bold">+৳${sheet.dueAndMiscCashIn.toFixed(2)}</span></div>
            <div class="hr"></div>
            <div class="row bold"><span>Total Drawer Cash:</span><span>৳${sheet.totalCashInflow.toFixed(2)}</span></div>
            <div class="hr"></div>
            <div class="row"><span>4. Shop Expenses:</span><span>-৳${sheet.dailyShopExpense.toFixed(2)}</span></div>
            <div class="row"><span>5. Supplier Cash Paid:</span><span>-৳${sheet.supplierCashPaid.toFixed(2)}</span></div>
            <div class="row bold"><span>Total Cash Out:</span><span>-৳${sheet.totalCashOutflow.toFixed(2)}</span></div>
            <div class="hr"></div>
            <div class="row bold" style="font-size:13px;"><span>NET CLOSING CASH:</span><span>৳${sheet.netClosingCashInHand.toFixed(2)}</span></div>
            <div class="hr"></div>
            <div class="row"><span>bKash/Nagad MFS:</span><span>৳${sheet.mfsCollection.toFixed(2)}</span></div>
            <div class="row"><span>Card POS Settled:</span><span>৳${sheet.cardSettlement.toFixed(2)}</span></div>
            <div class="row"><span>Discount Granted:</span><span>৳${sheet.totalDiscountGranted.toFixed(2)}</span></div>
            <div class="row"><span>New Credit/Due:</span><span>৳${sheet.newCreditDueSales.toFixed(2)}</span></div>
            <div class="hr"></div>
            <div class="center" style="font-size:9px;">Printed by ${currentUser?.name || 'Pharmacist'} at ${new Date().toLocaleTimeString()}</div>
            <div class="center no-print" style="margin-top:10px;">
              <button onclick="window.print()" style="padding:6px 12px;background:#059669;color:#fff;border:none;border-radius:4px;cursor:pointer;">Print 80mm Receipt</button>
            </div>
          </body>
        </html>
      `);
    } else {
      win.document.write(`
        <!doctype html>
        <html>
          <head>
            <title>A4 Daily Cashbook Register - ${cashbookDate}</title>
            <style>
              @page { size: A4; margin: 14mm; }
              body { font-family: Arial, sans-serif; color: #0f172a; font-size: 12px; }
              .kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 14px 0; }
              .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; background: #f8fafc; }
              .kpi-label { font-size: 9px; font-weight: 700; color: #475569; text-transform: uppercase; }
              .kpi-val { font-size: 14px; font-weight: 800; font-family: monospace; margin-top: 4px; }
              .t-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 12px; }
              .panel { border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; }
              .panel-head-in { background: #ecfdf5; color: #065f46; padding: 8px 10px; font-weight: 800; display:flex; justify-content:space-between; }
              .panel-head-out { background: #fff1f2; color: #9f1239; padding: 8px 10px; font-weight: 800; display:flex; justify-content:space-between; }
              table { width: 100%; border-collapse: collapse; font-size: 11px; }
              .sign-row { display:flex; justify-content:space-between; margin-top: 38px; font-size: 11px; }
              .sign-box { border-top: 1px solid #475569; width: 180px; text-align:center; padding-top:4px; font-weight:700; }
              @media print { .no-print { display: none; } }
            </style>
          </head>
          <body>
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:10px;">
              <div>
                <h1 style="margin:0;font-size:19px;">${branchTitle}</h1>
                <div style="font-size:11px;color:#475569;">${branchMeta}</div>
                <div style="font-size:13px;font-weight:800;margin-top:4px;color:#047857;">Daily Cashbook, Expense Vouchers & Closing Register — Date: ${cashbookDate}</div>
              </div>
              <button class="no-print" onclick="window.print()" style="padding:8px 14px;background:#059669;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;">Print A4 Sheet</button>
            </div>
            <div class="kpi-grid">
              <div class="kpi"><div class="kpi-label">1. Opening Cash</div><div class="kpi-val">৳${sheet.openingCash.toFixed(2)}</div></div>
              <div class="kpi"><div class="kpi-label">2. POS Cash (+)</div><div class="kpi-val" style="color:#047857;">+৳${sheet.posCashSales.toFixed(2)}</div></div>
              <div class="kpi"><div class="kpi-label">3. Due/Misc (+)</div><div class="kpi-val" style="color:#4f46e5;">+৳${sheet.dueAndMiscCashIn.toFixed(2)}</div></div>
              <div class="kpi"><div class="kpi-label">4. Shop Expense (-)</div><div class="kpi-val" style="color:#be123c;">-৳${sheet.dailyShopExpense.toFixed(2)}</div></div>
              <div class="kpi"><div class="kpi-label">5. Supplier Paid (-)</div><div class="kpi-val" style="color:#b45309;">-৳${sheet.supplierCashPaid.toFixed(2)}</div></div>
              <div class="kpi" style="background:#059669;color:#fff;"><div class="kpi-label" style="color:#d1fae5;">6. Closing Cash</div><div class="kpi-val">৳${sheet.netClosingCashInHand.toFixed(2)}</div></div>
            </div>
            <div class="t-grid">
              <div class="panel">
                <div class="panel-head-in"><span>Cash Inflow & Receipts (Debit)</span><span>৳${sheet.totalCashInflow.toFixed(2)}</span></div>
                <table><tbody>${debitHtml}</tbody></table>
                <div style="padding:8px 10px;background:#ecfdf5;font-weight:800;display:flex;justify-content:space-between;border-top:1px solid #a7f3d0;">
                  <span>Total Cash Available in Drawer:</span><span>৳${sheet.totalCashInflow.toFixed(2)}</span>
                </div>
              </div>
              <div class="panel">
                <div class="panel-head-out"><span>Daily Cash Expenses & Payouts (Credit)</span><span>-৳${sheet.totalCashOutflow.toFixed(2)}</span></div>
                <table><tbody>${creditHtml}</tbody></table>
                <div style="padding:8px 10px;background:#fff1f2;font-weight:800;display:flex;justify-content:space-between;border-top:1px solid #fecdd3;">
                  <span>Total Cash Disbursed:</span><span>-৳${sheet.totalCashOutflow.toFixed(2)}</span>
                </div>
                <div style="padding:8px 10px;background:#059669;color:#fff;font-weight:800;display:flex;justify-content:space-between;">
                  <span>Net Closing Cash in Hand (Balance C/D):</span><span>৳${sheet.netClosingCashInHand.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div style="margin-top:12px;padding:10px;border:1px solid #cbd5e1;border-radius:8px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;font-size:11px;">
              <div><b>bKash/Nagad MFS:</b> ৳${sheet.mfsCollection.toFixed(2)}</div>
              <div><b>Bank Card POS:</b> ৳${sheet.cardSettlement.toFixed(2)}</div>
              <div><b>Discount Granted:</b> ৳${sheet.totalDiscountGranted.toFixed(2)}</div>
              <div><b>New Credit/Due:</b> ৳${sheet.newCreditDueSales.toFixed(2)}</div>
            </div>
            <div class="sign-row">
              <div class="sign-box">Cashier / Pharmacist</div>
              <div class="sign-box">Accounts Auditor</div>
              <div class="sign-box">Pharmacy Manager / Admin</div>
            </div>
          </body>
        </html>
      `);
    }
    win.document.close();
  };

  const printSingleVoucher80mm = (v: CashbookVoucherRecord) => {
    const win = window.open('', '_blank', 'width=400,height=560');
    if (!win) return;
    win.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Voucher ${v.voucherNo}</title>
          <style>
            @page { size: 80mm auto; margin: 4mm; }
            body { font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; font-size: 11px; color: #000; }
            .center { text-align:center; }
            .hr { border-top: 1px dashed #000; margin: 6px 0; }
            .row { display:flex; justify-content:space-between; margin: 3px 0; }
            @media print { button { display:none; } }
          </style>
        </head>
        <body>
          <div class="center">
            <div style="font-weight:700;font-size:13px;">${v.branchName}</div>
            <div>${v.direction === 'IN' ? 'CASH RECEIPT VOUCHER' : 'CASH PAYMENT VOUCHER'}</div>
            <div style="font-weight:700;">#${v.voucherNo}</div>
          </div>
          <div class="hr"></div>
          <div class="row"><span>Date:</span><span>${v.voucherDate}</span></div>
          <div class="row"><span>Category:</span><span>${v.category}</span></div>
          <div class="row"><span>Party:</span><span>${v.partyName}</span></div>
          ${v.referenceNo ? `<div class="row"><span>Ref #:</span><span>${v.referenceNo}</span></div>` : ''}
          <div class="hr"></div>
          <div><b>Particulars:</b> ${v.description}</div>
          <div class="hr"></div>
          <div class="row" style="font-size:14px;font-weight:700;"><span>AMOUNT:</span><span>৳${v.amount.toFixed(2)}</span></div>
          <div class="hr"></div>
          <div class="row" style="margin-top:24px;"><span>Prepared: ${v.createdBy}</span><span>Recipient Sign: ______</span></div>
          <div class="center" style="margin-top:10px;"><button onclick="window.print()">Print Voucher</button></div>
        </body>
      </html>
    `);
    win.document.close();
  };

  // =========================================================================
  // CSV EXPORT
  // =========================================================================
  const handleExportCsv = () => {
    const headers = [
      'Section',
      'Date',
      'Voucher / Ref',
      'Category',
      'Party / Description',
      'Inflow (+ Cash)',
      'Outflow (- Cash)',
      'Branch',
      'User',
    ];
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const rows: string[][] = [
      ...sheet.debitLines.map((l) => [
        'DEBIT (INFLOW)',
        cashbookDate,
        l.voucher?.voucherNo || l.source.toUpperCase(),
        l.title,
        l.subtitle,
        l.amount.toFixed(2),
        '0.00',
        activeBranchObj?.name || 'All Branches',
        l.voucher?.createdBy || currentUser?.name || 'Cashier',
      ]),
      ...sheet.creditLines.map((l) => [
        'CREDIT (OUTFLOW)',
        cashbookDate,
        l.voucher?.voucherNo || l.source.toUpperCase(),
        l.title,
        l.subtitle,
        '0.00',
        l.amount.toFixed(2),
        activeBranchObj?.name || 'All Branches',
        l.voucher?.createdBy || currentUser?.name || 'Cashier',
      ]),
      [
        'SUMMARY',
        cashbookDate,
        'CLOSE-BAL',
        'Net Closing Cash in Hand (Balance C/D)',
        `MFS: ৳${sheet.mfsCollection.toFixed(2)} | Card: ৳${sheet.cardSettlement.toFixed(2)} | Discount: ৳${sheet.totalDiscountGranted.toFixed(2)} | Credit Due: ৳${sheet.newCreditDueSales.toFixed(2)}`,
        sheet.totalCashInflow.toFixed(2),
        sheet.totalCashOutflow.toFixed(2),
        activeBranchObj?.name || 'All Branches',
        sheet.netClosingCashInHand.toFixed(2),
      ],
    ];

    const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Daily_Cashbook_${cashbookDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('success', isBn ? 'দৈনিক ক্যাশবুক CSV ডাউনলোড সম্পন্ন।' : `Exported Daily_Cashbook_${cashbookDate}.csv`);
  };

  // =========================================================================
  // TAB 2 STATE: VOUCHERS LEDGER
  // =========================================================================
  const [voucherScope, setVoucherScope] = useState<'date' | 'all'>('date');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<'ALL' | CashbookVoucherType>('ALL');
  const [voucherSearch, setVoucherSearch] = useState('');

  const filteredVouchers = useMemo(() => {
    const q = voucherSearch.trim().toLowerCase();
    return vouchers.filter((v) => {
      if (voucherScope === 'date' && v.voucherDate !== cashbookDate) return false;
      if (selectedBranchId !== 'all' && v.branchId && v.branchId !== selectedBranchId) return false;
      if (voucherTypeFilter !== 'ALL' && v.voucherType !== voucherTypeFilter) return false;
      if (!q) return true;
      return (
        v.voucherNo.toLowerCase().includes(q) ||
        v.partyName.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        (v.referenceNo || '').toLowerCase().includes(q)
      );
    });
  }, [vouchers, voucherScope, cashbookDate, selectedBranchId, voucherTypeFilter, voucherSearch]);

  // =========================================================================
  // TAB 3 STATE: CASH DENOMINATION & DAY-END CLOSING
  // =========================================================================
  const [denomCounts, setDenomCounts] = useState<DenominationCounts>(() =>
    createEmptyDenominations()
  );
  const [looseCoins, setLooseCoins] = useState<number>(0);
  const [vaultTransfer, setVaultTransfer] = useState<number>(0);
  const [dayClosingNotes, setDayClosingNotes] = useState<string>('');
  const [isClosingDay, setIsClosingDay] = useState(false);

  useEffect(() => {
    if (savedClosing && savedClosing.denominations) {
      const d: any = savedClosing.denominations;
      const next = createEmptyDenominations();
      BDT_DENOMINATIONS.forEach((n) => {
        next[n] = Number(d[n] || 0);
      });
      setDenomCounts(next);
      setLooseCoins(Number(d.looseCoins || 0));
      setVaultTransfer(Number(savedClosing.vaultTransfer || 0));
      setDayClosingNotes(savedClosing.notes || '');
    } else {
      const auto = autoAllocateDenominations(sheet.netClosingCashInHand);
      setDenomCounts(auto.counts);
      setLooseCoins(auto.looseCoins);
      setVaultTransfer(0);
      setDayClosingNotes('');
    }
  }, [cashbookDate, selectedBranchId, savedClosing?.id]);

  const recon = useMemo(
    () =>
      computeDenominationReconciliation(
        denomCounts,
        looseCoins,
        sheet.netClosingCashInHand,
        vaultTransfer
      ),
    [denomCounts, looseCoins, sheet.netClosingCashInHand, vaultTransfer]
  );

  const handleConfirmDayEndClosing = async () => {
    setIsClosingDay(true);
    try {
      const saved = await CashbookService.closeDay({
        cashbookDate,
        branchId: selectedBranchId === 'all' ? 'HQ-MAIN' : selectedBranchId,
        branchName: activeBranchObj?.name || 'Central Dispensary & Main Branch',
        openingCash: sheet.openingCash,
        posCashSales: sheet.posCashSales,
        dueAndMiscCashIn: sheet.dueAndMiscCashIn,
        dailyShopExpense: sheet.dailyShopExpense,
        supplierCashPaid: sheet.supplierCashPaid,
        expectedClosingCash: sheet.netClosingCashInHand,
        countedPhysicalCash: recon.physicalCash,
        variance: recon.variance,
        vaultTransfer: recon.vaultTransfer,
        carryForwardFloat: recon.carryForwardFloat,
        denominations: { ...denomCounts, looseCoins },
        status: recon.status,
        closedBy: currentUser?.name || 'Duty Pharmacist',
        notes: dayClosingNotes.trim() || undefined,
      });

      showNotice(
        'success',
        isBn
          ? `দিন-শেষ ক্যাশ ক্লোজিং সংরক্ষিত হয়েছে (${saved.status}, ক্যারি ফরওয়ার্ড: ৳${saved.carryForwardFloat.toFixed(2)})।`
          : `Day-End Closing locked (${saved.status} • Carry Forward: ৳${saved.carryForwardFloat.toFixed(2)}).`
      );
    } finally {
      setIsClosingDay(false);
    }
  };

  // =========================================================================
  // TAB 4 STATE: BARCODE LABEL & PRICE TAG PRINTER
  // =========================================================================
  const [labelSearch, setLabelSearch] = useState('');
  const [labelFormat, setLabelFormat] = useState<LabelFormatPreset>('38x25');
  const [showOptPharmacy, setShowOptPharmacy] = useState(true);
  const [showOptGeneric, setShowOptGeneric] = useState(true);
  const [showOptBatchExp, setShowOptBatchExp] = useState(true);
  const [showOptPrice, setShowOptPrice] = useState(true);
  const [labelQueue, setLabelQueue] = useState<BarcodePrintQueueItem[]>(() => {
    const initial: BarcodePrintQueueItem[] = [];
    const meds = PharmacyService.getMedicines();
    const bts = PharmacyService.getBatches();
    meds.slice(0, 3).forEach((m) => {
      const b = bts.find((bt) => bt.medicineId === m.id && bt.currentStock > 0) || bts.find((bt) => bt.medicineId === m.id);
      initial.push({
        id: m.id,
        medicineId: m.id,
        medicineName: m.name,
        genericName: m.genericName,
        strength: m.strength,
        batchNumber: b?.batchNumber || 'STD-01',
        expiryDate: b?.expiryDate || '2027-12-31',
        mrp: Number(b?.mrp || m.mrp || b?.sellingPrice || m.sellingPrice || 0),
        sellingPrice: Number(b?.sellingPrice || m.sellingPrice || b?.mrp || 0),
        rackLocation: b?.rackLocation || m.rackLocation || 'Rack A-01',
        barcode: m.barcode || m.sku || generateValidEan13(m.name),
        copies: 2,
      });
    });
    return initial;
  });

  const searchableMedicinesForLabels = useMemo(() => {
    const q = labelSearch.trim().toLowerCase();
    return medicines
      .filter(
        (m) =>
          !q ||
          m.name.toLowerCase().includes(q) ||
          m.genericName.toLowerCase().includes(q) ||
          (m.barcode || '').toLowerCase().includes(q) ||
          (m.sku || '').toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [medicines, labelSearch]);

  const addMedicineToLabelQueue = (m: Medicine) => {
    const existIdx = labelQueue.findIndex((i) => i.medicineId === m.id);
    if (existIdx >= 0) {
      const next = [...labelQueue];
      next[existIdx] = { ...next[existIdx], copies: next[existIdx].copies + 1 };
      setLabelQueue(next);
      return;
    }
    const b =
      batches.find((bt) => bt.medicineId === m.id && bt.currentStock > 0) ||
      batches.find((bt) => bt.medicineId === m.id);
    setLabelQueue((prev) => [
      {
        id: `${m.id}-${Date.now()}`,
        medicineId: m.id,
        medicineName: m.name,
        genericName: m.genericName,
        strength: m.strength,
        batchNumber: b?.batchNumber || 'STD-01',
        expiryDate: b?.expiryDate || '2027-12-31',
        mrp: Number(b?.mrp || m.mrp || b?.sellingPrice || m.sellingPrice || 0),
        sellingPrice: Number(b?.sellingPrice || m.sellingPrice || b?.mrp || 0),
        rackLocation: b?.rackLocation || m.rackLocation || 'Rack A-01',
        barcode: m.barcode || m.sku || generateValidEan13(m.name),
        copies: 2,
      },
      ...prev,
    ]);
  };

  const handleAssignBarcodeToMaster = async (item: BarcodePrintQueueItem) => {
    const newCode = generateValidEan13(item.medicineName);
    setLabelQueue((prev) =>
      prev.map((q) => (q.id === item.id ? { ...q, barcode: newCode } : q))
    );
    const med = medicines.find((m) => m.id === item.medicineId);
    if (med) {
      await PharmacyService.updateMedicine({ ...med, barcode: newCode });
    }
    showNotice('success', `Assigned EAN-13 ${newCode} to ${item.medicineName}`);
  };

  const renderBarcodeSvgString = (code: string, widthPx: number, heightPx: number) => {
    const bits = encodeCode128B(code);
    const rects: string[] = [];
    let i = 0;
    while (i < bits.length) {
      if (bits[i] === '1') {
        let run = 0;
        while (i + run < bits.length && bits[i + run] === '1') run++;
        rects.push(`<rect x="${i}" y="0" width="${run}" height="40" fill="#000"/>`);
        i += run;
      } else {
        i++;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bits.length} 40" preserveAspectRatio="none" style="width:${widthPx}px;height:${heightPx}px;display:block;margin:0 auto;">${rects.join('')}</svg>`;
  };

  const handlePrintBarcodes = () => {
    const expanded: BarcodePrintQueueItem[] = [];
    labelQueue.forEach((item) => {
      for (let i = 0; i < Math.max(1, item.copies); i++) {
        expanded.push(item);
      }
    });
    if (expanded.length === 0) {
      showNotice('error', isBn ? 'প্রিন্টের জন্য কমপক্ষে ১টি লেবেল যোগ করুন।' : 'Add at least 1 label to the print queue.');
      return;
    }

    const pharmacyTitle = activeBranchObj?.name || 'PharmaPulse Pharmacy';
    const dim =
      labelFormat === '38x25'
        ? { w: '38mm', h: '25mm', svgW: 115, svgH: 26, grid: false }
        : labelFormat === '50x30'
        ? { w: '50mm', h: '30mm', svgW: 155, svgH: 34, grid: false }
        : labelFormat === 'shelf_tag'
        ? { w: '70mm', h: '32mm', svgW: 190, svgH: 32, grid: false }
        : { w: '46mm', h: '28mm', svgW: 140, svgH: 28, grid: true };

    const labelsHtml = expanded
      .map(
        (lb) => `
      <div class="label">
        ${showOptPharmacy ? `<div class="pharma">${pharmacyTitle}</div>` : ''}
        <div class="med">${lb.medicineName} ${lb.strength || ''}</div>
        ${showOptGeneric ? `<div class="gen">${lb.genericName}</div>` : ''}
        <div style="margin:2px 0;">${renderBarcodeSvgString(lb.barcode, dim.svgW, dim.svgH)}</div>
        <div class="code">${lb.barcode}</div>
        <div class="meta">
          ${showOptBatchExp ? `<span>B:${lb.batchNumber} | E:${lb.expiryDate}</span>` : '<span></span>'}
          ${showOptPrice ? `<span class="price">MRP ৳${lb.mrp.toFixed(2)}</span>` : ''}
        </div>
      </div>`
      )
      .join('');

    const win = window.open('', '_blank', 'width=920,height=720');
    if (!win) return;
    win.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Barcode Labels (${expanded.length})</title>
          <style>
            @page { ${dim.grid ? 'size: A4; margin: 8mm;' : `size: ${dim.w} ${dim.h}; margin: 1mm;`} }
            body { font-family: Arial, sans-serif; margin: 0; padding: ${dim.grid ? '8px' : '0'}; color: #000; }
            .sheet { ${
              dim.grid
                ? 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm;'
                : 'display: flex; flex-wrap: wrap; gap: 2mm;'
            } }
            .label {
              width: ${dim.w};
              height: ${dim.h};
              box-sizing: border-box;
              border: 1px dashed #cbd5e1;
              padding: 2mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              page-break-inside: avoid;
              overflow: hidden;
            }
            .pharma { font-size: 7px; font-weight: 700; text-transform: uppercase; text-align: center; letter-spacing: 0.4px; }
            .med { font-size: 9px; font-weight: 800; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .gen { font-size: 7px; color: #334155; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .code { font-family: monospace; font-size: 8px; text-align: center; letter-spacing: 1px; font-weight: 700; }
            .meta { display: flex; justify-content: space-between; align-items: center; font-size: 7.5px; font-weight: 700; }
            .price { font-size: 9px; font-weight: 900; }
            @media print { .label { border: none; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="no-print" style="padding:10px;background:#0f172a;color:#fff;display:flex;justify-content:space-between;align-items:center;">
            <span>Generated <b>${expanded.length}</b> Code-128B Scannable Barcode Labels (${labelFormat})</span>
            <button onclick="window.print()" style="padding:7px 14px;background:#059669;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;">Print Labels Now</button>
          </div>
          <div class="sheet">${labelsHtml}</div>
        </body>
      </html>
    `);
    win.document.close();
  };

  // =========================================================================
  // TAB 5 STATE: ONE-CLICK DATA BACKUP & RESTORE
  // =========================================================================
  const [backupMeta, setBackupMeta] = useState<BackupMeta | null>(() =>
    CashbookService.getBackupMeta()
  );
  const [pendingRestorePayload, setPendingRestorePayload] = useState<any | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string>('');
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDownloadFullJsonBackup = () => {
    const { jsonString, meta, summaryCounts } = CashbookService.createSystemBackupSnapshot(
      currentUser?.name || 'Admin'
    );
    setBackupMeta(meta);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PharmaPulse_Full_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice(
      'success',
      isBn
        ? `সম্পূর্ণ ব্যাকআপ ডাউনলোড সম্পন্ন (${summaryCounts.sales}টি ইনভয়েস, ${summaryCounts.medicines}টি ওষুধ)।`
        : `Downloaded Full JSON System Backup (${meta.totalRecords} records across ${meta.totalKeys} stores).`
    );
  };

  const handleFileSelectForRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (!parsed || !parsed.storage) {
          showNotice('error', 'Invalid backup JSON file: missing storage snapshot.');
          setPendingRestorePayload(null);
          return;
        }
        setPendingRestorePayload(parsed);
      } catch {
        showNotice('error', 'Could not parse JSON backup file.');
        setPendingRestorePayload(null);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmRestoreBackup = () => {
    if (!pendingRestorePayload) return;
    try {
      const res = CashbookService.restoreSystemBackupSnapshot(
        pendingRestorePayload,
        restoreMode,
        currentUser?.name || 'Admin'
      );
      setPendingRestorePayload(null);
      setRestoreFileName('');
      showNotice(
        'success',
        `Restored ${res.restoredKeys} data stores (${restoreMode.toUpperCase()}). Refreshing live views...`
      );
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: any) {
      showNotice('error', err?.message || 'Backup restore failed.');
    }
  };

  const handleCloudSyncNow = async () => {
    setIsSyncingCloud(true);
    try {
      await Promise.all([
        PharmacyService.syncDatabase(),
        BranchService.syncFromDB(),
        CustomerService.syncFromDB(),
        CashbookService.syncFromDB(),
      ]);
      showNotice(
        'success',
        isBn
          ? 'নিওন ক্লাউড ডাটাবেসের সাথে সম্পূর্ণ সিঙ্ক সম্পন্ন হয়েছে।'
          : 'Live Neon PostgreSQL sync completed across all modules.'
      );
    } finally {
      setIsSyncingCloud(false);
    }
  };

  return (
    <div className="space-y-4 pb-8 text-slate-900 dark:text-slate-100">
      {/* Inline Status Notification */}
      {statusBanner && (
        <div
          className={`rounded-xl px-4 py-2.5 text-xs font-bold flex items-center justify-between border shadow-sm ${
            statusBanner.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusBanner.msg}</span>
          </div>
          <button onClick={() => setStatusBanner(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOP HEADER BANNER */}
      <div className="rounded-2xl bg-[#0e1525] border border-slate-800/90 p-4 sm:p-5 shadow-lg flex flex-col xl:flex-row xl:items-center justify-between gap-4 text-white">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-400 text-[11px] font-bold">
              <Wallet className="w-3 h-3" />
              {isBn
                ? 'সম্পূর্ণ দৈনিক ক্যাশবুক, খরচ ভাউচার ও দিন-শেষ ক্লোজিং সিস্টেম'
                : 'Complete Daily Cashbook, Expense Vouchers & Day-End Closing System'}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              • {isBn ? 'ডুয়াল A4 ও ৮০মিমি পিওএস থার্মাল প্রিন্ট ইঞ্জিন' : 'Dual A4 & 80mm POS Thermal Print Engine'}
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">
            {isBn
              ? 'দৈনিক প্রারম্ভিক ক্যাশ, পিওএস বিক্রয়, খরচ ভাউচার ও ক্লোজিং ক্যাশ রেজিস্টার'
              : 'Daily Opening Cash, POS Sales, Expense Vouchers & Closing Cash Register'}
          </h1>
          <p className="text-xs text-slate-400">
            {isBn
              ? 'প্রারম্ভিক ব্যালেন্স + পিওএস নগদ বিক্রয় + বকেয়া আদায় − দৈনিক খরচ − সাপ্লায়ার নগদ পরিশোধ = ড্রয়ারের সঠিক সমাপনী ক্যাশ।'
              : 'Opening Balance + POS Cash Sales + Due Collections − Daily Operating Expenses − Supplier Cash Paid = Exact Closing Cash in Drawer.'}
          </p>
        </div>

        {/* 4 Header Action Buttons matching screenshot */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={openExpenseModal}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isBn ? 'দৈনিক খরচ যুক্ত করুন' : 'Add Daily Expense'}</span>
          </button>

          <button
            type="button"
            onClick={openCashInModal}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isBn ? 'ক্যাশ ইন / বকেয়া আদায়' : 'Add Cash In / Due'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isBn ? 'ক্যাশবুক প্রিন্ট (A4 / 80mm)' : 'Print Cashbook (A4 / 80mm)'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-300" />
            <span>{isBn ? 'সিএসভি এক্সপোর্ট' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* DATE BAR, QUICK INVOICE LINK, BRANCH SELECTOR & OPENING DRAWER CASH */}
      <div className="rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            <Calendar className="w-4 h-4 text-emerald-500" />
            <span>{isBn ? 'ক্যাশবুক তারিখ:' : 'Cashbook Date:'}</span>
            <input
              type="date"
              value={cashbookDate}
              onChange={(e) => setCashbookDate(e.target.value || todayStr)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="button"
            onClick={() => setCashbookDate(todayStr)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
              cashbookDate === todayStr
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {isBn ? 'আজকের ক্যাশবুক' : "Today's Cashbook"}
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab?.('invoice_sales_ledger')}
            className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 border border-indigo-200 dark:border-indigo-700/70 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isBn ? 'ইনভয়েস বিক্রয় রিপোর্ট দেখুন' : 'View Invoice Sales Report'}</span>
          </button>

          {/* Branch Filter */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
            <Building2 className="w-3.5 h-3.5 text-emerald-500" />
            <select
              disabled={!canSwitchBranch}
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent font-bold text-slate-800 dark:text-slate-200 outline-none text-xs cursor-pointer disabled:cursor-not-allowed"
            >
              {canSwitchBranch && (
                <option value="all" className="text-slate-900 dark:bg-slate-900 dark:text-white">
                  {isBn ? 'সকল শাখা (একত্রিত)' : 'All Branches (Consolidated)'}
                </option>
              )}
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="text-slate-900 dark:bg-slate-900 dark:text-white">
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
            {!canSwitchBranch && <Lock className="w-3 h-3 text-slate-400" />}
          </div>
        </div>

        {/* Right: Opening Drawer Cash Pill + Edit */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
            {isBn ? 'প্রারম্ভিক ড্রয়ার ক্যাশ:' : 'Opening Drawer Cash:'}
          </span>
          <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
            {fmtCur(sheet.openingCash)}
          </span>
          <button
            type="button"
            onClick={openEditOpeningModal}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-bold flex items-center gap-1 cursor-pointer transition"
          >
            <Edit3 className="w-3 h-3" />
            <span>{isBn ? 'সম্পাদনা' : 'Edit'}</span>
          </button>
        </div>
      </div>

      {/* 6 FORMULA KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* 1. Opening Cash */}
        <div className="rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <span>{isBn ? '১. প্রারম্ভিক ক্যাশ' : '1. OPENING CASH'}</span>
            <Wallet className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-2">
            {fmtCur(sheet.openingCash)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
            {isBn ? 'শিফট শুরুর ড্রয়ার ক্যাশ' : 'Cash in drawer at start of shift'}
          </div>
        </div>

        {/* 2. POS Cash Sales (+) */}
        <div className="rounded-2xl bg-white dark:bg-[#111827] border border-emerald-300/70 dark:border-emerald-700/60 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            <span>{isBn ? '২. পিওএস নগদ বিক্রয় (+)' : '2. POS CASH SALES (+)'}</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-2">
            +{fmtCur(sheet.posCashSales)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
            {isBn
              ? `নিট বিক্রয়: ${fmtCur(sheet.netInvoiceSales)} (${fmtInt(sheet.invoiceCount)} বিল)`
              : `Net Sales: ${fmtCur(sheet.netInvoiceSales)} (${fmtInt(sheet.invoiceCount)} bills)`}
          </div>
        </div>

        {/* 3. Due & Misc Cash In (+) */}
        <div className="rounded-2xl bg-white dark:bg-[#111827] border border-indigo-300/70 dark:border-indigo-700/60 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            <span>{isBn ? '৩. বকেয়া ও অন্যান্য ক্যাশ (+)' : '3. DUE & MISC CASH IN (+)'}</span>
            <PlusCircle className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-2">
            +{fmtCur(sheet.dueAndMiscCashIn)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
            {isBn
              ? `বকেয়া: ${fmtCur(sheet.dueCashIn)} • অন্যান্য: ${fmtCur(sheet.miscCashIn)}`
              : `Due: ${fmtCur(sheet.dueCashIn)} • Other: ${fmtCur(sheet.miscCashIn)}`}
          </div>
        </div>

        {/* 4. Daily Shop Expense (-) */}
        <div className="rounded-2xl bg-white dark:bg-[#111827] border border-rose-300/70 dark:border-rose-700/60 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wide text-rose-600 dark:text-rose-400">
            <span>{isBn ? '৪. দৈনিক দোকান খরচ (-)' : '4. DAILY SHOP EXPENSE (-)'}</span>
            <MinusCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 mt-2">
            -{fmtCur(sheet.dailyShopExpense)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
            {isBn
              ? 'আপ্যায়ন, যাতায়াত, ইউটিলিটি ও রিফান্ড'
              : 'Refreshment, transport, utility & refunds'}
          </div>
        </div>

        {/* 5. Supplier Cash Paid (-) */}
        <div className="rounded-2xl bg-white dark:bg-[#111827] border border-amber-300/70 dark:border-amber-700/60 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            <span>{isBn ? '৫. সাপ্লায়ার নগদ প্রদান (-)' : '5. SUPPLIER CASH PAID (-)'}</span>
            <Lock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-2">
            -{fmtCur(sheet.supplierCashPaid)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
            {isBn
              ? 'ক্যাশ ড্রয়ার থেকে ফার্মা সাপ্লায়ারকে পরিশোধ'
              : 'Paid to pharma suppliers from cash drawer'}
          </div>
        </div>

        {/* 6. Net Closing Cash in Hand */}
        <div className="rounded-2xl bg-gradient-to-br from-emerald-800 to-teal-900 border border-emerald-500/60 p-4 shadow-md flex flex-col justify-between text-white">
          <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wide text-emerald-200">
            <span>{isBn ? '৬. নিট সমাপনী নগদ ক্যাশ' : '6. NET CLOSING CASH IN HAND'}</span>
            <Banknote className="w-4 h-4 text-emerald-300" />
          </div>
          <div className="text-2xl font-black font-mono text-white mt-2">
            {fmtCur(sheet.netClosingCashInHand)}
          </div>
          <div className="text-[11px] text-emerald-200/90 mt-1.5 font-semibold">
            {isBn
              ? `ডিজিটাল/কার্ডসহ: ${fmtCur(sheet.digitalAndCardTotal)}`
              : `Plus Digital/Card: ${fmtCur(sheet.digitalAndCardTotal)}`}
          </div>
        </div>
      </div>

      {/* 5 INNER SUB-NAVIGATION TABS */}
      <div className="rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-2 flex flex-wrap items-center gap-1.5 shadow-xs">
        {(
          [
            {
              id: 'sheet',
              en: '1. Complete Daily Cashbook Sheet',
              bn: '১. সম্পূর্ণ দৈনিক ক্যাশবুক শিট',
              icon: FileText,
            },
            {
              id: 'vouchers',
              en: `2. Expense & Cash-In Vouchers (${sheet.dateVouchers.length})`,
              bn: `২. খরচ ও ক্যাশ-ইন ভাউচার (${fmtInt(sheet.dateVouchers.length)})`,
              icon: Receipt,
            },
            {
              id: 'denomination',
              en: '3. Cash Denomination & Day-End Closing',
              bn: '৩. নোট গণনা ও দিন-শেষ ক্লোজিং',
              icon: Coins,
            },
            {
              id: 'barcodes',
              en: '4. Barcode Label & Price Tag Printer',
              bn: '৪. বারকোড লেবেল ও প্রাইস ট্যাগ প্রিন্টার',
              icon: Barcode,
            },
            {
              id: 'backup',
              en: '5. One-Click Data Backup & Restore',
              bn: '৫. এক-ক্লিক ডেটা ব্যাকআপ ও পুনরুদ্ধার',
              icon: Database,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeInnerTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveInnerTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
                active
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{isBn ? tab.bn : tab.en}</span>
            </button>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* TAB 1: COMPLETE DAILY CASHBOOK SHEET (T-ACCOUNT DEBIT VS CREDIT)    */}
      {/* =================================================================== */}
      {activeInnerTab === 'sheet' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* LEFT PANEL: Cash Inflow & Receipts (Debit) */}
            <div className="rounded-2xl bg-white dark:bg-[#0f172a] border border-emerald-300/60 dark:border-emerald-800/70 overflow-hidden shadow-xs flex flex-col justify-between">
              <div>
                <div className="px-4 py-3.5 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4" />
                      <span>{isBn ? 'নগদ জমা ও প্রাপ্তি (ডেবিট)' : 'Cash Inflow & Receipts (Debit)'}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {isBn
                        ? 'প্রারম্ভিক ক্যাশ, পিওএস নগদ বিক্রয় এবং বকেয়া আদায়'
                        : 'Opening cash, POS cash sales, and due collections'}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-600 text-white font-mono text-xs font-black">
                    {fmtCur(sheet.totalCashInflow)}
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {sheet.debitLines.map((line) => (
                    <div
                      key={line.id}
                      className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-900/40"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                          {line.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {line.subtitle}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`font-mono font-black text-sm ${
                            line.source === 'opening'
                              ? 'text-slate-900 dark:text-white'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {line.source === 'opening' ? '' : '+'}
                          {fmtCur(line.amount)}
                        </span>
                        {line.voucher && (
                          <button
                            type="button"
                            onClick={() => printSingleVoucher80mm(line.voucher!)}
                            title="Print Voucher"
                            className="p-1 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-4 py-3.5 bg-emerald-50/90 dark:bg-emerald-950/70 border-t border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-900 dark:text-emerald-200">
                  {isBn ? 'ড্রয়ারে মোট প্রাপ্ত নগদ:' : 'Total Cash Available in Drawer:'}
                </span>
                <span className="font-mono font-black text-base text-emerald-700 dark:text-emerald-300">
                  {fmtCur(sheet.totalCashInflow)}
                </span>
              </div>
            </div>

            {/* RIGHT PANEL: Daily Cash Expenses & Payouts (Credit) */}
            <div className="rounded-2xl bg-white dark:bg-[#0f172a] border border-rose-300/60 dark:border-rose-800/70 overflow-hidden shadow-xs flex flex-col justify-between">
              <div>
                <div className="px-4 py-3.5 bg-rose-50 dark:bg-rose-950/50 border-b border-rose-200 dark:border-rose-800/60 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-black text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                      <MinusCircle className="w-4 h-4" />
                      <span>{isBn ? 'দৈনিক নগদ খরচ ও প্রদান (ক্রেডিট)' : 'Daily Cash Expenses & Payouts (Credit)'}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {isBn
                        ? 'দোকান খরচ, সাপ্লায়ার নগদ প্রদান ও সমাপনী ক্যাশ ব্যালেন্স'
                        : 'Shop expenses, supplier cash paid & closing cash balance'}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-rose-600 text-white font-mono text-xs font-black">
                    -{fmtCur(sheet.totalCashOutflow)}
                  </span>
                </div>

                {sheet.creditLines.length === 0 ? (
                  <div className="py-12 px-4 text-center text-xs text-slate-400">
                    {isBn
                      ? 'এই তারিখে কোনো নগদ খরচ রেকর্ড করা হয়নি'
                      : 'No cash expenses recorded for this date'}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-72 overflow-y-auto">
                    {sheet.creditLines.map((line) => (
                      <div
                        key={line.id}
                        className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-900/40"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                            {line.title}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {line.subtitle}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-black text-sm text-rose-600 dark:text-rose-400">
                            -{fmtCur(line.amount)}
                          </span>
                          {line.voucher && (
                            <>
                              <button
                                type="button"
                                onClick={() => printSingleVoucher80mm(line.voucher!)}
                                title="Print Voucher"
                                className="p-1 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  CashbookService.deleteVoucher(line.voucher!.id, currentUser?.name)
                                }
                                title="Delete Voucher"
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="px-4 py-2.5 bg-rose-50/80 dark:bg-rose-950/40 border-t border-rose-200 dark:border-rose-800/60 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-rose-700 dark:text-rose-300">
                    {isBn ? 'মোট নগদ ব্যয়:' : 'Total Cash Disbursed:'}
                  </span>
                  <span className="font-mono font-black text-sm text-rose-600 dark:text-rose-400">
                    -{fmtCur(sheet.totalCashOutflow)}
                  </span>
                </div>

                <div className="px-4 py-3.5 bg-emerald-600 dark:bg-emerald-800 text-white flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black">
                      {isBn
                        ? 'হাতে নিট সমাপনী নগদ (Balance C/D):'
                        : 'Net Closing Cash in Hand (Balance C/D):'}
                    </div>
                    <div className="text-[10px] text-emerald-100">
                      {isBn
                        ? 'মোট নগদ জমা বিয়োগ মোট নগদ ব্যয়'
                        : 'Total Cash Inflow minus Total Cash Outflow'}
                    </div>
                  </div>
                  <span className="font-mono font-black text-lg">{fmtCur(sheet.netClosingCashInHand)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM 4 NON-CASH / DIGITAL & RECEIVABLE MEMO CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-pink-300/60 dark:border-pink-800/60 p-4 shadow-xs">
              <div className="text-xs font-extrabold text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                <span>{isBn ? 'বিকাশ / নগদ এমএফএস আদায়' : 'bKash / Nagad MFS Collection'}</span>
              </div>
              <div className="text-2xl font-black font-mono text-pink-600 dark:text-pink-400 mt-2">
                {fmtCur(sheet.mfsCollection)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {isBn ? 'এমএফএস মার্চেন্ট ওয়ালেটে জমা' : 'Settled in MFS merchant wallet'}
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-sky-300/60 dark:border-sky-800/60 p-4 shadow-xs">
              <div className="text-xs font-extrabold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                <span>{isBn ? 'ব্যাংক কার্ড পিওএস সেটেলমেন্ট' : 'Bank Card POS Settlement'}</span>
              </div>
              <div className="text-2xl font-black font-mono text-sky-600 dark:text-sky-400 mt-2">
                {fmtCur(sheet.cardSettlement)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {isBn ? 'সরাসরি ব্যাংক অ্যাকাউন্টে জমা' : 'Settled directly to bank account'}
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-amber-300/60 dark:border-amber-800/60 p-4 shadow-xs">
              <div className="text-xs font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5" />
                <span>{isBn ? 'আজকের মোট প্রদত্ত ডিসকাউন্ট' : "Today's Total Discount Granted"}</span>
              </div>
              <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-2">
                {fmtCur(sheet.totalDiscountGranted)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {isBn ? 'মোট প্রমোশনাল ও ম্যানুয়াল ছাড়' : 'Total promotional & manual discounts'}
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-rose-300/60 dark:border-rose-800/60 p-4 shadow-xs">
              <div className="text-xs font-extrabold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>{isBn ? 'আজকের নতুন বাকি / ক্রেডিট বিক্রয়' : "Today's New Credit / Due Sales"}</span>
              </div>
              <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 mt-2">
                {fmtCur(sheet.newCreditDueSales)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {isBn ? 'গ্রাহকের প্রাপ্য লেজারে যুক্ত' : 'Added to customer receivable ledger'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: EXPENSE & CASH-IN VOUCHERS                                   */}
      {/* =================================================================== */}
      {activeInnerTab === 'vouchers' && (
        <div className="rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setVoucherScope('date')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  voucherScope === 'date'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {cashbookDate}
              </button>
              <button
                type="button"
                onClick={() => setVoucherScope('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  voucherScope === 'all'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {isBn ? 'সকল তারিখ' : 'All Dates'}
              </button>

              {(
                [
                  { id: 'ALL', label: isBn ? 'সব' : 'All' },
                  { id: 'SHOP_EXPENSE', label: isBn ? 'দোকান খরচ' : 'Shop Expense' },
                  { id: 'SUPPLIER_CASH_PAID', label: isBn ? 'সাপ্লায়ার নগদ' : 'Supplier Cash' },
                  { id: 'DUE_COLLECTION', label: isBn ? 'বকেয়া আদায়' : 'Due Collection' },
                  { id: 'MISC_CASH_IN', label: isBn ? 'অন্যান্য ক্যাশ-ইন' : 'Misc Cash In' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setVoucherTypeFilter(f.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    voucherTypeFilter === f.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={voucherSearch}
                  onChange={(e) => setVoucherSearch(e.target.value)}
                  placeholder={isBn ? 'ভাউচার নং বা পার্টি খুঁজুন...' : 'Search voucher # or party...'}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs w-60"
                />
              </div>
              <button
                type="button"
                onClick={openExpenseModal}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                + {isBn ? 'খরচ' : 'Expense'}
              </button>
              <button
                type="button"
                onClick={openCashInModal}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
              >
                + {isBn ? 'ক্যাশ ইন' : 'Cash In'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase text-slate-500 font-bold">
                  <th className="py-2.5 px-3">Voucher #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Category &amp; Party</th>
                  <th className="py-2.5 px-3">Description / Ref</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      {isBn
                        ? 'নির্বাচিত ফিল্টারে কোনো ভাউচার পাওয়া যায়নি।'
                        : 'No cashbook vouchers match the selected filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {v.voucherNo}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{v.voucherDate}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            v.direction === 'IN'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                              : v.voucherType === 'SUPPLIER_CASH_PAID'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                          }`}
                        >
                          {v.voucherType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900 dark:text-white">{v.partyName}</div>
                        <div className="text-[11px] text-slate-500">{v.category}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        <div>{v.description}</div>
                        {v.referenceNo && (
                          <div className="text-[10px] font-mono text-indigo-500">Ref: {v.referenceNo}</div>
                        )}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-black ${
                          v.direction === 'IN' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {v.direction === 'IN' ? '+' : '-'}
                        {fmtCur(v.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => printSingleVoucher80mm(v)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white cursor-pointer transition"
                            title="Print 80mm Voucher"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => CashbookService.deleteVoucher(v.id, currentUser?.name)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-600 hover:text-white cursor-pointer transition"
                            title="Delete Voucher"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: CASH DENOMINATION & DAY-END CLOSING                          */}
      {/* =================================================================== */}
      {activeInnerTab === 'denomination' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: BDT Note & Coin Counter */}
          <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-500" />
                  <span>{isBn ? 'টাকার নোট ও কয়েন গণনা (BDT)' : 'BDT Physical Cash Denomination Counter'}</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  {isBn
                    ? 'ড্রয়ারের প্রতিটি নোটের সংখ্যা লিখুন'
                    : 'Enter counted note bundles and coins in physical counter drawer'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const auto = autoAllocateDenominations(sheet.netClosingCashInHand);
                    setDenomCounts(auto.counts);
                    setLooseCoins(auto.looseCoins);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                >
                  {isBn ? 'স্বয়ংক্রিয় নোট পূরণ' : 'Auto-Fill Expected'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDenomCounts(createEmptyDenominations());
                    setLooseCoins(0);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold cursor-pointer"
                >
                  {isBn ? 'রিসেট' : 'Reset'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {BDT_DENOMINATIONS.map((denom: DenominationNote) => {
                const count = denomCounts[denom] || 0;
                const lineVal = round2(denom * count);
                return (
                  <div
                    key={denom}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-14 text-center py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-mono font-black text-xs">
                        ৳{fmtInt(denom)}
                      </span>
                      <span className="text-xs text-slate-400">×</span>
                      <input
                        type="number"
                        min={0}
                        value={count}
                        onChange={(e) =>
                          setDenomCounts((prev) => ({
                            ...prev,
                            [denom]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                          }))
                        }
                        className="w-20 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold text-xs text-center"
                      />
                    </div>
                    <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                      = {fmtCur(lineVal)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold">{isBn ? 'খুচরা কয়েন / পয়সা (৳)' : 'Loose Coins / Fractional Cash (৳)'}</span>
              <input
                type="number"
                step="0.01"
                min={0}
                value={looseCoins}
                onChange={(e) => setLooseCoins(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-32 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold text-xs text-right"
              />
            </div>
          </div>

          {/* Right: Reconciliation Summary & Lock Closing */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black">
                  {isBn ? 'দিন-শেষ ক্লোজিং ও ভ্যারিয়েন্স হিসাব' : 'Day-End Reconciliation & Closing'}
                </h3>
                {savedClosing && savedClosing.status !== 'OPEN' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 text-[10px] font-black">
                    LOCKED ({savedClosing.status})
                  </span>
                )}
              </div>

              <div className="space-y-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">{isBn ? 'প্রত্যাশিত ড্রয়ার ক্যাশ:' : 'Expected Drawer Cash:'}</span>
                  <span className="font-mono font-bold">{fmtCur(recon.expectedClosingCash)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{isBn ? 'গণনাকৃত বাস্তব ক্যাশ:' : 'Counted Physical Cash:'}</span>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                    {fmtCur(recon.physicalCash)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 dark:border-slate-800">
                  <span className="font-bold">{isBn ? 'ভ্যারিয়েন্স (পার্থক্য):' : 'Drawer Variance:'}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-mono font-black text-[11px] ${
                      recon.status === 'BALANCED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : recon.status === 'SURPLUS'
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {recon.variance >= 0 ? '+' : ''}
                    {fmtCur(recon.variance)} ({recon.status})
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold mb-1">
                    {isBn ? 'ভল্ট / ব্যাংক জমা (৳)' : 'Vault / Bank Deposit (৳)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={recon.physicalCash}
                    value={vaultTransfer}
                    onChange={(e) => setVaultTransfer(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">
                    {isBn ? 'আগামীকালের ক্যারি-ফরওয়ার্ড ফ্লোট' : 'Next-Day Carry Forward'}
                  </label>
                  <div className="w-full px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 font-mono font-black text-emerald-700 dark:text-emerald-300">
                    {fmtCur(recon.carryForwardFloat)}
                  </div>
                </div>
              </div>

              <input
                type="text"
                value={dayClosingNotes}
                onChange={(e) => setDayClosingNotes(e.target.value)}
                placeholder={isBn ? 'হ্যান্ডওভার বা ক্লোজিং মন্তব্য...' : 'Shift handover notes / variance explanation...'}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isClosingDay}
                  onClick={handleConfirmDayEndClosing}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer transition flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{isBn ? 'দিন-শেষ ক্লোজিং লক করুন' : 'Confirm & Lock Day-End Closing'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerThermalOrA4Print('80mm')}
                  className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>80mm Z-Report</span>
                </button>
              </div>
            </div>

            {/* Closing History */}
            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 space-y-2 shadow-xs">
              <div className="text-xs font-extrabold uppercase text-slate-500">
                {isBn ? 'সাম্প্রতিক দিন-শেষ ক্লোজিং রেকর্ড' : 'Recent Day-End Closing Log'}
              </div>
              {dailyClosings.length === 0 ? (
                <div className="text-xs text-slate-400 py-3">No locked closings yet.</div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {dailyClosings.slice(0, 6).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold">{c.cashbookDate}</span>
                        <span className="text-slate-400 ml-2">• {c.branchName}</span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {fmtCur(c.countedPhysicalCash || c.openingCash)}
                        </span>
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800">
                          {c.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: BARCODE LABEL & PRICE TAG PRINTER                            */}
      {/* =================================================================== */}
      {activeInnerTab === 'barcodes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Medicine Picker + Settings */}
          <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Barcode className="w-4 h-4 text-emerald-500" />
              <span>{isBn ? 'ওষুধ নির্বাচন ও লেবেল কিউ' : 'Select Medicine & Label Queue'}</span>
            </h3>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={labelSearch}
                onChange={(e) => setLabelSearch(e.target.value)}
                placeholder={isBn ? 'ওষুধের নাম, জেনেরিক বা বারকোড খুঁজুন...' : 'Search medicine name, generic, or barcode...'}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs"
              />
            </div>

            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
              {searchableMedicinesForLabels.map((m) => (
                <div
                  key={m.id}
                  className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-900/50 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold truncate">{m.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {m.genericName} • {m.strength} • MRP ৳{Number(m.mrp || m.sellingPrice || 0).toFixed(2)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => addMedicineToLabelQueue(m)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer shrink-0"
                  >
                    + Add
                  </button>
                </div>
              ))}
            </div>

            {/* Label Preset & Display Options */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div className="font-bold text-slate-500 uppercase text-[11px]">
                {isBn ? 'লেবেল সাইজ প্রিসেট' : 'Label Stock Format'}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: '38x25', label: '38×25mm Thermal Roll' },
                    { id: '50x30', label: '50×30mm Pharmacy Tag' },
                    { id: 'a4_40', label: 'A4 40-Up Sticker Sheet' },
                    { id: 'shelf_tag', label: 'Shelf Edge Price Tag' },
                  ] as const
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setLabelFormat(preset.id)}
                    className={`px-2.5 py-2 rounded-xl text-xs font-bold cursor-pointer border ${
                      labelFormat === preset.id
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={showOptPharmacy} onChange={(e) => setShowOptPharmacy(e.target.checked)} />
                  <span>Pharmacy Name</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={showOptGeneric} onChange={(e) => setShowOptGeneric(e.target.checked)} />
                  <span>Generic</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={showOptBatchExp} onChange={(e) => setShowOptBatchExp(e.target.checked)} />
                  <span>Batch &amp; Exp</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={showOptPrice} onChange={(e) => setShowOptPrice(e.target.checked)} />
                  <span>MRP / Price</span>
                </label>
              </div>
            </div>
          </div>

          {/* Right: Label Queue + Live Code-128B SVG Preview */}
          <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-black">
                {isBn
                  ? `প্রিন্ট কিউ ও লাইভ বারকোড প্রিভিউ (${labelQueue.reduce((s, q) => s + q.copies, 0)} লেবেল)`
                  : `Print Queue & Live Code-128B Preview (${labelQueue.reduce((s, q) => s + q.copies, 0)} Labels)`}
              </div>
              <button
                type="button"
                onClick={handlePrintBarcodes}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isBn ? 'বারকোড লেবেল প্রিন্ট করুন' : 'Print Barcode Labels'}</span>
              </button>
            </div>

            {labelQueue.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Select medicines from the left list to generate scannable Code-128B barcode stickers.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto">
                {labelQueue.map((item) => {
                  const bits = encodeCode128B(item.barcode);
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 space-y-2"
                    >
                      {/* Visual White Sticker Preview */}
                      <div className="bg-white text-slate-900 rounded-lg p-2.5 border border-slate-300 text-center space-y-1">
                        {showOptPharmacy && (
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 truncate">
                            {activeBranchObj?.name || 'PharmaPulse Pharmacy'}
                          </div>
                        )}
                        <div className="text-xs font-black truncate">
                          {item.medicineName} {item.strength}
                        </div>
                        {showOptGeneric && (
                          <div className="text-[10px] text-slate-500 truncate">{item.genericName}</div>
                        )}
                        <svg
                          viewBox={`0 0 ${bits.length} 36`}
                          preserveAspectRatio="none"
                          className="w-full h-9 block"
                        >
                          {bits.split('').map((b, idx) =>
                            b === '1' ? (
                              <rect key={idx} x={idx} y={0} width={1.05} height={36} fill="#000" />
                            ) : null
                          )}
                        </svg>
                        <div className="font-mono text-[10px] font-bold tracking-widest">
                          {item.barcode}
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold pt-0.5">
                          <span>{showOptBatchExp ? `B:${item.batchNumber} E:${item.expiryDate}` : ''}</span>
                          {showOptPrice && (
                            <span className="text-xs font-black">MRP ৳{item.mrp.toFixed(2)}</span>
                          )}
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-semibold">Copies:</span>
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={item.copies}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value) || 1);
                              setLabelQueue((prev) =>
                                prev.map((q) => (q.id === item.id ? { ...q, copies: val } : q))
                              );
                            }}
                            className="w-16 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold text-center"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAssignBarcodeToMaster(item)}
                            className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            title="Generate & Save EAN-13 to Product Master"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>New EAN-13</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setLabelQueue((prev) => prev.filter((q) => q.id !== item.id))
                            }
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 5: ONE-CLICK DATA BACKUP & RESTORE                              */}
      {/* =================================================================== */}
      {activeInnerTab === 'backup' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: One-Click Backup & Cloud Sync */}
          <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-500" />
                  <span>{isBn ? 'এক-ক্লিক সম্পূর্ণ ডেটাবেস ব্যাকআপ' : 'One-Click System Backup & Cloud Sync'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isBn
                    ? 'সকল ইনভয়েস, ক্যাশবুক, ভাউচার, স্টক ব্যাচ ও গ্রাহক তথ্য JSON ফাইলে সংরক্ষণ করুন।'
                    : 'Snapshot sales, cashbook vouchers, closings, inventory batches, suppliers, and customer ledgers.'}
                </p>
              </div>
              {backupMeta && (
                <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  Last: {new Date(backupMeta.lastBackupAt).toLocaleDateString()}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500">Medicines</div>
                <div className="font-mono font-black text-lg mt-0.5">{fmtInt(medicines.length)}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500">Sales Invoices</div>
                <div className="font-mono font-black text-lg mt-0.5">{fmtInt(sales.length)}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500">Vouchers</div>
                <div className="font-mono font-black text-lg mt-0.5">{fmtInt(vouchers.length)}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500">Day Closings</div>
                <div className="font-mono font-black text-lg mt-0.5">{fmtInt(dailyClosings.length)}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleDownloadFullJsonBackup}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{isBn ? 'ফুল JSON ব্যাকআপ ডাউনলোড' : 'Download Full JSON Backup'}</span>
              </button>

              <button
                type="button"
                onClick={handleCloudSyncNow}
                disabled={isSyncingCloud}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                <span>{isBn ? 'নিওন ক্লাউড সিঙ্ক' : 'Sync Neon Cloud DB'}</span>
              </button>
            </div>
          </div>

          {/* Right: Restore from JSON Backup */}
          <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
            <div>
              <h3 className="text-sm font-black flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-500" />
                <span>{isBn ? 'JSON ব্যাকআপ ফাইল থেকে পুনরুদ্ধার' : 'Restore from JSON Backup File'}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isBn
                  ? 'নিরাপদ মার্জ বা সম্পূর্ণ রিপ্লেস মোডে পূর্বের স্ন্যাপশট রিস্টোর করুন।'
                  : 'Inspect a PharmaPulse JSON backup snapshot and restore in safe Merge or Replace mode.'}
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelectForRestore}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-6 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 bg-slate-50 dark:bg-slate-900/60 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer flex flex-col items-center gap-2"
            >
              <Layers className="w-6 h-6 text-indigo-500" />
              <span>
                {restoreFileName
                  ? `Selected: ${restoreFileName}`
                  : isBn
                  ? 'ক্লিক করে .json ব্যাকআপ ফাইল নির্বাচন করুন'
                  : 'Click to select PharmaPulse .json backup file'}
              </span>
            </button>

            {pendingRestorePayload && (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-indigo-300 dark:border-indigo-800 p-3.5 space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="font-bold">Snapshot Exported:</span>
                  <span className="font-mono">
                    {pendingRestorePayload.exportedAt
                      ? new Date(pendingRestorePayload.exportedAt).toLocaleString()
                      : 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="restoreMode"
                      checked={restoreMode === 'merge'}
                      onChange={() => setRestoreMode('merge')}
                    />
                    <span>Safe Merge (Keep Existing + Add Missing)</span>
                  </label>
                  <label className="flex items-center gap-1.5 font-bold text-rose-600 cursor-pointer">
                    <input
                      type="radio"
                      name="restoreMode"
                      checked={restoreMode === 'replace'}
                      onChange={() => setRestoreMode('replace')}
                    />
                    <span>Full Replace</span>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleConfirmRestoreBackup}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black cursor-pointer"
                >
                  {isBn ? '✓ ব্যাকআপ পুনরুদ্ধার নিশ্চিত করুন' : '✓ Confirm & Restore Snapshot'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: EDIT OPENING DRAWER CASH                                     */}
      {/* =================================================================== */}
      {showOpeningModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="bg-[#0e1525] text-white px-5 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>{isBn ? 'প্রারম্ভিক ড্রয়ার ক্যাশ সম্পাদনা' : 'Edit Opening Drawer Cash'}</span>
              </h3>
              <button onClick={() => setShowOpeningModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveOpeningCash} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1">
                  {isBn ? `তারিখ (${cashbookDate}) এর প্রারম্ভিক ক্যাশ (৳)` : `Opening Float for ${cashbookDate} (৳)`}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={editOpeningVal}
                  onChange={(e) => setEditOpeningVal(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-base font-black"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {[5000, 10000, 15000, 20000, 25000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setEditOpeningVal(preset)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white font-mono font-bold cursor-pointer"
                  >
                    ৳{preset.toLocaleString()}
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOpeningModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  {isBn ? '✓ সংরক্ষণ করুন' : '✓ Save Opening Cash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ADD DAILY EXPENSE / SUPPLIER CASH PAID                       */}
      {/* =================================================================== */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="bg-rose-950 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <MinusCircle className="w-4 h-4 text-rose-400" />
                <span>{isBn ? 'দৈনিক খরচ / সাপ্লায়ার নগদ প্রদান' : 'Record Daily Expense / Supplier Cash Paid'}</span>
              </h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-rose-200 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveExpenseVoucher} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExpVoucherType('SHOP_EXPENSE')}
                  className={`py-2 rounded-xl font-bold border cursor-pointer ${
                    expVoucherType === 'SHOP_EXPENSE'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  4. Daily Shop Expense
                </button>
                <button
                  type="button"
                  onClick={() => setExpVoucherType('SUPPLIER_CASH_PAID')}
                  className={`py-2 rounded-xl font-bold border cursor-pointer ${
                    expVoucherType === 'SUPPLIER_CASH_PAID'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  5. Supplier Cash Paid
                </button>
              </div>

              {expVoucherType === 'SHOP_EXPENSE' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Expense Category</label>
                    <select
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                    >
                      {SHOP_EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Paid To (Staff / Vendor)</label>
                    <input
                      type="text"
                      value={expPartyName}
                      onChange={(e) => setExpPartyName(e.target.value)}
                      placeholder="e.g. DESCO / Tea Stall / Rider"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Select Pharma Supplier</label>
                    <select
                      value={expSupplierId}
                      onChange={(e) => {
                        setExpSupplierId(e.target.value);
                        const found = suppliers.find((s) => s.id === e.target.value);
                        if (found) setExpPartyName(found.name);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                    >
                      <option value="">-- Select or Type Supplier --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (Payable: ৳{Number(s.balancePayable || 0).toFixed(0)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Supplier / Depot Name</label>
                    <input
                      type="text"
                      value={expPartyName}
                      onChange={(e) => setExpPartyName(e.target.value)}
                      placeholder="Supplier company name"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Cash Amount Paid (৳) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0.01}
                    required
                    value={expAmount || ''}
                    onChange={(e) => setExpAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border-2 border-rose-400 bg-white dark:bg-slate-800 font-mono text-sm font-black"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Invoice / Slip Reference #</label>
                  <input
                    type="text"
                    value={expRefNo}
                    onChange={(e) => setExpRefNo(e.target.value)}
                    placeholder="Optional receipt / PO #"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Particulars / Description *</label>
                <input
                  type="text"
                  required
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="Enter voucher details..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingVoucher}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                >
                  {isSavingVoucher ? 'Saving...' : '✓ Save Cash-Out Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ADD CASH IN / CUSTOMER DUE COLLECTION                        */}
      {/* =================================================================== */}
      {showCashInModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="bg-indigo-950 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-indigo-400" />
                <span>{isBn ? 'ক্যাশ ইন / গ্রাহকের বকেয়া আদায়' : 'Record Customer Due / Misc Cash-In'}</span>
              </h3>
              <button onClick={() => setShowCashInModal(false)} className="text-indigo-200 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCashInVoucher} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInVoucherType('DUE_COLLECTION')}
                  className={`py-2 rounded-xl font-bold border cursor-pointer ${
                    inVoucherType === 'DUE_COLLECTION'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  Customer Due Collection
                </button>
                <button
                  type="button"
                  onClick={() => setInVoucherType('MISC_CASH_IN')}
                  className={`py-2 rounded-xl font-bold border cursor-pointer ${
                    inVoucherType === 'MISC_CASH_IN'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  Misc Cash-In / Capital
                </button>
              </div>

              {inVoucherType === 'DUE_COLLECTION' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Open Due Invoice (Optional)</label>
                    <select
                      value={inSaleInvoiceRef}
                      onChange={(e) => {
                        setInSaleInvoiceRef(e.target.value);
                        const inv = openDueInvoices.find((s) => s.invoiceNumber === e.target.value);
                        if (inv) {
                          setInPartyName(inv.customerName);
                          setInAmount(Number(inv.dueAmount || 0));
                          if (inv.customerId) setInCustomerId(inv.customerId);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option value="">-- Select Due Invoice --</option>
                      {openDueInvoices.map((s) => (
                        <option key={s.id} value={s.invoiceNumber}>
                          #{s.invoiceNumber} — {s.customerName} (Due: ৳{Number(s.dueAmount || 0).toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Customer with Balance</label>
                    <select
                      value={inCustomerId}
                      onChange={(e) => {
                        setInCustomerId(e.target.value);
                        const c = customers.find((cu) => cu.id === e.target.value);
                        if (c) {
                          setInPartyName(c.name);
                          if (!inAmount && c.outstandingBalance > 0) setInAmount(c.outstandingBalance);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option value="">-- Select Customer --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} (Due: ৳{Number(c.outstandingBalance || 0).toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block font-bold mb-1">Receipt Category</label>
                  <select
                    value={inCategory}
                    onChange={(e) => setInCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                  >
                    {CASH_IN_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Received From *</label>
                  <input
                    type="text"
                    required
                    value={inPartyName}
                    onChange={(e) => setInPartyName(e.target.value)}
                    placeholder="Customer / Owner / Source"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Cash Received (৳) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0.01}
                    required
                    value={inAmount || ''}
                    onChange={(e) => setInAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border-2 border-indigo-400 bg-white dark:bg-slate-800 font-mono text-sm font-black"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Notes / Particulars</label>
                <input
                  type="text"
                  value={inDesc}
                  onChange={(e) => setInDesc(e.target.value)}
                  placeholder="Receipt description..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCashInModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingVoucher}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                >
                  {isSavingVoucher ? 'Saving...' : '✓ Save Cash-In Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: DUAL A4 & 80mm THERMAL PRINT ENGINE                          */}
      {/* =================================================================== */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="bg-emerald-950 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>{isBn ? 'ক্যাশবুক প্রিন্ট ফরম্যাট নির্বাচন' : 'Dual A4 & 80mm POS Print Engine'}</span>
              </h3>
              <button onClick={() => setShowPrintModal(false)} className="text-emerald-200 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPrintMode('a4')}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer ${
                    printMode === 'a4'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="font-black text-sm">A4 Audit Sheet</div>
                  <div className="text-[11px] opacity-80 mt-0.5">Full T-Account + Signatures</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintMode('80mm')}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer ${
                    printMode === '80mm'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="font-black text-sm">80mm Thermal Z-Slip</div>
                  <div className="text-[11px] opacity-80 mt-0.5">Counter POS Receipt Roll</div>
                </button>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span className="font-bold">{cashbookDate}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Cash Inflow:</span>
                  <span className="font-bold text-emerald-600">{fmtCur(sheet.totalCashInflow)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Cash Outflow:</span>
                  <span className="font-bold text-rose-500">-{fmtCur(sheet.totalCashOutflow)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1">
                  <span className="font-bold">Net Closing Cash:</span>
                  <span className="font-black">{fmtCur(sheet.netClosingCashInHand)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerThermalOrA4Print(printMode);
                    setShowPrintModal(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print {printMode === 'a4' ? 'A4 Cashbook' : '80mm Z-Report'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
