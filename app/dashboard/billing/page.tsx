'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type Profile = {
  credits: number
  package: string | null
  subscription_status: string | null
}

function PlanBadge({ status, pkg }: { status: string | null; pkg: string | null }) {
  if (status === 'active' && pkg && pkg !== 'free') {
    const label = pkg.charAt(0).toUpperCase() + pkg.slice(1)
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5]">
        {label}
      </span>
    )
  }
  if (status === 'past_due') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white bg-red-500">
        Payment Past Due
      </span>
    )
  }
  if (status === 'canceled') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-gray-600 bg-gray-100">
        Canceled
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-gray-600 bg-gray-100">
      Free Trial
    </span>
  )
}

function BillingContent() {
  const params = useSearchParams()
  const success = params.get('success')
  const topup = params.get('topup')

  // Read env vars with static references so Next.js inlines them at build time
  const STARTER_PRICE = process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER ?? ''
  const GROWTH_PRICE = process.env.NEXT_PUBLIC_STRIPE_PRICE_GROWTH ?? ''
  const PRO_PRICE = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? ''
  const TOPUP_PRICE = process.env.NEXT_PUBLIC_STRIPE_PRICE_TOPUP ?? ''

  const PLANS = [
    {
      key: 'starter',
      name: 'Starter',
      price: '$49/mo',
      credits: 50,
      costPerCredit: '$0.98',
      reports: '~16 reports/month',
      priceId: STARTER_PRICE,
    },
    {
      key: 'growth',
      name: 'Growth',
      price: '$99/mo',
      credits: 150,
      costPerCredit: '$0.66',
      reports: '~50 reports/month',
      priceId: GROWTH_PRICE,
      popular: true,
    },
    {
      key: 'pro',
      name: 'Pro',
      price: '$249/mo',
      credits: 500,
      costPerCredit: '$0.50',
      reports: '~166 reports/month',
      priceId: PRO_PRICE,
    },
  ]

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState('')
  const [banner, setBanner] = useState<string | null>(
    success ? 'Your plan is active! Credits have been added.' :
    topup ? '20 credits added to your account!' :
    null
  )

  useEffect(() => {
    if (banner) {
      const t = setTimeout(() => setBanner(null), 5000)
      return () => clearTimeout(t)
    }
  }, [banner])

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then((data: Profile) => setProfile(data))
      .catch(() => {})
      .finally(() => setLoadingProfile(false))
  }, [])

  async function handlePortal() {
    setError('')
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data: { url?: string; error?: string } = await res.json()
      if (data.error) {
        setError(data.error)
        setPortalLoading(false)
        return
      }
      if (data.url) window.location.href = data.url
    } catch {
      setError('Something went wrong. Please try again.')
      setPortalLoading(false)
    }
  }

  async function handleCheckout(priceId: string, isTopUp: boolean) {
    setError('')
    setLoadingId(priceId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, isTopUp }),
      })
      const data: { url?: string; error?: string } = await res.json()
      if (data.error) {
        setError(data.error)
        setLoadingId(null)
        return
      }
      if (data.url) window.location.href = data.url
    } catch {
      setError('Something went wrong. Please try again.')
      setLoadingId(null)
    }
  }

  const pkg = profile?.package ?? 'free'
  const status = profile?.subscription_status ?? 'free'
  const isActive = status === 'active'

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">Billing</h1>
      </div>

      {/* Success banner */}
      {banner && (
        <div className="mb-6 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-medium text-green-700">
          {banner}
        </div>
      )}

      {/* Current plan card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <PlanBadge status={status} pkg={pkg} />
            {status === 'past_due' && (
              <p className="text-xs text-red-500 mt-1.5">
                Payment failed — please update your billing
              </p>
            )}
          </div>
          <div className="sm:text-right">
            <p className="text-xs text-gray-400 mb-0.5">Credits remaining</p>
            {loadingProfile ? (
              <div className="h-8 w-16 bg-gray-100 rounded animate-pulse sm:ml-auto" />
            ) : (
              <p className="text-3xl font-bold bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent">
                {profile?.credits ?? 0}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Plan upgrade cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {PLANS.map(plan => {
          const isCurrent = pkg === plan.key && isActive

          return (
            <div
              key={plan.key}
              className={`bg-white rounded-2xl p-5 flex flex-col ${
                isCurrent
                  ? 'border-2 border-[#4B6BF5]'
                  : plan.popular
                  ? 'border-2 border-[#7F77DD]'
                  : 'border border-gray-200'
              }`}
            >
              {/* Header row with inline badges */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-black text-base">{plan.name}</p>
                  <p className="text-lg font-semibold text-black mt-0.5">{plan.price}</p>
                </div>
                {plan.popular && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] text-white px-2 py-0.5 rounded-full">
                    Popular
                  </span>
                )}
                {plan.key === 'pro' && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-green-500 text-white px-2 py-0.5 rounded-full">
                    Best value
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-400 mb-1">
                {plan.credits} credits · {plan.costPerCredit}/credit
              </p>
              <p className="text-sm text-gray-500 mb-1">{plan.reports}</p>
              <p className="text-xs text-gray-400 mb-4">Credits reset monthly</p>

              <div className="mt-auto">
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full rounded-lg py-2.5 text-sm font-medium text-gray-400 bg-gray-100 cursor-not-allowed"
                  >
                    Current plan
                  </button>
                ) : isActive ? (
                  // Active subscriber on a different plan — portal handles upgrades/downgrades
                  <button
                    onClick={handlePortal}
                    disabled={portalLoading}
                    className="w-full rounded-lg py-2.5 text-sm font-semibold text-[#4B6BF5] border border-[#4B6BF5] hover:bg-[#4B6BF5]/5 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {portalLoading ? 'Loading...' : 'Manage plan'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleCheckout(plan.priceId, false)}
                    disabled={loadingId === plan.priceId || !plan.priceId}
                    className="w-full rounded-lg py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {!plan.priceId
                      ? 'Unavailable'
                      : loadingId === plan.priceId
                      ? 'Loading...'
                      : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500 mb-4">{error}</p>
      )}

      {/* Top-up section — active subscribers only */}
      {isActive && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-2">
          <h3 className="font-semibold text-black mb-1">Need more credits?</h3>
          <p className="text-sm text-gray-500 mb-1">20 credits · $30 one-time · $1.50 per credit</p>
          <p className="text-xs text-gray-400 mb-4">
            Top-up credits do not reset monthly — they stay until used.
          </p>
          <button
            onClick={() => handleCheckout(TOPUP_PRICE, true)}
            disabled={loadingId === TOPUP_PRICE || !TOPUP_PRICE}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
          >
            {!TOPUP_PRICE
              ? 'Unavailable'
              : loadingId === TOPUP_PRICE
              ? 'Loading...'
              : 'Buy 20 credits — $30'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingContent />
    </Suspense>
  )
}
