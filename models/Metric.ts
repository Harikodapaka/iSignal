import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMetricReminder {
  enabled: boolean;
  times: number[]; // hours (0-23) when to send reminders
}

export interface IMetricDocument extends Document {
  userId: string;
  metricKey: string;
  displayName: string;
  valueType: 'boolean' | 'number' | 'text';
  unit?: string;
  aggregation?: 'sum' | 'avg' | 'last';
  pinned: boolean;
  userUnpinned: boolean;
  frequencyScore: number;
  reminder?: IMetricReminder;
}

const MetricSchema = new Schema<IMetricDocument>(
  {
    userId: { type: String, required: true },
    metricKey: { type: String, required: true },
    displayName: { type: String, required: true },
    valueType: { type: String, enum: ['boolean', 'number', 'text'], required: true },
    unit: { type: String },
    aggregation: { type: String, enum: ['sum', 'avg', 'last'], default: 'avg' },
    pinned: { type: Boolean, default: false },
    userUnpinned: { type: Boolean, default: false }, // user manually unpinned — never auto-re-pin
    frequencyScore: { type: Number, default: 1 },
    reminder: {
      type: {
        enabled: { type: Boolean, default: false },
        times: { type: [Number], default: [] },
      },
      default: undefined,
    },
  },
  { timestamps: true }
);

MetricSchema.index({ userId: 1, metricKey: 1 }, { unique: true });
MetricSchema.index({ userId: 1, pinned: -1, frequencyScore: -1 });

const MetricModel: Model<IMetricDocument> =
  mongoose.models.Metric ?? mongoose.model<IMetricDocument>('Metric', MetricSchema);

export default MetricModel;
