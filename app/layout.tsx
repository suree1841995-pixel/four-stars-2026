import type { Metadata } from 'next'
import './globals.css'
import ErrorBoundary from '@/components/ErrorBoundary'
import OfflineBanner from '@/components/OfflineBanner'

export const metadata: Metadata = {
  title: 'Four Stars',
  description: 'ระบบจัดการแข่งขัน Four Stars โรงเรียนพูลเจริญวิทยาคม',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <ErrorBoundary>
          <OfflineBanner />
          {children}
        </ErrorBoundary>
      </body>
    </html>
  )
}
