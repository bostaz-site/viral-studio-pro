import { UploadPageClient } from './upload-client'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Upload Your Clip | Viral Animal',
  description:
    'Upload your video and edit it with dynamic subtitles, split-screen layouts, and vertical format optimization. Share directly to TikTok.',
}

export default function UploadPage() {
  return <UploadPageClient />
}
