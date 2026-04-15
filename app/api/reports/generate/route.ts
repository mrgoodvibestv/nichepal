import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { deductCredit } from '@/lib/credits'
import { runReportGeneration } from '@/lib/generateReport'

const MAX_SELECTED = 5

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { selectedSubreddits } = await req.json().catch(() => ({})) as {
      selectedSubreddits?: string[]
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, credits, package, target_subreddits')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if ((profile.credits ?? 0) < 1) {
      return NextResponse.json({ error: 'No credits remaining' }, { status: 400 })
    }

    const subsToScan: string[] =
      selectedSubreddits && selectedSubreddits.length > 0
        ? selectedSubreddits.slice(0, MAX_SELECTED)
        : (profile.target_subreddits as string[] | null ?? []).slice(0, 5)

    // Use service client for report insert (consistent with background work)
    const db = createServiceClient()
    const { data: report, error: reportError } = await db
      .from('reports')
      .insert({ profile_id: profile.id, status: 'generating' })
      .select('id')
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
    }

    // Deduct credit while request context is still active
    await deductCredit(profile.id, 'Report generation')

    // waitUntil keeps the serverless function alive after the response is sent
    waitUntil(
      runReportGeneration({
        reportId: report.id,
        profileId: profile.id,
        selectedSubreddits: subsToScan,
        tier: (profile.package as string) ?? 'starter',
      })
    )

    return NextResponse.json({ reportId: report.id })
  } catch (err: unknown) {
    console.error('[reports/generate]', err)
    return NextResponse.json({ error: 'Failed to start generation' }, { status: 500 })
  }
}
