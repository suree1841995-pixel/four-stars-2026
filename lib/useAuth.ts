'use client'
import { useState, useEffect } from 'react'

export type AuthRole = 'admin' | 'scoring'

const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '1407'
const SCORING_PW = process.env.NEXT_PUBLIC_SCORING_PASSWORD || '123456'

export function useAuth(role: AuthRole) {
  const SESSION_KEY = `fs_auth_${role}`
  const [authed, setAuthed] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    setAuthed(sessionStorage.getItem(SESSION_KEY) === '1')
    setChecked(true)
  }, [SESSION_KEY])

  function login(pw: string) {
    const correct = role === 'admin' ? ADMIN_PW : SCORING_PW
    if (pw === correct) {
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
