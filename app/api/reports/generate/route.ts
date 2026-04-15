import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { deductCredit } from '@/lib/credits'

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

    const maxPostCount = 15
    const maxItems = subsToScan.length * 15 + 20

    // Create report row
    const db = createServiceClient()
    const { data: report, error: reportError } = await db
      .from('reports')
      .insert({ profile_id: profile.id, status: 'generating' })
      .select('id')
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
    }

    // Deduct credit
    await deductCredit(profile.id, 'Report generation')

    // Start Apify — fire and save run IDs, return immediately
    const token = process.env.APIFY_API_TOKEN!
    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/betterdevsscrape~reddit-scraper/runs?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subreddits: subsToScan,
          maxItems,
          maxPostCount,
          skipComments: true,
          sort: 'hot',
          minScore: 1,
          proxy: { useApifyProxy: true },
        }),
      }
    )

    if (!apifyRes.ok) {
      await db.from('reports').update({ status: 'failed' }).eq('id', report.id)
      return NextResponse.json({ error: 'Failed to start scrape' }, { status: 500 })
    }

    const apifyData = await apifyRes.json()
    const runId: string = apifyData?.data?.id ?? ''
    const datasetId: string = apifyData?.data?.defaultDatasetId ?? ''

    if (!runId) {
      await db.from('reports').update({ status: 'failed' }).eq('id', report.id)
      return NextResponse.json({ error: 'No Apify run ID returned' }, { status: 500 })
    }

    // Save run IDs + selected subreddits so analyze route can read them
    await db
      .from('reports')
      .update({
        apify_run_id: runId,
        apify_dataset_id: datasetId,
        selected_subreddits: subsToScan,
      })
      .eq('id', report.id)

    // Total time: ~2s ✅
    return NextResponse.json({ reportId: report.id })
  } catch (err: unknown) {
    console.error('[reports/generate]', err)
    return NextResponse.json({ error: 'Failed to start generation' }, { status: 500 })
  }
}
