import {
  Sale,
  Medicine,
  Batch,
  SaleReturn,
  AccountingTransaction,
} from '../types/pharmacy';
import { BranchInfo } from '../types/pharmapulse';
import { round2, normalizeInvoice, NormalizedInvoice } from './invoiceLedgerMath';

export { round2 };

export type CashbookVoucherType =
  | 'SHOP_EXPENSE'
  | 'SUPPLIER_CASH_PAID'
  | 'DUE_COLLECTION'
  | 'MISC_CASH_IN';

export interface CashbookVoucherRecord {
  id: string;
  voucherNo: string;
  voucherDate: string; // YYYY-MM-DD
  voucherType: CashbookVoucherType;
  direction: 'IN' | 'OUT';
  category: string;
  amount: number;
  partyName: string;
  partyId?: string;
  referenceNo?: string;
  paymentMethod: string;
  description: string;
  branchId: string;
  branchName: string;
  createdBy: string;
  createdAt: string;
}

export type DenominationNote = 1000 | 500 | 200 | 100 | 50 | 20 | 10 | 5 | 2 | 1;
export const BDT_DENOMINATIONS: readonly DenominationNote[] = [
  1000, 500, 200, 100, 50, 20, 10, 5, 2, 1,
] as const;

export type DenominationCounts = Record<DenominationNote, number>;

export const createEmptyDenominations = (): DenominationCounts => ({
  1000: 0,
  500: 0,
  200: 0,
  100: 0,
  50: 0,
  20: 0,
  10: 0,
  5: 0,
  2: 0,
  1: 0,
});

export interface CashbookDailyClosingRecord {
  id: string;
  cashbookDate: string;
  branchId: string;
  branchName: string;
  openingCash: number;
  posCashSales: number;
  dueAndMiscCashIn: number;
  dailyShopExpense: number;
  supplierCashPaid: number;
  expectedClosingCash: number;
  countedPhysicalCash: number;
  variance: number;
  vaultTransfer: number;
  carryForwardFloat: number;
  denominations: DenominationCounts & { looseCoins?: number };
  status: 'OPEN' | 'BALANCED' | 'SURPLUS' | 'SHORTAGE';
  closedBy?: string;
  notes?: string;
  closedAt?: string;
  updatedAt?: string;
}

export interface CashbookSheetLine {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  direction: 'IN' | 'OUT';
  source: 'opening' | 'pos' | 'voucher' | 'return' | 'accounting';
  voucher?: CashbookVoucherRecord;
}

export interface DailyCashbookComputed {
  cashbookDate: string;
  openingCash: number;
  posCashSales: number;
  netInvoiceSales: number;
  grossInvoiceBill: number;
  invoiceCount: number;
  totalDiscountGranted: number;
  totalVat: number;
  dueCashIn: number;
  miscCashIn: number;
  dueAndMiscCashIn: number;
  dailyShopExpense: number;
  cashReturnsRefunded: number;
  supplierCashPaid: number;
  totalCashInflow: number;
  totalCashOutflow: number;
  netClosingCashInHand: number;
  mfsCollection: number;
  cardSettlement: number;
  digitalAndCardTotal: number;
  newCreditDueSales: number;
  dateInvoices: NormalizedInvoice[];
  dateVouchers: CashbookVoucherRecord[];
  debitLines: CashbookSheetLine[];
  creditLines: CashbookSheetLine[];
}

export interface DenominationReconciliation {
  physicalCash: number;
  expectedClosingCash: number;
  variance: number;
  status: 'BALANCED' | 'SURPLUS' | 'SHORTAGE';
  vaultTransfer: number;
  carryForwardFloat: number;
}

const matchesBranchScope = (
  itemBranchId: string | undefined,
  targetBranchId: string,
  branches: BranchInfo[]
): boolean => {
  if (!targetBranchId || targetBranchId === 'all') return true;
  if (!itemBranchId) {
    const target = branches.find((b) => b.id === targetBranchId);
    return target?.type === 'head_office' || targetBranchId === 'HQ-MAIN';
  }
  if (itemBranchId === targetBranchId) return true;
  return branches.some(
    (b) =>
      b.id === targetBranchId &&
      ((b.code && b.code.toLowerCase() === itemBranchId.toLowerCase()) ||
        (b.name && b.name.toLowerCase() === itemBranchId.toLowerCase()))
  );
};

