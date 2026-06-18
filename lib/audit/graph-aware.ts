/**
 * Knowledge Graph query helpers.
 * Used by agents to make graph-informed decisions.
 */

import { createAdminClient } from '../supabase/admin'

interface KnowledgeNode {
  id: string
  node_type: string
  name: string
  description: string | null
  importance_score: number | null
  is_protected: boolean
}

interface KnowledgeEdge {
  id: string
  relationship: string
  strength: number | null
  source_node: KnowledgeNode
  target_node: KnowledgeNode
}

/**
 * Find nodes matching a name or description pattern.
 */
export async function findNodes(query: string, nodeType?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  let q = admin
    .from('knowledge_nodes')
    .select('*')
    .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(10)

  if (nodeType) q = q.eq('node_type', nodeType)
  const { data } = await q
  return (data ?? []) as KnowledgeNode[]
}

/**
 * Get all edges for a node (both directions), with connected nodes.
 */
export async function getNodeEdges(nodeId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const [{ data: outgoing }, { data: incoming }] = await Promise.all([
    admin
      .from('knowledge_edges')
      .select('id, relationship, strength, target_node_id')
      .eq('source_node_id', nodeId),
    admin
      .from('knowledge_edges')
      .select('id, relationship, strength, source_node_id')
      .eq('target_node_id', nodeId),
  ])

  return { outgoing: outgoing ?? [], incoming: incoming ?? [] }
}

/**
 * Check if a set of files touches any protected nodes.
 * Returns risk assessment for proposed changes.
 */
export async function getRiskZones(files: string[]): Promise<{
  protected_nodes: string[]
  at_risk_metrics: string[]
  safe: boolean
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Find codebase_area nodes matching any of the files
  const patterns = files.map(f => `%${f.split('/').pop()}%`)
  const { data: matchedNodes } = await admin
    .from('knowledge_nodes')
    .select('id, name, is_protected')
    .eq('node_type', 'codebase_area')
    .or(patterns.map(p => `name.ilike.${p}`).join(','))

  const protectedNodes = (matchedNodes ?? []).filter((n: KnowledgeNode) => n.is_protected)

  // Find metrics connected to these nodes
  const nodeIds = (matchedNodes ?? []).map((n: KnowledgeNode) => n.id)
  let atRiskMetrics: string[] = []

  if (nodeIds.length > 0) {
    const { data: edges } = await admin
      .from('knowledge_edges')
      .select('target_node_id')
      .in('source_node_id', nodeIds)
      .eq('relationship', 'affects')

    if (edges && edges.length > 0) {
      const targetIds = edges.map((e: { target_node_id: string }) => e.target_node_id)
      const { data: metrics } = await admin
        .from('knowledge_nodes')
        .select('name')
        .in('id', targetIds)
        .eq('node_type', 'metric')

      atRiskMetrics = (metrics ?? []).map((m: { name: string }) => m.name)
    }
  }

  return {
    protected_nodes: protectedNodes.map((n: KnowledgeNode) => n.name),
    at_risk_metrics: atRiskMetrics,
    safe: protectedNodes.length === 0,
  }
}

/**
 * Get graph context for a finding — what business goals does it affect?
 */
export async function getGraphContextForFinding(finding: {
  title: string
  location?: string | null
  agent_type: string
}): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Search for relevant nodes by title keywords and location
  const searchTerms = [
    finding.title,
    finding.location?.split('/').pop()?.split(':')[0],
    finding.agent_type,
  ].filter(Boolean)

  const nodes: KnowledgeNode[] = []
  for (const term of searchTerms) {
    const { data } = await admin
      .from('knowledge_nodes')
      .select('id, node_type, name, importance_score, is_protected')
      .or(`name.ilike.%${term}%,description.ilike.%${term}%`)
      .limit(5)

    if (data) nodes.push(...data)
  }

  if (nodes.length === 0) return ''

  // Deduplicate
  const uniqueNodes = [...new Map(nodes.map(n => [n.id, n])).values()]

  // Get edges from these nodes to business goals
  const nodeIds = uniqueNodes.map(n => n.id)
  const { data: edges } = await admin
    .from('knowledge_edges')
    .select('relationship, strength, target_node_id')
    .in('source_node_id', nodeIds)
    .in('relationship', ['affects', 'blocks', 'monetizes'])

  if (!edges || edges.length === 0) {
    return `Touches: ${uniqueNodes.map(n => n.name).join(', ')}`
  }

  const targetIds = edges.map((e: { target_node_id: string }) => e.target_node_id)
  const { data: targets } = await admin
    .from('knowledge_nodes')
    .select('id, name, node_type')
    .in('id', targetIds)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const targetMap = new Map<string, any>((targets ?? []).map((t: KnowledgeNode) => [t.id, t]))

  const connections = edges
    .map((e: { relationship: string; target_node_id: string; strength: number | null }) => {
      const target = targetMap.get(e.target_node_id)
      return target ? `${e.relationship} ${target.name}` : null
    })
    .filter(Boolean)
    .slice(0, 5)

  const protectedWarning = uniqueNodes.some(n => n.is_protected)
    ? ' [PROTECTED ZONE]'
    : ''

  return `Touches: ${uniqueNodes.map(n => n.name).join(', ')} | ${connections.join(', ')}${protectedWarning}`
}

/**
 * Upsert a node (create if not exists, update last_referenced_at if exists).
 */
export async function upsertNode(
  nodeType: string,
  name: string,
  description?: string,
  importanceScore?: number,
  isProtected?: boolean,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  await admin
    .from('knowledge_nodes')
    .upsert({
      node_type: nodeType,
      name,
      description,
      importance_score: importanceScore,
      is_protected: isProtected ?? false,
      last_referenced_at: new Date().toISOString(),
    }, { onConflict: 'node_type,name' })
}

/**
 * Upsert an edge (create if not exists, increment evidence_count if exists).
 */
export async function upsertEdge(
  sourceNodeType: string,
  sourceName: string,
  targetNodeType: string,
  targetName: string,
  relationship: string,
  strength: number = 0.5,
  provenance?: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Get or create source and target nodes
  const { data: srcNode } = await admin
    .from('knowledge_nodes')
    .select('id')
    .eq('node_type', sourceNodeType)
    .eq('name', sourceName)
    .maybeSingle()

  const { data: tgtNode } = await admin
    .from('knowledge_nodes')
    .select('id')
    .eq('node_type', targetNodeType)
    .eq('name', targetName)
    .maybeSingle()

  if (!srcNode || !tgtNode) return

  // Check existing edge
  const { data: existing } = await admin
    .from('knowledge_edges')
    .select('id, evidence_count')
    .eq('source_node_id', srcNode.id)
    .eq('target_node_id', tgtNode.id)
    .eq('relationship', relationship)
    .maybeSingle()

  if (existing) {
    await admin
      .from('knowledge_edges')
      .update({
        evidence_count: existing.evidence_count + 1,
        strength: Math.min(1, strength + 0.05),
        last_confirmed_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    await admin
      .from('knowledge_edges')
      .insert({
        source_node_id: srcNode.id,
        target_node_id: tgtNode.id,
        relationship,
        strength,
        provenance,
      })
  }
}

/**
 * Get active founder profile insights.
 */
export async function getFounderInsights(): Promise<Array<{ insight_type: string; insight_text: string; confidence: number }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data } = await admin
    .from('founder_profile')
    .select('insight_type, insight_text, confidence')
    .eq('is_active', true)
    .order('confidence', { ascending: false })
    .limit(10)

  return data ?? []
}
