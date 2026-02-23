import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Consultation } from '../models/Consultation';
import { ChecklistItem } from '../models/ChecklistItem';
import { Map as MapModel } from '../models/Map';
import { processVoice } from '../services/agents/voiceAgent';
import { processImage } from '../services/agents/imageAgent';
import { processText } from '../services/agents/textAgent';
import { processPdf } from '../services/agents/pdfAgent';
import { aggregateSummaries } from '../services/agents/summaryAgent';
import { structureChecklistAsEvents } from '../services/agents/checklistAgent';
import { generateMapSpecForChecklist } from '../services/mapSpec/generator';
import { indexConsultationContext } from '../services/rag/indexer';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

/** Simple high-resolution timer helper — returns elapsed ms since a given hrtime */
function elapsed(start: [number, number]): number {
  const [s, ns] = process.hrtime(start);
  return Math.round(s * 1000 + ns / 1e6);
}

/**
 * Create a new consultation and process all uploads through the AI pipeline.
 *
 * Pipeline:
 *  1. Process all uploads in PARALLEL (voice→SageMaker ASR, image→SageMaker vision,
 *     text→SageMaker MedGemma, pdf→SageMaker MedGemma)
 *  2. Aggregate summaries via SageMaker MedGemma
 *  3. Structure checklist events via OpenAI GPT-4.1 (best quality for JSON structuring)
 *  4. Save checklist items → return response to user
 *  5. Generate map spec algorithmically (no AI call — frontend renders via Kenney hex tiles)
 *  6. Fire-and-forget: RAG context indexing
 */
