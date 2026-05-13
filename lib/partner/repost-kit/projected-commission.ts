/**
 * Calculate projected commission for display in the repost kit.
 * Uses conservative estimates.
 */

const AVG_PRICE_CENTS = 2400 // ~$24 avg plan price
const COMMISSION_RATE = 0.30
const CONVERSION_RATE = 0.002 // 0.2% of views → signup

export function projectCommission(audienceSize: number | null): {
  views: number
  signups: number
  monthlyLow: number
  monthlyHigh: number
} {
  const views = audienceSize ?? 5000
  const signups = Math.max(1, Math.round(views * CONVERSION_RATE))
  const perSignup = AVG_PRICE_CENTS * COMMISSION_RATE

  return {
    views,
    signups,
    monthlyLow: Math.round(signups * perSignup * 0.5), // conservative
    monthlyHigh: Math.round(signups * perSignup * 1.5), // optimistic
  }
}
