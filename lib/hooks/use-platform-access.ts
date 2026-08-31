'use client'

import { useState, useEffect, useCallback } from 'react'
import { isComingSoonPlatform as baseIsComingSoon, type Platform } from '@/lib/distribution/launch-platforms'

let cachedPreview: Platform[] | null = null

/**
 * Fetches the user's preview-unlocked platforms once per session,
 * then provides `isComingSoon(p)` that accounts for META_PREVIEW_EMAILS.
 *
 * No email is ever exposed — the API only returns a platform list.
 */
export function usePlatformAccess() {
  const [previewPlatforms, setPreviewPlatforms] = useState<Platform[]>(cachedPreview ?? [])

  useEffect(() => {
    if (cachedPreview !== null) return // already fetched this session
    let cancelled = false
    fetch('/api/me/platform-access')
      .then(r => r.ok ? r.json() : { previewPlatforms: [] })
      .then((data: { previewPlatforms?: string[] }) => {
        if (cancelled) return
        const list = (data.previewPlatforms ?? []) as Platform[]
        cachedPreview = list
        setPreviewPlatforms(list)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const isComingSoon = useCallback(
    (p: Platform): boolean => {
      if (previewPlatforms.includes(p)) return false
      return baseIsComingSoon(p)
    },
    [previewPlatforms],
  )

  return { isComingSoon, previewPlatforms }
}
