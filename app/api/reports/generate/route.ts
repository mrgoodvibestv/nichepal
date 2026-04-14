import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { deductCredit } from '@/lib/credits'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type Profile = {
  id: string
  business_name: string | null
  positioning: string | null
  keywords: string[]
  target_subreddits: string[]
  tone: string
}

async function pollApifyRun(
  runId: string,
  token: string,
  maxMs = 180_000
): Promise<{ defaultDatasetId: string } | null> {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    await new Promise(r => setTimeout(r, 3000))
    try {
      const res = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
      )
      const data = await res.json()
      const status: string = data?.data?.status ?? ''
      if (status === 'SUCCEEDED') return { defaultDatasetId: data.data.defaultDatasetId }
      if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') return null
    } catch {
      // keep polling
    }
  }
  return null
}

async function runGeneration(reportId: string, profile: Profile) {
  const db = createServiceClient()
  const token = process.env.APIFY_API_TOKEN!

  try {
    // ── 1. Start Apify Reddit scraper ──
    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/betterdevsscrape~reddit-scraper/runs?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: profile.target_subreddits.map(sub => ({
            url: `https://www.reddit.com/r/${sub}/hot/`,
          })),
          searches: profile.keywords,
          maxItems: 50,
          sort: 'relevance',
          type: 'posts',
        }),
      }
    )

    if (!apifyRes.ok) throw new Error(`Apify start failed: ${apifyRes.status}`)
    const apifyData = await apifyRes.json()
    const runId: string = apifyData?.data?.id
    if (!runId) throw new Error('No Apify run ID')

    // ── 2. Poll until complete ──
    const result = await pollApifyRun(runId, token)
    if (!result) throw new Error('Apify run failed or timed out')

    // ── 3. Fetch dataset items ──
    const datasetRes = await fetch(
      `https://api.apify.com/v2/datasets/${result.defaultDatasetId}/items?token=${token}&limit=50`
    )
    const posts: unknown[] = await datasetRes.json()
    if (!Array.isArray(posts) || posts.length === 0) throw new Error('No posts scraped')

    // ── 4. Claude analysis ──
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: 'You are a Reddit intelligence analyst. Return ONLY valid JSON, no markdown.',
      messages: [
        {
          role: 'user',
          content: `Business: ${profile.business_name ?? ''}
Positioning: ${profile.positioning ?? ''}
Keywords: ${profile.keywords.join(', ')}

Analyze these Reddit posts and return JSON:
{
  "strategy_note": string,
  "threads": [
    {
      "subreddit": string,
      "title": string,
      "url": string,
      "author": string,
      "upvotes": number,
      "num_comments": number,
      "upvote_ratio": number,
      "posted_at": string (ISO 8601),
      "thread_type": "trending" | "rising" | "evergreen",
      "priority": "high" | "medium",
      "relevance_score": number (1-10),
      "why_engage": string,
      "comment_template": string,
      "body_snippet": string
    }
  ]
}

Rules:
- Only include threads with relevance_score >= 5
- Max 20 threads, sorted by priority (high first) then relevance_score desc
- thread_type: trending=high velocity, rising=gaining traction, evergreen=evergreen topic

Posts:
${JSON.stringify(posts.slice(0, 50))}`,
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const analysis: {
      strategy_note: string
      threads: Array<{
        subreddit: string
        title: string
        url: string
        author: string
        upvotes: number
        num_comments: number
        upvote_ratio: number
        posted_at: string
        thread_type: 'trending' | 'rising' | 'evergreen'
        priority: 'high' | 'medium'
        relevance_score: number
        why_engage: string
        comment_template: string
        body_snippet: string
      }>
    } = JSON.parse(cleaned)

    const highPriorityCount = analysis.threads.filter(t => t.priority === 'high').length
    const subredditsScanned = new Set(analysis.threads.map(t => t.subreddit)).size

    // ── 5. Update report ──
    await db
      .from('reports')
      .update({
        status: 'complete',
        strategy_note: analysis.strategy_note,
        subreddits_scanned: subredditsScanned,
        threads_found: analysis.threads.length,
        high_priority_count: highPriorityCount,
      })
      .eq('id', reportId)

    // ── 6. Insert threads ──
    if (analysis.threads.length > 0) {
      await db.from('threads').insert(
        analysis.threads.map(t => ({
          report_id: reportId,
          ...t,
        }))
      )
    }
  } catch (err: unknown) {
    console.error('[reports/generate background]', err)
    await db.from('reports').update({ status: 'failed' }).eq('id', reportId)
  }
}

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, business_name, positioning, keywords, target_subreddits, tone, credits')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if ((profile.credits ?? 0) < 1) {
      return NextResponse.json({ error: 'No credits remaining' }, { status: 400 })
    }

    // Create report row
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({ profile_id: profile.id, status: 'generating' })
      .select('id')
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
    }

    // Deduct credit (while request context is still active)
    await deductCredit(profile.id, 'Report generation')

    // Fire-and-forget background generation
    ;(async () => {
      await runGeneration(report.id, profile as Profile)
    })().catch(err => console.error('[reports/generate fire-and-forget]', err))

    return NextResponse.json({ reportId: report.id })
  } catch (err: unknown) {
    console.error('[reports/generate]', err)
    return NextResponse.json({ error: 'Failed to start generation' }, { status: 500 })
  }
}
