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

    const { url, business_name, positioning, keywords, target_subreddits, tone, package: pkg } =
      await req.json()

    const { error } = await supabase.from('profiles').upsert(
      {
        user_id: user.id,
        url,
        business_name,
        positioning,
        keywords,
        target_subreddits,
        tone,
        ...(pkg !== undefined && { package: pkg }),
        onboarded: true,
      },
      { onConflict: 'user_id' }
    )

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
