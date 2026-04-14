import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch thread — RLS policy ensures it belongs to this user
    const { data: thread, error: threadError } = await supabase
      .from('threads')
      .select('id, engaged')
      .eq('id', params.id)
      .single()

    if (threadError || !thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    const newEngaged = !thread.engaged

    const { error: updateError } = await supabase
      .from('threads')
      .update({
        engaged: newEngaged,
        engaged_at: newEngaged ? new Date().toISOString() : null,
      })
      .eq('id', params.id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }

    return NextResponse.json({ engaged: newEngaged })
  } catch (err: unknown) {
    console.error('[threads/engage]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
