import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { computeStandings, suggestGibsonize, Player, GameRow } from '@/lib/fs-logic'

export async function GET(req: NextRequest) {
  const level = req.nextUrl.searchParams.get('level')!
  const { data: players } = await supabase.from('players').select('*').eq('level', level).order('number')
  const { data: games } = await supabase.from('games').select('*').eq('level', level)
  const standings = computeStandings((players || []) as Player[], (games || []) as GameRow[])
  const result = suggestGibsonize(standings)
  return NextResponse.json(result)
}
