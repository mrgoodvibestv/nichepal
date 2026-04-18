'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'

export default function DashboardShell({
  credits,
  children,
}: {
  credits: number
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        {/* Left: hamburger */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-gray-100 transition"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Center: logo */}
        <span className="absolute left-1/2 -translate-x-1/2 text-lg font-bold tracking-tight">
          <span className="text-black">Niche</span>
          <span className="bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent">
            Pal
          </span>
        </span>

        {/* Right: credits badge */}
        <span className="text-xs text-[#4B6BF5] font-medium">{credits} credits</span>
      </div>

      <Sidebar
        credits={credits}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 overflow-y-auto bg-white pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  )
}
