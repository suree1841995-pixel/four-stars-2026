import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#faf5ff' }}>
      {/* Header */}
      <div className="text-center mb-10">
        <div className="text-6xl mb-3">⭐</div>
        <h1 className="font-display text-4xl font-black text-transparent bg-clip-text"
          style={{ backgroundImage: 'linear-gradient(135deg,#6d28d9,#c026d3)' }}>
          Four Stars
        </h1>
        <p className="text-purple-400 font-semibold mt-2 text-sm">โรงเรียนพูลเจริญวิทยาคม</p>
      </div>

      {/* Cards */}
      <div className="w-full max-w-sm space-y-4">

        {/* Display — เปิดได้เลย */}
        <Link href="/display"
          className="flex items-center gap-4 p-5 bg-white rounded-3xl border-2 border-purple-200 shadow-lg hover:shadow-xl hover:border-purple-400 active:scale-95 transition-all group">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: 'linear-gradient(135deg,#6d28d9,#a855f7)' }}>
            📺
          </div>
          <div className="flex-1">
            <p className="font-black text-purple-900 text-lg leading-tight">กระดานคะแนน</p>
            <p className="text-purple-400 text-xs font-semibold mt-0.5">แสดงผลสดแบบ real-time</p>
          </div>
          <span className="text-purple-300 group-hover:text-purple-600 font-black text-xl transition">›</span>
        </Link>

        {/* Scoring */}
        <Link href="/scoring"
          className="flex items-center gap-4 p-5 bg-white rounded-3xl border-2 border-fuchsia-200 shadow-lg hover:shadow-xl hover:border-fuchsia-400 active:scale-95 transition-all group">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#c026d3)' }}>
            ✍️
          </div>
          <div className="flex-1">
            <p className="font-black text-purple-900 text-lg leading-tight">กรอกคะแนน</p>
            <p className="text-purple-400 text-xs font-semibold mt-0.5">สำหรับกรรมการประจำโต๊ะ</p>
          </div>
          <span className="text-purple-300 group-hover:text-purple-600 font-black text-xl transition">›</span>
        </Link>

        {/* Admin */}
        <Link href="/admin"
          className="flex items-center gap-4 p-5 bg-white rounded-3xl border-2 border-violet-200 shadow-lg hover:shadow-xl hover:border-violet-400 active:scale-95 transition-all group">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: 'linear-gradient(135deg,#4c1d95,#6d28d9)' }}>
            🛡️
          </div>
          <div className="flex-1">
            <p className="font-black text-purple-900 text-lg leading-tight">แผงแอดมิน</p>
            <p className="text-purple-400 text-xs font-semibold mt-0.5">จัดโต๊ะ · นำเข้าผู้เล่น · รอบชิง</p>
          </div>
          <span className="text-purple-300 group-hover:text-purple-600 font-black text-xl transition">›</span>
        </Link>

      </div>

      <p className="mt-10 text-xs text-purple-300 font-semibold">⭐ Four Stars Scoring System</p>
      <p className="mt-2 text-xs text-purple-300">พัฒนาโดย นางสาวชัญญ์คนันท์ รชตะฤทธิ์เสือ</p>
    </div>
  )
}

