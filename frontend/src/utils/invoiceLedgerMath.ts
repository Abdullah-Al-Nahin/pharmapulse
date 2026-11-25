import { Sale, Medicine, Batch, SaleReturn, AccountingTransaction } from '../types/pharmacy';
import { BranchInfo } from '../types/pharmapulse';

export const round2 = (n: number): number =>
  Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

export type LedgerPeriod = 'today' | 'yesterday' | 'last7' | 'month' | 'all' | 'custom';
export type LedgerPaymentFilter =
  | 'all'
  | 'discounted'
  | 'cash'
  | 'bkash_nagad'
  | 'card'
  | 'split'
  | 'due_credit';

export interface NormalizedInvoiceItem {
  medicineId: string;
  medicineName: string;
  genericName: string;
  category: string;
  manufacturer: string;
  batchNumber: string;
  expiryDate: string;
  qty: number;
  unitRate: number;
  mrpRate: number;
  lineGross: number;
  lineNet: number;
  itemDiscount: number;
  unitCost: number;
  lineCogs: number;
  lineProfit: number;
}

export interface NormalizedInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  timestamp: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  cashierName: string;
  items: NormalizedInvoiceItem[];
  totalUnits: number;
  grossBill: number;
  discountGiven: number;
  discountPercent: number;
  vatAmount: number;
  roundOff: number;
  netSale: number;
  cogs: number;
  grossProfit: number;
  profitMarginPct: number;
  cashCollected: number;
  cashTendered: number;
  changeGiven: number;
  mfsCollected: number;
  cardCollected: number;
  mfsOrCardTotal: number;
  mfsOrCardRef?: string;
  dueAmount: number;
  realizedAmount: number;
  normalizedMode: 'cash' | 'bkash_nagad' | 'card' | 'split' | 'due_credit';
  paymentStatus: 'paid' | 'partially_paid' | 'due';
  rawSale: Sale;
}

export interface MasterLedgerKpis {
  grossInvoiceBill: number;
  invoiceCount: number;
  totalUnitsSold: number;
  totalDiscountGiven: number;
  discountedInvoiceCount: number;
  effectiveDiscountPct: number;
  netInvoiceSales: number;
  totalVat: number;
  totalRoundOff: number;
  netCashCollection: number;
  totalCashTendered: number;
  totalChangeGiven: number;
  totalMfsCollection: number;
  totalCardCollection: number;
  totalMfsAndCard: number;
  totalDue: number;
  totalGrossProfit: number;
  totalCogs: number;
  totalRealizedCollection: number;
  avgMarginPct: number;
}

export interface CategorySalesRow {
  category: string;
  invoiceCount: number;
  unitsSold: number;
  grossSales: number;
  discountGiven: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  sharePct: number;
}

export interface ProductSalesRow {
  medicineKey: string;
  medicineName: string;
  genericName: string;
  category: string;
  manufacturer: string;
  batchesUsed: string[];
  invoiceCount: number;
  qtySold: number;
  avgRate: number;
  grossSales: number;
  discountGiven: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  currentStock: number;
}

export interface ChannelAuditRow {
  mode: 'cash' | 'bkash_nagad' | 'card' | 'split' | 'due_credit';
  labelEn: string;
  labelBn: string;
  invoiceCount: number;
  grossBill: number;
  discountGiven: number;
  netSales: number;
  cashTendered: number;
  changeGiven: number;
  cashRetained: number;
  digitalSettled: number;
  duePending: number;
  realizationPct: number;
}

export interface CashierAuditRow {
  cashierName: string;
  invoiceCount: number;
  grossBill: number;
  discountGiven: number;
  avgDiscountPct: number;
  maxDiscountPct: number;
  cashCollected: number;
  mfsAndCardCollected: number;
  dueIssued: number;
  grossProfit: number;
  flagLevel: 'normal' | 'review' | 'high_alert';
}

export interface BranchSalesSummary {
  branchId: string;
  branchName: string;
  branchCode: string;
  invoiceCount: number;
  unitsSold: number;
  grossBill: number;
  discountGiven: number;
  netSales: number;
  cashCollected: number;
  mfsAndCard: number;
  dueAmount: number;
  grossProfit: number;
}

