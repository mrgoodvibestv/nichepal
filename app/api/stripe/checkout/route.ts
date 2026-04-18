import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { priceId, isTopUp } = await req.json()

    if (!priceId) {
      return NextResponse.json({ error: 'Price ID required' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, stripe_customer_id, subscription_status')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (isTopUp && profile.subscription_status !== 'active') {
      return NextResponse.json(
        { error: 'Top-ups require an active subscription' },
        { status: 400 }
      )
    }

    // Get or create Stripe customer
    let stripeCustomerId: string = profile.stripe_customer_id
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { profileId: profile.id },
      })
      stripeCustomerId = customer.id
      const db = createServiceClient()
      await db
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', profile.id)
    }

    let session: Stripe.Checkout.Session

    if (isTopUp) {
      session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'payment',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing?topup=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing`,
        metadata: { profileId: profile.id, isTopUp: 'true' },
      })
    } else {
      session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing?success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing`,
        metadata: { profileId: profile.id, priceId },
      })
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/checkout]', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
