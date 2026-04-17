import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    const body = await req.json()
    const {
      url,
      business_name,
      positioning,
      keywords,
      tone,
      audiences,
      target_subreddits: rawTargetSubreddits,
      package: pkg,
    } = body

    const upsertData: Record<string, unknown> = {
      user_id: user.id,
      url,
      business_name,
      positioning,
      keywords,
      tone,
      onboarded: true,
    }

    if (audiences !== undefined) {
      upsertData.audiences = audiences
      upsertData.target_subreddits = (audiences as Array<{ subreddits?: string[] }>).flatMap(
        a => a.subreddits ?? []
      )
    } else if (rawTargetSubreddits !== undefined) {
      upsertData.target_subreddits = rawTargetSubreddits
    }

    if (pkg !== undefined) upsertData.package = pkg

    const { error } = await supabase.from('profiles').upsert(upsertData, { onConflict: 'user_id' })

    if (error) {
      console.error('[profile/save]', error)
      return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('[profile/save]', err)
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }
}