export interface CashbookClosingSummary {
  openingFloat: number;
  cashSalesCollected: number;
  dueCashCollectedInPeriod: number;
  cashReturnsRefunded: number;
  cashExpenses: number;
  expectedDrawerCash: number;
  physicalCountedCash: number;
  variance: number;
  status: 'balanced' | 'surplus' | 'shortage';
}

const resolveBranchInfo = (sale: Sale, branches: BranchInfo[]) => {
  const bId = sale.branchId || '';
  const found = branches.find(
    (b) =>
      b.id === bId ||
      b.code.toLowerCase() === bId.toLowerCase() ||
      (sale.branchName && b.name.toLowerCase() === sale.branchName.toLowerCase())
  );
  if (found) {
    return { branchId: found.id, branchName: found.name, branchCode: found.code };
  }
  const hq = branches.find((b) => b.type === 'head_office') || branches[0];
  if (hq && (!bId || bId === 'main' || bId === 'HQ-MAIN')) {
    return { branchId: hq.id, branchName: hq.name, branchCode: hq.code };
  }
  return {
    branchId: bId || 'HQ-MAIN',
    branchName: sale.branchName || 'Central Dispensary & Main Branch',
    branchCode: bId || 'HQ-MAIN',
  };
};

export function normalizeInvoice(
  sale: Sale,
  medicines: Medicine[],
  batches: Batch[],
  branches: BranchInfo[]
): NormalizedInvoice {
  const medById = new Map(medicines.map((m) => [m.id, m]));
  const medByName = new Map(medicines.map((m) => [m.name.toLowerCase().trim(), m]));
  const batchById = new Map(batches.map((b) => [b.id, b]));

  const normItems: NormalizedInvoiceItem[] = (sale.items || []).map((it) => {
    const med =
      (it.medicineId && medById.get(it.medicineId)) ||
      medByName.get((it.medicineName || '').toLowerCase().trim());
    const batch = it.batchId ? batchById.get(it.batchId) : undefined;

    const qty = Math.max(0, Number(it.quantity || 0));
    const unitRate = round2(it.unitPrice || it.mrp || 0);
    const mrpRate = round2(Math.max(unitRate, it.mrp || unitRate));
    const lineNet = round2(
      it.total !== undefined
        ? Number(it.total)
        : qty * unitRate * (1 - Number(it.discountPercent || 0) / 100)
    );
    const rawGross = round2(qty * mrpRate);
    const lineGross = Math.max(rawGross, lineNet);
    const itemDiscount = Math.max(0, round2(lineGross - lineNet));
    const unitCost = round2(
      Number(it.unitCost || batch?.purchasePrice || med?.purchasePrice || 0)
    );
    const lineCogs = round2(qty * unitCost);

    return {
      medicineId: it.medicineId || med?.id || it.medicineName,
      medicineName: it.medicineName || med?.name || 'Pharmaceutical Item',
      genericName: it.genericName || med?.genericName || '',
      category: med?.category || 'General / OTC',
      manufacturer: med?.manufacturer || 'Standard Pharma',
      batchNumber: it.batchNumber || batch?.batchNumber || 'N/A',
      expiryDate: it.expiryDate || batch?.expiryDate || '',
      qty,
      unitRate,
      mrpRate,
      lineGross,
      lineNet,
      itemDiscount,
      unitCost,
      lineCogs,
      lineProfit: round2(lineNet - lineCogs),
    };
  });

  const totalUnits = normItems.reduce((sum, i) => sum + i.qty, 0);
  const sumItemGross = round2(normItems.reduce((sum, i) => sum + i.lineGross, 0));
  const sumItemCogs = round2(normItems.reduce((sum, i) => sum + i.lineCogs, 0));

  const vatAmount = round2(sale.taxTotal || 0);
  const roundOff = round2(sale.roundOff || 0);
  const netSale = round2(sale.grandTotal || 0);
  const netPreTax = round2(netSale - vatAmount - roundOff);
  const explicitDisc = Math.max(0, round2(sale.discountTotal || 0));
  const rawSub = round2(sale.subtotal || 0);

  let grossBill = netPreTax;
  let discountGiven = 0;

  if (rawSub > 0 && Math.abs(rawSub - explicitDisc - netPreTax) <= 0.1) {
    grossBill = rawSub;
    discountGiven = Math.max(0, round2(grossBill - netPreTax));
  } else if (sumItemGross >= netPreTax) {
    grossBill = Math.max(sumItemGross, round2(netPreTax + explicitDisc));
    discountGiven = Math.max(0, round2(grossBill - netPreTax));
  } else {
    grossBill = round2(Math.max(rawSub, netPreTax + explicitDisc));
    discountGiven = Math.max(0, round2(grossBill - netPreTax));
  }

  const discountPercent =
    grossBill > 0 ? Number(((discountGiven / grossBill) * 100).toFixed(1)) : 0;

  const cogs = round2(sale.totalCost > 0 ? sale.totalCost : sumItemCogs);
  const grossProfit = round2(netSale - vatAmount - cogs);
  const preTaxNet = netSale - vatAmount;
  const profitMarginPct =
    preTaxNet > 0 ? Number(((grossProfit / preTaxNet) * 100).toFixed(1)) : 0;

  const dueAmount = round2(Math.min(netSale, Math.max(0, sale.dueAmount || 0)));
  const realizedAmount = round2(Math.max(0, netSale - dueAmount));

  let cashCollected = 0;
  let mfsCollected = 0;
  let cardCollected = 0;

  const sp = sale.splitDetails;
  const spCash = round2(sp?.cashAmount || 0);
  const spMfs = round2(sp?.mobileAmount || 0);
  const spCard = round2(sp?.cardAmount || 0);
  const spSum = round2(spCash + spMfs + spCard);

  if (sp && spSum > 0) {
    if (Math.abs(spSum - realizedAmount) <= 0.05) {
      cashCollected = spCash;
      mfsCollected = spMfs;
      cardCollected = spCard;
      const diff = round2(realizedAmount - (cashCollected + mfsCollected + cardCollected));
      if (diff !== 0) {
        if (cashCollected > 0) cashCollected = round2(cashCollected + diff);
        else if (mfsCollected > 0) mfsCollected = round2(mfsCollected + diff);
        else cardCollected = round2(cardCollected + diff);
      }
    } else if (realizedAmount > 0) {
      const ratio = realizedAmount / spSum;
      cashCollected = round2(spCash * ratio);
      mfsCollected = round2(spMfs * ratio);
      cardCollected = round2(Math.max(0, realizedAmount - cashCollected - mfsCollected));
    }
  } else {
    const mode = sale.paymentMethod;
    if (mode === 'bkash_nagad' || mode === 'upi_mobile') {
      mfsCollected = realizedAmount;
    } else if (mode === 'card') {
      cardCollected = realizedAmount;
    } else {
      cashCollected = realizedAmount;
    }
  }

  const mfsOrCardTotal = round2(mfsCollected + cardCollected);
  const mfsOrCardRef =
    sp?.mobileTrxId ||
    sp?.cardAuthCode ||
    (mfsCollected > 0 && sale.paymentMethod === 'bkash_nagad' ? 'MFS Settled' : undefined);

  const cashTendered =
    cashCollected > 0
      ? round2(Math.max(cashCollected, sale.cashTendered || cashCollected))
      : 0;
  const changeGiven =
    cashCollected > 0
      ? round2(Math.max(0, sale.changeGiven ?? cashTendered - cashCollected))
      : 0;

  const activeTendersCount =
    (cashCollected > 0.009 ? 1 : 0) +
    (mfsCollected > 0.009 ? 1 : 0) +
    (cardCollected > 0.009 ? 1 : 0);

  let normalizedMode: NormalizedInvoice['normalizedMode'] = 'cash';
  if (dueAmount > 0.009 && realizedAmount <= 0.009) {
    normalizedMode = 'due_credit';
  } else if (
    sale.paymentMethod === 'split' ||
    activeTendersCount > 1 ||
    (dueAmount > 0.009 && realizedAmount > 0.009)
  ) {
    normalizedMode = 'split';
  } else if (mfsCollected > 0.009) {
    normalizedMode = 'bkash_nagad';
  } else if (cardCollected > 0.009) {
    normalizedMode = 'card';
  } else {
    normalizedMode = 'cash';
  }

  const branchInfo = resolveBranchInfo(sale, branches);

  return {
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    date: sale.date || (sale.timestamp ? sale.timestamp.split('T')[0] : ''),
    timestamp: sale.timestamp || `${sale.date}T00:00:00.000Z`,
    branchId: branchInfo.branchId,
    branchName: branchInfo.branchName,
    branchCode: branchInfo.branchCode,
    customerId: sale.customerId,
    customerName: sale.customerName || 'Walk-In Customer',
    customerPhone: sale.customerPhone || '',
    cashierName: sale.cashierName || 'Cashier',
    items: normItems,
    totalUnits,
    grossBill,
    discountGiven,
    discountPercent,
    vatAmount,
    roundOff,
    netSale,
    cogs,
    grossProfit,
    profitMarginPct,
    cashCollected,
    cashTendered,
    changeGiven,
    mfsCollected,
    cardCollected,
    mfsOrCardTotal,
    mfsOrCardRef,
    dueAmount,
    realizedAmount,
    normalizedMode,
    paymentStatus: dueAmount <= 0.009 ? 'paid' : realizedAmount > 0.009 ? 'partially_paid' : 'due',
    rawSale: sale,
  };
}

