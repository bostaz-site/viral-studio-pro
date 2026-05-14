import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

const BUCKET = 'promo-videos'

/**
 * Generate a unique storage path for a promo video upload.
 */
export function generateStoragePath(filename: string): string {
  const ext = filename.split('.').pop() || 'mp4'
  const id = crypto.randomUUID().slice(0, 12)
  return `originals/${id}.${ext}`
}

/**
 * Create a signed upload URL for direct client-side upload to Supabase Storage.
 */
export async function createSignedUploadUrl(storagePath: string): Promise<{
  signedUrl: string
  path: string
  token: string
}> {
  const admin = createAdminClient()

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`)
  }

  return {
    signedUrl: data.signedUrl,
    path: data.path,
    token: data.token,
  }
}

/**
 * Get a signed download URL for a promo video asset.
 */
export async function getSignedUrl(storagePath: string, expiresIn = 3600): Promise<string> {
  const admin = createAdminClient()

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn)

  if (error || !data) {
    throw new Error(`Failed to create signed URL: ${error?.message}`)
  }

  return data.signedUrl
}

/**
 * Delete a file from the promo-videos bucket.
 */
export async function deleteStorageFile(storagePath: string): Promise<void> {
  const admin = createAdminClient()
  await admin.storage.from(BUCKET).remove([storagePath])
}
