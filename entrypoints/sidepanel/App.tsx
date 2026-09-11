import { useCallback, useEffect, useMemo, useState } from "react";
import { browser } from "wxt/browser";
import { detectSite } from "../../src/adapters/registry";
import { getEffectiveAiKey, requestJobAnalysis, type JobAnalysis } from "../../src/core/ai";
import { readAssetBytes } from "../../src/core/assets";
import { bytesToBase64 } from "../../src/core/crypto";
import { newId } from "../../src/core/defaults";
import { FIELD_DICTIONARY } from "../../src/core/field-dictionary";
import { buildFillPlan, normalizeText, recommendProfiles } from "../../src/core/matcher";
import type {
  ActiveTabInfo,
  BackgroundRequest,
  BackgroundResponse,
  PageFillResult
} from "../../src/core/messages";
import type {
  AnswerEntry,
  AssetMeta,
  FillPlanItem,
  PageField,
  PageSnapshot,
  VaultData
} from "../../src/core/model";
import { VaultGate } from "../../src/ui/VaultGate";
import { useVault } from "../../src/ui/useVault";

const SUBMISSION_CANDIDATE_KEY = "resumepilot.submission-candidate";

interface SubmissionCandidate {
  url: string;
  title: string;
  detectedAt: string;
  buttonText?: string;
}

interface AttachmentPlan {
  field: PageField;
  asset?: AssetMeta;
  selected: boolean;
}

async function backgroundRequest<T>(message: BackgroundRequest): Promise<T> {
  const response = (await browser.runtime.sendMessage(message)) as BackgroundResponse<T>;
  if (!response?.ok) throw new Error(response?.error || "扩展后台操作失败");
  return response.data as T;
}

function suggestedAsset(
  field: PageField,
  data: VaultData,
  profileId: string
): AssetMeta | undefined {
  const label = normalizeText(`${field.label} ${field.name} ${field.placeholder}`);
  const profile = data.jobProfiles.find((item) => item.id === profileId);
  const categories: Array<[RegExp, AssetMeta["category"]]> = [
    [/简历|resume|cv/i, "resume"],
    [/成绩单|transcript/i, "transcript"],
    [/证件照|头像|portrait|headshot/i, "portrait"],
    [/生活照|photo/i, "photo"],
    [/学位|学历|degree|diploma/i, "degree"],
    [/获奖|award/i, "award"],
    [/专利|patent/i, "patent"],
    [/论文|publication|paper/i, "publication"],
    [/证书|certificate/i, "certificate"]
  ];
  const category = categories.find(([pattern]) => pattern.test(label))?.[1] ?? "resume";
  if (category === "resume" && profile?.defaultResumeAssetId) {
    return data.assets.find((asset) => asset.id === profile.defaultResumeAssetId);
  }
  return data.assets.find(
    (asset) =>
      asset.category === category &&
      (!asset.profileIds.length || asset.profileIds.includes(profileId))
  );
}

function siteCompany(snapshot: PageSnapshot): string {
  const hostname = new URL(snapshot.url).hostname.replace(/^www\./, "");
  const titlePart = snapshot.title.split(/[|｜—_-]/)[0]?.trim();
  return titlePart && titlePart.length <= 30 ? titlePart : hostname;
}

