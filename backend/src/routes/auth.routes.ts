import { Router } from 'express';
import { register, login, continueAsGuest, getMe } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/guest', continueAsGuest);
router.get('/me', authMiddleware, getMe);

export default router;

