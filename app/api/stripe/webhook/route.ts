import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { postToDiscord } from '@/lib/discord/post'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder_build')
}

export async function POST(req: NextRequest) {
  // ── Rate limiting (webhook: 100 req/min) ────────────────────────────────
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'stripe-webhook'
  const rl = await rateLimit(clientIp, RATE_LIMITS.webhook.limit, RATE_LIMITS.webhook.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET not configured' }, { status: 500 })
  }
  const PLAN_BY_PRICE: Record<string, string> = {
    [process.env.STRIPE_PRICE_PRO    ?? 'price_pro_placeholder']:    'pro',
    [process.env.STRIPE_PRICE_STUDIO ?? 'price_studio_placeholder']: 'studio',
  }
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  logger.info('[webhook] Inbound Stripe event', { source: 'stripe', timestamp: new Date().toISOString() })

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook error'
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── Idempotency: skip already-processed events ──────────────────────────
  const { data: existingEvent } = await admin
    .from('stripe_events')
    .select('event_id')
    .eq('event_id', event.id)
    .single()

  if (existingEvent) {
    // Already processed — return 200 so Stripe doesn't retry
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const plan = session.metadata?.plan
        const priceAmount = (session.amount_total ?? 0) / 100

        if (userId && plan && (plan === 'pro' || plan === 'studio')) {
          await admin
            .from('profiles')
            .update({
              plan,
              stripe_customer_id: session.customer as string,
              subscription_amount_cents: session.amount_total ?? null,
            } as never)
            .eq('id', userId)

          // Get user email for Discord
          const { data: profile } = await admin
            .from('profiles')
            .select('email')
            .eq('id', userId)
            .single()

          // Discord: new paid user
          postToDiscord({
            channel: 'new-paid',
            embed: {
              title: 'New paid user',
              description: profile?.email ?? userId,
              color: 0x00ff00,
              fields: [
                { name: 'Plan', value: plan.toUpperCase(), inline: true },
                { name: 'Amount', value: `$${priceAmount}/mo`, inline: true },
              ],
            },
          }).catch(() => {})

          // Track affiliate conversion: check if user has a referral
          const { data: referral } = await admin
            .from('referrals')
            .select('id, affiliate_id')
            .eq('user_id', userId)
            .in('status', ['clicked', 'signed_up'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (referral && referral.affiliate_id) {
            const affiliateId = referral.affiliate_id

            // Get affiliate commission rate
            const { data: affiliate } = await admin
              .from('affiliates')
              .select('commission_rate, total_conversions, total_revenue, total_commission_earned')
              .eq('id', affiliateId)
              .single()

            const commissionRate = affiliate?.commission_rate ?? 0.2
            const commission = priceAmount * commissionRate

            // Update referral to converted
            await admin
              .from('referrals')
              .update({
                status: 'converted',
                converted_at: new Date().toISOString(),
                revenue_generated: priceAmount,
                commission_amount: commission,
              })
              .eq('id', referral.id)

            // Update affiliate totals
            if (affiliate) {
              await admin
                .from('affiliates')
                .update({
                  total_conversions: (affiliate.total_conversions ?? 0) + 1,
                  total_revenue: (affiliate.total_revenue ?? 0) + priceAmount,
                  total_commission_earned: (affiliate.total_commission_earned ?? 0) + commission,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', affiliateId)
            }

            // Discord: conversion via affiliate
            postToDiscord({
              channel: 'conversions',
              embed: {
                title: 'Conversion via affiliate',
                color: 0xff6b00,
                fields: [
                  { name: 'User', value: profile?.email ?? userId, inline: true },
                  { name: 'Plan', value: `${plan} ($${priceAmount}/mo)`, inline: true },
                  { name: 'Commission', value: `$${commission.toFixed(2)}`, inline: true },
                ],
              },
            }).catch(() => {})
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.user_id
        if (!userId) break

        const priceId = subscription.items.data[0]?.price.id
        const plan = priceId ? (PLAN_BY_PRICE[priceId] ?? 'free') : 'free'
        const isActive = ['active', 'trialing'].includes(subscription.status)
        const amountCents = subscription.items.data[0]?.price.unit_amount ?? null

        await admin
          .from('profiles')
          .update({
            plan: isActive ? plan : 'free',
            subscription_amount_cents: isActive ? amountCents : null,
          } as never)
          .eq('id', userId)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.user_id
        if (userId) {
          // Get user info before downgrade
          const { data: churnProfile } = await admin
            .from('profiles')
            .select('email, plan')
            .eq('id', userId)
            .single()
          const previousPlan = churnProfile?.plan ?? 'unknown'

          await admin.from('profiles').update({ plan: 'free' }).eq('id', userId)

          // Discord: churn alert
          postToDiscord({
            channel: 'churn-alerts',
            embed: {
              title: 'User cancelled',
              description: churnProfile?.email ?? userId,
              color: 0xff0000,
              fields: [
                { name: 'Was on', value: previousPlan.toUpperCase(), inline: true },
                { name: 'Cancel reason', value: (subscription as unknown as { cancellation_details?: { reason?: string } }).cancellation_details?.reason ?? 'none given', inline: true },
              ],
            },
          }).catch(() => {})
        }
        break
      }

      case 'invoice.payment_failed': {
        const failedInvoice = event.data.object as { customer?: string; attempt_count?: number }
        const failedCustomerId = typeof failedInvoice.customer === 'string' ? failedInvoice.customer : null
        if (failedCustomerId) {
          logger.error(`[Stripe] Payment failed for customer ${failedCustomerId}, attempt ${failedInvoice.attempt_count ?? '?'}`)

          // Discord: payment failed
          postToDiscord({
            channel: 'stripe-events',
            embed: {
              title: 'Payment failed',
              color: 0xff9900,
              fields: [
                { name: 'Customer', value: failedCustomerId, inline: true },
                { name: 'Attempt', value: `#${failedInvoice.attempt_count ?? '?'}`, inline: true },
              ],
            },
          }).catch(() => {})
        }
        break
      }

      default:
        // Unhandled event type — ignore silently
        break
    }

    // ── Record event as processed (idempotency) ─────────────────────────────
    await admin.from('stripe_events').insert({
      event_id: event.id,
      event_type: event.type,
    })

    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Handler error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
