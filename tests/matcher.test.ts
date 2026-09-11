import { describe, expect, it } from "vitest";
import { createInitialVaultData, newId } from "../src/core/defaults";
import { bestDefinition, buildFillPlan, recommendProfiles } from "../src/core/matcher";
import type { PageField, PageSnapshot } from "../src/core/model";

function field(overrides: Partial<PageField>): PageField {
  return {
    id: newId("field"),
    fingerprint: newId("fingerprint"),
    tag: "input",
    type: "text",
    label: "",
    name: "",
    placeholder: "",
    required: false,
    value: "",
    options: [],
    ...overrides
  };
}

function snapshot(fields: PageField[]): PageSnapshot {
  return {
    url: "https://jobs.example.com/apply/1",
    title: "AI Agent 开发工程师",
    heading: "AI Agent 开发工程师",
    jdText: "负责大模型 Agent 应用开发和评测",
    fields
  };
}

describe("generic field matcher", () => {
  it("matches Chinese and English form labels", () => {
    expect(bestDefinition(field({ label: "手机号码" }))?.definition.path).toBe(
      "commonProfile.personal.phone"
    );
    expect(
      bestDefinition(field({ name: "candidate_email", placeholder: "Email" }))?.definition.path
    ).toBe("commonProfile.personal.email");
  });

  it("does not confuse emergency contacts with the candidate", () => {
    expect(bestDefinition(field({ label: "紧急联系人姓名" }))).toBeUndefined();
    expect(bestDefinition(field({ label: "紧急联系人电话" }))).toBeUndefined();
  });

  it("keeps sensitive values deselected until explicit confirmation", () => {
    const data = createInitialVaultData();
    data.commonProfile.personal.phone = "13800000000";
    data.commonProfile.personal.idNumber = "110101200001010000";
    const plan = buildFillPlan(
      snapshot([field({ label: "联系电话" }), field({ label: "身份证号码" })]),
      data,
      data.activeProfileId!
    );
    expect(plan.map((item) => item.value)).toEqual(["13800000000", "110101200001010000"]);
    expect(plan.every((item) => !item.selected)).toBe(true);
  });

  it("does not overwrite a page value by default", () => {
    const data = createInitialVaultData();
    data.commonProfile.personal.fullNameZh = "测试用户";
    const [item] = buildFillPlan(
      snapshot([field({ label: "姓名", value: "用户手动输入" })]),
      data,
      data.activeProfileId!
    );
    expect(item?.selected).toBe(false);
  });

  it("prefers direction-specific answers over common answers", () => {
    const data = createInitialVaultData();
    const profileId = data.jobProfiles[1]!.id;
    data.answers.push(
      {
        id: newId("answer"),
        question: "请说明求职动机",
        answer: "公共答案",
        scope: "common",
        source: "user",
        updatedAt: new Date().toISOString()
      },
      {
        id: newId("answer"),
        question: "请说明求职动机",
        answer: "Agent 方向答案",
        scope: "profile",
        profileId,
        source: "user",
        updatedAt: new Date().toISOString()
      }
    );
    const [item] = buildFillPlan(
      snapshot([field({ tag: "textarea", type: "textarea", label: "请说明求职动机" })]),
      data,
      profileId
    );
    // The built-in profile narrative is empty, so the answer library supplies the value.
    expect(item?.value).toBe("Agent 方向答案");
    expect(item?.source).toBe("answer");
  });

  it("recommends the Agent profile from JD keywords", () => {
    const data = createInitialVaultData();
    const results = recommendProfiles(snapshot([]), data);
    expect(data.jobProfiles.find((item) => item.id === results[0]?.profileId)?.name).toBe(
      "Agent 开发岗位"
    );
    expect(results[0]?.matchedKeywords).toContain("agent");
  });
});
