import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getOrCreateProgress, getLeaderboard } from '../services/gamification';
import { ChecklistItem } from '../models/ChecklistItem';
import { Consultation } from '../models/Consultation';
import { Map } from '../models/Map';
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
 * Get all consultations with their maps for the user
 */
export const getConsultationsWithMaps = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const consultations = await Consultation.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .lean();

    const consultationsWithMaps = await Promise.all(
      consultations.map(async (consultation) => {
        const maps = await Map.find({ consultationId: consultation._id })
          .sort({ mapIndex: 1 })
          .lean();
        const checklistItems = await ChecklistItem.find({ consultationId: consultation._id })
          .sort({ order: 1 })
          .lean();
        return {
          ...consultation,
          maps,
          checklistItems,
          totalSteps: checklistItems.length,
        };
      })
    );

    res.json({ consultations: consultationsWithMaps });
  } catch (error) {
    console.error('Failed to get consultations with maps:', error);
    res.status(500).json({ error: 'Failed to get consultations with maps' });
  }
};

/**
 * Get map spec for a specific consultation and map index
 */
export const getMapSpec = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { consultationId, mapIndex } = req.query;
    
    if (!consultationId) {
      res.status(400).json({ error: 'consultationId is required' });
      return;
    }

    const mapIndexNum = mapIndex ? parseInt(mapIndex as string, 10) : 0;
    const map = await Map.findOne({
      consultationId,
      userId: req.userId,
      mapIndex: mapIndexNum,
    }).lean();

    if (!map) {
      res.status(404).json({ error: 'Map not found' });
      return;
    }

    // Get checklist items for this consultation to calculate progress
    const checklistItems = await ChecklistItem.find({ consultationId })
      .sort({ order: 1 })
      .lean();

    res.json({
      mapSpec: map.mapSpec,
      source: map.source,
      validation: {
        ok: map.validationWarnings.length === 0,
        warnings: map.validationWarnings,
      },
      startStepIndex: map.startStepIndex,
      endStepIndex: map.endStepIndex,
      mapIndex: map.mapIndex,
      totalSteps: checklistItems.length,
      consultationId: map.consultationId,
      mapImageUrl: map.mapImageUrl || null,
    });
  } catch (error) {
    console.error('Failed to get map spec:', error);
    res.status(500).json({ error: 'Failed to get map spec' });
  }
};

/**
 * Get the current/active map for the user (most recent consultation, first map)
 */
export const getCurrentMapSpec = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Get most recent consultation
    const consultation = await Consultation.findOne({ userId: req.userId })
      .sort({ createdAt: -1 })
      .lean();

    if (!consultation) {
      res.status(404).json({ error: 'No consultation found' });
      return;
    }

    // Get the first map (mapIndex 0) for this consultation
    const map = await Map.findOne({
      consultationId: consultation._id,
      userId: req.userId,
      mapIndex: 0,
    }).lean();

    if (!map) {
      res.status(404).json({ error: 'Map not found' });
      return;
    }

    // Get checklist items for this consultation
    const checklistItems = await ChecklistItem.find({ consultationId: consultation._id })
      .sort({ order: 1 })
      .lean();

    res.json({
      mapSpec: map.mapSpec,
      source: map.source,
      validation: {
        ok: map.validationWarnings.length === 0,
        warnings: map.validationWarnings,
      },
      startStepIndex: map.startStepIndex,
      endStepIndex: map.endStepIndex,
      mapIndex: map.mapIndex,
      totalSteps: checklistItems.length,
      consultationId: map.consultationId,
      consultationTitle: consultation.title,
      mapImageUrl: map.mapImageUrl || null,
    });
  } catch (error) {
    console.error('Failed to get current map spec:', error);
    res.status(500).json({ error: 'Failed to get current map spec' });
  }
};

/**
 * Legacy endpoint - kept for backward compatibility
 * Generate (or fallback) a personalized map spec from the user's checklist.
 */
export const getPersonalizedMapSpec = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Try to get current map first
    const consultation = await Consultation.findOne({ userId: req.userId })
      .sort({ createdAt: -1 })
      .lean();

    if (consultation) {
      const map = await Map.findOne({
        consultationId: consultation._id,
        userId: req.userId,
        mapIndex: 0,
      }).lean();

      if (map) {
        const checklistItems = await ChecklistItem.find({ consultationId: consultation._id })
          .sort({ order: 1 })
          .lean();

        res.json({
          mapSpec: map.mapSpec,
          source: map.source,
          signals: {},
          validation: {
            ok: map.validationWarnings.length === 0,
            warnings: map.validationWarnings,
          },
        });
        return;
      }
    }

    // Fallback to old behavior
    const checklistItems = await ChecklistItem.find({ userId: req.userId })
      .sort({ order: 1 })
      .limit(6)
      .lean();

    if (checklistItems.length === 0) {
      res.status(404).json({ error: 'No checklist items found' });
      return;
    }

    const result = await generateMapSpecForChecklist(checklistItems, 0, 6);
    res.json(result);
  } catch (error) {
    console.error('Failed to generate map spec:', error);
    res.status(500).json({ error: 'Failed to generate map spec' });
  }
};

