import { Router } from 'express';
import { SupplierController } from '../controllers/supplier.controller';

const router = Router();

router.get('/', SupplierController.getAll);
router.get('/:id', SupplierController.getById);
router.post('/', SupplierController.create);
router.put('/:id', SupplierController.update);

export default router;
