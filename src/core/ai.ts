export interface AiRequestConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface JobAnalysis {
  recommendedProfileName: string;
  matchedPoints: string[];
  missingPoints: string[];
  emphasisSuggestions: string[];
  draftAnswer?: string;
}

export async function setSessionAiKey(apiKey: string): Promise<void> {
  if (apiKey) await browser.storage.session.set({ [AI_SESSION_KEY]: apiKey });
  else await browser.storage.session.remove(AI_SESSION_KEY);
}

export async function getEffectiveAiKey(rememberedKey?: string): Promise<string> {
  if (rememberedKey) return rememberedKey;
  const stored = await browser.storage.session.get(AI_SESSION_KEY);
  return (stored[AI_SESSION_KEY] as string | undefined) ?? "";
}

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

export async function requestJobAnalysis(
  config: AiRequestConfig,
  input: {
    jobDescription: string;
    profiles: Array<{ name: string; direction: string; keywords: string[]; facts: string }>;
    question?: string;
  }
): Promise<JobAnalysis> {
  const response = await fetch(endpoint(config.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "你是求职信息整理助手。只能使用用户提供的事实，禁止编造经历、成绩、论文、专利或奖项。输出 JSON，字段为 recommendedProfileName、matchedPoints、missingPoints、emphasisSuggestions、draftAnswer。"
        },
        { role: "user", content: JSON.stringify(input) }
      ]
    })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI 接口请求失败（${response.status}）：${detail.slice(0, 180)}`);
  }
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 接口没有返回可用内容");
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error("AI 返回内容不是有效的 JSON 分析结果");
  }
  const parsed = JSON.parse(content.slice(firstBrace, lastBrace + 1)) as Partial<JobAnalysis>;
  return {
    recommendedProfileName: parsed.recommendedProfileName ?? "",
    matchedPoints: parsed.matchedPoints ?? [],
    missingPoints: parsed.missingPoints ?? [],
    emphasisSuggestions: parsed.emphasisSuggestions ?? [],
    draftAnswer: parsed.draftAnswer
  };
}
import { browser } from "wxt/browser";

const AI_SESSION_KEY = "resumepilot.ai-session-key";
