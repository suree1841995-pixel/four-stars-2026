import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { computeStandings, buildFinalsMatchups, Player, GameRow } from '@/lib/fs-logic'

export async function GET(req: NextRequest) {
  const level = req.nextUrl.searchParams.get('level')!
  const { data, error } = await supabase.from('finals')
    .select('*, player1:player1_id(*), player2:player2_id(*)')
    .eq('level', level)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/finals — สร้างคู่ชิง (เรียกจาก admin)
export async function POST(req: NextRequest) {
  const { level } = await req.json()

  // เช็คว่ากรอกผลเกม 6 ครบหมดหรือยัง
  const { data: ta6 } = await supabase.from('table_assignments')
    .select('sub_table, is_bye').eq('level', level).eq('game', 6)
  if (!ta6 || ta6.length === 0) {
    return NextResponse.json({ error: 'ยังไม่ได้จัดโต๊ะเกม 6' }, { status: 400 })
  }
  const { data: scored6 } = await supabase.from('games')
    .select('sub_table, rounds1, rounds2').eq('level', level).eq('game', 6)
  const scoredMap: Record<string, { rounds1: number | null; rounds2: number | null }> = {}
  ;(scored6 || []).forEach((r: { sub_table: string; rounds1: number | null; rounds2: number | null }) => {
    scoredMap[r.sub_table] = r
  })
  const missing = (ta6 || [])
    .filter((t: { sub_table: string; is_bye: boolean }) => !t.is_bye)
    .filter((t: { sub_table: string }) => {
      const s = scoredMap[t.sub_table]
      return !s || s.rounds1 === null || s.rounds2 === null
    })
    .map((t: { sub_table: string }) => t.sub_table)
  if (missing.length > 0) {
    return NextResponse.json({ error: `กรอกผลเกม 6 ยังไม่ครบ (เหลือ: ${missing.join(', ')})` }, { status: 400 })
  }

  const { data: players } = await supabase.from('players').select('*').eq('level', level).order('number')
  const { data: allGames } = await supabase.from('games').select('*').eq('level', level)
  const standings = computeStandings((players || []) as Player[], (allGames || []) as GameRow[])

  let matchups
  try {
    matchups = buildFinalsMatchups(standings)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  // upsert ทั้งสองคู่
  for (const m of matchups) {
    await supabase.from('finals').upsert(
      { level, pair_label: m.pairLabel, player1_id: m.p1.id, player2_id: m.p2.id, rounds1: null, rounds2: null },
      { onConflict: 'level,pair_label' }
    )
  }

  await supabase.from('broadcast').insert({ type: 'finals_created', level, payload: {} })
  return NextResponse.json({ ok: true, matchups })
}

// PATCH /api/finals — บันทึกผลรอบชิง
export async function PATCH(req: NextRequest) {
  const { level, pair_label, rounds1, rounds2 } = await req.json()

  const { data, error } = await supabase.from('finals')
    .update({ rounds1, rounds2, updated_at: new Date().toISOString() })
    .eq('level', level).eq('pair_label', pair_label)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
