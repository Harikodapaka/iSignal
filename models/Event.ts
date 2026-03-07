import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEventDocument extends Document {
  userId: string;
  timestamp: string;
  date: string;
  rawText: string;
  metricKey: string;
  value: boolean | number | string;
  valueType: 'boolean' | 'number' | 'text';
  unit?: string;
  tags?: string[];
  sentiment?: string;
  note?: string;
}

const EventSchema = new Schema<IEventDocument>(
  {
    userId: { type: String, required: true },
    timestamp: { type: String, required: true },
    date: { type: String, required: true },
    rawText: { type: String, required: true },
    metricKey: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
    valueType: {
      type: String,
      enum: ['boolean', 'number', 'text'],
      required: true,
    },
    unit: { type: String },
    tags: [{ type: String }],
    sentiment: { type: String },
    note: { type: String },
  },
  { timestamps: true }
);

EventSchema.index({ userId: 1, date: 1 });
EventSchema.index({ userId: 1, metricKey: 1 });
EventSchema.index({ userId: 1, timestamp: -1 });

const EventModel: Model<IEventDocument> = mongoose.models.Event ?? mongoose.model<IEventDocument>('Event', EventSchema);

export default EventModel;
