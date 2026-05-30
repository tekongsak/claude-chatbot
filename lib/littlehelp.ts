const BASE_URL = 'https://api.littlehelp.co.jp'

export async function sendMessage(lineUserId: string, text: string): Promise<void> {
  const apiKey = process.env.LITTLEHELP_API_KEY
  const seq = Number(process.env.LITTLEHELP_SEQ ?? '2')
  if (!apiKey) throw new Error('LITTLEHELP_API_KEY is not set')

  const res = await fetch(`${BASE_URL}/line/v1/message/push?apikey=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lineId: lineUserId, seq, message1: text }),
    signal: AbortSignal.timeout(8_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Little Help push failed: ${res.status} ${body}`)
  }

  console.log('[LittleHelp] Sent to', lineUserId)
}
