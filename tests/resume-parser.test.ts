import { describe, expect, it } from "vitest";
import { deriveResumeCandidates } from "../src/core/resume-parser";

describe("local resume candidate extraction", () => {
  it("extracts high-confidence contact and academic fields", () => {
    const candidates = deriveResumeCandidates(`
      虚构候选人
      手机：13800000000  邮箱：candidate@example.test
      星海大学 电子信息工程 硕士
      GPA：3.82 / 4.0  专业排名：5/120
      政治面貌：中共党员
    `);
    const values = Object.fromEntries(candidates.map((item) => [item.path, item.value]));

    expect(values["commonProfile.personal.phone"]).toBe("13800000000");
    expect(values["commonProfile.personal.email"]).toBe("candidate@example.test");
    expect(values["commonProfile.education.0.school"]).toBe("星海大学");
    expect(values["commonProfile.education.0.gpa"]).toContain("3.82");
  });

  it("does not invent values that are absent", () => {
    const candidates = deriveResumeCandidates("项目经历：实现了一个虚构的检索系统。");
    expect(candidates).toEqual([]);
  });
});
