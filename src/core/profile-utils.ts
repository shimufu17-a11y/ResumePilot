import { newId } from "./defaults";
import type { ResumeCandidate, VaultData } from "./model";

export function ensurePrimaryEducation(data: VaultData): void {
  if (data.commonProfile.education.length) return;
  data.commonProfile.education.push({
    id: newId("education"),
    school: "",
    schoolEn: "",
    degree: "",
    major: "",
    majorEn: "",
    startDate: "",
    endDate: "",
    gpa: "",
    rank: "",
    courses: ""
  });
}

export function applyResumeCandidates(data: VaultData, candidates: ResumeCandidate[]): void {
  for (const candidate of candidates) {
    if (candidate.path.startsWith("commonProfile.education.0.")) {
      ensurePrimaryEducation(data);
    }
    const segments = candidate.path.split(".");
    let cursor: unknown = data;
    for (let index = 0; index < segments.length - 1; index += 1) {
      if (!cursor || typeof cursor !== "object") break;
      cursor = (cursor as Record<string, unknown>)[segments[index]!];
    }
    if (cursor && typeof cursor === "object") {
      (cursor as Record<string, unknown>)[segments.at(-1)!] = candidate.value;
    }
  }
}
