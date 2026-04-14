'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="w-full max-w-md bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
      {/* Logo */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-black">Niche</span>
          <span className="bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent">
            Pal
          </span>
        </h1>
        <p className="mt-2 text-sm text-gray-500">Sign in to your account</p>
      </div>

      <form onSubmit={handleSignIn} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4B6BF5] focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4B6BF5] focus:border-transparent"
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg py-3 font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent font-medium hover:opacity-80 transition"
        >
          Sign up
        </Link>
      </p>
    </div>
  )
}
