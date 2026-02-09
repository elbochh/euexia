import mongoose, { Document, Schema } from 'mongoose';

export interface IUpload {
  type: 'voice' | 'image' | 'text' | 'pdf';
  fileUrl?: string;
  rawText?: string;
  summary?: string;
  processedAt?: Date;
}

export interface IConsultation extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  uploads: IUpload[];
  aggregatedSummary: string;
  checklistParagraph: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const UploadSchema = new Schema<IUpload>({
  type: { type: String, enum: ['voice', 'image', 'text', 'pdf'], required: true },
  fileUrl: { type: String },
  rawText: { type: String },
  summary: { type: String, default: '' },
  processedAt: { type: Date },
});

const ConsultationSchema = new Schema<IConsultation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, default: 'My Consultation' },
    uploads: [UploadSchema],
    aggregatedSummary: { type: String, default: '' },
    checklistParagraph: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

export const Consultation = mongoose.model<IConsultation>('Consultation', ConsultationSchema);