export function filterInvoicesByPeriod(
  invoices: NormalizedInvoice[],
  period: LedgerPeriod,
  customStart?: string,
  customEnd?: string
): NormalizedInvoice[] {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const sevenAgo = new Date();
  sevenAgo.setDate(sevenAgo.getDate() - 6);
  const sevenAgoStr = sevenAgo.toISOString().split('T')[0];

  const monthPrefix = todayStr.slice(0, 7);

  return invoices.filter((inv) => {
    const d = inv.date || (inv.timestamp ? inv.timestamp.split('T')[0] : '');
    if (!d) return period === 'all';
    if (period === 'today') return d === todayStr;
    if (period === 'yesterday') return d === yesterdayStr;
    if (period === 'last7') return d >= sevenAgoStr && d <= todayStr;
    if (period === 'month') return d.startsWith(monthPrefix);
    if (period === 'custom') {
      if (customStart && d < customStart) return false;
      if (customEnd && d > customEnd) return false;
      return true;
    }
    return true;
  });
}

export function computeMasterKpis(invoices: NormalizedInvoice[]): MasterLedgerKpis {
  let grossInvoiceBill = 0;
  let totalUnitsSold = 0;
  let totalDiscountGiven = 0;
  let discountedInvoiceCount = 0;
  let netInvoiceSales = 0;
  let totalVat = 0;
  let totalRoundOff = 0;
  let netCashCollection = 0;
  let totalCashTendered = 0;
  let totalChangeGiven = 0;
  let totalMfsCollection = 0;
  let totalCardCollection = 0;
  let totalDue = 0;
  let totalGrossProfit = 0;
  let totalCogs = 0;

  invoices.forEach((inv) => {
    grossInvoiceBill += inv.grossBill;
    totalUnitsSold += inv.totalUnits;
    totalDiscountGiven += inv.discountGiven;
    if (inv.discountGiven > 0.009) discountedInvoiceCount += 1;
    netInvoiceSales += inv.netSale;
    totalVat += inv.vatAmount;
    totalRoundOff += inv.roundOff;
    netCashCollection += inv.cashCollected;
    totalCashTendered += inv.cashTendered;
    totalChangeGiven += inv.changeGiven;
    totalMfsCollection += inv.mfsCollected;
    totalCardCollection += inv.cardCollected;
    totalDue += inv.dueAmount;
    totalGrossProfit += inv.grossProfit;
    totalCogs += inv.cogs;
  });

  const grossRounded = round2(grossInvoiceBill);
  const discRounded = round2(totalDiscountGiven);
  const netRounded = round2(netInvoiceSales);
  const vatRounded = round2(totalVat);
  const cashRounded = round2(netCashCollection);
  const mfsRounded = round2(totalMfsCollection);
  const cardRounded = round2(totalCardCollection);
  const mfsCardTotal = round2(mfsRounded + cardRounded);
  const profitRounded = round2(totalGrossProfit);

  const preTaxNet = netRounded - vatRounded;

  return {
    grossInvoiceBill: grossRounded,
    invoiceCount: invoices.length,
    totalUnitsSold,
    totalDiscountGiven: discRounded,
    discountedInvoiceCount,
    effectiveDiscountPct:
      grossRounded > 0 ? Number(((discRounded / grossRounded) * 100).toFixed(1)) : 0,
    netInvoiceSales: netRounded,
    totalVat: vatRounded,
    totalRoundOff: round2(totalRoundOff),
    netCashCollection: cashRounded,
    totalCashTendered: round2(totalCashTendered),
    totalChangeGiven: round2(totalChangeGiven),
    totalMfsCollection: mfsRounded,
    totalCardCollection: cardRounded,
    totalMfsAndCard: mfsCardTotal,
    totalDue: round2(totalDue),
    totalGrossProfit: profitRounded,
    totalCogs: round2(totalCogs),
    totalRealizedCollection: round2(cashRounded + mfsCardTotal),
    avgMarginPct:
      preTaxNet > 0 ? Number(((profitRounded / preTaxNet) * 100).toFixed(1)) : 0,
  };
}

