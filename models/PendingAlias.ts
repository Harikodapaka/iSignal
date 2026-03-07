import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPendingAliasDocument extends Document {
  rawKey: string;
  suggestedKey: string;
  userId: string;
  confidence: number;
  status: 'pending' | 'confirmed' | 'rejected';
}

const PendingAliasSchema = new Schema<IPendingAliasDocument>(
  {
    rawKey: { type: String, required: true },
    suggestedKey: { type: String, required: true },
    userId: { type: String, required: true },
    confidence: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

PendingAliasSchema.index({ userId: 1, status: 1 });

const PendingAliasModel: Model<IPendingAliasDocument> =
  mongoose.models.PendingAlias ?? mongoose.model<IPendingAliasDocument>('PendingAlias', PendingAliasSchema);

export default PendingAliasModel;
