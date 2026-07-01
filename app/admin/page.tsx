'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/useAuth'
import LoginScreen from '@/components/LoginScreen'
import * as XLSX from 'xlsx'
import QRCode from 'qrcode'

type Level = 'มต้น' | 'มปลาย'
interface UnlockGame { game: number; unlocked: boolean; done: boolean; missing: string[] }
interface UnlockRes { games: UnlockGame[]; unlockedFinals: boolean }
interface TableRow { game: number; table_num: number; sub_table: string; player1: { name: string; number: number } | null; player2: { name: string; number: number } | null; is_bye: boolean; scored?: boolean }
interface Standing { rank: number; player: { id: number; name: string; number: number; room: string }; points: number; diffSum: number; w: number; t: number; l: number }
interface AuditLog { id: number; created_at: string; level: string; game: number; sub_table: string; player1_name: string; player2_name: string; rounds1: number; rounds2: number; action: string }

function gameLabel(g: number) {
  if (g === 1) return 'Random'
  if (g === 6) return 'King of the Hill'
  return g % 2 === 0 ? 'ไขว้' : 'Swiss'
}

export default function AdminPage() {
  const { authed, checked, login } = useAuth('admin')
  const [level, setLevel] = useState<Level>('มต้น')
  const [unlock, setUnlock] = useState<UnlockRes | null>(null)
  const [allTables, setAllTables] = useState<TableRow[]>([])
  const [latestGame, setLatestGame] = useState(0)
  const [standings, setStandings] = useState<Standing[]>([])
  const [finals, setFinals] = useState<{ pair_label: string; player1: { name: string; number: number } | null; player2: { name: string; number: number } | null }[]>([])
  const [gameCount, setGameCount] = useState(4)
  const [gibsonInput, setGibsonInput] = useState('')
  const [gibsonSuggest, setGibsonSuggest] = useState<{ name: string; number: number; points: number; rank: number }[] | null>(null)
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' | 'info' } | null>(null)
  const [loading, setLoading] = useState(false)
  const [standingsOpen, setStandingsOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [playerFile, setPlayerFile] = useState<File | null>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [players, setPlayers] = useState<{ id: number; number: number; name: string; room: string }[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editRoom, setEditRoom] = useState('')
  const [addName, setAddName] = useState('')
  const [addRoom, setAddRoom] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [announceLoading, setAnnounceLoading] = useState(false)
  const [scoredCount, setScoredCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [lockedGames, setLockedGames] = useState<number[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditOpen, setAuditOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [qrOpen, setQrOpen] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restoreLoading, setRestoreLoading] = useState(false)

  const sectionRef = { qualify: useRef<HTMLDivElement>(null), playoff: useRef<HTMLDivElement>(null), standings: useRef<HTMLDivElement>(null), manage: useRef<HTMLDivElement>(null) }

  function scrollTo(key: keyof typeof sectionRef) {
    sectionRef[key].current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const showMsg = (text: string, type: 'ok' | 'err' | 'info' = 'ok') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 6000)
  }

  const loadUnlock = useCallback(async () => {
    const res = await fetch(`/api/unlock?level=${encodeURIComponent(level)}&totalGames=${gameCount}`)
    if (res.ok) setUnlock(await res.json())
  }, [level, gameCount])

  const loadTables = useCallback(async () => {
    const res = await fetch(`/api/tables?level=${encodeURIComponent(level)}`)
    if (!res.ok) return
    const data: TableRow[] = await res.json()
    const maxGame = data.reduce((m, r) => Math.max(m, (r as { game: number }).game ?? 0), 0)
    setLatestGame(maxGame)
    setAllTables(data)
  }, [level])

  const loadStandings = useCallback(async () => {
    const res = await fetch(`/api/standings?level=${encodeURIComponent(level)}`)
    if (res.ok) setStandings(await res.json())
  }, [level])

  const loadPlayers = useCallback(async () => {
    const res = await fetch(`/api/players?level=${encodeURIComponent(level)}`)
    if (res.ok) setPlayers(await res.json())
  }, [level])

  const loadFinals = useCallback(async () => {
    const res = await fetch(`/api/finals?level=${encodeURIComponent(level)}`)
    if (res.ok) setFinals(await res.json())
  }, [level])

  const loadLocks = useCallback(async () => {
    const res = await fetch(`/api/locks?level=${encodeURIComponent(level)}`)
    if (res.ok) setLockedGames(await res.json())
  }, [level])

  const loadAudit = useCallback(async () => {
    const res = await fetch(`/api/audit?level=${encodeURIComponent(level)}`)
    if (res.ok) setAuditLogs(await res.json())
  }, [level])

  async function toggleLock(game: number) {
    const isLocked = lockedGames.includes(game)
    if (isLocked) {
      await fetch(`/api/locks?level=${encodeURIComponent(level)}&game=${game}`, { method: 'DELETE' })
      showMsg(`🔓 ปลดล็อกเกม ${game} แล้ว`, 'info')
    } else {
      await fetch('/api/locks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level, game }) })
      showMsg(`🔒 ล็อกเกม ${game} แล้ว`, 'info')
    }
    loadLocks()
  }

  async function downloadBackup() {
    setBackupLoading(true)
    const res = await fetch('/api/backup')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `fourstars-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    URL.revokeObjectURL(url)
    setBackupLoading(false)
  }

  async function restoreBackup() {
    if (!restoreFile) return
    if (!confirm('⚠️ การ Restore จะลบข้อมูลทั้งหมดและแทนที่ด้วยไฟล์ backup — แน่ใจหรือไม่?')) return
    setRestoreLoading(true)
    let json: unknown
    try {
      const text = await restoreFile.text()
      json = JSON.parse(text)
    } catch {
      showMsg('❌ ไฟล์ JSON ไม่ถูกต้อง — ตรวจสอบไฟล์อีกครั้ง', 'err')
      setRestoreLoading(false); return
    }
    try {
      const res = await fetch('/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json) })
      const d = await res.json()
      if (d.ok) {
        showMsg(`✅ Restore สำเร็จ — ผู้เล่น ${d.restored.players ?? 0} คน, เกม ${d.restored.games ?? 0} รายการ`)
        await Promise.all([loadUnlock(), loadTables(), loadFinals(), loadPlayers()])
      } else { showMsg(`❌ ${d.error}`, 'err') }
    } catch { showMsg('❌ เชื่อมต่อ server ไม่ได้ — ลองใหม่อีกครั้ง', 'err') }
    setRestoreLoading(false)
    setRestoreFile(null)
  }

  // Fetch scored count for progress bar
  const loadScored = useCallback(async () => {
    if (latestGame === 0) return
    const res = await fetch(`/api/games?level=${encodeURIComponent(level)}&game=${latestGame}`)
    if (!res.ok) return
    const data: { sub_table: string; rounds1: number | null; rounds2: number | null }[] = await res.json()
    // นับเฉพาะคู่จริงที่กรอกแล้ว (bye มี rounds2=null — ไม่นับเป็นโต๊ะที่ต้องกรอก)
    setScoredCount(data.filter(r => r.rounds1 !== null && r.rounds2 !== null).length)
  }, [level, latestGame])

  useEffect(() => {
    if (!authed) return
    loadUnlock(); loadTables(); loadFinals(); loadPlayers(); loadLocks()
    const id = setInterval(() => { loadUnlock(); loadTables(); if (standingsOpen) loadStandings() }, 30000)
    return () => clearInterval(id)
  }, [authed, level, standingsOpen, loadUnlock, loadTables, loadStandings, loadFinals, loadPlayers, loadLocks])

  useEffect(() => {
    if (!authed) return
    QRCode.toDataURL(typeof window !== 'undefined' ? `${window.location.origin}/display` : '/display', { width: 200 })
      .then(setQrDataUrl).catch(() => {})
  }, [authed])

  useEffect(() => {
    if (latestGame > 0) loadScored()
  }, [latestGame, loadScored])

  // Compute progress from allTables
  useEffect(() => {
    const currentTables = allTables.filter(r => (r as { game: number }).game === latestGame && !r.is_bye)
    setTotalCount(currentTables.length)
  }, [allTables, latestGame])

  const tables = allTables.filter(r => (r as { game: number }).game === latestGame)

  async function generateTables(game: number) {
    setLoading(true); setMsg(null)
    const gibsonIds = game === gameCount
      ? gibsonInput.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
      : []
    const res = await fetch('/api/tables', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, game, totalGames: gameCount, gibsonizedIds: gibsonIds }),
    })
    setLoading(false)
    if (res.ok) {
      showMsg(`✅ จัดโต๊ะเกม ${game} (${game === gameCount ? 'King of the Hill' : gameLabel(game)}) สำเร็จ`)
      await Promise.all([loadUnlock(), loadTables()])
    } else {
      const d = await res.json(); showMsg(`❌ ${d.error}`, 'err')
    }
  }

  async function suggestGibsonize() {
    const res = await fetch(`/api/gibsonize?level=${encodeURIComponent(level)}`)
    if (!res.ok) { showMsg('❌ ไม่สามารถดึงข้อมูลได้', 'err'); return }
    const d = await res.json()
    if (!d.hasEnoughPlayers) { showMsg('ผู้เล่นไม่ครบ 5 คน', 'info'); return }
    if (!d.suggested?.length) { showMsg('ยังไม่มีใครคะแนนลอยลำ', 'info'); setGibsonSuggest([]); return }
    setGibsonSuggest(d.suggested.map((s: Standing) => ({ name: s.player.name, number: s.player.number, points: s.points, rank: s.rank })))
    setGibsonInput(d.suggested.map((s: Standing) => s.player.number).join(','))
  }

  async function createFinals() {
    setLoading(true)
    const res = await fetch('/api/finals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level, totalGames: gameCount }) })
    setLoading(false)
    if (res.ok) { showMsg('✅ สร้างคู่ชิงชนะเลิศสำเร็จ'); loadFinals() }
    else { const d = await res.json(); showMsg(`❌ ${d.error}`, 'err') }
  }

  async function importPlayers() {
    if (!playerFile) return
    setImportLoading(true); setImportMsg(null)
    try {
      // รองรับทั้ง .xlsx/.xls และ .csv — parse ด้วย XLSX ให้เหมือนกัน
      const buf = await playerFile.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false })
      const rows = matrix.slice(1).map(cols => ({
        name: String(cols[0] ?? '').trim(),
        level: String(cols[1] ?? '').trim(),
        room: String(cols[2] ?? '').trim(),
      })).filter(r => r.name && r.level)
      if (rows.length === 0) { setImportMsg('❌ ไม่พบข้อมูลในไฟล์ — ตรวจสอบว่ามีคอลัมน์ ชื่อ,ระดับ,ห้อง'); setImportLoading(false); return }
      const res = await fetch('/api/players/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows, force: false }) })
      const d = await res.json()
      if (!res.ok) { setImportMsg(`❌ ${d.error ?? 'นำเข้าไม่สำเร็จ'}`); return }
      if (d.duplicates?.length) {
        const res2 = await fetch('/api/players/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows, force: true }) })
        const d2 = await res2.json()
        if (!res2.ok) { setImportMsg(`❌ ${d2.error ?? 'นำเข้าไม่สำเร็จ'}`); return }
        setImportMsg(`✅ เพิ่ม ${d2.inserted} คน (ข้ามซ้ำ ${d2.duplicatesSkipped} คน)`)
      } else {
        setImportMsg(`✅ เพิ่มผู้เล่น ${d.inserted} คน สำเร็จ`)
      }
    } catch { setImportMsg('❌ อ่านไฟล์ไม่ได้ — รองรับ .xlsx และ .csv (คอลัมน์: ชื่อ, ระดับ, ห้อง)') }
    setImportLoading(false)
    loadPlayers()
  }

  function downloadSampleExcel() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['ชื่อ-สกุล', 'ระดับ', 'ห้อง'],
      ['เด็กชายตัวอย่าง ทดสอบ', 'มต้น', 'ม.1/1'],
      ['เด็กหญิงตัวอย่าง สอบทด', 'มต้น', 'ม.2/3'],
      ['นายตัวอย่าง ทดสอบ', 'มปลาย', 'ม.4/2'],
      ['นางสาวตัวอย่าง สอบทด', 'มปลาย', 'ม.5/1'],
    ])
    ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 10 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'ผู้เล่น')
    XLSX.writeFile(wb, 'ตัวอย่าง_รายชื่อผู้เล่น.xlsx')
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!addName.trim()) return
    setAddLoading(true)
    const res = await fetch('/api/players/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [{ name: addName.trim(), level, room: addRoom.trim() }], force: false })
    })
    const d = await res.json()
    setAddLoading(false)
    if (d.error) { showMsg(`❌ ${d.error}`, 'err'); return }
    if (d.duplicates?.length) { showMsg(`⚠️ "${addName.trim()}" มีในระบบแล้ว`, 'info'); return }
    const savedName = addName.trim()
    setAddName(''); setAddRoom('')
    await loadPlayers()
    showMsg(`✅ เพิ่ม ${savedName} สำเร็จ`)
  }

  async function savePlayer(id: number) {
    const res = await fetch('/api/players', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: editName, room: editRoom })
    })
    if (res.ok) { setEditingId(null); loadPlayers() }
    else { const d = await res.json(); showMsg(`❌ ${d.error}`, 'err') }
  }

  async function sendAnnouncement(e: React.FormEvent) {
    e.preventDefault()
    if (!announcement.trim()) return
    setAnnounceLoading(true)
    await fetch('/api/broadcast', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message: announcement.trim() })
    })
    setAnnounceLoading(false)
    setAnnouncement('')
    showMsg('✅ ส่งข้อความไปยังหน้าจอแสดงผลแล้ว')
  }

  async function deletePlayer(id: number, name: string) {
    if (!confirm(`ลบ "${name}" ออกจากระบบ?`)) return
    const res = await fetch(`/api/players?id=${id}`, { method: 'DELETE' })
    if (res.ok) loadPlayers()
    else { const d = await res.json(); showMsg(`❌ ${d.error}`, 'err') }
  }

  if (!checked) return null
  if (!authed) return <LoginScreen role="admin" onLogin={login} />

  const msgColors = { ok: 'bg-emerald-100 text-emerald-800 border-emerald-300', err: 'bg-red-100 text-red-800 border-red-300', info: 'bg-purple-100 text-purple-800 border-purple-300' }
  const progressPct = totalCount > 0 ? Math.round((scoredCount / totalCount) * 100) : 0
  const allDone = progressPct === 100 && totalCount > 0

  return (
    <div className="min-h-screen pb-20" style={{ background: '#faf5ff' }}>
      {/* Sticky nav */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-purple-100 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-1 px-3 py-2 overflow-x-auto">
          <button onClick={() => scrollTo('qualify')} className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-purple-700 hover:bg-purple-100 transition">🎮 คัดเลือก</button>
          <button onClick={() => scrollTo('playoff')} className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-purple-700 hover:bg-purple-100 transition">🏆 เพลย์ออฟ</button>
          <button onClick={() => scrollTo('standings')} className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-purple-700 hover:bg-purple-100 transition">📊 อันดับ</button>
          <button onClick={() => scrollTo('manage')} className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-purple-700 hover:bg-purple-100 transition">👥 จัดการ</button>
          <button onClick={() => { setAuditOpen(true); loadAudit(); setTimeout(() => document.querySelector('[data-audit]')?.scrollIntoView({ behavior: 'smooth' }), 100) }} className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-purple-700 hover:bg-purple-100 transition">📋 ประวัติ</button>
        </div>
      </div>

      {/* Header */}
      <div className="max-w-2xl mx-auto px-4 pt-5">
        <div className="rounded-3xl p-6 text-center text-white mb-5 shadow-2xl"
          style={{ background: 'linear-gradient(135deg,#6d28d9,#a855f7)' }}>
          <div className="text-4xl mb-1">⭐</div>
          <h1 className="font-display text-2xl font-black">แผงแอดมิน Four Stars</h1>
          <p className="text-purple-200 text-sm mt-1 font-semibold">โรงเรียนพูลเจริญวิทยาคม</p>
        </div>

        {/* Level toggle */}
        <div className="flex bg-white rounded-2xl p-1.5 border-2 border-purple-200 shadow-sm mb-4">
          {(['มต้น', 'มปลาย'] as Level[]).map(lv => (
            <button key={lv} onClick={() => { setLevel(lv); setGibsonSuggest(null); setGibsonInput('') }}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${level === lv ? 'bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow' : 'text-purple-400 hover:text-purple-700'}`}>
              {lv === 'มต้น' ? '🌱 มัธยมศึกษาตอนต้น' : '🌸 มัธยมศึกษาตอนปลาย'}
            </button>
          ))}
        </div>

        {msg && <div className={`rounded-2xl px-4 py-3 border-2 font-bold text-sm mb-4 ${msgColors[msg.type]}`}>{msg.text}</div>}

        {/* ── SECTION: คัดเลือก ── */}
        <div ref={sectionRef.qualify} className="scroll-mt-16 space-y-4">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-purple-100">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-black text-purple-800">🎮 รอบคัดเลือก</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-purple-500 font-bold">{gameCount} เกม</span>
                <button onClick={() => setGameCount(n => Math.max(4, n - 1))}
                  className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 font-black text-lg leading-none hover:bg-purple-200 transition flex items-center justify-center">−</button>
                <button onClick={() => setGameCount(n => Math.min(10, n + 1))}
                  className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 font-black text-lg leading-none hover:bg-purple-200 transition flex items-center justify-center">+</button>
              </div>
            </div>
            <p className="text-xs text-purple-400 mb-4">เกม1=สุ่ม · คู่=ไขว้ · คี่=Swiss · เกมสุดท้าย=King of the Hill<br/>กรอกผลครบก่อนจึงจะปลดล็อกเกมถัดไป</p>

            {/* Game buttons */}
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              {Array.from({ length: gameCount }, (_, i) => i + 1).map(g => {
                const info = unlock?.games.find(x => x.game === g)
                const done = info?.done
                const locked = info ? !info.unlocked : g > 1
                const isCurrent = latestGame === g
                const label = g === gameCount ? 'King of the Hill' : gameLabel(g)
                const isGameLocked = lockedGames.includes(g)
                return (
                  <div key={g} className="relative">
                    <button disabled={locked || loading} onClick={() => generateTables(g)}
                      className={`w-full relative py-4 px-2 rounded-2xl border-2 font-bold text-sm transition-all active:scale-95
                        ${isGameLocked ? 'bg-red-50 border-red-300 text-red-500' : done ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : locked ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' : isCurrent ? 'bg-violet-50 border-violet-500 text-violet-700 hover:bg-violet-100' : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'}`}>
                      {done && !isGameLocked && <span className="absolute top-1.5 right-2 text-emerald-500 text-xs">✓</span>}
                      {locked && !isGameLocked && <span className="absolute top-1.5 right-2 text-gray-400 text-xs">🔒</span>}
                      {isGameLocked && <span className="absolute top-1.5 right-2 text-red-400 text-xs">🔐</span>}
                      {isCurrent && !done && <span className="absolute top-1.5 left-2 w-2 h-2 rounded-full bg-green-400"></span>}
                      <div className="font-black">เกม {g}</div>
                      <div className="text-xs font-normal mt-0.5 opacity-80">{label}</div>
                      {loading && isCurrent && <div className="text-xs mt-1">⏳</div>}
                    </button>
                    {done && (
                      <button onClick={() => toggleLock(g)}
                        title={isGameLocked ? 'ปลดล็อก' : 'ล็อกเกมนี้'}
                        className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 rounded-lg font-bold transition ${isGameLocked ? 'bg-red-200 text-red-700 hover:bg-red-300' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {isGameLocked ? '🔐 ล็อก' : '🔓 ล็อก?'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Progress bar */}
            {latestGame > 0 && totalCount > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-xs font-bold text-purple-600 mb-1.5">
                  <span>ความคืบหน้าเกม {latestGame}</span>
                  <span>{scoredCount}/{totalCount} โต๊ะ {allDone ? '✅ ครบแล้ว!' : ''}</span>
                </div>
                <div className="h-3 bg-purple-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%`, background: allDone ? '#10b981' : 'linear-gradient(90deg,#7c3aed,#c026d3)' }} />
                </div>
              </div>
            )}

            {/* Missing tables warning — แสดงเกมปัจจุบันที่กรอกยังไม่ครบ */}
            {(() => {
              // หาเกมที่มีโต๊ะค้างอยู่ (จัดโต๊ะแล้ว แต่กรอกผลไม่ครบ)
              const blocking = unlock?.games.find(g =>
                g.done && g.missing.length > 0 && g.missing[0] !== 'ยังไม่มีการจัดโต๊ะ'
              )
              if (!blocking) return null
              return (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 mb-4">
                  <p className="text-sm font-black text-amber-800 mb-2">
                    ⏳ เกม {blocking.game} ยังกรอกไม่ครบ — เหลือ {blocking.missing.length} โต๊ะ
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {blocking.missing.map(st => (
                      <span key={st} className="px-2.5 py-1 rounded-lg bg-amber-200 text-amber-900 text-xs font-black">
                        โต๊ะ {st}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-amber-600 mt-2 font-semibold">
                    กรอกผลให้ครบก่อนจึงจะสามารถจัดโต๊ะเกม {blocking.game + 1} ได้
                  </p>
                </div>
              )
            })()}

            {/* Gibsonize */}
            <div className="bg-purple-50 rounded-2xl p-4 border border-purple-200">
              <p className="text-xs font-black text-purple-700 mb-2">🎯 Gibsonize — สำหรับเกมสุดท้าย (เกม {gameCount}) เท่านั้น</p>
              <p className="text-xs text-purple-400 mb-3">ผู้เล่นที่คะแนนลอยลำแน่นอน ไม่ต้องแข่งกันเองอีก</p>
              <button onClick={suggestGibsonize}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-purple-300 text-purple-700 hover:bg-purple-50 transition mb-2 w-full">
                🔍 ให้ระบบแนะนำอัตโนมัติ
              </button>
              {gibsonSuggest !== null && (
                <div className="mb-2 text-xs text-purple-700 bg-white rounded-xl p-2 border border-purple-100">
                  {gibsonSuggest.length === 0
                    ? '✅ ยังไม่มีใครลอยลำ'
                    : gibsonSuggest.map(s => <div key={s.number}>อันดับ {s.rank} — {s.name} (#{s.number}, {s.points} แต้ม)</div>)}
                </div>
              )}
              <input type="text" value={gibsonInput} onChange={e => setGibsonInput(e.target.value)}
                placeholder="หมายเลขนักกีฬา คั่นด้วยจุลภาค เช่น 4,7"
                className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm focus:outline-none focus:border-purple-400" />
            </div>
          </div>

          {/* Current tables */}
          {tables.length > 0 && (
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-purple-100">
              <h2 className="font-black text-purple-800 mb-3">🪑 การจัดโต๊ะเกม {latestGame}</h2>
              {Object.entries(
                tables.reduce((acc: Record<number, typeof tables>, r) => {
                  const tn = r.table_num; if (!acc[tn]) acc[tn] = []; acc[tn].push(r); return acc
                }, {})
              ).sort(([a], [b]) => Number(a) - Number(b)).map(([tn, rows]) => (
                <div key={tn} className="flex gap-3 items-start bg-purple-50 rounded-2xl px-4 py-3 mb-2 border border-purple-100">
                  <div className="font-black text-purple-700 text-sm min-w-[56px]">โต๊ะ {tn}</div>
                  <div className="flex-1 text-sm space-y-0.5">
                    {rows.map(r => (
                      <div key={r.sub_table}>
                        <span className="font-black text-purple-500">{r.sub_table.slice(-1)}:</span>{' '}
                        {r.is_bye
                          ? <span className="text-blue-600">🎁 {r.player1?.name} (#{r.player1?.number}) ได้ bye</span>
                          : <span>{r.player1?.name} <span className="text-purple-400 font-bold">(#{r.player1?.number})</span> <strong className="text-purple-600 mx-1">VS</strong> {r.player2?.name} <span className="text-purple-400 font-bold">(#{r.player2?.number})</span></span>
                        }
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── SECTION: เพลย์ออฟ ── */}
        <div ref={sectionRef.playoff} className="scroll-mt-16 mt-5">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-purple-100">
            <h2 className="font-black text-purple-800 mb-1">🏆 รอบชิงชนะเลิศ</h2>
            <p className="text-xs text-purple-400 mb-3">กดหลังกรอกผลเกม 6 ครบ — ระบบดึง 4 อันดับแรกมาจับคู่ให้</p>
            <button disabled={!unlock?.unlockedFinals || loading} onClick={createFinals}
              className="w-full py-3 rounded-2xl font-bold text-sm transition-all bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed mb-3">
              🎯 สร้างคู่ชิงชนะเลิศ (1v2, 3v4)
            </button>
            {finals.length === 0
              ? <p className="text-xs text-center text-purple-300 py-2">ยังไม่มีคู่ชิง</p>
              : finals.map(f => (
                <div key={f.pair_label} className="flex gap-3 items-center bg-purple-50 rounded-2xl px-4 py-3 mb-2 border border-purple-100">
                  <div className="font-black text-purple-700 text-xs min-w-[80px]">{f.pair_label}</div>
                  <div className="text-sm">{f.player1?.name} <span className="text-purple-400">(#{f.player1?.number})</span> <strong className="text-purple-600 mx-1">VS</strong> {f.player2?.name} <span className="text-purple-400">(#{f.player2?.number})</span></div>
                </div>
              ))}
          </div>
        </div>

        {/* ── SECTION: อันดับ ── */}
        <div ref={sectionRef.standings} className="scroll-mt-16 mt-5">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-purple-100">
            <button className="w-full flex items-center justify-between font-black text-purple-800"
              onClick={() => { setStandingsOpen(v => !v); if (!standingsOpen) loadStandings() }}>
              <span>📊 ตารางอันดับปัจจุบัน</span>
              <span className="text-purple-400">{standingsOpen ? '▲' : '▼'}</span>
            </button>
            {standingsOpen && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white" style={{ background: '#6d28d9' }}>
                      <th className="py-2 px-2 rounded-l-xl text-center">อันดับ</th>
                      <th className="py-2 px-2 text-left">ชื่อ</th>
                      <th className="py-2 px-2 text-center">ห้อง</th>
                      <th className="py-2 px-2 text-center">W-T-L</th>
                      <th className="py-2 px-2 text-center">แต้ม</th>
                      <th className="py-2 px-2 text-center rounded-r-xl">ผลต่าง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, i) => (
                      <tr key={s.player.id} className={`border-b border-purple-50 ${i < 4 ? 'font-bold' : ''} ${i === 0 ? 'bg-yellow-50' : i === 1 ? 'bg-slate-50' : i === 2 ? 'bg-purple-50' : ''}`}>
                        <td className="py-2 px-2 text-center">
                          {i < 3 ? ['🥇', '🥈', '🥉'][i] : <span className="text-purple-500">{s.rank}</span>}
                        </td>
                        <td className="py-2 px-2">{s.player.name} <span className="text-purple-400">(#{s.player.number})</span></td>
                        <td className="py-2 px-2 text-center text-purple-400">{s.player.room}</td>
                        <td className="py-2 px-2 text-center text-purple-600">{s.w}-{s.t}-{s.l}</td>
                        <td className="py-2 px-2 text-center font-black text-purple-800">{s.points}</td>
                        <td className={`py-2 px-2 text-center font-bold ${s.diffSum > 0 ? 'text-emerald-600' : s.diffSum < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          {s.diffSum > 0 ? '+' : ''}{s.diffSum}
                        </td>
                      </tr>
                    ))}
                    {standings.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-8 text-purple-300">ยังไม่มีข้อมูล</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── SECTION: broadcast + export ── */}
        <div className="mt-5 space-y-3">
          {/* Broadcast */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-purple-100">
            <h2 className="font-black text-purple-800 mb-3">📢 ส่งข้อความไปหน้าจอ</h2>
            <form onSubmit={sendAnnouncement} className="flex gap-2">
              <input type="text" value={announcement} onChange={e => setAnnouncement(e.target.value)}
                placeholder="เช่น พักรับประทานอาหาร 30 นาที"
                className="flex-1 px-3 py-2.5 rounded-xl border-2 border-purple-200 bg-purple-50 text-sm font-semibold focus:outline-none focus:border-violet-400" />
              <button type="submit" disabled={!announcement.trim() || announceLoading}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 text-white font-bold text-sm shadow hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 shrink-0">
                {announceLoading ? '⏳' : '📤 ส่ง'}
              </button>
            </form>
            <p className="text-xs text-purple-400 mt-2">ข้อความจะแสดงบนหน้าจอ display 30 วินาที</p>
          </div>

          {/* Export */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-purple-100">
            <h2 className="font-black text-purple-800 mb-3">📥 Export ผลการแข่งขัน</h2>
            <div className="flex gap-2">
              <a href={`/api/export?level=${encodeURIComponent('มต้น')}`}
                className="flex-1 py-2.5 rounded-xl bg-emerald-100 text-emerald-700 font-bold text-sm text-center border border-emerald-200 hover:bg-emerald-200 transition active:scale-95">
                📊 ม.ต้น (.xlsx)
              </a>
              <a href={`/api/export?level=${encodeURIComponent('มปลาย')}`}
                className="flex-1 py-2.5 rounded-xl bg-emerald-100 text-emerald-700 font-bold text-sm text-center border border-emerald-200 hover:bg-emerald-200 transition active:scale-95">
                📊 ม.ปลาย (.xlsx)
              </a>
            </div>
            <p className="text-xs text-purple-400 mt-2">ดาวน์โหลดอันดับและผลรอบชิงเป็นไฟล์ Excel</p>
          </div>
        </div>

        {/* ── SECTION: QR Code ── */}
        <div className="mt-5">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-purple-100">
            <button className="w-full flex items-center justify-between font-black text-purple-800"
              onClick={() => setQrOpen(v => !v)}>
              <span>📱 QR Code หน้าจอแสดงผล</span>
              <span className="text-purple-400">{qrOpen ? '▲' : '▼'}</span>
            </button>
            {qrOpen && (
              <div className="mt-4 flex flex-col items-center gap-3">
                {qrDataUrl
                  ? <img src={qrDataUrl} alt="QR Display" className="w-48 h-48 rounded-2xl border-4 border-purple-200 shadow" />
                  : <div className="w-48 h-48 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-300">กำลังสร้าง...</div>}
                <p className="text-xs text-purple-500 font-semibold">สแกนเพื่อเปิดหน้าจอ display</p>
                <p className="text-xs text-purple-300 break-all">{typeof window !== 'undefined' ? `${window.location.origin}/display` : '/display'}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── SECTION: Audit Log ── */}
        <div className="mt-5">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-purple-100">
            <button className="w-full flex items-center justify-between font-black text-purple-800"
              onClick={() => { setAuditOpen(v => !v); if (!auditOpen) loadAudit() }}>
              <span>📋 ประวัติการกรอกคะแนน</span>
              <span className="text-purple-400">{auditOpen ? '▲' : '▼'}</span>
            </button>
            {auditOpen && (
              <div className="mt-4">
                <button onClick={loadAudit} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition mb-3">🔄 รีเฟรช</button>
                {auditLogs.length === 0
                  ? <p className="text-xs text-center text-purple-300 py-4">ยังไม่มีประวัติ</p>
                  : (
                    <div className="space-y-1.5 max-h-80 overflow-y-auto">
                      {auditLogs.map(log => (
                        <div key={log.id} className="bg-purple-50 rounded-2xl px-3 py-2.5 border border-purple-100 text-xs">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] ${log.action === 'overwrite' ? 'bg-amber-200 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                              {log.action === 'overwrite' ? '✏️ แก้ไข' : '✅ กรอก'}
                            </span>
                            <span className="font-black text-purple-700">เกม {log.game} โต๊ะ {log.sub_table}</span>
                            <span className="text-purple-400 ml-auto">{new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="text-purple-600">{log.player1_name} <span className="font-black">{log.rounds1}</span> vs <span className="font-black">{log.rounds2}</span> {log.player2_name}</div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>

        {/* ── SECTION: Backup/Restore ── */}
        <div className="mt-5">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-purple-100">
            <h2 className="font-black text-purple-800 mb-3">💾 Backup &amp; Restore</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-purple-500 mb-2">Export ข้อมูลทั้งหมด (ผู้เล่น + ผลการแข่งขัน) เป็นไฟล์ JSON</p>
                <button disabled={backupLoading} onClick={downloadBackup}
                  className="w-full py-2.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow hover:opacity-90 active:scale-95 transition-all disabled:opacity-40">
                  {backupLoading ? '⏳ กำลัง export...' : '📤 Download Backup (.json)'}
                </button>
              </div>
              <hr className="border-purple-100" />
              <div>
                <p className="text-xs text-red-400 font-bold mb-2">⚠️ Restore จะลบข้อมูลทั้งหมดในระบบก่อน แล้วนำเข้าจากไฟล์</p>
                <input type="file" accept=".json"
                  onChange={e => setRestoreFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-purple-700 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-red-100 file:text-red-700 hover:file:bg-red-200 mb-2" />
                <button disabled={!restoreFile || restoreLoading} onClick={restoreBackup}
                  className="w-full py-2.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-red-500 to-rose-500 text-white shadow hover:opacity-90 active:scale-95 transition-all disabled:opacity-40">
                  {restoreLoading ? '⏳ กำลัง restore...' : '📥 Restore จากไฟล์'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION: Reset ── */}
        <div className="mt-5">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-red-100">
            <h2 className="font-black text-red-700 mb-1">🗑️ รีเซ็ตข้อมูล</h2>
            <p className="text-xs text-gray-400 mb-4">แนะนำ Backup ก่อนทุกครั้ง — การรีเซ็ตไม่สามารถกู้คืนได้</p>
            <div className="flex gap-2">
              <button onClick={async () => {
                if (!confirm('ลบผลการแข่งขันทั้งหมด? (รายชื่อผู้เล่นยังอยู่)')) return
                const res = await fetch('/api/backup?mode=results', { method: 'DELETE' })
                if ((await res.json()).ok) {
                  showMsg('✅ รีเซ็ตผลการแข่งขันแล้ว', 'info')
                  setLatestGame(0); setAllTables([]); setFinals([]); setUnlock(null)
                  await Promise.all([loadUnlock(), loadTables(), loadFinals(), loadLocks()])
                }
              }} className="flex-1 py-3 rounded-2xl font-bold text-sm bg-amber-100 text-amber-800 border-2 border-amber-300 hover:bg-amber-200 active:scale-95 transition-all">
                🔄 Reset ผลแข่ง<br/><span className="text-xs font-normal">เก็บรายชื่อผู้เล่น</span>
              </button>
              <button onClick={async () => {
                if (!confirm('⚠️ ลบข้อมูลทั้งหมด รวมรายชื่อผู้เล่น? ไม่สามารถกู้คืนได้!')) return
                if (!confirm('กด OK อีกครั้งเพื่อยืนยัน — ข้อมูลจะหายทั้งหมด')) return
                const res = await fetch('/api/backup?mode=all', { method: 'DELETE' })
                if ((await res.json()).ok) {
                  showMsg('✅ รีเซ็ตข้อมูลทั้งหมดแล้ว', 'info')
                  setLatestGame(0); setAllTables([]); setFinals([]); setUnlock(null); setPlayers([])
                  await Promise.all([loadUnlock(), loadTables(), loadFinals(), loadPlayers(), loadLocks()])
                }
              }} className="flex-1 py-3 rounded-2xl font-bold text-sm bg-red-100 text-red-700 border-2 border-red-300 hover:bg-red-200 active:scale-95 transition-all">
                💣 Reset ทั้งหมด<br/><span className="text-xs font-normal">ลบผู้เล่นด้วย</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── SECTION: จัดการ ── */}
        <div ref={sectionRef.manage} className="scroll-mt-16 mt-5">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-purple-100">
            <button className="w-full flex items-center justify-between font-black text-purple-800"
              onClick={() => setManageOpen(v => !v)}>
              <span>👥 จัดการรายชื่อนักเรียน</span>
              <span className="text-purple-400">{manageOpen ? '▲' : '▼'}</span>
            </button>

            {manageOpen && (
              <div className="mt-4 space-y-5">
                {/* เพิ่มทีละคน */}
                <div>
                  <p className="text-xs font-bold text-purple-700 mb-2">➕ เพิ่มผู้เล่นทีละคน</p>
                  <form onSubmit={addPlayer} className="space-y-2">
                    <input
                      type="text" value={addName} onChange={e => setAddName(e.target.value)}
                      placeholder="ชื่อ-สกุล"
                      className="w-full px-3 py-2.5 rounded-xl border-2 border-purple-200 bg-purple-50 text-sm font-semibold focus:outline-none focus:border-violet-400"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text" value={addRoom} onChange={e => setAddRoom(e.target.value)}
                        placeholder="ห้อง เช่น ม.2/3"
                        className="flex-1 px-3 py-2.5 rounded-xl border-2 border-purple-200 bg-purple-50 text-sm font-semibold focus:outline-none focus:border-violet-400"
                      />
                      <button type="submit" disabled={!addName.trim() || addLoading}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 text-white font-bold text-sm shadow hover:opacity-90 active:scale-95 transition-all disabled:opacity-40">
                        {addLoading ? '⏳' : '+ เพิ่ม'}
                      </button>
                    </div>
                  </form>
                </div>

                <hr className="border-purple-100" />

                {/* นำเข้า CSV */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-purple-700">📋 นำเข้าผู้เล่น (Excel / CSV)</p>
                    <button onClick={downloadSampleExcel}
                      className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200 transition">
                      📥 ดาวน์โหลดตัวอย่าง .xlsx
                    </button>
                  </div>
                  <p className="text-xs text-purple-400 mb-2">คอลัมน์: ชื่อ, ระดับ(มต้น/มปลาย), ห้อง — บรรทัดแรกเป็น header</p>
                  <input type="file" accept=".xlsx,.xls,.csv"
                    onChange={e => { setPlayerFile(e.target.files?.[0] || null); setImportMsg(null) }}
                    className="w-full text-sm text-purple-700 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200 mb-2" />
                  <button disabled={!playerFile || importLoading} onClick={importPlayers}
                    className="w-full py-2.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-fuchsia-600 to-purple-500 text-white shadow hover:opacity-90 active:scale-95 transition-all disabled:opacity-40">
                    {importLoading ? '⏳ กำลังนำเข้า...' : '📤 นำเข้าผู้เล่น'}
                  </button>
                  {importMsg && <p className="mt-2 text-xs font-bold text-purple-700">{importMsg}</p>}
                </div>

                {/* รายชื่อผู้เล่น */}
                <div>
                  <p className="text-xs font-bold text-purple-700 mb-2">👤 รายชื่อผู้เล่น ({players.length} คน)</p>
                  {players.length === 0
                    ? <p className="text-xs text-purple-300 text-center py-4">ยังไม่มีผู้เล่น</p>
                    : (
                      <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                        {players.map(p => (
                          <div key={p.id} className="bg-purple-50 rounded-2xl px-3 py-2.5 border border-purple-100">
                            {editingId === p.id ? (
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <input value={editName} onChange={e => setEditName(e.target.value)}
                                    className="flex-1 px-2 py-1.5 rounded-xl border-2 border-violet-300 text-sm font-semibold focus:outline-none focus:border-violet-500 bg-white"
                                    placeholder="ชื่อ-สกุล" />
                                  <input value={editRoom} onChange={e => setEditRoom(e.target.value)}
                                    className="w-24 px-2 py-1.5 rounded-xl border-2 border-violet-300 text-sm font-semibold focus:outline-none focus:border-violet-500 bg-white"
                                    placeholder="ห้อง" />
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => savePlayer(p.id)}
                                    className="flex-1 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition">
                                    ✅ บันทึก
                                  </button>
                                  <button onClick={() => setEditingId(null)}
                                    className="flex-1 py-1.5 rounded-xl bg-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-300 transition">
                                    ยกเลิก
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-purple-400 min-w-[28px]">#{p.number}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-purple-900 truncate">{p.name}</p>
                                  <p className="text-xs text-purple-400">{p.room}</p>
                                </div>
                                <button onClick={() => { setEditingId(p.id); setEditName(p.name); setEditRoom(p.room) }}
                                  className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-600 text-xs font-bold hover:bg-purple-100 transition shrink-0">
                                  ✏️ แก้ไข
                                </button>
                                <button onClick={() => deletePlayer(p.id, p.name)}
                                  className="px-2.5 py-1 rounded-lg bg-white border border-red-200 text-red-500 text-xs font-bold hover:bg-red-50 transition shrink-0">
                                  🗑️
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
