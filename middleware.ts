import { NextRequest, NextResponse } from 'next/server'

// ป้องกัน API ฝั่ง server: ทุก request ที่เขียนข้อมูล (POST/PATCH/DELETE)
// ต้องมี cookie fs_token ที่ตรงกับ hash ของรหัส admin หรือ scoring
// GET เปิดเสรี — หน้า display เป็นหน้าสาธารณะ

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function middleware(req: NextRequest) {
  // อ่านอย่างเดียว → ผ่าน
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return NextResponse.next()
  }
  // login เอง → ผ่าน (ยังไม่มี token)
  if (req.nextUrl.pathname === '/api/auth') {
    return NextResponse.next()
  }

  const token = req.cookies.get('fs_token')?.value
  if (token) {
    const passwords = [process.env.ADMIN_PASSWORD, process.env.SCORING_PASSWORD].filter(Boolean) as string[]
    for (const pw of passwords) {
      if (token === await sha256Hex(pw)) return NextResponse.next()
    }
  }
  return NextResponse.json(
    { error: 'ไม่ได้รับอนุญาต — กรุณาเข้าสู่ระบบใหม่ (รีเฟรชหน้าแล้ว login)' },
    { status: 401 }
  )
}

export const config = {
  matcher: '/api/:path*',
}
