import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ICacheDocument extends Document {
  key: string
  value: string
  count?: number
  expiresAt: Date
}

const CacheSchema = new Schema<ICacheDocument>(
  {
    key: { type: String, required: true, unique: true }, // unique: true creates the index
    value: { type: String, default: '0' },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
)

// TTL index — MongoDB auto-deletes expired documents
CacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
// Note: no explicit index on { key: 1 } — the unique: true above already creates it

const CacheModel: Model<ICacheDocument> =
  mongoose.models.Cache ?? mongoose.model<ICacheDocument>('Cache', CacheSchema)

export default CacheModel