export function computeDailyCashbookSheet(params: {
  cashbookDate: string;
  branchId: string;
  openingCash: number;
  sales: Sale[];
  medicines: Medicine[];
  batches: Batch[];
  branches: BranchInfo[];
  vouchers: CashbookVoucherRecord[];
  returns: SaleReturn[];
  accountingTx: AccountingTransaction[];
}): DailyCashbookComputed {
  const {
    cashbookDate,
    branchId,
    openingCash: rawOpening,
    sales,
    medicines,
    batches,
    branches,
    vouchers,
    returns,
    accountingTx,
  } = params;

  const openingCash = round2(Math.max(0, Number(rawOpening || 0)));

  const dateInvoices = sales
    .map((s) => normalizeInvoice(s, medicines, batches, branches))
    .filter((inv) => {
      if (inv.date !== cashbookDate) return false;
      if (branchId === 'all') return true;
      return inv.branchId === branchId;
    });

  const posCashSales = round2(dateInvoices.reduce((sum, inv) => sum + inv.cashCollected, 0));
  const netInvoiceSales = round2(dateInvoices.reduce((sum, inv) => sum + inv.netSale, 0));
  const grossInvoiceBill = round2(dateInvoices.reduce((sum, inv) => sum + inv.grossBill, 0));
  const totalDiscountGranted = round2(dateInvoices.reduce((sum, inv) => sum + inv.discountGiven, 0));
  const totalVat = round2(dateInvoices.reduce((sum, inv) => sum + inv.vatAmount, 0));
  const mfsCollection = round2(dateInvoices.reduce((sum, inv) => sum + inv.mfsCollected, 0));
  const cardSettlement = round2(dateInvoices.reduce((sum, inv) => sum + inv.cardCollected, 0));
  const digitalAndCardTotal = round2(mfsCollection + cardSettlement);
  const newCreditDueSales = round2(dateInvoices.reduce((sum, inv) => sum + inv.dueAmount, 0));

  const dateVouchers = vouchers.filter(
    (v) =>
      v.voucherDate === cashbookDate &&
      matchesBranchScope(v.branchId, branchId, branches)
  );

  const voucherNosSet = new Set(dateVouchers.map((v) => v.voucherNo));
  const voucherRefSet = new Set(dateVouchers.map((v) => v.referenceNo).filter(Boolean) as string[]);
  const invoiceNosInDate = new Set(dateInvoices.map((inv) => inv.invoiceNumber));

  const dueVouchers = dateVouchers.filter((v) => v.voucherType === 'DUE_COLLECTION');
  const miscInVouchers = dateVouchers.filter((v) => v.voucherType === 'MISC_CASH_IN');
  const shopExpenseVouchers = dateVouchers.filter((v) => v.voucherType === 'SHOP_EXPENSE');
  const supplierCashVouchers = dateVouchers.filter((v) => v.voucherType === 'SUPPLIER_CASH_PAID');

  // Avoid double counting accounting entries created from same-day POS or explicit cashbook vouchers
  const unlinkedDueTx = accountingTx.filter(
    (t) =>
      t.date === cashbookDate &&
      t.account === 'Cash' &&
      Number(t.credit || 0) > 0 &&
      ((t.description || '').toLowerCase().includes('due') ||
        (t.description || '').toLowerCase().includes('receivable')) &&
      !invoiceNosInDate.has(t.referenceId) &&
      !voucherNosSet.has(t.referenceId) &&
      !voucherRefSet.has(t.referenceId) &&
      matchesBranchScope(t.branchId, branchId, branches)
  );

  const dueVoucherSum = round2(dueVouchers.reduce((s, v) => s + Number(v.amount || 0), 0));
  const unlinkedDueSum = round2(unlinkedDueTx.reduce((s, t) => s + Number(t.credit || 0), 0));
  const dueCashIn = round2(dueVoucherSum + unlinkedDueSum);
  const miscCashIn = round2(miscInVouchers.reduce((s, v) => s + Number(v.amount || 0), 0));
  const dueAndMiscCashIn = round2(dueCashIn + miscCashIn);

  const cashReturnsOnDate = returns.filter(
    (r) =>
      r.date === cashbookDate &&
      r.refundMethod === 'cash' &&
      matchesBranchScope(r.branchId, branchId, branches)
  );
  const cashReturnsRefunded = round2(
    cashReturnsOnDate.reduce((s, r) => s + Number(r.totalRefund || 0), 0)
  );

  const unlinkedOpExTx = accountingTx.filter(
    (t) =>
      t.date === cashbookDate &&
      t.type === 'operational_expense' &&
      t.account === 'Cash' &&
      Number(t.debit || 0) > 0 &&
      !voucherNosSet.has(t.referenceId) &&
      matchesBranchScope(t.branchId, branchId, branches)
  );

  const unlinkedSupplierCashTx = accountingTx.filter(
    (t) =>
      t.date === cashbookDate &&
      t.type === 'supplier_payment' &&
      (t.description || '').toLowerCase().includes('cash') &&
      Number(t.debit || 0) > 0 &&
      !voucherNosSet.has(t.referenceId) &&
      matchesBranchScope(t.branchId, branchId, branches)
  );

  const shopExpenseVSum = round2(shopExpenseVouchers.reduce((s, v) => s + Number(v.amount || 0), 0));
  const unlinkedOpExSum = round2(unlinkedOpExTx.reduce((s, t) => s + Number(t.debit || 0), 0));
  const dailyShopExpense = round2(shopExpenseVSum + unlinkedOpExSum + cashReturnsRefunded);

  const supplierVoucherSum = round2(supplierCashVouchers.reduce((s, v) => s + Number(v.amount || 0), 0));
  const unlinkedSupSum = round2(unlinkedSupplierCashTx.reduce((s, t) => s + Number(t.debit || 0), 0));
  const supplierCashPaid = round2(supplierVoucherSum + unlinkedSupSum);

  const totalCashInflow = round2(openingCash + posCashSales + dueAndMiscCashIn);
  const totalCashOutflow = round2(dailyShopExpense + supplierCashPaid);
  const netClosingCashInHand = round2(totalCashInflow - totalCashOutflow);

  // Build Debit (Inflow) T-Account lines
  const debitLines: CashbookSheetLine[] = [
    {
      id: 'opening-bf',
      title: '1. Opening Cash Balance (B/F)',
      subtitle: 'Counter-01 starting drawer float',
      amount: openingCash,
      direction: 'IN',
      source: 'opening',
    },
    {
      id: 'pos-cash-sales',
      title: `2. POS Invoice Cash Sales (${dateInvoices.length} Invoices)`,
      subtitle: `Gross Bill: ৳${grossInvoiceBill.toFixed(2)} | Discount: -৳${totalDiscountGranted.toFixed(2)}`,
      amount: posCashSales,
      direction: 'IN',
      source: 'pos',
    },
  ];

  let debitIndex = 3;
  dueVouchers.forEach((v) => {
    debitLines.push({
      id: v.id,
      title: `${debitIndex++}. Due Collection — ${v.partyName}`,
      subtitle: `${v.voucherNo}${v.referenceNo ? ` • Ref: ${v.referenceNo}` : ''} • ${v.description}`,
      amount: round2(v.amount),
      direction: 'IN',
      source: 'voucher',
      voucher: v,
    });
  });

  unlinkedDueTx.forEach((t) => {
    debitLines.push({
      id: t.id,
      title: `${debitIndex++}. Customer Due Receipt (${t.referenceId})`,
      subtitle: t.description,
      amount: round2(t.credit),
      direction: 'IN',
      source: 'accounting',
    });
  });

  miscInVouchers.forEach((v) => {
    debitLines.push({
      id: v.id,
      title: `${debitIndex++}. ${v.category} — ${v.partyName}`,
      subtitle: `${v.voucherNo} • ${v.description}`,
      amount: round2(v.amount),
      direction: 'IN',
      source: 'voucher',
      voucher: v,
    });
  });

  // Build Credit (Outflow) T-Account lines
  const creditLines: CashbookSheetLine[] = [];

  shopExpenseVouchers.forEach((v) => {
    creditLines.push({
      id: v.id,
      title: `${v.category} — ${v.partyName}`,
      subtitle: `${v.voucherNo} • ${v.description}`,
      amount: round2(v.amount),
      direction: 'OUT',
      source: 'voucher',
      voucher: v,
    });
  });

  supplierCashVouchers.forEach((v) => {
    creditLines.push({
      id: v.id,
      title: `Supplier Paid — ${v.partyName}`,
      subtitle: `${v.voucherNo}${v.referenceNo ? ` • Inv: ${v.referenceNo}` : ''} • ${v.description}`,
      amount: round2(v.amount),
      direction: 'OUT',
      source: 'voucher',
      voucher: v,
    });
  });

  cashReturnsOnDate.forEach((r) => {
    creditLines.push({
      id: r.id,
      title: `Cash Refund — ${r.returnNumber}`,
      subtitle: `${r.customerName} • Orig Invoice #${r.originalInvoiceNumber}`,
      amount: round2(r.totalRefund),
      direction: 'OUT',
      source: 'return',
    });
  });

  unlinkedOpExTx.forEach((t) => {
    creditLines.push({
      id: t.id,
      title: `Operating Expense (${t.referenceId})`,
      subtitle: t.description,
      amount: round2(t.debit),
      direction: 'OUT',
      source: 'accounting',
    });
  });

  unlinkedSupplierCashTx.forEach((t) => {
    creditLines.push({
      id: t.id,
      title: `Supplier Cash Payment (${t.referenceId})`,
      subtitle: t.description,
      amount: round2(t.debit),
      direction: 'OUT',
      source: 'accounting',
    });
  });

  return {
    cashbookDate,
    openingCash,
    posCashSales,
    netInvoiceSales,
    grossInvoiceBill,
    invoiceCount: dateInvoices.length,
    totalDiscountGranted,
    totalVat,
    dueCashIn,
    miscCashIn,
    dueAndMiscCashIn,
    dailyShopExpense,
    cashReturnsRefunded,
    supplierCashPaid,
    totalCashInflow,
    totalCashOutflow,
    netClosingCashInHand,
    mfsCollection,
    cardSettlement,
    digitalAndCardTotal,
    newCreditDueSales,
    dateInvoices,
    dateVouchers,
    debitLines,
    creditLines,
  };
}

