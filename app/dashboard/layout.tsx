import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

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
    <div className="flex h-screen overflow-hidden">
      <Sidebar credits={profile.credits ?? 0} />
      <main className="flex-1 overflow-y-auto bg-gray-50">{children}</main>
    </div>
  )
}
