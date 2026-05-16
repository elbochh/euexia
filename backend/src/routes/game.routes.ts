import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  getProgress,
  getLeaderboardData,
  getPersonalizedMapSpec,
  getConsultationsWithMaps,
  getMapSpec,
  getCurrentMapSpec,
  purchaseCharacter,
  selectCharacter,
} from '../controllers/game.controller';

const router = Router();

router.get('/progress', authMiddleware, getProgress);
router.get('/leaderboard', authMiddleware, getLeaderboardData);
router.get('/map-spec', authMiddleware, getPersonalizedMapSpec);
router.get('/current-map', authMiddleware, getCurrentMapSpec);
router.get('/map', authMiddleware, getMapSpec);
router.get('/consultations', authMiddleware, getConsultationsWithMaps);
router.post('/character/purchase', authMiddleware, purchaseCharacter);
router.post('/character/select', authMiddleware, selectCharacter);

export default router;

