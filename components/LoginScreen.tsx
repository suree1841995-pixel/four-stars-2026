'use client'
import { useState } from 'react'

interface Props {
  role: 'admin' | 'scoring'
  onLogin: (pw: string) => Promise<boolean>
}

const CONFIG = {
  admin: { icon: '🛡️', label: 'แผงแอดมิน', color: 'from-violet-700 to-purple-500', hint: 'สำหรับกรรมการจัดโต๊ะ' },
  scoring: { icon: '✍️', label: 'กรอกคะแนน', color: 'from-fuchsia-600 to-purple-400', hint: 'สำหรับกรรมการกรอกผล' },
}

export default function LoginScreen({ role, onLogin }: Props) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)
  const [loading, setLoading] = useState(false)
  const cfg = CONFIG[role]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const ok = await onLogin(pw)
    setLoading(false)
    if (!ok) { setErr(true); setPw('') }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#faf5ff' }}>
      <div className="w-full max-w-sm">
        <div className={`rounded-3xl p-8 bg-gradient-to-br ${cfg.color} text-white text-center mb-4 shadow-2xl`}>
          <div className="text-6xl mb-3">{cfg.icon}</div>
          <h1 className="font-display text-2xl font-black">Four Stars</h1>
          <p className="text-purple-100 text-sm mt-1 font-semibold">{cfg.label}</p>
        </div>

        <div className="rounded-3xl p-7 bg-white shadow-xl border-2 border-purple-100">
          <p className="text-center text-sm font-semibold text-purple-400 mb-6">{cfg.hint}</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-purple-800 mb-2">รหัสผ่าน</label>
              <input
                type="password"
                value={pw}
                onChange={e => { setPw(e.target.value); setErr(false) }}
                className="w-full px-4 py-3 rounded-2xl border-2 border-purple-200 bg-purple-50 text-lg font-semibold focus:outline-none focus:border-purple-500 transition"
                placeholder="••••••"
                autoFocus
              />
              {err && (
                <p className="text-red-500 text-sm font-bold mt-2 flex items-center gap-1">
                  <span>❌</span> รหัสผ่านไม่ถูกต้อง
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !pw}
              className={`w-full py-3 rounded-2xl bg-gradient-to-r ${cfg.color} text-white font-bold text-lg shadow-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50`}
            >
              {loading ? '⏳ กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
          <p className="text-center text-xs text-purple-300 mt-5 font-semibold">
            โรงเรียนพูลเจริญวิทยาคม
          </p>
        </div>
      </div>
    </div>
  )
}
