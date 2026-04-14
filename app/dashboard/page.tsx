import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
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
}

function formatWeekOf(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function StatusBadge({ status }: { status: Report['status'] }) {
  if (status === 'generating') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-yellow-600">
        <span className="w-2 h-2 rounded-full bg-yellow-400" />
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

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, credits')
    .eq('user_id', user.id)
    .single()

  const { data: reports } = await supabase
    .from('reports')
    .select('id, status, week_of, strategy_note, subreddits_scanned, threads_found, high_priority_count, generated_at')
    .eq('profile_id', profile?.id)
    .order('generated_at', { ascending: false })

  const reportList: Report[] = reports ?? []

  return (
    <div>
      {/* Stats bar */}
      <div className="bg-white border-b border-gray-100 px-8 py-4 flex gap-8">
        <div>
          <p className="text-xl font-bold bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent">
            {reportList.length}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Total Reports</p>
        </div>
        <div>
          <p className="text-xl font-bold bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent">
            {profile?.credits ?? 0}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Credits Remaining</p>
        </div>
      </div>

      {/* Report list */}
      <div className="px-8 py-6">
        {reportList.length === 0 ? (
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
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-black">Your Reports</h2>
              <GenerateButton />
            </div>
            <div className="space-y-4">
              {reportList.map(report => (
                <div
                  key={report.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-lg text-black">
                      Week of {formatWeekOf(report.week_of)}
                    </h3>
                    <StatusBadge status={report.status} />
                  </div>

                  <p className="text-sm text-gray-500 mb-2">
                    {report.subreddits_scanned} subreddits · {report.threads_found} threads ·{' '}
                    {report.high_priority_count} high priority
                  </p>

                  {report.strategy_note && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {report.strategy_note.slice(0, 120)}
                      {report.strategy_note.length > 120 ? '...' : ''}
                    </p>
                  )}

                  {report.status === 'complete' && (
                    <Link
                      href={`/dashboard/report/${report.id}`}
                      className="text-sm font-medium bg-gradient-to-r from-[#4B6BF5] to-[#7B4BF5] bg-clip-text text-transparent hover:opacity-80 transition"
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
