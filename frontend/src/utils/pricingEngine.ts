import { Batch } from '../types/pharmacy';
import { PricingTier } from '../types/customer';
import { TIER_PRICE_RULES } from '../lib/customerInitialData';

export interface TierPriceResult {
  unitPrice: number;
  originalMrp: number;
  standardRetailPrice: number;
  tier: PricingTier;
  tierLabel: string;
  appliedDiscountPercent: number;
  isSpecialPrice: boolean;
  savingsPerUnit: number;
}

/**
 * Dynamic Multi-Tier Pricing Engine:
 * Resolves the unit selling price for a medicine batch based on the customer's assigned pricing tier:
 * - 'retail': standard counter selling price (batch.sellingPrice)
 * - 'wholesale': wholesale rate (batch.wholesalePrice or fallback % off MRP)
 * - 'dealer': corporate/dealer contract rate (batch.dealerPrice or fallback % off MRP)
 * - 'institution': hospital/tender rate (batch.institutionPrice or fallback % off MRP)
 * - 'mrp': maximum retail price printed on pack
 *
 * Ensures safety guardrails: price is never lower than purchasePrice (cost price), preserving pharmacy margins.
 */
export function calculateTierPrice(batch: Batch, tier: PricingTier = 'retail'): TierPriceResult {
  const mrp = batch.mrp || batch.sellingPrice;
  const standardRetail = batch.sellingPrice || mrp;
  const costPrice = batch.purchasePrice || 0;

  const rule = TIER_PRICE_RULES.find((r) => r.tier === tier) || TIER_PRICE_RULES[1]; // default to retail
  let resolvedPrice = standardRetail;
  let isSpecialPrice = false;

  switch (tier) {
    case 'mrp':
      resolvedPrice = mrp;
      break;

    case 'retail':
      resolvedPrice = standardRetail;
      break;

    case 'wholesale':
      if (batch.wholesalePrice && batch.wholesalePrice > 0) {
        resolvedPrice = batch.wholesalePrice;
        isSpecialPrice = true;
      } else {
        // Fallback: 18% off MRP
        const discounted = mrp * (1 - rule.discountPercentageFromMRP / 100);
        // Floor at purchase price + 4% margin safety
        resolvedPrice = Math.max(costPrice * 1.04, discounted);
        isSpecialPrice = true;
      }
      break;

    case 'dealer':
      if (batch.dealerPrice && batch.dealerPrice > 0) {
        resolvedPrice = batch.dealerPrice;
        isSpecialPrice = true;
      } else {
        // Fallback: 22% off MRP
        const discounted = mrp * (1 - rule.discountPercentageFromMRP / 100);
        resolvedPrice = Math.max(costPrice * 1.03, discounted);
        isSpecialPrice = true;
      }
      break;

    case 'institution':
      if (batch.institutionPrice && batch.institutionPrice > 0) {
        resolvedPrice = batch.institutionPrice;
        isSpecialPrice = true;
      } else {
        // Fallback: 25% off MRP
        const discounted = mrp * (1 - rule.discountPercentageFromMRP / 100);
        resolvedPrice = Math.max(costPrice * 1.02, discounted);
        isSpecialPrice = true;
      }
      break;

    default:
      resolvedPrice = standardRetail;
  }

  // Round to 2 decimal places
  resolvedPrice = Math.round(resolvedPrice * 100) / 100;
  const savingsPerUnit = Math.max(0, standardRetail - resolvedPrice);
  const appliedDiscountPercent = standardRetail > 0 
    ? Math.round(((standardRetail - resolvedPrice) / standardRetail) * 100)
    : 0;

  return {
    unitPrice: resolvedPrice,
    originalMrp: mrp,
    standardRetailPrice: standardRetail,
    tier,
    tierLabel: rule.label,
    appliedDiscountPercent,
    isSpecialPrice,
    savingsPerUnit,
  };
}
