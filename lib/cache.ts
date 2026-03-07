import { connectDB } from './mongodb';
import CacheModel from '@/models/Cache';

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      await connectDB();
      const doc = await CacheModel.findOne({
        key,
        expiresAt: { $gt: new Date() },
      }).lean();
      if (!doc) return null;
      return JSON.parse(doc.value) as T;
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
    try {
      await connectDB();
      await CacheModel.findOneAndUpdate(
        { key },
        {
          value: JSON.stringify(value),
          expiresAt: new Date(Date.now() + ttlSeconds * 1000),
        },
        { upsert: true, new: true }
      );
    } catch {
      // Silently catch cache set errors
    }
  },

  async del(key: string): Promise<void> {
    try {
      await connectDB();
      await CacheModel.deleteOne({ key });
    } catch {
      // Silently catch cache delete errors
    }
  },

  async delPattern(prefix: string): Promise<void> {
    try {
      await connectDB();
      await CacheModel.deleteMany({
        key: {
          $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        },
      });
    } catch {
      // Silently catch cache pattern delete errors
    }
  },

  // ── Metric keys cache ─────────────────────────────────────────────────────
  // Grounds AI alias resolution — avoids a DB query on every unknown token.
  // TTL: 5 min. Invalidated whenever a new metric is created.

  async getMetricKeys(userId: string): Promise<string[] | null> {
    return this.get<string[]>(`metrics:keys:${userId}`);
  },

  async setMetricKeys(userId: string, keys: string[]): Promise<void> {
    await this.set(`metrics:keys:${userId}`, keys, 300);
  },

  async invalidateMetricKeys(userId: string): Promise<void> {
    await this.del(`metrics:keys:${userId}`);
  },

  // ── Rate limiting ─────────────────────────────────────────────────────────
  // Atomic increment via findOneAndUpdate

  async checkRateLimit(
    userId: string,
    action: string,
    max: number,
    windowSeconds = 60
  ): Promise<{ allowed: boolean; remaining: number }> {
    try {
      await connectDB();
      const window = Math.floor(Date.now() / (windowSeconds * 1000));
      const key = `rl:${userId}:${action}:${window}`;

      const doc = await CacheModel.findOneAndUpdate(
        { key },
        {
          $inc: { count: 1 },
          $setOnInsert: {
            value: '0',
            expiresAt: new Date(Date.now() + windowSeconds * 2 * 1000),
          },
        },
        { upsert: true, new: true }
      );

      const count = doc?.count ?? 1;
      return {
        allowed: count <= max,
        remaining: Math.max(0, max - count),
      };
    } catch {
      return { allowed: true, remaining: max }; // fail open
    }
  },
};
