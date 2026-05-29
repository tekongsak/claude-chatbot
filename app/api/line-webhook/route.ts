import { NextRequest, NextResponse } from 'next/server'
import * as line from '@line/bot-sdk'
import { getFAQ } from '@/lib/sheet'
import { askGemini } from '@/lib/gemini'

const CUSTOMER_ACK_MSG =
  'ขอบคุณที่ติดต่อ NK Sleepcare ค่ะ ทางเราได้รับคำถามของคุณแล้ว ทีมงานจะติดต่อกลับโดยเร็วที่สุดค่ะ'
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

async function pushToAdmin(userId: string, question: string): Promise<void> {
  const adminId = process.env.LINE_ADMIN_USER_ID
  if (!adminId) return

  let displayName = '(ไม่ทราบชื่อ)'
  let pictureUrl: string | undefined
  try {
    const profile = await getLineClient().getProfile(userId)
    displayName = profile.displayName
    pictureUrl = profile.pictureUrl
  } catch {
    // fall back to defaults if profile fetch fails
  }

  const messages: line.messagingApi.Message[] = []
  if (pictureUrl) {
    messages.push({
      type: 'image',
      originalContentUrl: pictureUrl,
      previewImageUrl: pictureUrl,
    })
  }
  messages.push({
    type: 'text',
    text: `[NK Chatbot] มีคำถามที่ไม่มีในระบบ\n\nชื่อ: ${displayName}\nLINE ID: ${userId}\nคำถาม: ${question}`,
  })

  try {
    await getLineClient().pushMessage({ to: adminId, messages })
  } catch (err) {
    console.error('[LINE Push Admin Error]', JSON.stringify(err))
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
    const userId = ('userId' in event.source ? event.source.userId : undefined) ?? 'unknown'

    let faq
    try {
      faq = await getFAQ()
    } catch (err) {
      console.error('[Sheet Error]', err)
      await replyToUser(replyToken, SHEET_ERROR_MSG)
      continue
    }

    let result
    try {
      result = await askGemini(userMessage, faq)
    } catch (err) {
      console.error('[Gemini Error]', err)
      await replyToUser(replyToken, GEMINI_ERROR_MSG)
      continue
    }

    if (!result.answered) {
      await replyToUser(replyToken, CUSTOMER_ACK_MSG)
      await pushToAdmin(userId, userMessage)
    } else {
      await replyToUser(replyToken, result.text)
    }
  }

  return NextResponse.json({ ok: true })
}
