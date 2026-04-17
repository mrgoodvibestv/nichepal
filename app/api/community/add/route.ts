import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Audience = {
  id: string
  name: string
  description: string
  goal: string
  subreddits: string[]
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

    const { subreddit, audienceId } = await req.json()

    if (!subreddit || !audienceId) {
      return NextResponse.json({ error: 'subreddit and audienceId required' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, audiences')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const audiences: Audience[] = (profile.audiences as Audience[] | null) ?? []
    const updated = audiences.map(a => {
      if (a.id !== audienceId) return a
      const subs = a.subreddits ?? []
      if (subs.includes(subreddit)) return a
      return { ...a, subreddits: [...subs, subreddit] }
    })

    const target_subreddits = updated.flatMap(a => a.subreddits ?? [])

    const { error } = await supabase
      .from('profiles')
      .update({ audiences: updated, target_subreddits })
      .eq('id', profile.id)

    if (error) {
      console.error('[community/add]', error)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[community/add]', err)
    return NextResponse.json({ error: 'Add failed' }, { status: 500 })
  }
}
