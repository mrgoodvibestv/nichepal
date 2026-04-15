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
      .select('id, status, apify_dataset_id, profile_id, selected_subreddits, audience_id, audience_name, audience_description, audience_goal')
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

    // ── 4. Fetch profile for Claude context + tier ──
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('business_name, positioning, keywords, target_subreddits, package')
      .eq('id', profileId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // ── 5. Fetch Apify dataset ──
    const datasetRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&limit=100`
    )
    const allItems: unknown[] = await datasetRes.json()

    // Debug: surface Apify response shape in Vercel logs
    if (Array.isArray(allItems)) {
      const rawItems = allItems as Record<string, unknown>[]
      console.log('[analyze] apify dataset:', {
        total: rawItems.length,
        communityItems: rawItems.filter(x => x.dataType === 'community').length,
        postItems: rawItems.filter(x => x.dataType !== 'community').length,
        dataTypes: Array.from(new Set(rawItems.map(x => x.dataType))),
      })
    }

    const scrapedPosts = Array.isArray(allItems)
      ? allItems.filter(
          (p: unknown) => (p as Record<string, unknown>).dataType !== 'community'
        )
      : []

    // No hard-fail on empty posts — pass empty array to Claude for graceful degradation.
    // Claude will return strategy_note + empty threads; report is marked complete with 0 threads.

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

    // Tier-based thread cap: growth users get more output from Claude
    const selectedSubs = (reportCheck.selected_subreddits as string[] | null) ?? []
    const maxThreads = (profile.package as string) === 'growth' ? 15 : 9

    // Build audience context block if this report has a targeted audience
    const audienceName = (reportCheck.audience_name as string | null) ?? ''
    const audienceContext = audienceName
      ? `\nTarget Audience: ${audienceName}\nWho they are: ${reportCheck.audience_description ?? ''}\nGoal: ${reportCheck.audience_goal ?? ''}\n`
      : ''

    const engagementGoal = (reportCheck.audience_goal as string | null) ?? 'grow awareness and engagement'

    // ── 7. Claude analysis ──
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: 'You are a Reddit engagement strategist helping a business build authentic presence in communities where their target audience already spends time. You understand that the best community engagement is never direct promotion — it\'s a knowledgeable person sharing genuine perspective that happens to reflect their experience and worldview.\n\nReturn ONLY valid JSON, no markdown, no code blocks.',
      messages: [
        {
          role: 'user',
          content: `Business: ${profile.business_name ?? ''}
Positioning: ${profile.positioning ?? ''}
Keywords: ${(profile.keywords as string[] | null ?? []).join(', ')}
${audienceContext}
Your job is to find Reddit threads where someone from this business can show up as a knowledgeable, credible voice — NOT as a brand, but as a person with relevant expertise and perspective.
${audienceName ? '\nThe goal with ' + audienceName + ': ' + engagementGoal : ''}

IMPORTANT — Think creatively about relevance:
- Threads do NOT need to be about this business's product directly
- Look for threads where the TARGET AUDIENCE is venting, asking questions, or debating topics adjacent to what this business knows about
- The best threads are where someone with this business's background could add a genuinely useful perspective that naturally reflects how they see the world
- Example: A film equity crowdfunding platform engaging retail investors doesn't need to find threads about film investing — they should find threads about stock market frustration, portfolio diversification, or alternative assets, and show up as someone who solved that problem differently
- The comment template should sound like a smart practitioner sharing hard-won perspective, not a marketer

Reject threads ONLY if:
- The audience is completely unrelated (e.g. gaming threads for a B2B fintech)
- There is genuinely no angle to add value without it feeling forced or random

STRATEGY NOTE:
${audienceName
  ? 'For strategy_note: Write 2-3 sentences on how to engage ' + audienceName + ' this week — be specific about the indirect angle, what persona to adopt, and what topics to own'
  : 'For strategy_note: Write 2-3 sentences on Reddit strategy this week — be specific about topics, persona, and indirect angles'}

FIELD NOTES:
- why_engage: explain the INDIRECT angle — why this thread, what persona, what unique value
- comment_template: write as a knowledgeable practitioner — no brand mentions, no CTAs, sounds like a real person
- body_snippet: first 150 chars of post body, or empty string
- thread_type values: trending (posted <48hrs and >50 upvotes), rising (gaining traction), evergreen (always relevant)
- priority values: high (engage within 24 hours), medium (engage this week)
- relevance_score: 1-10 integer

Return a JSON object with EXACTLY this structure:
{
  "strategy_note": "string",
  "threads": [{
    "subreddit": "string",
    "title": "string",
    "url": "string",
    "author": "string",
    "upvotes": 0,
    "num_comments": 0,
    "upvote_ratio": 0.0,
    "posted_at": "ISO 8601 string",
    "thread_type": "trending",
    "priority": "high",
    "relevance_score": 0,
    "why_engage": "string",
    "comment_template": "string",
    "body_snippet": "string"
  }]
}

Rules:
- Include threads where relevance_score >= 5
- Be generous with relevance for adjacent topics where the audience is present — a 6/10 thread with the right audience beats a 9/10 thread with the wrong one
- Max ${maxThreads} threads, sorted by priority (high first) then relevance_score desc
- If fewer than 3 threads meet the bar, include the best ones and note why in why_engage

Posts to analyze:
${JSON.stringify(postsToAnalyze.slice(0, 40))}`,
        },
      ],
    })

    // ── 8. Parse Claude response ──
    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    let parsed: { strategy_note: string; threads: Thread[] }
    try {
      parsed = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('[analyze] claude raw response:', raw)
      console.error('[analyze] json parse error:', parseErr)
      throw parseErr
    }

    const threads = parsed.threads ?? []
    const highPriorityCount = threads.filter(t => t.priority === 'high').length

    // Count unique subreddits represented in the returned threads
    // (matches what the user sees in the filter dropdown)
    const uniqueSubredditsInThreads = new Set(threads.map(t => t.subreddit)).size
    const subredditsScanned = uniqueSubredditsInThreads > 0
      ? uniqueSubredditsInThreads
      : selectedSubs.length

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
