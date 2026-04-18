'use client'

import { useState, useEffect, useRef } from 'react'

type Audience = {
  id: string
  name: string
  description: string
  goal: string
  subreddits: string[]
}

type Profile = {
  business_name: string | null
  url: string | null
  positioning: string | null
  keywords: string[]
  target_subreddits: string[]
  tone: string
  audiences: Audience[]
}

const TONE_OPTIONS = [
  { label: 'Expert', value: 'expert' },
  { label: 'Peer-to-peer', value: 'peer-to-peer' },
  { label: 'Challenger', value: 'challenger' },
  { label: 'Storyteller', value: 'storyteller' },
]

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function AudienceCard({
  audience,
  onChange,
  onDelete,
}: {
  audience: Audience
  onChange: (updated: Audience) => void
  onDelete: () => void
}) {
  const [addingSub, setAddingSub] = useState(false)
  const [newSub, setNewSub] = useState('')
  const subRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (addingSub) subRef.current?.focus()
  }, [addingSub])

  function commitSub() {
    const sub = newSub.trim().replace(/^r\//, '')
    if (sub && !audience.subreddits.includes(sub)) {
      onChange({ ...audience, subreddits: [...audience.subreddits, sub] })
    }
    setNewSub('')
    setAddingSub(false)
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
      <div className="flex items-start justify-between gap-2">
        <input
          type="text"
          value={audience.name}
          onChange={e => onChange({ ...audience, name: e.target.value })}
          placeholder="Audience name"
          className="flex-1 font-medium text-sm text-black border-0 border-b border-gray-200 focus:outline-none focus:border-[#4B6BF5] pb-0.5 bg-transparent"
        />
        <button
          type="button"
          onClick={onDelete}
          className="text-gray-300 hover:text-red-400 transition text-lg leading-none mt-0.5"
          aria-label="Delete audience"
        >
          ×
        </button>
      </div>

      <input
        type="text"
        value={audience.description}
        onChange={e => onChange({ ...audience, description: e.target.value })}
        placeholder="Description (who they are)"
        className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#4B6BF5] bg-white"
      />

      <input
        type="text"
        value={audience.goal}
        onChange={e => onChange({ ...audience, goal: e.target.value })}
        placeholder="Goal (what you want from this audience)"
        className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#4B6BF5] bg-white"
      />

      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">Subreddits</p>
        <div className="flex flex-wrap gap-1.5">
          {audience.subreddits.map(sub => (
            <span
              key={sub}
              className="bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1 text-xs flex items-center gap-1"
            >
              r/{sub}
              <button
                type="button"
                onClick={() =>
                  onChange({ ...audience, subreddits: audience.subreddits.filter(s => s !== sub) })
                }
                className="text-gray-400 hover:text-gray-600 leading-none"
              >
                ×
              </button>
            </span>
          ))}
          {addingSub ? (
            <input
              ref={subRef}
              type="text"
              value={newSub}
              onChange={e => setNewSub(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitSub() }
                if (e.key === 'Escape') { setAddingSub(false); setNewSub('') }
              }}
              onBlur={commitSub}
              placeholder="subreddit"
              className="bg-gray-50 border border-dashed border-[#4B6BF5] rounded-full px-2.5 py-1 text-xs text-[#4B6BF5] focus:outline-none w-28"
            />
          ) : (
            <button
              type="button"
              onClick={() => setAddingSub(true)}
              className="bg-gray-50 border border-dashed border-gray-300 rounded-full px-2.5 py-1 text-xs text-[#4B6BF5] hover:border-[#4B6BF5] transition min-h-[44px] inline-flex items-center"
            >
              + Add
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [businessName, setBusinessName] = useState('')
  const [url, setUrl] = useState('')
  const [positioning, setPositioning] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [tone, setTone] = useState('peer-to-peer')
  const [audiences, setAudiences] = useState<Audience[]>([])

  const [addingKeyword, setAddingKeyword] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const newKeywordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/profile')
      .then(res => res.json())
      .then((data: Profile) => {
        setBusinessName(data.business_name ?? '')
        setUrl(data.url ?? '')
        setPositioning(data.positioning ?? '')
        setKeywords(data.keywords ?? [])
        setTone(data.tone ?? 'peer-to-peer')
        setAudiences(data.audiences ?? [])
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (addingKeyword) newKeywordRef.current?.focus()
  }, [addingKeyword])

  function commitKeyword() {
    const kw = newKeyword.trim()
    if (kw && !keywords.includes(kw)) setKeywords(prev => [...prev, kw])
    setNewKeyword('')
    setAddingKeyword(false)
  }

  function updateAudience(id: string, updated: Audience) {
    setAudiences(prev => prev.map(a => (a.id === id ? updated : a)))
  }

  function deleteAudience(id: string) {
    setAudiences(prev => prev.filter(a => a.id !== id))
  }

  function addAudience() {
    setAudiences(prev => [
      ...prev,
      { id: generateId(), name: '', description: '', goal: '', subreddits: [] },
    ])
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
          tone,
          audiences,
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
      <div className="px-4 sm:px-8 py-6 sm:py-8">
        <div className="space-y-4 animate-pulse">
          <div className="h-6 bg-gray-100 rounded w-1/4" />
          <div className="h-10 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-100 rounded" />
          <div className="h-24 bg-gray-100 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8">
      <div>
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
                  className="bg-gray-50 border border-dashed border-gray-300 rounded-full px-3 py-1.5 text-sm text-[#4B6BF5] hover:border-[#4B6BF5] transition min-h-[44px] inline-flex items-center"
                >
                  + Add
                </button>
              )}
            </div>
          </div>

          {/* Audiences */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Audiences</label>
              <button
                type="button"
                onClick={addAudience}
                className="text-xs text-[#4B6BF5] font-medium hover:opacity-80 transition"
              >
                + New audience
              </button>
            </div>
            {audiences.length === 0 ? (
              <p className="text-sm text-gray-400 py-3">No audiences yet. Add one above.</p>
            ) : (
              <div className="space-y-3">
                {audiences.map(aud => (
                  <AudienceCard
                    key={aud.id}
                    audience={aud}
                    onChange={updated => updateAudience(aud.id, updated)}
                    onDelete={() => deleteAudience(aud.id)}
                  />
                ))}
              </div>
            )}
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
