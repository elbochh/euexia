import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getOrCreateProgress, getLeaderboard } from '../services/gamification';

/**
 * Get game progress for the authenticated user
 */
export const getProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const progress = await getOrCreateProgress(req.userId!);
    res.json({ progress });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get game progress' });
  }
};

/**
 * Get the leaderboard
 */
export const getLeaderboardData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const leaderboard = await getLeaderboard(limit);

    // Find the current user's rank
    const allPlayers = await getLeaderboard(1000);
    const userRank = allPlayers.findIndex(
      (p: any) => p.userId?._id?.toString() === req.userId
    ) + 1;

    res.json({ leaderboard, userRank });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
};

