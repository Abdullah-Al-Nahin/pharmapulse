import { Router } from 'express';
import { CashbookController } from '../controllers/cashbook.controller';

const router = Router();

router.get('/vouchers', CashbookController.getVouchers);
router.post('/vouchers', CashbookController.createVoucher);
router.delete('/vouchers/:id', CashbookController.deleteVoucher);

router.get('/daily-closings', CashbookController.getDailyClosings);
router.put('/opening-cash', CashbookController.upsertOpeningCash);
router.post('/close-day', CashbookController.closeDailyCashbook);

export default router;
