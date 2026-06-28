import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { rows, force = false } = body as {
    rows: { name: string; level: string; room: string }[]
    force: boolean
  }

  // Normalize input
  const normalized = rows.map(r => ({
    name: r.name.trim(),
    level: r.level.trim(),
    room: (r.room || '').trim(),
  }))

  const { data: existing } = await supabase.from('players').select('name, level')
  const existingSet = new Set((existing || []).map((p: { name: string; level: string }) => `${p.name}|${p.level}`))

  const duplicates: typeof normalized = []
  const toInsert: typeof normalized = []
  const seenInFile = new Set<string>()

  for (const r of normalized) {
    const key = `${r.name}|${r.level}`
    if (seenInFile.has(key)) { duplicates.push(r); continue }
    seenInFile.add(key)
    if (existingSet.has(key)) duplicates.push(r)
    else toInsert.push(r)
  }

  if (duplicates.length > 0 && !force) {
    return NextResponse.json({ duplicates, toInsert: toInsert.length })
  }

  // Group by unique levels found in the data itself (not hardcoded)
  const levelSet = [...new Set(toInsert.map(r => r.level))]
  const results = []

  for (const lv of levelSet) {
    const levelRows = toInsert.filter(r => r.level === lv)
    if (!levelRows.length) continue
    const { data: last } = await supabase.from('players').select('number').eq('level', lv).order('number', { ascending: false }).limit(1)
    let nextNum = last && last.length > 0 ? last[0].number + 1 : 1
    const insertData = levelRows.map(r => ({ number: nextNum++, name: r.name, level: r.level, room: r.room }))
    const { data, error } = await supabase.from('players').insert(insertData).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    results.push(...(data || []))
  }

  return NextResponse.json({ inserted: results.length, duplicatesSkipped: duplicates.length })
}
