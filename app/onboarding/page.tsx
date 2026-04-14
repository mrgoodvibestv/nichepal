'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface ProfileDraft {
  business_name: string
  positioning: string
  keywords: string[]
  target_subreddits: string[]
  tone: string
}

const SCAN_MESSAGES = [
  'Scanning your website...',
  'Identifying your positioning...',
  'Finding your Reddit communities...',
  'Almost done...',
]

const TONE_OPTIONS = [
  { label: 'Expert', value: 'expert' },
  { label: 'Peer-to-peer', value: 'peer-to-peer' },
  { label: 'Challenger', value: 'challenger' },
  { label: 'Storyteller', value: 'storyteller' },
]

export default function OnboardingPage() {
  const router = useRouter()

  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1
  const [url, setUrl] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanMsgIdx, setScanMsgIdx] = useState(0)
  const [scanError, setScanError] = useState('')

  // Step 2 — editable profile fields
  const [businessName, setBusinessName] = useState('')
  const [positioning, setPositioning] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [subreddits, setSubreddits] = useState<string[]>([])
  const [tone, setTone] = useState('peer-to-peer')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Inline add inputs
  const [addingKeyword, setAddingKeyword] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [addingSubreddit, setAddingSubreddit] = useState(false)
  const [newSubreddit, setNewSubreddit] = useState('')
  const newKeywordRef = useRef<HTMLInputElement>(null)
  const newSubredditRef = useRef<HTMLInputElement>(null)

  // Cycle scan messages while scanning
  useEffect(() => {
    if (!scanning) return
    const id = setInterval(() => setScanMsgIdx(i => (i + 1) % SCAN_MESSAGES.length), 1500)
    return () => clearInterval(id)
  }, [scanning])

  // Auto-redirect from step 3
  useEffect(() => {
    if (step !== 3) return
    const id = setTimeout(() => router.push('/dashboard'), 2000)
    return () => clearTimeout(id)
  }, [step, router])

  // Focus inline add inputs
  useEffect(() => {
    if (addingKeyword) newKeywordRef.current?.focus()
  }, [addingKeyword])
  useEffect(() => {
    if (addingSubreddit) newSubredditRef.current?.focus()
  }, [addingSubreddit])

  async function handleScan(e: React.FormEvent) {
    e.preventDefault()
    setScanError('')
    setScanning(true)
    setScanMsgIdx(0)
    try {
      const res = await fetch('/api/onboard/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data: ProfileDraft & { error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scan failed')
      setBusinessName(data.business_name || '')
      setPositioning(data.positioning || '')
      setKeywords(data.keywords || [])
      setSubreddits(data.target_subreddits || [])
      setTone(data.tone || 'peer-to-peer')
      setStep(2)
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : 'Scan failed. Please try again.')
    } finally {
      setScanning(false)
    }
  }

  async function handleSave() {
    setSaveError('')
    setSaving(true)
    try {
      const res = await fetch('/api/profile/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, business_name: businessName, positioning, keywords, target_subreddits: subreddits, tone }),
      })
      const data: { success?: boolean; error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setStep(3)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function commitKeyword() {
    const kw = newKeyword.trim()
    if (kw && !keywords.includes(kw)) setKeywords(prev => [...prev, kw])
    setNewKeyword('')
    setAddingKeyword(false)
  }

  function commitSubreddit() {
    const sub = newSubreddit.trim().replace(/^r\//, '')
    if (sub && !subreddits.includes(sub)) setSubreddits(prev => [...prev, sub])
    setNewSubreddit('')
    setAddingSubreddit(false)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 pt-10 pb-4">
        {([1, 2, 3] as const).map(s => (
          <div
            key={s}
            className={
              s === step
                ? 'w-3 h-3 rounded-full bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5]'
                : 'w-3 h-3 rounded-full border-2 border-gray-300'
            }
          />
        ))}
      </div>

      <div className="max-w-lg mx-auto px-6 pb-20">
        {/* Logo */}
        <div className="text-center mb-8 mt-2">
          <span className="text-xl font-bold">
            <span className="text-black">Niche</span>
            <span className="bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent">
              Pal
            </span>
          </span>
        </div>

        {/* ── SCREEN 1 — URL scan ── */}
        {step === 1 && (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-black mb-2">
                Let&apos;s set up your profile
              </h1>
              <p className="text-sm text-gray-500">
                We&apos;ll scan your site and find where your audience lives on Reddit. Takes about
                10 seconds.
              </p>
            </div>

            <form onSubmit={handleScan} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your website URL
                </label>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://yourcompany.com"
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4B6BF5] focus:border-transparent"
                />
              </div>

              {scanError && <p className="text-sm text-red-500">{scanError}</p>}

              {scanning && (
                <p className="text-sm text-[#4B6BF5] text-center animate-pulse">
                  {SCAN_MESSAGES[scanMsgIdx]}
                </p>
              )}

              <button
                type="submit"
                disabled={scanning}
                className="w-full rounded-lg py-3 font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {scanning ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Scanning...
                  </>
                ) : (
                  'Scan my site →'
                )}
              </button>
            </form>
          </div>
        )}

        {/* ── SCREEN 2 — Review & confirm ── */}
        {step === 2 && (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-black mb-2">Here&apos;s what we found</h1>
              <p className="text-sm text-gray-500">
                Review and adjust — this shapes every report we generate for you.
              </p>
            </div>

            <div className="space-y-6">
              {/* Business name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4B6BF5] focus:border-transparent"
                />
              </div>

              {/* Positioning */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Positioning
                </label>
                <textarea
                  rows={3}
                  value={positioning}
                  onChange={e => setPositioning(e.target.value)}
                  placeholder="What you do and who you serve"
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4B6BF5] focus:border-transparent resize-none"
                />
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Keywords</label>
                <div className="flex flex-wrap gap-2">
                  {keywords.map(kw => (
                    <span
                      key={kw}
                      className="bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 text-sm flex items-center gap-1.5"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() => setKeywords(prev => prev.filter(k => k !== kw))}
                        className="text-gray-400 hover:text-gray-600 text-xs ml-1 leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {addingKeyword ? (
                    <input
                      ref={newKeywordRef}
                      type="text"
                      value={newKeyword}
                      onChange={e => setNewKeyword(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); commitKeyword() }
                        if (e.key === 'Escape') { setAddingKeyword(false); setNewKeyword('') }
                      }}
                      onBlur={commitKeyword}
                      placeholder="Add keyword"
                      className="bg-gray-50 border border-dashed border-[#4B6BF5] rounded-full px-3 py-1.5 text-sm text-[#4B6BF5] focus:outline-none w-32"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingKeyword(true)}
                      className="bg-gray-50 border border-dashed border-gray-300 rounded-full px-3 py-1.5 text-sm text-[#4B6BF5] hover:border-[#4B6BF5] transition"
                    >
                      + Add
                    </button>
                  )}
                </div>
              </div>

              {/* Target communities */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target communities
                </label>
                <div className="flex flex-wrap gap-2">
                  {subreddits.map(sub => (
                    <span
                      key={sub}
                      className="bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 text-sm flex items-center gap-1.5"
                    >
                      r/{sub}
                      <button
                        type="button"
                        onClick={() => setSubreddits(prev => prev.filter(s => s !== sub))}
                        className="text-gray-400 hover:text-gray-600 text-xs ml-1 leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {addingSubreddit ? (
                    <input
                      ref={newSubredditRef}
                      type="text"
                      value={newSubreddit}
                      onChange={e => setNewSubreddit(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); commitSubreddit() }
                        if (e.key === 'Escape') { setAddingSubreddit(false); setNewSubreddit('') }
                      }}
                      onBlur={commitSubreddit}
                      placeholder="subreddit name"
                      className="bg-gray-50 border border-dashed border-[#4B6BF5] rounded-full px-3 py-1.5 text-sm text-[#4B6BF5] focus:outline-none w-36"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingSubreddit(true)}
                      className="bg-gray-50 border border-dashed border-gray-300 rounded-full px-3 py-1.5 text-sm text-[#4B6BF5] hover:border-[#4B6BF5] transition"
                    >
                      + Add
                    </button>
                  )}
                </div>
              </div>

              {/* Tone — 2×2 grid */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
                <div className="grid grid-cols-2 gap-3">
                  {TONE_OPTIONS.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTone(t.value)}
                      className={`relative border rounded-xl p-4 text-center cursor-pointer transition text-sm font-medium ${
                        tone === t.value
                          ? 'border-[#4B6BF5] bg-blue-50/30 text-[#4B6BF5]'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {tone === t.value && (
                        <span className="absolute top-2 right-2 text-xs bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent font-bold">
                          ✓
                        </span>
                      )}
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {saveError && <p className="text-sm text-red-500">{saveError}</p>}

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-lg py-3 font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : "Looks good, let's go →"}
              </button>
            </div>
          </div>
        )}

        {/* ── SCREEN 3 — Done ── */}
        {step === 3 && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#4B6BF5] to-[#7B4BF5] flex items-center justify-center mb-6 shadow-lg">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-black mb-2">You&apos;re all set!</h2>
            <p className="text-sm text-gray-500">Taking you to your dashboard...</p>
          </div>
        )}
      </div>
    </div>
  )
}
