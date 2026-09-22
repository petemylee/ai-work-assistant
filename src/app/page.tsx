"use client";

import { useState } from "react";
import {
  AlignLeft,
  Check,
  Copy,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import {
  MAX_INPUT_LENGTH,
  type ActionType,
  type AnalyzeResult,
  type DraftResult,
  type GenerateResponse,
  type Priority,
  type SummarizeResult,
} from "@/lib/assistant";

const FEATURES: {
  id: ActionType;
  icon: typeof Wrench;
  title: string;
  description: string;
  placeholder: string;
  buttonLabel: string;
  examples: string[];
}[] = [
  {
    id: "analyze",
    icon: Wrench,
    title: "วิเคราะห์ปัญหา IT",
    description: "ช่วยวิเคราะห์ปัญหาและแนะนำแนวทาง Troubleshooting",
    placeholder:
      "เช่น พนักงานไม่สามารถเข้า Outlook ได้ตั้งแต่ช่วงเช้า ขณะที่เพื่อนร่วมงานคนอื่นยังใช้งานได้ และมีประชุมสำคัญในอีก 30 นาที...",
    buttonLabel: "วิเคราะห์ปัญหา",
    examples: [
      "พนักงานไม่สามารถเข้า Outlook ได้ แต่เพื่อนร่วมงานคนอื่นยังใช้งานได้",
      "เครื่องคอมพิวเตอร์เปิดช้ามาก และ Excel ค้างบ่อย",
      "เครื่องพิมพ์ของแผนกบัญชีไม่สามารถพิมพ์ได้ แต่เครื่องอื่นพิมพ์ได้",
    ],
  },
  {
    id: "summarize",
    icon: AlignLeft,
    title: "สรุปข้อความ",
    description: "สรุป Email / ประกาศ / ข้อความยาวให้เข้าใจง่าย",
    placeholder: "วาง Email หรือประกาศภายในองค์กรที่ต้องการให้ AI ช่วยสรุป...",
    buttonLabel: "สรุปข้อความ",
    examples: [
      "เรียนทุกท่าน ระบบ ERP จะปิดปรับปรุงในวันเสาร์ที่ 27 ก.ย. เวลา 22:00-02:00 น. กรุณาบันทึกงานให้เรียบร้อยก่อนเวลาดังกล่าว หากมีปัญหาหลังเปิดระบบให้แจ้ง IT Helpdesk ภายในวันจันทร์ 09:00 น.",
      "ทีมบัญชีขอให้ทุกแผนกส่งใบแจ้งหนี้ประจำเดือนภายในวันศุกร์ที่ 26 ก.ย. เวลา 16:00 น. ส่งผ่านอีเมล finance@company.com และใส่รหัสแผนกในหัวข้ออีเมล",
    ],
  },
  {
    id: "draft",
    icon: Send,
    title: "ร่างคำตอบ",
    description: "ช่วยร่างคำตอบที่สุภาพและเป็นมืออาชีพ",
    placeholder:
      "เช่น พนักงานแจ้งว่าคอมพิวเตอร์ทำงานช้ามากและต้องใช้ Excel ทำรายงานภายในวันนี้...",
    buttonLabel: "ร่างคำตอบ",
    examples: [
      "พนักงานแจ้งว่าคอมพิวเตอร์ทำงานช้ามากและต้องใช้ Excel ทำรายงานภายในวันนี้",
      "ผู้ใช้งานถามว่าเมื่อไหร่ Wi-Fi ชั้น 3 จะกลับมาใช้ได้ เพราะประชุมลูกค้าผ่าน Teams ตอนบ่าย",
    ],
  },
];

const PRIORITY_STYLES: Record<Priority, string> = {
  Critical: "bg-red-50 text-red-800 ring-red-200",
  High: "bg-orange-50 text-orange-800 ring-orange-200",
  Medium: "bg-slate-100 text-slate-700 ring-slate-200",
  Low: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

const FRIENDLY_ERROR =
  "ขออภัย ระบบ AI ไม่สามารถประมวลผลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง";

export default function Home() {
  const [activeAction, setActiveAction] = useState<ActionType>("analyze");
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const feature = FEATURES.find((item) => item.id === activeAction) ?? FEATURES[0];
  const remaining = MAX_INPUT_LENGTH - inputText.length;
  const canSubmit = Boolean(inputText.trim()) && inputText.length <= MAX_INPUT_LENGTH && !isLoading;
  const inputId = "work-input";

  async function handleSubmit() {
    if (!inputText.trim()) {
      setErrorMessage("กรุณากรอกข้อมูลก่อนดำเนินการ");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setResult(null);
    setCopied(false);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: activeAction,
          text: inputText,
        }),
      });

      const data = (await response.json()) as GenerateResponse;

      if (!response.ok || !data.ok) {
        setErrorMessage(!data.ok ? data.error : FRIENDLY_ERROR);
        return;
      }

      setResult(data);
    } catch {
      setErrorMessage(FRIENDLY_ERROR);
    } finally {
      setIsLoading(false);
    }
  }

  function handleClear() {
    setInputText("");
    setResult(null);
    setErrorMessage("");
    setCopied(false);
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMessage("ไม่สามารถคัดลอกข้อความได้ กรุณาคัดลอกด้วยตนเอง");
    }
  }

  return (
    <div className="min-h-full bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-5 md:px-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-700 text-white" aria-hidden="true">
            <Sparkles size={20} />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight text-slate-900">AI Work Assistant</p>
            <p className="text-sm text-slate-500">ผู้ช่วย AI สำหรับงาน IT และงานสำนักงาน</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6 md:py-8">
        <section aria-labelledby="features-heading">
          <h1 id="features-heading" className="sr-only">
            เลือกฟังก์ชันที่ต้องการใช้
          </h1>
          <div className="grid gap-3 md:grid-cols-3">
            {FEATURES.map((item) => {
              const Icon = item.icon;
              const selected = item.id === activeAction;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveAction(item.id);
                    setResult(null);
                    setErrorMessage("");
                  }}
                  aria-pressed={selected}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    selected
                      ? "border-blue-700 bg-white shadow-sm ring-1 ring-blue-700"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-blue-700">
                    <Icon size={18} aria-hidden="true" />
                  </div>
                  <h2 className="text-sm font-semibold text-slate-900">{item.title}</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-500">{item.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid items-start gap-6 lg:grid-cols-2">
          <form
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <label htmlFor={inputId} className="text-sm font-semibold text-slate-800">
                {feature.title}
              </label>
              <span className={`text-xs ${remaining < 0 ? "text-red-600" : "text-slate-400"}`}>
                {inputText.length.toLocaleString()} / {MAX_INPUT_LENGTH.toLocaleString()}
              </span>
            </div>

            <textarea
              id={inputId}
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && canSubmit) {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder={feature.placeholder}
              disabled={isLoading}
              rows={12}
              maxLength={MAX_INPUT_LENGTH + 200}
              className="w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-800 placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500"
            />

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                ตัวอย่างเริ่มต้น
              </p>
              <div className="flex flex-wrap gap-2">
                {feature.examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setInputText(example);
                      setErrorMessage("");
                    }}
                    disabled={isLoading}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-xs leading-5 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 disabled:opacity-50"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleClear}
                disabled={isLoading || (!inputText && !result && !errorMessage)}
                className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 disabled:opacity-40"
              >
                <Trash2 size={16} aria-hidden="true" />
                ล้างข้อมูล
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
                {isLoading ? "กำลังประมวลผล..." : feature.buttonLabel}
              </button>
            </div>
          </form>

          <section
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
            aria-live="polite"
            aria-busy={isLoading}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-800">ผลลัพธ์จาก AI</h2>
              {isLoading ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-blue-700">
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  กำลังวิเคราะห์
                </span>
              ) : null}
            </div>

            {isLoading ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-lg border border-slate-100 bg-slate-50 text-slate-500">
                <Loader2 size={28} className="animate-spin text-blue-700" aria-hidden="true" />
                <p className="text-sm">AI กำลังประมวลผล กรุณารอสักครู่...</p>
              </div>
            ) : errorMessage ? (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {errorMessage}
              </div>
            ) : result?.ok && result.action === "analyze" ? (
              <AnalyzeView data={result.data} />
            ) : result?.ok && result.action === "summarize" ? (
              <SummarizeView data={result.data} />
            ) : result?.ok && result.action === "draft" ? (
              <DraftView data={result.data} copied={copied} onCopy={() => void handleCopy(result.data.reply)} />
            ) : (
              <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-slate-100 bg-slate-50 px-6 text-center text-sm text-slate-500">
                เลือกฟังก์ชัน ใส่ข้อมูล แล้วกดปุ่มด้านล่างเพื่อดูผลลัพธ์ที่นำไปใช้ได้จริง
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}

