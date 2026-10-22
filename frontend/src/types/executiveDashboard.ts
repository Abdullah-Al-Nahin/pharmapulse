export type ExecutiveTimeframe = 'today' | 'yesterday' | 'week' | 'month' | 'ytd';

export interface ExecutiveFinancialKpis {
  timeframe: ExecutiveTimeframe;
  sales: {
    amount: number; // e.g. 148,650
    transactionsCount: number;
    avgBasketValue: number;
    growthVsPrevPeriod: number; // e.g. +14.2%
    cashAmount: number;
    mfsAmount: number;
    cardAmount: number;
    creditAmount: number;
  };
  grossProfit: {
    amount: number; // e.g. 32,410
    marginPercent: number; // e.g. 21.8%
    growthVsPrevPeriod: number;
  };
  netProfit: {
    amount: number; // e.g. 22,860
    marginPercent: number; // e.g. 15.4%
    operatingExpenseDeduction: number;
  };
  purchase: {
    amount: number; // e.g. 41,200
    billsCount: number;
    pendingDeliveries: number;
  };
  expense: {
    amount: number; // e.g. 9,550
    categories: {
      salaries: number;
      utilitiesAndColdChain: number;
      packagingAndStationery: number;
      wasteAndLoss: number;
      other: number;
    };
  };
  outstanding: {
    customerReceivables: number; // e.g. 38,400
    customerCount: number;
    supplierPayables: number; // e.g. 10,790
    supplierCount: number;
    netBalance: number; // receivables - payables
  };
  stockValue: {
    costValue: number; // e.g. 485,200
    retailValue: number; // e.g. 612,400
    unrealizedProfit: number;
    totalUnits: number;
    totalSKUs: number;
  };
  expiredStock: {
    costValue: number; // e.g. 14,250
    unitsCount: number;
    batchesCount: number;
    percentOfTotalStock: number;
  };
  nearExpiry: {
    costValue: number; // e.g. 42,800
    unitsCount: number;
    batchesCount: number;
    daysThreshold: number; // 90 days
  };
}

export interface ProductMovementItem {
  id: string;
  medicineName: string;
  genericName: string;
  category: string;
  dosageForm: string;
  manufacturer: string;
  currentStock: number;
  dailyVelocityUnits: number; // units sold per day
  monthlySalesRevenue: number;
  grossMarginPercent: number;
  daysOnHand: number; // days until stockout or turnover
  stockStatus: 'optimal' | 'low_stock' | 'excess' | 'stagnant';
  recommendedAction?: string;
  trappedCapital?: number; // for slow moving
  capitalTiedUp?: number; // for slow moving
  daysWithoutSale?: number; // for slow moving
}

export interface AISalesForecastMedicine {
  id: string;
  medicineName: string;
  genericName: string;
  strength: string;
  form: string;
  manufacturer: string;
  leadTimeDays: number;
  currentStock: number;
  forecastDays: number; // 14 days
  predictedDemand: number; // e.g. 320 units
  recommendedPurchase: number; // e.g. 200 units
  safetyBuffer: number; // e.g. 60 units
  confidenceScore: number; // e.g. 94%
  primaryDriver: string; // e.g. 'Seasonal monsoon fever & viral conjunctivitis surge (+18%)'
  dailyForecast: Array<{
    day: string; // e.g. 'Day 1', 'Day 2'
    date: string; // e.g. 'Sep 12'
    baselineDemand: number;
    predictedDemand: number;
    projectedStockRemaining: number;
  }>;
}

export type AIStockAnomalyCategory = 'overstock' | 'understock' | 'dead_stock' | 'expiry_risk';

export interface AIStockIntelligenceItem {
  id: string;
  category: AIStockAnomalyCategory;
  severity: 'critical' | 'warning' | 'info';
  medicineName: string;
  genericName: string;
  batchNumber?: string;
  currentStock: number;
  reorderLevel?: number;
  trappedCapital: number; // in BDT ৳
  daysSupplyOrStagnant: number;
  detectionDate: string;
  summaryTitle: string;
  aiDiagnosis: string;
  aiSuggestedAction: string;
  actionType: 'draft_po' | 'discount_clearance' | 'vendor_return' | 'transfer_branch' | 'quarantine';
}

export type AIFinancialAnomalyCategory = 
  | 'abnormal_sales' 
  | 'unusual_discount' 
  | 'suspicious_refund' 
  | 'purchase_price_anomaly';

export interface AIFinancialAnomalyItem {
  id: string;
  category: AIFinancialAnomalyCategory;
  severity: 'high' | 'medium' | 'critical';
  title: string;
  description: string;
  detectedAt: string;
  terminalOrUser: string;
  invoiceOrRef: string;
  discrepancyValue: number; // in BDT ৳
  aiFraudConfidence: number; // 0-100%
  aiRecommendation: string;
  status: 'pending_review' | 'investigating' | 'resolved' | 'dismissed';
}

export interface AIExecutiveBriefing {
  generatedAt: string;
  overallHealthScore: number; // 0 to 100
  headlineSummaryEn: string;
  headlineSummaryBn: string;
  keyInsights: Array<{
    type: 'positive' | 'risk' | 'action_required';
    title: string;
    description: string;
  }>;
  executiveActionChecklist: string[];
}
