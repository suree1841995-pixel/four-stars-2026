import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { computeStandings, Player, GameRow } from '@/lib/fs-logic'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  const level = req.nextUrl.searchParams.get('level') || 'มต้น'

  const [{ data: players }, { data: games }, { data: finals }] = await Promise.all([
    supabase.from('players').select('*').eq('level', level).order('number'),
    supabase.from('games').select('*').eq('level', level),
    supabase.from('finals').select('*, player1:player1_id(*), player2:player2_id(*)').eq('level', level),
  ])

  const standings = computeStandings((players || []) as Player[], (games || []) as GameRow[])

  const rows = standings.map(s => ({
    'อันดับ': s.rank,
    'เลขที่': s.player.number,
    'ชื่อ-สกุล': s.player.name,
    'ห้อง': s.player.room,
    'ชนะ (W)': s.w,
    'เสมอ (T)': s.t,
    'แพ้ (L)': s.l,
    'คะแนน': s.points,
    'ผลต่างรวม': s.diffSum,
  }))

  const wb = XLSX.utils.book_new()
  const wsStandings = XLSX.utils.json_to_sheet(rows)
  wsStandings['!cols'] = [{ wch: 8 }, { wch: 8 }, { wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, wsStandings, 'อันดับ')

  if (finals && finals.length > 0) {
    const finalRows = finals.map((f: { pair_label: string; player1: Player | null; rounds1: number | null; player2: Player | null; rounds2: number | null }) => ({
      'คู่ชิง': f.pair_label,
      'ผู้เล่น 1': f.player1?.name ?? '',
      'รอบย่อย 1': f.rounds1 ?? '',
      'ผู้เล่น 2': f.player2?.name ?? '',
      'รอบย่อย 2': f.rounds2 ?? '',
    }))
    const wsFinals = XLSX.utils.json_to_sheet(finalRows)
    XLSX.utils.book_append_sheet(wb, wsFinals, 'รอบชิง')
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const levelLabel = level === 'มต้น' ? 'มต้น' : 'มปลาย'

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ผลการแข่งขัน_${levelLabel}.xlsx"`,
    },
  })
}
