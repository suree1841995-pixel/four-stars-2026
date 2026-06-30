'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/useAuth'
import LoginScreen from '@/components/LoginScreen'

type Level = 'มต้น' | 'มปลาย'
type Mode = 'qualify' | 'final'
type LookupStatus = 'idle' | 'ok' | 'bye' | 'notfound'

interface TableMapEntry {
  player1_id: number; player2_id: number | null
  player1_name: string; player2_name: string
  player1_num: number; player2_num: number
  is_bye: boolean
}
interface TableMap {
  latestGame: number
  games: Record<string, Record<string, TableMapEntry>>
  finals: Record<string, TableMapEntry>
}

export default function ScoringPage() {
  const { authed, checked, login } = useAuth('scoring')
  const [level, setLevel] = useState<Level>('มต้น')
  const [mode, setMode] = useState<Mode>('qualify')
  const [tableMap, setTableMap] = useState<TableMap | null>(null)
  const [gameNum, setGameNum] = useState('1')
  const [tableNum, setTableNum] = useState('')
  const [tableSide, setTableSide] = useState<'A' | 'B' | ''>('')
  const [pairLabel, setPairLabel] = useState('ชิงที่ 1-2')
  const [id1, setId1] = useState(''); const [name1, setName1] = useState('')
  const [id2, setId2] = useState(''); const [name2, setName2] = useState('')
  const [num1, setNum1] = useState(0); const [num2, setNum2] = useState(0)
  const [rounds1, setRounds1] = useState(''); const [rounds2, setRounds2] = useState('')
  const [isBye, setIsBye] = useState(false)
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle')
  const [status, setStatus] = useState<{ text: string; type: 'ok' | 'err' | 'info' } | null>(null)
  const [saving, setSaving] = useState(false)
  const [userPickedGame, setUserPickedGame] = useState(false)
  const [confirmOverwrite, setConfirmOverwrite] = useState<{ existing: { rounds1: number; rounds2: number }; payload: object } | null>(null)
  const [scoredSubTables, setScoredSubTables] = useState<Set<string>>(new Set())

  const tableNumRef = useRef<HTMLInputElement>(null)
  const rounds1Ref = useRef<HTMLInputElement>(null)
  const rounds2Ref = useRef<HTMLInputElement>(null)

  const subTable = tableNum && tableSide ? `${tableNum}${tableSide}` : ''

  const loadTableMap = useCallback(async (forceSelectGame = false) => {
    const [taRes, finalsRes, gamesRes] = await Promise.all([
      fetch(`/api/tables?level=${encodeURIComponent(level)}`),
      fetch(`/api/finals?level=${encodeURIComponent(level)}`),
      fetch(`/api/games?level=${encodeURIComponent(level)}`),
    ])
    if (!taRes.ok) return
    const taData: {
      game: number; sub_table: string; table_num: number
      player1: { id: number; name: string; number: number } | null
      player2: { id: number; name: string; number: number } | null
      is_bye: boolean
    }[] = await taRes.json()

    const games: TableMap['games'] = {}
    let latestGame = 0
    for (const r of taData) {
      const gKey = String(r.game)
      if (!games[gKey]) games[gKey] = {}
      if (r.game > latestGame) latestGame = r.game
      games[gKey][r.sub_table] = {
        player1_id: r.player1?.id ?? 0, player2_id: r.player2?.id ?? null,
        player1_name: r.player1?.name ?? '', player2_name: r.player2?.name ?? '',
        player1_num: r.player1?.number ?? 0, player2_num: r.player2?.number ?? 0,
        is_bye: r.is_bye
      }
    }

    const finals: TableMap['finals'] = {}
    if (finalsRes.ok) {
      const fd: { pair_label: string; player1: { id: number; name: string; number: number } | null; player2: { id: number; name: string; number: number } | null }[] = await finalsRes.json()
      for (const f of fd) {
        finals[f.pair_label] = {
          player1_id: f.player1?.id ?? 0, player2_id: f.player2?.id ?? null,
          player1_name: f.player1?.name ?? '', player2_name: f.player2?.name ?? '',
          player1_num: f.player1?.number ?? 0, player2_num: f.player2?.number ?? 0,
          is_bye: false
        }
      }
    }

    // คำนวณว่าโต๊ะไหนกรอกแล้ว
    if (gamesRes.ok) {
      const gd: { game: number; sub_table: string; rounds1: number | null }[] = await gamesRes.json()
      setScoredSubTables(new Set(gd.filter(g => g.rounds1 !== null).map(g => `${g.game}_${g.sub_table}`)))
    }

    const newMap: TableMap = { latestGame, games, finals }
    setTableMap(newMap)
    if (forceSelectGame && !userPickedGame && latestGame > 0) {
      setGameNum(String(latestGame))
    }
  }, [level, userPickedGame])

  useEffect(() => {
    if (!authed) return
    loadTableMap(true)
    const id = setInterval(() => loadTableMap(false), 30000)
    return () => clearInterval(id)
  }, [authed, level, loadTableMap])

  // Lookup when subTable or gameNum changes
  useEffect(() => {
    if (!tableMap) return
    if (mode === 'qualify') {
      if (!subTable) {
        setId1(''); setId2(''); setName1(''); setName2(''); setNum1(0); setNum2(0)
        setIsBye(false); setLookupStatus('idle'); return
      }
      const entry = (tableMap.games[gameNum] || {})[subTable]
      if (!entry) {
        setId1(''); setId2(''); setName1(''); setName2(''); setNum1(0); setNum2(0)
        setIsBye(false); setLookupStatus('notfound'); return
      }
      setId1(String(entry.player1_id)); setName1(entry.player1_name); setNum1(entry.player1_num)
      setId2(entry.player2_id ? String(entry.player2_id) : ''); setName2(entry.player2_name); setNum2(entry.player2_num)
      setIsBye(entry.is_bye)
      setLookupStatus(entry.is_bye ? 'bye' : 'ok')
      if (!entry.is_bye) setTimeout(() => rounds1Ref.current?.focus(), 50)
    } else {
      const entry = tableMap.finals[pairLabel]
      if (!entry) { setId1(''); setId2(''); setName1(''); setName2(''); return }
      setId1(String(entry.player1_id)); setName1(entry.player1_name); setNum1(entry.player1_num)
      setId2(String(entry.player2_id)); setName2(entry.player2_name); setNum2(entry.player2_num)
      setIsBye(false)
    }
  }, [tableMap, gameNum, subTable, pairLabel, mode])

  const sumWarning = rounds1 !== '' && rounds2 !== '' && (Number(rounds1) + Number(rounds2)) !== 3

  // คำนวณ pills
  const currentGameTables = tableMap?.games[gameNum] || {}
  const allSubTablesSorted = Object.keys(currentGameTables).sort((a, b) => {
    const na = parseInt(a.replace(/\D/g, '')), nb = parseInt(b.replace(/\D/g, ''))
    return na !== nb ? na - nb : a.localeCompare(b)
  })
  const nonByeSubs = allSubTablesSorted.filter(st => !currentGameTables[st].is_bye)
  const scoredCount = nonByeSubs.filter(st => scoredSubTables.has(`${gameNum}_${st}`)).length

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!id1 && !isBye) { setStatus({ text: 'ยังไม่พบข้อมูลคู่แข่ง — เลือกเกมและโต๊ะก่อน', type: 'err' }); return }
    if (!isBye && (rounds1 === '' || rounds2 === '')) {
      setStatus({ text: 'กรุณากรอกรอบย่อยที่ชนะทั้งสองฝั่ง', type: 'err' }); return
    }
    setSaving(true)
    try {
      if (mode === 'qualify') {
        const payload = { game: Number(gameNum), level, sub_table: subTable, player1_id: Number(id1), rounds1: Number(rounds1), player2_id: id2 ? Number(id2) : null, rounds2: Number(rounds2) }
        const res = await fetch('/api/games', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (res.status === 409) {
          const d = await res.json()
          setConfirmOverwrite({ existing: d.existing, payload })
          setSaving(false)
          return
        }
        if (!res.ok) { const d = await res.json(); setStatus({ text: `❌ ${d.error}`, type: 'err' }); return }
        // อัปเดต scoredSubTables ทันที
        setScoredSubTables(prev => new Set([...prev, `${gameNum}_${subTable}`]))
        const r1 = Number(rounds1), r2 = Number(rounds2)
        const resultText = r1 > r2 ? `${name1} ชนะ (${r1}-${r2})` : r1 < r2 ? `${name2} ชนะ (${r2}-${r1})` : `เสมอ (${r1}-${r2})`
        setStatus({ text: `✅ บันทึกเกม ${gameNum} โต๊ะ ${subTable} — ${resultText}`, type: 'ok' })
      } else {
        const res = await fetch('/api/finals', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level, pair_label: pairLabel, rounds1: Number(rounds1), rounds2: Number(rounds2) })
        })
        if (!res.ok) {
          const errText = await res.text()
          let errMsg = 'เกิดข้อผิดพลาด'
          try { errMsg = JSON.parse(errText).error ?? errMsg } catch { /* ignore */ }
          setStatus({ text: `❌ ${errMsg}`, type: 'err' }); return
        }
        setStatus({ text: `✅ บันทึก ${pairLabel} สำเร็จ`, type: 'ok' })
      }
      setRounds1(''); setRounds2('')
      setTableNum(''); setTableSide('')
      setId1(''); setId2(''); setName1(''); setName2(''); setNum1(0); setNum2(0)
      setLookupStatus('idle')
      setTimeout(() => { tableNumRef.current?.focus() }, 50)
      setTimeout(() => setStatus(null), 5000)
    } finally {
      setSaving(false)
    }
  }

  async function confirmAndOverwrite() {
    if (!confirmOverwrite) return
    setSaving(true)
    const res = await fetch('/api/games', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...confirmOverwrite.payload, force: true })
    })
    setConfirmOverwrite(null)
    if (!res.ok) { const d = await res.json(); setStatus({ text: `❌ ${d.error}`, type: 'err' }); setSaving(false); return }
    setScoredSubTables(prev => new Set([...prev, `${gameNum}_${subTable}`]))
    const r1 = Number(rounds1), r2 = Number(rounds2)
    const resultText = r1 > r2 ? `${name1} ชนะ (${r1}-${r2})` : r1 < r2 ? `${name2} ชนะ (${r2}-${r1})` : `เสมอ (${r1}-${r2})`
    setStatus({ text: `✅ เขียนทับผลเกม ${gameNum} โต๊ะ ${subTable} — ${resultText}`, type: 'ok' })
    setRounds1(''); setRounds2('')
    setTableNum(''); setTableSide(''); setId1(''); setId2(''); setName1(''); setName2(''); setNum1(0); setNum2(0)
    setLookupStatus('idle')
    setTimeout(() => { tableNumRef.current?.focus() }, 50)
    setTimeout(() => setStatus(null), 5000)
    setSaving(false)
  }

  if (!checked) return null
  if (!authed) return <LoginScreen role="scoring" onLogin={login} />

  const statusColors = { ok: 'bg-emerald-100 text-emerald-800 border-emerald-300', err: 'bg-red-100 text-red-800 border-red-300', info: 'bg-purple-100 text-purple-800 border-purple-300' }

  const maxGame = tableMap?.latestGame ?? 6
  const submitLabel = subTable && lookupStatus === 'ok' ? `🚀 บันทึกผล โต๊ะ ${subTable}` : mode === 'final' ? '🚀 บันทึกรอบชิง' : '🚀 บันทึกผลแมตช์'

  return (
    <div className="min-h-screen flex flex-col items-center p-4 pb-10" style={{ background: '#faf5ff' }}>
      {/* Header */}
      <div className="w-full max-w-md rounded-3xl p-5 text-center text-white mb-4 shadow-xl"
        style={{ background: 'linear-gradient(135deg,#7c3aed,#c026d3)' }}>
        <div className="text-3xl mb-1">✍️</div>
        <h1 className="font-display text-xl font-black">กรอกผลแมตช์</h1>
        <p className="text-purple-100 text-xs mt-1 font-semibold">โรงเรียนพูลเจริญวิทยาคม</p>
      </div>

      <div className="w-full max-w-md space-y-3">
        {/* Level toggle */}
        <div className="flex bg-white rounded-2xl p-1.5 border-2 border-purple-200 shadow-sm">
          {(['มต้น', 'มปลาย'] as Level[]).map(lv => (
            <button key={lv} onClick={() => { setLevel(lv); setUserPickedGame(false); setGameNum(''); setTableNum(''); setTableSide(''); setLookupStatus('idle'); setId1(''); setId2(''); setName1(''); setName2('') }}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${level === lv ? 'bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow' : 'text-purple-400 hover:text-purple-700'}`}>
              {lv === 'มต้น' ? 'ม.ต้น' : 'ม.ปลาย'}
            </button>
          ))}
        </div>

        {/* Mode toggle */}
        <div className="flex bg-white rounded-2xl p-1.5 border-2 border-purple-200 shadow-sm">
          {([['qualify', 'รอบคัดเลือก'], ['final', 'รอบชิงชนะเลิศ']] as [Mode, string][]).map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${mode === m ? 'bg-gradient-to-r from-fuchsia-600 to-purple-400 text-white shadow' : 'text-purple-400 hover:text-purple-700'}`}>
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="bg-white rounded-3xl p-5 shadow-sm border border-purple-100 space-y-4">
          {mode === 'qualify' ? (
            <>
              {/* Game selector */}
              <div>
                <label className="block text-xs font-bold text-purple-700 mb-2">🎮 เกมที่</label>
                <div className="flex gap-2">
                  {Array.from({ length: maxGame }, (_, i) => i + 1).map(g => (
                    <button key={g} type="button"
                      onClick={() => { setGameNum(String(g)); setUserPickedGame(true); setTableNum(''); setTableSide(''); setLookupStatus('idle') }}
                      className={`flex-1 py-2 rounded-xl font-black text-sm border-2 transition-all relative ${gameNum === String(g)
                        ? 'bg-violet-600 border-violet-700 text-white shadow'
                        : 'bg-purple-50 border-purple-200 text-purple-600 hover:border-purple-400'}`}>
                      {g}
                      {tableMap?.latestGame === g && (
                        <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress pills */}
              {gameNum && allSubTablesSorted.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-purple-700">📋 ความคืบหน้าเกม {gameNum}</label>
                    <span className="text-xs font-bold text-purple-400">{scoredCount}/{nonByeSubs.length} คู่</span>
                  </div>
                  <div className="w-full bg-purple-100 rounded-full h-1.5 mb-2">
                    <div className="bg-emerald-400 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${nonByeSubs.length > 0 ? (scoredCount / nonByeSubs.length) * 100 : 0}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {allSubTablesSorted.map(st => {
                      const entry = currentGameTables[st]
                      if (entry.is_bye) return (
                        <span key={st} className="px-2 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-300 border border-blue-100">
                          {st}🎁
                        </span>
                      )
                      const isScored = scoredSubTables.has(`${gameNum}_${st}`)
                      const isCurrent = st === subTable
                      return (
                        <button key={st} type="button"
                          onClick={() => {
                            const n = st.replace(/\D/g, '')
                            const s = st.slice(-1) as 'A' | 'B'
                            setTableNum(n); setTableSide(s); setLookupStatus('idle')
                          }}
                          className={`px-2.5 py-1 rounded-lg font-black text-xs transition-all border-2 active:scale-95 ${
                            isCurrent ? 'border-violet-500 bg-violet-100 text-violet-700 shadow' :
                            isScored ? 'border-emerald-200 bg-emerald-50 text-emerald-600' :
                            'border-red-200 bg-red-50 text-red-500 hover:border-red-400'
                          }`}>
                          {st}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Table number + A/B selector */}
              <div>
                <label className="block text-xs font-bold text-purple-700 mb-2">🪑 โต๊ะ</label>
                <div className="flex gap-2 items-stretch">
                  <input
                    ref={tableNumRef}
                    type="text"
                    inputMode="numeric"
                    value={tableNum}
                    onChange={e => { setTableNum(e.target.value.replace(/\D/g, '')); setLookupStatus('idle') }}
                    placeholder="หมายเลขโต๊ะ"
                    className="flex-1 px-3 py-2.5 rounded-xl border-2 border-purple-200 bg-purple-50 font-black text-lg text-center focus:outline-none focus:border-violet-500"
                  />
                  {(['A', 'B'] as const).map(side => (
                    <button key={side} type="button"
                      onClick={() => setTableSide(prev => prev === side ? '' : side)}
                      className={`w-14 rounded-xl font-black text-xl border-2 transition-all active:scale-95 ${tableSide === side
                        ? 'bg-fuchsia-600 border-fuchsia-700 text-white shadow-md'
                        : 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-600 hover:border-fuchsia-400'}`}>
                      {side}
                    </button>
                  ))}
                </div>

                {/* Lookup status */}
                <div className="mt-2 min-h-[1.5rem]">
                  {lookupStatus === 'ok' && <p className="text-xs font-bold text-emerald-600">✅ พบคู่แข่งโต๊ะ {subTable}</p>}
                  {lookupStatus === 'bye' && <p className="text-xs font-bold text-blue-600">🎁 โต๊ะนี้เป็น bye — บันทึกให้อัตโนมัติ</p>}
                  {lookupStatus === 'notfound' && tableNum && tableSide && <p className="text-xs font-bold text-red-500">❌ ไม่พบโต๊ะ {subTable} ในเกม {gameNum} — ตรวจสอบอีกครั้ง</p>}
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-bold text-purple-700 mb-2">🏆 คู่ชิง</label>
              <div className="flex gap-2">
                {(['ชิงที่ 1-2', 'ชิงที่ 3-4'] as const).map(pair => (
                  <button key={pair} type="button" onClick={() => setPairLabel(pair)}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-all ${pairLabel === pair
                      ? 'bg-violet-600 border-violet-700 text-white shadow'
                      : 'bg-purple-50 border-purple-200 text-purple-600 hover:border-purple-400'}`}>
                    {pair === 'ชิงที่ 1-2' ? '🥇 อันดับ 1–2' : '🥉 อันดับ 3–4'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Player info */}
          {isBye ? (
            <div className="bg-blue-50 rounded-2xl p-4 text-sm text-blue-700 font-semibold border border-blue-200 text-center">
              🎁 <strong>{name1}</strong> ได้ bye<br />
              <span className="text-xs text-blue-500 font-normal mt-1 block">ระบบบันทึกชนะ 2-0 ให้อัตโนมัติแล้ว</span>
            </div>
          ) : (id1 || mode === 'final') ? (
            <>
              <div className="flex gap-2 items-center">
                <div className={`flex-1 rounded-2xl p-3 border-2 text-center transition-all ${lookupStatus === 'ok' ? 'bg-violet-50 border-violet-200' : 'bg-purple-50 border-purple-100'}`}>
                  <p className="text-[10px] font-black text-purple-400 uppercase tracking-wider mb-0.5">ฝั่ง 1</p>
                  <p className="font-black text-purple-800 text-sm leading-tight">{name1 ? `${name1}${num1 > 0 ? ` (${num1})` : ''}` : '—'}</p>
                </div>
                <div className="font-black text-purple-300 text-xl">VS</div>
                <div className={`flex-1 rounded-2xl p-3 border-2 text-center transition-all ${lookupStatus === 'ok' ? 'bg-fuchsia-50 border-fuchsia-200' : 'bg-purple-50 border-purple-100'}`}>
                  <p className="text-[10px] font-black text-purple-400 uppercase tracking-wider mb-0.5">ฝั่ง 2</p>
                  <p className="font-black text-purple-800 text-sm leading-tight">{name2 ? `${name2}${num2 > 0 ? ` (${num2})` : ''}` : '—'}</p>
                </div>
              </div>

              {/* Score inputs */}
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-purple-700 mb-1">รอบย่อยที่ชนะ — ฝั่ง 1</label>
                  <input ref={rounds1Ref} type="number" inputMode="decimal" min={0} max={3} step={0.5} value={rounds1}
                    onChange={e => setRounds1(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); rounds2Ref.current?.focus() } }}
                    placeholder="0–3"
                    className="w-full px-3 py-3 rounded-xl border-2 border-purple-200 bg-purple-50 font-black text-2xl text-center focus:outline-none focus:border-violet-500" />
                </div>
                <div className="pb-3 font-black text-purple-300 text-xl">—</div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-purple-700 mb-1">รอบย่อยที่ชนะ — ฝั่ง 2</label>
                  <input ref={rounds2Ref} type="number" inputMode="decimal" min={0} max={3} step={0.5} value={rounds2}
                    onChange={e => setRounds2(e.target.value)}
                    placeholder="0–3"
                    className="w-full px-3 py-3 rounded-xl border-2 border-purple-200 bg-purple-50 font-black text-2xl text-center focus:outline-none focus:border-violet-500" />
                </div>
              </div>

              {/* Score preview */}
              {rounds1 !== '' && rounds2 !== '' && !sumWarning && (
                <div className={`rounded-xl px-4 py-2.5 text-center text-sm font-black border-2 ${Number(rounds1) > Number(rounds2) ? 'bg-violet-100 border-violet-300 text-violet-800' : Number(rounds2) > Number(rounds1) ? 'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-800' : 'bg-gray-100 border-gray-300 text-gray-700'}`}>
                  {Number(rounds1) > Number(rounds2) ? `🏆 ${name1 || 'ฝั่ง 1'} ชนะ (${rounds1}–${rounds2})` : Number(rounds2) > Number(rounds1) ? `🏆 ${name2 || 'ฝั่ง 2'} ชนะ (${rounds2}–${rounds1})` : `🤝 เสมอ (${rounds1}–${rounds2})`}
                </div>
              )}

              {sumWarning && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-2.5 text-xs text-amber-700 font-semibold">
                  ⚠️ รวมกันได้ {Number(rounds1) + Number(rounds2)} ไม่ใช่ 3 — เสมอรอบย่อย = 0.5 ต่อฝั่ง
                </div>
              )}

              <p className="text-xs text-purple-400 text-center">แข่ง 3 รอบย่อย · รวม = 3 · เสมอรอบย่อย = 0.5</p>
            </>
          ) : null}

          {confirmOverwrite && (
            <div className="rounded-2xl p-4 border-2 border-amber-300 bg-amber-50 space-y-3">
              <p className="text-sm font-black text-amber-800">⚠️ โต๊ะ {subTable} เกม {gameNum} มีผลอยู่แล้ว</p>
              <p className="text-xs text-amber-700">ผลเดิม: <strong>{confirmOverwrite.existing.rounds1} – {confirmOverwrite.existing.rounds2}</strong></p>
              <p className="text-xs text-amber-600">ต้องการเขียนทับด้วยผลใหม่ {rounds1} – {rounds2} หรือไม่?</p>
              <div className="flex gap-2">
                <button onClick={confirmAndOverwrite} disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 active:scale-95 transition disabled:opacity-40">
                  ✅ ยืนยันเขียนทับ
                </button>
                <button onClick={() => setConfirmOverwrite(null)}
                  className="flex-1 py-2 rounded-xl bg-white border-2 border-amber-200 text-amber-700 font-bold text-sm hover:bg-amber-50 active:scale-95 transition">
                  ยกเลิก
                </button>
              </div>
            </div>
          )}

          {status && (
            <div className={`rounded-2xl px-4 py-3 border-2 font-bold text-sm ${statusColors[status.type]}`}>
              {status.text}
            </div>
          )}

          {!isBye && (
            <button type="submit" disabled={saving || (mode === 'qualify' && lookupStatus !== 'ok')}
              className="w-full py-3.5 rounded-2xl font-black text-base text-white shadow-lg transition-all active:scale-95 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#c026d3)' }}>
              {saving ? '⏳ กำลังบันทึก...' : submitLabel}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