export const createConsultation = async (req: AuthRequest, res: Response): Promise<void> => {
  const pipelineStart = process.hrtime();
  const timings: Record<string, number> = {};

  try {
    const userId = req.userId!;
    const { title, uploads } = req.body;

    // ── Step 0: Create consultation record ──
    let t = process.hrtime();
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
    timings['0_db_create'] = elapsed(t);

    // ── Step 1: Process each upload in PARALLEL via SageMaker ──
    t = process.hrtime();
    console.log(`[Pipeline] Step 1: Processing ${consultation.uploads.length} upload(s) in parallel via SageMaker...`);
    const summaryPromises = consultation.uploads.map(async (upload, index) => {
      const uploadStart = process.hrtime();
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
          case 'pdf': {
            let pdfText = upload.rawText || '';
            if (!pdfText && upload.fileUrl) {
              try {
                let pdfBuffer: Buffer;
                if (upload.fileUrl.startsWith('/uploads/') || upload.fileUrl.startsWith('./uploads/')) {
                  const filePath = path.join(__dirname, '../../', upload.fileUrl);
                  if (fs.existsSync(filePath)) {
                    pdfBuffer = fs.readFileSync(filePath);
                    console.log(`[PDF] Reading PDF from disk: ${filePath}`);
                  } else {
                    throw new Error(`PDF file not found at ${filePath}`);
                  }
                } else {
                  let base64Data = upload.fileUrl;
                  if (base64Data.includes(',')) base64Data = base64Data.split(',')[1];
                  pdfBuffer = Buffer.from(base64Data, 'base64');
                  console.log(`[PDF] Decoding PDF from base64 (${base64Data.length} chars)`);
                }
                const pdfData = await pdfParse(pdfBuffer);
                pdfText = pdfData.text;
                console.log(`[PDF] Extracted ${pdfText.length} chars from PDF (${pdfData.numpages} pages)`);
              } catch (parseError: any) {
                console.error('[PDF] Failed to parse PDF:', parseError?.message || parseError);
                pdfText = '';
              }
            }
            if (!pdfText) console.warn('[PDF] No text extracted — processPdf will receive empty string');
            summary = await processPdf(pdfText, []);
            break;
          }
        }
        consultation.uploads[index].summary = summary;
        consultation.uploads[index].processedAt = new Date();
        console.log(`[Pipeline]   upload[${index}] ${upload.type} done in ${elapsed(uploadStart)}ms`);
        return summary;
      } catch (err) {
        console.error(`[Pipeline]   upload[${index}] ${upload.type} FAILED after ${elapsed(uploadStart)}ms:`, err);
        return '';
      }
    });

    const summaries = (await Promise.all(summaryPromises)).filter((s) => s.length > 0);
    timings['1_uploads_parallel'] = elapsed(t);
    console.log(`[Pipeline] Step 1 done: ${summaries.length} summaries in ${timings['1_uploads_parallel']}ms`);

    // ── Step 2: Aggregate summaries via SageMaker MedGemma ──
    t = process.hrtime();
    console.log(`[Pipeline] Step 2: Aggregating summaries via SageMaker MedGemma...`);
    const rawParagraph = await aggregateSummaries(summaries);
    consultation.aggregatedSummary = summaries.join('\n\n---\n\n');
    consultation.checklistParagraph = rawParagraph;
    timings['2_aggregate'] = elapsed(t);
    console.log(`[Pipeline] Step 2 done in ${timings['2_aggregate']}ms — paragraph: ${rawParagraph.length} chars`);

    // Clean the paragraph before passing to the checklist agent
    const checklistParagraph = rawParagraph
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^[\s]*[-•*]\s*/gm, '- ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // ── Step 3: Structure checklist events via OpenAI GPT-4.1 ──
    t = process.hrtime();
    console.log(`[Pipeline] Step 3: Structuring checklist events via OpenAI GPT-4.1...`);
    const eventData = await structureChecklistAsEvents(checklistParagraph);
    timings['3_checklist_events'] = elapsed(t);
    console.log(`[Pipeline] Step 3 done in ${timings['3_checklist_events']}ms — ${eventData.length} events`);

    // ── Step 4: Save checklist items to DB ──
    t = process.hrtime();
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
    timings['4_db_checklist'] = elapsed(t);
    console.log(`[Pipeline] Step 4 done in ${timings['4_db_checklist']}ms — saved ${checklistItems.length} items`);

    // Save consultation with summaries
    await consultation.save();

    // ── Step 5: Generate algorithmic map spec (no AI call) ──
    t = process.hrtime();

    // Build group-level data: one star per unique starGroupId (typically per day)
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
    const totalStepCount = checklistItemsData.length;

    console.log(`[Pipeline] Step 5: Generating algorithmic map spec for ${totalStepCount} stars...`);
    const { mapSpec } = await generateMapSpecForChecklist(checklistItemsData, 0, totalStepCount);

    const savedMap = await MapModel.create({
      consultationId: consultation._id,
      userId,
      mapIndex: 0,
      startStepIndex: 0,
      endStepIndex: totalStepCount - 1,
      mapSpec,
      source: 'fallback',
      validationWarnings: [],
      mapImageUrl: null,
      mapImagePath: null,
    });
    timings['5_map_spec'] = elapsed(t);
    console.log(`[Pipeline] Step 5 done in ${timings['5_map_spec']}ms — ${totalStepCount} checkpoints`);

    consultation.status = 'completed';
    await consultation.save();

    // ── Step 6 (background): RAG context indexing ──
    indexConsultationContext(userId, consultation._id.toString()).catch((err) =>
      console.warn('[RAG] Failed to index consultation context:', err)
    );

    // ── Print timing summary ──
    const totalMs = elapsed(pipelineStart);
    console.log(`\n╔════════════════════════════════════════╗`);
    console.log(`║       PIPELINE TIMING SUMMARY          ║`);
    console.log(`╠════════════════════════════════════════╣`);
    for (const [step, ms] of Object.entries(timings)) {
      const bar = '█'.repeat(Math.min(20, Math.round(ms / 500)));
      console.log(`║  ${step.padEnd(22)} ${String(ms + 'ms').padStart(7)}  ${bar}`);
    }
    console.log(`╠════════════════════════════════════════╣`);
    console.log(`║  TOTAL                    ${String(totalMs + 'ms').padStart(7)}          ║`);
    console.log(`╚════════════════════════════════════════╝\n`);

    res.status(201).json({
      consultation,
      checklistItems,
      maps: [savedMap],
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

