import type { DefaultSession } from 'next-auth'

// ── Extend next-auth Session type ──
declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user']
  }
}

// ── Core types ──
export type ValueType = 'boolean' | 'number' | 'text'

export interface IEvent {
  _id?: string
  userId: string
  timestamp: string
  date: string           // YYYY-MM-DD
  rawText: string        // never lose original input
  metricKey: string      // normalized
  value: boolean | number | string
  valueType: ValueType
  unit?: string
  tags?: string[]
  sentiment?: 'positive' | 'negative' | 'neutral'
  note?: string
  createdAt?: string
}

export interface IMetric {
  _id?: string
  userId: string
  metricKey: string
  displayName: string
  valueType: ValueType
  unit?: string
  pinned: boolean
  frequencyScore: number
  createdAt?: string
}

export interface IAlias {
  _id?: string
  rawKey: string
  canonicalKey: string
  userId: string | null    // null = global
  createdBy: 'system' | 'user' | 'ai'
  confidence: number
  usageCount: number
  createdAt?: string
}

export interface IPendingAlias {
  _id?: string
  rawKey: string
  suggestedKey: string
  userId: string
  confidence: number
  status: 'pending' | 'confirmed' | 'rejected'
  createdAt?: string
}

export interface IAnalytics {
  metricKey: string
  displayName: string
  valueType: ValueType
  unit?: string
  // Boolean metrics
  daysCompletedThisWeek?: number
  currentStreak?: number
  monthlyCompletionPct?: number
  // Number metrics
  sevenDayAvg?: number
  monthlyAvg?: number
  trend?: 'up' | 'down' | 'flat'
  trendPct?: number
  // Shared
  last7Days?: { date: string; value: number | boolean | null }[]
  todayValue?: number | boolean | null
}

export interface LogInputParsed {
  metricKey: string
  value: boolean | number | string
  valueType: ValueType
  unit?: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
}
