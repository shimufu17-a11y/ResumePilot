import type { JobProfile, VaultData } from "./model";
import { VAULT_SCHEMA_VERSION } from "./model";

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createJobProfile(name = "新求职档案", direction = ""): JobProfile {
  const now = new Date().toISOString();
  return {
    id: newId("profile"),
    name,
    direction,
    keywords: [],
    desiredLocations: [],
    expectedSalary: "",
    availableDate: "",
    willingToTravel: "",
    willingToRelocate: "",
    acceptAdjustment: "",
    selfEvaluation: "",
    motivation: "",
    strengths: "",
    weaknesses: "",
    skillSummary: "",
    includedExperienceIds: [],
    experienceOverrides: {},
    createdAt: now,
    updatedAt: now
  };
}

export function createInitialVaultData(): VaultData {
  const radar = createJobProfile("雷达岗位", "雷达系统 / 信号处理 / 研究所");
  radar.keywords = ["雷达", "信号处理", "电子信息", "研究所", "航天", "射频"];
  const agent = createJobProfile("Agent 开发岗位", "AI Agent / 大模型应用开发");
  agent.keywords = ["agent", "智能体", "大模型", "llm", "ai", "算法", "开发"];

  return {
    schemaVersion: VAULT_SCHEMA_VERSION,
    commonProfile: {
      personal: {
        fullNameZh: "",
        fullNameEn: "",
        phone: "",
        email: "",
        gender: "",
        birthDate: "",
        nationality: "",
        ethnicity: "",
        politicalStatus: "",
        nativePlace: "",
        hometown: "",
        currentCity: "",
        hukouLocation: "",
        healthStatus: "",
        idNumber: "",
        address: "",
        postalCode: "",
        wechat: "",
        website: ""
      },
      education: [],
      experiences: [],
      skills: [],
      languages: [],
      awards: [],
      certificates: [],
      publications: [],
      patents: []
    },
    jobProfiles: [radar, agent],
    activeProfileId: radar.id,
    assets: [],
    answers: [],
    siteRules: [],
    applications: [],
    aiConfig: {
      enabled: false,
      baseUrl: "https://api.openai.com/v1",
      model: "",
      rememberKey: false
    },
    settings: {
      locale: "zh-CN",
      autoLockMinutes: 15,
      preferredProfileByHost: {}
    }
  };
}
