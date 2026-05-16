// backend/wipeAllUserData.js
require('dotenv').config();
const mongoose = require('mongoose');

const { User } = require('./dist/models/User');
const { GameProgress } = require('./dist/models/GameProgress');
const { Consultation } = require('./dist/models/Consultation');
const { ChecklistItem } = require('./dist/models/ChecklistItem');
const { Map } = require('./dist/models/Map');
const { ChatMessage } = require('./dist/models/ChatMessage');
const { ContextChunk } = require('./dist/models/ContextChunk');

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI / MONGODB_URI is not set in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  console.log('WARNING: this will delete ALL users and ALL related data for this app.');
  console.log('Starting wipe...\n');

  const [gpRes, consRes, checklistRes, mapsRes, chatRes, ctxRes, userRes] = await Promise.all([
    GameProgress.deleteMany({}),
    Consultation.deleteMany({}),
    ChecklistItem.deleteMany({}),
    Map.deleteMany({}),
    ChatMessage.deleteMany({}),
    ContextChunk.deleteMany({}),
    User.deleteMany({}),
  ]);

  console.log(`Deleted:
  - GameProgress: ${gpRes.deletedCount}
  - Consultations: ${consRes.deletedCount}
  - ChecklistItems: ${checklistRes.deletedCount}
  - Maps: ${mapsRes.deletedCount}
  - ChatMessages: ${chatRes.deletedCount}
  - ContextChunks: ${ctxRes.deletedCount}
  - Users: ${userRes.deletedCount}`);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});