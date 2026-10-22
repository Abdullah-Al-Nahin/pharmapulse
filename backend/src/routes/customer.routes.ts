import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller';

const router = Router();

router.get('/', CustomerController.getAllCustomers);
router.post('/', CustomerController.createCustomer);
router.put('/:id', CustomerController.updateCustomer);

export default router;
