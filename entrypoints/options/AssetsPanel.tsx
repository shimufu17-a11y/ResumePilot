import { useState } from "react";
import { deleteAssetBytes, readAssetBytes, saveAssetBytes } from "../../src/core/assets";
import { newId } from "../../src/core/defaults";
import type { AssetMeta, ResumeCandidate, VaultData } from "../../src/core/model";
import { applyResumeCandidates } from "../../src/core/profile-utils";

interface Props {
  data: VaultData;
  busy: boolean;
  save: (update: (draft: VaultData) => void | VaultData) => Promise<VaultData>;
}

const CATEGORIES: Array<[AssetMeta["category"], string]> = [
  ["resume", "简历"],
  ["portrait", "证件照"],
  ["photo", "生活照"],
  ["transcript", "成绩单"],
  ["degree", "学历/学位证明"],
  ["certificate", "证书"],
  ["award", "获奖证明"],
  ["publication", "论文材料"],
  ["patent", "专利材料"],
  ["other", "其他"]
];

export default function AssetsPanel({ data, busy, save }: Props) {
  const [category, setCategory] = useState<AssetMeta["category"]>("resume");
  const [profileId, setProfileId] = useState(data.activeProfileId ?? "");
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [candidates, setCandidates] = useState<ResumeCandidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<number>>(new Set());

  const upload = async (file: File) => {
    setProcessing(true);
    setMessage("");
    setCandidates([]);
    const id = newId("asset");
    try {
      await saveAssetBytes(id, new Uint8Array(await file.arrayBuffer()));
      const now = new Date().toISOString();
      const meta: AssetMeta = {
        id,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        category,
        profileIds: profileId ? [profileId] : [],
        tags: [],
        note: "",
        createdAt: now,
        updatedAt: now
      };
      await save((draft) => {
        draft.assets.push(meta);
        if (category === "resume" && profileId) {
          const profile = draft.jobProfiles.find((item) => item.id === profileId);
          if (profile && !profile.defaultResumeAssetId) profile.defaultResumeAssetId = id;
        }
      });

      if (category === "resume" && /\.(pdf|docx)$/i.test(file.name)) {
        const { deriveResumeCandidates, extractResumeText } =
          await import("../../src/core/resume-parser");
        const text = await extractResumeText(file);
        const parsed = deriveResumeCandidates(text);
        setCandidates(parsed);
        setSelectedCandidates(
          new Set(
            parsed
              .map((candidate, index) => (candidate.confidence >= 0.8 ? index : -1))
              .filter((index) => index >= 0)
          )
        );
        setMessage(
          parsed.length
            ? `已安全保存，并在本地解析出 ${parsed.length} 个候选字段。请确认后再写入档案。`
            : "已安全保存，但没有自动识别出结构化字段；你仍可手动维护档案。"
        );
      } else {
        setMessage("附件已加密保存到本地资料库。");
      }
    } catch (error) {
      await deleteAssetBytes(id).catch(() => undefined);
      setMessage(error instanceof Error ? error.message : "附件保存失败");
    } finally {
      setProcessing(false);
    }
  };

  const download = async (asset: AssetMeta) => {
    try {
      const bytes = await readAssetBytes(asset.id);
      const blob = new Blob([bytes.slice().buffer], { type: asset.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = asset.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法读取附件");
    }
  };

  const remove = async (asset: AssetMeta) => {
    if (!confirm(`删除附件“${asset.name}”？此操作无法撤销。`)) return;
    await deleteAssetBytes(asset.id);
    await save((draft) => {
      draft.assets = draft.assets.filter((item) => item.id !== asset.id);
      for (const profile of draft.jobProfiles) {
        if (profile.defaultResumeAssetId === asset.id) delete profile.defaultResumeAssetId;
      }
    });
  };

  const applyCandidates = async () => {
    const accepted = candidates.filter((_, index) => selectedCandidates.has(index));
    await save((draft) => applyResumeCandidates(draft, accepted));
    setCandidates([]);
    setMessage(`已将 ${accepted.length} 个确认字段写入公共档案。`);
  };

  return (
    <>
      <div className="page-heading">
        <h2>附件资料库 / Files</h2>
        <p>附件内容单独使用 AES-GCM 加密，不会进入源码、日志或 AI 请求。</p>
      </div>
      <section className="card">
        <h3>添加附件</h3>
        <div className="grid three">
          <label className="field">
            <span>附件类型</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as AssetMeta["category"])}
            >
              {CATEGORIES.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>关联求职档案</span>
            <select value={profileId} onChange={(event) => setProfileId(event.target.value)}>
              <option value="">公共附件</option>
              {data.jobProfiles.map((profile) => (
                <option value={profile.id} key={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>选择本地文件</span>
            <input
              type="file"
              disabled={processing || busy}
              accept={category === "resume" ? ".pdf,.docx" : undefined}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.target.value = "";
              }}
            />
          </label>
        </div>
        {message && (
          <div
            className={`notice ${message.includes("失败") || message.includes("无法") ? "danger" : ""}`}
          >
            {message}
          </div>
        )}
      </section>

      {candidates.length > 0 && (
        <section className="card">
          <div className="section-title">
            <div>
              <h3>简历解析候选</h3>
              <p>解析只提供候选值。请检查证据片段，尤其是低置信度项目。</p>
            </div>
            <button
              className="button primary small"
              disabled={!selectedCandidates.size}
              onClick={() => void applyCandidates()}
            >
              写入选中的 {selectedCandidates.size} 项
            </button>
          </div>
          {candidates.map((candidate, index) => (
            <label className="candidate" key={`${candidate.path}-${index}`}>
              <input
                type="checkbox"
                checked={selectedCandidates.has(index)}
                onChange={(event) => {
                  setSelectedCandidates((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(index);
                    else next.delete(index);
                    return next;
                  });
                }}
              />
              <div>
                <strong>
                  {candidate.label}：{candidate.value}
                </strong>
                <p>{candidate.evidence}</p>
              </div>
              <span className={`pill ${candidate.confidence >= 0.8 ? "success" : "warning"}`}>
                {Math.round(candidate.confidence * 100)}%
              </span>
            </label>
          ))}
        </section>
      )}

      <section className="card">
        <div className="section-title">
          <div>
            <h3>已保存附件</h3>
            <p>{data.assets.length} 个文件</p>
          </div>
        </div>
        {data.assets.length === 0 && <div className="empty-state">尚未添加附件</div>}
        {data.assets.map((asset) => (
          <div className="list-item" key={asset.id}>
            <div>
              <h4>{asset.name}</h4>
              <p>
                {CATEGORIES.find(([value]) => value === asset.category)?.[1]} ·{" "}
                {(asset.size / 1024 / 1024).toFixed(2)} MB
                {asset.profileIds.length
                  ? ` · ${asset.profileIds
                      .map((id) => data.jobProfiles.find((item) => item.id === id)?.name)
                      .filter(Boolean)
                      .join("、")}`
                  : " · 公共"}
              </p>
            </div>
            <div className="button-row">
              <button className="button small" onClick={() => void download(asset)}>
                下载检查
              </button>
              <button className="button danger small" onClick={() => void remove(asset)}>
                删除
              </button>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
