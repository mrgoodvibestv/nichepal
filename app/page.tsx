'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const communities = [
  { name: 'Personal Finance', members: '15.2M' },
  { name: 'Entrepreneur', members: '3.1M' },
  { name: 'Startups', members: '1.2M' },
  { name: 'SaaS', members: '280K' },
  { name: 'Indie Filmmakers', members: '340K' },
  { name: 'Small Business', members: '1.8M' },
  { name: 'Marketing', members: '890K' },
  { name: 'Real Estate', members: '2.3M' },
  { name: 'Web Dev', members: '920K' },
  { name: 'Crowdfunding', members: '178K' },
  { name: 'Growth Hacking', members: '255K' },
  { name: 'E-commerce', members: '1.1M' },
  { name: 'Content Marketing', members: '310K' },
  { name: 'Investing', members: '4.4M' },
  { name: 'Indie Hackers', members: '520K' },
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
      <section className="pt-36 pb-10 text-center px-6">
        <div className="max-w-3xl mx-auto">

          {/* FIX 1 — new headline */}
          <h1 className="text-6xl sm:text-7xl font-bold tracking-tight leading-none text-center mb-6">
            <span className="text-black">Reddit communities.</span>
            <br />
            <span className="bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent">
              High-intent leads.
            </span>
          </h1>

          {/* FIX 2 — updated subtext */}
          <p className="text-lg text-gray-500 max-w-lg mx-auto text-center mb-10 leading-relaxed">
            Our AI Agent finds niche subreddits that your customers actively engage in, then gives you the script to join the convo.
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

        {/* FIX 3 — community stat cards ticker */}
        <div
          className="mt-16 overflow-hidden w-full relative"
          style={{
            maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
          }}
        >
          <div
            className="flex gap-3"
            style={{
              display: 'flex',
              width: 'max-content',
              animation: 'ticker 40s linear infinite',
              animationPlayState: isHovered ? 'paused' : 'running',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {[...communities, ...communities].map((community, i) => (
              <div
                key={i}
                className="flex items-center gap-2 shrink-0 bg-white border border-gray-100 rounded-full px-4 py-2 shadow-sm"
              >
                <Image
                  src="/reddit-icon.png"
                  alt="Reddit"
                  width={16}
                  height={16}
                  className="shrink-0"
                />
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  {community.name}
                </span>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {community.members}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer — FIX 4 ── */}
      <footer className="py-4 px-6 text-center">
        <p className="text-sm text-gray-400">A product of Good Vibes AI</p>
      </footer>

    </div>
    </>
  )
}
