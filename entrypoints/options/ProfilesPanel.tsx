import { useEffect, useMemo, useState } from "react";
import { createJobProfile, newId } from "../../src/core/defaults";
import type { VaultData } from "../../src/core/model";
import { ensurePrimaryEducation } from "../../src/core/profile-utils";

interface Props {
  data: VaultData;
  busy: boolean;
  save: (update: (draft: VaultData) => void | VaultData) => Promise<VaultData>;
}

const PERSONAL_FIELDS = [
  ["fullNameZh", "中文姓名", "Chinese name"],
  ["fullNameEn", "英文姓名", "English name"],
  ["phone", "手机号", "Mobile"],
  ["email", "邮箱", "Email"],
  ["gender", "性别", "Gender"],
  ["birthDate", "出生日期", "Birth date"],
  ["nationality", "国籍", "Nationality"],
  ["ethnicity", "民族", "Ethnicity"],
  ["politicalStatus", "政治面貌", "Political status"],
  ["nativePlace", "籍贯", "Native place"],
  ["hometown", "生源地", "Place of origin"],
  ["currentCity", "现居城市", "Current city"],
  ["hukouLocation", "户籍所在地（高敏感）", "Registered residence (sensitive)"],
  ["healthStatus", "健康状况（高敏感）", "Health status (sensitive)"],
  ["idNumber", "身份证号（高敏感）", "ID number (sensitive)"],
  ["address", "详细地址（高敏感）", "Address (sensitive)"],
  ["postalCode", "邮编", "Postal code"],
  ["wechat", "微信", "WeChat"],
  ["website", "个人主页 / GitHub", "Website / GitHub"]
] as const;