export function computeCategoryBreakdown(invoices: NormalizedInvoice[]): CategorySalesRow[] {
  const catMap = new Map<
    string,
    {
      invoices: Set<string>;
      units: number;
      gross: number;
      discount: number;
      net: number;
      cogs: number;
    }
  >();

  invoices.forEach((inv) => {
    const sumItemNet = round2(inv.items.reduce((s, it) => s + it.lineNet, 0));
    const sumItemDisc = round2(inv.items.reduce((s, it) => s + it.itemDiscount, 0));
    const extraInvDisc = Math.max(0, round2(inv.discountGiven - sumItemDisc));
    const items = inv.items.length > 0 ? inv.items : [];

    items.forEach((it, idx) => {
      const cat = it.category || 'General / OTC';
      const entry = catMap.get(cat) || {
        invoices: new Set<string>(),
        units: 0,
        gross: 0,
        discount: 0,
        net: 0,
        cogs: 0,
      };
      entry.invoices.add(inv.id);
      entry.units += it.qty;

      // Allocate any invoice-level extra discount pro-rata so category totals match netSales strictly
      let shareExtraDisc = 0;
      if (extraInvDisc > 0 && sumItemNet > 0) {
        shareExtraDisc =
          idx === items.length - 1
            ? round2(
                extraInvDisc -
                  items
                    .slice(0, idx)
                    .reduce((acc, prev) => acc + round2((prev.lineNet / sumItemNet) * extraInvDisc), 0)
              )
            : round2((it.lineNet / sumItemNet) * extraInvDisc);
      }

      const effNet = round2(Math.max(0, it.lineNet - shareExtraDisc));
      const effDisc = round2(it.itemDiscount + shareExtraDisc);

      entry.gross = round2(entry.gross + it.lineGross);
      entry.discount = round2(entry.discount + effDisc);
      entry.net = round2(entry.net + effNet);
      entry.cogs = round2(entry.cogs + it.lineCogs);
      catMap.set(cat, entry);
    });
  });

  const totalNet = Array.from(catMap.values()).reduce((s, c) => s + c.net, 0);

  return Array.from(catMap.entries())
    .map(([category, v]) => {
      const grossProfit = round2(v.net - v.cogs);
      return {
        category,
        invoiceCount: v.invoices.size,
        unitsSold: v.units,
        grossSales: round2(v.gross),
        discountGiven: round2(v.discount),
        netSales: round2(v.net),
        cogs: round2(v.cogs),
        grossProfit,
        marginPct: v.net > 0 ? Number(((grossProfit / v.net) * 100).toFixed(1)) : 0,
        sharePct: totalNet > 0 ? Number(((v.net / totalNet) * 100).toFixed(1)) : 0,
      };
    })
    .sort((a, b) => b.netSales - a.netSales);
}

