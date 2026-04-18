'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface DemoResult {
  business_name: string
  subreddits: string[]
  top_thread_title: string
  top_thread_upvotes: number
  top_thread_comments: number
  comment_preview: string
}

const loadingMessages = [
  'Scanning your website...',
  'Finding Reddit communities...',
  'Writing your comment...',
]

const steps = [
  {
    icon: '🔍',
    title: 'Connect your business',
    desc: 'Paste your website URL. NichePal reads your positioning and maps your audience.',
  },
  {
    icon: '📊',
    title: 'Get weekly intelligence',
    desc: 'Every report surfaces the exact Reddit threads your audience is active in, ranked by engagement.',
  },
  {
    icon: '💬',
    title: 'Show up authentically',
    desc: 'Each thread comes with a ready-to-post comment template, written for your voice. No generic scripts.',
  },
]

const plans = [
  {
    key: 'starter',
    name: 'Starter',
    price: '$49',
    credits: 50,
    reports: '~16 reports/month',
    label: 'Upgrade to Starter',
  },
  {
    key: 'growth',
    name: 'Growth',
    price: '$99',
    credits: 150,
    reports: '~50 reports/month',
    label: 'Upgrade to Growth',
    popular: true,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$249',
    credits: 500,
    reports: '~166 reports/month',
    label: 'Upgrade to Pro',
  },
]

const blurredPlaceholders = ['r/xxxxxxxxxx', 'r/xxxxxxxxx', 'r/xxxxxxxxxx']

