import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Consultation } from '../models/Consultation';
import { ChecklistItem } from '../models/ChecklistItem';
import { Map } from '../models/Map';
import { MapThemeTemplate } from '../models/MapThemeTemplate';
import { processVoice } from '../services/agents/voiceAgent';
import { processImage } from '../services/agents/imageAgent';
import { processText } from '../services/agents/textAgent';
import { processPdf } from '../services/agents/pdfAgent';
import { aggregateSummaries } from '../services/agents/summaryAgent';
import { structureChecklist } from '../services/agents/checklistAgent';
import {
  generateMapSpecForChecklist,
  deriveChecklistSignals,
} from '../services/mapSpec/generator';
import {
  analyzeChecklistTheme,
  detectThemeWithOpenAI,
  generateMapImage,
  getFallbackMapImage,
  analyzeMapImageForCheckpoints,
  buildMapSpecFromAnalysis,
  PROMPT_VERSION,
} from '../services/mapImageGenerator';
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
    console.log(`\n=== CHECKLIST ITEMS GENERATED ===`);
    console.log(`Generated ${checklistData.length} checklist items from GPT for consultation ${consultation._id}`);
    console.log(`\nFull checklist items JSON that will be saved to DB:`);
    console.log(JSON.stringify(checklistData, null, 2));
    console.log(`\nRaw consultation paragraph used for generation:`);
    console.log(checklistParagraph);
    console.log(`===================================\n`);

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
    console.log(`Saved ${checklistItems.length} checklist items to database for consultation ${consultation._id}`);

    // Generate maps for this consultation (split into multiple maps if needed)
    console.log(`Generating maps for consultation ${consultation._id} with ${checklistItems.length} items`);
    const checklistItemsData = checklistItems.map((item) => ({
      category: item.category,
      title: item.title,
      description: item.description,
    }));
    
    // Detect ONE consultation-wide specialty theme via GPT-4o-mini for consistency across all maps
    console.log(`\n=== THEME DETECTION ===`);
    console.log(`Raw consultation context for theme detection:`);
    console.log(checklistParagraph);
    console.log(`\nChecklist items data for theme detection:`);
    console.log(JSON.stringify(checklistItemsData, null, 2));
    
    const consultationTheme = await detectThemeWithOpenAI(checklistItemsData, checklistParagraph);
    
    console.log(`\nDetected theme:`);
    console.log(JSON.stringify(consultationTheme, null, 2));
    console.log(`Theme Key: ${consultationTheme.themeKey}`);
    console.log(`Specialty: ${consultationTheme.specialty}`);
    console.log(`Theme Keywords: ${consultationTheme.themeKeywords.join(', ')}`);
    console.log(`Specific Elements: ${consultationTheme.specificElements.join(', ')}`);
    console.log(`========================\n`);

    // Split checklist into map chunks (3-6 steps per map)
    const MIN_STEPS_PER_MAP = 3;
    const MAX_STEPS_PER_MAP = 6;
    const mapChunks: Array<{ startIndex: number; endIndex: number; items: typeof checklistItemsData }> = [];
    
    let currentIndex = 0;
    while (currentIndex < checklistItemsData.length) {
      const remaining = checklistItemsData.length - currentIndex;
      const stepsForThisMap = Math.min(
        Math.max(MIN_STEPS_PER_MAP, Math.floor(Math.random() * (MAX_STEPS_PER_MAP - MIN_STEPS_PER_MAP + 1)) + MIN_STEPS_PER_MAP),
        remaining
      );
      
      mapChunks.push({
        startIndex: currentIndex,
        endIndex: currentIndex + stepsForThisMap - 1,
        items: checklistItemsData.slice(currentIndex, currentIndex + stepsForThisMap),
      });
      
      currentIndex += stepsForThisMap;
    }

    // NEW FLOW: theme -> image -> analyze image -> generate mapSpec
    // IMPORTANT: sequential generation so map N can continue from map N-1 image.
    const mapsWithImages: Array<{
      mapSpec: any;
      source: 'ai' | 'fallback';
      signals: any;
      validation: { ok: boolean; warnings: string[] };
      startIndex: number;
      endIndex: number;
      mapImageUrl?: string;
      mapImagePath?: string;
    }> = [];
    let previousMapImagePath: string | undefined;

    for (let mapIndex = 0; mapIndex < mapChunks.length; mapIndex += 1) {
      const chunk = mapChunks[mapIndex];
        const itemsForMap = chunk.items;
        const signals = deriveChecklistSignals(itemsForMap);
        const themeProfile = consultationTheme || analyzeChecklistTheme(itemsForMap);
        const stepCount = itemsForMap.length;

        // Reuse template map only for first map.
        // For map 2+ we generate continuation maps from previous image.
        const allowTemplateReuse = mapIndex === 0;
        const existingTemplate = allowTemplateReuse
          ? await MapThemeTemplate.findOne({
              themeKey: themeProfile.themeKey,
              stepCount,
              promptVersion: PROMPT_VERSION,
            }).lean()
          : null;

        if (existingTemplate) {
          await MapThemeTemplate.updateOne(
            { _id: existingTemplate._id },
            { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } }
          );

          const reused = {
            mapSpec: existingTemplate.mapSpec,
            source: 'ai' as const,
            signals,
            validation: {
              ok: true,
              warnings: [`Reused cached template for theme "${themeProfile.specialty}" (${stepCount} steps).`],
            },
            startIndex: chunk.startIndex,
            endIndex: chunk.endIndex,
            mapImageUrl: existingTemplate.mapImageUrl,
            mapImagePath: existingTemplate.mapImagePath || '',
          };
          mapsWithImages.push(reused);
          previousMapImagePath = reused.mapImagePath || previousMapImagePath;
          continue;
        }

        // STEP 1: Generate map image
        console.log(`\n=== GENERATING MAP IMAGE ${mapIndex} ===`);
        console.log(`Theme: ${themeProfile.specialty} (key: ${themeProfile.themeKey})`);
        console.log(`Steps: ${stepCount}`);
        console.log(`Theme Keywords: ${themeProfile.themeKeywords.join(', ')}`);
        console.log(`Specific Elements: ${themeProfile.specificElements.join(', ')}`);
        console.log(`==============================\n`);
        
        const imageResult = await generateMapImage(signals, itemsForMap, {
          consultationId: consultation._id.toString(),
          mapIndex,
          themeKey: themeProfile.themeKey,
          stepCount,
          themeProfile,
          rawContext: checklistParagraph,
          previousImagePath: previousMapImagePath,
          continuationLevel: mapIndex + 1,
        });

        if (!imageResult || !imageResult.imageBuffer) {
          console.error('Failed to generate map image, using fallback');
          const fallbackImage = getFallbackMapImage();
          // Use fallback map spec generation
          const fallbackResult = await generateMapSpecForChecklist(checklistItemsData, chunk.startIndex, stepCount);
          const fallbackOut = {
            ...fallbackResult,
            startIndex: chunk.startIndex,
            endIndex: chunk.endIndex,
            mapImageUrl: fallbackImage.imageUrl,
            mapImagePath: fallbackImage.imagePath,
          };
          mapsWithImages.push(fallbackOut);
          continue;
        }

        // STEP 2: Analyze image to extract path and checkpoint positions
        console.log(`Analyzing map image for checkpoints...`);
        const analysisResult = await analyzeMapImageForCheckpoints(
          imageResult.imageBuffer,
          stepCount,
          itemsForMap
        );

        if (!analysisResult) {
          console.error('Failed to analyze map image, using fallback');
          const fallbackResult = await generateMapSpecForChecklist(checklistItemsData, chunk.startIndex, stepCount);
          const fallbackOut = {
            ...fallbackResult,
            startIndex: chunk.startIndex,
            endIndex: chunk.endIndex,
            mapImageUrl: imageResult.imageUrl,
            mapImagePath: imageResult.imagePath,
          };
          mapsWithImages.push(fallbackOut);
          previousMapImagePath = imageResult.imagePath || previousMapImagePath;
          continue;
        }

        // STEP 3: Build mapSpec from analysis
        const mapSpec = buildMapSpecFromAnalysis(
          analysisResult.path,
          analysisResult.nodes,
          signals,
          itemsForMap,
          imageResult.imageUrl,
          themeProfile
        );

        // Store reusable template only for the first map.
        if (mapIndex === 0) {
          try {
            await MapThemeTemplate.create({
              themeKey: themeProfile.themeKey,
              specialty: themeProfile.specialty,
              stepCount,
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

        const out = {
          mapSpec,
          source: 'ai' as const,
          signals,
          validation: {
            ok: true,
            warnings: [`Created new template for theme "${themeProfile.specialty}" (${stepCount} steps) with image analysis.`],
          },
          startIndex: chunk.startIndex,
          endIndex: chunk.endIndex,
          mapImageUrl: imageResult.imageUrl,
          mapImagePath: imageResult.imagePath,
        };
        mapsWithImages.push(out);
        previousMapImagePath = imageResult.imagePath || previousMapImagePath;
    }

    // Save maps to database
    const savedMaps = await Map.insertMany(
      mapsWithImages.map((result, mapIndex) => ({
        consultationId: consultation._id,
        userId,
        mapIndex,
        startStepIndex: result.startIndex,
        endStepIndex: result.endIndex,
        mapSpec: result.mapSpec,
        source: result.source,
        validationWarnings: result.validation.warnings,
        mapImageUrl: result.mapImageUrl,
        mapImagePath: result.mapImagePath,
      }))
    );

    console.log(`Generated ${savedMaps.length} maps with images for consultation ${consultation._id}`);

    consultation.status = 'completed';
    await consultation.save();

    res.status(201).json({
      consultation,
      checklistItems,
      maps: savedMaps,
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

