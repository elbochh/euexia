import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getOrCreateProgress, getLeaderboard } from '../services/gamification';
import { ChecklistItem } from '../models/ChecklistItem';
import { generateMapSpecForChecklist } from '../services/mapSpec/generator';

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

/**
 * Generate (or fallback) a personalized map spec from the user's checklist.
 * - If USE_AI_MAP_GENERATION=true and OPENAI_API_KEY exists, tries AI generation.
 * - Otherwise returns deterministic fallback map spec.
 */
export const getPersonalizedMapSpec = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const checklistItems = await ChecklistItem.find({ userId: req.userId })
      .sort({ order: 1 })
      .lean();

    const result = await generateMapSpecForChecklist(checklistItems);
    res.json(result);
  } catch (error) {
    console.error('Failed to generate map spec:', error);
    res.status(500).json({ error: 'Failed to generate map spec' });
  }
};

