// ── B-roll FFmpeg helpers ─────────────────────────────────────────────────────
//
// Builds FFmpeg filter_complex commands to splice B-roll clips into a main video.
// Strategy: concat approach — split main at insertion points, interleave B-roll segments.
//
// Example (1 insertion at t=10s for 5s):
//   main[0:10] → broll[0:5] → main[15:end]

export interface BrollInsertion {
  /** Path to the B-roll clip file */
  brollPath: string
  /** Timestamp in the MAIN video (seconds) where B-roll replaces footage */
  insertAtTime: number
  /** Duration of B-roll insertion (seconds) */
  duration: number
  /** Keyword that describes what the B-roll shows */
  keyword: string
}

export interface BrollCommandResult {
  command: string
  /** True if there are no insertions (passthrough) */
  passthrough: boolean
}

// ── Build FFmpeg command ───────────────────────────────────────────────────────

export function buildBrollCommand(opts: {
  mainInputPath: string
  outputPath: string
  insertions: BrollInsertion[]
  mainDuration: number
  hasAudio?: boolean
}): BrollCommandResult {
  const { mainInputPath, outputPath, insertions, mainDuration, hasAudio = true } = opts

  if (insertions.length === 0) {
    return { command: '', passthrough: true }
  }

  // Sort insertions by time, validate they don't overlap
  const sorted = [...insertions].sort((a, b) => a.insertAtTime - b.insertAtTime)

  // Build input list: main + each b-roll file
  const inputs: string[] = [`-i "${mainInputPath}"`]
  sorted.forEach((ins) => {
    inputs.push(`-i "${ins.brollPath}"`)
  })

  // Build filter_complex segments
  // Main video index = 0, b-roll files = 1..N
  const vSegments: string[] = []
  const aSegments: string[] = []
  let cursor = 0

  sorted.forEach((ins, i) => {
    const brollIdx = i + 1
    const cutEnd = ins.insertAtTime
    const resumeAt = ins.insertAtTime + ins.duration

    // Main segment before this insertion
    if (cutEnd > cursor) {
      vSegments.push(
        `[0:v]trim=${cursor.toFixed(3)}:${cutEnd.toFixed(3)},setpts=PTS-STARTPTS[vmain${i}]`
      )
      if (hasAudio) {
        aSegments.push(
          `[0:a]atrim=${cursor.toFixed(3)}:${cutEnd.toFixed(3)},asetpts=PTS-STARTPTS[amain${i}]`
        )
      }
    }

    // B-roll segment (reframe to 9:16 to match main)
    vSegments.push(
      `[${brollIdx}:v]trim=0:${ins.duration.toFixed(3)},setpts=PTS-STARTPTS,` +
      `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[vbroll${i}]`
    )
    if (hasAudio) {
      aSegments.push(
        `[${brollIdx}:a]atrim=0:${ins.duration.toFixed(3)},asetpts=PTS-STARTPTS,` +
        `volume=0.3[abroll${i}]`  // B-roll audio at 30% volume (background feel)
      )
    }

    cursor = resumeAt
  })

  // Remaining main video after last insertion
  if (cursor < mainDuration) {
    const tailIdx = sorted.length
    vSegments.push(
      `[0:v]trim=${cursor.toFixed(3)}:${mainDuration.toFixed(3)},setpts=PTS-STARTPTS[vmain${tailIdx}]`
    )
    if (hasAudio) {
      aSegments.push(
        `[0:a]atrim=${cursor.toFixed(3)}:${mainDuration.toFixed(3)},asetpts=PTS-STARTPTS[amain${tailIdx}]`
      )
    }
  }

  // Build concat inputs list
  const vConcat: string[] = []
  const aConcat: string[] = []

  sorted.forEach((_, i) => {
    // check if we had a main segment before this b-roll
    const hadPre = sorted[i].insertAtTime > (i === 0 ? 0 : sorted[i - 1].insertAtTime + sorted[i - 1].duration)
    if (hadPre || i === 0) {
      vConcat.push(`[vmain${i}]`)
      if (hasAudio) aConcat.push(`[amain${i}]`)
    }
    vConcat.push(`[vbroll${i}]`)
    if (hasAudio) aConcat.push(`[abroll${i}]`)
  })

  // Add tail
  const tailIdx = sorted.length
  vConcat.push(`[vmain${tailIdx}]`)
  if (hasAudio) aConcat.push(`[amain${tailIdx}]`)

  const n = vConcat.length
  const concatV = `${vConcat.join('')}concat=n=${n}:v=1:a=0[outv]`
  const concatA = hasAudio
    ? `${aConcat.join('')}concat=n=${n}:v=0:a=1[outa]`
    : null

  const filterLines = [...vSegments, ...aSegments, concatV]
  if (concatA) filterLines.push(concatA)

  const filterComplex = filterLines.join(';\n  ')

  const mapArgs = hasAudio ? '-map [outv] -map [outa]' : '-map [outv]'
  const audioArgs = hasAudio ? '-c:a aac -b:a 128k' : '-an'

  const command = [
    'ffmpeg -y',
    inputs.join(' '),
    `-filter_complex "\n  ${filterComplex}\n"`,
    mapArgs,
    '-c:v libx264 -preset fast -crf 23',
    audioArgs,
    '-movflags +faststart',
    '-pix_fmt yuv420p',
    `"${outputPath}"`,
  ].join(' ')

  return { command, passthrough: false }
}

// ── Generate preview thumbnail command ────────────────────────────────────────

export function buildBrollThumbnailCommand(
  brollPath: string,
  outputPath: string,
  atSecond = 0
): string {
  return `ffmpeg -y -ss ${atSecond} -i "${brollPath}" -vframes 1 -q:v 2 "${outputPath}"`
}
