'use client'

import { useState, useEffect } from 'react'

type CommunityResult = {
  name: string
  reason: string
  estimated_size: string
  post_count: number
  active: boolean
  sample_titles: string[]
}

type Audience = {
  id: string
  name: string
  description: string
  goal: string
  subreddits: string[]
}

export default function CommunitySearchPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<CommunityResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState('')
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [selectedAudience, setSelectedAudience] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState<Record<string, boolean>>({})
  const [added, setAdded] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/profile')
      .then(res => res.json())
      .then(data => setAudiences(data.audiences ?? []))
      .catch(() => {})
  }, [])

  async function handleSearch() {
    if (!query.trim() || loading) return
    setLoading(true)
    setError('')
    setResults([])
    setHasSearched(true)
    setAdded({})
    setSelectedAudience({})

    try {
      const res = await fetch('/api/community/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Search failed')
      setResults(data.results ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(subredditName: string) {
    const audienceId = selectedAudience[subredditName]
    if (!audienceId) return

    setAdding(prev => ({ ...prev, [subredditName]: true }))
    try {
      const res = await fetch('/api/community/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subreddit: subredditName, audienceId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Add failed')
      const audienceName = audiences.find(a => a.id === audienceId)?.name ?? audienceId
      setAdded(prev => ({ ...prev, [subredditName]: audienceName }))
    } catch {
      // silently fail — user can retry
    } finally {
      setAdding(prev => ({ ...prev, [subredditName]: false }))
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-black">Discover</h1>
          <p className="text-sm text-gray-500 mt-1">
            Find active Reddit communities for any topic. Add them directly to your audiences.
          </p>
        </div>

        {/* Search bar */}
        <div className="flex gap-3 mb-8 max-w-2xl">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="e.g. indie film funding, retail investing, AI side projects..."
            className="flex-1 min-w-0 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4B6BF5] focus:border-transparent"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="shrink-0 px-5 py-3 rounded-xl font-semibold text-white text-sm bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loading ? 'Searching...' : 'Find Communities'}
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div>
            <p className="text-sm text-gray-500 mb-4 animate-pulse">
              Discovering communities and verifying activity...
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
                  <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-3/4 mb-4" />
                  <div className="h-9 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-8 px-4">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map(result => (
              <div key={result.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col h-auto sm:h-[220px]">
                {/* Top row */}
                <div className="mb-3">
                  <h3 className="font-semibold text-black">r/{result.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {result.estimated_size} community
                  </p>
                </div>

                {/* Reason */}
                <p
                  className="text-sm text-gray-600 mb-3 line-clamp-3 cursor-default"
                  title={result.reason}
                >
                  {result.reason}
                </p>

                {/* Add to audience — pinned to bottom */}
                <div className="mt-auto">
                  {added[result.name] && (
                    <p className="text-xs text-green-600 mb-2">
                      ✓ Added to {added[result.name]}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedAudience[result.name] ?? ''}
                      onChange={e =>
                        setSelectedAudience(prev => ({ ...prev, [result.name]: e.target.value }))
                      }
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4B6BF5] bg-white appearance-none"
                    >
                      <option value="">Add to audience...</option>
                      {audiences.map(aud => (
                        <option key={aud.id} value={aud.id}>
                          {aud.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAdd(result.name)}
                      disabled={!selectedAudience[result.name] || adding[result.name]}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {adding[result.name] ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state — before any search */}
        {!loading && !hasSearched && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-4">🔍</p>
            <p className="text-sm">Search for a topic to discover active communities</p>
          </div>
        )}

        {/* No results after search */}
        {!loading && hasSearched && results.length === 0 && !error && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-4">🔍</p>
            <p className="text-sm">No communities found. Try a different search.</p>
          </div>
        )}
      </div>
    </div>
  )
}
