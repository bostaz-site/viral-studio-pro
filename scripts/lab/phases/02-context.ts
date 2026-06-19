/**
 * Phase 1 — Context Gathering (~5 min)
 *
 * - Read code paths for the feature
 * - Query Knowledge Graph for related nodes
 * - Pull Founder Profile insights
 */

import { findNodes, getFounderInsights } from '../../../lib/audit/graph-aware'
import { updateDive } from '../queue'
import type { FeatureConfig } from '../../../lib/lab/types'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css'])
const MAX_LINES_PER_PATH = 500

function listCodeFiles(dirPath: string, maxFiles = 20): string[] {
  const fullPath = join(process.cwd(), dirPath)
  if (!existsSync(fullPath)) return []

  try {
    const entries = readdirSync(fullPath, { withFileTypes: true })
    const files: string[] = []

    for (const entry of entries) {
      if (files.length >= maxFiles) break
      if (entry.isFile() && CODE_EXTENSIONS.has(extname(entry.name))) {
        files.push(join(dirPath, entry.name))
      }
    }
    return files
  } catch {
    return []
  }
}

function readFileHead(filePath: string, maxLines: number): string {
  const fullPath = join(process.cwd(), filePath)
  if (!existsSync(fullPath)) return ''
  try {
    const content = readFileSync(fullPath, 'utf-8')
    return content.split('\n').slice(0, maxLines).join('\n')
  } catch {
    return ''
  }
}

export async function runContextGathering(
  diveId: string,
  feature: FeatureConfig
) {
  console.log('[lab:context] Gathering context...')

  // Code paths — list files and read key excerpts
  const codeContext: Array<{ path: string; files: string[]; excerpt: string }> = []
  for (const codePath of feature.code_paths) {
    const files = listCodeFiles(codePath)
    // Read first file head as excerpt
    const excerpt = files.length > 0 ? readFileHead(files[0], MAX_LINES_PER_PATH) : ''
    codeContext.push({ path: codePath, files, excerpt: excerpt.slice(0, 3000) })
  }

  // Knowledge Graph nodes related to this feature
  const kgNodes = await findNodes(feature.area)
  const kgFeatureNodes = await findNodes(feature.name)
  const allKgNodes = [...kgNodes, ...kgFeatureNodes]
    .filter((n, i, arr) => arr.findIndex(x => x.id === n.id) === i)
    .slice(0, 10)

  // Founder Profile
  const founderInsights = await getFounderInsights()
  const founderGoals = founderInsights
    .map(i => `[${i.insight_type}] ${i.insight_text} (confidence: ${i.confidence}/10)`)
    .join('\n')

  await updateDive(diveId, {
    context_code_paths: codeContext,
    context_kg_nodes: allKgNodes,
    context_founder_goals: founderGoals || 'No founder profile insights yet.',
    context_completed_at: new Date().toISOString(),
  })

  console.log(`[lab:context] Done. ${codeContext.reduce((s, c) => s + c.files.length, 0)} files, ${allKgNodes.length} KG nodes`)
  return { cost: 0 }
}
