// ============================================================
//  FOUR STARS — กติกาและการคำนวณ
//  Port จาก codefs.gs (Google Apps Script)
// ============================================================

export const FS_LEVELS = ['มต้น', 'มปลาย'] as const
export type Level = typeof FS_LEVELS[number]

// ชนะบาย = กรอก rounds1=2, rounds2=0 (ตามกติกา +2/-2)
export const FS_BYE_ROUNDS_WIN = 2
export const FS_BYE_ROUNDS_LOSE = 0

export interface Player {
  id: number
  number: number
  name: string
  level: Level
  room: string
}

export interface GameRow {
  id: number
  game: number
  level: string
  table_num: number
  sub_table: string
  player1_id: number
  rounds1: number | null
  player2_id: number | null
  rounds2: number | null
}

export interface FinalRow {
  id: number
  level: string
  pair_label: string   // 'ชิงที่ 1-2' | 'ชิงที่ 3-4'
  player1_id: number
  rounds1: number | null
  player2_id: number
  rounds2: number | null
  player1?: Player
  player2?: Player
}

export interface Standing {
  player: Player
  rank: number
  points: number      // W=2, T=1, L=0
  diffSum: number     // ผลต่างรอบย่อยสะสม
  w: number
  t: number
  l: number
  gamesPlayed: number
  headToHead: Record<number, 'W' | 'T' | 'L'>  // player_id → ผลเจอกัน
}

export interface TableDef {
  table_num: number
  pairA: { p1: Player; p2: Player } | null
  pairB: { p1: Player; p2: Player } | null
  byeA: Player | null   // ทั้งโต๊ะ bye (เหลือ 1 คน)
  byeB: Player | null   // ฝั่ง B bye (เหลือ 3 คน)
}

// ============================================================
//  Normalize level string (กัน unicode/whitespace เพี้ยน)
// ============================================================
export function normalizeLevel(level: string): string {
  return level.normalize('NFC').replace(/[\s​‌‍﻿]+/g, '').trim()
}

// ============================================================
//  คำนวณผล W/T/L และผลต่างรอบย่อย จากคู่เดียว
// ============================================================
export function computeMatchResult(rounds1: number | null, rounds2: number | null) {
  const a = rounds1 ?? 0
  const b = rounds2 ?? 0
  const result1 = a > b ? 'W' : a < b ? 'L' : 'T'
  const result2 = a > b ? 'L' : a < b ? 'W' : 'T'
  return { result1, result2, diff1: a - b, diff2: b - a }
}

// ============================================================
//  คำนวณตารางอันดับ (เรียง: แต้ม → ผลต่าง)
// ============================================================
export function computeStandings(players: Player[], gameRows: GameRow[]): Standing[] {
  const stat: Record<number, Standing> = {}
  players.forEach(p => {
    stat[p.id] = {
      player: p, rank: 0, points: 0, diffSum: 0,
      w: 0, t: 0, l: 0, gamesPlayed: 0, headToHead: {}
    }
  })

  for (const g of gameRows) {
    if (!g.player1_id) continue

    // bye (ไม่มีคู่จริง)
    if (!g.player2_id) {
      const s = stat[g.player1_id]
      if (!s) continue
      if (g.rounds1 === null || g.rounds2 === null) continue
      const r1 = g.rounds1
      const r2 = g.rounds2
      s.diffSum += r1 - r2
      s.gamesPlayed++
      if (r1 > r2) { s.w++; s.points += 2 }
      else if (r1 < r2) s.l++
      else { s.t++; s.points += 1 }
      continue
    }

    if (g.rounds1 === null || g.rounds2 === null) continue
    const r = computeMatchResult(g.rounds1, g.rounds2)
    const s1 = stat[g.player1_id]
    const s2 = stat[g.player2_id]

    if (s1) {
      s1.diffSum += r.diff1
      s1.gamesPlayed++
      s1.headToHead[g.player2_id] = r.result1 as 'W' | 'T' | 'L'
      if (r.result1 === 'W') { s1.w++; s1.points += 2 }
      else if (r.result1 === 'T') { s1.t++; s1.points += 1 }
      else s1.l++
    }
    if (s2) {
      s2.diffSum += r.diff2
      s2.gamesPlayed++
      s2.headToHead[g.player1_id] = r.result2 as 'W' | 'T' | 'L'
      if (r.result2 === 'W') { s2.w++; s2.points += 2 }
      else if (r.result2 === 'T') { s2.t++; s2.points += 1 }
      else s2.l++
    }
  }

  const list = Object.values(stat)
  list.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return b.diffSum - a.diffSum
  })
  list.forEach((s, i) => {
    if (i === 0) { s.rank = 1; return }
    const prev = list[i - 1]
    s.rank = (prev.points === s.points && prev.diffSum === s.diffSum) ? prev.rank : i + 1
  })
  return list
}

