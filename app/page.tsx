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

const loadingMessages = ['Scanning...', 'Finding communities...', 'Almost ready...']

const features = [
  {
    icon: '🔍',
    title: 'Reddit community discovery',
    desc: 'Automatically surface the subreddits your customers live in — no manual searching required.',
  },
  {
    icon: '✍️',
    title: 'AI comment templates, ready to post',
    desc: 'Every thread comes with an authentic comment written for your voice. Copy, adapt, post.',
  },
  {
    icon: '📈',
    title: 'Engagement intelligence',
    desc: 'Threads scored by upvotes, comment velocity, and relevance to your business — so you always know where to show up first.',
  },
]

const starterFeatures = [
  'Weekly intelligence report',
  '12 target communities',
  '15 threads per report',
  'AI comment templates',
]

const growthFeatures = [
  'Weekly intelligence report',
  '20+ target communities',
  '30+ threads with priority scoring',
  'AI comment templates',
  'Weekly strategy note',
]

export default function HomePage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DemoResult | null>(null)
  const [error, setError] = useState('')
  const [msgIndex, setMsgIndex] = useState(0)
  const demoRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!loading) return
    const id = setInterval(() => setMsgIndex(i => (i + 1) % loadingMessages.length), 1500)
    return () => clearInterval(id)
  }, [loading])

  async function handleScan(e: React.FormEvent) {
    e.preventDefault()
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Scan failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function scrollToDemo() {
    demoRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-lg font-bold">
            <span className="text-black">Niche</span>
            <span className="bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent">
              Pal
            </span>
          </span>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-800 transition">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] rounded-lg px-4 py-2 hover:opacity-90 transition"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 text-center px-6">
        <div className="max-w-4xl mx-auto">
          {/* Eyebrow */}
          <div className="inline-flex mb-6">
            <span className="text-xs font-medium px-3 py-1 rounded-full text-[#4B6BF5] bg-[#4B6BF5]/8 border border-[#4B6BF5]/25">
              Reddit Intelligence Platform
            </span>
          </div>

          <h1 className="text-5xl font-bold tracking-tight text-black mb-6 leading-tight">
            Find exactly where your{' '}
            <span className="bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent">
              customers
            </span>{' '}
            are talking.
          </h1>

          <p className="text-xl text-gray-500 max-w-xl mx-auto mb-10">
            NichePal scans Reddit in real time, surfaces the threads your audience is active in,
            and writes your comment for you. One click.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/signup"
              className="rounded-lg px-6 py-3 font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition"
            >
              Start for free →
            </Link>
            <button
              onClick={scrollToDemo}
              className="rounded-lg px-6 py-3 font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition"
            >
              See how it works
            </button>
          </div>
        </div>
      </section>

      {/* ── Live Demo ── */}
      <section ref={demoRef} className="py-20 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-black mb-3">See it work on your site</h2>
            <p className="text-gray-500">
              Enter your URL and get a preview of your Reddit footprint in seconds.
            </p>
          </div>

          <form onSubmit={handleScan} className="flex gap-3 mb-8">
            <input
              type="url"
              required
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://yoursite.com"
              className="flex-1 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4B6BF5] focus:border-transparent bg-white"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg px-5 py-3 font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition disabled:opacity-60 whitespace-nowrap"
            >
              {loading ? loadingMessages[msgIndex] : 'Scan my site →'}
            </button>
          </form>

          {error && <p className="text-sm text-red-500 mb-4 text-center">{error}</p>}

          {/* Shimmer skeleton */}
          {loading && !result && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4 animate-pulse">
              <div className="h-4 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 rounded w-1/3" />
              <div className="h-3 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 rounded w-2/3" />
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: 6 }).map((_, i) => (
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
          )}

          {/* Result card */}
          {result && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
              {/* Header */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🎯</span>
                  <h3 className="font-semibold text-black">Your Reddit Footprint</h3>
                </div>
                <p className="text-sm text-gray-500">
                  We found {result.subreddits.length} communities where your audience is active
                </p>
              </div>

              {/* Subreddit pills — 3 clear, 3 blurred */}
              <div className="flex flex-wrap gap-2 mb-6">
                {result.subreddits.slice(0, 3).map(sub => (
                  <span
                    key={sub}
                    className="text-sm font-medium px-3 py-1 rounded-full bg-[#4B6BF5]/8 text-[#4B6BF5] border border-[#4B6BF5]/20"
                  >
                    r/{sub}
                  </span>
                ))}
                {result.subreddits.slice(3).map((sub, i) => (
                  <span
                    key={i}
                    className="text-sm font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-400 select-none"
                    style={{ filter: 'blur(4px)', userSelect: 'none' }}
                  >
                    r/{sub}
                  </span>
                ))}
              </div>

              {/* Top thread */}
              <div className="border-t border-gray-100 pt-5 mb-5">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                  Top thread this week
                </p>
                <p className="font-medium text-black mb-2">{result.top_thread_title}</p>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>▲ {result.top_thread_upvotes.toLocaleString()} upvotes</span>
                  <span>💬 {result.top_thread_comments} comments</span>
                </div>
              </div>

              {/* Comment preview with fade */}
              <div className="border-t border-gray-100 pt-5 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span>💬</span>
                  <p className="text-sm font-medium text-black">Your comment, written for you:</p>
                </div>
                <div className="relative overflow-hidden" style={{ maxHeight: '3.5rem' }}>
                  <p className="text-sm text-gray-600 leading-relaxed">{result.comment_preview}</p>
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
                </div>
              </div>

              {/* CTA */}
              <div className="bg-gradient-to-r from-[#4B6BF5]/5 to-[#7B4BF5]/5 border border-[#4B6BF5]/20 rounded-xl p-4 text-center">
                <Link
                  href="/signup"
                  className="block w-full rounded-lg py-3 font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition mb-2"
                >
                  See your full report →
                </Link>
                <p className="text-xs text-gray-400">Sign up free — no card needed</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-black mb-3">
              Everything you need to win on Reddit
            </h2>
            <p className="text-gray-500">
              Built for founders, marketers, and operators who want genuine community traction.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map(f => (
              <div key={f.title} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-black mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-black mb-3">Simple, transparent pricing</h2>
            <p className="text-gray-500">No surprises. Cancel anytime.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Starter */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-7">
              <p className="text-sm font-medium text-gray-500 mb-1">Starter</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-black">$99</span>
                <span className="text-gray-400 text-sm">/mo</span>
              </div>
              <ul className="space-y-3 mb-7">
                {starterFeatures.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-[#4B6BF5] font-bold">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block text-center rounded-lg py-3 font-semibold text-[#4B6BF5] border border-[#4B6BF5]/40 hover:bg-[#4B6BF5]/5 transition"
              >
                Get started →
              </Link>
            </div>

            {/* Growth — gradient ring */}
            <div className="bg-gradient-to-br from-[#4B6BF5] to-[#7B4BF5] rounded-2xl p-[2px] shadow-sm">
              <div className="bg-white rounded-[calc(1rem-2px)] p-7 h-full">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-500">Growth</p>
                  <span className="text-xs font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] px-2 py-0.5 rounded-full">
                    Popular
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-black">$149</span>
                  <span className="text-gray-400 text-sm">/mo</span>
                </div>
                <ul className="space-y-3 mb-7">
                  {growthFeatures.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-[#7B4BF5] font-bold">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className="block text-center rounded-lg py-3 font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition"
                >
                  Get started →
                </Link>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-gray-400 mt-6">
            Cancel anytime. No contracts.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 px-6 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-bold text-lg">
            <span className="text-black">Niche</span>
            <span className="bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent">
              Pal
            </span>
          </span>
          <p className="text-sm text-gray-400">© 2026 NichePal. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-sm text-gray-400 hover:text-gray-600 transition">
              Sign in
            </Link>
            <Link href="/signup" className="text-sm text-gray-400 hover:text-gray-600 transition">
              Get started
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