export default function ProfilesPanel({ data, busy, save }: Props) {
  const [draft, setDraft] = useState(() => structuredClone(data));
  const [saved, setSaved] = useState(false);
  useEffect(() => setDraft(structuredClone(data)), [data]);

  const activeProfile = useMemo(
    () =>
      draft.jobProfiles.find((item) => item.id === draft.activeProfileId) ?? draft.jobProfiles[0],
    [draft]
  );
  const primaryEducation = draft.commonProfile.education[0];
  const locale = draft.settings.locale;

  const commit = async () => {
    await save(() => draft);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const updatePersonal = (key: keyof typeof draft.commonProfile.personal, value: string) => {
    setDraft((current) => {
      const next = structuredClone(current);
      next.commonProfile.personal[key] = value;
      return next;
    });
  };

  const updateProfile = (key: string, value: string | string[]) => {
    if (!activeProfile) return;
    setDraft((current) => {
      const next = structuredClone(current);
      const profile = next.jobProfiles.find((item) => item.id === activeProfile.id)!;
      (profile as unknown as Record<string, unknown>)[key] = value;
      profile.updatedAt = new Date().toISOString();
      return next;
    });
  };

  const updateEducation = (key: string, value: string, educationIndex = 0) => {
    setDraft((current) => {
      const next = structuredClone(current);
      ensurePrimaryEducation(next);
      (next.commonProfile.education[educationIndex] as unknown as Record<string, string>)[key] =
        value;
      return next;
    });
  };

  const updateExperience = (experienceId: string, key: string, value: string) => {
    setDraft((current) => {
      const next = structuredClone(current);
      const experience = next.commonProfile.experiences.find((item) => item.id === experienceId);
      if (experience) (experience as unknown as Record<string, string>)[key] = value;
      return next;
    });
  };

  const updateStringList = (
    key: "skills" | "languages" | "awards" | "certificates" | "publications" | "patents",
    value: string
  ) => {
    setDraft((current) => {
      const next = structuredClone(current);
      next.commonProfile[key] = value
        .split(/\n|[,，]/)
        .map((item) => item.trim())
        .filter(Boolean);
      return next;
    });
  };

  return (
    <>
      <div className="page-heading">
        <h2>{locale === "en" ? "Profiles" : "求职档案"}</h2>
        <p>
          {locale === "en"
            ? "Shared facts live in the common profile. Direction-specific content stays in each job profile."
            : "公共事实只维护一份；方向性描述、偏好和简历附件保存在各求职档案中。"}
        </p>
      </div>

      <section className="card">
        <div className="section-title">
          <div>
            <h3>公共基本信息 / Common information</h3>
            <p>标记为高敏感的字段不会被默认勾选填写。</p>
          </div>
        </div>
        <div className="grid three">
          {PERSONAL_FIELDS.map(([key, zh, en]) => (
            <label className="field" key={key}>
              <span>{locale === "en" ? en : zh}</span>
              <input
                type={key === "birthDate" ? "date" : "text"}
                value={draft.commonProfile.personal[key]}
                onChange={(event) => updatePersonal(key, event.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <h3>教育经历 / Education</h3>
            <p>第一项作为最高/当前学历供通用引擎使用，专用适配器可按页面分组填写全部经历。</p>
          </div>
          <button
            className="button small"
            onClick={() => {
              setDraft((current) => {
                const next = structuredClone(current);
                const nowId = newId("education");
                next.commonProfile.education.push({
                  id: nowId,
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
                return next;
              });
            }}
          >
            添加教育经历
          </button>
        </div>
        {primaryEducation && (
          <div className="grid three">
            {(
              [
                ["school", "学校"],
                ["schoolEn", "学校英文名"],
                ["degree", "学历/学位"],
                ["major", "专业"],
                ["majorEn", "专业英文名"],
                ["startDate", "入学日期"],
                ["endDate", "毕业日期"],
                ["gpa", "GPA"],
                ["rank", "成绩排名"]
              ] as const
            ).map(([key, label]) => (
              <label className="field" key={key}>
                <span>{label}</span>
                <input
                  type={key.endsWith("Date") ? "date" : "text"}
                  value={(primaryEducation as unknown as Record<string, string>)[key] ?? ""}
                  onChange={(event) => updateEducation(key, event.target.value)}
                />
              </label>
            ))}
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span>主修课程</span>
              <textarea
                value={primaryEducation.courses}
                onChange={(event) => updateEducation("courses", event.target.value)}
              />
            </label>
          </div>
        )}
        {draft.commonProfile.education.slice(1).map((education, offset) => {
          const educationIndex = offset + 1;
          return (
            <div
              key={education.id}
              style={{ borderTop: "1px solid var(--line)", marginTop: 20, paddingTop: 18 }}
            >
              <div className="section-title">
                <div>
                  <h3>教育经历 {educationIndex + 1}</h3>
                  <p>{education.school || "尚未填写学校"}</p>
                </div>
                <button
                  className="button danger small"
                  onClick={() =>
                    setDraft((current) => {
                      const next = structuredClone(current);
                      next.commonProfile.education = next.commonProfile.education.filter(
                        (item) => item.id !== education.id
                      );
                      return next;
                    })
                  }
                >
                  删除
                </button>
              </div>
              <div className="grid three">
                {(
                  [
                    ["school", "学校"],
                    ["schoolEn", "学校英文名"],
                    ["degree", "学历/学位"],
                    ["major", "专业"],
                    ["majorEn", "专业英文名"],
                    ["startDate", "入学日期"],
                    ["endDate", "毕业日期"],
                    ["gpa", "GPA"],
                    ["rank", "成绩排名"]
                  ] as const
                ).map(([key, label]) => (
                  <label className="field" key={key}>
                    <span>{label}</span>
                    <input
                      type={key.endsWith("Date") ? "date" : "text"}
                      value={(education as unknown as Record<string, string>)[key] ?? ""}
                      onChange={(event) => updateEducation(key, event.target.value, educationIndex)}
                    />
                  </label>
                ))}
                <label className="field" style={{ gridColumn: "1 / -1" }}>
                  <span>主修课程</span>
                  <textarea
                    value={education.courses}
                    onChange={(event) =>
                      updateEducation("courses", event.target.value, educationIndex)
                    }
                  />
                </label>
              </div>
            </div>
          );
        })}
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <h3>实习、项目与科研经历 / Experience</h3>
            <p>经历事实存入公共库；每个求职方向可决定是否包含该经历。</p>
          </div>
          <button
            className="button small"
            onClick={() =>
              setDraft((current) => {
                const next = structuredClone(current);
                const id = newId("experience");
                next.commonProfile.experiences.push({
                  id,
                  type: "project",
                  organization: "",
                  title: "",
                  startDate: "",
                  endDate: "",
                  description: ""
                });
                for (const profile of next.jobProfiles) profile.includedExperienceIds.push(id);
                return next;
              })
            }
          >
            添加经历
          </button>
        </div>
        {draft.commonProfile.experiences.length === 0 && (
          <div className="empty-state">尚未添加经历</div>
        )}
        {draft.commonProfile.experiences.map((experience) => (
          <div
            key={experience.id}
            style={{ borderTop: "1px solid var(--line)", padding: "16px 0" }}
          >
            <div className="grid three">
              <label className="field">
                <span>类型</span>
                <select
                  value={experience.type}
                  onChange={(event) => updateExperience(experience.id, "type", event.target.value)}
                >
                  <option value="internship">实习</option>
                  <option value="work">工作</option>
                  <option value="project">项目</option>
                  <option value="research">科研</option>
                </select>
              </label>
              <label className="field">
                <span>单位/组织</span>
                <input
                  value={experience.organization}
                  onChange={(event) =>
                    updateExperience(experience.id, "organization", event.target.value)
                  }
                />
              </label>
              <label className="field">
                <span>职位/项目名称</span>
                <input
                  value={experience.title}
                  onChange={(event) => updateExperience(experience.id, "title", event.target.value)}
                />
              </label>
              <label className="field">
                <span>开始日期</span>
                <input
                  type="month"
                  value={experience.startDate}
                  onChange={(event) =>
                    updateExperience(experience.id, "startDate", event.target.value)
                  }
                />
              </label>
              <label className="field">
                <span>结束日期</span>
                <input
                  type="month"
                  value={experience.endDate}
                  onChange={(event) =>
                    updateExperience(experience.id, "endDate", event.target.value)
                  }
                />
              </label>
              <label className="field" style={{ justifyContent: "end" }}>
                <span>当前档案是否包含</span>
                <label className="button small">
                  <input
                    type="checkbox"
                    style={{ width: "auto", minHeight: "auto", marginRight: 7 }}
                    checked={activeProfile?.includedExperienceIds.includes(experience.id) ?? false}
                    disabled={!activeProfile}
                    onChange={(event) => {
                      if (!activeProfile) return;
                      setDraft((current) => {
                        const next = structuredClone(current);
                        const profile = next.jobProfiles.find(
                          (item) => item.id === activeProfile.id
                        )!;
                        profile.includedExperienceIds = event.target.checked
                          ? [...new Set([...profile.includedExperienceIds, experience.id])]
                          : profile.includedExperienceIds.filter((id) => id !== experience.id);
                        return next;
                      });
                    }}
                  />
                  {activeProfile?.name ?? "未选择档案"}
                </label>
              </label>
              <label className="field" style={{ gridColumn: "1 / -1" }}>
                <span>公共事实描述</span>
                <textarea
                  value={experience.description}
                  onChange={(event) =>
                    updateExperience(experience.id, "description", event.target.value)
                  }
                />
              </label>
              {activeProfile && (
                <label className="field" style={{ gridColumn: "1 / -1" }}>
                  <span>{activeProfile.name}的方向性表述（留空则使用公共事实描述）</span>
                  <textarea
                    value={activeProfile.experienceOverrides[experience.id] ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDraft((current) => {
                        const next = structuredClone(current);
                        const profile = next.jobProfiles.find(
                          (item) => item.id === activeProfile.id
                        )!;
                        if (value) profile.experienceOverrides[experience.id] = value;
                        else delete profile.experienceOverrides[experience.id];
                        return next;
                      });
                    }}
                  />
                </label>
              )}
            </div>
            <div className="button-row end">
              <button
                className="button danger small"
                onClick={() =>
                  setDraft((current) => {
                    const next = structuredClone(current);
                    next.commonProfile.experiences = next.commonProfile.experiences.filter(
                      (item) => item.id !== experience.id
                    );
                    for (const profile of next.jobProfiles) {
                      profile.includedExperienceIds = profile.includedExperienceIds.filter(
                        (id) => id !== experience.id
                      );
                      delete profile.experienceOverrides[experience.id];
                    }
                    return next;
                  })
                }
              >
                删除经历
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <h3>技能与成果 / Skills and achievements</h3>
        <div className="grid two">
          {(
            [
              ["skills", "专业技能"],
              ["languages", "语言能力"],
              ["awards", "奖项"],
              ["certificates", "证书"],
              ["publications", "论文"],
              ["patents", "专利"]
            ] as const
          ).map(([key, label]) => (
            <label className="field" key={key}>
              <span>{label}（每行一项）</span>
              <textarea
                value={draft.commonProfile[key].join("\n")}
                onChange={(event) => updateStringList(key, event.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <h3>求职方向 / Job profiles</h3>
            <p>填写前插件会根据职位名称和 JD 推荐档案，但始终由你确认。</p>
          </div>
          <button
            className="button small"
            onClick={() => {
              setDraft((current) => {
                const next = structuredClone(current);
                const profile = createJobProfile();
                next.jobProfiles.push(profile);
                next.activeProfileId = profile.id;
                return next;
              });
            }}
          >
            新建档案
          </button>
        </div>
        <div className="button-row" style={{ marginBottom: 16 }}>
          {draft.jobProfiles.map((profile) => (
            <button
              key={profile.id}
              className={`button small ${profile.id === activeProfile?.id ? "primary" : ""}`}
              onClick={() => setDraft((current) => ({ ...current, activeProfileId: profile.id }))}
            >
              {profile.name}
            </button>
          ))}
        </div>
        {activeProfile && (
          <div className="grid two">
            <label className="field">
              <span>档案名称</span>
              <input
                value={activeProfile.name}
                onChange={(event) => updateProfile("name", event.target.value)}
              />
            </label>
            <label className="field">
              <span>目标方向</span>
              <input
                value={activeProfile.direction}
                onChange={(event) => updateProfile("direction", event.target.value)}
              />
            </label>
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span>识别关键词（逗号分隔）</span>
              <input
                value={activeProfile.keywords.join(", ")}
                onChange={(event) =>
                  updateProfile(
                    "keywords",
                    event.target.value
                      .split(/[,，]/)
                      .map((item) => item.trim())
                      .filter(Boolean)
                  )
                }
              />
            </label>
            <label className="field">
              <span>默认简历附件</span>
              <select
                value={activeProfile.defaultResumeAssetId ?? ""}
                onChange={(event) =>
                  updateProfile("defaultResumeAssetId", event.target.value || (undefined as never))
                }
              >
                <option value="">未选择</option>
                {draft.assets
                  .filter((asset) => asset.category === "resume")
                  .map((asset) => (
                    <option value={asset.id} key={asset.id}>
                      {asset.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>期望地点（逗号分隔）</span>
              <input
                value={activeProfile.desiredLocations.join(", ")}
                onChange={(event) =>
                  updateProfile(
                    "desiredLocations",
                    event.target.value
                      .split(/[,，]/)
                      .map((item) => item.trim())
                      .filter(Boolean)
                  )
                }
              />
            </label>
            <label className="field">
              <span>期望薪资（敏感）</span>
              <input
                value={activeProfile.expectedSalary}
                onChange={(event) => updateProfile("expectedSalary", event.target.value)}
              />
            </label>
            <label className="field">
              <span>可到岗日期（敏感）</span>
              <input
                type="date"
                value={activeProfile.availableDate}
                onChange={(event) => updateProfile("availableDate", event.target.value)}
              />
            </label>
            {(
              [
                ["willingToTravel", "是否接受出差（敏感）"],
                ["willingToRelocate", "是否接受异地（敏感）"],
                ["acceptAdjustment", "是否接受调剂（敏感）"]
              ] as const
            ).map(([key, label]) => (
              <label className="field" key={key}>
                <span>{label}</span>
                <select
                  value={(activeProfile as unknown as Record<string, string>)[key]}
                  onChange={(event) => updateProfile(key, event.target.value)}
                >
                  <option value="">未设置</option>
                  <option value="是">是</option>
                  <option value="否">否</option>
                  <option value="视情况而定">视情况而定</option>
                </select>
              </label>
            ))}
            {(
              [
                ["selfEvaluation", "自我评价"],
                ["motivation", "求职动机"],
                ["strengths", "个人优势"],
                ["weaknesses", "个人不足"],
                ["skillSummary", "技能概述"]
              ] as const
            ).map(([key, label]) => (
              <label className="field" key={key}>
                <span>{label}</span>
                <textarea
                  value={(activeProfile as unknown as Record<string, string>)[key]}
                  onChange={(event) => updateProfile(key, event.target.value)}
                />
              </label>
            ))}
            <div className="button-row" style={{ gridColumn: "1 / -1" }}>
              <button
                className="button danger small"
                disabled={draft.jobProfiles.length <= 1}
                onClick={() => {
                  if (!confirm(`删除求职档案“${activeProfile.name}”？相关附件不会被删除。`)) return;
                  setDraft((current) => {
                    const next = structuredClone(current);
                    next.jobProfiles = next.jobProfiles.filter(
                      (item) => item.id !== activeProfile.id
                    );
                    next.activeProfileId = next.jobProfiles[0]?.id;
                    return next;
                  });
                }}
              >
                删除当前档案
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="button-row end">
        {saved && <span className="success-text">已加密保存</span>}
        <button className="button primary" disabled={busy} onClick={() => void commit()}>
          {busy ? "保存中…" : "保存档案"}
        </button>
      </div>
    </>
  );
}
