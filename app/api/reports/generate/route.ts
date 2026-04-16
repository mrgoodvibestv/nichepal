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

    if ((profile.credits ?? 0) < 1) {
      return NextResponse.json({ error: 'No credits remaining' }, { status: 400 })
    }

    const subToScan: string =
      subreddit ||
      (profile.target_subreddits as string[] | null ?? [])[0] ||
      ''

    if (!subToScan) {
      return NextResponse.json({ error: 'No subreddit specified' }, { status: 400 })
    }

    const maxPostCount = 15
    const maxItems = 35  // single subreddit: 15 posts + 20 buffer

    // Pre-validate: check Reddit has posts before spending a credit
    try {
      const redditCheck = await fetch(
        `https://www.reddit.com/r/${subToScan}/hot.json?limit=5`,
        { headers: { 'User-Agent': 'NichePal/1.0' } }
      )
      if (redditCheck.ok) {
        const redditData = await redditCheck.json()
        const posts = redditData?.data?.children ?? []
        const postCount = posts.length as number
        const now = Date.now() / 1000
        const recentPosts = posts.filter(
          (p: { data?: { created_utc?: number } }) =>
            (p.data?.created_utc ?? 0) > now - 60 * 60 * 24 * 30
        )
        if (postCount < 5 || recentPosts.length === 0) {
          return NextResponse.json(
            { error: `r/${subToScan} doesn't have enough recent activity to generate a useful report. Try r/investing, r/personalfinance, or r/wallstreetbets instead.` },
            { status: 400 }
          )
        }
      }
    } catch {
      console.log('[generate] reddit pre-check failed, proceeding')
    }

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
          subreddits: [subToScan],
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