export function computeProductBreakdown(
  invoices: NormalizedInvoice[],
  medicines: Medicine[],
  batches: Batch[]
): ProductSalesRow[] {
  const stockByMedId = new Map<string, number>();
  const stockByName = new Map<string, number>();
  const todayStr = new Date().toISOString().split('T')[0];

  batches.forEach((b) => {
    if (b.status === 'quarantined' || b.status === 'expired' || (b.expiryDate && b.expiryDate <= todayStr)) {
      return;
    }
    const qty = Number(b.currentStock || 0);
    if (b.medicineId) {
      stockByMedId.set(b.medicineId, (stockByMedId.get(b.medicineId) || 0) + qty);
    }
    if (b.medicineName) {
      const k = b.medicineName.toLowerCase().trim();
      stockByName.set(k, (stockByName.get(k) || 0) + qty);
    }
  });

  const map = new Map<
    string,
    {
      medicineId: string;
      medicineName: string;
      genericName: string;
      category: string;
      manufacturer: string;
      batches: Set<string>;
      invoices: Set<string>;
      qtySold: number;
      gross: number;
      discount: number;
      net: number;
      cogs: number;
    }
  >();

  invoices.forEach((inv) => {
    const sumItemNet = round2(inv.items.reduce((s, it) => s + it.lineNet, 0));
    const sumItemDisc = round2(inv.items.reduce((s, it) => s + it.itemDiscount, 0));
    const extraInvDisc = Math.max(0, round2(inv.discountGiven - sumItemDisc));

    inv.items.forEach((it, idx) => {
      const key = it.medicineName.toLowerCase().trim();
      const entry = map.get(key) || {
        medicineId: it.medicineId,
        medicineName: it.medicineName,
        genericName: it.genericName,
        category: it.category,
        manufacturer: it.manufacturer,
        batches: new Set<string>(),
        invoices: new Set<string>(),
        qtySold: 0,
        gross: 0,
        discount: 0,
        net: 0,
        cogs: 0,
      };
      if (it.batchNumber && it.batchNumber !== 'N/A') entry.batches.add(it.batchNumber);
      entry.invoices.add(inv.id);
      entry.qtySold += it.qty;

      let shareExtraDisc = 0;
      if (extraInvDisc > 0 && sumItemNet > 0) {
        shareExtraDisc =
          idx === inv.items.length - 1
            ? round2(
                extraInvDisc -
                  inv.items
                    .slice(0, idx)
                    .reduce((acc, prev) => acc + round2((prev.lineNet / sumItemNet) * extraInvDisc), 0)
              )
            : round2((it.lineNet / sumItemNet) * extraInvDisc);
      }

      const effNet = round2(Math.max(0, it.lineNet - shareExtraDisc));
      const effDisc = round2(it.itemDiscount + shareExtraDisc);

      entry.gross = round2(entry.gross + it.lineGross);
      entry.discount = round2(entry.discount + effDisc);
      entry.net = round2(entry.net + effNet);
      entry.cogs = round2(entry.cogs + it.lineCogs);
      map.set(key, entry);
    });
  });

  return Array.from(map.entries())
    .map(([key, v]) => {
      const grossProfit = round2(v.net - v.cogs);
      const medStock =
        stockByMedId.get(v.medicineId) ??
        stockByName.get(key) ??
        0;
      const medObj = medicines.find(
        (m) => m.id === v.medicineId || m.name.toLowerCase().trim() === key
      );

      return {
        medicineKey: key,
        medicineName: medObj?.name || v.medicineName,
        genericName: medObj?.genericName || v.genericName,
        category: medObj?.category || v.category,
        manufacturer: medObj?.manufacturer || v.manufacturer,
        batchesUsed: Array.from(v.batches),
        invoiceCount: v.invoices.size,
        qtySold: v.qtySold,
        avgRate: v.qtySold > 0 ? round2(v.gross / v.qtySold) : 0,
        grossSales: round2(v.gross),
        discountGiven: round2(v.discount),
        netSales: round2(v.net),
        cogs: round2(v.cogs),
        grossProfit,
        marginPct: v.net > 0 ? Number(((grossProfit / v.net) * 100).toFixed(1)) : 0,
        currentStock: medStock,
      };
    })
    .sort((a, b) => b.netSales - a.netSales);
}