function AnalyzeView({ data }: { data: AnalyzeResult }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          {data.category}
        </span>
        <span
          className={`rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${PRIORITY_STYLES[data.priority]}`}
        >
          Priority: {data.priority}
        </span>
        <span
          className={`rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
            data.shouldEscalate
              ? "bg-amber-50 text-amber-800 ring-amber-200"
              : "bg-slate-50 text-slate-600 ring-slate-200"
          }`}
        >
          {data.shouldEscalate ? "ควร Escalate" : "ยังไม่จำเป็นต้อง Escalate"}
        </span>
      </div>

      <ResultBlock title="Business Impact" body={data.businessImpact} />
      <ResultBlock title="สรุปปัญหา" body={data.summary} />
      <ResultList title="สาเหตุที่เป็นไปได้" items={data.possibleCauses} />
      <ResultList title="ขั้นตอนตรวจสอบ" items={data.investigationSteps} ordered />
      <ResultList title="แนวทางแก้ไข" items={data.remediationSteps} ordered />
      <ResultBlock title="ควร Escalate หรือไม่" body={data.escalateReason} />
    </div>
  );
}

function SummarizeView({ data }: { data: SummarizeResult }) {
  return (
    <div className="space-y-5">
      <ResultList title="ประเด็นสำคัญ" items={data.keyPoints} />
      <ResultList title="Action Items" items={data.actionItems} empty="ไม่มี action item ที่ระบุชัดเจน" />
      <ResultList title="ข้อมูลสำคัญ" items={data.importantInfo} empty="ไม่มีวันที่ กำหนดส่ง หรือข้อมูลอ้างอิงเพิ่มเติม" />
    </div>
  );
}

function DraftView({
  data,
  copied,
  onCopy,
}: {
  data: DraftResult;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">ร่างคำตอบ</h3>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? "คัดลอกแล้ว" : "คัดลอกข้อความ"}
        </button>
      </div>
      <div className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm leading-7 text-slate-800">
        {data.reply}
      </div>
    </div>
  );
}

function ResultBlock({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <p className="text-sm leading-6 text-slate-800">{body || "-"}</p>
    </section>
  );
}

function ResultList({
  title,
  items,
  ordered = false,
  empty = "ไม่มีข้อมูลเพียงพอจากข้อความที่ให้มา",
}: {
  title: string;
  items: string[];
  ordered?: boolean;
  empty?: string;
}) {
  const ListTag = ordered ? "ol" : "ul";

  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ListTag className={`space-y-1.5 text-sm leading-6 text-slate-800 ${ordered ? "list-decimal pl-5" : "list-disc pl-5"}`}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ListTag>
      )}
    </section>
  );
}
