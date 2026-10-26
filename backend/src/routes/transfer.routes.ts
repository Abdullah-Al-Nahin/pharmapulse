import { Router } from 'express';
import { TransferController } from '../controllers/transfer.controller';

const router = Router();

router.get('/', TransferController.getAllTransfers);
router.post('/', TransferController.createTransfer);
router.put('/:id/receive', TransferController.receiveTransfer);

export default router;
