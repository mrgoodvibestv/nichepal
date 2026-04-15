'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Thread } from './page'

type Props = Thread

function PriorityBadge({ priority }: { priority: 'high' | 'medium' }) {
  if (priority === 'high') {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-white bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5]">
        High
      </span>
    )
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Medium</span>
  )
}

function ThreadTypeBadge({ type }: { type: 'trending' | 'rising' | 'evergreen' }) {
  if (type === 'trending') {
    return (
      <span className="flex items-center gap-1 text-xs text-orange-600">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
        Trending
      </span>
    )
  }
  if (type === 'rising') {
    return (
      <span className="flex items-center gap-1 text-xs text-blue-600">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        Rising
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs text-green-600">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      Evergreen
    </span>
  )
}

export default function ThreadCard({
  id,
  subreddit,
  title,
  url,
  author,
  upvotes,
  num_comments,
  upvote_ratio,
  thread_type,
  priority,
  relevance_score,
  why_engage,
  comment_template,
  body_snippet,
  engaged,
}: Props) {
  const [isEngaged, setIsEngaged] = useState(engaged)
  const [copied, setCopied] = useState(false)

  async function handleEngage() {
    const prev = isEngaged
    setIsEngaged(!prev) // optimistic
    try {
      const res = await fetch(`/api/threads/${id}/engage`, { method: 'POST' })
      if (!res.ok) {
        setIsEngaged(prev) // revert
        return
      }
      const data: { engaged: boolean } = await res.json()
      setIsEngaged(data.engaged)
    } catch {
      setIsEngaged(prev) // revert on network error
    }
  }

  async function handleCopy() {
    if (!comment_template) return
    try {
      await navigator.clipboard.writeText(comment_template)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow p-6 hover:shadow-lg transition-shadow duration-200">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <PriorityBadge priority={priority} />
          <ThreadTypeBadge type={thread_type} />
          <span className="text-sm text-gray-500">r/{subreddit}</span>
        </div>
        <span className="text-sm font-semibold bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent shrink-0 ml-4">
          {relevance_score}/10
        </span>
      </div>

      {/* Title */}
      <div className="mt-3">
        <Link
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-black hover:text-[#4B6BF5] transition leading-snug line-clamp-2"
        >
          {title}
        </Link>
        <p className="text-xs text-gray-400 mt-1 flex flex-wrap gap-x-2">
          {author && <span className="truncate max-w-[160px]">by u/{author}</span>}
          <span>▲ {upvotes.toLocaleString()}</span>
          <span>💬 {num_comments} comments</span>
          <span>{Math.round(upvote_ratio * 100)}% upvoted</span>
        </p>
      </div>

      {/* Body snippet */}
      {body_snippet && (
        <p className="mt-3 text-sm text-gray-500 italic line-clamp-2 border-l-2 border-gray-200 pl-3">
          {body_snippet}
        </p>
      )}

      {/* Why engage */}
      {why_engage && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Why engage
          </p>
          <p className="text-sm text-gray-700">{why_engage}</p>
        </div>
      )}

      {/* Comment template */}
      {comment_template && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Your comment
            </p>
            <button
              onClick={handleCopy}
              className="text-xs text-[#4B6BF5] hover:opacity-75 transition font-medium"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed border border-gray-200 break-words">
            {comment_template}
          </div>
        </div>
      )}

      {/* Bottom row */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#4B6BF5] font-medium hover:opacity-75 transition"
        >
          View thread →
        </Link>

        <button
          onClick={handleEngage}
          className={
            isEngaged
              ? 'bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-1.5 text-sm transition'
              : 'border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:border-gray-300 transition'
          }
        >
          {isEngaged ? '✓ Engaged' : 'Mark as engaged'}
        </button>
      </div>
    </div>
  )
}
