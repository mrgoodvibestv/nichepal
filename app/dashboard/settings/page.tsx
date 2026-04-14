'use client'

import { useState, useEffect, useRef } from 'react'

type Profile = {
  business_name: string | null
  url: string | null
  positioning: string | null
  keywords: string[]
  target_subreddits: string[]
  tone: string
}

const TONE_OPTIONS = [
  { label: 'Expert', value: 'expert' },
  { label: 'Peer-to-peer', value: 'peer-to-peer' },
  { label: 'Challenger', value: 'challenger' },
  { label: 'Storyteller', value: 'storyteller' },
]

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [businessName, setBusinessName] = useState('')
  const [url, setUrl] = useState('')
  const [positioning, setPositioning] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [subreddits, setSubreddits] = useState<string[]>([])
  const [tone, setTone] = useState('peer-to-peer')

  const [addingKeyword, setAddingKeyword] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [addingSubreddit, setAddingSubreddit] = useState(false)
  const [newSubreddit, setNewSubreddit] = useState('')
  const newKeywordRef = useRef<HTMLInputElement>(null)
  const newSubredditRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/profile')
      .then(res => res.json())
      .then((data: Profile) => {
        setBusinessName(data.business_name ?? '')
        setUrl(data.url ?? '')
        setPositioning(data.positioning ?? '')
        setKeywords(data.keywords ?? [])
        setSubreddits(data.target_subreddits ?? [])
        setTone(data.tone ?? 'peer-to-peer')
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (addingKeyword) newKeywordRef.current?.focus()
  }, [addingKeyword])
  useEffect(() => {
    if (addingSubreddit) newSubredditRef.current?.focus()
  }, [addingSubreddit])

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

  async function handleSave() {
    setError('')
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/profile/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          business_name: businessName,
          positioning,
          keywords,
          target_subreddits: subreddits,
          tone,
        }),
      })
      const data: { success?: boolean; error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="px-8 py-8">
        <div className="max-w-2xl space-y-4 animate-pulse">
          <div className="h-6 bg-gray-100 rounded w-1/4" />
          <div className="h-10 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-100 rounded" />
          <div className="h-24 bg-gray-100 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="px-8 py-8">
      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-black mb-1">Settings</h1>
          <p className="text-sm text-gray-500">
            Update your profile — changes apply to future reports.
          </p>
        </div>

        <div className="space-y-6">
          {/* Business name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business name</label>
            <input
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4B6BF5] focus:border-transparent bg-white"
            />
          </div>

          {/* Website URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4B6BF5] focus:border-transparent bg-white"
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
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4B6BF5] focus:border-transparent resize-none bg-white"
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

          {/* Tone */}
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
                      : 'border-gray-200 text-gray-700 hover:border-gray-300 bg-white'
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

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-lg py-3 font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
