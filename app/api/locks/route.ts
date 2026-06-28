import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const level = req.nextUrl.searchParams.get('level')!
  const { data, error } = await supabase.from('game_locks').select('game').eq('level', level)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data || []).map((r: { game: number }) => r.game))
}

export async function POST(req: NextRequest) {
  const { level, game } = await req.json()
  const { error } = await supabase.from('game_locks').upsert({ level, game }, { onConflict: 'level,game' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const level = req.nextUrl.searchParams.get('level')!
  const gameParam = req.nextUrl.searchParams.get('game')!
  const game = parseInt(gameParam)
  if (isNaN(game)) return NextResponse.json({ error: 'game ต้องเป็นตัวเลข' }, { status: 400 })
  const { error } = await supabase.from('game_locks').delete().eq('level', level).eq('game', game)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
