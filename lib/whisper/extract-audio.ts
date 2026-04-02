import { spawn } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Extract audio from a video buffer as MP3 using ffmpeg.
 * Used when the video file exceeds Whisper's 25MB limit.
 * A 33-second video at 26MB becomes ~500KB as 128kbps MP3.
 */
export async function extractAudioFromVideo(
  videoBuffer: Buffer,
  filename: string
): Promise<{ buffer: Buffer; filename: string }> {
  // Resolve ffmpeg path — try @ffmpeg-installer first, then system ffmpeg
  let ffmpegPath = 'ffmpeg'
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const installer = require('@ffmpeg-installer/ffmpeg')
    ffmpegPath = installer.path
  } catch {
    // Fall back to system ffmpeg
  }

  const tempDir = tmpdir()
  const inputPath = join(tempDir, `whisper_input_${Date.now()}_${filename}`)
  const outputPath = join(tempDir, `whisper_output_${Date.now()}.mp3`)

  try {
    // Write video to temp file
    writeFileSync(inputPath, videoBuffer)

    // Extract audio as MP3 128kbps mono (smallest size, sufficient for speech)
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpegPath, [
        '-i', inputPath,
        '-vn',              // No video
        '-ac', '1',         // Mono
        '-ar', '16000',     // 16kHz sample rate (optimal for speech)
        '-ab', '64k',       // 64kbps (plenty for speech recognition)
        '-f', 'mp3',
        '-y',               // Overwrite
        outputPath,
      ])

      let stderr = ''
      proc.stderr.on('data', (data: Buffer) => { stderr += data.toString() })

      proc.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`))
      })

      proc.on('error', (err) => {
        reject(new Error(`ffmpeg not found or failed to start: ${err.message}`))
      })

      // Timeout after 30 seconds
      setTimeout(() => {
        proc.kill('SIGKILL')
        reject(new Error('ffmpeg audio extraction timed out after 30s'))
      }, 30_000)
    })

    // Read the output MP3
    const audioBuffer = Buffer.from(readFileSync(outputPath))
    return { buffer: audioBuffer, filename: 'audio.mp3' }
  } finally {
    // Clean up temp files
    if (existsSync(inputPath)) unlinkSync(inputPath)
    if (existsSync(outputPath)) unlinkSync(outputPath)
  }
}
