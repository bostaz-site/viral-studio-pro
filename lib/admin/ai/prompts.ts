/**
 * Centralized Claude prompts for admin AI triage.
 * All prompts return JSON — parsed by each caller.
 */

export const CLASSIFY_REPLY_PROMPT = `You are an AI assistant for a cold email outreach platform called Viral Animal.

Context: Influencers receive cold emails offering "Free Viral Animal access + 30% recurring affiliate commission for users they refer."

Analyze the email reply below and classify it.

Reply:
"""
{{body}}
"""

Influencer context:
- Name: {{name}}
- Platform: {{platform}}
- Niche: {{niche}}
- Audience: {{audience_size}}

Return ONLY valid JSON:
{
  "sentiment": "positive" | "neutral_question" | "negative" | "spam" | "hostile",
  "confidence": 0.0-1.0,
  "intent": "interested" | "has_question" | "wants_demo" | "maybe_later" | "declined" | "unsubscribe" | "out_of_office" | "spam" | "other",
  "key_phrases": ["phrase1", "phrase2"],
  "suggested_action": "send_drafts" | "manual_response" | "schedule_followup" | "archive" | "block",
  "reasoning": "1 sentence why"
}`

export const LEAD_SCORE_PROMPT = `You are scoring an influencer lead for Viral Animal (viral clip editing tool + affiliate program).

Influencer:
- Name: {{name}}
- Email: {{email}}
- Platform: {{platform}} (handle: {{handle}})
- Niche: {{niche}}
- Audience: {{audience_size}}
- Country: {{country}}, Language: {{language}}
- Current status: {{status}}
- Reply sentiment history: {{sentiment_history}}
- Total emails sent/replied: {{emails_sent}}/{{emails_replied}}

Evaluate ONLY the "sponsorship_likelihood" factor (0-100):
How likely is this influencer to become a paying affiliate based on their profile, niche fit for a gaming/streaming clip tool, and reply history?

Return ONLY valid JSON:
{
  "sponsorship_score": 0-100,
  "reasoning": "1-2 sentences max"
}`

export const DRAFT_REPLIES_PROMPT = `You are drafting reply emails for Viral Animal's outreach team.

Context: We sent a cold email offering "Free Viral Animal access + 30% recurring affiliate commission."

The influencer replied:
"""
{{reply_body}}
"""

Influencer: {{name}} ({{platform}}, {{niche}}, {{audience_size}} followers)
Sentiment: {{sentiment}}

Generate 3 reply drafts. Each should be concise (2-4 sentences), professional but friendly, and feel human (not corporate).

Available template variables (use as-is, they'll be replaced server-side):
- {{first_name}} - their name
- {{signup_link}} - signup URL
- {{calendly}} - booking link

Return ONLY valid JSON:
{
  "drafts": [
    {
      "style": "quick_yes",
      "label": "Quick Yes",
      "subject": "Re: ...",
      "body": "..."
    },
    {
      "style": "detailed",
      "label": "Detailed Response",
      "subject": "Re: ...",
      "body": "..."
    },
    {
      "style": "soft_pitch",
      "label": "Soft Pitch",
      "subject": "Re: ...",
      "body": "..."
    }
  ]
}`

export const THREAD_SUMMARY_PROMPT = `Summarize this email conversation between Viral Animal (outreach) and an influencer.

Messages (chronological):
{{messages}}

Return ONLY valid JSON:
{
  "summary": "2-3 sentence summary of the conversation so far",
  "status": "engaged" | "hesitant" | "declined" | "waiting" | "onboarding",
  "key_points": ["point1", "point2", "point3"],
  "next_action": "1 sentence: the best next step for the outreach team"
}`

/**
 * Replace prompt placeholders with actual values.
 * Uses {{var}} syntax (NOT the same as email template vars).
 */
export function fillPrompt(
  prompt: string,
  vars: Record<string, string | number | undefined>
): string {
  return prompt.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const val = vars[key]
    if (val === undefined || val === null) return ''
    return String(val)
  })
}
