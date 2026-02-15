import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  getProgress,
  getLeaderboardData,
  getPersonalizedMapSpec,
} from '../controllers/game.controller';

const router = Router();

router.get('/progress', authMiddleware, getProgress);
router.get('/leaderboard', authMiddleware, getLeaderboardData);
router.get('/map-spec', authMiddleware, getPersonalizedMapSpec);

export default router;

