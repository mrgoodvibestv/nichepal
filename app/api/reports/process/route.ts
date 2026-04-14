import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'

// Vercel Pro: 300s max duration. Hobby: set to 60 and accept Apify may not finish.
export const maxDuration = 300

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type Thread = {
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
}

export async function POST(req: NextRequest) {
  // ── 1. Verify internal secret ──
  const secret = req.headers.get('x-internal-secret')
  if (!secret || secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { reportId, profileId, selectedSubreddits, package: tier } = await req.json()
  if (!reportId || !profileId) {
    return NextResponse.json({ error: 'Missing reportId or profileId' }, { status: 400 })
  }

  const db = createServiceClient()
  const token = process.env.APIFY_API_TOKEN!

  try {
    // ── 2. Fetch profile ──
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('id, business_name, positioning, keywords, target_subreddits, tone')
      .eq('id', profileId)
      .single()

    if (profileError || !profile) throw new Error('Profile not found')

    // ── 3. Resolve subreddits and tier ──
    const subreddits: string[] =
      selectedSubreddits && selectedSubreddits.length > 0
        ? selectedSubreddits
        : (profile.target_subreddits as string[] | null ?? []).slice(0, 5)

    const maxPostCount = tier === 'growth' ? 5 : 3
    const maxItems = subreddits.length * maxPostCount + 5 // small buffer

    // ── 4. Start Apify Reddit scraper ──
    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/betterdevsscrape~reddit-scraper/runs?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subreddits,
          maxItems,
          maxPostCount,
          skipComments: true,
          sort: 'hot',
          minScore: 5,
          proxy: { useApifyProxy: true },
        }),
      }
    )

    if (!apifyRes.ok) throw new Error(`Apify start failed: ${apifyRes.status}`)
    const apifyData = await apifyRes.json()
    const runId: string = apifyData?.data?.id
    let datasetId: string = apifyData?.data?.defaultDatasetId ?? ''
    if (!runId) throw new Error('No Apify run ID returned')

    // ── 5. Poll for completion (every 5s, max 120 attempts = 10 min) ──
    let succeeded = false
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 5000))
      try {
        const pollRes = await fetch(
          `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
        )
        const pollData = await pollRes.json()
        const status: string = pollData?.data?.status ?? ''
        datasetId = pollData?.data?.defaultDatasetId || datasetId

        if (status === 'SUCCEEDED') { succeeded = true; break }
        if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
          throw new Error(`Apify run ended with status: ${status}`)
        }
      } catch (pollErr) {
        console.warn('[reports/process] poll error (will retry):', pollErr)
      }
    }

    if (!succeeded) throw new Error('Apify run did not complete within timeout')

    // ── 6. Fetch dataset items ──
    const datasetRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&limit=50`
    )
    const allItems: Array<Record<string, unknown>> = await datasetRes.json()
    // Filter out community items — only want posts
    const scrapedPosts = allItems.filter(item => item.dataType !== 'community')

    if (scrapedPosts.length === 0) throw new Error('No posts returned from Apify dataset')

    // ── 7. Deduplicate: filter out URLs seen this week for this profile ──
    const weekStart = new Date()
    weekStart.setHours(0, 0, 0, 0)
    // Roll back to Monday
    const dayOfWeek = weekStart.getDay()
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    weekStart.setDate(weekStart.getDate() - daysToMonday)

    const { data: seenThreads } = await db
      .from('threads')
      .select('url')
      .in(
        'report_id',
        (
          await db
            .from('reports')
            .select('id')
            .eq('profile_id', profileId)
            .gte('generated_at', weekStart.toISOString())
        ).data?.map(r => r.id) ?? []
      )

    const seenUrls = new Set((seenThreads ?? []).map(t => t.url as string))
    const freshPosts = scrapedPosts.filter(
      post => post.url && !seenUrls.has(post.url as string)
    )
    // Fall back to all scraped posts if everything has been seen (edge case)
    const postsToAnalyze = freshPosts.length > 0 ? freshPosts : scrapedPosts

    // ── 8. Claude analysis ──
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system:
        'You are a Reddit intelligence analyst. Return ONLY valid JSON, no markdown, no code blocks.',
      messages: [
        {
          role: 'user',
          content: `Business: ${profile.business_name ?? ''}
Positioning: ${profile.positioning ?? ''}
Keywords: ${(profile.keywords as string[])?.join(', ') ?? ''}

Analyze these Reddit posts for relevance to this business. Return a JSON object:
{
  "strategy_note": "2-3 sentence weekly Reddit strategy for this business",
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
      "why_engage": string (one sentence),
      "comment_template": string (2-3 authentic sentences adding genuine value),
      "body_snippet": string (first 150 chars of post body, empty string if no body)
    }
  ]
}

Rules:
- Only include threads with relevance_score >= 5
- Max 20 threads
- Sort by priority (high first) then relevance_score desc
- thread_type: trending = posted <48hrs and >50 upvotes, rising = gaining traction, evergreen = always relevant topic
- priority high = engage within 24 hours, medium = engage this week
- comment_template must be authentic and non-promotional — add genuine value to the conversation

Posts to analyze:
${JSON.stringify(postsToAnalyze.slice(0, 25))}`,
        },
      ],
    })

    // ── 9. Parse Claude response ──
    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed: { strategy_note: string; threads: Thread[] } = JSON.parse(cleaned)

    const threads = parsed.threads ?? []
    const highPriorityCount = threads.filter(t => t.priority === 'high').length

    // ── 10. Update report + insert threads ──
    await db
      .from('reports')
      .update({
        status: 'complete',
        strategy_note: parsed.strategy_note,
        subreddits_scanned: subreddits.length,
        threads_found: threads.length,
        high_priority_count: highPriorityCount,
      })
      .eq('id', reportId)

    if (threads.length > 0) {
      await db.from('threads').insert(
        threads.map(t => ({
          report_id: reportId,
          ...t,
          upvote_ratio: t.upvote_ratio ?? 0,
          engaged: false,
        }))
      )
    }

    console.log(`[reports/process] Report ${reportId} complete — ${threads.length} threads`)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('[reports/process] error:', err)
    await db.from('reports').update({ status: 'failed' }).eq('id', reportId)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
