/**
 * Clear all database content: users (including guests), consultations, maps,
 * checklist items, game progress, chat messages, RAG context chunks, and local map images.
 *
 * How to run (from backend folder):
 *   npm run maps:clear-theme-images
 *
 * Or with ts-node directly:
 *   npx ts-node src/scripts/clearThemeImages.ts
 *
 * Uses MONGODB_URI from .env if set; otherwise falls back to default.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { MapThemeTemplate } from '../models/MapThemeTemplate';
import { Consultation } from '../models/Consultation';
import { ChecklistItem } from '../models/ChecklistItem';
import { Map } from '../models/Map';
import { GameProgress } from '../models/GameProgress';
import { User } from '../models/User';
import { ChatMessage } from '../models/ChatMessage';
import { ContextChunk } from '../models/ContextChunk';

const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb+srv://jay_db_user:4Cj4ev6dkgwYq4Cg@cluster0.vwgksof.mongodb.net/?appName=Cluster0';

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    const templates = await MapThemeTemplate.find({}, { mapImagePath: 1, themeKey: 1, stepCount: 1 }).lean();
    const maps = await Map.find({}, { mapImagePath: 1 }).lean();
    console.log(`Found ${templates.length} theme template records.`);
    console.log(`Found ${maps.length} map records.`);

    let deletedLocalFiles = 0;
    for (const t of templates) {
      if (!t.mapImagePath) continue;
      try {
        const fullPath = path.isAbsolute(t.mapImagePath) ? t.mapImagePath : path.join(__dirname, '../../', t.mapImagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          deletedLocalFiles += 1;
        }
      } catch (err) {
        console.warn(`Could not delete local file: ${t.mapImagePath}`, err);
      }
    }

    for (const m of maps) {
      if (!m.mapImagePath) continue;
      try {
        const fullPath = path.isAbsolute(m.mapImagePath) ? m.mapImagePath : path.join(__dirname, '../../', m.mapImagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          deletedLocalFiles += 1;
        }
      } catch (err) {
        console.warn(`Could not delete local file: ${m.mapImagePath}`, err);
      }
    }

    // Clear all user and guest data: dependent collections first, then users.
    const [chatRes, chunkRes, themeRes, mapsRes, checklistRes, consultationRes, progressRes, userRes] = await Promise.all([
      ChatMessage.deleteMany({}),
      ContextChunk.deleteMany({}),
      MapThemeTemplate.deleteMany({}),
      Map.deleteMany({}),
      ChecklistItem.deleteMany({}),
      Consultation.deleteMany({}),
      GameProgress.deleteMany({}),
      User.deleteMany({}),
    ]);

    console.log(`Deleted ${chatRes.deletedCount ?? 0} chat message docs.`);
    console.log(`Deleted ${chunkRes.deletedCount ?? 0} context chunk docs.`);
    console.log(`Deleted ${themeRes.deletedCount ?? 0} theme template docs.`);
    console.log(`Deleted ${mapsRes.deletedCount ?? 0} map docs.`);
    console.log(`Deleted ${checklistRes.deletedCount ?? 0} checklist item docs.`);
    console.log(`Deleted ${consultationRes.deletedCount ?? 0} consultation docs.`);
    console.log(`Deleted ${progressRes.deletedCount ?? 0} game progress docs.`);
    console.log(`Deleted ${userRes.deletedCount ?? 0} user docs (including guests).`);
    console.log(`Deleted ${deletedLocalFiles} local image files.`);
    console.log('Done. All user, guest, and app data has been cleared.');
  } catch (err) {
    console.error('Failed to clear app data:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();


