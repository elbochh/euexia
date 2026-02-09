import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ChecklistItem } from '../models/ChecklistItem';
import { awardCompletion } from '../services/gamification';

/**
 * Get all checklist items for the authenticated user
 */
export const getChecklistItems = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const items = await ChecklistItem.find({ userId: req.userId })
      .sort({ order: 1 })
      .lean();
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get checklist items' });
  }
};

/**
 * Get checklist items for a specific consultation
 */
export const getChecklistByConsultation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { consultationId } = req.params;
    const items = await ChecklistItem.find({
      userId: req.userId,
      consultationId,
    })
      .sort({ order: 1 })
      .lean();
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get checklist items' });
  }
};

/**
 * Toggle completion of a checklist item and award XP/coins
 */
export const completeItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const item = await ChecklistItem.findOne({ _id: itemId, userId: req.userId });

    if (!item) {
      res.status(404).json({ error: 'Checklist item not found' });
      return;
    }

    if (item.isCompleted) {
      res.status(400).json({ error: 'Item already completed' });
      return;
    }

    item.isCompleted = true;
    item.completedAt = new Date();
    await item.save();

    // Award XP and coins
    const reward = await awardCompletion(req.userId!, item.xpReward, item.coinReward);

    res.json({
      item,
      reward: {
        xpGained: reward.xpGained,
        coinsGained: reward.coinsGained,
        leveledUp: reward.leveledUp,
        newLevel: reward.newLevel,
        themeChanged: reward.themeChanged,
        newTheme: reward.newTheme,
        totalXp: reward.progress.xp,
        totalCoins: reward.progress.coins,
        streak: reward.progress.streak,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete item' });
  }
};

/**
 * Uncomplete a checklist item (for recurring items)
 */
export const uncompleteItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const item = await ChecklistItem.findOne({ _id: itemId, userId: req.userId });

    if (!item) {
      res.status(404).json({ error: 'Checklist item not found' });
      return;
    }

    item.isCompleted = false;
    item.completedAt = null;
    await item.save();

    res.json({ item });
  } catch (error) {
    res.status(500).json({ error: 'Failed to uncomplete item' });
  }
};