export default function HomePage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DemoResult | null>(null)
  const [error, setError] = useState('')
  const [msgIndex, setMsgIndex] = useState(0)
  const [cooldown, setCooldown] = useState(0)
  const demoRef = useRef<HTMLElement>(null)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cycle loading messages
  useEffect(() => {
    if (!loading) return
    const id = setInterval(() => setMsgIndex(i => (i + 1) % loadingMessages.length), 1500)
    return () => clearInterval(id)
  }, [loading])

  // Clean up cooldown interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current)
    }
  }, [])

  function startCooldown(seconds: number) {
    setCooldown(seconds)
    cooldownRef.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault()
    if (cooldown > 0 || loading) return
    setError('')
    setResult(null)
    setLoading(true)
    setMsgIndex(0)
    try {
      const res = await fetch('/api/demo/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scan failed')
      setResult(data)
      startCooldown(60)
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't scan that URL. Please try a different one."
      )
    } finally {
      setLoading(false)
    }
  }

  function scrollToDemo() {
    demoRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const scanDisabled = loading || cooldown > 0

  return (
    <div className="min-h-screen bg-white">

      {/* ── 1. Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-black">Niche</span>
            <span className="bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent">
              Pal
            </span>
          </span>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-600 hover:text-black transition">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold text-white rounded-lg px-4 py-2 bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── 2. Hero ── */}
      <section className="pt-32 pb-20 text-center px-6">
        <div className="max-w-3xl mx-auto">
          <span className="border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-500 inline-block mb-6">
            Reddit Intelligence Platform
          </span>

          <h1 className="text-5xl font-bold tracking-tight text-black leading-tight mb-6 text-center">
            Find exactly where your{' '}
            <span className="bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent">
              audience
            </span>{' '}
            is talking.
          </h1>

          <p className="text-xl text-gray-500 max-w-xl mx-auto mb-10 leading-relaxed">
            NichePal reads your site, maps the communities your customers are active in,
            and writes your comment — ready to post.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/signup"
              className="rounded-xl px-6 py-3 font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition"
            >
              Start for free →
            </Link>
            <button
              onClick={scrollToDemo}
              className="rounded-xl px-6 py-3 font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition"
            >
              See how it works
            </button>
          </div>
        </div>
      </section>

      {/* ── 3. Live Demo ── */}
      <section
        ref={demoRef}
        id="demo"
        className="py-20 px-6 bg-gray-50 border-y border-gray-100"
      >
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-black mb-2">See NichePal in action</h2>
            <p className="text-gray-500 text-base">
              Enter your website. We&apos;ll find your Reddit audience.
            </p>
          </div>

          {/* Input row */}
          <form onSubmit={handleScan} className="flex gap-3 mb-4">
            <input
              type="url"
              required
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://yoursite.com"
              disabled={scanDisabled}
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4B6BF5] focus:border-transparent bg-white disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={scanDisabled}
              className="rounded-xl px-5 py-3 font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {cooldown > 0
                ? `Try again in ${cooldown}s`
                : 'Scan →'}
            </button>
          </form>

          {error && (
            <p className="text-sm text-red-500 mb-4 text-center">{error}</p>
          )}

          {/* Loading state */}
          {loading && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
              <p className="text-sm text-gray-400 text-center animate-pulse">
                {loadingMessages[msgIndex]}
              </p>
              <div className="space-y-3 animate-pulse">
                <div className="h-3 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 rounded w-1/3" />
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div
                      key={i}
                      className="h-7 w-24 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 rounded-full"
                    />
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <div className="h-3 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 rounded" />
                  <div className="h-3 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 rounded w-5/6" />
                  <div className="h-3 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 rounded w-4/6" />
                </div>
              </div>
            </div>
          )}

          {/* Result card */}
          {result && !loading && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

              {/* Subreddits */}
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">
                Your Reddit footprint
              </p>
              <p className="text-sm text-gray-600 mb-3">
                We found communities where your audience is active
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {result.subreddits.slice(0, 3).map(sub => (
                  <span
                    key={sub}
                    className="bg-[#4B6BF5]/8 text-[#4B6BF5] border border-[#4B6BF5]/20 rounded-full px-3 py-1 text-sm font-medium"
                  >
                    r/{sub}
                  </span>
                ))}
                {blurredPlaceholders.map((ph, i) => (
                  <span
                    key={i}
                    className="bg-gray-100 rounded-full px-3 py-1 text-sm text-gray-400 select-none"
                    style={{ filter: 'blur(5px)', userSelect: 'none' }}
                  >
                    {ph}
                  </span>
                ))}
              </div>

              <div className="border-t border-gray-100 my-4" />

              {/* Top thread */}
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Top thread this week
              </p>
              <p className="font-medium text-black text-sm">{result.top_thread_title}</p>
              <p className="text-xs text-gray-400 mt-1">
                ▲ {result.top_thread_upvotes.toLocaleString()} · 💬 {result.top_thread_comments} comments
              </p>

              {/* Comment preview */}
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                  Your comment, written for you
                </p>
                <div className="relative bg-gray-50 rounded-xl p-4 border border-gray-200 overflow-hidden" style={{ maxHeight: '5rem' }}>
                  <p className="text-sm text-gray-700 leading-relaxed">{result.comment_preview}</p>
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent" />
                </div>
              </div>

              {/* CTA card */}
              <div className="bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] rounded-xl p-5 text-center mt-4">
                <p className="text-white font-semibold text-base mb-1">See your full report →</p>
                <p className="text-white/70 text-sm mb-3">Sign up free — no card required</p>
                <Link
                  href="/signup"
                  className="inline-block bg-white text-[#4B6BF5] font-semibold rounded-lg px-5 py-2 text-sm hover:bg-white/90 transition"
                >
                  Get started free
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── 4. How it works ── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-black text-center mb-12">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {steps.map(step => (
              <div key={step.title} className="text-center">
                <div className="text-4xl mb-4">{step.icon}</div>
                <h3 className="font-semibold text-black mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Pricing preview ── */}
      <section className="py-20 px-6 bg-gray-50 border-y border-gray-100">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-black mb-2">Simple, transparent pricing</h2>
            <p className="text-gray-500 text-base">Start free. Upgrade when you&apos;re ready.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {plans.map(plan => (
              <div
                key={plan.key}
                className={`bg-white rounded-2xl p-6 flex flex-col ${
                  plan.popular
                    ? 'border-2 border-[#4B6BF5]'
                    : 'border border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-base font-semibold text-black">{plan.name}</p>
                  {plan.popular && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] text-white px-2 py-0.5 rounded-full">
                      Popular
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-black mb-1">
                  {plan.price}<span className="text-sm font-normal text-gray-400">/mo</span>
                </p>
                <p className="text-sm text-gray-500 mb-1">{plan.credits} credits · {plan.reports}</p>
                <p className="text-xs text-gray-400 mb-4">Credits reset monthly</p>
                <div className="mt-auto">
                  <Link
                    href="/signup"
                    className="block w-full rounded-lg py-2.5 text-sm font-semibold text-center text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition"
                  >
                    {plan.label}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Footer ── */}
      <footer className="border-t border-gray-100 py-8 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-3 items-center">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-black">Niche</span>
            <span className="bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent">
              Pal
            </span>
          </span>
          <p className="text-sm text-gray-400 text-center">© 2026 NichePal</p>
          <p className="text-sm text-gray-400 text-right">Part of Good Vibes AI</p>
        </div>
      </footer>

    </div>
  )
}
