import { Router } from 'express';
import { MedicineController } from '../controllers/medicine.controller';

const router = Router();

router.get('/summary', MedicineController.getSummary);
router.get('/categories', MedicineController.getCategories);
router.get('/manufacturers', MedicineController.getManufacturers);

router.get('/', MedicineController.getAll);
router.get('/:id', MedicineController.getById);
router.post('/', MedicineController.create);
router.put('/:id', MedicineController.update);

export default router;
