import { Router } from 'express';
import { SaleController } from '../controllers/sale.controller';

const router = Router();

router.get('/', SaleController.getAll);
router.get('/:id', SaleController.getById);
router.post('/', SaleController.create);

export default router;
