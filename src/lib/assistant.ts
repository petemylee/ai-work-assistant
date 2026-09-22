export const ACTIONS = ["analyze", "summarize", "draft"] as const;

export type ActionType = (typeof ACTIONS)[number];

export const MAX_INPUT_LENGTH = 8000;

export type Priority = "Critical" | "High" | "Medium" | "Low";

export type AnalyzeResult = {
  category: string;
  priority: Priority;
  businessImpact: string;
  summary: string;
  possibleCauses: string[];
  investigationSteps: string[];
  remediationSteps: string[];
  shouldEscalate: boolean;
  escalateReason: string;
};

export type SummarizeResult = {
  keyPoints: string[];
  actionItems: string[];
  importantInfo: string[];
};

export type DraftResult = {
  reply: string;
};

export type GenerateSuccess =
  | { ok: true; action: "analyze"; data: AnalyzeResult }
  | { ok: true; action: "summarize"; data: SummarizeResult }
  | { ok: true; action: "draft"; data: DraftResult };

export type GenerateError = {
  ok: false;
  error: string;
};

export type GenerateResponse = GenerateSuccess | GenerateError;

export function isActionType(value: unknown): value is ActionType {
  return typeof value === "string" && (ACTIONS as readonly string[]).includes(value);
}

export function parsePriority(value: unknown): Priority {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "critical" || normalized.includes("วิกฤต")) return "Critical";
  if (normalized === "high" || normalized.includes("สูง")) return "High";
  if (normalized === "low" || normalized.includes("ต่ำ")) return "Low";
  return "Medium";
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

export function asString(value: unknown): string {
  return String(value ?? "").trim();
}
