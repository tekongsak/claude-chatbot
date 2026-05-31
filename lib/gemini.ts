import { GoogleGenAI } from '@google/genai'
import type { FAQ } from './sheet'

const DEFAULT_MSG =
  'ขออภัยค่ะ แอดมินยังไม่มีข้อมูลส่วนนี้ รบกวนฝากเบอร์โทรหรือช่องทางติดต่อไว้ ทีมงาน NK Sleepcare จะติดต่อกลับโดยเร็วที่สุดค่ะ'

const SYSTEM_INSTRUCTION = `<role>
คุณคือ แอดมิน NK Sleepcare ของ บริษัท NK Sleepcare จำกัด

บริษัทเป็นผู้เชี่ยวชาญด้านการดูแลปัญหาการนอนหลับ ให้บริการตรวจการนอนหลับ (Sleep Test) และเป็นตัวแทนจำหน่ายเครื่อง CPAP อย่างเป็นทางการจาก Resmed (Australia) และ Philips (USA)
</role>

<constraints>
ตอบโดยใช้ข้อมูลใน <faq> เท่านั้น
ห้ามแต่งข้อมูลเพิ่ม
ห้ามแต่งราคา
ห้ามแต่งโปรโมชั่น
ห้ามแต่งเวลาเปิดทำการ
ห้ามแต่งที่อยู่
ห้ามเดาข้อมูล
หากคำตอบไม่มีอยู่ใน FAQ หรือข้อมูลไม่เพียงพอ ให้ตอบข้อความ default ด้านล่างเท่านั้น

ข้อความ default:
"ขออภัยค่ะ แอดมินยังไม่มีข้อมูลส่วนนี้ รบกวนฝากเบอร์โทรหรือช่องทางติดต่อไว้ ทีมงาน NK Sleepcare จะติดต่อกลับโดยเร็วที่สุดค่ะ"

ใช้โทนสุภาพแบบมืออาชีพ
ตอบเหมือนแอดมินตอบลูกค้า
ห้ามบอกว่าเป็น AI
ห้ามบอกว่าเป็นบอท
ห้ามใช้ Emoji
ปกติให้ตอบสั้น กระชับ
ความยาว 1-3 ประโยค
หากคำถามต้องการรายละเอียด และมีข้อมูลอยู่ใน FAQ สามารถอธิบายเพิ่มเติมจากข้อมูล FAQ ได้
</constraints>

<output_format>
ภาษาไทย
ไม่ใช้ Markdown
ไม่ใช้ Bullet
ไม่ใช้ Emoji
</output_format>`

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

function getBangkokDatetime(): string {
  return new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export type GeminiResult = {
  text: string
  answered: boolean
}

export async function askGemini(question: string, faq: FAQ[]): Promise<GeminiResult> {
  const faqText = faq.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')

  const userContent = `<datetime>${getBangkokDatetime()}</datetime>\n\n<faq>\n${faqText}\n</faq>\n\n<question>\n${question}\n</question>`

  const response = await genAI.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 1.0,
      maxOutputTokens: 1024,
    },
  })

  const finishReason = response.candidates?.[0]?.finishReason
  const thoughtsTokenCount = response.usageMetadata?.thoughtsTokenCount ?? 0
  const candidatesTokenCount = response.usageMetadata?.candidatesTokenCount ?? 0

  console.log('[Gemini]', { finishReason, thoughtsTokenCount, candidatesTokenCount })

  if (finishReason === 'MAX_TOKENS') return { text: DEFAULT_MSG, answered: false }

  const text = response.text?.trim() || ''
  const answered = text !== '' && text !== DEFAULT_MSG
  return { text: answered ? text : DEFAULT_MSG, answered }
}
