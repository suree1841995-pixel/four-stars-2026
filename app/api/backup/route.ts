import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const [players, games, finals, tables] = await Promise.all([
    supabase.from('players').select('*'),
    supabase.from('games').select('*'),
    supabase.from('finals').select('*'),
    supabase.from('table_assignments').select('*'),
  ])
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    players: players.data || [],
    games: games.data || [],
    finals: finals.data || [],
    tables: tables.data || [],
  }
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="fourstars-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}

export async function DELETE(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('mode')
  const deletes = [
    supabase.from('games').delete().neq('id', 0),
    supabase.from('finals').delete().neq('id', 0),
    supabase.from('table_assignments').delete().neq('id', 0),
    supabase.from('game_locks').delete().neq('id', 0),
    supabase.from('audit_logs').delete().neq('id', 0),
    supabase.from('broadcast').delete().neq('id', 0),
  ]
  const results = await Promise.all(deletes)
  const failed = results.find(r => r.error)
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 })
  if (mode === 'all') {
    const { error } = await supabase.from('players').delete().neq('id', 0)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (body.version !== 1) return NextResponse.json({ error: 'ไฟล์ backup ไม่รองรับ version นี้' }, { status: 400 })

    // ลบข้อมูลเดิม
    await Promise.all([
      supabase.from('games').delete().neq('id', 0),
      supabase.from('finals').delete().neq('id', 0),
      supabase.from('table_assignments').delete().neq('id', 0),
    ])
    await supabase.from('players').delete().neq('id', 0)

    const results: Record<string, number> = {}

    // Insert players ทีละคน แล้วสร้าง map old_id → new_id
    const idMap: Record<number, number> = {}
    if (body.players?.length) {
      for (const p of body.players) {
        const { id: oldId, ...rest } = p as Record<string, unknown>
        const { data } = await supabase.from('players').insert(rest).select('id').single()
        if (data && oldId !== undefined) idMap[oldId as number] = data.id
      }
      results.players = Object.keys(idMap).length
    }

    // Insert table_assignments โดย remap player IDs
    if (body.tables?.length) {
      const remapped = body.tables.map(({ id: _id, player1_id, player2_id, ...r }: Record<string, unknown>) => ({
        ...r,
        player1_id: player1_id != null ? (idMap[player1_id as number] ?? player1_id) : null,
        player2_id: player2_id != null ? (idMap[player2_id as number] ?? player2_id) : null,
      }))
      await supabase.from('table_assignments').insert(remapped)
      results.tables = body.tables.length
    }

    // Insert games โดย remap player IDs
    if (body.games?.length) {
      const remapped = body.games.map(({ id: _id, player1_id, player2_id, ...r }: Record<string, unknown>) => ({
        ...r,
        player1_id: player1_id != null ? (idMap[player1_id as number] ?? player1_id) : null,
        player2_id: player2_id != null ? (idMap[player2_id as number] ?? player2_id) : null,
      }))
      await supabase.from('games').insert(remapped)
      results.games = body.games.length
    }

    // Insert finals โดย remap player IDs
    if (body.finals?.length) {
      const remapped = body.finals.map(({ id: _id, player1_id, player2_id, ...r }: Record<string, unknown>) => ({
        ...r,
        player1_id: player1_id != null ? (idMap[player1_id as number] ?? player1_id) : null,
        player2_id: player2_id != null ? (idMap[player2_id as number] ?? player2_id) : null,
      }))
      await supabase.from('finals').insert(remapped)
      results.finals = body.finals.length
    }

    return NextResponse.json({ ok: true, restored: results })
  } catch {
    return NextResponse.json({ error: 'ไฟล์ backup ไม่ถูกต้อง' }, { status: 400 })
  }
}
