import { describe, it, expect } from 'vitest'

// We test the validateUrl function indirectly through getVideoInfo
// since validateUrl is not exported. We import the module and test
// that invalid URLs are rejected.
describe('yt-dlp URL validation', () => {
  it('rejects non-http URLs', async () => {
    const { getVideoInfo } = await import('@/lib/ytdlp')
    await expect(getVideoInfo('ftp://example.com/video')).rejects.toThrow('seuls les liens http/https')
  })

  it('rejects URLs with shell metacharacters', async () => {
    const { getVideoInfo } = await import('@/lib/ytdlp')
    await expect(getVideoInfo('https://example.com/video;rm -rf /')).rejects.toThrow('caractères non autorisés')
  })

  it('rejects URLs with backticks', async () => {
    const { getVideoInfo } = await import('@/lib/ytdlp')
    await expect(getVideoInfo('https://example.com/`whoami`')).rejects.toThrow('caractères non autorisés')
  })

  it('rejects URLs with double quotes', async () => {
    const { getVideoInfo } = await import('@/lib/ytdlp')
    await expect(getVideoInfo('https://example.com/"test"')).rejects.toThrow('caractères non autorisés')
  })

  it('rejects URLs with dollar signs', async () => {
    const { getVideoInfo } = await import('@/lib/ytdlp')
    await expect(getVideoInfo('https://example.com/$HOME')).rejects.toThrow('caractères non autorisés')
  })

  it('rejects URLs longer than 2048 chars', async () => {
    const { getVideoInfo } = await import('@/lib/ytdlp')
    const longUrl = 'https://example.com/' + 'a'.repeat(2100)
    await expect(getVideoInfo(longUrl)).rejects.toThrow('URL trop longue')
  })

  it('rejects empty string', async () => {
    const { getVideoInfo } = await import('@/lib/ytdlp')
    await expect(getVideoInfo('')).rejects.toThrow('seuls les liens http/https')
  })
})
