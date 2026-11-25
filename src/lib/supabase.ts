import { createClient } from '@supabase/supabase-js'

export const SB_URL  = 'https://girspxdolhsuvmkkgngb.supabase.co'
export const SB_ANON = 'sb_publishable_0g2OLZxdskIL3tSUllA5vQ_2WNKpFLv'

export const sb = createClient(SB_URL, SB_ANON)

export async function getToken(): Promise<string> {
  const { data: { session } } = await sb.auth.getSession()
  return session?.access_token ?? ''
}
