"use client"

import { useEffect } from 'react'
import { track } from '@/lib/analytics'

type EventName =
  | 'page_view'
  | 'changelog_view'
  | 'pricing_view'
  | 'demo_view'

/**
 * Tiny client island that fires a single tracking event on mount.
 * Drop into a server component to measure views without making the whole
 * page client-side.
 *
 *   <PageViewTracker event="changelog_view" />
 */
export function PageViewTracker({ event }: { event: EventName }) {
  useEffect(() => {
    track(event)
  }, [event])
  return null
}
