import { parse } from 'csv-parse/sync'

export type FAQ = {
  question: string
  answer: string
}

type Cache = { data: FAQ[]; expiredAt: number }

let cache: Cache | null = null
const CACHE_TTL = 60_000

export async function getFAQ(): Promise<FAQ[]> {
  const now = Date.now()
  if (cache && now < cache.expiredAt) return cache.data
  const data = await fetchAndParse()
  cache = { data, expiredAt: now + CACHE_TTL }
  return data
}

async function fetchAndParse(): Promise<FAQ[]> {
  const url = process.env.SHEET_CSV_URL
  if (!url) throw new Error('SHEET_CSV_URL is not set')

  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`)

  const csv = await res.text()
  return parseCSV(csv)
}

export function parseCSV(csv: string): FAQ[] {
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[]

  return records
    .map((r) => ({
      question: r.question ?? r['คำถาม'] ?? '',
      answer: r.answer ?? r['คำตอบ'] ?? '',
      status: r.status ?? r['สถานะ'] ?? 'เปิด',
    }))
    .filter((f) => f.question && f.answer && f.status !== 'ปิด')
    .map(({ question, answer }) => ({ question, answer }))
}
