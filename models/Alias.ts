import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAliasDocument extends Document {
  rawKey: string;
  canonicalKey: string;
  userId: string | null;
  createdBy: 'system' | 'user' | 'ai';
  confidence: number;
  usageCount: number;
}

const AliasSchema = new Schema<IAliasDocument>(
  {
    rawKey: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    canonicalKey: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    userId: { type: String, default: null },
    createdBy: {
      type: String,
      enum: ['system', 'user', 'ai'],
      default: 'system',
    },
    confidence: { type: Number, default: 1.0 },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

AliasSchema.index({ rawKey: 1, userId: 1 });
AliasSchema.index({ canonicalKey: 1 });

const AliasModel: Model<IAliasDocument> = mongoose.models.Alias ?? mongoose.model<IAliasDocument>('Alias', AliasSchema);

export default AliasModel;
