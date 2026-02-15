import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Consultation } from '../models/Consultation';
import { ChecklistItem } from '../models/ChecklistItem';
import { processVoice } from '../services/agents/voiceAgent';
import { processImage } from '../services/agents/imageAgent';
import { processText } from '../services/agents/textAgent';
import { processPdf } from '../services/agents/pdfAgent';
import { aggregateSummaries } from '../services/agents/summaryAgent';
import { structureChecklist } from '../services/agents/checklistAgent';
import fs from 'fs';
import path from 'path';

/**
 * Create a new consultation and process all uploads through the AI pipeline
 */
export const createConsultation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { title, uploads } = req.body;

    // Create consultation
    const consultation = await Consultation.create({
      userId,
      title: title || 'My Consultation',
      uploads: uploads.map((u: any) => ({
        type: u.type,
        fileUrl: u.fileUrl || '',
        rawText: u.rawText || '',
      })),
      status: 'processing',
    });

    // Process each upload through appropriate agent (in parallel)
    const summaryPromises = consultation.uploads.map(async (upload, index) => {
      try {
        let summary = '';
        switch (upload.type) {
          case 'voice':
            summary = await processVoice(upload.fileUrl || '');
            break;
          case 'image':
            summary = await processImage(upload.fileUrl || '');
            break;
          case 'text':
            summary = await processText(upload.rawText || '');
            break;
          case 'pdf':
            summary = await processPdf(upload.rawText || '', []);
            break;
        }
        consultation.uploads[index].summary = summary;
        consultation.uploads[index].processedAt = new Date();
        return summary;
      } catch (err) {
        console.error(`Failed to process ${upload.type} upload:`, err);
        return '';
      }
    });

    const summaries = (await Promise.all(summaryPromises)).filter((s) => s.length > 0);

    // Aggregate all summaries into a checklist paragraph
    const checklistParagraph = await aggregateSummaries(summaries);
    consultation.aggregatedSummary = summaries.join('\n\n---\n\n');
    consultation.checklistParagraph = checklistParagraph;

    // Structure the paragraph into JSON checklist items
    const checklistData = await structureChecklist(checklistParagraph);

    // Save checklist items to database
    const checklistItems = await ChecklistItem.insertMany(
      checklistData.map((item, index) => ({
        consultationId: consultation._id,
        userId,
        title: item.title,
        description: item.description,
        frequency: item.frequency,
        category: item.category,
        xpReward: item.xpReward || 10,
        coinReward: item.coinReward || 5,
        order: index,
      }))
    );

    consultation.status = 'completed';
    await consultation.save();

    res.status(201).json({
      consultation,
      checklistItems,
    });
  } catch (error) {
    console.error('Create consultation error:', error);
    res.status(500).json({ error: 'Failed to process consultation' });
  }
};

/**
 * Get all consultations for the authenticated user
 */
export const getConsultations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const consultations = await Consultation.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ consultations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get consultations' });
  }
};

/**
 * Upload a file (voice, image, pdf) via multipart form
 */
export const uploadFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // For hackathon, store files locally; in production, use S3
    const fileUrl = `/uploads/${req.file.filename}`;
    const fileBase64 = fs.readFileSync(req.file.path).toString('base64');

    res.json({
      fileUrl,
      fileBase64,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload file' });
  }
};