// ============================================================
//  สุ่ม array
// ============================================================
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ============================================================
//  แบ่งผู้เล่นเป็นโต๊ะ (โต๊ะละ 4 = 2 คู่ A/B)
//  เศษ 3 → byeB, เศษ 2 → คู่เดี่ยว, เศษ 1 → byeA
// ============================================================
export function splitIntoTables(players: Player[]): TableDef[] {
  const tables: TableDef[] = []
  let t = 1
  for (let i = 0; i < players.length; i += 4) {
    const g = players.slice(i, i + 4)
    if (g.length === 4) {
      tables.push({ table_num: t, pairA: { p1: g[0], p2: g[1] }, pairB: { p1: g[2], p2: g[3] }, byeA: null, byeB: null })
    } else if (g.length === 3) {
      tables.push({ table_num: t, pairA: { p1: g[0], p2: g[1] }, pairB: null, byeA: null, byeB: g[2] })
    } else if (g.length === 2) {
      tables.push({ table_num: t, pairA: { p1: g[0], p2: g[1] }, pairB: null, byeA: null, byeB: null })
    } else {
      tables.push({ table_num: t, pairA: null, pairB: null, byeA: g[0], byeB: null })
    }
    t++
  }
  return tables
}

// ============================================================
//  เกม 1: Random
// ============================================================
export function generateGame1(players: Player[]): TableDef[] {
  return splitIntoTables(shuffle(players))
}

// ============================================================
//  เกม 2, 4: ไขว้ในโต๊ะเดิม (ชนะ vs ชนะ / แพ้ vs แพ้)
// ============================================================
export function generateCrossover(
  prevTables: TableDef[],
  prevGames: GameRow[],
  playerMap: Record<number, Player>
): TableDef[] {
  return prevTables.map(t => {
    // bye ทั้งโต๊ะ → ส่งต่อ bye
    if (t.byeA) return { ...t }
    // มีแค่ byeB → pairA รีแมตช์, byeB ส่งต่อ
    if (!t.pairB && t.byeB) return { ...t }
    // คู่เดี่ยว → รีแมตช์
    if (!t.pairB) return { ...t }

    const gA = prevGames.find(g => g.table_num === t.table_num && g.sub_table.endsWith('A'))
    const gB = prevGames.find(g => g.table_num === t.table_num && g.sub_table.endsWith('B'))

    function getWinLose(g: GameRow | undefined, def1: Player, def2: Player) {
      if (!g) return { winner: def1, loser: def2 }
      const r = computeMatchResult(g.rounds1, g.rounds2)
      const p1 = playerMap[g.player1_id] ?? def1
      const p2 = playerMap[g.player2_id!] ?? def2
      if (r.result1 === 'W') return { winner: p1, loser: p2 }
      if (r.result2 === 'W') return { winner: p2, loser: p1 }
      return { winner: def1, loser: def2 }
    }

    const { winner: wA, loser: lA } = getWinLose(gA, t.pairA!.p1, t.pairA!.p2)
    const { winner: wB, loser: lB } = getWinLose(gB, t.pairB.p1, t.pairB.p2)

    return {
      table_num: t.table_num,
      pairA: { p1: wA, p2: wB },
      pairB: { p1: lA, p2: lB },
      byeA: null, byeB: null
    }
  })
}

