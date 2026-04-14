'use client'

import { useState, useEffect } from 'react'

const MAX_SELECTED = 5

export default function GenerateButton() {
  const [subreddits, setSubreddits] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [customInput, setCustomInput] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [maxError, setMaxError] = useState(false)

  // Fetch profile subreddits once
  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then((profile: { target_subreddits?: string[] }) => {
        const subs = profile.target_subreddits ?? []
        setSubreddits(subs)
        setSelected(subs.slice(0, 3))
      })
      .catch(() => {})
  }, [])

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
    if (!subreddits.includes(sub)) {
      setSubreddits(prev => [...prev, sub])
    }
    if (!selected.includes(sub)) {
      setSelected(prev => [...prev, sub])
    }
    setCustomInput('')
    setMaxError(false)
  }

  async function handleGenerate() {
    if (selected.length === 0) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedSubreddits: selected }),
      })
      const data: { reportId?: string; error?: string } = await res.json()
      if (!res.ok) {
        setError(data.error === 'No credits remaining'
          ? 'No credits remaining'
          : data.error || 'Generation failed. Please try again.')
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
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6">
            {/* Header */}
            <h2 className="text-lg font-semibold text-black mb-1">Choose communities to scan</h2>
            <p className="text-sm text-gray-500 mb-4">Select 3–5 communities for this report</p>

            {/* Subreddit list */}
            <div className="border border-gray-100 rounded-xl overflow-hidden mb-4">
              {subreddits.length === 0 ? (
                <p className="text-sm text-gray-400 px-4 py-6 text-center">No communities in your profile yet.</p>
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

            {/* Selection counter + max warning */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-400">{selected.length} of {MAX_SELECTED} selected</p>
              {maxError && (
                <p className="text-xs text-red-500">Maximum 5 communities per report</p>
              )}
            </div>

            {/* Add custom community */}
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

            {/* Estimated time */}
            <p className="text-xs text-gray-400 mb-5 text-center">Estimated time: ~30 seconds</p>

            {error && <p className="text-sm text-red-500 mb-3 text-center">{error}</p>}

            {/* Actions */}
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
