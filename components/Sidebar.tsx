'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface SidebarProps {
  credits: number
  isOpen?: boolean
  onClose?: () => void
}

function ReportsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}

function BillingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14"/>
      <line x1="4" y1="10" x2="4" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12" y2="3"/>
      <line x1="20" y1="21" x2="20" y2="16"/>
      <line x1="20" y1="12" x2="20" y2="3"/>
      <line x1="1" y1="14" x2="7" y2="14"/>
      <line x1="9" y1="8" x2="15" y2="8"/>
      <line x1="17" y1="16" x2="23" y2="16"/>
    </svg>
  )
}

function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

function NavItem({
  href,
  icon,
  label,
  isActive,
  onClick,
}: {
  href: string
  icon: React.ReactNode
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
          ? 'bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] rounded-xl text-white px-4 py-2.5 mx-3 flex items-center gap-3 text-sm font-medium'
          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-xl px-4 py-2.5 mx-3 flex items-center gap-3 text-sm transition-colors cursor-pointer'
      }
    >
      {icon}
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
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={[
          'fixed lg:relative top-0 left-0 h-full lg:h-screen z-50 lg:z-auto',
          'w-64 bg-white border-r border-gray-100 flex flex-col shrink-0',
          'rounded-r-2xl lg:rounded-r-none',
          'transition-transform duration-200',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        {/* Header row — logo + X button (X hidden on desktop) */}
        <div className="flex items-center justify-between px-6 h-14 shrink-0">
          <span className="text-lg lg:text-2xl font-bold tracking-tight">
            <span className="text-black">Niche</span>
            <span className="bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent">
              Pal
            </span>
          </span>
          <button
            onClick={onClose}
            className="lg:hidden p-2 -mr-2 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-600"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto">
          <p className="px-6 mb-1 mt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">
            Reddit
          </p>
          <NavItem
            href="/dashboard"
            icon={<ReportsIcon />}
            label="Reports"
            isActive={pathname === '/dashboard'}
            onClick={onClose}
          />
          <NavItem
            href="/dashboard/community"
            icon={<SearchIcon />}
            label="Discover"
            isActive={pathname === '/dashboard/community'}
            onClick={onClose}
          />

          <p className="px-6 mb-1 mt-6 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">
            Account
          </p>
          <NavItem
            href="/dashboard/billing"
            icon={<BillingIcon />}
            label="Billing"
            isActive={pathname === '/dashboard/billing'}
            onClick={onClose}
          />
          <NavItem
            href="/dashboard/settings"
            icon={<SettingsIcon />}
            label="Settings"
            isActive={pathname === '/dashboard/settings'}
            onClick={onClose}
          />
          <button
            onClick={handleSignOut}
            className="text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-xl px-4 py-2.5 mx-3 flex items-center gap-3 text-sm transition-colors cursor-pointer w-[calc(100%-24px)]"
          >
            <SignOutIcon />
            Sign Out
          </button>
        </nav>

        {/* Credits stat card */}
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#4B6BF5]/8 to-[#7B4BF5]/8 border border-[#4B6BF5]/15">
            <p className="text-xs text-gray-400 mb-0.5">Credits remaining</p>
            <p className="text-sm font-semibold text-[#4B6BF5]">{credits}</p>
          </div>
        </div>
      </div>
    </>
  )
}
