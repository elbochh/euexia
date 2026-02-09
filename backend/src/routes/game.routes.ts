import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getProgress, getLeaderboardData } from '../controllers/game.controller';

const router = Router();

router.get('/progress', authMiddleware, getProgress);
router.get('/leaderboard', authMiddleware, getLeaderboardData);

export default router;

