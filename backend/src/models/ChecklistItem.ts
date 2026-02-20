import mongoose, { Document, Schema } from 'mongoose';

export interface IChecklistItem extends Document {
  consultationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  frequency: string;

  // Scheduling / timing
  unlockAt: Date | null;         // when this item first becomes available to check
  cooldownMinutes: number;       // minutes between recurring completions (0 = one-time)
  nextDueAt: Date | null;        // when the item can next be completed (after cooldown)
  totalRequired: number;         // total completions needed (1 = one-time, 0 = ongoing)
  completionCount: number;       // how many times completed so far
  durationDays: number;          // how many days this task is relevant (0 = indefinite)
  expiresAt: Date | null;        // calculated: createdAt + durationDays
  timeOfDay: string;             // preferred time: "morning", "afternoon", "evening", "night", "any"

  // Status
  isCompleted: boolean;          // fully done (one-time) or current cycle done (recurring)
  completedAt: Date | null;
  isFullyDone: boolean;          // true when completionCount >= totalRequired (and totalRequired > 0)

  // Rewards
  xpReward: number;
  coinReward: number;
  category: string;
  order: number;

  // Event grouping (one star can have multiple events; sequential unlock within group)
  groupId: string;       // same groupId = same star on map
  orderInGroup: number; // 0, 1, 2, ... for sequence within group (event N unlocks when N-1 completed)

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

    // Scheduling
    unlockAt: { type: Date, default: null },
    cooldownMinutes: { type: Number, default: 0 },
    nextDueAt: { type: Date, default: null },
    totalRequired: { type: Number, default: 1 },
    completionCount: { type: Number, default: 0 },
    durationDays: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null },
    timeOfDay: { type: String, default: 'any' },

    // Status
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    isFullyDone: { type: Boolean, default: false },

    // Rewards & ordering
    xpReward: { type: Number, default: 10 },
    coinReward: { type: Number, default: 5 },
    category: { type: String, default: 'general' },
    order: { type: Number, default: 0 },

    // Event grouping
    groupId: { type: String, default: '0' },
    orderInGroup: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const ChecklistItem = mongoose.model<IChecklistItem>('ChecklistItem', ChecklistItemSchema);
