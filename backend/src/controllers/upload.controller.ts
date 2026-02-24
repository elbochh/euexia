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
import { structureChecklistAsEvents, validateChecklistCompleteness } from '../services/agents/checklistAgent';
import { generateMapSpecForChecklist } from '../services/mapSpec/generator';
import { indexConsultationContext } from '../services/rag/indexer';
import { extractMedicationNames } from '../services/agents/medicationExtractor';
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

    // ── Step 1.5: Pre-extract medication names from raw text (rule-based, no AI) ──
    // This catches EVERY medication deterministically so the AI summary agent can't miss any
    const allRawText = summaries.join('\n\n');
    const detectedMeds = extractMedicationNames(allRawText);
    const medListForPrompt = detectedMeds.length > 0
      ? detectedMeds.map((m, i) => `  ${i + 1}. ${m.rawMatch}`).join('\n')
      : '';
    console.log(`[Pipeline] Step 1.5: Pre-extracted ${detectedMeds.length} medications from raw text`);
    if (detectedMeds.length > 0) {
      console.log(`[Pipeline]   Medications found: ${detectedMeds.map(m => m.name).join(', ')}`);
    }

    // ── Step 2: Aggregate summaries via SageMaker MedGemma ──
    t = process.hrtime();
    console.log(`[Pipeline] Step 2: Aggregating summaries via SageMaker MedGemma...`);
    const rawParagraph = await aggregateSummaries(summaries, medListForPrompt || undefined);
    consultation.aggregatedSummary = summaries.join('\n\n---\n\n');
    timings['2_aggregate'] = elapsed(t);
    console.log(`[Pipeline] Step 2 done in ${timings['2_aggregate']}ms — paragraph: ${rawParagraph.length} chars`);

    // ── Step 2.5: Post-validate — patch any medications the AI model still missed ──
    let finalParagraph = rawParagraph;
    if (detectedMeds.length > 0) {
      const paragraphLower = rawParagraph.toLowerCase();
      const missingMeds = detectedMeds.filter(
        (m) => !paragraphLower.includes(m.name.toLowerCase())
      );
      if (missingMeds.length > 0) {
        console.warn(`[Pipeline] ⚠️ AI model missed ${missingMeds.length} medication(s): ${missingMeds.map(m => m.name).join(', ')}`);
        // Append the missing medications directly to the paragraph
        const patch = missingMeds
          .map((m) => `${m.rawMatch}.`)
          .join(' ');
        finalParagraph = `${rawParagraph}\n\nADDITIONAL MEDICATIONS (from source): ${patch}`;
        console.log(`[Pipeline]   Patched ${missingMeds.length} missing medication(s) into summary`);
      } else {
        console.log(`[Pipeline] ✓ All ${detectedMeds.length} pre-extracted medications present in summary`);
      }
    }

    consultation.checklistParagraph = finalParagraph;

    // Clean the paragraph before passing to the checklist agent
    const checklistParagraph = finalParagraph
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
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Additional deduplication: remove events with same title, category, and same unlockAt date
    const seenBeforeSave = new Map<string, boolean>();
    const deduplicatedEvents = eventData.filter((event) => {
      const unlockDate = new Date(event.unlockAt).toISOString().split('T')[0]; // YYYY-MM-DD
      const key = `${event.category}_${event.title.toLowerCase().trim()}_${unlockDate}`;
      
      if (seenBeforeSave.has(key)) {
        console.warn(`[Checklist] Duplicate event filtered before save: ${event.title} (category: ${event.category}, date: ${unlockDate})`);
        return false;
      }
      
      seenBeforeSave.set(key, true);
      return true;
    });
    
    console.log(`[Checklist] Before save deduplication: ${eventData.length} events → ${deduplicatedEvents.length} unique events`);
    
    // Calculate expiration dates for medication sequences
    // For each medication sequence, find the last event's date and set expiresAt to that date + 1 day
    const medicationSequenceExpiry = new Map<string, Date>();
    deduplicatedEvents.forEach((event) => {
      if (event.category === 'medication') {
        const seqId = event.sequenceId || event.groupId || '';
        if (seqId) {
          const eventDate = new Date(event.unlockAt);
          const existing = medicationSequenceExpiry.get(seqId);
          if (!existing || eventDate > existing) {
            // Set expiry to last event date + 1 day (to allow completion on the last day)
            const expiryDate = new Date(eventDate);
            expiryDate.setDate(expiryDate.getDate() + 1);
            expiryDate.setHours(23, 59, 59, 999); // End of day
            medicationSequenceExpiry.set(seqId, expiryDate);
          }
        }
      }
    });
    
    const checklistItems = await ChecklistItem.insertMany(
      deduplicatedEvents.map((event, index) => {
        const eventUnlockAt = new Date(event.unlockAt);
        const eventDateStart = new Date(eventUnlockAt.getFullYear(), eventUnlockAt.getMonth(), eventUnlockAt.getDate());
        
        // For medication tasks: unlock first dose immediately if it's scheduled for today
        // Lock second dose onwards and future-day medications
        let unlockAt: Date | null = eventUnlockAt;
        if (event.category === 'medication') {
          const isFirstDose = (event.orderInGroup ?? 0) === 0;
          const isToday = eventDateStart.getTime() === todayStart.getTime();
          
          if (isFirstDose && isToday) {
            // First dose of medication scheduled for today → unlock immediately
            unlockAt = null;
          }
          // For second dose onwards (orderInGroup > 0) or future days, keep unlockAt as is
          // They will unlock after the previous dose is completed (via group locking logic)
        }
        
        // Calculate expiresAt: for medications, use the sequence expiry date
        let expiresAt: Date | null = null;
        if (event.category === 'medication') {
          const seqId = event.sequenceId || event.groupId || '';
          if (seqId && medicationSequenceExpiry.has(seqId)) {
            expiresAt = medicationSequenceExpiry.get(seqId)!;
          }
        }
        
        // Calculate durationDays from first to last event in sequence (for medications)
        let durationDays = 0;
        if (event.category === 'medication') {
          const seqId = event.sequenceId || event.groupId || '';
          if (seqId && medicationSequenceExpiry.has(seqId)) {
            const firstEvent = deduplicatedEvents.find(e => 
              (e.sequenceId || e.groupId || '') === seqId && (e.orderInGroup ?? 0) === 0
            );
            if (firstEvent) {
              const firstDate = new Date(firstEvent.unlockAt);
              const lastDate = medicationSequenceExpiry.get(seqId)!;
              durationDays = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
            }
          }
        }
        
        return {
          consultationId: consultation._id,
          userId,
          title: event.title,
          description: event.description,
          frequency: 'once',
          category: event.category,
          xpReward: event.xpReward,
          coinReward: event.coinReward,
          order: index,
          unlockAt: unlockAt,
          cooldownMinutes: 0,
          nextDueAt: unlockAt || now,
          totalRequired: 1,
          completionCount: 0,
          durationDays: durationDays,
          expiresAt: expiresAt,
          timeOfDay: 'any',
          isFullyDone: false,
          groupId: event.groupId,
          sequenceId: event.sequenceId,
          starGroupId: event.starGroupId,
          orderInGroup: event.orderInGroup,
        };
      })
    );
    timings['4_db_checklist'] = elapsed(t);
    console.log(`[Pipeline] Step 4 done in ${timings['4_db_checklist']}ms — saved ${checklistItems.length} items`);

    // ── Step 4.5: Verify checklist completeness ──
    const checklistItemData = deduplicatedEvents.map((e) => ({
      title: e.title,
      description: e.description,
      frequency: 'once',
      category: e.category,
      xpReward: e.xpReward,
      coinReward: e.coinReward,
      unlockAfterHours: 0,
      cooldownHours: 0,
      totalRequired: 1,
      durationDays: 0,
      timeOfDay: 'any',
    }));
    
    const validation = validateChecklistCompleteness(checklistItemData, checklistParagraph);
    
    console.log(`\n=== CHECKLIST VERIFICATION ===`);
    console.log(`Total items generated: ${checklistItemData.length}`);
    console.log(`Medication items: ${checklistItemData.filter(i => i.category === 'medication').length}`);
    console.log(`Appointment items: ${checklistItemData.filter(i => i.category === 'appointment').length}`);
    console.log(`Test items: ${checklistItemData.filter(i => i.category === 'test').length}`);
    
    if (validation.warnings.length > 0) {
      console.warn(`⚠️  WARNINGS:`);
      validation.warnings.forEach(w => console.warn(`   - ${w}`));
    }
    
    if (validation.missing.length > 0) {
      console.error(`❌ MISSING MEDICATIONS:`);
      validation.missing.forEach(m => console.error(`   - ${m}`));
    }
    
    if (validation.suggestions.length > 0) {
      console.log(`💡 SUGGESTIONS:`);
      validation.suggestions.forEach(s => console.log(`   - ${s}`));
    }
    
    // Log source paragraph preview for debugging
    console.log(`\nSource paragraph length: ${checklistParagraph.length} chars`);
    console.log(`Source preview (first 500 chars): ${checklistParagraph.substring(0, 500)}...`);
    
    // Check which medications are in source vs generated
    const sourceLower = checklistParagraph.toLowerCase();
    const expectedMeds = ['bisoprolol', 'alendronic', 'adcal', 'omeprazole', 'glyceryl', 'trinitrate', 'warfarin', 'folic', 'ramipril', 'simvastatin', 'gliclazide'];
    const foundInSource: string[] = [];
    const notFoundInSource: string[] = [];
    
    expectedMeds.forEach(med => {
      if (sourceLower.includes(med)) {
        foundInSource.push(med);
      } else {
        notFoundInSource.push(med);
      }
    });
    
    console.log(`\nMedications in source: ${foundInSource.length}/${expectedMeds.length}`);
    if (foundInSource.length > 0) {
      console.log(`  Found: ${foundInSource.join(', ')}`);
    }
    if (notFoundInSource.length > 0) {
      console.log(`  Not found in source: ${notFoundInSource.join(', ')}`);
    }
    
    const generatedMeds = checklistItemData.filter(i => i.category === 'medication');
    console.log(`\nGenerated medication titles (${generatedMeds.length}):`, 
      generatedMeds.map(i => i.title)
    );
    
    // Check for Simvastatin specifically
    const hasSimvastatinInSource = sourceLower.includes('simvastatin');
    const hasSimvastatinInGenerated = generatedMeds.some(i => 
      i.title.toLowerCase().includes('simvastatin') || 
      i.description.toLowerCase().includes('simvastatin')
    );
    
    if (hasSimvastatinInSource && !hasSimvastatinInGenerated) {
      console.error(`\n❌ CRITICAL: Simvastatin is in source but NOT in generated checklist!`);
      console.error(`   Source contains: "${sourceLower.match(/simvastatin[^.]*/i)?.[0] || 'simvastatin'}"`);
    }
    
    console.log(`================================\n`);

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

