import mongoose, { Schema, Document } from 'mongoose';

export interface IVoiceToken extends Document {
  userId: string;
  token: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

const VoiceTokenSchema = new Schema<IVoiceToken>({
  userId: { type: String, required: true, index: true },
  token: { type: String, required: true, unique: true },
  name: { type: String, default: 'Default' },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date, default: null },
});

export default mongoose.models.VoiceToken || mongoose.model<IVoiceToken>('VoiceToken', VoiceTokenSchema);
