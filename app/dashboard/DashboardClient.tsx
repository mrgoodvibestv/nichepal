'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GenerateButton from './GenerateButton'

type Report = {
  id: string
  status: 'generating' | 'complete' | 'failed'
  week_of: string
  strategy_note: string | null
  subreddits_scanned: number
  threads_found: number
  high_priority_count: number
  generated_at: string
  audience_name: string | null
  selected_subreddits: string[] | null
}

function formatReportDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function StatusBadge({ status }: { status: Report['status'] }) {
  if (status === 'generating') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-yellow-600">
        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
        Generating...
      </span>
    )
  }
  if (status === 'complete') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        Complete
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-red-500">
      <span className="w-2 h-2 rounded-full bg-red-400" />
      Failed
    </span>
  )
}

export default function DashboardClient({
  reports,
  credits,
  totalThreads,
  totalEngaged,
}: {
  reports: Report[]
  credits: number
  totalThreads: number
  totalEngaged: number
}) {
  const router = useRouter()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Tracks report IDs currently being analyzed — prevents double-calling analyze
  const analyzingRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const generatingReports = reports.filter(r => r.status === 'generating')

    if (generatingReports.length === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(async () => {
      for (const report of generatingReports) {
        try {
          const res = await fetch(`/api/reports/status/${report.id}`)
          const data: {
            status?: string
            apifyReady?: boolean
            datasetId?: string
            error?: string
          } = await res.json()

          // Terminal state — refresh to re-render with new status
          if (data.status === 'complete' || data.status === 'failed') {
            router.refresh()
            return
          }

          // Apify finished — trigger analysis exactly once per report
          if (data.apifyReady && !analyzingRef.current.has(report.id)) {
            analyzingRef.current.add(report.id)
            try {
              await fetch(`/api/reports/analyze/${report.id}`, { method: 'POST' })
            } catch {
              // analyze route will mark report as failed if it errors
            }
            router.refresh()
            return
          }
        } catch {
          // Network hiccup — try again next tick
        }
      }
    }, 10_000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [reports, router])

  return (
    <div>
      {/* Report list */}
      <div className="px-4 sm:px-8 py-6">
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-5xl mb-4">📋</p>
            <p className="font-semibold text-lg text-black mb-2">No reports yet</p>
            <p className="text-sm text-gray-500 max-w-sm mb-6">
              Generate your first report to see Reddit threads your audience is active in.
            </p>
            <GenerateButton />
          </div>
        ) : (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-black">Your Reports</h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  {reports.length} {reports.length === 1 ? 'report' : 'reports'} · {totalThreads} threads found · {totalEngaged} engaged · {credits} credits remaining
                </p>
              </div>
              <GenerateButton />
            </div>
            <div className="space-y-4">
              {reports.map(report => (
                <div
                  key={report.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow p-6 hover:shadow-lg transition-shadow duration-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg text-black">
                        {report.selected_subreddits?.[0]
                          ? `r/${report.selected_subreddits[0]}`
                          : 'Report'}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatReportDate(report.generated_at)}
                        {report.threads_found > 0 ? ` · ${report.threads_found} threads` : ''}
                        {report.high_priority_count > 0 ? ` · ${report.high_priority_count} high priority` : ''}
                      </p>
                      {report.audience_name && (
                        <span className="text-xs text-[#4B6BF5] inline-flex items-center gap-1 truncate max-w-[200px] mt-0.5">
                          👥 {report.audience_name}
                        </span>
                      )}
                    </div>
                    <StatusBadge status={report.status} />
                  </div>

                  <p className="text-sm text-gray-500 mb-2">
                    {report.subreddits_scanned} {report.subreddits_scanned === 1 ? 'subreddit' : 'subreddits'} · {report.threads_found} threads ·{' '}
                    {report.high_priority_count} high priority
                  </p>

                  {report.strategy_note && (
                    <div className="overflow-hidden mb-3">
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {report.strategy_note.slice(0, 120)}
                        {report.strategy_note.length > 120 ? '...' : ''}
                      </p>
                    </div>
                  )}

                  {report.status === 'complete' && (
                    <Link
                      href={`/dashboard/report/${report.id}`}
                      className="text-sm font-medium bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent hover:opacity-80 transition inline-flex items-center min-h-[44px]"
                    >
                      View Report →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
