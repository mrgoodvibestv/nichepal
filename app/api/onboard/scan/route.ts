import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function fetchWebsiteContent(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NichePal/1.0; +https://nichepal.com)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000)
    return text || null
  } catch {
    return null
  }
}

async function isSubredditActive(sub: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.reddit.com/r/${sub}/hot.json?limit=5`,
      {
        headers: { 'User-Agent': 'NichePal/1.0' },
        signal: AbortSignal.timeout(3000),
      }
    )
    if (!res.ok) return false
    const data = await res.json()
    const posts = data?.data?.children ?? []
    if (posts.length < 3) return false
    const now = Date.now() / 1000
    const recentPosts = posts.filter(
      (p: { data?: { created_utc?: number } }) =>
        (p.data?.created_utc ?? 0) > now - 60 * 60 * 24 * 30
    )
    return recentPosts.length >= 1
  } catch {
    return true // on error, give benefit of the doubt
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL required' }, { status: 400 })
    }

    const content = await fetchWebsiteContent(url)
    if (!content) {
      return NextResponse.json({ error: 'Could not reach that URL' }, { status: 400 })
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system:
        'You analyze business websites to build Reddit community engagement profiles. Return ONLY valid JSON. No markdown, no explanation, no code blocks.',
      messages: [
        {
          role: 'user',
          content: `Analyze this website and return a JSON object with exactly these fields:
{
  "business_name": string,
  "positioning": string (2-3 sentences: what they do and who they serve),
  "keywords": string[] (exactly 12 Reddit search terms their audience uses — mix direct product terms and adjacent community terms),
  "tone": string (one of exactly: "expert", "peer-to-peer", "challenger", "storyteller" — pick the best fit),
  "audiences": [
    {
      "id": string (kebab-case slug, e.g. "early-stage-founders"),
      "name": string (2-3 words, e.g. "Early-stage founders"),
      "description": string (1-2 sentences: who they are and what they care about),
      "goal": string (1 sentence: what the business wants them to do),
      "subreddits": string[] (up to 5 subreddits without r/ prefix most relevant to THIS audience)
    }
  ]
}

Rules for audiences:
- Return 2 audiences minimum, 4 maximum
- Only return 3 or 4 if they are genuinely distinct and clearly evidenced by the website
- Each audience must have meaningfully different subreddits
- The subreddits for each audience should be where THAT specific audience hangs out
- Do NOT include a top-level target_subreddits field — subreddits live inside each audience

For each audience's subreddits array, ONLY suggest subreddits that you know with high confidence meet ALL of these criteria:
- Have at least 10,000 members
- Have regular posting activity (at least a few posts per week)
- Are communities you are certain actually exist
- Are NOT subreddits you are guessing at or inventing

You may include niche subreddits if you are confident they are genuinely active. A tight niche community with 15k members posting daily is better than a large community that has gone quiet.

The key filter is ACTIVITY not size. Only suggest subreddits where you are confident there are real conversations happening regularly right now.

If you are not confident a subreddit is real and active, DO NOT include it. It is better to suggest 3 subreddits you are certain about than 6 where some are guesses.

NEVER invent subreddit names that sound plausible — only suggest communities you know are real and posting regularly.

Website content:
${content}`,
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const data = JSON.parse(cleaned)

    // Validate subreddit activity in parallel — strip dead/invented communities
    const audiences = (data.audiences ?? []) as {
      id: string
      name: string
      description: string
      goal: string
      subreddits: string[]
    }[]

    const validatedAudiences = await Promise.all(
      audiences.map(async aud => {
        const results = await Promise.all(
          aud.subreddits.map(async (sub: string) => ({
            sub,
            active: await isSubredditActive(sub),
          }))
        )
        const activeSubs = results.filter(r => r.active).map(r => r.sub)
        console.log(
          `[scan] "${aud.name}": ${aud.subreddits.length} suggested,`,
          `${activeSubs.length} active:`, activeSubs
        )
        return { ...aud, subreddits: activeSubs }
      })
    )

    return NextResponse.json({ ...data, audiences: validatedAudiences })
  } catch (err: unknown) {
    console.error('[onboard/scan]', err)
    return NextResponse.json({ error: 'Scan failed. Please try again.' }, { status: 500 })
  }
}
