import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IMetricDocument extends Document {
  userId: string
  metricKey: string
  displayName: string
  valueType: 'boolean' | 'number' | 'text'
  unit?: string
  aggregation?: 'sum' | 'avg' | 'last'
  pinned: boolean
  frequencyScore: number
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
    frequencyScore: { type: Number, default: 1 },
  },
  { timestamps: true }
)

MetricSchema.index({ userId: 1, metricKey: 1 }, { unique: true })
MetricSchema.index({ userId: 1, pinned: -1, frequencyScore: -1 })

const MetricModel: Model<IMetricDocument> =
  mongoose.models.Metric ?? mongoose.model<IMetricDocument>('Metric', MetricSchema)

export default MetricModel