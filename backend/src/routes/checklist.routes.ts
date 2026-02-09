import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  getChecklistItems,
  getChecklistByConsultation,
  completeItem,
  uncompleteItem,
} from '../controllers/checklist.controller';

const router = Router();

router.get('/', authMiddleware, getChecklistItems);
router.get('/consultation/:consultationId', authMiddleware, getChecklistByConsultation);
router.post('/:itemId/complete', authMiddleware, completeItem);
router.post('/:itemId/uncomplete', authMiddleware, uncompleteItem);

export default router;

