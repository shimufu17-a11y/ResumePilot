import { z } from "zod";

export const VAULT_SCHEMA_VERSION = 1;

export const sensitiveLevelSchema = z.enum(["normal", "sensitive", "high"]);
export type SensitiveLevel = z.infer<typeof sensitiveLevelSchema>;

export const personalInfoSchema = z.object({
  fullNameZh: z.string().default(""),
  fullNameEn: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  gender: z.string().default(""),
  birthDate: z.string().default(""),
  nationality: z.string().default(""),
  ethnicity: z.string().default(""),
  politicalStatus: z.string().default(""),
  nativePlace: z.string().default(""),
  hometown: z.string().default(""),
  currentCity: z.string().default(""),
  hukouLocation: z.string().default(""),
  healthStatus: z.string().default(""),
  idNumber: z.string().default(""),
  address: z.string().default(""),
  postalCode: z.string().default(""),
  wechat: z.string().default(""),
  website: z.string().default("")
});

export const educationSchema = z.object({
  id: z.string(),
  school: z.string().default(""),
  schoolEn: z.string().default(""),
  degree: z.string().default(""),
  major: z.string().default(""),
  majorEn: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  gpa: z.string().default(""),
  rank: z.string().default(""),
  courses: z.string().default("")
});

export const experienceSchema = z.object({
  id: z.string(),
  type: z.enum(["internship", "work", "project", "research"]),
  organization: z.string().default(""),
  title: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  description: z.string().default("")
});

export const commonProfileSchema = z.object({
  personal: personalInfoSchema,
  education: z.array(educationSchema).default([]),
  experiences: z.array(experienceSchema).default([]),
  skills: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  awards: z.array(z.string()).default([]),
  certificates: z.array(z.string()).default([]),
  publications: z.array(z.string()).default([]),
  patents: z.array(z.string()).default([])
});
export type CommonProfile = z.infer<typeof commonProfileSchema>;

export const jobProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  direction: z.string().default(""),
  keywords: z.array(z.string()).default([]),
  defaultResumeAssetId: z.string().optional(),
  desiredLocations: z.array(z.string()).default([]),
  expectedSalary: z.string().default(""),
  availableDate: z.string().default(""),
  willingToTravel: z.string().default(""),
  willingToRelocate: z.string().default(""),
  acceptAdjustment: z.string().default(""),
  selfEvaluation: z.string().default(""),
  motivation: z.string().default(""),
  strengths: z.string().default(""),
  weaknesses: z.string().default(""),
  skillSummary: z.string().default(""),
  includedExperienceIds: z.array(z.string()).default([]),
  experienceOverrides: z.record(z.string(), z.string()).default({}),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type JobProfile = z.infer<typeof jobProfileSchema>;

export const assetMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number().nonnegative(),
  category: z.enum([
    "resume",
    "portrait",
    "photo",
    "transcript",
    "degree",
    "certificate",
    "award",
    "publication",
    "patent",
    "other"
  ]),
  profileIds: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  note: z.string().default(""),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type AssetMeta = z.infer<typeof assetMetaSchema>;

export const answerEntrySchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  scope: z.enum(["common", "profile", "company"]),
  profileId: z.string().optional(),
  company: z.string().optional(),
  source: z.enum(["user", "ai"]).default("user"),
  updatedAt: z.string()
});
export type AnswerEntry = z.infer<typeof answerEntrySchema>;

export const siteRuleSchema = z.object({
  id: z.string(),
  hostname: z.string(),
  pathPattern: z.string().default("*"),
  fingerprint: z.string(),
  targetPath: z.string(),
  updatedAt: z.string()
});
export type SiteRule = z.infer<typeof siteRuleSchema>;

export const applicationStatusSchema = z.enum([
  "filling",
  "submitted",
  "assessment",
  "interview",
  "offer",
  "rejected",
  "withdrawn"
]);
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

export const applicationSchema = z.object({
  id: z.string(),
  company: z.string().default(""),
  role: z.string().default(""),
  url: z.string(),
  hostname: z.string(),
  profileId: z.string(),
  status: applicationStatusSchema,
  startedAt: z.string(),
  submittedAt: z.string().optional(),
  note: z.string().default("")
});
export type Application = z.infer<typeof applicationSchema>;

export const aiConfigSchema = z.object({
  enabled: z.boolean().default(false),
  baseUrl: z.string().default("https://api.openai.com/v1"),
  model: z.string().default(""),
  encryptedApiKey: z.string().optional(),
  rememberKey: z.boolean().default(false)
});
export type AiConfig = z.infer<typeof aiConfigSchema>;

export const vaultDataSchema = z.object({
  schemaVersion: z.literal(VAULT_SCHEMA_VERSION),
  commonProfile: commonProfileSchema,
  jobProfiles: z.array(jobProfileSchema),
  activeProfileId: z.string().optional(),
  assets: z.array(assetMetaSchema),
  answers: z.array(answerEntrySchema),
  siteRules: z.array(siteRuleSchema),
  applications: z.array(applicationSchema),
  aiConfig: aiConfigSchema,
  settings: z.object({
    locale: z.enum(["zh-CN", "en"]).default("zh-CN"),
    autoLockMinutes: z.number().int().min(1).max(1440).default(15),
    preferredProfileByHost: z.record(z.string(), z.string()).default({})
  })
});
export type VaultData = z.infer<typeof vaultDataSchema>;

export interface EncryptedValue {
  iv: string;
  ciphertext: string;
}

export interface VaultEnvelope {
  version: 1;
  kdf: {
    algorithm: "PBKDF2";
    hash: "SHA-256";
    iterations: number;
    salt: string;
  };
  verifier: EncryptedValue;
  payload: EncryptedValue;
  updatedAt: string;
}

export interface ResumeCandidate {
  path: string;
  label: string;
  value: string;
  evidence: string;
  confidence: number;
}

export interface PageField {
  id: string;
  fingerprint: string;
  tag: string;
  type: string;
  label: string;
  name: string;
  placeholder: string;
  required: boolean;
  value: string;
  options: string[];
}

export interface PageSnapshot {
  url: string;
  title: string;
  heading: string;
  jdText: string;
  fields: PageField[];
}

export interface FillPlanItem {
  field: PageField;
  targetPath?: string;
  value?: string;
  confidence: number;
  sensitiveLevel: SensitiveLevel;
  source: "profile" | "answer" | "rule" | "none";
  selected: boolean;
  confirmedSensitive: boolean;
}
