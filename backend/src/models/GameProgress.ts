import mongoose, { Document, Schema } from 'mongoose';

export interface IGameProgress extends Document {
  userId: mongoose.Types.ObjectId;
  xp: number;
  level: number;
  coins: number;
  currentTheme: string;
  completedThemes: string[];
  streak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
  totalCompleted: number;
  createdAt: Date;
  updatedAt: Date;
}

const GameProgressSchema = new Schema<IGameProgress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    coins: { type: Number, default: 0 },
    currentTheme: { type: String, default: 'desert' },
    completedThemes: [{ type: String }],
    streak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastActiveDate: { type: Date, default: null },
    totalCompleted: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const GameProgress = mongoose.model<IGameProgress>('GameProgress', GameProgressSchema);

