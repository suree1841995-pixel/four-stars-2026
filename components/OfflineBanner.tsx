'use client'
import { useState, useEffect } from 'react'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const onOffline = () => setOffline(true)
    const onOnline = () => setOffline(false)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    setOffline(!navigator.onLine)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white text-center text-sm font-black py-2 px-4 shadow-lg">
      ⚠️ ไม่มีการเชื่อมต่ออินเทอร์เน็ต — ข้อมูลที่กรอกอาจไม่ถูกบันทึก
    </div>
  )
}
