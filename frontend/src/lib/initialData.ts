import { Medicine, Batch, Supplier, Prescription, PurchaseOrder, Sale, SaleReturn, AccountingTransaction } from '../types/pharmacy';

export const INITIAL_SUPPLIERS: Supplier[] = [];
export const INITIAL_MEDICINES: Medicine[] = [];
export const INITIAL_BATCHES: Batch[] = [];
export const INITIAL_PRESCRIPTIONS: Prescription[] = [];
export const INITIAL_PURCHASES: PurchaseOrder[] = [];
export const INITIAL_SALES: Sale[] = [
  {
    id: 'sale-init-01',
    invoiceNumber: 'INV-2026-9001',
    date: '2026-10-15',
    timestamp: '2026-10-15T10:30:00.000Z',
    customerName: 'Kazi Farhana',
    customerPhone: '+880 1711-234567',
    doctorName: 'Prof. Dr. M. A. Jalil (Cardiologist)',
    items: [
      {
        id: 'si-init-1',
        medicineId: 'med-napa-500',
        medicineName: 'Napa 500mg',
        genericName: 'Paracetamol',
        batchId: 'batch-init-sq-1',
        batchNumber: 'SQ-4411',
        expiryDate: '2027-11-30',
        quantity: 20,
        unitPrice: 1.20,
        unitCost: 0.85,
        mrp: 1.20,
        discountPercent: 0,
        taxRate: 0,
        subtotal: 24.00,
        taxAmount: 0,
        total: 24.00,
      }
    ],
    subtotal: 24.00,
    discountTotal: 0,
    taxTotal: 0,
    grandTotal: 24.00,
    totalCost: 17.00,
    grossProfit: 7.00,
    paymentMethod: 'cash',
    cashTendered: 50.00,
    changeGiven: 26.00,
    paymentStatus: 'completed',
    cashierName: 'Md. Rafiqul Islam',
    notes: 'Walk-in OTC dispensation',
  }
];
export const INITIAL_RETURNS: SaleReturn[] = [];
export const INITIAL_ACCOUNTING_TRANSACTIONS: AccountingTransaction[] = [];
