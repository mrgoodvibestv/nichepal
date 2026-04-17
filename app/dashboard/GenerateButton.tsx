'use client'

import { useState, useEffect } from 'react'

interface Audience {
  id: string
  name: string
  description: string
  goal: string
  subreddits: string[]
}

export default function GenerateButton() {
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [selectedAudienceId, setSelectedAudienceId] = useState<string>('')
  const [subreddits, setSubreddits] = useState<string[]>([])
  const [selectedSubreddit, setSelectedSubreddit] = useState<string>('')
  const [customInput, setCustomInput] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
          setSelectedSubreddit(subs[0] ?? '')
        } else {
          const subs = profile.target_subreddits ?? []
          setSubreddits(subs)
          setSelectedSubreddit(subs[0] ?? '')
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
    setSelectedSubreddit(subs[0] ?? '')
  }

  function openModal() {
    setError('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setCustomInput('')
  }

  function addCustom() {
    const sub = customInput.trim().replace(/^r\//i, '')
    if (!sub) return
    if (!subreddits.includes(sub)) setSubreddits(prev => [...prev, sub])
    setSelectedSubreddit(sub)
    setCustomInput('')
  }

  async function handleGenerate() {
    if (!selectedSubreddit) return
    setError('')
    setLoading(true)

    const activeAudience = audiences.find(a => a.id === selectedAudienceId)

    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subreddit: selectedSubreddit,
          audienceId: activeAudience?.id ?? null,
          audienceName: activeAudience?.name ?? null,
          audienceDescription: activeAudience?.description ?? null,
          audienceGoal: activeAudience?.goal ?? null,
        }),
      })
      const body: { reportId?: string; error?: string } = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? 'Something went wrong. Please try again.')
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
        className="w-full sm:w-auto rounded-lg px-6 py-3 font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition"
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
                      className={`w-full text-left border-2 rounded-xl px-4 py-3 cursor-pointer transition ${
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

            {/* Subreddit selector */}
            <h2 className="text-base font-semibold text-black mb-1">Choose a subreddit to scan</h2>
            <p className="text-sm text-gray-500 mb-4">Select one community for this report</p>

            {subreddits.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 text-center mb-4">No communities found.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {subreddits.map(sub => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSelectedSubreddit(sub)}
                    className={`border-2 rounded-xl px-3 py-2.5 text-sm text-left transition truncate ${
                      selectedSubreddit === sub
                        ? 'border-[#4B6BF5] bg-blue-50/30 text-[#4B6BF5]'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    r/{sub}
                  </button>
                ))}
              </div>
            )}

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

            <p className="text-xs text-gray-400 mb-3 text-center">Estimated time: ~30 seconds</p>
            <p className="text-xs text-gray-400 text-center mb-5">3 credits per report</p>

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
                disabled={loading || !selectedSubreddit}
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
