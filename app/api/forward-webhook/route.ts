import { NextRequest, NextResponse } from 'next/server'
import * as line from '@line/bot-sdk'

const TARGETS = [
  'https://claude-chatbot-dun.vercel.app/api/line-webhook',
  'https://api.littlehelp.co.jp/line/4476368/webhook/2',
]

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  if (!line.validateSignature(body, process.env.LINE_CHANNEL_SECRET!, signature)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await Promise.allSettled(
    TARGETS.map((url) =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-line-signature': signature,
        },
        body,
        signal: AbortSignal.timeout(8_000),
      })
    )
  )

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`[Forward Error] ${TARGETS[i]}`, result.reason)
    } else {
      console.log(`[Forward OK] ${TARGETS[i]} → ${result.value.status}`)
    }
  })

  return NextResponse.json({ ok: true })
}
