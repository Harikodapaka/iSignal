/**
 * Run once to seed global system aliases into MongoDB.
 * Usage: npx tsx scripts/seed-aliases.ts
 */

import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI!
if (!MONGODB_URI) throw new Error('MONGODB_URI not set')

const AliasSchema = new mongoose.Schema({
  rawKey:       String,
  canonicalKey: String,
  userId:       { type: String, default: null },
  createdBy:    String,
  confidence:   Number,
  usageCount:   { type: Number, default: 0 },
})

const Alias = mongoose.models.Alias ?? mongoose.model('Alias', AliasSchema)

const SYSTEM_ALIASES = [
  // Sleep
  { rawKey: 'slept',        canonicalKey: 'sleep' },
  { rawKey: 'sleeping',     canonicalKey: 'sleep' },
  { rawKey: 'hours sleep',  canonicalKey: 'sleep' },
  // Workout
  { rawKey: 'gym',          canonicalKey: 'workout' },
  { rawKey: 'exercise',     canonicalKey: 'workout' },
  { rawKey: 'exercised',    canonicalKey: 'workout' },
  { rawKey: 'worked out',   canonicalKey: 'workout' },
  { rawKey: 'lifted',       canonicalKey: 'workout' },
  { rawKey: 'training',     canonicalKey: 'workout' },
  // Mood
  { rawKey: 'feeling',      canonicalKey: 'mood' },
  { rawKey: 'vibe',         canonicalKey: 'mood' },
  // Water
  { rawKey: 'hydration',    canonicalKey: 'water' },
  { rawKey: 'fluids',       canonicalKey: 'water' },
  // Run
  { rawKey: 'ran',          canonicalKey: 'run' },
  { rawKey: 'running',      canonicalKey: 'run' },
  { rawKey: 'jogged',       canonicalKey: 'run' },
  // Meditation
  { rawKey: 'meditated',    canonicalKey: 'meditation' },
  { rawKey: 'mindfulness',  canonicalKey: 'meditation' },
  // Caffeine
  { rawKey: 'coffee',       canonicalKey: 'caffeine' },
  { rawKey: 'espresso',     canonicalKey: 'caffeine' },
  // Calories
  { rawKey: 'cal',          canonicalKey: 'calories' },
  { rawKey: 'cals',         canonicalKey: 'calories' },
  { rawKey: 'kcal',         canonicalKey: 'calories' },
  // Stress
  { rawKey: 'anxiety',      canonicalKey: 'stress' },
  { rawKey: 'anxious',      canonicalKey: 'stress' },
  // Steps
  { rawKey: 'walked',       canonicalKey: 'steps' },
  { rawKey: 'walking',      canonicalKey: 'steps' },
  // Weight
  { rawKey: 'bodyweight',   canonicalKey: 'weight' },
  { rawKey: 'weighed',      canonicalKey: 'weight' },
  // Alcohol
  { rawKey: 'drinks',       canonicalKey: 'alcohol' },
  { rawKey: 'drank',        canonicalKey: 'alcohol' },
]

async function seed() {
  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB')

  let created = 0
  for (const alias of SYSTEM_ALIASES) {
    await Alias.findOneAndUpdate(
      { rawKey: alias.rawKey, userId: null },
      { ...alias, createdBy: 'system', confidence: 1.0 },
      { upsert: true }
    )
    created++
  }

  console.log(`✓ Seeded ${created} system aliases`)
  await mongoose.disconnect()
}

seed().catch(console.error)
