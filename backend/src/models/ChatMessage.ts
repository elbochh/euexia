import mongoose, { Document, Schema } from 'mongoose';

export interface IChatMessage extends Document {
  userId: mongoose.Types.ObjectId;
  consultationId?: mongoose.Types.ObjectId;
  role: 'user' | 'assistant' | 'system';
  content: string;
  retrievalMode?: 'small' | 'vector';
  metadata?: {
    contextTokenEstimate?: number;
    vectorTopK?: number;
    sourceChunkIds?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    consultationId: { type: Schema.Types.ObjectId, ref: 'Consultation' },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true, trim: true },
    retrievalMode: { type: String, enum: ['small', 'vector'] },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ChatMessageSchema.index({ userId: 1, createdAt: -1 });
ChatMessageSchema.index({ userId: 1, consultationId: 1, createdAt: -1 });

export const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);

