export function scoreAudienceMatch(size: number | null, targetMin: number, targetMax: number): number {
  const s = size ?? 0
  if (s <= 0) return 5
  if (s >= targetMin && s <= targetMax) return 25
  if (s >= targetMin / 2 && s <= targetMax * 2) return 15
  if (s >= targetMin / 5) return 5
  return 0
}

export function scoreLanguageMatch(videoLang: string | null, influencerLang: string | null): number {
  if (!videoLang || !influencerLang) return 8
  return videoLang.toLowerCase() === influencerLang.toLowerCase() ? 15 : 0
}
