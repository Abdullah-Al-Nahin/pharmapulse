import {
  SmartBarcodeItem,
  PriceHistoryRecord,
  GenericSubstituteOption,
} from '../../../types/pharmapulse';

export const SMART_BARCODE_DATABASE: SmartBarcodeItem[] = [];
export const PRICE_HISTORY_DATABASE: Record<string, PriceHistoryRecord[]> = {};
export const GENERIC_SUBSTITUTION_DATABASE: Record<string, GenericSubstituteOption[]> = {};
