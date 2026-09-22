import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from "@google/generative-ai";
import { NextResponse } from "next/server";
import {
  asString,
  asStringArray,
  isActionType,
  MAX_INPUT_LENGTH,
  parsePriority,
  type ActionType,
  type AnalyzeResult,
  type DraftResult,
  type GenerateResponse,
  type SummarizeResult,
} from "@/lib/assistant";

const USER_ERROR =
  "ขออภัย ระบบ AI ไม่สามารถประมวลผลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง";

const MODELS = ["gemini-3.1-flash-lite", "gemini-2.5-flash", 'gemini-2.5-flash-lite'] as const;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRetryable(error: unknown): boolean {
    return /503|429|high demand|service unavailable|temporarily unavailable/i.test(
      errorMessage(error),
    );
  }

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

const SHARED_SYSTEM_INSTRUCTION = `คุณคือ AI Assistant สำหรับช่วยงาน IT และงานสำนักงานภายในองค์กร
บทบาทของคุณคือผู้ช่วยของทีม IT Support / Helpdesk และงานธุรการ ไม่ใช่แชทบอททั่วไป

หลักการตอบ:
- ตอบเป็นภาษาไทยที่สุภาพ กระชับ เป็นมืออาชีพ และนำไปใช้ทำงานต่อได้ทันที
- ห้ามเปิดบทสนทนา ห้ามทักทาย ห้ามถามกลับนอกเหนือจากข้อมูลในผลลัพธ์
- ห้ามใช้คำว่า "ในฐานะ AI" หรือสำนวนที่ดูเหมือน AI generated
- ห้ามฟันธงสาเหตุถ้าข้อมูลยังไม่เพียงพอ ให้ใช้คำว่า "สาเหตุที่เป็นไปได้" หรือ "ควรตรวจสอบเพิ่มเติม"
- ตอบเป็น JSON ตาม schema ที่กำหนดเท่านั้น`;

function getPrompt(action: ActionType): string {
  switch (action) {
    case "analyze":
      return `วิเคราะห์ปัญหาในฐานะ IT Support / Helpdesk

พิจารณาจาก:
- ผลกระทบต่อธุรกิจ (Business impact)
- จำนวนผู้ได้รับผลกระทบและ scope ของปัญหา
- ความเร่งด่วนจากผลกระทบจริง ไม่ใช่แค่คำว่า "ด่วน" ในข้อความ
- อาการของปัญหา
- สาเหตุที่เป็นไปได้ (ห้ามฟันธงถ้าข้อมูลไม่พอ)
- วิธีตรวจสอบ วิธีแก้ไข และเมื่อใดควร Escalate

เกณฑ์ Priority:
- Critical: กระทบธุรกิจกว้าง ระบบหลักล่ม หรือมีผลกระทบต่อหลายคน/หลายแผนก และต้องแก้ทันที
- High: กระทบงานสำคัญของบุคคลหรือทีม โดยเฉพาะใกล้เดดไลน์หรือกระทบลูกค้า
- Medium: ใช้งานได้บางส่วน หรืองานยังเดินต่อได้แต่มีอุปสรรค
- Low: รำคาญเล็กน้อย ไม่กระทบงานหลัก

ฟิลด์ที่ต้องตอบ:
- category: ประเภทปัญหา เช่น อีเมล, เครือข่าย, เครื่องพิมพ์, ฮาร์ดแวร์, ซอฟต์แวร์, บัญชีผู้ใช้
- priority: Critical | High | Medium | Low
- businessImpact: สรุปผลกระทบต่องาน/ธุรกิจ
- summary: สรุปปัญหาสั้น ๆ จากข้อมูลที่มี
- possibleCauses: สาเหตุที่เป็นไปได้ (ไม่ฟันธง)
- investigationSteps: ขั้นตอนตรวจสอบเพิ่มเติม
- remediationSteps: แนวทางแก้ไขเบื้องต้น
- shouldEscalate: true เมื่อเกินระดับ first-line, มีผลกระทบกว้าง, ใกล้กระทบธุรกิจ, หรือต้องสิทธิ์/ทีมเฉพาะ
- escalateReason: อธิบายสั้น ๆ ว่าควรหรือไม่ควร escalate`;

    case "summarize":
      return `สรุปข้อความให้ทีมงานนำไปใช้ต่อได้ทันที เช่น อีเมล ประกาศภายใน หรือข้อความยาว

เน้นข้อมูลที่นำไปทำงานต่อได้ ไม่ใช่สรุปแบบทั่วไป

ฟิลด์ที่ต้องตอบ:
- keyPoints: ประเด็นสำคัญ
- actionItems: สิ่งที่ต้องทำ ใครทำ (ถ้ามี) และกำหนดส่ง (ถ้ามี) ถ้าไม่มีให้เป็น array ว่าง
- importantInfo: วันเวลา สถานที่ ช่องทางติดต่อ ลิงก์ ตัวเลข หรือเงื่อนไขสำคัญ ถ้าไม่มีให้เป็น array ว่าง`;

    case "draft":
      return `ร่างคำตอบภาษาไทยสำหรับสื่อสารภายในองค์กร กับพนักงานหรือผู้ใช้งานภายใน

โทน:
- สุภาพ เป็นมืออาชีพ กระชับ เป็นธรรมชาติ
- ไม่เกร็งจนเกินไป ไม่ดูเป็นเทมเพลต และไม่ดูเหมือน AI generated
- รับทราบปัญหา แจ้งสิ่งที่จะทำหรือสิ่งที่ต้องการข้อมูลเพิ่ม ปิดท้ายสุภาพ

ฟิลด์ที่ต้องตอบ:
- reply: ข้อความร่างที่คัดลอกไปส่งได้ทันที ไม่ต้องมีหัวข้อหรือคำอธิบายประกอบ`;
  }
}

