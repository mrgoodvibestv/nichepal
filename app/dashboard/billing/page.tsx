'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type Profile = {
  credits: number
  package: string | null
  subscription_status: string | null
}

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: '$49/mo',
    credits: 50,
    reports: '~16 reports/month',
    priceEnvKey: 'NEXT_PUBLIC_STRIPE_PRICE_STARTER',
  },
  {
    key: 'growth',
    name: 'Growth',
    price: '$99/mo',
    credits: 150,
    reports: '~50 reports/month',
    priceEnvKey: 'NEXT_PUBLIC_STRIPE_PRICE_GROWTH',
    popular: true,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$249/mo',
    credits: 500,
    reports: '~166 reports/month',
    priceEnvKey: 'NEXT_PUBLIC_STRIPE_PRICE_PRO',
  },
]

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

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [loadingId, setLoadingId] = useState<string | null>(null)
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
      <div className="mb-8 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-black">Billing</h1>
      </div>

      {/* Success banner */}
      {banner && (
        <div className="mb-6 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-medium text-green-700">
          {banner}
        </div>
      )}

      {/* Current plan card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
              Current plan
            </p>
            <PlanBadge status={status} pkg={pkg} />
            {status === 'past_due' && (
              <p className="text-xs text-red-500 mt-2">
                Payment failed — please update your billing
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-0.5">Credits remaining</p>
            {loadingProfile ? (
              <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
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
          const priceId = process.env[plan.priceEnvKey] ?? ''
          const isCurrent = pkg === plan.key && isActive

          return (
            <div
              key={plan.key}
              className={`relative bg-white rounded-2xl border p-5 flex flex-col ${
                isCurrent ? 'border-[#4B6BF5]' : 'border-gray-100 shadow-sm'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] text-white text-[10px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap">
                  Most popular
                </span>
              )}
              <div className="mb-3">
                <p className="font-bold text-black text-base">{plan.name}</p>
                <p className="text-lg font-semibold text-black mt-0.5">{plan.price}</p>
              </div>
              <p className="text-sm text-gray-500 mb-0.5">{plan.credits} credits</p>
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
                ) : (
                  <button
                    onClick={() => handleCheckout(priceId, false)}
                    disabled={loadingId === priceId || !priceId}
                    className="w-full rounded-lg py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loadingId === priceId ? 'Loading...' : `Upgrade to ${plan.name}`}
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
            onClick={() =>
              handleCheckout(process.env.NEXT_PUBLIC_STRIPE_PRICE_TOPUP ?? '', true)
            }
            disabled={
              loadingId === process.env.NEXT_PUBLIC_STRIPE_PRICE_TOPUP ||
              !process.env.NEXT_PUBLIC_STRIPE_PRICE_TOPUP
            }
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loadingId === process.env.NEXT_PUBLIC_STRIPE_PRICE_TOPUP
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
