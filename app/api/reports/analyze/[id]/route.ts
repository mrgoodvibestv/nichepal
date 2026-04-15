import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // ── 1. Auth + ownership check (user client, RLS enforced) ──
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: reportCheck, error: checkError } = await supabase
      .from('reports')
      .select('id, status, apify_dataset_id, profile_id')
      .eq('id', params.id)
      .single()

    if (checkError || !reportCheck) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // ── 2. Guard against double-run ──
    if (reportCheck.status !== 'generating') {
      return NextResponse.json({ status: reportCheck.status })
    }

    if (!reportCheck.apify_dataset_id) {
      return NextResponse.json({ error: 'Dataset not ready' }, { status: 400 })
    }

    // ── 3. All subsequent DB ops via service client ──
    const db = createServiceClient()
    const token = process.env.APIFY_API_TOKEN!
    const { profile_id: profileId, apify_dataset_id: datasetId } = reportCheck

    // ── 4. Fetch profile for Claude context ──
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('business_name, positioning, keywords, target_subreddits')
      .eq('id', profileId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // ── 5. Fetch Apify dataset ──
    const datasetRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&limit=50`
    )
    const allItems: unknown[] = await datasetRes.json()
    const scrapedPosts = Array.isArray(allItems)
      ? allItems.filter(
          (p: unknown) => (p as Record<string, unknown>).dataType !== 'community'
        )
      : []

    if (scrapedPosts.length === 0) {
      await db.from('reports').update({ status: 'failed' }).eq('id', params.id)
      return NextResponse.json({ error: 'No posts in dataset' }, { status: 422 })
    }

    // ── 6. Deduplicate: filter URLs seen this week ──
    const weekStart = new Date()
    weekStart.setHours(0, 0, 0, 0)
    const dow = weekStart.getDay()
    weekStart.setDate(weekStart.getDate() - (dow === 0 ? 6 : dow - 1))

    const { data: weekReports } = await db
      .from('reports')
      .select('id')
      .eq('profile_id', profileId)
      .neq('id', params.id) // exclude the current report
      .gte('generated_at', weekStart.toISOString())

    const weekReportIds = (weekReports ?? []).map(r => r.id)
    const seenUrls = new Set<string>()

    if (weekReportIds.length > 0) {
      const { data: seenThreads } = await db
        .from('threads')
        .select('url')
        .in('report_id', weekReportIds)
      ;(seenThreads ?? []).forEach(t => seenUrls.add(t.url as string))
    }

    const freshPosts = scrapedPosts.filter((p: unknown) => {
      const post = p as Record<string, unknown>
      return post.url && !seenUrls.has(post.url as string)
    })
    const postsToAnalyze = freshPosts.length > 0 ? freshPosts : scrapedPosts

    // Count subreddits actually seen in this dataset
    const subredditsScanned = new Set(
      scrapedPosts
        .map((p: unknown) => (p as Record<string, unknown>).subreddit as string)
        .filter(Boolean)
    ).size

    // ── 7. Claude analysis ──
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: 'You are a Reddit intelligence analyst. Return ONLY valid JSON, no markdown, no code blocks.',
      messages: [
        {
          role: 'user',
          content: `Business: ${profile.business_name ?? ''}
Positioning: ${profile.positioning ?? ''}
Keywords: ${(profile.keywords as string[] | null ?? []).join(', ')}

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
- Max 20 threads, sorted by priority (high first) then relevance_score desc
- thread_type: trending = posted <48hrs and >50 upvotes, rising = gaining traction, evergreen = always relevant topic
- priority high = engage within 24 hours, medium = engage this week
- comment_template must be authentic and non-promotional — add genuine value to the conversation

Posts to analyze:
${JSON.stringify(postsToAnalyze.slice(0, 25))}`,
        },
      ],
    })

    // ── 8. Parse Claude response ──
    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed: { strategy_note: string; threads: Thread[] } = JSON.parse(cleaned)

    const threads = parsed.threads ?? []
    const highPriorityCount = threads.filter(t => t.priority === 'high').length

    // ── 9. Update report + insert threads ──
    await db
      .from('reports')
      .update({
        status: 'complete',
        strategy_note: parsed.strategy_note,
        subreddits_scanned: subredditsScanned,
        threads_found: threads.length,
        high_priority_count: highPriorityCount,
      })
      .eq('id', params.id)

    if (threads.length > 0) {
      await db.from('threads').insert(
        threads.map(t => ({
          report_id: params.id,
          ...t,
          upvote_ratio: t.upvote_ratio ?? 0,
          engaged: false,
        }))
      )
    }

    console.log(`[reports/analyze] Report ${params.id} complete — ${threads.length} threads`)
    // Total time: ~8-10s ✅
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('[reports/analyze]', err)
    const db = createServiceClient()
    await db.from('reports').update({ status: 'failed' }).eq('id', params.id)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
