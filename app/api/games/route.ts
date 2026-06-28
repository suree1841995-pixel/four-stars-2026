import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const level = req.nextUrl.searchParams.get('level')!
  const game = req.nextUrl.searchParams.get('game')
  let q = supabase.from('games')
    .select('*, player1:player1_id(*), player2:player2_id(*)')
    .eq('level', level)
  if (game) q = q.eq('game', game)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { game, level, sub_table, player1_id, rounds1, player2_id, rounds2, force = false } = body

  if (!game || !level || !sub_table || !player1_id) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ (game, level, sub_table, player1_id)' }, { status: 400 })
  }
  const table_num = parseInt(String(sub_table).replace(/[^0-9]/g, ''), 10)
  if (isNaN(table_num)) {
    return NextResponse.json({ error: `sub_table ไม่ถูกต้อง: ${sub_table}` }, { status: 400 })
  }

  // ตรวจคะแนนรวมต้องเท่ากับ 3
  if (!body.is_bye && rounds1 !== null && rounds2 !== null) {
    const sum = Number(rounds1) + Number(rounds2)
    if (Math.abs(sum - 3) > 0.001) {
      return NextResponse.json({ error: `คะแนนรวมต้องเท่ากับ 3 (ได้ ${sum})` }, { status: 400 })
    }
  }

  // ตรวจว่าเกมถูกล็อกอยู่หรือเปล่า
  const { data: lockData } = await supabase.from('game_locks').select('id').eq('level', level).eq('game', game).maybeSingle()
  if (lockData) {
    return NextResponse.json({ error: `เกม ${game} ถูกล็อกแล้ว — ปลดล็อกก่อนใน Admin` }, { status: 403 })
  }

  // ตรวจว่ามีผลเดิมอยู่แล้วหรือเปล่า
  if (!force) {
    const { data: existing } = await supabase.from('games')
      .select('rounds1, rounds2').eq('game', game).eq('level', level).eq('sub_table', sub_table).maybeSingle()
    if (existing && existing.rounds1 !== null) {
      return NextResponse.json(
        { alreadyScored: true, existing, message: `โต๊ะ ${sub_table} เกม ${game} มีผลอยู่แล้ว (${existing.rounds1}-${existing.rounds2}) กด Confirm เพื่อเขียนทับ` },
        { status: 409 }
      )
    }
  }

  const { data, error } = await supabase.from('games')
    .upsert(
      { game, level, table_num, sub_table, player1_id, rounds1, player2_id, rounds2, updated_at: new Date().toISOString() },
      { onConflict: 'game,level,sub_table' }
    )
    .select('*, player1:player1_id(name), player2:player2_id(name)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // บันทึก audit log
  await supabase.from('audit_logs').insert({
    level, game, sub_table,
    player1_name: (data.player1 as { name: string } | null)?.name ?? '',
    player2_name: (data.player2 as { name: string } | null)?.name ?? '',
    rounds1, rounds2,
    action: force ? 'overwrite' : 'score',
  })

  return NextResponse.json(data)
}
