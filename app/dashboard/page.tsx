import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

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

  return (
    <DashboardClient
      reports={(reports ?? []) as Report[]}
      credits={profile?.credits ?? 0}
    />
  )
}
