---
name: cold-email-compliance
description: LCAP/CASL compliance checklist before creating any email sequence.
---

# Cold email compliance checklist

Before creating any sequence, verify ALL:

- [ ] Every email has an unsubscribe link (`{{unsubscribeLink}}` or functional equivalent)
- [ ] Footer includes company name + postal address (LCAP requirement)
- [ ] Recipients are from public business/creator channels (tacit consent documentation)
- [ ] Suppression list checked — no previously unsubscribed or blocked contacts
- [ ] Bounce rate on active campaigns < 3% — if above, pause and re-verify list
- [ ] No tracking pixel (open tracking OFF — spam signal)
- [ ] Click tracking OFF on first email, ON only on emails with demo link
- [ ] Stop-on-reply enabled
- [ ] Send window: weekdays only, 8h-16h recipient timezone
- [ ] Volume: ≤ 20/day per mailbox weeks 1-2, ≤ 30/day after
- [ ] Secondary domains only — never send from viralanimal.com
