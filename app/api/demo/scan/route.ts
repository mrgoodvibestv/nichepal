import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function fetchWebsiteContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NichePal/1.0; +https://nichepal.com)' },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000)
    return text || `Website at ${url}`
  } catch {
    return `Website at ${url}`
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL required' }, { status: 400 })
    }

    const content = await fetchWebsiteContent(url)

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system:
        'You analyze websites to identify Reddit engagement opportunities. Return ONLY valid JSON, no markdown.',
      messages: [
        {
          role: 'user',
          content: `Analyze this website and return JSON with exactly these fields:
{
  "business_name": string,
  "subreddits": string[] (exactly 6, without r/ prefix, most relevant first),
  "top_thread_title": string (realistic Reddit thread title their audience would post),
  "top_thread_upvotes": number (realistic, between 200-3000),
  "top_thread_comments": number (realistic),
  "comment_preview": string (first 2 sentences of an authentic comment they could leave — natural, non-promotional, adds genuine value)
}

Website content: ${content}`,
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const data = JSON.parse(raw)

    return NextResponse.json(data)
  } catch (err: unknown) {
    console.error('[demo/scan]', err)
    return NextResponse.json({ error: 'Scan failed. Please try again.' }, { status: 500 })
  }
}
