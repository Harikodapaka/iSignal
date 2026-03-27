import mongoose, { Schema, Document } from 'mongoose';

export interface IPushSubscription extends Document {
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  enabled: boolean;
  smartReminders: boolean; // Auto-send reminders based on logging patterns
  timezone: string;
  lastNotifiedAt: Record<string, Date>; // { morning: Date, midday: Date, evening: Date }
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    userId: { type: String, required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    enabled: { type: Boolean, default: true },
    smartReminders: { type: Boolean, default: true },
    timezone: { type: String, default: 'UTC' },
    lastNotifiedAt: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export default mongoose.models.PushSubscription ||
  mongoose.model<IPushSubscription>('PushSubscription', PushSubscriptionSchema);
