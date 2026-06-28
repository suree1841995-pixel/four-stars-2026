'use client'
import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#faf5ff' }}>
          <div className="w-full max-w-sm text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-xl font-black text-purple-900 mb-2">เกิดข้อผิดพลาด</h1>
            <p className="text-sm text-purple-400 mb-6">{this.state.message || 'ไม่ทราบสาเหตุ'}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-500 text-white font-bold shadow hover:opacity-90 active:scale-95 transition-all"
            >
              🔄 รีเฟรชหน้า
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
