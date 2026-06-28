import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { role, password } = await req.json()
  const correct = role === 'admin' ? process.env.ADMIN_PASSWORD : process.env.SCORING_PASSWORD
  if (!correct) {
    return NextResponse.json({ error: 'ระบบยังไม่ตั้งค่ารหัสผ่าน — กรุณาตั้ง Environment Variables ใน Vercel' }, { status: 500 })
  }
  if (password !== correct) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
