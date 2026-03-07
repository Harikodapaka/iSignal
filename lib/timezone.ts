// ── Timezone utilities ────────────────────────────────────────────────────────
// All date strings in the DB are YYYY-MM-DD in the USER'S local timezone.
// The server never uses new Date().toISOString() to derive a date — it always
// uses the tz param sent by the client.

/**
 * Get today's date string in a given IANA timezone.
 * e.g. toLocalDateString('Asia/Kolkata') → '2026-03-07'
 * Falls back to UTC if tz is invalid.
 */
export function toLocalDateString(tz?: string | null): string {
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz || 'UTC',
            year: 'numeric', month: '2-digit', day: '2-digit',
        })
        // en-CA locale gives YYYY-MM-DD format natively
        return formatter.format(new Date())
    } catch {
        // Invalid tz string — fall back to UTC
        return new Date().toISOString().split('T')[0]
    }
}

/**
 * Get the last N days as YYYY-MM-DD strings in a given timezone.
 */
export function getLastNDays(n: number, tz?: string | null): string[] {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz || 'UTC',
        year: 'numeric', month: '2-digit', day: '2-digit',
    })
    return Array.from({ length: n }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (n - 1 - i))
        return formatter.format(d)
    })
}

/**
 * Extract and validate a timezone string from a URL search param.
 * Returns null if missing or invalid — callers should fall back to UTC.
 */
export function parseTzParam(searchParams: URLSearchParams): string | null {
    const tz = searchParams.get('tz')
    if (!tz) return null
    try {
        // Validate by attempting to use it
        Intl.DateTimeFormat('en-CA', { timeZone: tz })
        return tz
    } catch {
        return null
    }
}