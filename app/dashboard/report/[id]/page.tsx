import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ReportFilters from './ReportFilters'

export type Thread = {
  id: string
  subreddit: string
  title: string
  url: string
  author: string | null
  upvotes: number
  num_comments: number
  upvote_ratio: number
  posted_at: string | null
  thread_type: 'trending' | 'rising' | 'evergreen'
  priority: 'high' | 'medium'
  relevance_score: number
  why_engage: string | null
  comment_template: string | null
  body_snippet: string | null
  engaged: boolean
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function ReportPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get user's profile id for ownership check
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  // Fetch report — RLS + explicit profile_id check
  const { data: report } = await supabase
    .from('reports')
    .select('id, status, generated_at, strategy_note, subreddits_scanned, threads_found, high_priority_count, audience_name, selected_subreddits')
    .eq('id', params.id)
    .eq('profile_id', profile.id)
    .single()

  if (!report) notFound()

  // Fetch all threads for this report
  const { data: threads } = await supabase
    .from('threads')
    .select(
      'id, subreddit, title, url, author, upvotes, num_comments, upvote_ratio, posted_at, thread_type, priority, relevance_score, why_engage, comment_template, body_snippet, engaged'
    )
    .eq('report_id', report.id)
    .order('relevance_score', { ascending: false })

  const threadList: Thread[] = threads ?? []
  const subredditTitle = (report.selected_subreddits as string[] | null)?.[0]

  return (
    <div>
      {/* Report header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        <Link
          href="/dashboard"
          className="text-sm text-gray-500 hover:text-black transition mb-3 inline-block py-1"
        >
          ← Reports
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-black mb-0.5 truncate" title={subredditTitle ? `r/${subredditTitle}` : 'Report'}>
              {subredditTitle ? `r/${subredditTitle}` : 'Report'}
            </h1>
            <p className="text-sm text-gray-400 mb-2">{formatDate(report.generated_at)}</p>
            {report.audience_name && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent mb-2">
                👥 {report.audience_name}
              </span>
            )}
            {report.strategy_note && (
              <p className="text-sm text-gray-600 italic max-w-2xl">{report.strategy_note}</p>
            )}
          </div>
          <p className="text-sm text-gray-500 sm:shrink-0 sm:ml-6 sm:mt-1 flex flex-wrap gap-x-3 gap-y-1 sm:justify-end">
            <span>{report.subreddits_scanned} {report.subreddits_scanned === 1 ? 'subreddit' : 'subreddits'}</span>
            <span>{report.threads_found} threads</span>
            <span>{report.high_priority_count} high priority</span>
          </p>
        </div>
      </div>

      {/* Filters + thread list */}
      <ReportFilters threads={threadList} />
    </div>
  )
}
