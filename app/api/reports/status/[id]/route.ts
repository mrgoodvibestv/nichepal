import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // RLS ensures this report belongs to the user
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('id, status, apify_run_id, apify_dataset_id')
      .eq('id', params.id)
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Already terminal — nothing left to poll
    if (report.status === 'complete' || report.status === 'failed') {
      return NextResponse.json({ status: report.status })
    }

    // Run ID not written yet (generate still in flight)
    if (!report.apify_run_id) {
      return NextResponse.json({ status: 'generating', apifyReady: false })
    }

    // Check Apify run status
    const token = process.env.APIFY_API_TOKEN!
    const pollRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${report.apify_run_id}?token=${token}`
    )
    const pollData = await pollRes.json()
    const apifyStatus: string = pollData?.data?.status ?? ''

    if (apifyStatus === 'SUCCEEDED') {
      // Refresh dataset ID in case it changed (edge case)
      const datasetId: string =
        pollData?.data?.defaultDatasetId ?? report.apify_dataset_id ?? ''
      if (datasetId && datasetId !== report.apify_dataset_id) {
        const db = createServiceClient()
        await db.from('reports').update({ apify_dataset_id: datasetId }).eq('id', params.id)
      }
      return NextResponse.json({
        status: 'generating',
        apifyReady: true,
        datasetId: datasetId || report.apify_dataset_id,
      })
    }

    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(apifyStatus)) {
      const db = createServiceClient()
      await db.from('reports').update({ status: 'failed' }).eq('id', params.id)
      return NextResponse.json({ status: 'failed' })
    }

    // Still RUNNING / READY
    return NextResponse.json({ status: 'generating', apifyReady: false })
  } catch (err: unknown) {
    console.error('[reports/status]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