export function computeChannelMatrix(invoices: NormalizedInvoice[]): ChannelAuditRow[] {
  const modes: {
    mode: ChannelAuditRow['mode'];
    labelEn: string;
    labelBn: string;
  }[] = [
    { mode: 'cash', labelEn: 'Cash Counter', labelBn: 'নগদ ক্যাশ' },
    { mode: 'bkash_nagad', labelEn: 'bKash / Nagad MFS', labelBn: 'বিকাশ / নগদ' },
    { mode: 'card', labelEn: 'Card POS', labelBn: 'কার্ড পিওএস' },
    { mode: 'split', labelEn: 'Split Multi-Tender', labelBn: 'স্প্লিট পেমেন্ট' },
    { mode: 'due_credit', labelEn: 'Due / Credit', labelBn: 'বাকি / ক্রেডিট' },
  ];

  return modes.map((cfg) => {
    const list = invoices.filter((i) => i.normalizedMode === cfg.mode);
    const grossBill = round2(list.reduce((s, i) => s + i.grossBill, 0));
    const discountGiven = round2(list.reduce((s, i) => s + i.discountGiven, 0));
    const netSales = round2(list.reduce((s, i) => s + i.netSale, 0));
    const cashTendered = round2(list.reduce((s, i) => s + i.cashTendered, 0));
    const changeGiven = round2(list.reduce((s, i) => s + i.changeGiven, 0));
    const cashRetained = round2(list.reduce((s, i) => s + i.cashCollected, 0));
    const digitalSettled = round2(list.reduce((s, i) => s + i.mfsOrCardTotal, 0));
    const duePending = round2(list.reduce((s, i) => s + i.dueAmount, 0));
    const realized = round2(cashRetained + digitalSettled);

    return {
      mode: cfg.mode,
      labelEn: cfg.labelEn,
      labelBn: cfg.labelBn,
      invoiceCount: list.length,
      grossBill,
      discountGiven,
      netSales,
      cashTendered,
      changeGiven,
      cashRetained,
      digitalSettled,
      duePending,
      realizationPct: netSales > 0 ? Number(((realized / netSales) * 100).toFixed(1)) : 0,
    };
  });
}

