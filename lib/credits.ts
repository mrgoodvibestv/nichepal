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
  description: string,
  amount: number = 1
): Promise<{ success: boolean; remaining: number }> {
  const supabase = await createClient()
  const current = await getCredits(profileId)

  if (current < amount) {
    return { success: false, remaining: current }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ credits: current - amount })
    .eq('id', profileId)

  if (error) return { success: false, remaining: current }

  await supabase.from('credit_transactions').insert({
    profile_id: profileId,
    amount: -amount,
    type: 'deduction',
    description,
  })

  return { success: true, remaining: current - amount }
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
