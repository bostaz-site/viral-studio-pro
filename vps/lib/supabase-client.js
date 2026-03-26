import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';

/**
 * Supabase client and utilities for Viral Studio Pro Render API
 */

// ─────────────────────────────────────────────────────────────────────────────
// Client Initialization
// ─────────────────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─────────────────────────────────────────────────────────────────────────────
// Bucket Configuration
// ─────────────────────────────────────────────────────────────────────────────

const BUCKETS = {
  videos: 'videos',     // Source videos
  clips: 'clips',       // Rendered clips
  thumbnails: 'thumbnails',
  assets: 'brand-assets',
};

// ─────────────────────────────────────────────────────────────────────────────
// Download Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Download a file from Supabase Storage
 *
 * @param {string} bucketName - Bucket name (e.g., 'videos', 'clips')
 * @param {string} filePath - Path within the bucket
 * @param {string} localPath - Local file path to save to
 * @returns {Promise<{success: boolean, size: number}>}
 */
export async function downloadFromStorage(bucketName, filePath, localPath) {
  try {
    // Generate signed URL (valid for 10 minutes)
    const { data, error: urlError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 600);

    if (urlError) {
      throw new Error(`Failed to generate signed URL: ${urlError.message}`);
    }

    if (!data?.signedUrl) {
      throw new Error('No signed URL returned from Supabase');
    }

    // Download file
    const response = await fetch(data.signedUrl);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await fs.writeFile(localPath, Buffer.from(buffer));

    console.log(`[Supabase] Downloaded ${filePath} (${buffer.byteLength} bytes)`);

    return { success: true, size: buffer.byteLength };
  } catch (err) {
    console.error(`[Supabase Error] Failed to download ${filePath}:`, err.message);
    throw err;
  }
}

/**
 * Download video source from Storage by storagePath
 */
export async function downloadVideo(storagePath, localPath) {
  return downloadFromStorage(BUCKETS.videos, storagePath, localPath);
}

/**
 * Download b-roll or asset video
 */
export async function downloadAsset(storagePath, localPath) {
  return downloadFromStorage(BUCKETS.assets, storagePath, localPath);
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a file to Supabase Storage
 *
 * @param {string} bucketName - Bucket name
 * @param {string} filePath - Local file path
 * @param {string} storagePath - Destination path in bucket
 * @returns {Promise<{success: boolean, path: string, url: string}>}
 */
export async function uploadToStorage(bucketName, filePath, storagePath) {
  try {
    const fileBuffer = await fs.readFile(filePath);

    // Determine MIME type
    const mimeTypes = {
      '.mp4': 'video/mp4',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    };

    const ext = filePath.toLowerCase().match(/\.[^.]+$/)?.[0] || '.mp4';
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true,
        duplex: 'half',
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    console.log(`[Supabase] Uploaded to ${storagePath} (${fileBuffer.length} bytes)`);

    // Get public URL
    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);

    return {
      success: true,
      path: storagePath,
      url: urlData?.publicUrl,
    };
  } catch (err) {
    console.error(`[Supabase Error] Failed to upload to ${storagePath}:`, err.message);
    throw err;
  }
}

/**
 * Upload rendered clip to Storage
 */
export async function uploadClip(filePath, storagePath) {
  return uploadToStorage(BUCKETS.clips, filePath, storagePath);
}

/**
 * Upload thumbnail to Storage
 */
export async function uploadThumbnail(filePath, storagePath) {
  return uploadToStorage(BUCKETS.thumbnails, filePath, storagePath);
}

// ─────────────────────────────────────────────────────────────────────────────
// Database Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get clip details from database
 */
export async function getClip(clipId) {
  const { data, error } = await supabase
    .from('clips')
    .select(`
      id,
      user_id,
      video_id,
      title,
      start_time,
      end_time,
      duration_seconds,
      storage_path,
      thumbnail_path,
      transcript_segment,
      caption_template,
      aspect_ratio,
      status,
      created_at,
      updated_at,
      videos (
        id,
        storage_path,
        duration_seconds,
        title,
        source_platform
      )
    `)
    .eq('id', clipId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch clip: ${error.message}`);
  }

  return data;
}

/**
 * Get video details from database
 */
export async function getVideo(videoId) {
  const { data, error } = await supabase
    .from('videos')
    .select('id, user_id, storage_path, duration_seconds, title, status')
    .eq('id', videoId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch video: ${error.message}`);
  }

  return data;
}

/**
 * Get user profile including plan
 */
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, plan, monthly_videos_used, monthly_processing_minutes_used')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch profile: ${error.message}`);
  }

  return data;
}

/**
 * Get transcription word timestamps
 */
export async function getTranscription(videoId) {
  const { data, error } = await supabase
    .from('transcriptions')
    .select('id, video_id, full_text, word_timestamps')
    .eq('video_id', videoId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw new Error(`Failed to fetch transcription: ${error.message}`);
  }

  return data;
}

