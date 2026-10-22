import { Request, Response } from 'express';
import { CustomerService } from '../../services/customerService';
import { CustomerType, PricingTier } from '../../types/customer';
import { calculateTierPrice } from '../../utils/pricingEngine';
import { PharmacyService } from '../../services/pharmacyService';

export class CustomerController {
  /**
   * GET /api/customers
   * List customers with optional search, type filter, and sorting
   */
  public static async listCustomers(req: Request, res: Response): Promise<void> {
    try {
      const { q, type, tier, hasDue } = req.query;
      let customers = CustomerService.getCustomers();

      if (q && typeof q === 'string') {
        const query = q.toLowerCase();
        customers = customers.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            c.phone.includes(query) ||
            (c.email && c.email.toLowerCase().includes(query)) ||
            (c.institutionName && c.institutionName.toLowerCase().includes(query)) ||
            (c.taxId && c.taxId.toLowerCase().includes(query))
        );
      }

      if (type && typeof type === 'string' && type !== 'all') {
        customers = customers.filter((c) => c.customerType === type);
      }

      if (tier && typeof tier === 'string' && tier !== 'all') {
        customers = customers.filter((c) => c.pricingTier === tier);
      }

      if (hasDue === 'true') {
        customers = customers.filter((c) => c.outstandingBalance > 0);
      }

      res.status(200).json({
        success: true,
        count: customers.length,
        data: customers,
      });
    } catch (error: any) {
      console.error('[CustomerController.listCustomers Error]:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve customer records.',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/customers/:id
   * Get single customer profile and financial summary
   */
  public static async getCustomer(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const customer = CustomerService.getCustomerById(id);

      if (!customer) {
        res.status(404).json({
          success: false,
          error: `Customer profile with ID '${id}' not found.`,
        });
        return;
      }

      const ledger = CustomerService.getCustomerLedger(id);
      const loyalty = CustomerService.getLoyaltyHistory(id);

      res.status(200).json({
        success: true,
        data: {
          customer,
          ledgerSummary: {
            totalEntries: ledger.length,
            outstandingBalance: customer.outstandingBalance,
            creditLimit: customer.creditLimit,
            availableCredit: Math.max(0, customer.creditLimit - customer.outstandingBalance),
            isNearLimit: customer.creditLimit > 0 && customer.outstandingBalance >= customer.creditLimit * 0.85,
          },
          loyaltySummary: {
            currentPoints: customer.loyaltyPoints,
            totalTransactions: loyalty.length,
          },
        },
      });
    } catch (error: any) {
      console.error('[CustomerController.getCustomer Error]:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch customer profile.',
        details: error.message,
      });
    }
  }

  /**
   * POST /api/customers
   * Create new customer with tier pricing & credit limits
   */
  public static async createCustomer(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        phone,
        email,
        address,
        customerType,
        pricingTier,
        creditLimit,
        taxId,
        institutionName,
        contactPerson,
        notes,
      } = req.body;

      if (!name || !phone || !customerType) {
        res.status(400).json({
          success: false,
          error: 'Customer name, phone number, and customer type are required.',
        });
        return;
      }

      const validTypes: CustomerType[] = ['retail', 'regular', 'corporate', 'wholesale', 'institution'];
      if (!validTypes.includes(customerType)) {
        res.status(400).json({
          success: false,
          error: `Invalid customer type '${customerType}'. Allowed: ${validTypes.join(', ')}`,
        });
        return;
      }

      const newCustomer = CustomerService.createCustomer({
        name,
        phone,
        email,
        address,
        customerType,
        pricingTier,
        creditLimit: creditLimit !== undefined ? Number(creditLimit) : undefined,
        taxId,
        institutionName,
        contactPerson,
        notes,
      });

