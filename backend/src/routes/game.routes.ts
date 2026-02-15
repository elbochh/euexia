import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  getProgress,
  getLeaderboardData,
  getPersonalizedMapSpec,
  getConsultationsWithMaps,
  getMapSpec,
  getCurrentMapSpec,
} from '../controllers/game.controller';

const router = Router();

router.get('/progress', authMiddleware, getProgress);
router.get('/leaderboard', authMiddleware, getLeaderboardData);
router.get('/map-spec', authMiddleware, getPersonalizedMapSpec);
router.get('/current-map', authMiddleware, getCurrentMapSpec);
router.get('/map', authMiddleware, getMapSpec);
router.get('/consultations', authMiddleware, getConsultationsWithMaps);

export default router;

