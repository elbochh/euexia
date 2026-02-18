import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getChatHistory, sendChatMessage } from '../controllers/chat.controller';

const router = Router();

router.get('/', authMiddleware, getChatHistory);
router.post('/message', authMiddleware, sendChatMessage);

export default router;

