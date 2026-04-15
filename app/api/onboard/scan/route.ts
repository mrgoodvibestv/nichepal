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
      "subreddits": string[] (4-6 subreddits without r/ prefix most relevant to THIS audience)
    }
  ]
}

Rules for audiences:
- Return 2 audiences minimum, 4 maximum
- Only return 3 or 4 if they are genuinely distinct and clearly evidenced by the website
- Each audience must have meaningfully different subreddits
- The subreddits for each audience should be where THAT specific audience hangs out
- Do NOT include a top-level target_subreddits field — subreddits live inside each audience

Website content:
${content}`,
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const data = JSON.parse(cleaned)

    return NextResponse.json(data)
  } catch (err: unknown) {
    console.error('[onboard/scan]', err)
    return NextResponse.json({ error: 'Scan failed. Please try again.' }, { status: 500 })
  }
}
