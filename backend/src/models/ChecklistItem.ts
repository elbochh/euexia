import mongoose, { Document, Schema } from 'mongoose';

export interface IChecklistItem extends Document {
  consultationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  frequency: string;
  nextDueAt: Date | null;
  isCompleted: boolean;
  completedAt: Date | null;
  xpReward: number;
  coinReward: number;
  category: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const ChecklistItemSchema = new Schema<IChecklistItem>(
  {
    consultationId: { type: Schema.Types.ObjectId, ref: 'Consultation', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    frequency: { type: String, default: 'once' },
    nextDueAt: { type: Date, default: null },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    xpReward: { type: Number, default: 10 },
    coinReward: { type: Number, default: 5 },
    category: { type: String, default: 'general' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const ChecklistItem = mongoose.model<IChecklistItem>('ChecklistItem', ChecklistItemSchema);

