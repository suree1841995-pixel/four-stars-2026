import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const { role, password } = await req.json()
  const correct = role === 'admin' ? process.env.ADMIN_PASSWORD : process.env.SCORING_PASSWORD
  if (!correct) {
    return NextResponse.json({ error: 'ระบบยังไม่ตั้งค่ารหัสผ่าน — กรุณาตั้ง Environment Variables ใน Vercel' }, { status: 500 })
  }
  if (password !== correct) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  // ออก token (hash ของรหัสผ่าน) เป็น httpOnly cookie — middleware ใช้ตรวจสิทธิ์ API ฝั่ง server
  const token = crypto.createHash('sha256').update(correct).digest('hex')
  const res = NextResponse.json({ ok: true })
  res.cookies.set('fs_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 1 วัน
    secure: process.env.NODE_ENV === 'production',
  })
  return res
}
