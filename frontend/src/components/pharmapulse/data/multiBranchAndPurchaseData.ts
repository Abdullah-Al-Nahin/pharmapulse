import {
  BranchInfo,
  InterBranchTransfer,
  PurchaseReturnRecord,
  CreditNoteRecord,
  PurchaseRequisition,
  GoodsReceivedNote,
  MoleculePriceComparison,
  SupplierPerformanceMetric,
  AutoPurchaseSuggestionItem,
} from '../../../types/pharmapulse';

// Zero hardcoded demo branches — All branches are created dynamically by Admin
export const BRANCH_DATA: BranchInfo[] = [];
export const INTER_BRANCH_TRANSFERS: InterBranchTransfer[] = [];

export const PURCHASE_RETURNS: PurchaseReturnRecord[] = [];
export const CREDIT_NOTES: CreditNoteRecord[] = [];
export const PURCHASE_REQUISITIONS: PurchaseRequisition[] = [];
export const GOODS_RECEIVED_NOTES: GoodsReceivedNote[] = [];
export const MARKET_MOLECULE_COMPARISONS: MoleculePriceComparison[] = [];
export const SUPPLIER_PERFORMANCE_METRICS: SupplierPerformanceMetric[] = [];
export const ML_PURCHASE_SUGGESTIONS: AutoPurchaseSuggestionItem[] = [];
