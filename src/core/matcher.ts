import { FIELD_DICTIONARY, type FieldDefinition } from "./field-dictionary";
import type {
  AnswerEntry,
  FillPlanItem,
  JobProfile,
  PageField,
  PageSnapshot,
  SiteRule,
  VaultData
} from "./model";

export function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/[\s\p{P}\p{S}_]+/gu, "")
    .trim();
}

function fieldTexts(field: PageField): Array<{ value: string; weight: number }> {
  return [
    { value: field.label, weight: 1 },
    { value: field.name, weight: 0.86 },
    { value: field.placeholder, weight: 0.8 }
  ].filter((item) => item.value.trim().length > 0);
}

export function fieldDefinitionScore(field: PageField, definition: FieldDefinition): number {
  const texts = fieldTexts(field);
  const combined = normalizeText(texts.map((item) => item.value).join(" "));
  if (definition.negativeAliases?.some((alias) => combined.includes(normalizeText(alias)))) {
    return 0;
  }

  let best = 0;
  for (const { value, weight } of texts) {
    const normalizedValue = normalizeText(value);
    for (const alias of definition.aliases) {
      const normalizedAlias = normalizeText(alias);
      if (!normalizedAlias || !normalizedValue) continue;
      if (normalizedValue === normalizedAlias) best = Math.max(best, 1 * weight);
      else if (normalizedValue.startsWith(normalizedAlias)) {
        best = Math.max(best, 0.92 * weight);
      } else if (normalizedValue.includes(normalizedAlias)) {
        best = Math.max(best, 0.84 * weight);
      } else if (normalizedAlias.includes(normalizedValue) && normalizedValue.length >= 3) {
        best = Math.max(best, 0.72 * weight);
      }
    }
  }
  return Number(best.toFixed(3));
}

export function bestDefinition(
  field: PageField
): { definition: FieldDefinition; score: number } | undefined {
  let result: { definition: FieldDefinition; score: number } | undefined;
  for (const definition of FIELD_DICTIONARY) {
    const score = fieldDefinitionScore(field, definition);
    if (!result || score > result.score) result = { definition, score };
  }
  return result && result.score >= 0.58 ? result : undefined;
}

export function getPathValue(data: VaultData, profile: JobProfile, path: string): unknown {
  const root: Record<string, unknown> = {
    commonProfile: data.commonProfile,
    jobProfile: profile
  };
  return path.split(".").reduce<unknown>((value, segment) => {
    if (value === undefined || value === null || typeof value !== "object") {
      return undefined;
    }
    return (value as Record<string, unknown>)[segment];
  }, root);
}

export function stringifyFieldValue(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join("、");
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}

function answerScore(question: string, entry: AnswerEntry): number {
  const left = normalizeText(question);
  const right = normalizeText(entry.question);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.82;
  const grams = (value: string): Set<string> => {
    const result = new Set<string>();
    for (let index = 0; index < value.length - 1; index += 1) {
      result.add(value.slice(index, index + 2));
    }
    return result;
  };
  const a = grams(left);
  const b = grams(right);
  const intersection = [...a].filter((item) => b.has(item)).length;
  return intersection / Math.max(a.size, b.size, 1);
}

function bestAnswer(
  field: PageField,
  answers: AnswerEntry[],
  profileId: string,
  hostname: string
): { entry: AnswerEntry; score: number } | undefined {
  const applicable = answers.filter((entry) => {
    if (entry.scope === "common") return true;
    if (entry.scope === "profile") return entry.profileId === profileId;
    return entry.company && normalizeText(hostname).includes(normalizeText(entry.company));
  });
  let best: { entry: AnswerEntry; score: number } | undefined;
  for (const entry of applicable) {
    const scopeBonus = entry.scope === "company" ? 0.08 : entry.scope === "profile" ? 0.04 : 0;
    const score = answerScore(field.label || field.placeholder, entry) + scopeBonus;
    if (!best || score > best.score) best = { entry, score };
  }
  return best && best.score >= 0.62
    ? { entry: best.entry, score: Math.min(1, best.score) }
    : undefined;
}

function matchingRule(
  field: PageField,
  rules: SiteRule[],
  hostname: string,
  pathname: string
): SiteRule | undefined {
  return rules.find(
    (rule) =>
      rule.hostname === hostname &&
      rule.fingerprint === field.fingerprint &&
      (rule.pathPattern === "*" || pathname.startsWith(rule.pathPattern))
  );
}

export function buildFillPlan(
  snapshot: PageSnapshot,
  data: VaultData,
  profileId: string
): FillPlanItem[] {
  const profile = data.jobProfiles.find((item) => item.id === profileId);
  if (!profile) throw new Error("求职档案不存在");
  const url = new URL(snapshot.url);

  return snapshot.fields.map((field) => {
    const rule = matchingRule(field, data.siteRules, url.hostname, url.pathname);
    const automaticMatch = rule ? undefined : bestDefinition(field);
    const match = rule
      ? FIELD_DICTIONARY.find((definition) => definition.path === rule.targetPath)
      : automaticMatch?.definition;
    const matchScore = rule ? 1 : (automaticMatch?.score ?? 0);
    if (match) {
      const value = stringifyFieldValue(getPathValue(data, profile, match.path));
      if (value) {
        return {
          field,
          targetPath: match.path,
          value,
          confidence: matchScore,
          sensitiveLevel: match.sensitiveLevel,
          source: rule ? "rule" : "profile",
          selected:
            match.sensitiveLevel === "normal" &&
            (!field.value || normalizeText(field.value) === normalizeText(value)),
          confirmedSensitive: false
        };
      }
    }

    if (field.tag === "textarea" || field.type === "textarea") {
      const answer = bestAnswer(field, data.answers, profileId, url.hostname);
      if (answer) {
        return {
          field,
          value: answer.entry.answer,
          confidence: answer.score,
          sensitiveLevel: "normal",
          source: "answer",
          selected: true,
          confirmedSensitive: false
        };
      }
    }

    return {
      field,
      targetPath: match?.path,
      confidence: match ? matchScore : 0,
      sensitiveLevel: match?.sensitiveLevel ?? "normal",
      source: match ? (rule ? "rule" : "profile") : "none",
      selected: false,
      confirmedSensitive: false
    };
  });
}

export interface ProfileRecommendation {
  profileId: string;
  score: number;
  matchedKeywords: string[];
  reason: "site-default" | "keyword" | "fallback";
}

export function recommendProfiles(
  snapshot: Pick<PageSnapshot, "url" | "title" | "heading" | "jdText">,
  data: VaultData
): ProfileRecommendation[] {
  const hostname = new URL(snapshot.url).hostname;
  const preferred = data.settings.preferredProfileByHost[hostname];
  const text = normalizeText(`${snapshot.title} ${snapshot.heading} ${snapshot.jdText}`);
  return data.jobProfiles
    .map((profile) => {
      const matchedKeywords = profile.keywords.filter((keyword) =>
        text.includes(normalizeText(keyword))
      );
      const isPreferred = preferred === profile.id;
      return {
        profileId: profile.id,
        score: isPreferred ? 100 : matchedKeywords.length,
        matchedKeywords,
        reason: isPreferred
          ? ("site-default" as const)
          : matchedKeywords.length
            ? ("keyword" as const)
            : ("fallback" as const)
      };
    })
    .sort((a, b) => b.score - a.score);
}
