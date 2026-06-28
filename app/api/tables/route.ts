import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import {
  generateGame1, generateCrossover, generateSwiss, generateKingOfHill,
  computeStandings, TableDef, Player, GameRow
} from '@/lib/fs-logic'

export async function GET(req: NextRequest) {
  const level = req.nextUrl.searchParams.get('level')!
  const game = req.nextUrl.searchParams.get('game')
  let q = supabase.from('table_assignments')
    .select('*, player1:player1_id(*), player2:player2_id(*)')
    .eq('level', level).order('table_num').order('sub_table')
  if (game) q = q.eq('game', game)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { level, game, totalGames = 6, gibsonizedIds = [] } = body as { level: string; game: number; totalGames?: number; gibsonizedIds?: number[] }
  const isLastGame = game === totalGames

  const { data: playersData } = await supabase.from('players').select('*').eq('level', level).order('number')
  const players = (playersData || []) as Player[]
  const playerMap: Record<number, Player> = {}
  players.forEach(p => { playerMap[p.id] = p })

  // ตรวจว่ากรอกผลเกมก่อนหน้าครบ (เกม 1 ไม่ต้องตรวจ)
  const prevGamesToCheck = isLastGame ? Array.from({ length: game - 1 }, (_, i) => i + 1) : game > 1 ? [game - 1] : []
  for (const prevGame of prevGamesToCheck) {
    const { data: ta } = await supabase.from('table_assignments')
      .select('sub_table, is_bye').eq('level', level).eq('game', prevGame)
    if (!ta || ta.length === 0) {
      return NextResponse.json({ error: `ยังไม่ได้จัดโต๊ะเกม ${prevGame}` }, { status: 400 })
    }
    const { data: scored } = await supabase.from('games')
      .select('sub_table, rounds1, rounds2').eq('level', level).eq('game', prevGame)
    const scoredMap: Record<string, { rounds1: number | null; rounds2: number | null }> = {}
    ;(scored || []).forEach((r: { sub_table: string; rounds1: number | null; rounds2: number | null }) => {
      scoredMap[r.sub_table] = r
    })
    const missing = (ta || [])
      .filter((t: { sub_table: string; is_bye: boolean }) => !t.is_bye)
      .filter((t: { sub_table: string }) => {
        const s = scoredMap[t.sub_table]
        return !s || s.rounds1 === null || s.rounds2 === null
      })
      .map((t: { sub_table: string }) => t.sub_table)
    if (missing.length > 0) {
      return NextResponse.json({ error: `กรอกผลเกม ${prevGame} ยังไม่ครบ (เหลือ: ${missing.join(', ')})` }, { status: 400 })
    }
  }

  // สร้างการจัดโต๊ะ
  let tables: TableDef[] = []

  if (game === 1) {
    tables = generateGame1(players)
  } else if (isLastGame) {
    // เกมสุดท้าย = King of the Hill
    const prevGames = Array.from({ length: game - 1 }, (_, i) => i + 1)
    const { data: allScores } = await supabase.from('games').select('*').eq('level', level).in('game', prevGames)
    const standings = computeStandings(players, (allScores || []) as GameRow[])
    const played = new Set<string>()
    for (const g of (allScores || []) as GameRow[]) {
      if (g.player1_id && g.player2_id) {
        played.add(`${Math.min(g.player1_id, g.player2_id)}_${Math.max(g.player1_id, g.player2_id)}`)
      }
    }
    tables = generateKingOfHill(standings, gibsonizedIds, played)
  } else if (game % 2 === 0) {
    // เลขคู่ = ไขว้
    const prevGame = game - 1
    const { data: prevTA } = await supabase.from('table_assignments')
      .select('*, player1:player1_id(*), player2:player2_id(*)')
      .eq('level', level).eq('game', prevGame).order('table_num')
    const { data: prevScores } = await supabase.from('games')
      .select('*').eq('level', level).eq('game', prevGame)

    const tableMap: Record<number, TableDef> = {}
    for (const row of (prevTA || [])) {
      const tn = row.table_num
      if (!tableMap[tn]) tableMap[tn] = { table_num: tn, pairA: null, pairB: null, byeA: null, byeB: null }
      const t = tableMap[tn]
      if (!row.player1) continue
      if (row.is_bye) { t.byeA = row.player1 as Player; continue }
      if (row.sub_table.endsWith('A')) {
        if (row.player2) t.pairA = { p1: row.player1 as Player, p2: row.player2 as Player }
      } else {
        if (!row.player2) t.byeB = row.player1 as Player
        else t.pairB = { p1: row.player1 as Player, p2: row.player2 as Player }
      }
    }
    const prevTables = Object.values(tableMap).sort((a, b) => a.table_num - b.table_num)
    tables = generateCrossover(prevTables, (prevScores || []) as GameRow[], playerMap)
  } else {
    // เลขคี่ (ไม่ใช่ 1 หรือสุดท้าย) = Swiss
    const prevGames = Array.from({ length: game - 1 }, (_, i) => i + 1)
    const { data: allScores } = await supabase.from('games').select('*').eq('level', level).in('game', prevGames)
    const standings = computeStandings(players, (allScores || []) as GameRow[])
    const played = new Set<string>()
    for (const g of (allScores || []) as GameRow[]) {
      if (g.player1_id && g.player2_id) {
        played.add(`${Math.min(g.player1_id, g.player2_id)}_${Math.max(g.player1_id, g.player2_id)}`)
      }
    }
    tables = generateSwiss(standings, played)
  }

  // ลบของเดิมแล้ว insert ใหม่
  const { error: delErr } = await supabase.from('table_assignments').delete().eq('level', level).eq('game', game)
  if (delErr) return NextResponse.json({ error: `ลบโต๊ะเดิมไม่สำเร็จ: ${delErr.message}` }, { status: 500 })

  const rows: object[] = []
  const byeGameRows: object[] = []

  for (const t of tables) {
    if (t.byeA) {
      rows.push({ game, level, table_num: t.table_num, sub_table: `${t.table_num}A`, player1_id: t.byeA.id, player2_id: null, is_bye: true, note: 'bye' })
      byeGameRows.push({ game, level, table_num: t.table_num, sub_table: `${t.table_num}A`, player1_id: t.byeA.id, rounds1: 2, player2_id: null, rounds2: null })
    } else {
      if (t.pairA) rows.push({ game, level, table_num: t.table_num, sub_table: `${t.table_num}A`, player1_id: t.pairA.p1.id, player2_id: t.pairA.p2.id, is_bye: false, note: '' })
      if (t.pairB) rows.push({ game, level, table_num: t.table_num, sub_table: `${t.table_num}B`, player1_id: t.pairB.p1.id, player2_id: t.pairB.p2.id, is_bye: false, note: '' })
      if (t.byeB) {
        rows.push({ game, level, table_num: t.table_num, sub_table: `${t.table_num}B`, player1_id: t.byeB.id, player2_id: null, is_bye: true, note: 'bye' })
        byeGameRows.push({ game, level, table_num: t.table_num, sub_table: `${t.table_num}B`, player1_id: t.byeB.id, rounds1: 2, player2_id: null, rounds2: null })
      }
    }
  }

  const { error: insertErr } = await supabase.from('table_assignments').insert(rows)
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  for (const br of byeGameRows) {
    const { error: byeErr } = await supabase.from('games').upsert(br, { onConflict: 'game,level,sub_table' })
    if (byeErr) console.error('bye upsert error:', byeErr.message)
  }

  await supabase.from('broadcast').insert({ type: 'current_game', level, payload: { game } })
  return NextResponse.json({ ok: true, tables })
}
