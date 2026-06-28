'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { computeStandings, computeMatchResult, getAwardsSummary, Player, GameRow, FinalRow } from '@/lib/fs-logic'

type Level = 'มต้น' | 'มปลาย'
type View = 'standings' | 'tables' | 'finals' | 'awards'

interface TARow { game: number; table_num: number; sub_table: string; player1: Player | null; player2: Player | null; is_bye: boolean }

export default function DisplayPage() {
  const [level, setLevel] = useState<Level>('มต้น')
  const [view, setView] = useState<View>('standings')
  const [players, setPlayers] = useState<Player[]>([])
  const [gameRows, setGameRows] = useState<GameRow[]>([])
  const [tables, setTables] = useState<TARow[]>([])
  const [latestGame, setLatestGame] = useState(0)
  const [finalsRows, setFinalsRows] = useState<FinalRow[]>([])
  const [lastUpdate, setLastUpdate] = useState('')
  const [realtimeOk, setRealtimeOk] = useState(true)
  const [clock, setClock] = useState('')
  const [autoRotate, setAutoRotate] = useState(false)
  const [projector, setProjector] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [scoredSet, setScoredSet] = useState<Set<string>>(new Set())
  const realtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const views: View[] = ['standings', 'tables', 'finals', 'awards']

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!autoRotate) return
    const id = setInterval(() => setView(v => views[(views.indexOf(v) + 1) % views.length]), 15000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRotate])

  const loadAll = useCallback(async () => {
    const [{ data: p }, { data: g }, { data: ta }, { data: f }] = await Promise.all([
      supabase.from('players').select('*').eq('level', level).order('number'),
      supabase.from('games').select('*').eq('level', level),
      supabase.from('table_assignments').select('*, player1:player1_id(*), player2:player2_id(*)').eq('level', level).order('game', { ascending: false }).order('table_num').order('sub_table'),
      supabase.from('finals').select('*, player1:player1_id(*), player2:player2_id(*)').eq('level', level),
    ])
    const ps = (p || []) as Player[]
    const gs = (g || []) as GameRow[]
    setPlayers(ps); setGameRows(gs)
    const taRows = (ta || []) as TARow[]
    const maxGame = taRows.reduce((m, r) => Math.max(m, r.game), 0)
    setLatestGame(maxGame)
    setTables(taRows.filter(r => r.game === maxGame))
    setFinalsRows((f || []) as FinalRow[])
    // scored set — ใช้ข้อมูล games ที่ fetch มาแล้ว ไม่ต้อง fetch ซ้ำ
    setScoredSet(new Set((gs).filter((r: GameRow) => r.game === maxGame).map((r: GameRow) => r.sub_table)))
    setLastUpdate(new Date().toLocaleTimeString('th-TH'))
    setRealtimeOk(true)
    if (realtimeTimer.current) clearTimeout(realtimeTimer.current)
    realtimeTimer.current = setTimeout(() => setRealtimeOk(false), 30000)
  }, [level])

  useEffect(() => {
    loadAll()
    // fallback polling ทุก 30 วินาที เผื่อ realtime ขาด
    const pollId = setInterval(loadAll, 30000)

    let ch = supabase.channel(`fs-display-${level}`)
    let reconnectId: ReturnType<typeof setTimeout> | null = null

    function subscribe() {
      ch = supabase.channel(`fs-display-${level}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `level=eq.${level}` }, loadAll)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'table_assignments', filter: `level=eq.${level}` }, loadAll)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finals', filter: `level=eq.${level}` }, loadAll)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'broadcast' }, (payload) => {
          const { type, level: bLevel, payload: bp } = payload.new as { type: string; level: string; payload: { message?: string } }
          if (bLevel && bLevel !== level) return
          if (type === 'current_game' || type === 'finals_created') loadAll()
          if (type === 'announcement' && bp?.message) {
            setAnnouncement(bp.message)
            setTimeout(() => setAnnouncement(null), 30000)
          }
        })
        .subscribe(status => {
          if (status === 'SUBSCRIBED') { setRealtimeOk(true); loadAll() }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setRealtimeOk(false)
            supabase.removeChannel(ch)
            // auto-reconnect หลัง 5 วินาที
            reconnectId = setTimeout(subscribe, 5000)
          }
        })
    }

    subscribe()
    return () => {
      clearInterval(pollId)
      if (reconnectId) clearTimeout(reconnectId)
      supabase.removeChannel(ch)
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current)
    }
  }, [level, loadAll])

  const standings = computeStandings(players, gameRows)
  const awards = getAwardsSummary(standings, finalsRows)

  const tablesByNum: Record<number, TARow[]> = {}
  tables.forEach(r => { if (!tablesByNum[r.table_num]) tablesByNum[r.table_num] = []; tablesByNum[r.table_num].push(r) })

  const sz = projector
    ? { name: 'text-xl', stat: 'text-lg', pts: 'text-3xl', cell: 'py-5 px-4', tableText: 'text-lg', award: 'text-8xl', awardName: 'text-4xl', awardSub: 'text-xl' }
    : { name: 'text-sm', stat: 'text-sm', pts: 'text-base', cell: 'py-2.5 px-3', tableText: 'text-sm', award: 'text-5xl', awardName: 'text-xl', awardSub: 'text-sm' }

  const dk = darkMode
    ? { bg: '#1e1b4b', card: '#312e81', border: '#4c1d95', text: 'text-white', subtext: 'text-purple-300', thead: '#4c1d95', row0: 'bg-yellow-900/30', row1: 'bg-slate-700/30', row2: 'bg-purple-900/30', rowEven: 'bg-indigo-900/10', tableBg: 'bg-indigo-900/20', banner: '#312e81' }
    : { bg: '#faf5ff', card: 'white', border: '#e9d5ff', text: 'text-gray-900', subtext: 'text-purple-400', thead: '#6d28d9', row0: 'bg-yellow-50', row1: 'bg-slate-50', row2: 'bg-purple-50', rowEven: 'bg-purple-50/30', tableBg: 'bg-purple-50', banner: 'transparent' }

  return (
    <div className="min-h-screen pb-16 transition-colors duration-300" style={{ background: dk.bg }}>
      {/* Header */}
      <div className="rounded-b-3xl p-5 text-center text-white shadow-xl mb-4"
        style={{ background: 'linear-gradient(135deg,#6d28d9,#a855f7)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-black text-purple-200 tabular-nums text-sm w-24 text-left">{clock}</span>
          <h1 className="font-display text-xl font-black flex-1">⭐ Four Stars</h1>
          <div className="flex gap-1.5 w-24 justify-end">
            <button onClick={() => setDarkMode(v => !v)}
              className={`text-xs font-bold px-2 py-1.5 rounded-lg transition ${darkMode ? 'bg-white text-purple-800' : 'bg-white/20 text-purple-100 hover:bg-white/30'}`}
              title="Dark mode">
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button onClick={() => setProjector(v => !v)}
              className={`text-xs font-bold px-2 py-1.5 rounded-lg transition ${projector ? 'bg-white text-purple-800' : 'bg-white/20 text-purple-100 hover:bg-white/30'}`}
              title="Projector mode">
              {projector ? '🔍' : '📽️'}
            </button>
            <button onClick={() => setAutoRotate(v => !v)}
              className={`text-xs font-bold px-2 py-1.5 rounded-lg transition ${autoRotate ? 'bg-white text-purple-800' : 'bg-white/20 text-purple-100 hover:bg-white/30'}`}
              title="Auto rotate">
              {autoRotate ? '⏸️' : '▶️'}
            </button>
            <button onClick={() => { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen() }}
              className="text-xs font-bold px-2 py-1.5 rounded-lg bg-white/20 text-purple-100 hover:bg-white/30 transition"
              title="Fullscreen">
              ⛶
            </button>
          </div>
        </div>
        <p className="text-purple-200 text-xs font-semibold">โรงเรียนพูลเจริญวิทยาคม</p>
      </div>

      {!realtimeOk && (
        <div className="mx-4 mb-3 rounded-2xl p-3 bg-red-100 border-2 border-red-300 text-red-700 font-bold text-sm text-center flex items-center justify-center gap-2">
          ⚠️ การเชื่อมต่อ Realtime หลุด
          <button onClick={loadAll} className="ml-2 px-3 py-1 bg-red-600 text-white rounded-xl text-xs font-bold">โหลดใหม่</button>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4">
        {/* Level + View controls */}
        <div className="mb-4 space-y-2">
          {/* Level toggle */}
          <div className="flex rounded-2xl p-1 border-2 gap-1" style={{ background: dk.card, borderColor: dk.border }}>
            {(['มต้น', 'มปลาย'] as Level[]).map(lv => (
              <button key={lv} onClick={() => { setLevel(lv); setAnnouncement(null) }}
                className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all ${level === lv ? 'bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow' : `${dk.subtext} hover:opacity-80`}`}>
                {lv === 'มต้น' ? '🌱 ม.ต้น' : '🌸 ม.ปลาย'}
              </button>
            ))}
          </div>

          {/* View tabs */}
          <div className="flex rounded-2xl p-1 border-2 gap-0.5" style={{ background: dk.card, borderColor: dk.border }}>
            {([['standings', '📊 อันดับ'], ['tables', '🪑 โต๊ะ'], ['finals', '🏆 ชิง'], ['awards', '🎖️ รางวัล']] as [View, string][]).map(([v, label]) => (
              <button key={v} onClick={() => { setView(v); setAutoRotate(false) }}
                className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all ${view === v ? 'bg-purple-600 text-white shadow' : `${dk.subtext} hover:opacity-80`}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Announcement banner */}
        {announcement && (
          <div className="mb-4 rounded-2xl p-4 text-center font-black text-white text-lg shadow-xl animate-pulse"
            style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
            📢 {announcement}
            <button onClick={() => setAnnouncement(null)} className="ml-3 text-sm opacity-70 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Current game badge */}
        {latestGame > 0 && (
          <div className="rounded-2xl p-3 mb-4 text-center text-white font-black text-sm shadow"
            style={{ background: 'linear-gradient(90deg,#7c3aed,#c026d3)' }}>
            ⚡ ขณะนี้อยู่ในเกมที่ {latestGame}
          </div>
        )}

        {/* ── STANDINGS ── */}
        {view === 'standings' && (
          <div className="rounded-3xl overflow-hidden shadow border" style={{ background: dk.card, borderColor: dk.border }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: dk.thead }} className="text-white">
                  <th className={`${sz.cell} text-center`}>อันดับ</th>
                  <th className={`${sz.cell} text-left`}>ชื่อ-สกุล</th>
                  <th className={`${sz.cell} text-center hidden sm:table-cell`}>ห้อง</th>
                  <th className={`${sz.cell} text-center`}>W-T-L</th>
                  <th className={`${sz.cell} text-center`}>แต้ม</th>
                  <th className={`${sz.cell} text-center`}>ผลต่าง</th>
                </tr>
              </thead>
              <tbody>
                {standings.length === 0 && (
                  <tr><td colSpan={6} className={`text-center py-12 ${dk.subtext}`}>ยังไม่มีข้อมูล</td></tr>
                )}
                {standings.map((s, i) => (
                  <tr key={s.player.id} className={`border-b ${i === 0 ? dk.row0 : i === 1 ? dk.row1 : i === 2 ? dk.row2 : i % 2 === 0 ? '' : dk.rowEven}`}
                    style={{ borderColor: dk.border }}>
                    <td className={`${sz.cell} text-center`}>
                      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full font-black text-sm ${i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-purple-400 text-white' : 'bg-purple-100 text-purple-600'}`}>
                        {i < 3 ? ['🥇', '🥈', '🥉'][i] : s.rank}
                      </span>
                    </td>
                    <td className={`${sz.cell} font-semibold ${sz.name} ${dk.text}`}>
                      {s.player.name}
                      <span className={`font-normal text-xs ml-1 ${dk.subtext}`}>(#{s.player.number})</span>
                    </td>
                    <td className={`${sz.cell} text-center ${sz.stat} ${dk.subtext} hidden sm:table-cell`}>{s.player.room}</td>
                    <td className={`${sz.cell} text-center ${sz.stat} text-purple-500`}>{s.w}-{s.t}-{s.l}</td>
                    <td className={`${sz.cell} text-center font-black ${sz.pts} ${dk.text}`}>{s.points}</td>
                    <td className={`${sz.cell} text-center font-bold ${sz.stat} ${s.diffSum > 0 ? 'text-emerald-500' : s.diffSum < 0 ? 'text-red-400' : dk.subtext}`}>
                      {s.diffSum > 0 ? '+' : ''}{s.diffSum}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── TABLES ── */}
        {view === 'tables' && (
          <div>
            {tables.length === 0
              ? <p className={`text-center py-12 ${dk.subtext}`}>ยังไม่มีการจัดโต๊ะ</p>
              : (
                <>
                  <p className={`font-black text-purple-500 mb-3 ${projector ? 'text-2xl' : 'text-sm'}`}>เกมที่ {latestGame}</p>
                  <div className="space-y-3">
                    {Object.entries(tablesByNum).sort(([a], [b]) => Number(a) - Number(b)).map(([tn, rows]) => (
                      <div key={tn} className="rounded-2xl overflow-hidden shadow-sm border" style={{ background: dk.card, borderColor: dk.border }}>
                        <div className="px-4 py-2.5 text-white font-black text-sm"
                          style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}>
                          โต๊ะ {tn}
                        </div>
                        <div className="px-4 py-3 space-y-2">
                          {rows.map(r => (
                            <p key={r.sub_table} className={`${sz.tableText} flex items-center gap-2`}>
                              <strong className="text-purple-500">{r.sub_table.slice(-1)}:</strong>
                              {!r.is_bye && (
                                <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${scoredSet.has(r.sub_table) ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                              )}
                              {r.is_bye
                                ? <span className="text-blue-400">🎁 {r.player1?.name} <span className="text-xs">(#{r.player1?.number})</span> ได้ bye</span>
                                : <span className={dk.text}>
                                  {r.player1?.name} <span className={`font-black ${dk.subtext}`}>(#{r.player1?.number})</span>
                                  <strong className="text-purple-500 mx-2">VS</strong>
                                  {r.player2?.name} <span className={`font-black ${dk.subtext}`}>(#{r.player2?.number})</span>
                                </span>
                              }
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
          </div>
        )}

        {/* ── FINALS ── */}
        {view === 'finals' && (
          <div className="space-y-3">
            {finalsRows.length === 0
              ? <p className={`text-center py-12 ${dk.subtext}`}>ยังไม่มีข้อมูลรอบชิงชนะเลิศ</p>
              : finalsRows.map(f => {
                const r = (f.rounds1 !== null && f.rounds2 !== null) ? computeMatchResult(f.rounds1, f.rounds2) : null
                const p1win = r?.result1 === 'W'; const p2win = r?.result2 === 'W'
                return (
                  <div key={f.pair_label} className="rounded-2xl overflow-hidden shadow-sm border" style={{ background: dk.card, borderColor: dk.border }}>
                    <div className="px-4 py-2.5 text-white font-black text-sm"
                      style={{ background: 'linear-gradient(135deg,#6d28d9,#a855f7)' }}>
                      {f.pair_label}
                    </div>
                    <div className={`px-4 py-4 flex items-center gap-3 ${sz.tableText}`}>
                      <div className={`flex-1 text-center p-3 rounded-xl ${p1win ? 'bg-emerald-100' : p2win ? 'bg-red-50' : ''}`}>
                        <p className={`font-black ${p1win ? 'text-emerald-700' : p2win ? 'text-red-400' : dk.text}`}>{f.player1?.name ?? `#${f.player1_id}`}</p>
                        {f.rounds1 !== null && <p className="font-black text-2xl text-purple-700">{f.rounds1}</p>}
                      </div>
                      <div className="font-black text-purple-300 text-xl">VS</div>
                      <div className={`flex-1 text-center p-3 rounded-xl ${p2win ? 'bg-emerald-100' : p1win ? 'bg-red-50' : ''}`}>
                        <p className={`font-black ${p2win ? 'text-emerald-700' : p1win ? 'text-red-400' : dk.text}`}>{f.player2?.name ?? `#${f.player2_id}`}</p>
                        {f.rounds2 !== null && <p className="font-black text-2xl text-purple-700">{f.rounds2}</p>}
                      </div>
                    </div>
                    {r && (
                      <div className="px-4 pb-3 text-center">
                        <span className="text-xs font-black text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">
                          ✅ {p1win ? f.player1?.name : f.player2?.name} ชนะ
                        </span>
                      </div>
                    )}
                    {!r && f.rounds1 !== null && f.rounds2 !== null && (
                      <div className="px-4 pb-3 text-center">
                        <span className="text-xs font-black text-amber-600 bg-amber-100 px-3 py-1 rounded-full">⚠️ เสมอ — กรรมการต้องตัดสิน</span>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        )}

        {/* ── AWARDS ── */}
        {view === 'awards' && (
          <div>
            {awards.tieNotes.map((note, i) => (
              <div key={i} className="mb-3 rounded-2xl p-3 bg-red-50 border border-red-200 text-red-700 font-bold text-sm">⚠️ {note}</div>
            ))}
            {awards.first && (
              <div className="rounded-3xl p-5 mb-3 flex gap-4 items-center border-2 border-yellow-300 bg-yellow-50 shadow-lg">
                <span className={sz.award}>🥇</span>
                <div>
                  <p className="text-xs font-black text-yellow-700 uppercase tracking-widest mb-1">ชนะเลิศ อันดับ 1</p>
                  <p className={`font-black ${sz.awardName} text-gray-900`}>{awards.first.name}</p>
                  <p className={`text-yellow-600 ${sz.awardSub} font-semibold`}>หมายเลข {awards.first.number} · {awards.first.room}</p>
                </div>
              </div>
            )}
            {awards.second && (
              <div className="rounded-3xl p-5 mb-3 flex gap-4 items-center border-2 border-slate-300 bg-slate-50 shadow-lg">
                <span className={sz.award}>🥈</span>
                <div>
                  <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-1">รองชนะเลิศ อันดับ 2</p>
                  <p className={`font-black ${sz.awardName} text-gray-900`}>{awards.second.name}</p>
                  <p className={`text-slate-500 ${sz.awardSub} font-semibold`}>หมายเลข {awards.second.number} · {awards.second.room}</p>
                </div>
              </div>
            )}
            {awards.third && (
              <div className="rounded-3xl p-5 mb-3 flex gap-4 items-center border-2 border-purple-300 bg-purple-50 shadow-lg">
                <span className={sz.award}>🥉</span>
                <div>
                  <p className="text-xs font-black text-purple-700 uppercase tracking-widest mb-1">อันดับ 3</p>
                  <p className={`font-black ${sz.awardName} text-gray-900`}>{awards.third.name}</p>
                  <p className={`text-purple-600 ${sz.awardSub} font-semibold`}>หมายเลข {awards.third.number} · {awards.third.room}</p>
                </div>
              </div>
            )}
            {!awards.first && !awards.second && !awards.third && (
              <p className={`text-center py-12 ${dk.subtext}`}>⏳ ยังไม่มีผลชิงชนะเลิศ</p>
            )}
            {awards.participants.length > 0 && (
              <div className="rounded-2xl p-4 border mt-3" style={{ background: dk.card, borderColor: dk.border }}>
                <p className={`font-black text-purple-700 mb-3 ${projector ? 'text-lg' : 'text-sm'}`}>🎖️ เกียรติบัตรเข้าร่วม ({awards.participants.length} คน)</p>
                <div className="space-y-1">
                  {awards.participants.map(p => (
                    <div key={p.id} className={`flex justify-between text-sm py-1.5 border-b ${dk.text}`} style={{ borderColor: dk.border }}>
                      <span>{p.name}</span>
                      <span className={`font-bold ${dk.subtext}`}>#{p.number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => window.print()}
              className="mt-4 w-full py-3 rounded-2xl font-bold text-sm bg-purple-100 text-purple-700 hover:bg-purple-200 transition active:scale-95">
              🖨️ พิมพ์รายชื่อผู้ได้รับรางวัล
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-6 text-xs font-semibold">
          {realtimeOk
            ? <span className={dk.subtext}><span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>Live · อัปเดตล่าสุด: {lastUpdate || '...'}</span>
            : <span className="text-red-400"><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1"></span>ออฟไลน์ · {lastUpdate}</span>
          }
        </div>
      </div>
    </div>
  )
}
