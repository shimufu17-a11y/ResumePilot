export const PAGE_ACTION_POLICY = {
  finalSource:
    "(提交|投递|确认申请|申请职位|完成申请|submit|apply now|apply for|complete application|send application|finish application)",
  nextSource:
    "^(下一步|继续|保存并继续|保存并下一步|next|continue|save and continue|save & continue)$",
  flags: "i"
} as const;

export type PageActionKind = "next" | "final" | "unknown";

export function classifyPageAction(text: string): PageActionKind {
  const normalized = text.trim();
  if (new RegExp(PAGE_ACTION_POLICY.finalSource, PAGE_ACTION_POLICY.flags).test(normalized)) {
    return "final";
  }
  if (new RegExp(PAGE_ACTION_POLICY.nextSource, PAGE_ACTION_POLICY.flags).test(normalized)) {
    return "next";
  }
  return "unknown";
}