const ANALYZE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    category: { type: SchemaType.STRING },
    priority: { type: SchemaType.STRING },
    businessImpact: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
    possibleCauses: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    investigationSteps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    remediationSteps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    shouldEscalate: { type: SchemaType.BOOLEAN },
    escalateReason: { type: SchemaType.STRING },
  },
  required: [
    "category",
    "priority",
    "businessImpact",
    "summary",
    "possibleCauses",
    "investigationSteps",
    "remediationSteps",
    "shouldEscalate",
    "escalateReason",
  ],
};

const SUMMARIZE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    keyPoints: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    actionItems: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    importantInfo: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ["keyPoints", "actionItems", "importantInfo"],
};

const DRAFT_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    reply: { type: SchemaType.STRING },
  },
  required: ["reply"],
};

function schemaFor(action: ActionType): ResponseSchema {
  if (action === "analyze") return ANALYZE_SCHEMA;
  if (action === "summarize") return SUMMARIZE_SCHEMA;
  return DRAFT_SCHEMA;
}

function jsonError(status: number, error: string): NextResponse<GenerateResponse> {
  return NextResponse.json({ ok: false, error }, { status });
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

function toAnalyze(payload: Record<string, unknown>): AnalyzeResult {
  return {
    category: asString(payload.category) || "ไม่ระบุ",
    priority: parsePriority(payload.priority),
    businessImpact: asString(payload.businessImpact),
    summary: asString(payload.summary),
    possibleCauses: asStringArray(payload.possibleCauses),
    investigationSteps: asStringArray(payload.investigationSteps),
    remediationSteps: asStringArray(payload.remediationSteps),
    shouldEscalate: Boolean(payload.shouldEscalate),
    escalateReason: asString(payload.escalateReason),
  };
}

function toSummarize(payload: Record<string, unknown>): SummarizeResult {
  return {
    keyPoints: asStringArray(payload.keyPoints),
    actionItems: asStringArray(payload.actionItems),
    importantInfo: asStringArray(payload.importantInfo),
  };
}

function toDraft(payload: Record<string, unknown>): DraftResult {
  return {
    reply: asString(payload.reply),
  };
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set");
    return jsonError(500, USER_ERROR);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "รูปแบบข้อมูลไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
  }

  if (!body || typeof body !== "object") {
    return jsonError(400, "รูปแบบข้อมูลไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
  }

  const { action, text } = body as { action?: unknown; text?: unknown };

  if (!isActionType(action)) {
    return jsonError(400, "กรุณาเลือกประเภทงานที่ต้องการให้ช่วย");
  }

  if (typeof text !== "string" || !text.trim()) {
    return jsonError(400, "กรุณาระบุข้อความที่ต้องการให้ช่วยประมวลผล");
  }

  const input = text.trim();
  if (input.length > MAX_INPUT_LENGTH) {
    return jsonError(400, `ข้อความยาวเกินไป กรุณาย่อให้ไม่เกิน ${MAX_INPUT_LENGTH.toLocaleString()} ตัวอักษร`);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    let rawText = "";
    let lastError: unknown;

    for (const modelName of MODELS) {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SHARED_SYSTEM_INSTRUCTION,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schemaFor(action),
          maxOutputTokens: 8192,
        },
      });

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const result = await model.generateContent(
            `${getPrompt(action)}\n\nข้อมูลจากผู้ใช้:\n${input}`,
          );
          rawText = result.response.text();
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
          console.error(`Gemini ${modelName} attempt ${attempt} failed:`, errorMessage(error));
          if (!isRetryable(error) || attempt === 2) break;
          await wait(800 * attempt);
        }
      }

      if (rawText) break;
    }

    if (!rawText && lastError) {
      throw lastError;
    }

    if (!rawText?.trim()) {
      console.error("Gemini returned an empty response");
      return jsonError(502, USER_ERROR);
    }

    let parsed: unknown;
    try {
      parsed = extractJson(rawText);
    } catch (error) {
      console.error("Gemini returned invalid JSON:", error);
      return jsonError(502, USER_ERROR);
    }

    if (!parsed || typeof parsed !== "object") {
      console.error("Gemini returned non-object JSON");
      return jsonError(502, USER_ERROR);
    }

    const payload = parsed as Record<string, unknown>;

    if (action === "analyze") {
      return NextResponse.json({ ok: true, action, data: toAnalyze(payload) });
    }
    if (action === "summarize") {
      return NextResponse.json({ ok: true, action, data: toSummarize(payload) });
    }
    return NextResponse.json({ ok: true, action, data: toDraft(payload) });
  } catch (error) {
    console.error("Gemini generate failed:", error);
    return jsonError(500, USER_ERROR);
  }
}