export function computeDenominationReconciliation(
  counts: DenominationCounts,
  looseCoins: number,
  expectedClosingCash: number,
  vaultTransfer: number
): DenominationReconciliation {
  const notesSum = BDT_DENOMINATIONS.reduce(
    (sum, denom) => sum + denom * Math.max(0, Math.floor(Number(counts[denom] || 0))),
    0
  );
  const physicalCash = round2(notesSum + Math.max(0, Number(looseCoins || 0)));
  const expected = round2(expectedClosingCash);
  const variance = round2(physicalCash - expected);
  const status: DenominationReconciliation['status'] =
    Math.abs(variance) < 0.01 ? 'BALANCED' : variance > 0 ? 'SURPLUS' : 'SHORTAGE';
  const clampedVault = round2(Math.min(physicalCash, Math.max(0, Number(vaultTransfer || 0))));
  const carryForwardFloat = round2(Math.max(0, physicalCash - clampedVault));

  return {
    physicalCash,
    expectedClosingCash: expected,
    variance,
    status,
    vaultTransfer: clampedVault,
    carryForwardFloat,
  };
}

export function autoAllocateDenominations(amount: number): {
  counts: DenominationCounts;
  looseCoins: number;
} {
  const counts = createEmptyDenominations();
  let remaining = Math.max(0, round2(amount));
  const wholeTaka = Math.floor(remaining);
  const fractional = round2(remaining - wholeTaka);

  let remInt = wholeTaka;
  for (const denom of BDT_DENOMINATIONS) {
    const qty = Math.floor(remInt / denom);
    counts[denom] = qty;
    remInt -= qty * denom;
  }

  return {
    counts,
    looseCoins: round2(remInt + fractional),
  };
}

