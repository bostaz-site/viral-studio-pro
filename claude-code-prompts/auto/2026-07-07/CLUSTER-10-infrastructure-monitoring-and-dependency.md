# Fix: Infrastructure Monitoring, Dependency Audit, and Audio Processing

## Context
Three findings point to production hygiene gaps: (1) extremely low render job volume with no alerting to detect silent failures (finding 119), (2) a known vulnerable dependency in eslint-config-next blocking clean audit gates (finding 118), and (3) no audio normalization in the clip rendering pipeline (finding 123). These are independent issues but share the root cause of missing operational baselines.

## Task
### Dependency Fix (Finding 118)
1. Run `npm install eslint-config-next@latest` (or `@16.2.9` specifically) to resolve the glob vulnerability.
2. Run `npm audit` and verify 0 high/critical vulnerabilities.
3. Add `npm audit --audit-level=high` as a required CI step (in the CI config file — GitHub Actions, etc.). If it already exists, ensure it's not set to `continue-on-error`.

### Render Job Monitoring (Finding 119)
4. Identify where render jobs are submitted and tracked (search for render queue, job submission, or task processing code).
5. Add a monitoring check: if render jobs completed in the last 24 hours < 1 (or a configurable baseline), trigger an alert (log, webhook, or integration with whatever alerting the team uses).
6. Add a synthetic canary job that submits a minimal test render every 6 hours and verifies completion. This should be a scheduled task (cron job, serverless function, etc.).
7. Add a comment with `// TODO: integrate with PagerDuty/Slack/email alerting` if no alerting infra exists yet.

### Audio Processing (Finding 123)
8. Find the audio processing stage of the clip rendering pipeline (search for ffmpeg commands, audio processing, or render pipeline code).
9. Add the following audio processing steps (likely as ffmpeg filter chain additions):
   - Noise gate to reduce background noise
   - EQ boost in 2-5kHz presence range for voice clarity
   - Loudness normalization to -14 LUFS integrated (TikTok standard)
   - Optional: ambient music bed mixing at -18dB (this may need a separate asset and config, so add as a TODO if complex)
10. Ensure these are configurable (e.g., environment variables or render job options) so they can be toggled per clip.

## Acceptance Criteria
- `npm audit --audit-level=high` passes with 0 findings
- CI pipeline fails on high-severity dependency vulnerabilities
- Alerting fires when render job volume drops below baseline
- Canary job runs on schedule and reports failures
- Rendered clips have normalized audio at -14 LUFS
- Audio processing steps are configurable