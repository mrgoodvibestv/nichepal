import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deductCredit } from '@/lib/credits'

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, credits')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if ((profile.credits ?? 0) < 1) {
      return NextResponse.json({ error: 'No credits remaining' }, { status: 400 })
    }

    // Create report row
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({ profile_id: profile.id, status: 'generating' })
      .select('id')
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
    }

    // Deduct credit while request context is still active
    await deductCredit(profile.id, 'Report generation')

    // Fire-and-forget: call the process endpoint which handles Apify + Claude
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    fetch(`${siteUrl}/api/reports/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_SECRET ?? '',
      },
      body: JSON.stringify({ reportId: report.id, profileId: profile.id }),
      keepalive: true,
    })

    return NextResponse.json({ reportId: report.id })
  } catch (err: unknown) {
    console.error('[reports/generate]', err)
    return NextResponse.json({ error: 'Failed to start generation' }, { status: 500 })
  }
}
