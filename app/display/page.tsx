'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { computeStandings, computeMatchResult, getAwardsSummary, Player, GameRow, FinalRow } from '@/lib/fs-logic'

type Level = 'มต้น' | 'มปลาย'
type View = 'standings' | 'tables' | 'finals' | 'awards'

interface TARow { game: number; table_num: number; sub_table: string; player1: Player | null; player2: Player | null; is_bye: boolean }

const VIEW_ICONS: Record<View, string> = { standings: '📊', tables: '🪑', finals: '🏆', awards: '🎖️' }
const VIEWS: View[] = ['standings', 'tables', 'finals', 'awards']

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

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!autoRotate) return
    const ms = projector ? 20000 : 15000
    const id = setInterval(() => setView(v => VIEWS[(VIEWS.indexOf(v) + 1) % VIEWS.length]), ms)
    return () => clearInterval(id)
  }, [autoRotate, projector])

  function enterProjector() {
    setProjector(true)
    setAutoRotate(true)
    document.documentElement.requestFullscreen?.().catch(() => {})
  }
  function exitProjector() {
    setProjector(false)
    setAutoRotate(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }

  const loadAll = useCallback(async () => {
    const [{ data: p }, { data: g }, { data: ta }, { data: f }] = await Promise.all([
      supabase.from('players').select('*').eq('level', level).order('number'),
      supabase.from('games').select('*').eq('level', level),
      supabase.from('table_assignments').select('*, player1:player1_id(*), player2:player2_id(*)')
        .eq('level', level).order('game', { ascending: false }).order('table_num').order('sub_table'),
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
    setScoredSet(new Set(gs.filter(r => r.game === maxGame).map(r => r.sub_table)))
    setLastUpdate(new Date().toLocaleTimeString('th-TH'))
    setRealtimeOk(true)
    if (realtimeTimer.current) clearTimeout(realtimeTimer.current)
    realtimeTimer.current = setTimeout(() => setRealtimeOk(false), 30000)
  }, [level])

  useEffect(() => {
    loadAll()
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

  const totalPairs = tables.filter(r => !r.is_bye).length
  const scoredPairs = tables.filter(r => !r.is_bye && scoredSet.has(r.sub_table)).length

  const dk = darkMode
    ? { bg: '#1e1b4b', card: '#312e81', border: '#4c1d95', text: 'text-white', subtext: 'text-purple-300', thead: '#4c1d95', row0: 'bg-yellow-900/30', row1: 'bg-slate-700/30', row2: 'bg-purple-900/30', rowEven: 'bg-indigo-900/10' }
    : { bg: '#faf5ff', card: 'white', border: '#e9d5ff', text: 'text-gray-900', subtext: 'text-purple-400', thead: '#6d28d9', row0: 'bg-yellow-50', row1: 'bg-slate-50', row2: 'bg-purple-50', rowEven: 'bg-purple-50/30' }

  // ─── PROJECTOR MODE ──────────────────────────────────────────────────
  if (projector) {
    return (
      <div className="min-h-screen bg-white flex flex-col select-none">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-6 py-3 bg-white border-b-2 border-purple-100 shadow-sm shrink-0">
          <span className="font-black text-gray-600 text-xl tabular-nums w-24 shrink-0">{clock}</span>
          <div className="flex-1 min-w-0">
            <p className="font-black text-xl text-gray-900 leading-tight">⭐ Four Stars — {level === 'มต้น' ? 'ม.ต้น' : 'ม.ปลาย'}</p>
            <p className="text-gray-400 text-xs font-semibold">
              โรงเรียนพูลเจริญวิทยาคม{latestGame > 0 ? ` · เกมที่ ${latestGame}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Level */}
            {(['มต้น', 'มปลาย'] as Level[]).map(lv => (
              <button key={lv} onClick={() => { setLevel(lv); setAnnouncement(null) }}
                className={`px-3 py-1.5 rounded-xl font-bold text-sm border-2 transition ${level === lv ? 'bg-purple-600 text-white border-purple-700' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
                {lv === 'มต้น' ? '🌱' : '🌸'}
              </button>
            ))}
            {/* View nav */}
            {VIEWS.map(v => (
              <button key={v} onClick={() => { setView(v); setAutoRotate(false) }}
                className={`w-11 h-11 rounded-xl text-xl flex items-center justify-center border-2 transition ${view === v ? 'bg-purple-600 text-white border-purple-700 shadow' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
                {VIEW_ICONS[v]}
              </button>
            ))}
            <button onClick={() => setAutoRotate(v => !v)}
              className={`w-11 h-11 rounded-xl text-xl flex items-center justify-center border-2 transition ${autoRotate ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'}`}>
              {autoRotate ? '⏸️' : '▶️'}
            </button>
            <button onClick={exitProjector}
              className="px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black text-sm flex items-center gap-1.5 active:scale-95 transition shadow">
              ✕ ออก
            </button>
          </div>
        </div>

        {/* Announcement */}
        {announcement && (
          <div className="mx-6 mt-3 rounded-2xl p-4 text-center font-black text-white text-2xl shadow-xl animate-pulse shrink-0"
            style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
            📢 {announcement}
            <button onClick={() => setAnnouncement(null)} className="ml-4 text-base opacity-70 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-auto p-6">

          {/* ── STANDINGS ── */}
          {view === 'standings' && (
            <div className="rounded-3xl overflow-hidden shadow border border-gray-200">
              <table className="w-full">
                <thead>
                  <tr className="text-white" style={{ background: '#6d28d9' }}>
                    <th className="py-4 px-5 text-center text-lg">อันดับ</th>
                    <th className="py-4 px-5 text-left text-lg">ชื่อ-สกุล</th>
                    <th className="py-4 px-5 text-center text-lg">W-T-L</th>
                    <th className="py-4 px-5 text-center text-lg">แต้ม</th>
                    <th className="py-4 px-5 text-center text-lg">ผลต่าง</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-16 text-gray-400 text-2xl">ยังไม่มีข้อมูล</td></tr>
                  )}
                  {standings.map((s, i) => (
                    <tr key={s.player.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-purple-50/40'}`}>
                      <td className="py-4 px-5 text-center">
                        <span className={`inline-flex items-center justify-center w-12 h-12 rounded-full font-black text-2xl ${i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-purple-400 text-white' : 'bg-purple-100 text-purple-600'}`}>
                          {i < 3 ? ['🥇', '🥈', '🥉'][i] : s.rank}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <span className="font-black text-2xl text-gray-900">{s.player.name}</span>
                        <span className="text-purple-400 font-bold text-lg ml-2">(#{s.player.number})</span>
                      </td>
                      <td className="py-4 px-5 text-center font-bold text-xl text-purple-500">{s.w}-{s.t}-{s.l}</td>
                      <td className="py-4 px-5 text-center font-black text-4xl text-gray-900">{s.points}</td>
                      <td className={`py-4 px-5 text-center font-black text-xl ${s.diffSum > 0 ? 'text-emerald-500' : s.diffSum < 0 ? 'text-red-400' : 'text-gray-400'}`}>
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
                ? <p className="text-center py-20 text-gray-400 text-3xl font-bold">ยังไม่มีการจัดโต๊ะ</p>
                : <>
                  {/* Progress header */}
                  <div className="rounded-2xl px-6 py-4 mb-5 text-white font-black text-xl shadow"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}>
                    คู่แข่งเกมที่ {latestGame} — {totalPairs} คู่ · {scoredPairs} กรอกแล้ว · {totalPairs - scoredPairs} คงเหลือ
                  </div>
                  {/* 2-column grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(tablesByNum).sort(([a], [b]) => Number(a) - Number(b)).map(([tn, rows]) => {
                      const allScored = rows.filter(r => !r.is_bye).every(r => scoredSet.has(r.sub_table))
                      return (
                        <div key={tn} className="rounded-2xl overflow-hidden shadow border border-gray-200 relative bg-white">
                          <span className={`absolute top-3 right-3 w-4 h-4 rounded-full border-2 border-white shadow ${allScored ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                          <div className="px-4 py-3 text-white font-black text-lg"
                            style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}>
                            โต๊ะ {tn}
                          </div>
                          <div className="px-4 py-3 space-y-2">
                            {rows.map(r => (
                              <p key={r.sub_table} className="text-base flex items-center gap-2 leading-snug">
                                <strong className="text-purple-500 w-5 shrink-0">{r.sub_table.slice(-1)}:</strong>
                                {r.is_bye
                                  ? <span className="text-blue-500 font-semibold">🎁 {r.player1?.name} <span className="text-gray-400">(#{r.player1?.number})</span> bye</span>
                                  : <>
                                    <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${scoredSet.has(r.sub_table) ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                                    <span className="text-gray-800 font-semibold">
                                      {r.player1?.name} <span className="text-purple-500 font-black">(#{r.player1?.number})</span>
                                      <strong className="text-purple-300 mx-2">VS</strong>
                                      {r.player2?.name} <span className="text-purple-500 font-black">(#{r.player2?.number})</span>
                                    </span>
                                  </>
                                }
                              </p>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              }
            </div>
          )}

          {/* ── FINALS ── */}
          {view === 'finals' && (
            <div className="space-y-4 max-w-2xl mx-auto">
              {finalsRows.length === 0
                ? <p className="text-center py-20 text-gray-400 text-3xl font-bold">ยังไม่มีข้อมูลรอบชิง</p>
                : finalsRows.map(f => {
                  const r = (f.rounds1 !== null && f.rounds2 !== null) ? computeMatchResult(f.rounds1, f.rounds2) : null
                  const p1win = r?.result1 === 'W'; const p2win = r?.result2 === 'W'
                  return (
                    <div key={f.pair_label} className="rounded-2xl overflow-hidden shadow border border-gray-200 bg-white">
                      <div className="px-5 py-3 text-white font-black text-2xl"
                        style={{ background: 'linear-gradient(135deg,#6d28d9,#a855f7)' }}>
                        {f.pair_label}
                      </div>
                      <div className="px-5 py-6 flex items-center gap-5">
                        <div className={`flex-1 text-center p-5 rounded-2xl ${p1win ? 'bg-emerald-100' : p2win ? 'bg-red-50' : 'bg-gray-50'}`}>
                          <p className={`font-black text-3xl ${p1win ? 'text-emerald-700' : p2win ? 'text-red-400' : 'text-gray-800'}`}>{f.player1?.name ?? `#${f.player1_id}`}</p>
                          {f.rounds1 !== null && <p className="font-black text-6xl text-purple-700 mt-2">{f.rounds1}</p>}
                        </div>
                        <div className="font-black text-purple-300 text-4xl">VS</div>
                        <div className={`flex-1 text-center p-5 rounded-2xl ${p2win ? 'bg-emerald-100' : p1win ? 'bg-red-50' : 'bg-gray-50'}`}>
                          <p className={`font-black text-3xl ${p2win ? 'text-emerald-700' : p1win ? 'text-red-400' : 'text-gray-800'}`}>{f.player2?.name ?? `#${f.player2_id}`}</p>
                          {f.rounds2 !== null && <p className="font-black text-6xl text-purple-700 mt-2">{f.rounds2}</p>}
                        </div>
                      </div>
                      {r && (
                        <div className="px-5 pb-5 text-center">
                          <span className="font-black text-emerald-600 bg-emerald-100 px-5 py-2 rounded-full text-xl">
                            ✅ {p1win ? f.player1?.name : f.player2?.name} ชนะ
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          )}

          {/* ── AWARDS ── */}
          {view === 'awards' && (
            <div className="space-y-4 max-w-2xl mx-auto">
              {awards.first && (
                <div className="rounded-3xl p-6 flex gap-5 items-center border-2 border-yellow-300 bg-yellow-50 shadow-lg">
                  <span className="text-8xl">🥇</span>
                  <div>
                    <p className="text-sm font-black text-yellow-700 uppercase tracking-widest mb-1">ชนะเลิศ อันดับ 1</p>
                    <p className="font-black text-4xl text-gray-900">{awards.first.name}</p>
                    <p className="text-yellow-600 text-xl font-semibold mt-1">หมายเลข {awards.first.number} · {awards.first.room}</p>
                  </div>
                </div>
              )}
              {awards.second && (
                <div className="rounded-3xl p-6 flex gap-5 items-center border-2 border-slate-300 bg-slate-50 shadow-lg">
                  <span className="text-8xl">🥈</span>
                  <div>
                    <p className="text-sm font-black text-slate-600 uppercase tracking-widest mb-1">รองชนะเลิศ อันดับ 2</p>
                    <p className="font-black text-4xl text-gray-900">{awards.second.name}</p>
                    <p className="text-slate-500 text-xl font-semibold mt-1">หมายเลข {awards.second.number} · {awards.second.room}</p>
                  </div>
                </div>
              )}
              {awards.third && (
                <div className="rounded-3xl p-6 flex gap-5 items-center border-2 border-purple-300 bg-purple-50 shadow-lg">
                  <span className="text-8xl">🥉</span>
                  <div>
                    <p className="text-sm font-black text-purple-700 uppercase tracking-widest mb-1">อันดับ 3</p>
                    <p className="font-black text-4xl text-gray-900">{awards.third.name}</p>
                    <p className="text-purple-600 text-xl font-semibold mt-1">หมายเลข {awards.third.number} · {awards.third.room}</p>
                  </div>
                </div>
              )}
              {!awards.first && !awards.second && !awards.third && (
                <p className="text-center py-20 text-gray-400 text-3xl font-bold">⏳ ยังไม่มีผลชิงชนะเลิศ</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-2 bg-white border-t border-gray-100 text-center text-sm font-semibold text-gray-400 shrink-0">
          {realtimeOk
            ? <><span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1 animate-pulse" />Live · {lastUpdate || '...'}</>
            : <><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" /><span className="text-red-400">ออฟไลน์ · {lastUpdate}</span></>}
        </div>
      </div>
    )
  }

  // ─── NORMAL MODE ─────────────────────────────────────────────────────
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
              className={`text-xs font-bold px-2 py-1.5 rounded-lg transition ${darkMode ? 'bg-white text-purple-800' : 'bg-white/20 text-purple-100 hover:bg-white/30'}`}>
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button onClick={enterProjector}
              className="text-xs font-bold px-2 py-1.5 rounded-lg bg-white/20 text-purple-100 hover:bg-white/30 transition"
              title="Projector mode">📽️</button>
            <button onClick={() => setAutoRotate(v => !v)}
              className={`text-xs font-bold px-2 py-1.5 rounded-lg transition ${autoRotate ? 'bg-white text-purple-800' : 'bg-white/20 text-purple-100 hover:bg-white/30'}`}>
              {autoRotate ? '⏸️' : '▶️'}
            </button>
            <button onClick={() => { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen() }}
              className="text-xs font-bold px-2 py-1.5 rounded-lg bg-white/20 text-purple-100 hover:bg-white/30 transition">⛶</button>
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
        <div className="mb-4 space-y-2">
          <div className="flex rounded-2xl p-1 border-2 gap-1" style={{ background: dk.card, borderColor: dk.border }}>
            {(['มต้น', 'มปลาย'] as Level[]).map(lv => (
              <button key={lv} onClick={() => { setLevel(lv); setAnnouncement(null) }}
                className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all ${level === lv ? 'bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow' : `${dk.subtext} hover:opacity-80`}`}>
                {lv === 'มต้น' ? '🌱 ม.ต้น' : '🌸 ม.ปลาย'}
              </button>
            ))}
          </div>
          <div className="flex rounded-2xl p-1 border-2 gap-0.5" style={{ background: dk.card, borderColor: dk.border }}>
            {(VIEWS).map(v => (
              <button key={v} onClick={() => { setView(v); setAutoRotate(false) }}
                className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all ${view === v ? 'bg-purple-600 text-white shadow' : `${dk.subtext} hover:opacity-80`}`}>
                {VIEW_ICONS[v]} {v === 'standings' ? 'อันดับ' : v === 'tables' ? 'โต๊ะ' : v === 'finals' ? 'ชิง' : 'รางวัล'}
              </button>
            ))}
          </div>
        </div>

        {announcement && (
          <div className="mb-4 rounded-2xl p-4 text-center font-black text-white text-lg shadow-xl animate-pulse"
            style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
            📢 {announcement}
            <button onClick={() => setAnnouncement(null)} className="ml-3 text-sm opacity-70 hover:opacity-100">✕</button>
          </div>
        )}

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
                  <th className="py-2.5 px-3 text-center">อันดับ</th>
                  <th className="py-2.5 px-3 text-left">ชื่อ-สกุล</th>
                  <th className="py-2.5 px-3 text-center hidden sm:table-cell">ห้อง</th>
                  <th className="py-2.5 px-3 text-center">W-T-L</th>
                  <th className="py-2.5 px-3 text-center">แต้ม</th>
                  <th className="py-2.5 px-3 text-center">ผลต่าง</th>
                </tr>
              </thead>
              <tbody>
                {standings.length === 0 && <tr><td colSpan={6} className={`text-center py-12 ${dk.subtext}`}>ยังไม่มีข้อมูล</td></tr>}
                {standings.map((s, i) => (
                  <tr key={s.player.id} className={`border-b ${i === 0 ? dk.row0 : i === 1 ? dk.row1 : i === 2 ? dk.row2 : i % 2 === 0 ? '' : dk.rowEven}`}
                    style={{ borderColor: dk.border }}>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full font-black text-sm ${i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-purple-400 text-white' : 'bg-purple-100 text-purple-600'}`}>
                        {i < 3 ? ['🥇', '🥈', '🥉'][i] : s.rank}
                      </span>
                    </td>
                    <td className={`py-2.5 px-3 font-semibold text-sm ${dk.text}`}>
                      {s.player.name}<span className={`font-normal text-xs ml-1 ${dk.subtext}`}>(#{s.player.number})</span>
                    </td>
                    <td className={`py-2.5 px-3 text-center text-sm ${dk.subtext} hidden sm:table-cell`}>{s.player.room}</td>
                    <td className="py-2.5 px-3 text-center text-sm text-purple-500">{s.w}-{s.t}-{s.l}</td>
                    <td className={`py-2.5 px-3 text-center font-black text-base ${dk.text}`}>{s.points}</td>
                    <td className={`py-2.5 px-3 text-center font-bold text-sm ${s.diffSum > 0 ? 'text-emerald-500' : s.diffSum < 0 ? 'text-red-400' : dk.subtext}`}>
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
              : <>
                <div className="rounded-2xl px-4 py-3 mb-3 text-white font-black text-sm shadow"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}>
                  เกมที่ {latestGame} · {totalPairs} คู่ · กรอกแล้ว {scoredPairs} · คงเหลือ {totalPairs - scoredPairs}
                </div>
                <div className="space-y-3">
                  {Object.entries(tablesByNum).sort(([a], [b]) => Number(a) - Number(b)).map(([tn, rows]) => {
                    const allScored = rows.filter(r => !r.is_bye).every(r => scoredSet.has(r.sub_table))
                    return (
                      <div key={tn} className="rounded-2xl overflow-hidden shadow-sm border relative" style={{ background: dk.card, borderColor: dk.border }}>
                        <span className={`absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full ${allScored ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                        <div className="px-4 py-2.5 text-white font-black text-sm" style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}>
                          โต๊ะ {tn}
                        </div>
                        <div className="px-4 py-3 space-y-2">
                          {rows.map(r => (
                            <p key={r.sub_table} className={`text-sm flex items-center gap-2 ${dk.text}`}>
                              <strong className="text-purple-500">{r.sub_table.slice(-1)}:</strong>
                              {!r.is_bye && <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${scoredSet.has(r.sub_table) ? 'bg-emerald-400' : 'bg-gray-300'}`} />}
                              {r.is_bye
                                ? <span className="text-blue-400">🎁 {r.player1?.name} <span className="text-xs">(#{r.player1?.number})</span> ได้ bye</span>
                                : <span>
                                  {r.player1?.name} <span className={`font-black ${dk.subtext}`}>(#{r.player1?.number})</span>
                                  <strong className="text-purple-500 mx-2">VS</strong>
                                  {r.player2?.name} <span className={`font-black ${dk.subtext}`}>(#{r.player2?.number})</span>
                                </span>
                              }
                            </p>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            }
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
                    <div className="px-4 py-2.5 text-white font-black text-sm" style={{ background: 'linear-gradient(135deg,#6d28d9,#a855f7)' }}>
                      {f.pair_label}
                    </div>
                    <div className="px-4 py-4 flex items-center gap-3 text-sm">
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
                    {r && <div className="px-4 pb-3 text-center"><span className="text-xs font-black text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">✅ {p1win ? f.player1?.name : f.player2?.name} ชนะ</span></div>}
                    {!r && f.rounds1 !== null && f.rounds2 !== null && <div className="px-4 pb-3 text-center"><span className="text-xs font-black text-amber-600 bg-amber-100 px-3 py-1 rounded-full">⚠️ เสมอ — กรรมการต้องตัดสิน</span></div>}
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
                <span className="text-5xl">🥇</span>
                <div>
                  <p className="text-xs font-black text-yellow-700 uppercase tracking-widest mb-1">ชนะเลิศ อันดับ 1</p>
                  <p className="font-black text-xl text-gray-900">{awards.first.name}</p>
                  <p className="text-yellow-600 text-sm font-semibold">หมายเลข {awards.first.number} · {awards.first.room}</p>
                </div>
              </div>
            )}
            {awards.second && (
              <div className="rounded-3xl p-5 mb-3 flex gap-4 items-center border-2 border-slate-300 bg-slate-50 shadow-lg">
                <span className="text-5xl">🥈</span>
                <div>
                  <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-1">รองชนะเลิศ อันดับ 2</p>
                  <p className="font-black text-xl text-gray-900">{awards.second.name}</p>
                  <p className="text-slate-500 text-sm font-semibold">หมายเลข {awards.second.number} · {awards.second.room}</p>
                </div>
              </div>
            )}
            {awards.third && (
              <div className="rounded-3xl p-5 mb-3 flex gap-4 items-center border-2 border-purple-300 bg-purple-50 shadow-lg">
                <span className="text-5xl">🥉</span>
                <div>
                  <p className="text-xs font-black text-purple-700 uppercase tracking-widest mb-1">อันดับ 3</p>
                  <p className="font-black text-xl text-gray-900">{awards.third.name}</p>
                  <p className="text-purple-600 text-sm font-semibold">หมายเลข {awards.third.number} · {awards.third.room}</p>
                </div>
              </div>
            )}
            {!awards.first && !awards.second && !awards.third && (
              <p className={`text-center py-12 ${dk.subtext}`}>⏳ ยังไม่มีผลชิงชนะเลิศ</p>
            )}
            {awards.participants.length > 0 && (
              <div className="rounded-2xl p-4 border mt-3" style={{ background: dk.card, borderColor: dk.border }}>
                <p className={`font-black text-purple-700 mb-3 text-sm`}>🎖️ เกียรติบัตรเข้าร่วม ({awards.participants.length} คน)</p>
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

        <div className="text-center mt-6 text-xs font-semibold">
          {realtimeOk
            ? <span className={dk.subtext}><span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1 animate-pulse" />Live · อัปเดตล่าสุด: {lastUpdate || '...'}</span>
            : <span className="text-red-400"><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />ออฟไลน์ · {lastUpdate}</span>}
        </div>
      </div>
    </div>
  )
}