// ============================================================
//  เกม 3, 5: Swiss (เรียงแต้ม → ผลต่าง → สุ่มในกลุ่มเท่ากัน)
//  played = Set ของคู่ที่เคยแข่งกันแล้ว รูปแบบ "minId_maxId"
// ============================================================
function swissPairKey(id1: number, id2: number): string {
  return `${Math.min(id1, id2)}_${Math.max(id1, id2)}`
}

function avoidRematches(players: Player[], played: Set<string>): Player[] {
  const arr = [...players]
  for (let i = 0; i + 1 < arr.length; i += 2) {
    if (!played.has(swissPairKey(arr[i].id, arr[i + 1].id))) continue
    // หาคนที่ยังไม่เคยเจอ arr[i] มาสลับกับ arr[i+1]
    for (let j = i + 2; j < arr.length; j++) {
      if (!played.has(swissPairKey(arr[i].id, arr[j].id))) {
        ;[arr[i + 1], arr[j]] = [arr[j], arr[i + 1]]
        break
      }
    }
    // ถ้าหาไม่ได้ → ยอมให้เจอซ้ำ (fallback)
  }
  return arr
}

export function generateSwiss(standings: Standing[], played?: Set<string>): TableDef[] {
  const groups: Standing[][] = []
  const sorted = [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return b.diffSum - a.diffSum
  })
  let i = 0
  while (i < sorted.length) {
    let j = i + 1
    while (j < sorted.length &&
      sorted[j].points === sorted[i].points &&
      sorted[j].diffSum === sorted[i].diffSum) j++
    groups.push(sorted.slice(i, j))
    i = j
  }
  const players = groups.flatMap(g => shuffle(g).map(s => s.player))
  const final = (played && played.size > 0) ? avoidRematches(players, played) : players
  return splitIntoTables(final)
}

// ============================================================
//  เกม 6: King of the Hill (Swiss แต่ exclude คน Gibsonize)
// ============================================================
export function generateKingOfHill(standings: Standing[], gibsonizedIds: number[], played?: Set<string>): TableDef[] {
  const excluded = new Set(gibsonizedIds)
  const eligible = standings.filter(s => !excluded.has(s.player.id))
  return generateSwiss(eligible, played)
}

// ============================================================
//  Gibsonize: คำนวณว่าใครคะแนนลอยลำเข้ารอบชิงแน่นอนแล้ว
// ============================================================
export function suggestGibsonize(standings: Standing[]): {
  suggested: Standing[]
  hasEnoughPlayers: boolean
  fifthPlacePoints?: number
  maxPossibleForFifth?: number
} {
  if (standings.length < 5) return { suggested: [], hasEnoughPlayers: false }

  const fifthPlacePoints = standings[4].points
  const maxPossibleForFifth = fifthPlacePoints + 2  // W=2

  const suggested = standings.slice(0, 4).filter(s => s.points > maxPossibleForFifth)
  return { suggested, hasEnoughPlayers: true, fifthPlacePoints, maxPossibleForFifth }
}

// ============================================================
//  สร้างคู่ชิงชนะเลิศ จาก 4 อันดับแรก
// ============================================================
export function buildFinalsMatchups(standings: Standing[]): { pairLabel: string; p1: Player; p2: Player }[] {
  const top4 = standings.slice(0, 4)
  if (top4.length < 4) throw new Error('ผู้เล่นไม่ครบ 4 คนสำหรับรอบชิงชนะเลิศ')
  return [
    { pairLabel: 'ชิงที่ 1-2', p1: top4[0].player, p2: top4[1].player },
    { pairLabel: 'ชิงที่ 3-4', p1: top4[2].player, p2: top4[3].player },
  ]
}

