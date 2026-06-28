import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const level = req.nextUrl.searchParams.get('level')!
  const game = req.nextUrl.searchParams.get('game')
  let q = supabase.from('audit_logs').select('*').eq('level', level).order('created_at', { ascending: false }).limit(100)
  if (game) q = q.eq('game', parseInt(game))
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
