import { NextRequest, NextResponse } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { generateStoragePath, createSignedUploadUrl } from '@/lib/admin/video-library/upload'

// POST /api/admin/video-library/upload — get signed URL for direct upload
export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const { filename } = await req.json()
    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ data: null, error: 'filename required' }, { status: 400 })
    }

    const storagePath = generateStoragePath(filename)
    const { signedUrl, path, token } = await createSignedUploadUrl(storagePath)

    return NextResponse.json({
      data: { signedUrl, storagePath: path, token },
      error: null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload URL creation failed'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
})
