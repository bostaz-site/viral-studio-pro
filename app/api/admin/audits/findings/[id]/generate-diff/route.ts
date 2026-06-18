import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

const OWNER = 'bostaz-site'
const REPO = 'viral-studio-pro'

function extractId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/')
  // /api/admin/audits/findings/[id]/generate-diff → id is at index -2
  return segments[segments.length - 2]
}

export const POST = withAdmin(async (req: NextRequest) => {
  const id = extractId(req)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // 1. Fetch finding
  const { data: finding, error } = await admin
    .from('audit_findings')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !finding) {
    return errorResponse('Finding not found', 404)
  }

  // 2. Parse location to identify target files
  const filePaths = parseLocations(finding.location, finding.suggested_fix)
  if (filePaths.length === 0) {
    return errorResponse('No file location found in finding — cannot generate diff', 422)
  }

  // 3. Fetch file contents from GitHub
  const fileContents: Array<{ path: string; content: string }> = []
  for (const fp of filePaths.slice(0, 5)) {
    const content = await fetchFileFromGitHub(fp)
    if (content !== null) {
      fileContents.push({ path: fp, content })
    }
  }

  if (fileContents.length === 0) {
    return errorResponse('Could not fetch any referenced files from GitHub', 422)
  }

  // 4. Ask Claude to generate the exact diff
  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: `You are a senior engineer generating EXACT code diffs. Output ONLY a unified diff (git diff format) that fixes the described issue. Be MINIMAL — change only what's needed. Include proper @@ line markers. Do NOT include explanations or prose — ONLY the diff content.`,
    messages: [{
      role: 'user',
      content: `## Finding to fix

**Title:** ${finding.title}
**Description:** ${finding.description}
**Location:** ${finding.location ?? 'N/A'}
**Suggested fix:** ${finding.suggested_fix ?? 'N/A'}
**Severity:** ${finding.severity}

## Current file contents

${fileContents.map((f) => `### ${f.path}\n\`\`\`\n${f.content.slice(0, 15000)}\n\`\`\``).join('\n\n')}

## Instructions

Generate the EXACT unified diff to fix this finding. Format:
\`\`\`diff
--- a/path/to/file
+++ b/path/to/file
@@ -line,count +line,count @@
 context
-removed
+added
 context
\`\`\`

Output ONLY the diff block(s). If multiple files need changes, include all of them.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  // Extract diff from code block or raw text
  const diffMatch = text.match(/```diff\n([\s\S]*?)```/) ?? text.match(/```\n([\s\S]*?)```/)
  const diff = diffMatch ? diffMatch[1].trim() : text.trim()

  // Count lines changed
  const linesChanged = (diff.match(/^[+-][^+-]/gm) ?? []).length

  // 5. Save to DB
  await admin
    .from('audit_findings')
    .update({
      proposed_diff: diff,
      diff_generated_at: new Date().toISOString(),
      diff_model: 'claude-sonnet-4-6',
      diff_estimated_lines_changed: linesChanged,
      auto_fix_status: 'in_progress',
    })
    .eq('id', id)

  return jsonResponse({
    finding_id: id,
    diff,
    lines_changed: linesChanged,
    files_analyzed: fileContents.map((f) => f.path),
    model: 'claude-sonnet-4-6',
  })
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseLocations(location: string | null, suggestedFix: string | null): string[] {
  const paths: string[] = []
  const combined = `${location ?? ''} ${suggestedFix ?? ''}`

  // Match file paths like app/page.tsx, lib/foo/bar.ts, vps/lib/ffmpeg-render.js
  const fileRegex = /(?:^|\s|[`"'])((?:app|lib|components|scripts|vps|stores|types)\/[\w\-./]+\.\w+)/g
  let match
  while ((match = fileRegex.exec(combined)) !== null) {
    paths.push(match[1])
  }

  // Also match "file:line" patterns like "app/page.tsx:42"
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
