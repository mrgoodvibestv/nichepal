import { createClient } from '@/lib/supabase/server'

export async function getCredits(profileId: string): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', profileId)
    .single()
  return data?.credits ?? 0
}

export async function deductCredit(
  profileId: string,
  description: string
): Promise<{ success: boolean; remaining: number }> {
  const supabase = await createClient()
  const current = await getCredits(profileId)

  if (current < 1) {
    return { success: false, remaining: 0 }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ credits: current - 1 })
    .eq('id', profileId)

  if (error) return { success: false, remaining: current }

  await supabase.from('credit_transactions').insert({
    profile_id: profileId,
    amount: -1,
    type: 'deduction',
    description,
  })

  return { success: true, remaining: current - 1 }
}

export async function grantCredits(
  profileId: string,
  amount: number,
  description: string
): Promise<void> {
  const supabase = await createClient()
  const current = await getCredits(profileId)

  await supabase
    .from('profiles')
    .update({ credits: current + amount })
    .eq('id', profileId)

  await supabase.from('credit_transactions').insert({
    profile_id: profileId,
    amount,
    type: 'grant',
    description,
  })
}
