/**
 * Bootstrap Knowledge Graph — run ONCE to seed initial nodes + edges.
 *
 * Reads CLAUDE.md, package.json, existing findings/clusters, and uses
 * Claude Opus to generate a comprehensive initial graph.
 *
 * Run: npx tsx scripts/knowledge-graph/bootstrap.ts
 */

import { createAdminClient } from '../../lib/supabase/admin'
import { claude } from '../../lib/audit/agent-runner'
import { safeParseClaudeJson, extractClaudeText } from '../../lib/audit/safe-json'
import { readFileSync } from 'fs'
import { join } from 'path'

interface NodeSeed { node_type: string; name: string; description: string; importance: number; is_protected: boolean }
interface EdgeSeed { source_type: string; source_name: string; target_type: string; target_name: string; relationship: string; strength: number }
interface InsightSeed { insight_type: string; insight_text: string; confidence: number; derived_from: string }

export async function bootstrapKnowledgeGraph() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const root = process.cwd()

  console.log('[bootstrap] Reading project context...')

  // Read project context
  let claudeMd = ''
  try { claudeMd = readFileSync(join(root, 'CLAUDE.md'), 'utf8').slice(0, 15000) } catch { /* skip */ }

  let packageJson = ''
  try { packageJson = readFileSync(join(root, 'package.json'), 'utf8').slice(0, 3000) } catch { /* skip */ }

  // Get existing findings for context
  const { data: findings } = await admin
    .from('audit_findings')
    .select('title, agent_type, location, severity')
    .eq('status', 'open')
    .limit(50)

  const { data: clusters } = await admin
    .from('root_cause_clusters')
    .select('cluster_name, root_cause_description, findings_count, estimated_impact')
    .limit(20)

  console.log(`[bootstrap] Context: CLAUDE.md=${claudeMd.length}chars, ${(findings ?? []).length} findings, ${(clusters ?? []).length} clusters`)

  // Ask Claude to generate the graph
  const response = await claude.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `You are building a knowledge graph for a video editing SaaS called Viral Animal.

PROJECT CONTEXT (CLAUDE.md excerpt):
${claudeMd.slice(0, 8000)}

DEPENDENCIES (package.json excerpt):
${packageJson.slice(0, 1500)}

CURRENT AUDIT FINDINGS (${(findings ?? []).length} open):
${(findings ?? []).slice(0, 30).map((f: { title: string; agent_type: string; location: string | null; severity: string }) =>
  `[${f.severity}] ${f.agent_type}: ${f.title} @ ${f.location || 'N/A'}`).join('\n')}

ROOT CAUSE CLUSTERS (${(clusters ?? []).length}):
${(clusters ?? []).map((c: { cluster_name: string; root_cause_description: string; findings_count: number }) =>
  `${c.cluster_name} (${c.findings_count} findings): ${c.root_cause_description}`).join('\n')}

Generate a knowledge graph with:
1. NODES (30-50): features, business_goals, tools, platforms, states, codebase_areas, metrics
2. EDGES (80-150): affects, depends_on, blocks, monetizes, measured_by, implemented_in, protected_by, risks
3. FOUNDER INSIGHTS (5-10): patterns, preferences, strengths based on what the findings reveal

Mark as is_protected=true: payment flows, TikTok review zones, auth flows, AUDIT_MODE areas.

Output JSON only:
{
  "nodes": [{"node_type": "feature", "name": "render_pipeline", "description": "...", "importance": 9, "is_protected": false}],
  "edges": [{"source_type": "feature", "source_name": "render_pipeline", "target_type": "business_goal", "target_name": "activation_rate", "relationship": "affects", "strength": 0.9}],
  "founder_insights": [{"insight_type": "pattern", "insight_text": "...", "confidence": 7, "derived_from": "audit_findings"}]
}`,
    }],
  })

  const text = extractClaudeText(response)
  console.log(`[bootstrap] Claude response: ${text.length} chars`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = safeParseClaudeJson(text, { nodes: [], edges: [] })
  const graph = {
    nodes: (raw.nodes ?? []) as NodeSeed[],
    edges: (raw.edges ?? []) as EdgeSeed[],
    founder_insights: (
      raw.founder_insights ?? raw.founderInsights ?? raw.insights ?? raw.founder_profile ?? raw.profile ?? []
    ) as InsightSeed[],
  }

  // Insert nodes
  let nodesInserted = 0
  for (const node of graph.nodes) {
    try {
      await admin.from('knowledge_nodes').upsert({
        node_type: node.node_type,
        name: node.name,
        description: node.description,
        importance_score: Math.min(10, Math.max(1, node.importance)),
        is_protected: node.is_protected,
      }, { onConflict: 'node_type,name' })
      nodesInserted++
    } catch (err) {
      console.warn(`[bootstrap] Node insert failed "${node.name}":`, err)
    }
  }
  console.log(`[bootstrap] ${nodesInserted}/${graph.nodes.length} nodes inserted`)

  // Insert edges
  let edgesInserted = 0
  for (const edge of graph.edges) {
    try {
      const { data: src } = await admin
        .from('knowledge_nodes')
        .select('id')
        .eq('node_type', edge.source_type)
        .eq('name', edge.source_name)
        .maybeSingle()

      const { data: tgt } = await admin
        .from('knowledge_nodes')
        .select('id')
        .eq('node_type', edge.target_type)
        .eq('name', edge.target_name)
        .maybeSingle()

      if (src && tgt) {
        await admin.from('knowledge_edges').upsert({
          source_node_id: src.id,
          target_node_id: tgt.id,
          relationship: edge.relationship,
          strength: Math.min(1, Math.max(0, edge.strength)),
          provenance: 'bootstrap',
        }, { onConflict: 'source_node_id,target_node_id,relationship' })
        edgesInserted++
      }
    } catch (err) {
      console.warn(`[bootstrap] Edge insert failed:`, err)
    }
  }
  console.log(`[bootstrap] ${edgesInserted}/${graph.edges.length} edges inserted`)

  // Insert founder insights
  let insightsInserted = 0
  for (const insight of graph.founder_insights) {
    try {
      await admin.from('founder_profile').insert({
        insight_type: insight.insight_type,
        insight_text: insight.insight_text,
        confidence: Math.min(10, Math.max(1, insight.confidence)),
        derived_from: insight.derived_from,
      })
      insightsInserted++
    } catch (err) {
      console.warn(`[bootstrap] Insight insert failed:`, err)
    }
  }
  console.log(`[bootstrap] ${insightsInserted}/${graph.founder_insights.length} founder insights inserted`)

  console.log(`[bootstrap] Done. ${nodesInserted} nodes, ${edgesInserted} edges, ${insightsInserted} insights`)
  return { nodes: nodesInserted, edges: edgesInserted, insights: insightsInserted }
}

if (require.main === module) {
  const { config } = require('dotenv')
  config({ path: '.env.local' })

  bootstrapKnowledgeGraph()
    .then((r) => { console.log('[bootstrap] Complete.', r); process.exit(0) })
    .catch((err) => { console.error('[bootstrap] Fatal:', err); process.exit(1) })
}
