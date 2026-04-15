'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface SidebarProps {
  credits: number
  isOpen?: boolean
  onClose?: () => void
}

function NavItem({
  href,
  icon,
  label,
  isActive,
  onClick,
}: {
  href: string
  icon: string
  label: string
  isActive: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={
        isActive
          ? 'bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] rounded-xl text-white px-3 py-2.5 mx-2 flex items-center gap-2 text-sm font-medium'
          : 'text-gray-500 hover:text-black hover:bg-gray-50 rounded-xl px-3 py-2.5 mx-2 flex items-center gap-2 text-sm transition-colors'
      }
    >
      <span className={isActive ? '' : 'opacity-60'}>{icon}</span>
      {label}
    </Link>
  )
}

export default function Sidebar({ credits, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={[
          // layout
          'fixed lg:relative top-0 left-0 h-full lg:h-screen z-50 lg:z-auto',
          'w-64 bg-white border-r border-gray-100 flex flex-col shrink-0',
          // mobile slide animation
          'transition-transform duration-200',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        {/* Logo row */}
        <div className="px-5 py-5 flex items-center justify-between">
          <span className="text-lg font-bold">
            <span className="text-black">Niche</span>
            <span className="bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent">
              Pal
            </span>
          </span>
          {/* X button — mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 transition"
            aria-label="Close menu"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Gradient accent line */}
        <div className="h-px bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5]" />

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-5 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Reddit
          </p>
          <NavItem
            href="/dashboard"
            icon="📊"
            label="Reports"
            isActive={pathname === '/dashboard'}
            onClick={onClose}
          />
          <NavItem
            href="/dashboard/community"
            icon="🔍"
            label="Community Search"
            isActive={pathname === '/dashboard/community'}
            onClick={onClose}
          />

          <p className="px-5 mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Account
          </p>
          <NavItem
            href="/dashboard/settings"
            icon="⚙️"
            label="Settings"
            isActive={pathname === '/dashboard/settings'}
            onClick={onClose}
          />
          <button
            onClick={handleSignOut}
            className="text-gray-500 hover:text-black hover:bg-gray-50 rounded-xl px-3 py-2.5 mx-2 flex items-center gap-2 text-sm transition-colors w-[calc(100%-16px)]"
          >
            <span className="opacity-60">🚪</span>
            Sign Out
          </button>
        </nav>

        {/* Credits badge */}
        <div className="px-5 py-4 border-t border-gray-100">
          <span className="inline-flex items-center text-sm text-[#4B6BF5] bg-[#4B6BF5]/8 rounded-full px-3 py-1 border border-[#4B6BF5]/20 max-w-[160px]">
            <span className="truncate">{credits} credits remaining</span>
          </span>
        </div>
      </div>
    </>
  )
}