export default function App() {
  const vault = useVault();
  const [snapshot, setSnapshot] = useState<PageSnapshot>();
  const [profileId, setProfileId] = useState("");
  const [profileConfirmed, setProfileConfirmed] = useState(false);
  const [plan, setPlan] = useState<FillPlanItem[]>([]);
  const [attachments, setAttachments] = useState<AttachmentPlan[]>([]);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState<JobAnalysis>();
  const [submissionCandidate, setSubmissionCandidate] = useState<SubmissionCandidate>();
  const [answerScopes, setAnswerScopes] = useState<Record<string, AnswerEntry["scope"]>>({});

  const scan = useCallback(async () => {
    setWorking(true);
    setMessage("");
    setAnalysis(undefined);
    try {
      const next = await backgroundRequest<PageSnapshot>({ type: "RP_SCAN_ACTIVE_TAB" });
      setSnapshot(next);
      setProfileConfirmed(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法扫描当前页面");
    } finally {
      setWorking(false);
    }
  }, []);

  const authorizeAndScan = async () => {
    setWorking(true);
    setMessage("");
    try {
      const tab = await backgroundRequest<ActiveTabInfo>({ type: "RP_GET_ACTIVE_TAB" });
      const originPattern = `${new URL(tab.url).origin}/*`;
      const granted = await browser.permissions.request({ origins: [originPattern] });
      if (!granted) throw new Error("未授予当前招聘网站权限");
      await scan();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法授权当前网站");
    } finally {
      setWorking(false);
    }
  };

  useEffect(() => {
    if (vault.state === "unlocked") void scan();
  }, [scan, vault.state]);

  useEffect(() => {
    if (!snapshot || !vault.data) return;
    const recommendations = recommendProfiles(snapshot, vault.data);
    const nextProfile =
      recommendations[0]?.score && recommendations[0].score > 0
        ? recommendations[0].profileId
        : (vault.data.activeProfileId ?? vault.data.jobProfiles[0]?.id ?? "");
    setProfileId(nextProfile);
  }, [snapshot, vault.data]);

  useEffect(() => {
    if (!snapshot || !vault.data || !profileId) return;
    setPlan(buildFillPlan(snapshot, vault.data, profileId));
    setAttachments(
      snapshot.fields
        .filter((field) => field.type === "file")
        .map((field) => {
          const asset = suggestedAsset(field, vault.data!, profileId);
          return { field, asset, selected: Boolean(asset) };
        })
    );
  }, [profileId, snapshot, vault.data]);

  useEffect(() => {
    const readCandidate = async () => {
      const result = await browser.storage.session.get(SUBMISSION_CANDIDATE_KEY);
      setSubmissionCandidate(result[SUBMISSION_CANDIDATE_KEY] as SubmissionCandidate | undefined);
    };
    void readCandidate();
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "session" && changes[SUBMISSION_CANDIDATE_KEY]) void readCandidate();
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  const recommendations = useMemo(
    () => (snapshot && vault.data ? recommendProfiles(snapshot, vault.data) : []),
    [snapshot, vault.data]
  );
  const recommendation = recommendations.find((item) => item.profileId === profileId);
  const activeProfile = vault.data?.jobProfiles.find((item) => item.id === profileId);
  const detectedSite = snapshot ? detectSite(snapshot.url) : undefined;
  const unresolvedRequired = plan.filter(
    (item) =>
      item.field.required &&
      !item.field.value &&
      !(
        item.selected &&
        item.value &&
        (item.sensitiveLevel === "normal" || item.confirmedSensitive)
      )
  );

  const updatePlan = (fieldId: string, update: Partial<FillPlanItem>) => {
    setPlan((current) =>
      current.map((item) => (item.field.id === fieldId ? { ...item, ...update } : item))
    );
  };

  const recordFilling = async () => {
    if (!snapshot || !vault.data || !profileId) return;
    const url = new URL(snapshot.url);
    await vault.save((draft) => {
      const existing = draft.applications.find(
        (item) => item.url === snapshot.url && item.profileId === profileId
      );
      if (existing) return;
      draft.applications.unshift({
        id: newId("application"),
        company: siteCompany(snapshot),
        role: snapshot.heading || snapshot.title,
        url: snapshot.url,
        hostname: url.hostname,
        profileId,
        status: "filling",
        startedAt: new Date().toISOString(),
        note: ""
      });
    });
  };

  const executeFill = async (navigate: boolean) => {
    if (!profileConfirmed) {
      setMessage("请先确认本页使用的求职档案。");
      return;
    }
    if (navigate && unresolvedRequired.length) {
      setMessage(`仍有 ${unresolvedRequired.length} 个必填字段未解决，已阻止进入下一步。`);
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      const items = plan
        .filter(
          (item) =>
            item.selected &&
            item.value &&
            (item.sensitiveLevel === "normal" || item.confirmedSensitive)
        )
        .map((item) => ({ fieldId: item.field.id, value: item.value! }));
      const fileItems = [] as Array<{
        fieldId: string;
        fileName: string;
        mimeType: string;
        bytesBase64: string;
      }>;
      for (const item of attachments.filter((candidate) => candidate.selected && candidate.asset)) {
        const bytes = await readAssetBytes(item.asset!.id);
        fileItems.push({
          fieldId: item.field.id,
          fileName: item.asset!.name,
          mimeType: item.asset!.mimeType,
          bytesBase64: bytesToBase64(bytes)
        });
      }

      const failures: string[] = [];
      if (items.length) {
        const result = await backgroundRequest<PageFillResult>({
          type: "RP_FILL_ACTIVE_TAB",
          items
        });
        failures.push(...result.failed.map((item) => item.reason));
      }
      if (fileItems.length) {
        const result = await backgroundRequest<PageFillResult>({
          type: "RP_UPLOAD_ACTIVE_TAB",
          items: fileItems
        });
        failures.push(...result.failed.map((item) => item.reason));
      }
      await recordFilling();
      if (failures.length) {
        setMessage(
          `完成部分填写，但有 ${failures.length} 项失败：${[...new Set(failures)].join("；")}`
        );
        return;
      }
      if (navigate) {
        const result = await backgroundRequest<{
          clicked: boolean;
          text?: string;
          reason?: string;
        }>({ type: "RP_GO_NEXT" });
        setMessage(
          result.clicked
            ? `已点击“${result.text}”。页面更新后请重新扫描并确认。`
            : (result.reason ?? "未进入下一步")
        );
      } else {
        setMessage(
          `已填写 ${items.length} 个字段并处理 ${fileItems.length} 个附件。请在页面中复核。`
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "填写失败");
    } finally {
      setWorking(false);
    }
  };

  const saveRule = async (item: FillPlanItem, targetPath: string) => {
    if (!snapshot || !targetPath) return;
    const url = new URL(snapshot.url);
    await vault.save((draft) => {
      draft.siteRules = draft.siteRules.filter(
        (rule) => !(rule.hostname === url.hostname && rule.fingerprint === item.field.fingerprint)
      );
      draft.siteRules.push({
        id: newId("rule"),
        hostname: url.hostname,
        pathPattern: url.pathname,
        fingerprint: item.field.fingerprint,
        targetPath,
        updatedAt: new Date().toISOString()
      });
    });
    setMessage("字段映射已在本地记住。");
  };

  const saveAnswer = async (item: FillPlanItem) => {
    if (!snapshot || !item.value?.trim()) return;
    const scope = answerScopes[item.field.id] ?? "profile";
    await vault.save((draft) => {
      draft.answers.unshift({
        id: newId("answer"),
        question: item.field.label || item.field.placeholder || item.field.name,
        answer: item.value!.trim(),
        scope,
        profileId: scope === "profile" ? profileId : undefined,
        company: scope === "company" ? new URL(snapshot.url).hostname : undefined,
        source: "user",
        updatedAt: new Date().toISOString()
      });
    });
    setMessage("答案已保存，下次遇到相似问题会优先匹配。");
  };

  const analyze = async () => {
    if (!snapshot || !vault.data) return;
    if (!vault.data.aiConfig.enabled) {
      setMessage("请先在设置中启用并配置 AI 接口。");
      return;
    }
    if (!snapshot.jdText) {
      setMessage("当前页面没有识别到可用的 JD 文本。");
      return;
    }
    const description = snapshot.jdText.slice(0, 8_000);
    const preview = `即将发送：当前 JD（${description.length} 字）、${vault.data.jobProfiles.length} 个档案的方向/关键词/技能概述、公共技能。不会发送身份证、地址、健康信息或附件。`;
    if (!confirm(`${preview}\n\n是否继续？`)) return;
    setWorking(true);
    setMessage("");
    try {
      const apiKey = await getEffectiveAiKey(vault.data.aiConfig.encryptedApiKey);
      if (!apiKey) throw new Error("当前会话没有可用的 API Key，请在设置中填写");
      const result = await requestJobAnalysis(
        {
          baseUrl: vault.data.aiConfig.baseUrl,
          apiKey,
          model: vault.data.aiConfig.model
        },
        {
          jobDescription: description,
          profiles: vault.data.jobProfiles.map((profile) => ({
            name: profile.name,
            direction: profile.direction,
            keywords: profile.keywords,
            facts: [profile.skillSummary, ...vault.data!.commonProfile.skills]
              .filter(Boolean)
              .join("；")
          }))
        }
      );
      setAnalysis(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 分析失败");
    } finally {
      setWorking(false);
    }
  };

  const confirmSubmission = async () => {
    if (!submissionCandidate || !vault.data || !profileId) return;
    const candidateUrl = submissionCandidate.url;
    await vault.save((draft) => {
      let entry = draft.applications.find(
        (item) => item.url === candidateUrl && item.profileId === profileId
      );
      if (!entry) {
        const url = new URL(candidateUrl);
        entry = {
          id: newId("application"),
          company: snapshot ? siteCompany(snapshot) : url.hostname,
          role: snapshot?.heading || submissionCandidate.title,
          url: candidateUrl,
          hostname: url.hostname,
          profileId,
          status: "filling",
          startedAt: submissionCandidate.detectedAt,
          note: ""
        };
        draft.applications.unshift(entry);
      }
      entry.status = "submitted";
      entry.submittedAt = new Date().toISOString();
    });
    await browser.storage.session.remove(SUBMISSION_CANDIDATE_KEY);
    setSubmissionCandidate(undefined);
    setMessage("已按你的确认记录为“已投递”。");
  };

  const dismissSubmission = async () => {
    await browser.storage.session.remove(SUBMISSION_CANDIDATE_KEY);
    setSubmissionCandidate(undefined);
  };

  return (
    <VaultGate
      state={vault.state}
      busy={vault.busy}
      error={vault.error}
      onCreate={vault.create}
      onUnlock={vault.unlock}
      compact
    >
      {vault.data && (
        <div className="sidepanel-root">
          <header className="topbar">
            <div className="brand">
              <span className="brand-mark">RP</span>
              <div>
                <h1>ResumePilot</h1>
                <p>填写前预览，提交由你决定</p>
              </div>
            </div>
            <button className="button small" onClick={() => void scan()} disabled={working}>
              重新扫描
            </button>
          </header>

          {submissionCandidate && (
            <section className="card" style={{ borderColor: "#f0c870" }}>
              <span className="pill warning">检测到提交操作</span>
              <p className="small-text">ResumePilot 没有代你点击提交。你是否已经成功完成投递？</p>
              <div className="button-row">
                <button className="button primary small" onClick={() => void confirmSubmission()}>
                  确认已投递
                </button>
                <button className="button small" onClick={() => void dismissSubmission()}>
                  暂不记录
                </button>
              </div>
            </section>
          )}

          {snapshot ? (
            <>
              <section className="card">
                <span className="pill success">{new URL(snapshot.url).hostname}</span>
                <h3 style={{ marginTop: 10, marginBottom: 5 }}>
                  {snapshot.heading || snapshot.title || "当前申请页面"}
                </h3>
                <p className="muted small-text" style={{ margin: 0 }}>
                  {snapshot.fields.length} 个可见字段 ·{" "}
                  {snapshot.jdText ? "已识别 JD" : "未识别 JD"}
                  {detectedSite
                    ? ` · ${detectedSite.name}（通用模式，待实站验证）`
                    : " · 未知网站（通用模式）"}
                </p>
              </section>

              <section className="card">
                <h3>1. 确认求职档案</h3>
                <label className="field">
                  <span>本页将使用</span>
                  <select
                    value={profileId}
                    onChange={(event) => {
                      setProfileId(event.target.value);
                      setProfileConfirmed(false);
                    }}
                  >
                    {vault.data.jobProfiles.map((profile) => (
                      <option value={profile.id} key={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </label>
                {recommendation && recommendation.reason !== "fallback" && (
                  <p className="small-text muted">
                    推荐依据：
                    {recommendation.reason === "site-default"
                      ? "该网站默认档案"
                      : recommendation.matchedKeywords.join("、")}
                  </p>
                )}
                <div className="button-row" style={{ marginTop: 10 }}>
                  <button
                    className={`button small ${profileConfirmed ? "" : "primary"}`}
                    onClick={() => {
                      setProfileConfirmed(true);
                      void vault.save((draft) => {
                        draft.activeProfileId = profileId;
                      });
                    }}
                  >
                    {profileConfirmed ? `已确认：${activeProfile?.name}` : "确认使用此档案"}
                  </button>
                  {profileConfirmed && snapshot && (
                    <button
                      className="button small"
                      onClick={() =>
                        void vault
                          .save((draft) => {
                            draft.settings.preferredProfileByHost[new URL(snapshot.url).hostname] =
                              profileId;
                          })
                          .then(() => setMessage("已设为该网站的默认求职档案。"))
                      }
                    >
                      记为该网站默认
                    </button>
                  )}
                  <button
                    className="button small"
                    disabled={working || !snapshot.jdText}
                    onClick={() => void analyze()}
                  >
                    AI 分析 JD
                  </button>
                </div>
              </section>

              {analysis && (
                <section className="card">
                  <div className="section-title">
                    <div>
                      <h3>AI 分析候选</h3>
                      <p>仅供参考，不会自动写入。</p>
                    </div>
                    <span className="pill">AI</span>
                  </div>
                  <p className="small-text">
                    <strong>推荐档案：</strong>
                    {analysis.recommendedProfileName || "未明确"}
                  </p>
                  <p className="small-text">
                    <strong>匹配点：</strong>
                    {analysis.matchedPoints.join("；") || "无"}
                  </p>
                  <p className="small-text">
                    <strong>缺失项：</strong>
                    {analysis.missingPoints.join("；") || "无"}
                  </p>
                  <p className="small-text">
                    <strong>建议突出：</strong>
                    {analysis.emphasisSuggestions.join("；") || "无"}
                  </p>
                </section>
              )}

              <section className="card">
                <div className="section-title">
                  <div>
                    <h3>2. 检查填写计划</h3>
                    <p>敏感项和已有内容默认不覆盖。</p>
                  </div>
                  <span className={`pill ${unresolvedRequired.length ? "warning" : "success"}`}>
                    {unresolvedRequired.length} 个必填待处理
                  </span>
                </div>
                {plan.length === 0 && (
                  <div className="empty-state">当前页面没有识别到可填写字段</div>
                )}
                {plan
                  .filter((item) => item.field.type !== "file")
                  .map((item) => (
                    <div className="field-plan" key={item.field.id}>
                      <div className="field-plan-head">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          disabled={!item.value}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            if (checked && item.sensitiveLevel !== "normal") {
                              const accepted = confirm(
                                `确认本次填写敏感字段“${item.field.label || item.field.name}”？\n\n候选值：${item.value}`
                              );
                              if (!accepted) return;
                              updatePlan(item.field.id, {
                                selected: true,
                                confirmedSensitive: true
                              });
                            } else {
                              updatePlan(item.field.id, { selected: checked });
                            }
                          }}
                        />
                        <span className="field-plan-label">
                          {item.field.label ||
                            item.field.placeholder ||
                            item.field.name ||
                            "未命名字段"}
                          {item.field.required ? " *" : ""}
                        </span>
                        {item.sensitiveLevel !== "normal" && (
                          <span
                            className={`pill ${item.sensitiveLevel === "high" ? "danger" : "warning"}`}
                          >
                            {item.sensitiveLevel === "high" ? "高敏感" : "敏感"}
                          </span>
                        )}
                        <span className={`pill ${item.source === "none" ? "warning" : ""}`}>
                          {item.source === "none"
                            ? "未匹配"
                            : `${Math.round(item.confidence * 100)}%`}
                        </span>
                      </div>
                      {item.field.value && (
                        <p className="small-text muted" style={{ marginLeft: 25 }}>
                          页面已有值，默认保留：{item.field.value.slice(0, 80)}
                        </p>
                      )}
                      <textarea
                        className="field-plan-value"
                        style={{ width: "calc(100% - 25px)", marginLeft: 25 }}
                        value={item.value ?? ""}
                        placeholder="未匹配：可在此输入本次候选值"
                        onChange={(event) =>
                          updatePlan(item.field.id, {
                            value: event.target.value,
                            selected:
                              Boolean(event.target.value) && item.sensitiveLevel === "normal"
                          })
                        }
                      />
                      {item.source === "none" && (
                        <div className="button-row" style={{ marginLeft: 25, marginTop: 7 }}>
                          <select
                            style={{ minHeight: 31, flex: 1 }}
                            defaultValue=""
                            onChange={(event) => {
                              if (event.target.value) void saveRule(item, event.target.value);
                            }}
                          >
                            <option value="">映射到档案字段…</option>
                            {FIELD_DICTIONARY.map((definition) => (
                              <option value={definition.path} key={definition.path}>
                                {definition.label}
                              </option>
                            ))}
                          </select>
                          {(item.field.type === "textarea" || item.field.tag === "textarea") &&
                            item.value && (
                              <>
                                <select
                                  style={{ minHeight: 31, width: "auto" }}
                                  value={answerScopes[item.field.id] ?? "profile"}
                                  onChange={(event) =>
                                    setAnswerScopes((current) => ({
                                      ...current,
                                      [item.field.id]: event.target.value as AnswerEntry["scope"]
                                    }))
                                  }
                                >
                                  <option value="common">公共</option>
                                  <option value="profile">当前方向</option>
                                  <option value="company">当前公司</option>
                                </select>
                                <button
                                  className="button small"
                                  onClick={() => void saveAnswer(item)}
                                >
                                  保存答案
                                </button>
                              </>
                            )}
                        </div>
                      )}
                    </div>
                  ))}
              </section>

              {attachments.length > 0 && (
                <section className="card">
                  <h3>3. 检查附件</h3>
                  {attachments.map((item) => (
                    <div className="field-plan" key={item.field.id}>
                      <div className="field-plan-head">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          disabled={!item.asset}
                          onChange={(event) =>
                            setAttachments((current) =>
                              current.map((candidate) =>
                                candidate.field.id === item.field.id
                                  ? { ...candidate, selected: event.target.checked }
                                  : candidate
                              )
                            )
                          }
                        />
                        <span className="field-plan-label">
                          {item.field.label || item.field.name || "附件上传"}
                        </span>
                      </div>
                      <select
                        style={{ margin: "7px 0 0 25px", width: "calc(100% - 25px)" }}
                        value={item.asset?.id ?? ""}
                        onChange={(event) =>
                          setAttachments((current) =>
                            current.map((candidate) =>
                              candidate.field.id === item.field.id
                                ? {
                                    ...candidate,
                                    asset: vault.data!.assets.find(
                                      (asset) => asset.id === event.target.value
                                    ),
                                    selected: Boolean(event.target.value)
                                  }
                                : candidate
                            )
                          )
                        }
                      >
                        <option value="">需要手动选择</option>
                        {vault.data!.assets.map((asset) => (
                          <option value={asset.id} key={asset.id}>
                            {asset.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                  <p className="small-text muted">
                    若网站阻止程序设置文件，插件会定位上传区并提示你手动完成。
                  </p>
                </section>
              )}

              <section className="card">
                <h3>{attachments.length ? "4" : "3"}. 执行</h3>
                {unresolvedRequired.length > 0 && (
                  <div className="notice warning">
                    必填项未解决时仍可填写已知字段，但不能自动进入下一步。
                  </div>
                )}
                <div className="button-row">
                  <button
                    className="button primary"
                    disabled={working || !profileConfirmed}
                    onClick={() => void executeFill(false)}
                  >
                    填写当前页
                  </button>
                  <button
                    className="button"
                    disabled={working || !profileConfirmed || unresolvedRequired.length > 0}
                    onClick={() => void executeFill(true)}
                  >
                    填写并进入下一步
                  </button>
                </div>
              </section>
            </>
          ) : (
            <section className="card">
              <div className="empty-state">
                点击“重新扫描”读取当前招聘页面。若页面跳转到了新域名，请按需授权该网站。
              </div>
              <div className="button-row" style={{ justifyContent: "center" }}>
                <button
                  className="button"
                  disabled={working}
                  onClick={() => void authorizeAndScan()}
                >
                  授权当前网站并扫描
                </button>
              </div>
            </section>
          )}

          {message && (
            <div className={`notice ${/失败|无法|阻止|没有|需要/.test(message) ? "warning" : ""}`}>
              {message}
            </div>
          )}
          <div className="button-row end">
            <button
              className="button ghost small"
              onClick={() => void browser.runtime.openOptionsPage()}
            >
              管理档案与设置
            </button>
            <button className="button ghost small" onClick={() => void vault.lock()}>
              锁定
            </button>
          </div>
        </div>
      )}
    </VaultGate>
  );
}
