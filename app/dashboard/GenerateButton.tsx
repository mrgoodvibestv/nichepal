'use client'

import { useState, useEffect } from 'react'

interface Audience {
  id: string
  name: string
  description: string
  goal: string
  subreddits: string[]
}

const MAX_SELECTED = 5

export default function GenerateButton() {
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [selectedAudienceId, setSelectedAudienceId] = useState<string>('')
  const [subreddits, setSubreddits] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [customInput, setCustomInput] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [maxError, setMaxError] = useState(false)

  // Fetch profile once
  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then((profile: { audiences?: Audience[]; target_subreddits?: string[] }) => {
        const aud: Audience[] = profile.audiences ?? []
        if (aud.length > 0) {
          setAudiences(aud)
          setSelectedAudienceId(aud[0].id)
          const subs = aud[0].subreddits ?? []
          setSubreddits(subs)
          setSelected(subs.slice(0, 3))
        } else {
          // Legacy: no audiences, fall back to flat target_subreddits
          const subs = profile.target_subreddits ?? []
          setSubreddits(subs)
          setSelected(subs.slice(0, 3))
        }
      })
      .catch(() => {})
  }, [])

  function selectAudience(id: string) {
    const aud = audiences.find(a => a.id === id)
    if (!aud) return
    setSelectedAudienceId(id)
    const subs = aud.subreddits ?? []
    setSubreddits(subs)
    setSelected(subs.slice(0, 3))
    setMaxError(false)
  }

  function openModal() {
    setError('')
    setMaxError(false)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setCustomInput('')
    setMaxError(false)
  }

  function toggleSubreddit(sub: string) {
    setMaxError(false)
    if (selected.includes(sub)) {
      setSelected(selected.filter(s => s !== sub))
    } else {
      if (selected.length >= MAX_SELECTED) {
        setMaxError(true)
        return
      }
      setSelected([...selected, sub])
    }
  }

  function addCustom() {
    const sub = customInput.trim().replace(/^r\//i, '')
    if (!sub) return
    if (selected.length >= MAX_SELECTED) {
      setMaxError(true)
      return
    }
    if (!subreddits.includes(sub)) setSubreddits(prev => [...prev, sub])
    if (!selected.includes(sub)) setSelected(prev => [...prev, sub])
    setCustomInput('')
    setMaxError(false)
  }

  async function handleGenerate() {
    if (selected.length === 0) return
    setError('')
    setLoading(true)

    const activeAudience = audiences.find(a => a.id === selectedAudienceId)

    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedSubreddits: selected,
          audienceId: activeAudience?.id ?? null,
          audienceName: activeAudience?.name ?? null,
          audienceDescription: activeAudience?.description ?? null,
          audienceGoal: activeAudience?.goal ?? null,
        }),
      })
      const data: { reportId?: string; error?: string } = await res.json()
      if (!res.ok) {
        setError(
          data.error === 'No credits remaining'
            ? 'No credits remaining'
            : data.error || 'Generation failed. Please try again.'
        )
        setLoading(false)
        return
      }
      setShowModal(false)
      window.location.reload()
    } catch {
      setError('Generation failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="rounded-lg px-6 py-3 font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition"
      >
        Generate Report
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">

            {/* Audience selector — shown only when audiences exist */}
            {audiences.length > 0 && (
              <div className="mb-5">
                <p className="text-sm font-medium text-gray-700 mb-2">Who are you targeting?</p>
                <div className="space-y-2">
                  {audiences.map(aud => (
                    <button
                      key={aud.id}
                      type="button"
                      onClick={() => selectAudience(aud.id)}
                      className={`w-full text-left border rounded-xl px-4 py-3 cursor-pointer transition ${
                        selectedAudienceId === aud.id
                          ? 'border-[#4B6BF5] bg-blue-50/30'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium text-sm text-black">{aud.name}</p>
                      {aud.goal && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{aud.goal}</p>
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-b border-gray-100 mt-5 mb-5" />
              </div>
            )}

            {/* Community selector */}
            <h2 className="text-base font-semibold text-black mb-1">Choose communities to scan</h2>
            <p className="text-sm text-gray-500 mb-4">Select up to 5 communities for this report</p>

            <div className="border border-gray-100 rounded-xl overflow-hidden mb-4">
              {subreddits.length === 0 ? (
                <p className="text-sm text-gray-400 px-4 py-6 text-center">No communities found.</p>
              ) : (
                subreddits.map((sub, i) => (
                  <label
                    key={sub}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition ${
                      i < subreddits.length - 1 ? 'border-b border-gray-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(sub)}
                      onChange={() => toggleSubreddit(sub)}
                      className="accent-[#4B6BF5] w-4 h-4 shrink-0"
                    />
                    <span className="text-sm text-gray-700">r/{sub}</span>
                  </label>
                ))
              )}
            </div>

            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-400">{selected.length} of {MAX_SELECTED} selected</p>
              {maxError && <p className="text-xs text-red-500">Maximum 5 communities per report</p>}
            </div>

            <div className="flex gap-2 mb-5">
              <input
                type="text"
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustom()}
                placeholder="Add community (e.g. r/saas)"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4B6BF5]"
              />
              <button
                onClick={addCustom}
                className="text-sm text-[#4B6BF5] font-medium border border-[#4B6BF5] rounded-lg px-3 py-2 hover:bg-blue-50 transition"
              >
                Add
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-5 text-center">Estimated time: ~30 seconds</p>

            {error && <p className="text-sm text-red-500 mb-3 text-center">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={closeModal}
                disabled={loading}
                className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-3 text-sm font-medium hover:border-gray-300 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading || selected.length === 0}
                className="flex-1 bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] text-white rounded-lg py-3 text-sm font-semibold hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Starting...
                  </>
                ) : (
                  'Generate Report'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