export function computeCashierAudit(invoices: NormalizedInvoice[]): CashierAuditRow[] {
  const map = new Map<
    string,
    {
      count: number;
      gross: number;
      discount: number;
      maxDiscPct: number;
      cash: number;
      mfsCard: number;
      due: number;
      profit: number;
    }
  >();

  invoices.forEach((inv) => {
    const key = inv.cashierName || 'Cashier';
    const cur = map.get(key) || {
      count: 0,
      gross: 0,
      discount: 0,
      maxDiscPct: 0,
      cash: 0,
      mfsCard: 0,
      due: 0,
      profit: 0,
    };
    cur.count += 1;
    cur.gross = round2(cur.gross + inv.grossBill);
    cur.discount = round2(cur.discount + inv.discountGiven);
    cur.maxDiscPct = Math.max(cur.maxDiscPct, inv.discountPercent);
    cur.cash = round2(cur.cash + inv.cashCollected);
    cur.mfsCard = round2(cur.mfsCard + inv.mfsOrCardTotal);
    cur.due = round2(cur.due + inv.dueAmount);
    cur.profit = round2(cur.profit + inv.grossProfit);
    map.set(key, cur);
  });

  return Array.from(map.entries())
    .map(([cashierName, v]) => {
      const avgDisc = v.gross > 0 ? Number(((v.discount / v.gross) * 100).toFixed(1)) : 0;
      let flagLevel: CashierAuditRow['flagLevel'] = 'normal';
      if (v.maxDiscPct >= 20 || avgDisc >= 12) flagLevel = 'high_alert';
      else if (v.maxDiscPct >= 15 || avgDisc >= 8) flagLevel = 'review';

      return {
        cashierName,
        invoiceCount: v.count,
        grossBill: v.gross,
        discountGiven: v.discount,
        avgDiscountPct: avgDisc,
        maxDiscountPct: v.maxDiscPct,
        cashCollected: v.cash,
        mfsAndCardCollected: v.mfsCard,
        dueIssued: v.due,
        grossProfit: v.profit,
        flagLevel,
      };
    })
    .sort((a, b) => b.discountGiven - a.discountGiven);
}

