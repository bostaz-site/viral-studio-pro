/**
 * Knowledge Graph Enricher — runs DAILY after all agents.
 *
 * For each new finding/cluster from today, identifies touched nodes,
 * creates missing nodes, strengthens or creates edges, and discovers
 * new relationships via Claude semantic analysis.
 *
 * Run: npx tsx scripts/audits/knowledge-graph-enricher.ts
 */

import { createAdminClient } from '../../lib/supabase/admin'
import { claude } from '../../lib/audit/agent-runner'
import { safeParseClaudeJson, extractClaudeText } from '../../lib/audit/safe-json'
import { upsertNode, upsertEdge } from '../../lib/audit/graph-aware'

export async function runKnowledgeGraphEnricher() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // 1. Get today's new findings
  const { data: newFindings } = await admin
    .from('audit_findings')
    .select('id, title, description, location, agent_type, severity')
    .gte('created_at', since)
    .eq('status', 'open')
    .limit(50)

  if (!newFindings || newFindings.length === 0) {
    console.log('[graph-enricher] No new findings today, skipping')
    return
  }

  console.log(`[graph-enricher] Enriching graph with ${newFindings.length} new findings...`)

  // 2. Extract nodes and edges from findings via Claude
  const findingSummaries = newFindings.map((f: { title: string; description: string; location: string | null; agent_type: string }) =>
    `[${f.agent_type}] ${f.title} | ${f.location || 'N/A'} | ${f.description.slice(0, 150)}`
  ).join('\n')

  // Get existing nodes for context
  const { data: existingNodes } = await admin
    .from('knowledge_nodes')
    .select('node_type, name')
    .limit(100)

  const existingList = (existingNodes ?? [])
    .map((n: { node_type: string; name: string }) => `${n.node_type}:${n.name}`)
    .join(', ')

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Given these audit findings and the existing knowledge graph nodes, identify:
1. New nodes to create (features, codebase areas, metrics NOT already in the graph)
2. New edges to create or strengthen between existing nodes

Existing nodes: ${existingList.slice(0, 3000)}

Today's findings:
${findingSummaries}

Output JSON:
{
  "new_nodes": [{"node_type": "codebase_area", "name": "upload-flow", "description": "User upload pipeline", "importance": 7}],
  "new_edges": [{"source_type": "feature", "source_name": "render_pipeline", "target_type": "metric", "target_name": "output_quality_avg", "relationship": "measured_by", "strength": 0.8}],
  "strengthened_edges": [{"source_type": "feature", "source_name": "render_pipeline", "target_type": "business_goal", "target_name": "activation_rate", "relationship": "affects"}]
}

Rules:
- Only create nodes that don't already exist in the list above
- Edges must use valid relationship types: affects, depends_on, blocks, monetizes, measured_by, implemented_in, protected_by, risks, similar_to
- Max 10 new nodes, 20 new edges, 10 strengthened edges`,
    }],
  })

  const text = extractClaudeText(response)
  const enrichment = safeParseClaudeJson<{
    new_nodes: Array<{ node_type: string; name: string; description: string; importance: number }>
    new_edges: Array<{ source_type: string; source_name: string; target_type: string; target_name: string; relationship: string; strength: number }>
    strengthened_edges: Array<{ source_type: string; source_name: string; target_type: string; target_name: string; relationship: string }>
  }>(text, { new_nodes: [], new_edges: [], strengthened_edges: [] })

  // 3. Create new nodes
  let nodesCreated = 0
  for (const node of enrichment.new_nodes ?? []) {
    try {
      await upsertNode(node.node_type, node.name, node.description, node.importance)
      nodesCreated++
    } catch { /* ignore duplicates */ }
  }

  // 4. Create new edges
  let edgesCreated = 0
  for (const edge of enrichment.new_edges ?? []) {
    try {
      await upsertEdge(edge.source_type, edge.source_name, edge.target_type, edge.target_name, edge.relationship, edge.strength, 'enricher')
      edgesCreated++
    } catch { /* ignore */ }
  }

  // 5. Strengthen existing edges
  let edgesStrengthened = 0
  for (const edge of enrichment.strengthened_edges ?? []) {
    try {
      await upsertEdge(edge.source_type, edge.source_name, edge.target_type, edge.target_name, edge.relationship, 0.6, 'enricher-strengthen')
      edgesStrengthened++
    } catch { /* ignore */ }
  }

  console.log(`[graph-enricher] Done. +${nodesCreated} nodes, +${edgesCreated} edges, ${edgesStrengthened} strengthened`)
  return { nodesCreated, edgesCreated, edgesStrengthened }
}

if (require.main === module) {
  const { config } = require('dotenv')
  config({ path: '.env.local' })

  runKnowledgeGraphEnricher()
    .then((r) => { console.log('[graph-enricher] Complete.', r); process.exit(0) })
    .catch((err) => { console.error('[graph-enricher] Fatal:', err); process.exit(1) })
}
