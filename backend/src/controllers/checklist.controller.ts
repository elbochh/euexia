import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ChecklistItem } from '../models/ChecklistItem';
import { awardCompletion } from '../services/gamification';

/**
 * Get all checklist items for the authenticated user.
 * Includes computed `isLocked` and `remainingSeconds` for frontend timers.
 */
export const getChecklistItems = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const items = await ChecklistItem.find({ userId: req.userId })
      .sort({ order: 1 })
      .lean();
    res.json({ items: items.map((item) => addTimingInfo(item, items)) });
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
    res.json({ items: items.map((item) => addTimingInfo(item, items)) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get checklist items' });
  }
};

/**
 * Toggle completion of a checklist item and award XP/coins.
 * Enforces timing constraints:
 *  - Item must be unlocked (past unlockAt)
 *  - Item must be past cooldown (past nextDueAt)
 *  - Item must not be fully done
 *  - Item must not be expired
 */
export const completeItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const item = await ChecklistItem.findOne({ _id: itemId, userId: req.userId });

    if (!item) {
      res.status(404).json({ error: 'Checklist item not found' });
      return;
    }

    const now = new Date();

    // Check if item is fully done (all required completions met)
    if (item.isFullyDone) {
      res.status(400).json({ error: 'This task is fully completed — no more completions needed.' });
      return;
    }

    // Check if item is locked (hasn't unlocked yet)
    if (item.unlockAt && now < item.unlockAt) {
      const remainingSec = Math.ceil((item.unlockAt.getTime() - now.getTime()) / 1000);
      res.status(400).json({
        error: 'locked',
        message: `This task unlocks in ${formatTimeRemaining(remainingSec)}.`,
        remainingSeconds: remainingSec,
        unlockAt: item.unlockAt.toISOString(),
      });
      return;
    }

    // Event grouping: event N unlocks only when previous event in same group is completed
    const groupId = item.groupId ?? '';
    const orderInGroup = item.orderInGroup ?? 0;
    if (groupId && orderInGroup > 0) {
      const prevInGroup = await ChecklistItem.findOne({
        userId: req.userId,
        consultationId: item.consultationId,
        groupId,
        orderInGroup: orderInGroup - 1,
      }).lean();
      if (prevInGroup && !prevInGroup.isCompleted && !prevInGroup.isFullyDone) {
        res.status(400).json({
          error: 'locked',
          message: 'Complete the previous task in this sequence first.',
          remainingSeconds: 0,
          unlockAt: item.unlockAt?.toISOString(),
        });
        return;
      }
    }

    // Check cooldown (for recurring items that have been completed at least once)
    if (item.nextDueAt && now < item.nextDueAt && item.completionCount > 0) {
      const remainingSec = Math.ceil((item.nextDueAt.getTime() - now.getTime()) / 1000);
      res.status(400).json({
        error: 'cooldown',
        message: `You just completed this. Available again in ${formatTimeRemaining(remainingSec)}.`,
        remainingSeconds: remainingSec,
        nextDueAt: item.nextDueAt.toISOString(),
      });
      return;
    }

    // Check if expired
    if (item.expiresAt && now > item.expiresAt) {
      res.status(400).json({
        error: 'expired',
        message: 'This task has expired and is no longer relevant.',
      });
      return;
    }

    // Complete the item
    item.completionCount += 1;
    item.completedAt = now;

    // Determine if this is a recurring item
    const isRecurring = item.cooldownMinutes > 0 && (item.totalRequired === 0 || item.completionCount < item.totalRequired);

    if (isRecurring) {
      // Set cooldown: item can be completed again after cooldownMinutes
      item.nextDueAt = new Date(now.getTime() + item.cooldownMinutes * 60 * 1000);
      item.isCompleted = true; // completed this cycle
    } else {
      // One-time item or final completion of recurring item
      item.isCompleted = true;
      item.nextDueAt = null;
    }

    // Check if fully done
    if (item.totalRequired > 0 && item.completionCount >= item.totalRequired) {
      item.isFullyDone = true;
    }

    await item.save();

    // Award XP and coins
    const reward = await awardCompletion(req.userId!, item.xpReward, item.coinReward);

    const responseItem = addTimingInfo(item.toObject());

    res.json({
      item: responseItem,
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
 * Reset a recurring checklist item for the next cycle (when cooldown expires).
 * Or uncomplete a one-time item.
 */
export const uncompleteItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const item = await ChecklistItem.findOne({ _id: itemId, userId: req.userId });

    if (!item) {
      res.status(404).json({ error: 'Checklist item not found' });
      return;
    }

    // For recurring items: reset isCompleted but keep completionCount
    if (item.cooldownMinutes > 0) {
      item.isCompleted = false;
      // Don't reset completionCount — they already earned the reward
    } else {
      // One-time item: full undo
      item.isCompleted = false;
      item.completedAt = null;
      item.completionCount = Math.max(0, item.completionCount - 1);
      item.isFullyDone = false;
    }

    await item.save();
    res.json({ item: addTimingInfo(item.toObject()) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to uncomplete item' });
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Add computed timing fields to a checklist item for the frontend.
 * When allItemsInConsultation is provided, isLocked also considers previous-in-group completion.
 */
function addTimingInfo(item: any, allItemsInConsultation?: any[]): any {
  const now = new Date();

  // Is the item locked by time (hasn't unlocked yet)?
  let isLockedByTime = item.unlockAt ? now < new Date(item.unlockAt) : false;

  // Event grouping: locked if previous event in same group (same consultation) is not completed
  let isLockedByGroup = false;
  if (allItemsInConsultation && item.groupId != null && (item.orderInGroup ?? 0) > 0) {
    const sameConsultation = allItemsInConsultation.filter(
      (i: any) => String(i.consultationId) === String(item.consultationId)
    );
    const prev = sameConsultation.find(
      (i: any) =>
        String(i.groupId) === String(item.groupId) &&
        (i.orderInGroup ?? 0) === (item.orderInGroup ?? 0) - 1
    );
    if (prev && !prev.isCompleted && !prev.isFullyDone) {
      isLockedByGroup = true;
    }
  }

  const isLocked = isLockedByTime || isLockedByGroup;

  // Is the item on cooldown (completed recently, waiting for next availability)?
  const isOnCooldown = item.nextDueAt && item.completionCount > 0
    ? now < new Date(item.nextDueAt)
    : false;

  // Is the item expired?
  const isExpired = item.expiresAt ? now > new Date(item.expiresAt) : false;

  // Compute remaining seconds until available
  let remainingSeconds = 0;
  if (isLockedByTime && item.unlockAt) {
    remainingSeconds = Math.ceil((new Date(item.unlockAt).getTime() - now.getTime()) / 1000);
  } else if (isOnCooldown && item.nextDueAt) {
    remainingSeconds = Math.ceil((new Date(item.nextDueAt).getTime() - now.getTime()) / 1000);
  }

  // Is the item available to complete right now?
  const isAvailable = !isLocked && !isOnCooldown && !isExpired && !item.isFullyDone;

  // Progress for recurring items
  const completionProgress = item.totalRequired > 0
    ? `${item.completionCount}/${item.totalRequired}`
    : item.completionCount > 0
      ? `${item.completionCount} done`
      : null;

  return {
    ...item,
    isLocked,
    isOnCooldown,
    isExpired,
    isAvailable,
    remainingSeconds: Math.max(0, remainingSeconds),
    completionProgress,
  };
}

/**
 * Format seconds into a human-readable string.
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  if (hours < 24) {
    return remainMinutes > 0
      ? `${hours}h ${remainMinutes}m`
      : `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return remainHours > 0
    ? `${days}d ${remainHours}h`
    : `${days} day${days > 1 ? 's' : ''}`;
}