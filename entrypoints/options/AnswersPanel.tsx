import { useState } from "react";
import { newId } from "../../src/core/defaults";
import type { AnswerEntry, VaultData } from "../../src/core/model";

interface Props {
  data: VaultData;
  busy: boolean;
  save: (update: (draft: VaultData) => void | VaultData) => Promise<VaultData>;
}

export default function AnswersPanel({ data, busy, save }: Props) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [scope, setScope] = useState<AnswerEntry["scope"]>("common");
  const [profileId, setProfileId] = useState(data.activeProfileId ?? "");
  const [company, setCompany] = useState("");

  const add = async () => {
    if (!question.trim() || !answer.trim()) return;
    const entry: AnswerEntry = {
      id: newId("answer"),
      question: question.trim(),
      answer: answer.trim(),
      scope,
      profileId: scope === "profile" ? profileId : undefined,
      company: scope === "company" ? company.trim() : undefined,
      source: "user",
      updatedAt: new Date().toISOString()
    };
    await save((draft) => {
      draft.answers.unshift(entry);
    });
    setQuestion("");
    setAnswer("");
  };

  return (
    <>
      <div className="page-heading">
        <h2>答案库 / Answer library</h2>
        <p>公司答案优先于求职方向答案，求职方向答案优先于公共答案。</p>
      </div>
      <section className="card">
        <h3>添加常见问题</h3>
        <div className="grid two">
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span>问题</span>
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="例如：请简述你的求职动机"
            />
          </label>
          <label className="field">
            <span>适用范围</span>
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as AnswerEntry["scope"])}
            >
              <option value="common">公共</option>
              <option value="profile">求职方向</option>
              <option value="company">公司</option>
            </select>
          </label>
          {scope === "profile" && (
            <label className="field">
              <span>求职方向</span>
              <select value={profileId} onChange={(event) => setProfileId(event.target.value)}>
                {data.jobProfiles.map((profile) => (
                  <option value={profile.id} key={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {scope === "company" && (
            <label className="field">
              <span>公司名称或域名关键词</span>
              <input
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="例如：华为 / huawei"
              />
            </label>
          )}
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span>答案</span>
            <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} />
          </label>
        </div>
        <div className="button-row end" style={{ marginTop: 12 }}>
          <button
            className="button primary"
            disabled={
              busy || !question.trim() || !answer.trim() || (scope === "company" && !company.trim())
            }
            onClick={() => void add()}
          >
            保存答案
          </button>
        </div>
      </section>
      <section className="card">
        <h3>已保存答案</h3>
        {data.answers.length === 0 && <div className="empty-state">尚未添加答案</div>}
        {data.answers.map((entry) => (
          <div className="list-item" key={entry.id}>
            <div>
              <h4>{entry.question}</h4>
              <p>{entry.answer}</p>
              <p>
                {entry.scope === "common"
                  ? "公共"
                  : entry.scope === "profile"
                    ? `方向：${data.jobProfiles.find((item) => item.id === entry.profileId)?.name ?? "已删除"}`
                    : `公司：${entry.company}`}
                {entry.source === "ai" ? " · AI 候选经确认" : " · 用户维护"}
              </p>
            </div>
            <button
              className="button danger small"
              onClick={() =>
                void save((draft) => {
                  draft.answers = draft.answers.filter((item) => item.id !== entry.id);
                })
              }
            >
              删除
            </button>
          </div>
        ))}
      </section>
    </>
  );
}
