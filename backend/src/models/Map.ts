import mongoose, { Document, Schema } from 'mongoose';
import { GeneratedMapSpec } from '../services/mapSpec/types';

export interface IMap extends Document {
  consultationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  mapIndex: number; // 0, 1, 2, etc. - which map in the sequence for this consultation
  startStepIndex: number; // Global step index where this map starts (0, 6, 12, etc.)
  endStepIndex: number; // Global step index where this map ends
  mapSpec: GeneratedMapSpec;
  source: 'ai' | 'fallback';
  validationWarnings: string[];
  mapImageUrl?: string; // URL path to the generated map image
  mapImagePath?: string; // Local file path to the map image
  createdAt: Date;
  updatedAt: Date;
}

const MapSchema = new Schema<IMap>(
  {
    consultationId: { type: Schema.Types.ObjectId, ref: 'Consultation', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mapIndex: { type: Number, required: true, default: 0 },
    startStepIndex: { type: Number, required: true, default: 0 },
    endStepIndex: { type: Number, required: true },
    mapSpec: { type: Schema.Types.Mixed, required: true },
    source: { type: String, enum: ['ai', 'fallback'], required: true, default: 'fallback' },
    validationWarnings: [{ type: String }],
    mapImageUrl: { type: String },
    mapImagePath: { type: String },
  },
  { timestamps: true }
);

// Index for efficient queries
MapSchema.index({ consultationId: 1, mapIndex: 1 });
MapSchema.index({ userId: 1, consultationId: 1 });

export const Map = mongoose.model<IMap>('Map', MapSchema);

