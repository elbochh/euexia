import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Consultation } from '../models/Consultation';
import { ChecklistItem } from '../models/ChecklistItem';
import { Map as MapModel } from '../models/Map';
import { MapThemeTemplate } from '../models/MapThemeTemplate';
import { processVoice } from '../services/agents/voiceAgent';
import { processImage } from '../services/agents/imageAgent';
import { processText } from '../services/agents/textAgent';
import { processPdf } from '../services/agents/pdfAgent';
import { aggregateSummaries } from '../services/agents/summaryAgent';
import { structureChecklistAsEvents } from '../services/agents/checklistAgent';
import {
  generateMapSpecForChecklist,
  deriveChecklistSignals,
} from '../services/mapSpec/generator';
import {
  analyzeChecklistTheme,
  detectThemeWithOpenAI,
  generateMapImage,
  getFallbackMapImage,
  buildMapSpecFromAnalysis,
  generateScrollableMapCheckpoints,
  PROMPT_VERSION,
} from '../services/mapImageGenerator';
import { indexConsultationContext } from '../services/rag/indexer';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

/**
 * Create a new consultation and process all uploads through the AI pipeline.
 *
 * Pipeline (optimised for speed):
 *  1. Process all uploads in PARALLEL (voice/image/text/pdf)
 *  2. Aggregate summaries
 *  3. Run structureChecklist + detectTheme in PARALLEL
 *  4. Save checklist items → return response to user immediately
 *  5. Generate maps in BACKGROUND (fire-and-forget)
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
            // Extract text from PDF if fileUrl is provided but rawText is empty
            let pdfText = upload.rawText || '';
            if (!pdfText && upload.fileUrl) {
              try {
                let pdfBuffer: Buffer;
                
                // Check if fileUrl is a base64 string or a file path
                if (upload.fileUrl.startsWith('/uploads/') || upload.fileUrl.startsWith('./uploads/')) {
                  // It's a file path - read from disk
                  const filePath = path.join(__dirname, '../../', upload.fileUrl);
                  if (fs.existsSync(filePath)) {
                    pdfBuffer = fs.readFileSync(filePath);
                    console.log(`[PDF] Reading PDF from disk: ${filePath}`);
                  } else {
                    throw new Error(`PDF file not found at ${filePath}`);
                  }
                } else {
                  // Assume it's base64-encoded PDF (may include data URL prefix)
                  let base64Data = upload.fileUrl;
                  // Remove data URL prefix if present (e.g., "data:application/pdf;base64,...")
                  if (base64Data.includes(',')) {
                    base64Data = base64Data.split(',')[1];
                  }
                  pdfBuffer = Buffer.from(base64Data, 'base64');
                  console.log(`[PDF] Decoding PDF from base64 (${base64Data.length} chars)`);
                }
                
                const pdfData = await pdfParse(pdfBuffer);
                pdfText = pdfData.text;
                console.log(`[PDF] Extracted ${pdfText.length} characters from PDF (${pdfData.numpages} pages)`);
              } catch (parseError: any) {
                console.error('[PDF] Failed to parse PDF:', parseError?.message || parseError);
                // Continue with empty text - processPdf will handle it gracefully
                pdfText = '';
              }
            }
            if (!pdfText) {
              console.warn('[PDF] No text extracted from PDF - processPdf will receive empty string');
            }
            summary = await processPdf(pdfText, []); // pageImages can be added later if needed
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
    const rawParagraph = await aggregateSummaries(summaries);
    consultation.aggregatedSummary = summaries.join('\n\n---\n\n');
    consultation.checklistParagraph = rawParagraph;

    // Clean the paragraph before passing to the checklist agent:
    // Remove markdown bold/italic, normalize bullets, collapse whitespace
    const checklistParagraph = rawParagraph
      .replace(/\*\*/g, '')           // remove ** bold markers
      .replace(/\*/g, '')             // remove * italic markers
      .replace(/^[\s]*[-•*]\s*/gm, '- ')  // normalize bullet markers
      .replace(/\n{3,}/g, '\n\n')    // collapse excessive newlines
      .trim();

    console.log(`[Pipeline] Cleaned paragraph length: ${checklistParagraph.length} chars`);

    // ── OPTIMIZATION: Run structureChecklistAsEvents (GPT-4.1) + detectTheme in PARALLEL ──
    console.log(`Running structureChecklistAsEvents + detectTheme in parallel...`);
    const [eventData, consultationTheme] = await Promise.all([
      structureChecklistAsEvents(checklistParagraph),
      detectThemeWithOpenAI([], rawParagraph),
    ]);

    console.log(`\n=== CHECKLIST EVENTS GENERATED ===`);
    console.log(`Generated ${eventData.length} events from GPT-4.1 for consultation ${consultation._id}`);
    console.log(`\nRaw consultation paragraph used for generation:`);
    console.log(checklistParagraph);
    console.log(`===================================\n`);

    // Save one checklist item per event (unlockAt = exact date/time; groupId, orderInGroup for star grouping)
    const now = new Date();
    const checklistItems = await ChecklistItem.insertMany(
      eventData.map((event, index) => ({
        consultationId: consultation._id,
        userId,
        title: event.title,
        description: event.description,
        frequency: 'once',
        category: event.category,
        xpReward: event.xpReward,
        coinReward: event.coinReward,
        order: index,
        unlockAt: new Date(event.unlockAt),
        cooldownMinutes: 0,
        nextDueAt: new Date(event.unlockAt),
        totalRequired: 1,
        completionCount: 0,
        durationDays: 0,
        expiresAt: null,
        timeOfDay: 'any',
        isFullyDone: false,
        groupId: event.groupId,
        sequenceId: event.sequenceId,
        starGroupId: event.starGroupId,
        orderInGroup: event.orderInGroup,
      }))
    );
    console.log(`Saved ${checklistItems.length} checklist items (events) to database for consultation ${consultation._id}`);

    // Save consultation (with summaries) before map generation
    await consultation.save();

    // Fire-and-forget context indexing for adaptive RAG retrieval.
    indexConsultationContext(userId, consultation._id.toString()).catch((err) =>
      console.warn('[RAG] Failed to index consultation context:', err)
    );

    // Build group-level data for map: one star per unique starGroupId (typically per day)
    const groupOrder: string[] = [];
    const groupToFirstItem = new Map<string, { category: string; title: string; description: string }>();
    for (const item of checklistItems) {
      const g = String((item as any).starGroupId || item.groupId);
      if (!groupToFirstItem.has(g)) {
        groupOrder.push(g);
        groupToFirstItem.set(g, {
          category: item.category,
          title: item.title,
          description: item.description,
        });
      }
    }
    const checklistItemsData = groupOrder.map((g) => groupToFirstItem.get(g)!);

    console.log(`\n=== THEME DETECTION ===`);
    console.log(`Raw consultation context for theme detection:`);
    console.log(checklistParagraph);
    console.log(`\nGroup-level data for map (${checklistItemsData.length} stars):`);
    console.log(JSON.stringify(checklistItemsData, null, 2));
    console.log(`\nDetected theme:`);
    console.log(JSON.stringify(consultationTheme, null, 2));
    console.log(`Theme Key: ${consultationTheme.themeKey}`);
    console.log(`Specialty: ${consultationTheme.specialty}`);
    console.log(`Theme Keywords: ${consultationTheme.themeKeywords.join(', ')}`);
    console.log(`Specific Elements: ${consultationTheme.specificElements.join(', ')}`);
    console.log(`========================\n`);

    // Generate a SINGLE tall vertical scrollable map: one checkpoint (star) per group
    const allItems = checklistItemsData;
    const signals = deriveChecklistSignals(allItems);
    const themeProfile = consultationTheme || analyzeChecklistTheme(allItems);
    const totalStepCount = allItems.length; // number of stars (groups)

    // Check for existing template (reuse if available)
    const existingTemplate = await MapThemeTemplate.findOne({
      themeKey: themeProfile.themeKey,
      stepCount: totalStepCount,
      promptVersion: PROMPT_VERSION,
    }).lean();

    let mapSpec: any;
    let mapImageUrl: string;
    let mapImagePath: string;
    let source: 'ai' | 'fallback' = 'ai';
    let validation: { ok: boolean; warnings: string[] } = { ok: true, warnings: [] };

    if (existingTemplate) {
      // Reuse existing template
      await MapThemeTemplate.updateOne(
        { _id: existingTemplate._id },
        { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } }
      );
      mapSpec = existingTemplate.mapSpec;
      mapImageUrl = existingTemplate.mapImageUrl;
      mapImagePath = existingTemplate.mapImagePath || '';
      validation.warnings.push(`Reused cached template for theme "${themeProfile.specialty}" (${totalStepCount} steps).`);
    } else {
      // STEP 1: Generate single tall vertical map image with ALL checkpoints
      console.log(`\n=== GENERATING SINGLE SCROLLABLE MAP ===`);
      console.log(`Theme: ${themeProfile.specialty} (key: ${themeProfile.themeKey})`);
      console.log(`Total Steps: ${totalStepCount}`);
      console.log(`Theme Keywords: ${themeProfile.themeKeywords.join(', ')}`);
      console.log(`Specific Elements: ${themeProfile.specificElements.join(', ')}`);
      console.log(`==============================\n`);
      
      const imageResult = await generateMapImage(signals, allItems, {
        consultationId: consultation._id.toString(),
        mapIndex: 0,
        themeKey: themeProfile.themeKey,
        stepCount: totalStepCount, // All checkpoints in one map
        themeProfile,
        rawContext: checklistParagraph,
        isScrollableMap: true, // Flag to indicate this is a scrollable map
      });

      if (!imageResult || !imageResult.imageBuffer) {
        console.error('Failed to generate map image, using fallback');
        const fallbackImage = getFallbackMapImage();
        const fallbackResult = await generateMapSpecForChecklist(allItems, 0, totalStepCount);
        mapSpec = fallbackResult.mapSpec;
        mapImageUrl = fallbackImage.imageUrl;
        mapImagePath = fallbackImage.imagePath;
        source = 'fallback';
        validation.warnings.push('AI image generation failed; fallback used.');
      } else {
        // STEP 2: Generate checkpoint positions algorithmically (no image analysis)
        console.log(`Generating checkpoint positions algorithmically for ${totalStepCount} checkpoints...`);
        const checkpointData = generateScrollableMapCheckpoints(totalStepCount, allItems);
        
        // STEP 3: Build mapSpec from algorithmically generated checkpoints
        mapSpec = buildMapSpecFromAnalysis(
          checkpointData.path,
          checkpointData.nodes,
          signals,
          allItems,
          imageResult.imageUrl,
          themeProfile
        );
        mapImageUrl = imageResult.imageUrl;
        mapImagePath = imageResult.imagePath || '';

        // Store as reusable template
        try {
          await MapThemeTemplate.create({
            themeKey: themeProfile.themeKey,
            specialty: themeProfile.specialty,
            stepCount: totalStepCount,
            mapSpec,
            mapImageUrl: imageResult.imageUrl,
            mapImagePath: imageResult.imagePath || '',
            themeProfile,
            promptVersion: PROMPT_VERSION,
            usageCount: 1,
            lastUsedAt: new Date(),
          });
        } catch (templateError) {
          // Safe to continue if another request creates same template concurrently
          console.warn('Template create skipped:', templateError);
        }
      }
    }

    // Save single scrollable map to database
    const savedMap = await MapModel.create({
      consultationId: consultation._id,
      userId,
      mapIndex: 0, // Only one map now
      startStepIndex: 0,
      endStepIndex: totalStepCount - 1,
      mapSpec,
      source,
      validationWarnings: validation.warnings,
      mapImageUrl,
      mapImagePath,
    });

    console.log(`Generated single scrollable map with ${totalStepCount} checkpoints for consultation ${consultation._id}`);

    consultation.status = 'completed';
    await consultation.save();

    res.status(201).json({
      consultation,
      checklistItems,
      maps: [savedMap], // Return as array for compatibility
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
 * Delete a consultation and all associated data
 */
export const deleteConsultation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { consultationId } = req.params;

    const consultation = await Consultation.findOne({ _id: consultationId, userId });
    if (!consultation) {
      res.status(404).json({ error: 'Consultation not found' });
      return;
    }

    // Delete all associated data in parallel
    await Promise.all([
      ChecklistItem.deleteMany({ consultationId }),
      MapModel.deleteMany({ consultationId }),
      Consultation.deleteOne({ _id: consultationId }),
    ]);

    // Also try to delete context chunks and chat messages if those models exist
    try {
      const { ContextChunk } = await import('../models/ContextChunk');
      await ContextChunk.deleteMany({ userId, 'metadata.consultationId': consultationId });
    } catch { /* model may not exist */ }

    try {
      const { ChatMessage } = await import('../models/ChatMessage');
      await ChatMessage.deleteMany({ userId, consultationId });
    } catch { /* model may not exist */ }

    console.log(`Deleted consultation ${consultationId} and all associated data`);
    res.json({ success: true, message: 'Consultation deleted' });
  } catch (error) {
    console.error('Delete consultation error:', error);
    res.status(500).json({ error: 'Failed to delete consultation' });
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

