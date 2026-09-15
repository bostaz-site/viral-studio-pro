# Cold Email Sequence V2 — Viral Animal (2026-09-15)

> Supersedes V1. 5 emails / 20 days. Plain text, no HTML, spintax step 1, demo link step 3 only. Under 80 words each (excluding footer).
> Variables Instantly: {{firstName}} {{channelName}} {{recentVideoTitle}} {{niche}} {{senderName}} {{demoVideoUrl}} {{unsubscribeLink}}
> Offer: 5 clips free this week, zero strings. Objective: reply, not click.
> Primary metric: **positive reply rate** (opens ignored — pixel = spam signal in 2026).

---

## Email 1 — Day 0 · Subject: `{{channelName}} clips`

{Hey|Hi|What's up} {{firstName}},

Watched "{{recentVideoTitle}}" — I counted at least 3 moments that would go viral as standalone Shorts or TikToks.

I built Viral Animal, a tool that turns long videos into vertical clips with captions, hooks, and smart zoom in about 2 minutes.

Want me to cut 5 clips from your latest video for free? {Just reply "yes" and I'll get started.|Reply "yes" if you want them.|Say "yes" and I'll send them over.}

{{senderName}}

---

## Email 2 — Day 3 · Subject: `re: {{channelName}} clips`

{{firstName}}, quick follow-up.

We cut clips for {{niche}} creators every week — vertical format, karaoke captions, hook text, smart zoom. Karaoke captions, hook text, smart zoom — the same format the big clipping accounts use.

Want to see what yours would look like? Reply and I'll send you a sample clip from your channel.

{{senderName}}

---

## Email 3 — Day 7 · Subject: `re: {{channelName}} clips`

{{firstName}}, here's a 45-second example on a {{niche}} clip so you can see the output:

{{demoVideoUrl}}

Captions, hook, zoom — all automatic. Same thing on your content, 5 clips, free.

Reply "yes" and I'll cut them this week.

{{senderName}}

---

## Email 4 — Day 12 · Subject: `re: {{channelName}} clips`

{{firstName}}, send me the link to your last stream and I'll cut one clip tonight and send it back. No strings, it's yours either way.

{{senderName}}

---

## Email 5 — Day 20 · Subject: `re: {{channelName}} clips`

Last message from me, {{firstName}}.

If clipping isn't on your radar right now, totally fine — reply "not now" and I'll check back in a couple months.

If it is: reply "yes" and I'll send 5 clips from your latest video within 48h.

Either way, good luck with {{channelName}}.

{{senderName}}

---

## Footer (all 5 emails — LCAP / CASL required)

```
—
Viral Animal Inc. · 1685 rue Florence, Saint-Cyrille-de-Wendover, QC J1Z 0A6, Canada
You're receiving this because {{channelName}} is publicly listed as a business/creator channel.
Don't want these? Reply "stop" or unsubscribe here: {{unsubscribeLink}}
```

---

## Sending Rules

| Parameter | Value |
|---|---|
| Volume per box | 12/day (max 20), DFY Google boxes only |
| Window | Mon-Fri 08:00-16:00 lead timezone (fallback America/Toronto) |
| Stop sequence | on first reply (stop_on_reply=true, stop_on_auto_reply=false) |
| Bounce max | 1.5% — above: pause campaign + Discord alert |
| Open tracking | OFF everywhere (pixel = spam signal) |
| Click tracking | OFF steps 1,2,4,5; ON step 3 only (demo link) |
| Domains | Secondary .com only, never viralanimal.com, never Zoho |
| Warm-up | Score < 70% → pause box + Discord alert |
| First send | Not before 2026-10-06 (warm-up >= 21 days) |

## Reply Buckets

| Reply | Bucket | Status | Action |
|---|---|---|---|
| "yes" / wants clips | `interested` | interested | auto-onboard (affiliate + portal + demo) |
| question / "how much" | `evaluating` | evaluating | Discord ping, manual reply |
| "not now" / later | `not_now` | dormant | resequence_after = +60 days, removed from Instantly |
| wrong contact / refers someone | `wrong_person` | declined | forwarded contacts stored in notes |
| "stop" / unsubscribe | `unsubscribed` | declined | suppression 4-way + Instantly unsubscribe |
| hard no / hostile | `negative` | declined | — |

## Mailboxes (DFY via Instantly)

8 Google boxes across 4 domains: getviralanimal.com, tryviralanimal.com, viralanimalhq.com, useviralanimal.com.
Zoho boxes (viralanimal.online/.site/.space/.store) = reception only, daily_send_limit=0.
