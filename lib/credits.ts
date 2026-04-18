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
  // Atomic decrement via Postgres function — eliminates the read-then-write
  // race condition where two simultaneous calls could both pass the balance
  // check and both write the same decremented value.
  const { data, error } = await supabase.rpc('deduct_credits', {
    p_profile_id: profileId,
    p_amount: amount,
    p_description: description,
  })

  if (error || (data as number) === -1) {
    return { success: false, remaining: 0 }
  }

  return { success: true, remaining: data as number }
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
