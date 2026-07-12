# Fix: Initialize Cold Email Infrastructure

## Context
The cold email outbound pipeline is completely non-functional despite 13 mailboxes being provisioned:
- Instantly API key is missing → no programmatic control
- Zero sending domains configured → any sends would risk blacklisting `viralanimal.com`
- 0 emails sent across all mailboxes in 14 days
- No warm-up sequences, no prospect lists, no campaigns

This is an ops/infrastructure task, not primarily a code fix.

## Requirements
1. **Connect Instantly API**:
   - Retrieve the API key from the Instantly account dashboard
   - Add it to the environment config (`.env` or secrets manager) as `INSTANTLY_API_KEY`
   - Verify the connection returns 200 and mailboxes sync correctly
   - Add a health check that alerts if the Instantly API becomes disconnected

2. **Register sending domains** (do NOT use `viralanimal.com`):
   - Register 2-3 domains: e.g., `getviralanimal.com`, `tryviralanimal.com`, `viralanimalapp.com`
   - For each domain, configure:
     - SPF record: `v=spf1 include:instantly.ai ~all` (or equivalent)
     - DKIM: 2048-bit key
     - DMARC: `v=DMARC1; p=quarantine; rua=mailto:dmarc@viralanimal.com`
   - Attach 2 mailboxes per domain in Instantly

3. **Start warm-up**:
   - Enable Instantly's warm-up feature on all active mailboxes
   - Start at 20 emails/day per mailbox, ramp 20% per day
   - Monitor deliverability scores daily for the first 2 weeks

4. **Prepare first campaign** (within 48 hours of warm-up start):
   - Load a prospect list of 500 content creators/streamers (source from Twitch/YouTube directories)
   - Write a 3-step email sequence
   - Set sending limits: 50 emails/day per mailbox initially

5. **Add monitoring**: If there's a dashboard or admin panel in the codebase, add an integration status page showing Instantly connection status, domain health, and send volume.

## Files likely involved
- `.env` or environment config
- Instantly integration module (if it exists in the codebase)
- Any admin/ops dashboard components
- DNS configuration (external to codebase)

## Acceptance Criteria
- `INSTANTLY_API_KEY` is set and validated
- 2+ sending domains configured with passing SPF/DKIM/DMARC
- Warm-up running on all mailboxes
- First prospect list loaded
- Primary domain `viralanimal.com` is never used for cold sending