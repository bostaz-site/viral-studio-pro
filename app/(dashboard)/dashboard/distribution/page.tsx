import { Suspense } from 'react'
import { DistributionHub } from '@/components/distribution/distribution-hub'

export const metadata = {
  title: 'Distribution Hub — Viral Animal',
  description: 'Manage your social distribution, schedule posts, and track publications.',
}

export default function DistributionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-muted-foreground">Loading distribution...</div>}>
      <DistributionHub />
    </Suspense>
  )
}
