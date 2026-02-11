import fs from 'fs';
import mongoose from 'mongoose';
import { MapThemeTemplate } from '../models/MapThemeTemplate';
import { Consultation } from '../models/Consultation';
import { ChecklistItem } from '../models/ChecklistItem';
import { Map } from '../models/Map';
import { GameProgress } from '../models/GameProgress';

const MONGO_URI =
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
        if (fs.existsSync(t.mapImagePath)) {
          fs.unlinkSync(t.mapImagePath);
          deletedLocalFiles += 1;
        }
      } catch (err) {
        console.warn(`Could not delete local file: ${t.mapImagePath}`, err);
      }
    }

    for (const m of maps) {
      if (!m.mapImagePath) continue;
      try {
        if (fs.existsSync(m.mapImagePath)) {
          fs.unlinkSync(m.mapImagePath);
          deletedLocalFiles += 1;
        }
      } catch (err) {
        console.warn(`Could not delete local file: ${m.mapImagePath}`, err);
      }
    }

    // Clear all app data that defines a user's journey/progress.
    const [themeRes, mapsRes, checklistRes, consultationRes, progressRes] = await Promise.all([
      MapThemeTemplate.deleteMany({}),
      Map.deleteMany({}),
      ChecklistItem.deleteMany({}),
      Consultation.deleteMany({}),
      GameProgress.deleteMany({}),
    ]);

    console.log(`Deleted ${themeRes.deletedCount ?? 0} theme template docs.`);
    console.log(`Deleted ${mapsRes.deletedCount ?? 0} map docs.`);
    console.log(`Deleted ${checklistRes.deletedCount ?? 0} checklist item docs.`);
    console.log(`Deleted ${consultationRes.deletedCount ?? 0} consultation docs.`);
    console.log(`Deleted ${progressRes.deletedCount ?? 0} game progress docs.`);
    console.log(`Deleted ${deletedLocalFiles} local image files.`);
    console.log('Done. User journey data has been reset.');
  } catch (err) {
    console.error('Failed to clear app data:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();


