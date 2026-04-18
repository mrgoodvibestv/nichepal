import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { deductCredit } from '@/lib/credits'

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

    const {
      subreddit,
      audienceId,
      audienceName,
      audienceDescription,
      audienceGoal,
    } = await req.json().catch(() => ({})) as {
      subreddit?: string
      audienceId?: string
      audienceName?: string
      audienceDescription?: string
      audienceGoal?: string
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, credits, package, target_subreddits')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if ((profile.credits ?? 0) < 3) {
      return NextResponse.json({ error: 'Not enough credits. Reports cost 3 credits.' }, { status: 400 })
    }

    const subToScan: string =
      subreddit ||
      (profile.target_subreddits as string[] | null ?? [])[0] ||
      ''

    if (!subToScan || subToScan.length < 2) {
      return NextResponse.json({ error: 'No subreddit specified' }, { status: 400 })
    }

    const maxPostCount = 15
    const maxItems = 75  // single subreddit with extra buffer

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

    // Start Apify — fire and save run IDs, return immediately
    const token = process.env.APIFY_API_TOKEN!
    const apifyInput = {
      startUrls: [{ url: `https://www.reddit.com/r/${subToScan}/` }],
      subreddits: [subToScan],
      maxItems,
      maxPostCount,
      skipComments: true,
      sort: 'hot',
      minScore: 1,
      proxy: { useApifyProxy: true },
    }
    console.log('[generate] apify input:', JSON.stringify(apifyInput))
    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/betterdevsscrape~reddit-scraper/runs?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apifyInput),
      }
    )

    if (!apifyRes.ok) {
      await db.from('reports').update({ status: 'failed' }).eq('id', report.id)
      return NextResponse.json({ error: 'Failed to start scrape' }, { status: 500 })
    }

    // Deduct 3 credits only after Apify successfully starts.
    // Check return value — a concurrent request could have drained credits
    // between the balance check above and this deduction.
    const deductResult = await deductCredit(profile.id, 'report_generation', 3)
    if (!deductResult.success) {
      await db.from('reports').update({ status: 'failed' }).eq('id', report.id)
      return NextResponse.json({ error: 'Not enough credits' }, { status: 400 })
    }

    const apifyData = await apifyRes.json()
    const runId: string = apifyData?.data?.id ?? ''
    const datasetId: string = apifyData?.data?.defaultDatasetId ?? ''

    if (!runId) {
      await db.from('reports').update({ status: 'failed' }).eq('id', report.id)
      return NextResponse.json({ error: 'No Apify run ID returned' }, { status: 500 })
    }

    // Save run IDs, selected subreddits + audience context for analyze route
    await db
      .from('reports')
      .update({
        apify_run_id: runId,
        apify_dataset_id: datasetId,
        selected_subreddits: [subToScan],
        audience_id: audienceId ?? null,
        audience_name: audienceName ?? null,
        audience_description: audienceDescription ?? null,
        audience_goal: audienceGoal ?? null,
      })
      .eq('id', report.id)

    // Total time: ~2s ✅
    return NextResponse.json({ reportId: report.id })
  } catch (err: unknown) {
    console.error('[reports/generate]', err)
    return NextResponse.json({ error: 'Failed to start generation' }, { status: 500 })
  }
}
