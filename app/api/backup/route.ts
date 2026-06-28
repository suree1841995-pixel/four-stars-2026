import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const [players, games, finals, tables] = await Promise.all([
    supabase.from('players').select('*'),
    supabase.from('games').select('*'),
    supabase.from('finals').select('*'),
    supabase.from('tables').select('*'),
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
  const mode = req.nextUrl.searchParams.get('mode') // 'results' | 'all'
  await supabase.from('games').delete().neq('id', 0)
  await supabase.from('finals').delete().neq('id', 0)
  await supabase.from('tables').delete().neq('id', 0)
  await supabase.from('game_locks').delete().neq('id', 0)
  await supabase.from('audit_logs').delete().neq('id', 0)
  if (mode === 'all') {
    await supabase.from('players').delete().neq('id', 0)
  }
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (body.version !== 1) return NextResponse.json({ error: 'ไฟล์ backup ไม่รองรับ version นี้' }, { status: 400 })

    // Clear existing data then restore
    await supabase.from('games').delete().neq('id', 0)
    await supabase.from('finals').delete().neq('id', 0)
    await supabase.from('tables').delete().neq('id', 0)
    await supabase.from('players').delete().neq('id', 0)

    const results: Record<string, number> = {}
    if (body.players?.length) {
      const { data } = await supabase.from('players').insert(body.players.map(({ id: _id, ...r }: Record<string, unknown>) => r)).select()
      results.players = data?.length || 0
    }
    if (body.tables?.length) {
      await supabase.from('tables').insert(body.tables.map(({ id: _id, ...r }: Record<string, unknown>) => r))
      results.tables = body.tables.length
    }
    if (body.games?.length) {
      await supabase.from('games').insert(body.games.map(({ id: _id, ...r }: Record<string, unknown>) => r))
      results.games = body.games.length
    }
    if (body.finals?.length) {
      await supabase.from('finals').insert(body.finals.map(({ id: _id, ...r }: Record<string, unknown>) => r))
      results.finals = body.finals.length
    }
    return NextResponse.json({ ok: true, restored: results })
  } catch {
    return NextResponse.json({ error: 'ไฟล์ backup ไม่ถูกต้อง' }, { status: 400 })
  }
}
