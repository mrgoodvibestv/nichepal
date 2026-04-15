'use client'

import { useState, useMemo } from 'react'
import ThreadCard from './ThreadCard'
import type { Thread } from './page'

type Priority = 'all' | 'high' | 'medium'
type ThreadType = 'all' | 'trending' | 'rising' | 'evergreen'

const PRIORITY_LABELS: { value: Priority; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
]

const TYPE_LABELS: { value: ThreadType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'trending', label: 'Trending' },
  { value: 'rising', label: 'Rising' },
  { value: 'evergreen', label: 'Evergreen' },
]

export default function ReportFilters({ threads }: { threads: Thread[] }) {
  const [priority, setPriority] = useState<Priority>('all')
  const [threadType, setThreadType] = useState<ThreadType>('all')
  const [subreddit, setSubreddit] = useState('all')

  const subreddits = useMemo(
    () => ['all', ...Array.from(new Set(threads.map(t => t.subreddit))).sort()],
    [threads]
  )

  const filtered = useMemo(() => {
    return threads.filter(t => {
      if (priority !== 'all' && t.priority !== priority) return false
      if (threadType !== 'all' && t.thread_type !== threadType) return false
      if (subreddit !== 'all' && t.subreddit !== subreddit) return false
      return true
    })
  }, [threads, priority, threadType, subreddit])

  function pillClass(active: boolean) {
    return active
      ? 'bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] text-white rounded-full px-4 py-1.5 text-sm font-medium transition'
      : 'border border-gray-200 text-gray-600 rounded-full px-4 py-1.5 text-sm hover:border-gray-300 transition'
  }

  return (
    <>
      {/* Filter bar */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-8 py-3 flex flex-wrap items-center gap-2 sm:gap-4">
        {/* Priority */}
        <div className="flex items-center gap-1.5">
          {PRIORITY_LABELS.map(p => (
            <button key={p.value} onClick={() => setPriority(p.value)} className={pillClass(priority === p.value)}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-gray-200" />

        {/* Thread type */}
        <div className="flex items-center gap-1.5">
          {TYPE_LABELS.map(t => (
            <button key={t.value} onClick={() => setThreadType(t.value)} className={pillClass(threadType === t.value)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-gray-200" />

        {/* Subreddit dropdown */}
        <div className="relative">
          <select
            value={subreddit}
            onChange={e => setSubreddit(e.target.value)}
            className="appearance-none bg-white border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#4B6BF5] cursor-pointer w-full"
          >
            {subreddits.map(s => (
              <option key={s} value={s}>
                {s === 'all' ? 'All subreddits' : `r/${s}`}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <span className="ml-auto text-sm text-gray-400">{filtered.length} threads</span>
      </div>

      {/* Thread list */}
      <div className="px-4 sm:px-8 py-6 space-y-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-3xl mb-3">🔍</p>
            <p className="font-semibold text-black mb-1">No threads match these filters</p>
            <p className="text-sm text-gray-500">Try adjusting your filters above.</p>
          </div>
        ) : (
          filtered.map(thread => <ThreadCard key={thread.id} {...thread} />)
        )}
      </div>
    </>
  )
}
