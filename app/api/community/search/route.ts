import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { deductCredit } from '@/lib/credits'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type SubredditSuggestion = {
  name: string
  reason: string
  estimated_size: string
}

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

    const { query } = await req.json()
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 })
    }

    // Check credits — community search costs 2
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, credits')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if ((profile.credits ?? 0) < 2) {
      return NextResponse.json(
        { error: 'Not enough credits. Community search costs 2 credits.' },
        { status: 400 }
      )
    }

    // Deduct 2 credits upfront
    await deductCredit(profile.id, 'community_search')
    await deductCredit(profile.id, 'community_search')

    // Step 1: Claude suggests subreddits
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system:
        'You are a Reddit community expert. When given a topic, suggest real active subreddits where that audience spends time. Only suggest communities you are certain exist and have at least 10,000 members with regular activity. Never invent subreddit names. Return ONLY valid JSON.',
      messages: [
        {
          role: 'user',
          content: `Topic: ${query.trim()}

Return a JSON array of 8-10 subreddit suggestions:
[{
  "name": "subreddit name without r/ prefix",
  "reason": "one sentence why this community is relevant",
  "estimated_size": "small (10k-50k) | medium (50k-500k) | large (500k+)"
}]

Only include subreddits you are highly confident exist and are actively posting. No guesses.`,
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '[]'
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed: SubredditSuggestion[] = JSON.parse(cleaned)
    const suggestions = Array.isArray(parsed) ? parsed.slice(0, 8) : []

    if (suggestions.length === 0) {
      return NextResponse.json({ results: [] })
    }

    // Step 2: Start Apify run for all suggested subreddits
    const token = process.env.APIFY_API_TOKEN!
    const apifyInput = {
      subreddits: suggestions.map(s => s.name),
      startUrls: suggestions.map(s => ({ url: `https://www.reddit.com/r/${s.name}/` })),
      maxItems: suggestions.length * 3,
      maxPostCount: 3,
      skipComments: true,
      sort: 'hot',
      minScore: 1,
      proxy: { useApifyProxy: true },
    }

    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/betterdevsscrape~reddit-scraper/runs?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apifyInput),
      }
    )

    if (!apifyRes.ok) {
      // Return Claude suggestions without activity verification
      return NextResponse.json({
        results: suggestions.map(s => ({
          ...s,
          post_count: 0,
          active: false,
          sample_titles: [],
        })),
      })
    }

    const apifyData = await apifyRes.json()
    const runId: string = apifyData?.data?.id ?? ''
    const datasetId: string = apifyData?.data?.defaultDatasetId ?? ''

    if (!runId) {
      return NextResponse.json({
        results: suggestions.map(s => ({
          ...s,
          post_count: 0,
          active: false,
          sample_titles: [],
        })),
      })
    }

    // Step 3: Poll for completion (max 30s)
    let succeeded = false
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      try {
        const statusRes = await fetch(
          `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
        )
        const statusData = await statusRes.json()
        const status: string = statusData?.data?.status ?? ''
        if (status === 'SUCCEEDED') { succeeded = true; break }
        if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') break
      } catch {
        break
      }
    }

    if (!succeeded) {
      // Timeout — return suggestions without post_count
      return NextResponse.json({
        results: suggestions.map(s => ({
          ...s,
          post_count: 0,
          active: false,
          sample_titles: [],
        })),
      })
    }

    // Step 4: Fetch dataset items
    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&limit=${suggestions.length * 5}`
    )
    const allItems: unknown[] = await itemsRes.json()

    const posts = Array.isArray(allItems)
      ? allItems.filter(
          (p: unknown) => (p as Record<string, unknown>).dataType !== 'community'
        )
      : []

    // Debug: log first item shape to understand Apify field names
    if (Array.isArray(allItems) && allItems.length > 0) {
      console.log('[community/search] sample item fields:', JSON.stringify(allItems[0]).slice(0, 300))
    }

    // Step 5: Count posts and sample titles per subreddit (case-insensitive)
    const postsBySubreddit = new Map<string, string[]>()
    for (const p of posts) {
      const post = p as Record<string, unknown>
      // Apify may return communityName or subreddit — check both, case-insensitive
      const sub = (
        (post.communityName as string) ||
        (post.subreddit as string) ||
        ''
      ).toLowerCase()
      const title = (post.title as string) || ''
      if (!sub) continue
      if (!postsBySubreddit.has(sub)) postsBySubreddit.set(sub, [])
      postsBySubreddit.get(sub)!.push(title)
    }

    // Step 6: Build sorted results
    console.log('[community/search] post counts:', suggestions.map(s => ({
      name: s.name,
      count: postsBySubreddit.get(s.name.toLowerCase())?.length ?? 0,
    })))

    const results = suggestions
      .map(s => {
        const titles = postsBySubreddit.get(s.name.toLowerCase()) ?? []
        const post_count = titles.length
        return {
          name: s.name,
          reason: s.reason,
          estimated_size: s.estimated_size,
          post_count,
          active: post_count >= 2,
          sample_titles: titles.slice(0, 2),
        }
      })
      .sort((a, b) => b.post_count - a.post_count)

    return NextResponse.json({ results })
  } catch (err: unknown) {
    console.error('[community/search]', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
