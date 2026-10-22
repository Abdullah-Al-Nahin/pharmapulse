import { Router } from 'express';
import { CustomerController } from '../controllers/customerController';
import { authenticateToken, requirePermission } from '../middleware/rbacMiddleware';

export const customerRouter = Router();

// 1. List and search customers
customerRouter.get(
  '/',
  authenticateToken,
  requirePermission('customers:profile:view'),
  CustomerController.listCustomers
);

// 2. Get single customer profile & financial summary
customerRouter.get(
  '/:id',
  authenticateToken,
  requirePermission('customers:profile:view'),
  CustomerController.getCustomer
);

// 3. Create customer profile
customerRouter.post(
  '/',
  authenticateToken,
  requirePermission('customers:profile:manage'),
  CustomerController.createCustomer
);

// 4. Update customer profile & credit terms
customerRouter.put(
  '/:id',
  authenticateToken,
  requirePermission('customers:profile:manage'),
  CustomerController.updateCustomer
);

// 5. Get customer receivables ledger
customerRouter.get(
  '/:id/ledger',
  authenticateToken,
  requirePermission('customers:ledger:view'),
  CustomerController.getCustomerLedger
);

// 6. Due Collection API: Record payment, update balance, generate receipt
customerRouter.post(
  '/:id/collect-due',
  authenticateToken,
  requirePermission('customers:due:collect'),
  CustomerController.collectDue
);

// 7. Check credit limit for proposed sale
customerRouter.post(
  '/:id/check-credit',
  authenticateToken,
  requirePermission('pos:sale:create'),
  CustomerController.checkCredit
);

// 8. Get loyalty points balance & transaction history
customerRouter.get(
  '/:id/loyalty',
  authenticateToken,
  requirePermission('customers:profile:view'),
  CustomerController.getLoyaltyHistory
);

// 9. Redeem loyalty points during POS checkout
customerRouter.post(
  '/:id/redeem-points',
  authenticateToken,
  requirePermission('pos:sale:create'),
  CustomerController.redeemPoints
);

// 10. Manual loyalty adjustment (bonus/expiration)
customerRouter.post(
  '/:id/adjust-loyalty',
  authenticateToken,
  requirePermission('customers:loyalty:manage'),
  CustomerController.adjustLoyalty
);

// 11. Multi-tier pricing resolution
customerRouter.post(
  '/:id/calculate-pricing',
  authenticateToken,
  requirePermission('pos:sale:view'),
  CustomerController.calculatePricing
);

export default customerRouter;