export function generateValidEan13(seed?: string): string {
  const digitsOnly = (seed || '').replace(/\D/g, '');
  const randomDigits = String(Math.floor(100000000 + Math.random() * 899999999));
  // Prefix 894 (custom pharma/retail internal GS1 block matching existing PharmaPulse barcodes)
  const base12 = ('894' + digitsOnly + randomDigits).slice(0, 12).padEnd(12, '0');
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(base12[i]);
    sum += i % 2 === 0 ? d : d * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${base12}${checkDigit}`;
}

// Standard Code-128 bar/space widths (values 0..106)
const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

function widthsToBinary(widths: string): string {
  let bits = '';
  for (let i = 0; i < widths.length; i++) {
    const count = Number(widths[i]);
    const ch = i % 2 === 0 ? '1' : '0';
    bits += ch.repeat(count);
  }
  return bits;
}

/**
 * Encodes an alphanumeric ASCII string into a scannable Code-128B binary bar pattern ('1' = black bar, '0' = white space)
 */
export function encodeCode128B(rawText: string): string {
  const sanitized = (rawText || '000000')
    .split('')
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code <= 126 ? ch : '-';
    })
    .join('');

  const startCode = 104; // Start B
  let checksum = startCode;
  let binary = widthsToBinary(CODE128_PATTERNS[startCode]);

  for (let i = 0; i < sanitized.length; i++) {
    const val = sanitized.charCodeAt(i) - 32;
    checksum += val * (i + 1);
    binary += widthsToBinary(CODE128_PATTERNS[val]);
  }

  const checkSymbol = checksum % 103;
  binary += widthsToBinary(CODE128_PATTERNS[checkSymbol]);
  binary += widthsToBinary(CODE128_PATTERNS[106]); // Stop symbol
  return binary;
}
