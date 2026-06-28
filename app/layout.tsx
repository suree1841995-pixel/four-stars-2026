import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Four Stars',
  description: 'ระบบจัดการแข่งขัน Four Stars โรงเรียนพูลเจริญวิทยาคม',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  )
}