/**
 * Update clip status in database
 */
export async function updateClipStatus(clipId, status, updates = {}) {
  const { error } = await supabase
    .from('clips')
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...updates,
    })
    .eq('id', clipId);

  if (error) {
    throw new Error(`Failed to update clip status: ${error.message}`);
  }

  console.log(`[Supabase] Clip ${clipId} status updated to ${status}`);
}

/**
 * Update clip with render results
 */
export async function updateClipAfterRender(clipId, durationSeconds, storagePath, thumbnailPath = null) {
  const { error } = await supabase
    .from('clips')
    .update({
      status: 'done',
      duration_seconds: durationSeconds,
      storage_path: storagePath,
      thumbnail_path: thumbnailPath,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clipId);

  if (error) {
    throw new Error(`Failed to update clip after render: ${error.message}`);
  }

  console.log(`[Supabase] Clip ${clipId} render completed`);
}

/**
 * Check if all clips for a video are in a terminal state (done or error).
 * If so, update the video status to 'done'.
 * Called after each clip render completes (success or error).
 */
export async function maybeMarkVideoComplete(videoId) {
  try {
    // Fetch all clips for this video
    const { data: clips, error: fetchError } = await supabase
      .from('clips')
      .select('id, status')
      .eq('video_id', videoId);

    if (fetchError || !clips || clips.length === 0) {
      return; // Can't determine — skip
    }

    const allTerminal = clips.every(c => c.status === 'done' || c.status === 'error');
    if (!allTerminal) {
      return; // Still rendering some clips
    }

    // All clips are terminal — mark video as done
    const { error: updateError } = await supabase
      .from('videos')
      .update({
        status: 'done',
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoId)
      .in('status', ['clipping', 'processing']); // Only update if still in a non-terminal state

    if (updateError) {
      console.error(`[Supabase] Failed to mark video ${videoId} as done:`, updateError.message);
      return;
    }

    const doneCount = clips.filter(c => c.status === 'done').length;
    const errorCount = clips.filter(c => c.status === 'error').length;
    console.log(`[Supabase] Video ${videoId} marked as done (${doneCount} rendered, ${errorCount} errored out of ${clips.length})`);
  } catch (err) {
    // Non-critical — log but don't throw
    console.error(`[Supabase] Error checking video completion for ${videoId}:`, err.message);
  }
}

/**
 * Mark clip as error with error message
 */
export async function markClipError(clipId, errorMessage) {
  const { error } = await supabase
    .from('clips')
    .update({
      status: 'error',
      error_message: errorMessage.substring(0, 500), // Truncate long messages
      updated_at: new Date().toISOString(),
    })
    .eq('id', clipId);

  if (error) {
    console.error(`Failed to mark clip as error: ${error.message}`);
    return;
  }

  console.log(`[Supabase] Clip ${clipId} marked as error`);
}

/**
 * Create viral score for clip
 */
export async function createViralScore(clipId, scoreData) {
  const {
    score,
    hook_strength,
    emotional_flow,
    perceived_value,
    trend_alignment,
    hook_type,
    explanation,
    suggested_hooks,
  } = scoreData;

  const { data, error } = await supabase
    .from('viral_scores')
    .insert({
      clip_id: clipId,
      score: score || 0,
      hook_strength: hook_strength || 0,
      emotional_flow: emotional_flow || 0,
      perceived_value: perceived_value || 0,
      trend_alignment: trend_alignment || 0,
      hook_type: hook_type || 'unknown',
      explanation: explanation || '',
      suggested_hooks: suggested_hooks || [],
      created_at: new Date().toISOString(),
    })
    .select();

  if (error) {
    console.error(`Failed to create viral score: ${error.message}`);
    return null;
  }

  return data?.[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand Template Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get user's default brand template
 */
export async function getDefaultBrandTemplate(userId) {
  const { data, error } = await supabase
    .from('brand_templates')
    .select('id, logo_path, watermark_path, intro_video_path, outro_video_path')
    .eq('user_id', userId)
    .eq('is_default', true)
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error(`Failed to fetch brand template: ${error.message}`);
    return null;
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if Supabase connection is working
 */
export async function checkSupabaseHealth() {
  try {
    const { error } = await supabase.from('profiles').select('count', { count: 'exact' }).limit(1);
    if (error) {
      return { connected: false, error: error.message };
    }
    return { connected: true };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Video Record Updates (used by download/import route)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update a video record in the database (used by async import flow)
 */
export async function updateVideoRecord(videoId, updates) {
  const { error } = await supabase
    .from('videos')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoId);

  if (error) {
    console.error(`[Supabase] Failed to update video ${videoId}:`, error.message);
    throw new Error(`Failed to update video record: ${error.message}`);
  }

  console.log(`[Supabase] Video ${videoId} updated:`, Object.keys(updates).join(', '));
}

export { supabase };
