import mongoose, { Document, Schema } from 'mongoose';

export type ContextChunkSourceType =
  | 'consultation_summary'
  | 'upload_summary'
  | 'checklist_item'
  | 'chat_message';

export interface IContextChunk extends Document {
  userId: mongoose.Types.ObjectId;
  consultationId?: mongoose.Types.ObjectId;
  sourceType: ContextChunkSourceType;
  sourceId: string;
  content: string;
  tokenEstimate: number;
  embedding: number[];
  metadata?: {
    uploadType?: 'voice' | 'image' | 'text' | 'pdf';
    checklistCategory?: string;
    isActiveChecklist?: boolean;
    createdAtSource?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ContextChunkSchema = new Schema<IContextChunk>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    consultationId: { type: Schema.Types.ObjectId, ref: 'Consultation' },
    sourceType: {
      type: String,
      enum: ['consultation_summary', 'upload_summary', 'checklist_item', 'chat_message'],
      required: true,
    },
    sourceId: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    tokenEstimate: { type: Number, required: true, min: 0, default: 0 },
    // Atlas Vector Search uses this numeric array field.
    embedding: [{ type: Number, required: true }],
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ContextChunkSchema.index({ userId: 1, consultationId: 1, sourceType: 1, sourceId: 1 }, { unique: true });
ContextChunkSchema.index({ userId: 1, updatedAt: -1 });
ContextChunkSchema.index({ consultationId: 1, updatedAt: -1 });

export const ContextChunk = mongoose.model<IContextChunk>('ContextChunk', ContextChunkSchema);

