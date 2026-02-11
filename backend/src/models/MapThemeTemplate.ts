import mongoose, { Document, Schema } from 'mongoose';
import { GeneratedMapSpec } from '../services/mapSpec/types';
import { ThemeProfile } from '../services/mapImageGenerator';

export interface IMapThemeTemplate extends Document {
  themeKey: string; // e.g. "dentistry", "chiropractic", "chest_xray"
  specialty: string; // human-readable label
  stepCount: number; // number of quest steps this template supports
  mapSpec: GeneratedMapSpec;
  mapImageUrl: string;
  mapImagePath?: string;
  stepLabels?: string[];
  source: 'ai' | 'fallback';
  promptVersion: number;
  themeProfile?: ThemeProfile; // Stored theme details
  usageCount: number;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MapThemeTemplateSchema = new Schema<IMapThemeTemplate>(
  {
    themeKey: { type: String, required: true, trim: true, lowercase: true },
    specialty: { type: String, required: true, trim: true },
    stepCount: { type: Number, required: true, min: 2, max: 12 },
    mapSpec: { type: Schema.Types.Mixed, required: true },
    mapImageUrl: { type: String, required: true },
    mapImagePath: { type: String, default: '' },
    stepLabels: [{ type: String }],
    source: { type: String, enum: ['ai', 'fallback'], required: true, default: 'ai' },
    promptVersion: { type: Number, required: true, default: 1 },
    themeProfile: { type: Schema.Types.Mixed },
    usageCount: { type: Number, required: true, default: 1 },
    lastUsedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

MapThemeTemplateSchema.index({ themeKey: 1, stepCount: 1, promptVersion: 1 }, { unique: true });
MapThemeTemplateSchema.index({ specialty: 1 });

export const MapThemeTemplate = mongoose.model<IMapThemeTemplate>(
  'MapThemeTemplate',
  MapThemeTemplateSchema
);

