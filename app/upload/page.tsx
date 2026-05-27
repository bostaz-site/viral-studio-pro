import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UploadPageClient } from './upload-client'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Upload Your Clip | Viral Animal',
  description:
    'Upload your stream highlights and edit them with dynamic subtitles, split-screen layouts, and vertical format optimization. Share directly to TikTok.',
}

export default async function UploadPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Must be logged in to upload
  if (!user) {
    redirect('/login?redirect=/upload')
  }

  return <UploadPageClient />
}
