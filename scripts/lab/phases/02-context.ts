/**
 * Phase 1 — Context Gathering (~5 min)
 *
 * V3: reads docs/<feature>.md as source of truth + additional docs
 * + code paths + Knowledge Graph + Founder Profile + VISION.md + CONCEPT.md
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
  } catch { return [] }
}

function readFileHead(filePath: string, maxLines: number): string {
  const fullPath = join(process.cwd(), filePath)
  if (!existsSync(fullPath)) return ''
  try {
    return readFileSync(fullPath, 'utf-8').split('\n').slice(0, maxLines).join('\n')
  } catch { return '' }
}

function safeReadFile(filePath: string): string {
  const fullPath = join(process.cwd(), filePath)
  if (!existsSync(fullPath)) return ''
  try { return readFileSync(fullPath, 'utf-8') } catch { return '' }
}

export async function runContextGathering(
  diveId: string,
  feature: FeatureConfig
) {
  console.log('[lab:context] Gathering context...')

  // 1. Read main feature doc (Samy's source of truth)
  const mainDoc = safeReadFile(feature.doc_path)
  if (!mainDoc) {
    console.warn(`[lab:context] Feature doc not found: ${feature.doc_path}`)
  }

  // 2. Read additional docs if specified
  const additionalDocs: Array<{ path: string; content: string }> = []
  if (feature.additional_docs) {
    for (const docPath of feature.additional_docs) {
      const content = safeReadFile(docPath)
      if (content) additionalDocs.push({ path: docPath, content })
      else console.warn(`[lab:context] Additional doc not found: ${docPath}`)
    }
  }

  // 3. Read VISION.md + CONCEPT.md
  const visionContent = safeReadFile('docs/VISION.md')
  const conceptContent = safeReadFile('docs/CONCEPT.md')

  // 4. Read lab feature notes (own history from previous cycles)
  const labHistory = safeReadFile(`docs/lab/feature-notes/${feature.area}.md`)

  // 5. Code paths — list files and read key excerpts
  const codeContext: Array<{ path: string; files: string[]; excerpt: string }> = []
  for (const codePath of feature.code_paths) {
    const files = listCodeFiles(codePath)
    const excerpt = files.length > 0 ? readFileHead(files[0], MAX_LINES_PER_PATH) : ''
    codeContext.push({ path: codePath, files, excerpt: excerpt.slice(0, 3000) })
  }

  // 6. Knowledge Graph nodes
  const kgNodes = await findNodes(feature.area)
  const kgFeatureNodes = await findNodes(feature.name)
  const allKgNodes = [...kgNodes, ...kgFeatureNodes]
    .filter((n, i, arr) => arr.findIndex(x => x.id === n.id) === i)
    .slice(0, 10)

  // 7. Founder Profile
  const founderInsights = await getFounderInsights()
  const founderGoals = founderInsights
    .map(i => `[${i.insight_type}] ${i.insight_text} (confidence: ${i.confidence}/10)`)
    .join('\n')

  await updateDive(diveId, {
    context_main_doc: mainDoc || null,
    context_additional_docs: additionalDocs.length > 0 ? additionalDocs : null,
    context_vision: visionContent || null,
    context_concept: conceptContent || null,
    context_lab_history: labHistory || null,
    context_code_paths: codeContext,
    context_kg_nodes: allKgNodes,
    context_founder_goals: founderGoals || 'No founder profile insights yet.',
    context_completed_at: new Date().toISOString(),
  })

  const totalFiles = codeContext.reduce((s, c) => s + c.files.length, 0)
  console.log(`[lab:context] Done. Doc: ${mainDoc ? 'yes' : 'missing'}, ${additionalDocs.length} additional, ${totalFiles} code files, ${allKgNodes.length} KG nodes`)
  return { cost: 0 }
}
