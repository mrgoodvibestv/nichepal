'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface SidebarProps {
  credits: number
}

function NavItem({ href, icon, label, isActive }: { href: string; icon: string; label: string; isActive: boolean }) {
  return (
    <Link
      href={href}
      className={
        isActive
          ? 'bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] rounded-xl text-white px-3 py-2 mx-2 flex items-center gap-2 text-sm font-medium'
          : 'text-gray-500 hover:text-black hover:bg-gray-50 rounded-xl px-3 py-2 mx-2 flex items-center gap-2 text-sm transition-colors'
      }
    >
      <span>{icon}</span>
      {label}
    </Link>
  )
}

export default function Sidebar({ credits }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="w-60 h-screen border-r border-gray-100 bg-white flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <span className="text-lg font-bold">
          <span className="text-black">Niche</span>
          <span className="bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent">
            Pal
          </span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-5 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Intelligence
        </p>
        <NavItem href="/dashboard" icon="📊" label="Reports" isActive={pathname === '/dashboard'} />
        <NavItem
          href="/dashboard/community"
          icon="🔍"
          label="Community Search"
          isActive={pathname === '/dashboard/community'}
        />

        <p className="px-5 mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Account
        </p>
        <NavItem
          href="/dashboard/settings"
          icon="⚙️"
          label="Settings"
          isActive={pathname === '/dashboard/settings'}
        />
        <button
          onClick={handleSignOut}
          className="text-gray-500 hover:text-black hover:bg-gray-50 rounded-xl px-3 py-2 mx-2 flex items-center gap-2 text-sm transition-colors w-[calc(100%-16px)]"
        >
          <span>🚪</span>
          Sign Out
        </button>
      </nav>

      {/* Credits badge */}
      <div className="px-5 py-4 border-t border-gray-100">
        <span className="text-sm text-[#4B6BF5] bg-[#4B6BF5]/8 rounded-full px-3 py-1 border border-[#4B6BF5]/20">
          {credits} credits remaining
        </span>
      </div>
    </div>
  )
}
