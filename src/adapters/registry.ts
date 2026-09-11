export type CompatibilityStatus = "generic" | "partial" | "verified" | "restricted";

export interface SiteDescriptor {
  id: string;
  name: string;
  category: "platform" | "company" | "ats" | "institute";
  hostPatterns: RegExp[];
  status: CompatibilityStatus;
  notes: string;
}

/**
 * Registry entries describe routing and transparent compatibility status.
 * A listing here never implies verified support; verification is tracked in
 * docs/site-compatibility.md with a date and browser version.
 */
export const SITE_REGISTRY: SiteDescriptor[] = [
  {
    id: "boss",
    name: "BOSS 直聘",
    category: "platform",
    hostPatterns: [/(^|\.)zhipin\.com$/i],
    status: "generic",
    notes: "通用字段识别；登录和沟通流程由用户完成"
  },
  {
    id: "nowcoder",
    name: "牛客",
    category: "platform",
    hostPatterns: [/(^|\.)nowcoder\.com$/i],
    status: "generic",
    notes: "通用字段识别"
  },
  {
    id: "zhaopin",
    name: "智联招聘",
    category: "platform",
    hostPatterns: [/(^|\.)zhaopin\.com$/i],
    status: "generic",
    notes: "通用字段识别"
  },
  {
    id: "51job",
    name: "前程无忧",
    category: "platform",
    hostPatterns: [/(^|\.)51job\.com$/i],
    status: "generic",
    notes: "含前程无忧校招系统入口"
  },
  {
    id: "liepin",
    name: "猎聘",
    category: "platform",
    hostPatterns: [/(^|\.)liepin\.com$/i],
    status: "generic",
    notes: "通用字段识别"
  },
  {
    id: "huawei",
    name: "华为招聘",
    category: "company",
    hostPatterns: [/(^|\.)huawei\.com$/i],
    status: "generic",
    notes: "等待当期投递页验证"
  },
  {
    id: "bytedance",
    name: "字节跳动招聘",
    category: "company",
    hostPatterns: [/(^|\.)bytedance\.com$/i, /(^|\.)bytedance\.net$/i],
    status: "generic",
    notes: "等待当期投递页验证"
  },
  {
    id: "jd",
    name: "京东招聘",
    category: "company",
    hostPatterns: [/(^|\.)jd\.com$/i],
    status: "generic",
    notes: "等待当期投递页验证"
  },
  {
    id: "meituan",
    name: "美团招聘",
    category: "company",
    hostPatterns: [/(^|\.)meituan\.com$/i],
    status: "generic",
    notes: "等待当期投递页验证"
  },
  {
    id: "pdd",
    name: "拼多多招聘",
    category: "company",
    hostPatterns: [/(^|\.)pinduoduo\.com$/i, /(^|\.)pddglobalhr\.com$/i],
    status: "generic",
    notes: "等待当期投递页验证"
  },
  {
    id: "tplink",
    name: "TP-Link 招聘",
    category: "company",
    hostPatterns: [/(^|\.)tp-link\.com(\.cn)?$/i],
    status: "generic",
    notes: "等待当期投递页验证"
  },
  {
    id: "lixiang",
    name: "理想汽车招聘",
    category: "company",
    hostPatterns: [/(^|\.)lixiang\.com$/i],
    status: "generic",
    notes: "等待当期投递页验证"
  },
  {
    id: "byd",
    name: "比亚迪招聘",
    category: "company",
    hostPatterns: [/(^|\.)byd\.com$/i],
    status: "generic",
    notes: "等待当期投递页验证"
  },
  {
    id: "moka",
    name: "Moka 招聘系统",
    category: "ats",
    hostPatterns: [/(^|\.)mokahr\.com$/i],
    status: "generic",
    notes: "可覆盖多家企业，后续增加组件适配"
  },
  {
    id: "beisen",
    name: "北森招聘系统",
    category: "ats",
    hostPatterns: [/(^|\.)beisen\.com$/i, /(^|\.)italent\.cn$/i],
    status: "generic",
    notes: "可覆盖多家企业，后续增加组件适配"
  },
  {
    id: "workday",
    name: "Workday",
    category: "ats",
    hostPatterns: [/(^|\.)myworkdayjobs\.com$/i, /(^|\.)workday\.com$/i],
    status: "generic",
    notes: "支持中英文字段识别"
  },
  {
    id: "successfactors",
    name: "SAP SuccessFactors",
    category: "ats",
    hostPatterns: [/(^|\.)successfactors\.(com|eu)$/i],
    status: "generic",
    notes: "支持中英文字段识别"
  }
];

export function detectSite(url: string): SiteDescriptor | undefined {
  const hostname = new URL(url).hostname;
  return SITE_REGISTRY.find((site) => site.hostPatterns.some((pattern) => pattern.test(hostname)));
}
