import { NextRequest, NextResponse } from 'next/server'
import * as line from '@line/bot-sdk'
import { getFAQ } from '@/lib/sheet'
import { askGemini } from '@/lib/gemini'

const DEFAULT_MSG =
  'ขออภัยค่ะ แอดมินยังไม่มีข้อมูลส่วนนี้ รบกวนฝากเบอร์โทรหรือช่องทางติดต่อไว้ ทีมงาน NK Sleepcare จะติดต่อกลับโดยเร็วที่สุดค่ะ'
const SHEET_ERROR_MSG =
  'ขออภัยค่ะ ระบบกำลังอัปเดตข้อมูล รบกวนฝากเบอร์โทรหรือช่องทางติดต่อไว้ ทีมงาน NK Sleepcare จะติดต่อกลับโดยเร็วที่สุดค่ะ'
const GEMINI_ERROR_MSG =
  'ขออภัยค่ะ ระบบกำลังประมวลผลข้อมูล รบกวนฝากเบอร์โทรหรือช่องทางติดต่อไว้ ทีมงาน NK Sleepcare จะติดต่อกลับโดยเร็วที่สุดค่ะ'

function getLineClient(): line.messagingApi.MessagingApiClient {
  return new line.messagingApi.MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
  })
}

async function replyToUser(replyToken: string, text: string): Promise<void> {
  try {
    await getLineClient().replyMessage({
      replyToken,
      messages: [{ type: 'text', text }],
    })
  } catch (err) {
    console.error('[LINE Reply Error]', JSON.stringify(err))
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  if (!line.validateSignature(body, process.env.LINE_CHANNEL_SECRET!, signature)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = JSON.parse(body) as { events: line.WebhookEvent[] }

  for (const event of payload.events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue

    const userMessage = event.message.text
    const { replyToken } = event

    let faq
    try {
      faq = await getFAQ()
    } catch (err) {
      console.error('[Sheet Error]', err)
      await replyToUser(replyToken, SHEET_ERROR_MSG)
      continue
    }

    let aiText: string
    try {
      aiText = await askGemini(userMessage, faq)
    } catch (err) {
      console.error('[Gemini Error]', err)
      await replyToUser(replyToken, GEMINI_ERROR_MSG)
      continue
    }

    await replyToUser(replyToken, aiText || DEFAULT_MSG)
  }

  return NextResponse.json({ ok: true })
}
