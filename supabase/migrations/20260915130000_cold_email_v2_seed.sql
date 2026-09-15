-- cold-email-v2 seed: 5-step plain-text sequence with CASL footer
-- ON CONFLICT (name) DO NOTHING for idempotency

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_name_uniq
  ON public.email_templates (name);

-- Step 1 (day 0): question of relevance + who we are + soft CTA, spintax on greeting and CTA
INSERT INTO public.email_templates
  (name, category, subject, body_text, sequence_id, step_number, delay_days, spintax_enabled, max_words, variables)
VALUES (
  'cold-v2-step1',
  'outreach',
  '{{channelName}} clips',
  $body${Hey|Hi|What's up} {{firstName}},

Watched "{{recentVideoTitle}}" — I counted at least 3 moments that would go viral as standalone Shorts or TikToks.

I built Viral Animal, a tool that turns long videos into vertical clips with captions, hooks, and smart zoom in about 2 minutes.

Want me to cut 5 clips from your latest video for free? {Just reply "yes" and I'll get started.|Reply "yes" if you want them.|Say "yes" and I'll send them over.}

{{senderName}}

—
Viral Animal Inc. · 1685 rue Florence, Saint-Cyrille-de-Wendover, QC J1Z 0A6, Canada
You're receiving this because {{channelName}} is publicly listed as a business/creator channel.
Don't want these? Reply "stop" or unsubscribe here: {{unsubscribeLink}}$body$,
  'cold-v2', 1, 0, true, 80,
  '["firstName", "recentVideoTitle", "channelName", "senderName", "unsubscribeLink"]'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- Step 2 (day 3): social proof, no link, offer to send clip on reply
INSERT INTO public.email_templates
  (name, category, subject, body_text, sequence_id, step_number, delay_days, spintax_enabled, max_words, variables)
VALUES (
  'cold-v2-step2',
  'outreach',
  're: {{channelName}} clips',
  $body${{firstName}}, quick follow-up.

We cut clips for {{niche}} creators every week — vertical format, karaoke captions, hook text, smart zoom. The clips usually get 10x the views of a raw upload.

Want to see what yours would look like? Reply and I'll send you a sample clip from your channel.

{{senderName}}

—
Viral Animal Inc. · 1685 rue Florence, Saint-Cyrille-de-Wendover, QC J1Z 0A6, Canada
You're receiving this because {{channelName}} is publicly listed as a business/creator channel.
Don't want these? Reply "stop" or unsubscribe here: {{unsubscribeLink}}$body$,
  'cold-v2', 2, 3, false, 80,
  '["firstName", "niche", "channelName", "senderName", "unsubscribeLink"]'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- Step 3 (day 7): demo link allowed (first and only URL before reply)
INSERT INTO public.email_templates
  (name, category, subject, body_text, sequence_id, step_number, delay_days, spintax_enabled, max_words, variables)
VALUES (
  'cold-v2-step3',
  'outreach',
  're: {{channelName}} clips',
  $body${{firstName}}, here's a 45-second example on a {{niche}} clip so you can see the output:

{{demoVideoUrl}}

Captions, hook, zoom — all automatic. Same thing on your content, 5 clips, free.

Reply "yes" and I'll cut them this week.

{{senderName}}

—
Viral Animal Inc. · 1685 rue Florence, Saint-Cyrille-de-Wendover, QC J1Z 0A6, Canada
You're receiving this because {{channelName}} is publicly listed as a business/creator channel.
Don't want these? Reply "stop" or unsubscribe here: {{unsubscribeLink}}$body$,
  'cold-v2', 3, 7, false, 80,
  '["firstName", "niche", "demoVideoUrl", "channelName", "senderName", "unsubscribeLink"]'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- Step 4 (day 12): give-to-receive, no link
INSERT INTO public.email_templates
  (name, category, subject, body_text, sequence_id, step_number, delay_days, spintax_enabled, max_words, variables)
VALUES (
  'cold-v2-step4',
  'outreach',
  're: {{channelName}} clips',
  $body${{firstName}}, I went ahead and cut a clip from "{{recentVideoTitle}}" — came out pretty clean.

Want me to send it over? No strings, it's yours either way.

{{senderName}}

—
Viral Animal Inc. · 1685 rue Florence, Saint-Cyrille-de-Wendover, QC J1Z 0A6, Canada
You're receiving this because {{channelName}} is publicly listed as a business/creator channel.
Don't want these? Reply "stop" or unsubscribe here: {{unsubscribeLink}}$body$,
  'cold-v2', 4, 12, false, 80,
  '["firstName", "recentVideoTitle", "channelName", "senderName", "unsubscribeLink"]'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- Step 5 (day 20): breakup, explicit "not now" option
INSERT INTO public.email_templates
  (name, category, subject, body_text, sequence_id, step_number, delay_days, spintax_enabled, max_words, variables)
VALUES (
  'cold-v2-step5',
  'outreach',
  're: {{channelName}} clips',
  $body$Last message from me, {{firstName}}.

If clipping isn't on your radar right now, totally fine — reply "not now" and I'll check back in a couple months.

If it is: reply "yes" and I'll send 5 clips from your latest video within 48h.

Either way, good luck with {{channelName}}.

{{senderName}}

—
Viral Animal Inc. · 1685 rue Florence, Saint-Cyrille-de-Wendover, QC J1Z 0A6, Canada
You're receiving this because {{channelName}} is publicly listed as a business/creator channel.
Don't want these? Reply "stop" or unsubscribe here: {{unsubscribeLink}}$body$,
  'cold-v2', 5, 20, false, 80,
  '["firstName", "channelName", "senderName", "unsubscribeLink"]'::jsonb
)
ON CONFLICT (name) DO NOTHING;