      res.status(201).json({
        success: true,
        message: 'Customer profile registered successfully.',
        data: newCustomer,
      });
    } catch (error: any) {
      console.error('[CustomerController.createCustomer Error]:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create customer profile.',
        details: error.message,
      });
    }
  }

  /**
   * PUT /api/customers/:id
   * Update customer profile, credit limit, or pricing tier
   */
  public static async updateCustomer(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      const updated = CustomerService.updateCustomer(id, updates);
      if (!updated) {
        res.status(404).json({
          success: false,
          error: `Customer with ID '${id}' not found.`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Customer profile updated successfully.',
        data: updated,
      });
    } catch (error: any) {
      console.error('[CustomerController.updateCustomer Error]:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update customer profile.',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/customers/:id/ledger
   * Retrieve chronological accounts receivable ledger
   */
  public static async getCustomerLedger(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const customer = CustomerService.getCustomerById(id);

      if (!customer) {
        res.status(404).json({
          success: false,
          error: `Customer with ID '${id}' not found.`,
        });
        return;
      }

      const ledgerEntries = CustomerService.getCustomerLedger(id);

      res.status(200).json({
        success: true,
        customer: {
          id: customer.id,
          name: customer.name,
          creditLimit: customer.creditLimit,
          outstandingBalance: customer.outstandingBalance,
        },
        count: ledgerEntries.length,
        data: ledgerEntries,
      });
    } catch (error: any) {
      console.error('[CustomerController.getCustomerLedger Error]:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve customer ledger entries.',
        details: error.message,
      });
    }
  }

  /**
   * POST /api/customers/:id/collect-due
   * Due Collection API: Record payment, update balance, generate receipt
   */
  public static async collectDue(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { amountPaid, paymentMethod, transactionReference, referenceNotes } = req.body;

      const user = (req as any).user;
      const collectedBy = user ? `${user.name} (${user.roleName || user.role})` : req.body.collectedBy || 'Authorized Cashier';

      if (!amountPaid || Number(amountPaid) <= 0) {
        res.status(400).json({
          success: false,
          error: 'A valid positive payment amount is required.',
        });
        return;
      }

      const validMethods = ['cash', 'bank_transfer', 'cheque', 'card', 'upi_mobile'];
      if (!paymentMethod || !validMethods.includes(paymentMethod)) {
        res.status(400).json({
          success: false,
          error: `Payment method is required. Allowed: ${validMethods.join(', ')}`,
        });
        return;
      }

      const result = CustomerService.collectDuePayment({
        customerId: id,
        amountPaid: Number(amountPaid),
        paymentMethod,
        transactionReference,
        referenceNotes,
        collectedBy,
      });

      res.status(200).json({
        success: true,
        message: `Successfully collected $${Number(amountPaid).toFixed(2)} due payment.`,
        receipt: result.receipt,
        customer: result.customer,
        ledgerEntry: result.ledgerEntry,
      });
    } catch (error: any) {
      console.error('[CustomerController.collectDue Error]:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to process due collection payment.',
      });
    }
  }

  /**
   * POST /api/customers/:id/check-credit
   * Check if proposed transaction would exceed credit limit
   */
  public static async checkCredit(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { additionalDue } = req.body;

      const check = CustomerService.checkCreditLimit(id, Number(additionalDue) || 0);

      res.status(200).json({
        success: true,
        data: check,
      });
    } catch (error: any) {
      console.error('[CustomerController.checkCredit Error]:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify credit limit.',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/customers/:id/loyalty
   * Get loyalty balance and history
   */
  public static async getLoyaltyHistory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const customer = CustomerService.getCustomerById(id);

      if (!customer) {
        res.status(404).json({
          success: false,
          error: `Customer with ID '${id}' not found.`,
        });
        return;
      }

      const history = CustomerService.getLoyaltyHistory(id);
      const config = CustomerService.getLoyaltyConfig();

      res.status(200).json({
        success: true,
        data: {
          currentPoints: customer.loyaltyPoints,
          monetaryValue: Math.round(customer.loyaltyPoints * config.redemptionRatePerPoint * 100) / 100,
          config,
          history,
        },
      });
    } catch (error: any) {
      console.error('[CustomerController.getLoyaltyHistory Error]:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve loyalty points history.',
        details: error.message,
      });
    }
  }

  /**
   * POST /api/customers/:id/redeem-points
   * Redeem loyalty points for POS discount
   */
  public static async redeemPoints(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { pointsToRedeem, invoiceNumber } = req.body;

      const user = (req as any).user;
      const processedBy = user ? `${user.name}` : req.body.processedBy || 'POS Cashier';

      if (!pointsToRedeem || Number(pointsToRedeem) <= 0) {
        res.status(400).json({
          success: false,
          error: 'A positive integer number of points to redeem is required.',
        });
        return;
      }

      const result = CustomerService.redeemLoyaltyPoints(
        id,
        Number(pointsToRedeem),
        invoiceNumber || `INV-POS-${Date.now()}`,
        processedBy
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: `Successfully redeemed ${pointsToRedeem} points for $${result.discountAmount.toFixed(2)} discount.`,
        data: result,
      });
    } catch (error: any) {
      console.error('[CustomerController.redeemPoints Error]:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to redeem loyalty points.',
        details: error.message,
      });
    }
  }

  /**
   * POST /api/customers/:id/adjust-loyalty
   * Adjust loyalty points manually (bonus points, expiry, corrections)
   */
  public static async adjustLoyalty(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { pointsDelta, type, reason } = req.body;

      const user = (req as any).user;
      const processedBy = user ? `${user.name} (${user.roleName || user.role})` : req.body.processedBy || 'Manager';

      if (pointsDelta === undefined || typeof pointsDelta !== 'number' || pointsDelta === 0) {
        res.status(400).json({
          success: false,
          error: 'A non-zero points delta is required.',
        });
        return;
      }

      const result = CustomerService.adjustLoyaltyPoints(
        id,
        Number(pointsDelta),
        type || 'adjusted',
        reason || 'Manual balance adjustment',
        processedBy
      );

      res.status(200).json({
        success: true,
        message: `Loyalty balance adjusted by ${pointsDelta > 0 ? '+' : ''}${pointsDelta} points.`,
        data: result,
      });
    } catch (error: any) {
      console.error('[CustomerController.adjustLoyalty Error]:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to adjust loyalty points.',
      });
    }
  }

  /**
   * POST /api/customers/:id/calculate-pricing
   * Calculate multi-tier prices for a batch of items based on customer tier
   */
  public static async calculatePricing(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { batchIds } = req.body;

      const customer = CustomerService.getCustomerById(id);
      const tier: PricingTier = customer?.pricingTier || 'retail';

      const batches = PharmacyService.getBatches();
      const targetBatches = Array.isArray(batchIds) && batchIds.length > 0
        ? batches.filter((b) => batchIds.includes(b.id))
        : batches;

      const pricedBatches = targetBatches.map((batch) => {
        const pricing = calculateTierPrice(batch, tier);
        return {
          batchId: batch.id,
          medicineId: batch.medicineId,
          medicineName: batch.medicineName,
          customerTier: tier,
          mrp: pricing.originalMrp,
          standardRetail: pricing.standardRetailPrice,
          effectiveUnitPrice: pricing.unitPrice,
          appliedDiscountPercent: pricing.appliedDiscountPercent,
          savingsPerUnit: pricing.savingsPerUnit,
          isSpecialPrice: pricing.isSpecialPrice,
        };
      });

      res.status(200).json({
        success: true,
        customerTier: tier,
        count: pricedBatches.length,
        data: pricedBatches,
      });
    } catch (error: any) {
      console.error('[CustomerController.calculatePricing Error]:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate tier pricing.',
        details: error.message,
      });
    }
  }
}