export function computeBranchComparison(invoices: NormalizedInvoice[]): BranchSalesSummary[] {
  const map = new Map<string, BranchSalesSummary>();

  invoices.forEach((inv) => {
    const cur = map.get(inv.branchId) || {
      branchId: inv.branchId,
      branchName: inv.branchName,
      branchCode: inv.branchCode,
      invoiceCount: 0,
      unitsSold: 0,
      grossBill: 0,
      discountGiven: 0,
      netSales: 0,
      cashCollected: 0,
      mfsAndCard: 0,
      dueAmount: 0,
      grossProfit: 0,
    };
    cur.invoiceCount += 1;
    cur.unitsSold += inv.totalUnits;
    cur.grossBill = round2(cur.grossBill + inv.grossBill);
    cur.discountGiven = round2(cur.discountGiven + inv.discountGiven);
    cur.netSales = round2(cur.netSales + inv.netSale);
    cur.cashCollected = round2(cur.cashCollected + inv.cashCollected);
    cur.mfsAndCard = round2(cur.mfsAndCard + inv.mfsOrCardTotal);
    cur.dueAmount = round2(cur.dueAmount + inv.dueAmount);
    cur.grossProfit = round2(cur.grossProfit + inv.grossProfit);
    map.set(inv.branchId, cur);
  });

  return Array.from(map.values()).sort((a, b) => b.netSales - a.netSales);
}

export function computeDailyCashbookClosing(params: {
  openingFloat: number;
  invoices: NormalizedInvoice[];
  returns: SaleReturn[];
  accountingTx: AccountingTransaction[];
  physicalCountedCash: number;
  startDate?: string;
  endDate?: string;
  branchId?: string;
}): CashbookClosingSummary {
  const inRange = (d?: string) => {
    if (!d) return true;
    if (params.startDate && d < params.startDate) return false;
    if (params.endDate && d > params.endDate) return false;
    return true;
  };
  const inBranch = (bId?: string) => {
    if (!params.branchId || params.branchId === 'all') return true;
    return !bId || bId === params.branchId;
  };

  const cashSalesCollected = round2(
    params.invoices.reduce((sum, inv) => sum + inv.cashCollected, 0)
  );

  const invoiceNumbersInPeriod = new Set(params.invoices.map((i) => i.invoiceNumber));

  // Standalone customer due collections (from older invoices outside this period's sales list)
  const dueCashCollectedInPeriod = round2(
    params.accountingTx
      .filter(
        (t) =>
          t.account === 'Cash' &&
          t.credit > 0 &&
          ((t.description || '').toLowerCase().includes('due') ||
            (t.description || '').toLowerCase().includes('receivable')) &&
          !invoiceNumbersInPeriod.has(t.referenceId) &&
          inRange(t.date) &&
          inBranch(t.branchId)
      )
      .reduce((sum, t) => sum + Number(t.credit || 0), 0)
  );

  const cashReturnsRefunded = round2(
    params.returns
      .filter((r) => r.refundMethod === 'cash' && inRange(r.date) && inBranch(r.branchId))
      .reduce((sum, r) => sum + Number(r.totalRefund || 0), 0)
  );

  const cashExpenses = round2(
    params.accountingTx
      .filter(
        (t) =>
          t.type === 'operational_expense' &&
          t.account === 'Cash' &&
          inRange(t.date) &&
          inBranch(t.branchId)
      )
      .reduce((sum, t) => sum + Number(t.debit || 0), 0)
  );

  const expectedDrawerCash = round2(
    params.openingFloat +
      cashSalesCollected +
      dueCashCollectedInPeriod -
      cashReturnsRefunded -
      cashExpenses
  );
  const physicalCountedCash = round2(params.physicalCountedCash);
  const variance = round2(physicalCountedCash - expectedDrawerCash);

  return {
    openingFloat: round2(params.openingFloat),
    cashSalesCollected,
    dueCashCollectedInPeriod,
    cashReturnsRefunded,
    cashExpenses,
    expectedDrawerCash,
    physicalCountedCash,
    variance,
    status: Math.abs(variance) < 0.01 ? 'balanced' : variance > 0 ? 'surplus' : 'shortage',
  };
}
