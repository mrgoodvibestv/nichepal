import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from './DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, credits, onboarded')
    .eq('user_id', user.id)
    .single()

  if (!profile?.onboarded) redirect('/onboarding')

  return (
    <DashboardShell credits={profile.credits ?? 0}>
      {children}
    </DashboardShell>
  )
}
