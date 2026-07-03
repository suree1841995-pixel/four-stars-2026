'use client'
import { useState, useEffect } from 'react'

export type AuthRole = 'admin' | 'scoring'

export function useAuth(role: AuthRole) {
  // v2: บังคับ login ใหม่หลังเพิ่มระบบ cookie token (client เก่ามีแค่ flag ไม่มี cookie)
  const SESSION_KEY = `fs_auth_${role}_v2`
  const [authed, setAuthed] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    setAuthed(sessionStorage.getItem(SESSION_KEY) === '1')
    setChecked(true)
  }, [SESSION_KEY])

  async function login(pw: string): Promise<boolean> {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, password: pw }),
    })
    if (res.ok) {
      sessionStorage.setItem(SESSION_KEY, '1')
      setAuthed(true)
      return true
    }
    return false
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY)
    setAuthed(false)
  }

  return { authed, checked, login, logout }
}
