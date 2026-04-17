'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Audience {
  id: string
  name: string
  description: string
  goal: string
  subreddits: string[]
}

interface ProfileDraft {
  business_name: string
  positioning: string
  keywords: string[]
  tone: string
  audiences: Audience[]
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

const MAX_AUDIENCES = 4

export default function OnboardingPage() {
  const router = useRouter()

  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1
  const [url, setUrl] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanMsgIdx, setScanMsgIdx] = useState(0)
  const [scanError, setScanError] = useState('')

  // Step 2
  const [businessName, setBusinessName] = useState('')
  const [positioning, setPositioning] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [tone, setTone] = useState('peer-to-peer')
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Per-audience "add subreddit" inline state
  const [addingSubForId, setAddingSubForId] = useState<string | null>(null)
  const [newSubInput, setNewSubInput] = useState('')
  const newSubRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!scanning) return
    const id = setInterval(() => setScanMsgIdx(i => (i + 1) % SCAN_MESSAGES.length), 1500)
    return () => clearInterval(id)
  }, [scanning])

  useEffect(() => {
    if (step !== 3) return
    const id = setTimeout(() => router.push('/dashboard'), 2000)
    return () => clearTimeout(id)
  }, [step, router])

  useEffect(() => {
    if (addingSubForId) newSubRef.current?.focus()
  }, [addingSubForId])

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
      setTone(data.tone || 'peer-to-peer')
      setAudiences(data.audiences || [])
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
        body: JSON.stringify({ url, business_name: businessName, positioning, keywords, tone, audiences }),
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

  // ── Audience helpers ──
  function updateAudience(id: string, updates: Partial<Audience>) {
    setAudiences(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
  }

  function removeAudienceSub(audienceId: string, sub: string) {
    setAudiences(prev => prev.map(a =>
      a.id === audienceId ? { ...a, subreddits: a.subreddits.filter(s => s !== sub) } : a
    ))
  }

  function commitSubForAudience() {
    if (!addingSubForId) return
    const sub = newSubInput.trim().replace(/^r\//i, '')
    if (sub) {
      setAudiences(prev => prev.map(a => {
        if (a.id !== addingSubForId) return a
        if (a.subreddits.includes(sub)) return a
        return { ...a, subreddits: [...a.subreddits, sub] }
      }))
    }
    setNewSubInput('')
    setAddingSubForId(null)
  }

  function addAudience() {
    if (audiences.length >= MAX_AUDIENCES) return
    setAudiences(prev => [
      ...prev,
      { id: 'custom-' + Date.now(), name: '', description: '', goal: '', subreddits: [] },
    ])
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

      <div className={`${step === 2 ? 'max-w-5xl' : 'max-w-lg'} mx-auto px-4 sm:px-6 pt-8 pb-16`}>
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
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-stretch">

              {/* Left column — profile card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col lg:h-[550px] lg:overflow-y-auto">
                <div className="mb-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400 mb-1">Your Profile</p>
                  <h2 className="text-xl font-bold text-black">Review your setup</h2>
                  <p className="text-sm text-gray-500 mt-1">This shapes every report we generate for you.</p>
                </div>

                <div className="space-y-6">
                  {/* Business name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Business name</label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={e => setBusinessName(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4B6BF5] focus:border-transparent"
                    />
                  </div>

                  {/* Positioning */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Positioning</label>
                    <textarea
                      rows={3}
                      value={positioning}
                      onChange={e => setPositioning(e.target.value)}
                      placeholder="What you do and who you serve"
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4B6BF5] focus:border-transparent resize-none max-h-24 overflow-y-auto"
                    />
                  </div>

                  {/* Tone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
                    <div className="grid grid-cols-2 gap-3">
                      {TONE_OPTIONS.map(t => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setTone(t.value)}
                          className={`relative border-2 rounded-xl p-4 text-center cursor-pointer transition text-sm font-medium ${
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

                </div>
              </div>

              {/* Right column — audiences card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col lg:h-[550px] lg:overflow-y-auto">
                <div className="mb-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400 mb-1">Your Audiences</p>
                  <h2 className="text-xl font-bold text-black">Who you&apos;re targeting</h2>
                  <p className="text-sm text-gray-500 mt-1">Edit or remove audiences. Each one shapes a different set of reports.</p>
                </div>

                <div className="space-y-3">
                  {audiences.map(audience => (
                    <div
                      key={audience.id}
                      className="bg-gray-50 rounded-xl border border-gray-100 p-5 space-y-3 relative"
                    >
                      {/* Top row: gradient name pill + remove button */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] text-white">
                          {audience.name || 'Unnamed audience'}
                        </span>
                        {audiences.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setAudiences(prev => prev.filter(a => a.id !== audience.id))}
                            className="text-gray-400 hover:text-gray-600 text-lg leading-none transition"
                            aria-label="Remove audience"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        {/* Name */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-1">Audience name</p>
                          <input
                            type="text"
                            value={audience.name}
                            onChange={e => updateAudience(audience.id, { name: e.target.value })}
                            className="w-full border-b border-gray-200 pb-1 text-sm text-gray-800 focus:outline-none focus:border-[#4B6BF5] bg-transparent"
                            placeholder="e.g. Early-stage founders"
                          />
                        </div>

                        {/* Description */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-1">Who they are</p>
                          <textarea
                            rows={2}
                            value={audience.description}
                            onChange={e => updateAudience(audience.id, { description: e.target.value })}
                            className="w-full border-b border-gray-200 pb-1 text-sm text-gray-800 focus:outline-none focus:border-[#4B6BF5] bg-transparent resize-none max-h-24 overflow-y-auto"
                            placeholder="e.g. Founders building their first product, focused on growth..."
                          />
                        </div>

                        {/* Goal */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-1">What you want them to do</p>
                          <input
                            type="text"
                            value={audience.goal}
                            onChange={e => updateAudience(audience.id, { goal: e.target.value })}
                            className="w-full border-b border-gray-200 pb-1 text-sm text-gray-800 focus:outline-none focus:border-[#4B6BF5] bg-transparent"
                            placeholder="e.g. Sign up for a free trial"
                          />
                        </div>

                        {/* Subreddits */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">Their communities</p>
                          <div className="flex flex-wrap gap-2">
                            {audience.subreddits.map(sub => (
                              <span
                                key={sub}
                                className="bg-white border border-gray-200 rounded-full px-3 py-1 text-sm flex items-center gap-1.5"
                              >
                                r/{sub}
                                <button
                                  type="button"
                                  onClick={() => removeAudienceSub(audience.id, sub)}
                                  className="text-gray-400 hover:text-gray-600 text-xs leading-none"
                                >
                                  ×
                                </button>
                              </span>
                            ))}

                            {addingSubForId === audience.id ? (
                              <input
                                ref={newSubRef}
                                type="text"
                                value={newSubInput}
                                onChange={e => setNewSubInput(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { e.preventDefault(); commitSubForAudience() }
                                  if (e.key === 'Escape') { setAddingSubForId(null); setNewSubInput('') }
                                }}
                                onBlur={commitSubForAudience}
                                placeholder="subreddit name"
                                className="bg-white border border-dashed border-[#4B6BF5] rounded-full px-3 py-1 text-sm text-[#4B6BF5] focus:outline-none w-36"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setAddingSubForId(audience.id)}
                                className="bg-white border border-dashed border-gray-300 rounded-full px-3 py-1 text-sm text-[#4B6BF5] hover:border-[#4B6BF5] transition"
                              >
                                + Add
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add audience button */}
                {audiences.length < MAX_AUDIENCES && (
                  <button
                    type="button"
                    onClick={addAudience}
                    className="mt-3 w-full border border-dashed border-gray-300 rounded-xl py-3 text-sm text-[#4B6BF5] hover:border-[#4B6BF5] transition"
                  >
                    + Add audience
                  </button>
                )}
              </div>

            </div>

            <div className="flex flex-col items-center mt-6">
              {saveError && (
                <p className="text-sm text-red-500 mb-3 text-center">{saveError}</p>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto sm:min-w-[280px] rounded-xl px-12 py-4 font-semibold text-white text-base bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
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
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
