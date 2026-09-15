# The Lab + Audit System

Multi-LLM decision system + nightly audit agents. ON STANDBY (lab agent not running).

## Lab Deep Dives
8-phase pipeline in `scripts/lab/phases/`:
1. Intuition → 2. Context → 3. Research → 4. Metric → 5. Council (multi-LLM vote) → 6. Synthesis → 7. Deliverable → 8. Tracking

Council: Claude Sonnet + Opus + Gemini 2.5 Pro. Config: `lib/lab/features-config.json`.
LLM fallback: Claude CLI (Max, $0) → Anthropic API → Gemini free tier.

## Lab Agent (`scripts/lab/lab-agent.ts`)
Windows daemon, polls Supabase 30s for accepted dives. Spawns Claude CLI, creates branch, commits, pushes, PR via `gh`. Status in `lab_agent_status`. **Currently off** — watchdog check gated by `LAB_AGENT_EXPECTED=false`.

## Audit Agents (21 scripts in `scripts/audits/`)
Nightly batch via `scripts/audits/run-nightly.ts`:
- **Daily**: Output Quality, Acquisition, Activation, Technical, Retention, Cold Email, AI Scout, AI Multiplier
- **Sunday**: Strategist + Revenue + Meta-Agent + Strategic Brief
- Each night: 1-2 random personas (`scripts/personas/`)
- Morning brief: `lib/audit/morning-brief.ts` → Discord
- Framework: `lib/audit/agent-runner.ts` (Claude Haiku)
- Data: `audit_findings`, `audit_metric_snapshots`

## Key tables
- `lab_deep_dives` — dive state machine
- `lab_agent_status` — heartbeat
- `audit_findings` — agent findings
- `improvement_backlog` — prioritized backlog from agents