// ============================================================
//  Tie-breaker: เช็คว่าอันดับที่ cutoff เสมอกับอันดับถัดไปหรือไม่
// ============================================================
export function checkTieAtCutoff(
  standings: Standing[],
  cutoffRank: number,
  allGames: GameRow[]
): { needsPlayoff: boolean; reason?: string; candidateIds?: number[] } {
  if (standings.length <= cutoffRank) return { needsPlayoff: false }

  const atCutoff = standings[cutoffRank - 1]
  const justBelow = standings[cutoffRank]

  if (atCutoff.points !== justBelow.points || atCutoff.diffSum !== justBelow.diffSum) {
    return { needsPlayoff: false }
  }

  // ดู head-to-head
  const h2h = atCutoff.headToHead[justBelow.player.id]
  if (h2h && h2h !== 'T') return { needsPlayoff: false }

  // เคยเจอกันแล้วหรือยัง
  const everPlayed = allGames.some(g =>
    (g.player1_id === atCutoff.player.id && g.player2_id === justBelow.player.id) ||
    (g.player1_id === justBelow.player.id && g.player2_id === atCutoff.player.id)
  )
  if (everPlayed && h2h === 'T') {
    return { needsPlayoff: false }
  }

  return {
    needsPlayoff: true,
    reason: `อันดับ ${cutoffRank} (${atCutoff.player.name}) และอันดับ ${cutoffRank + 1} (${justBelow.player.name}) คะแนนเท่ากันและไม่เคยแข่งกัน — ต้องเล่นเพิ่ม 1 เกม`,
    candidateIds: [atCutoff.player.id, justBelow.player.id]
  }
}

// ============================================================
//  สรุปผลรางวัล จากผลรอบชิง + standings
// ============================================================
export function getAwardsSummary(standings: Standing[], finalsRows: FinalRow[]) {
  let first: Player | null = null
  let second: Player | null = null
  let third: Player | null = null
  const tieNotes: string[] = []

  const playerMap: Record<number, Player> = {}
  standings.forEach(s => { playerMap[s.player.id] = s.player })

  function resolveWinner(row: FinalRow): { winner: Player | null; loser: Player | null } {
    if (row.rounds1 === null || row.rounds2 === null) return { winner: null, loser: null }
    const r = computeMatchResult(row.rounds1, row.rounds2)
    const p1 = row.player1 || playerMap[row.player1_id]
    const p2 = row.player2 || playerMap[row.player2_id]
    if (r.result1 === 'W') return { winner: p1, loser: p2 }
    if (r.result2 === 'W') return { winner: p2, loser: p1 }
    // เสมอ → ดู head-to-head จาก standings
    const s1 = standings.find(s => s.player.id === row.player1_id)
    const h2h = s1?.headToHead[row.player2_id]
    if (h2h === 'W') return { winner: p1, loser: p2 }
    if (h2h === 'L') return { winner: p2, loser: p1 }
    tieNotes.push(`${row.pair_label} เสมอกันในรอบชิง — ต้องให้กรรมการจัดเล่นเพิ่ม`)
    return { winner: null, loser: null }
  }

  const row12 = finalsRows.find(r => r.pair_label === 'ชิงที่ 1-2')
  const row34 = finalsRows.find(r => r.pair_label === 'ชิงที่ 3-4')

  if (row12) {
    const { winner, loser } = resolveWinner(row12)
    first = winner; second = loser
  }
  if (row34) {
    const { winner } = resolveWinner(row34)
    third = winner
  }

  const podiumIds = new Set([first?.id, second?.id, third?.id].filter(Boolean))
  const participants = standings.filter(s => !podiumIds.has(s.player.id)).map(s => s.player)

  return { first, second, third, participants, tieNotes, totalPlayed: standings.length }
}
