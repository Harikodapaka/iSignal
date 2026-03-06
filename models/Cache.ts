import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ICacheDocument extends Document {
  key: string
  value: string
  count?: number
  expiresAt: Date
}

const CacheSchema = new Schema<ICacheDocument>(
  {
    key:       { type: String, required: true, unique: true },
    value:     { type: String, default: '0' },
    count:     { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
)

// MongoDB auto-deletes expired documents
CacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
CacheSchema.index({ key: 1 }, { unique: true })

const CacheModel: Model<ICacheDocument> =
  mongoose.models.Cache ?? mongoose.model<ICacheDocument>('Cache', CacheSchema)

export default CacheModel
