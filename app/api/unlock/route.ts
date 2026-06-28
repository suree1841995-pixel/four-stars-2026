import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/unlock?level=มต้น
// คืนสถานะปลดล็อกของปุ่มเกม 1-6 ทั้งหมด
export async function GET(req: NextRequest) {
  const level = req.nextUrl.searchParams.get('level')!
  const totalGames = parseInt(req.nextUrl.searchParams.get('totalGames') || '6')

  const { data: ta } = await supabase.from('table_assignments')
    .select('game, sub_table, is_bye').eq('level', level)
  const { data: scored } = await supabase.from('games')
    .select('game, sub_table, rounds1, rounds2').eq('level', level)

  const taByGame: Record<number, { sub_table: string; is_bye: boolean }[]> = {}
  ;(ta || []).forEach((r: { game: number; sub_table: string; is_bye: boolean }) => {
    if (!taByGame[r.game]) taByGame[r.game] = []
    taByGame[r.game].push(r)
  })

  const scoredByGame: Record<number, Record<string, { rounds1: number | null; rounds2: number | null }>> = {}
  ;(scored || []).forEach((r: { game: number; sub_table: string; rounds1: number | null; rounds2: number | null }) => {
    if (!scoredByGame[r.game]) scoredByGame[r.game] = {}
    scoredByGame[r.game][r.sub_table] = r
  })

  function isGameComplete(game: number): { complete: boolean; missing: string[] } {
    const rows = taByGame[game]
    if (!rows || rows.length === 0) return { complete: false, missing: ['ยังไม่มีการจัดโต๊ะ'] }
    const missing: string[] = []
    for (const t of rows) {
      if (t.is_bye) continue
      const s = (scoredByGame[game] || {})[t.sub_table]
      if (!s || s.rounds1 === null || s.rounds2 === null) missing.push(t.sub_table)
    }
    return { complete: missing.length === 0, missing }
  }

  const games = []
  let prevComplete = { complete: true, missing: [] as string[] }

  for (let g = 1; g <= totalGames; g++) {
    const done = !!(taByGame[g] && taByGame[g].length > 0)
    const unlocked = g === 1 ? true : prevComplete.complete
    const thisComplete = isGameComplete(g)
    games.push({ game: g, unlocked, done, missing: thisComplete.missing })
    prevComplete = thisComplete
  }

  return NextResponse.json({ games, unlockedFinals: prevComplete.complete })
}
