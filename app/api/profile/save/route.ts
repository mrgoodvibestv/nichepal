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

    // Check if this user already has a profile BEFORE the upsert.
    // Used to detect first-time onboarding and grant welcome credits.
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    const isNewUser = !existingProfile

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

    const { data: savedProfile, error } = await supabase
      .from('profiles')
      .upsert(upsertData, { onConflict: 'user_id' })
      .select('id')
      .single()

    if (error || !savedProfile) {
      console.error('[profile/save]', error)
      return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
    }

    // Grant 10 welcome credits on first-time profile creation.
    // New users have 0 credits by default and can't use the app
    // until they subscribe or receive welcome credits.
    if (isNewUser) {
      // Atomic grant — prevents double-crediting on concurrent save requests
      await supabase.rpc('grant_credits', {
        p_profile_id: savedProfile.id,
        p_amount: 10,
        p_description: 'welcome_credits',
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('[profile/save]', err)
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }
}
