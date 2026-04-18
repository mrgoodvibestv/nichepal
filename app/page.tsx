'use client'

import { useState } from 'react'
import Link from 'next/link'

const audiences = [
  'SaaS Founders', 'Content Creators', 'Independent Filmmakers',
  'E-commerce Operators', 'Real Estate Investors', 'Personal Finance Enthusiasts',
  'Marketing Professionals', 'Web Developers', 'Small Business Owners',
  'Growth Hackers', 'Crowdfunding Campaigners', 'Indie Hackers',
  'Bootstrapped Founders',
]

export default function HomePage() {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <>
    <style>{`
      @keyframes ticker {
        0%   { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
    `}</style>
    <div className="min-h-screen bg-white">

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur">
        <div className="px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-black">Niche</span>
            <span className="bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent">
              Pal
            </span>
          </span>
          <div className="flex items-center gap-4">
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

      {/* ── Hero ── */}
      <section className="pt-36 pb-20 text-center px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-black leading-tight text-center mb-6">
            Stop guessing.<br />
            Start showing up.
          </h1>

          <p className="text-lg text-gray-500 max-w-lg mx-auto text-center mb-10 leading-relaxed">
            Your customers are talking on Reddit right now. NichePal tells you exactly where —
            and writes the comment that gets you in the room.
          </p>

          <Link
            href="/signup"
            className="inline-block rounded-xl px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition"
          >
            Get started free →
          </Link>

          <p className="text-xs text-gray-400 mt-4">
            10 free credits · No card required
          </p>
        </div>

        {/* Audience ticker */}
        <div className="mt-16">
          <p className="text-xs text-gray-400 text-center mb-4 uppercase tracking-widest">
            Built for
          </p>
          <div className="overflow-hidden w-full">
            <div
              className="flex gap-8 whitespace-nowrap"
              style={{
                display: 'flex',
                width: 'max-content',
                animation: 'ticker 30s linear infinite',
                animationPlayState: isHovered ? 'paused' : 'running',
              }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {[...audiences, ...audiences].map((a, i) => (
                <span key={i} className="flex items-center gap-2 shrink-0">
                  <span style={{ color: '#FF4500' }} className="text-xs">●</span>
                  <span className="text-sm text-gray-500">{a}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 px-6 text-center">
        <p className="text-sm text-gray-400">© 2026 NichePal · Part of Good Vibes AI</p>
      </footer>

    </div>
    </>
  )
}
