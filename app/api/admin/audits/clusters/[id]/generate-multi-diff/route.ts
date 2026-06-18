import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

const OWNER = 'bostaz-site'
const REPO = 'viral-studio-pro'

function extractId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/')
  return segments[segments.length - 2]
}

export const POST = withAdmin(async (req: NextRequest) => {
  const id = extractId(req)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // 1. Fetch cluster
  const { data: cluster, error } = await admin
    .from('root_cause_clusters')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !cluster) {
    return errorResponse('Cluster not found', 404)
  }

  // 2. Fetch all findings in this cluster
  const findingIds: string[] = cluster.finding_ids ?? []
  const { data: findings } = await admin
    .from('audit_findings')
    .select('id, title, description, location, suggested_fix, severity')
    .in('id', findingIds)

  if (!findings || findings.length === 0) {
    return errorResponse('No findings found for cluster', 422)
  }

  // 3. Collect all unique file paths from findings
  const allPaths = new Set<string>()
  for (const f of findings) {
    for (const p of parseLocations(f.location, f.suggested_fix)) {
      allPaths.add(p)
    }
  }

  if (allPaths.size === 0) {
    return errorResponse('No file locations found in cluster findings', 422)
  }

  // 4. Fetch file contents (max 8 files to keep token budget reasonable)
  const fileContents: Array<{ path: string; content: string }> = []
  for (const fp of [...allPaths].slice(0, 8)) {
    const content = await fetchFileFromGitHub(fp)
    if (content !== null) {
      fileContents.push({ path: fp, content: content.slice(0, 12000) })
    }
  }

  if (fileContents.length === 0) {
    return errorResponse('Could not fetch any referenced files from GitHub', 422)
  }

  // 5. Ask Claude for multi-file diff
  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16384,
    system: `You are a senior engineer generating EXACT code diffs to fix a ROOT CAUSE affecting multiple findings at once. Output ONLY unified diffs (git diff format). Be MINIMAL. Include proper @@ line markers. For multiple files, output consecutive diff blocks. No explanations.`,
    messages: [{
      role: 'user',
      content: `## Root Cause Cluster

**Name:** ${cluster.cluster_name}
**Description:** ${cluster.root_cause_description}
**Impact:** ${cluster.impact_summary}
**Findings count:** ${findings.length}

## Findings to fix

${findings.map((f: { title: string; description: string; location: string | null; suggested_fix: string | null; severity: string }) =>
  `- [${f.severity.toUpperCase()}] ${f.title}\n  ${f.description}\n  Location: ${f.location ?? 'N/A'}\n  Fix: ${f.suggested_fix ?? 'N/A'}`
).join('\n\n')}

## Current file contents

${fileContents.map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')}

## Instructions

Generate unified diffs for ALL files needed to fix this root cause. Fix ALL findings in one pass. Format per file:
\`\`\`diff
--- a/path/to/file
+++ b/path/to/file
@@ -line,count +line,count @@
 context
-removed
+added
\`\`\``,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  // Parse multi-file diffs
  const diffBlocks = text.match(/```diff\n([\s\S]*?)```/g) ?? [text]
  const diffs: Record<string, string> = {}
  let totalChanges = 0

  for (const block of diffBlocks) {
    const content = block.replace(/```diff\n?/, '').replace(/```$/, '').trim()
    // Extract filename from --- a/path
    const fileMatch = content.match(/^---\s+a\/(.+)$/m)
    const filePath = fileMatch ? fileMatch[1] : `file_${Object.keys(diffs).length}`
    diffs[filePath] = content
    totalChanges += (content.match(/^[+-][^+-]/gm) ?? []).length
  }

  // 6. Save to DB
  await admin
    .from('root_cause_clusters')
    .update({
      proposed_diff_multi_file: diffs,
      diff_generated_at: new Date().toISOString(),
      diff_estimated_total_changes: totalChanges,
      status: 'in_progress',
    })
    .eq('id', id)

  return jsonResponse({
    cluster_id: id,
    diffs,
    total_changes: totalChanges,
    files_analyzed: fileContents.map((f) => f.path),
    findings_addressed: findings.length,
    model: 'claude-sonnet-4-6',
  })
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseLocations(location: string | null, suggestedFix: string | null): string[] {
  const paths: string[] = []
  const combined = `${location ?? ''} ${suggestedFix ?? ''}`

  const fileRegex = /(?:^|\s|[`"'])((?:app|lib|components|scripts|vps|stores|types)\/[\w\-./]+\.\w+)/g
  let match
  while ((match = fileRegex.exec(combined)) !== null) {
    paths.push(match[1])
  }

  const fileLineRegex = /([\w\-./]+\.(?:ts|tsx|js|jsx|css|mjs)):?\d*/g
  while ((match = fileLineRegex.exec(combined)) !== null) {
    const p = match[1]
    if (!paths.includes(p) && p.includes('/')) {
      paths.push(p)
    }
  }

  return [...new Set(paths)]
}

async function fetchFileFromGitHub(filepath: string): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN
  if (!token) return null

  try {
    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filepath}?ref=master`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3.raw',
        },
      },
    )
    if (!res.ok) return null
    return res.text()
  } catch {
    return null
  }
}
