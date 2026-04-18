import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  const sig = req.headers.get('stripe-signature')!
  const body = await req.text()

  // Return 400 for bad signatures — these are not retried by Stripe
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Wrap all event handling in try-catch and always return 200.
  // Returning 5xx causes Stripe to retry the webhook, which could
  // double-grant credits on transient DB errors.
  try {
    // ── checkout.session.completed ──────────────────────────────────────────
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const profileId = session.metadata?.profileId
      const isTopUp = session.metadata?.isTopUp === 'true'
      const priceId = session.metadata?.priceId

      if (!profileId) return NextResponse.json({ received: true })

      const db = createServiceClient()

      if (isTopUp) {
        const { data: profileData } = await db
          .from('profiles')
          .select('credits')
          .eq('id', profileId)
          .single()
        const currentCredits: number = profileData?.credits ?? 0
        await db
          .from('profiles')
          .update({ credits: currentCredits + 20 })
          .eq('id', profileId)
        await db.from('credit_transactions').insert({
          profile_id: profileId,
          amount: 20,
          type: 'grant',
          description: 'credit_topup',
        })
      } else {
        const credits =
          priceId === process.env.STRIPE_PRICE_STARTER ? 50 :
          priceId === process.env.STRIPE_PRICE_GROWTH ? 150 :
          priceId === process.env.STRIPE_PRICE_PRO ? 500 : 0

        // Guard: unknown priceId — don't activate with wrong credits
        if (!credits) {
          console.error('[webhook] checkout.session.completed: unknown priceId', priceId)
          return NextResponse.json({ received: true })
        }

        const pkg =
          priceId === process.env.STRIPE_PRICE_STARTER ? 'starter' :
          priceId === process.env.STRIPE_PRICE_GROWTH ? 'growth' : 'pro'

        const subscriptionId = session.subscription as string

        await db
          .from('profiles')
          .update({
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
            package: pkg,
            credits,
          })
          .eq('id', profileId)

        await db.from('credit_transactions').insert({
          profile_id: profileId,
          amount: credits,
          type: 'grant',
          description: `${pkg}_subscription_activated`,
        })
      }
    }

    // ── invoice_payment.paid ─────────────────────────────────────────────────
    // Fires every month on renewal — resets credits to plan amount
    if (event.type === 'invoice_payment.paid') {
      const invoicePayment = event.data.object as Stripe.InvoicePayment

      // Get the invoice ID (may be string or expanded object)
      const invoiceId =
        typeof invoicePayment.invoice === 'string'
          ? invoicePayment.invoice
          : invoicePayment.invoice.id

      // Fetch the parent invoice to check billing_reason
      const invoice = await stripe.invoices.retrieve(invoiceId)

      // Only run on renewal cycles, not first payment
      if (invoice.billing_reason !== 'subscription_cycle') {
        return NextResponse.json({ received: true })
      }

      // In Stripe v22 the subscription lives at parent.subscription_details.subscription
      const subRef =
        invoice.parent?.type === 'subscription_details'
          ? invoice.parent.subscription_details?.subscription ?? null
          : null

      const subscriptionId =
        typeof subRef === 'string' ? subRef : subRef?.id ?? null

      if (!subscriptionId) return NextResponse.json({ received: true })

      const db = createServiceClient()

      const { data: profile } = await db
        .from('profiles')
        .select('id, package')
        .eq('stripe_subscription_id', subscriptionId)
        .single()

      if (!profile) return NextResponse.json({ received: true })

      const credits =
        profile.package === 'starter' ? 50 :
        profile.package === 'growth' ? 150 :
        profile.package === 'pro' ? 500 : 0

      if (!credits) return NextResponse.json({ received: true })

      // RESET credits — set directly, do not add on top
      // Top-up credits are lost on renewal — by design
      await db.from('profiles').update({ credits }).eq('id', profile.id)

      await db.from('credit_transactions').insert({
        profile_id: profile.id,
        amount: credits,
        type: 'grant',
        description: 'monthly_credit_reset',
      })
    }

    // ── customer.subscription.updated ───────────────────────────────────────
    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription
      const db = createServiceClient()

      await db
        .from('profiles')
        .update({
          subscription_status:
            sub.status === 'active' ? 'active' :
            sub.status === 'past_due' ? 'past_due' : 'canceled',
        })
        .eq('stripe_subscription_id', sub.id)
    }

    // ── customer.subscription.deleted ───────────────────────────────────────
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription
      const db = createServiceClient()

      await db
        .from('profiles')
        .update({
          subscription_status: 'canceled',
          stripe_subscription_id: null,
          package: 'starter',
        })
        .eq('stripe_subscription_id', sub.id)
    }
  } catch (err) {
    // Log error but return 200 — prevents Stripe from retrying and
    // potentially double-granting credits on transient failures.
    console.error('[stripe/webhook] event handling error:', event.type, err)
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
