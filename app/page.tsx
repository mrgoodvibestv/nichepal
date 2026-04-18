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
        {/* FIX 1: removed max-w-6xl mx-auto — nav spans full width */}
        <div className="px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-black">Niche</span>
            <span className="bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent">
              Pal
            </span>
          </span>
          <div className="flex items-center gap-4">
            {/* FIX 5: hidden on mobile */}
            <Link href="/login" className="hidden sm:inline text-sm text-gray-600 hover:text-black transition">
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

      {/* ── 3. Live Demo ── FIX 2+6: white bg, no border-y, redesigned */}
      <section
        ref={demoRef}
        id="demo"
        className="py-24 px-6 bg-white"
      >
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block mb-4 text-xs font-semibold uppercase tracking-widest bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent">
              Live demo
            </span>
            <h2 className="text-4xl font-bold tracking-tight text-black mb-4">
              Your Reddit audience,{' '}
              <span className="bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent">
                mapped in seconds.
              </span>
            </h2>
            <p className="text-gray-500 text-lg max-w-md mx-auto">
              Paste your URL. We scan Reddit, find your audience, and write your first comment.
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
              className="flex-1 border-2 border-gray-200 rounded-2xl px-5 py-4 text-base focus:outline-none focus:border-[#4B6BF5] focus:ring-0 bg-white shadow-sm disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={scanDisabled}
              className="rounded-2xl px-6 py-4 text-base font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
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

          {/* Result card — gradient border glow wrapper */}
          {result && !loading && (
            <div className="p-[1px] bg-gradient-to-br from-[#4B6BF5]/30 to-[#7B4BF5]/30 rounded-2xl shadow-sm">
              <div className="bg-white rounded-[calc(1rem-1px)] p-6">

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
                  <p className="text-white font-semibold text-base mb-1">Your full report is waiting →</p>
                  <p className="text-white/70 text-sm mb-3">10 free credits. No card required.</p>
                  <Link
                    href="/signup"
                    className="inline-block bg-white text-[#4B6BF5] font-semibold rounded-lg px-5 py-2 text-sm hover:bg-white/90 transition"
                  >
                    Get started free
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* FIX 4: How it works + Pricing sections removed */}

      {/* ── Footer — FIX 2: simplified, no border, no bg ── */}
      <footer className="py-8 px-6 text-center">
        <p className="text-sm text-gray-400">© 2026 NichePal · Part of Good Vibes AI</p>
      </footer>

    </div>
  )
}
