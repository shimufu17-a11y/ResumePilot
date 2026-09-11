import { useState } from "react";
import { newId } from "../../src/core/defaults";
import type { Application, ApplicationStatus, VaultData } from "../../src/core/model";

interface Props {
  data: VaultData;
  busy: boolean;
  save: (update: (draft: VaultData) => void | VaultData) => Promise<VaultData>;
}

const STATUSES: Array<[ApplicationStatus, string]> = [
  ["filling", "填写中"],
  ["submitted", "已投递"],
  ["assessment", "笔试/测评"],
  ["interview", "面试"],
  ["offer", "Offer"],
  ["rejected", "拒绝"],
  ["withdrawn", "放弃"]
];

export default function ApplicationsPanel({ data, busy, save }: Props) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [url, setUrl] = useState("");
  const [profileId, setProfileId] = useState(data.activeProfileId ?? data.jobProfiles[0]?.id ?? "");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");
  const [search, setSearch] = useState("");
  const filteredApplications = data.applications.filter((entry) => {
    const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
    const query = search.trim().toLocaleLowerCase();
    const matchesSearch =
      !query ||
      `${entry.company} ${entry.role} ${entry.hostname}`.toLocaleLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  const exportCsv = () => {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = [
      ["公司", "岗位", "状态", "求职档案", "链接", "开始时间", "投递时间", "备注"],
      ...filteredApplications.map((entry) => [
        entry.company,
        entry.role,
        STATUSES.find(([value]) => value === entry.status)?.[1] ?? entry.status,
        data.jobProfiles.find((item) => item.id === entry.profileId)?.name ?? "已删除",
        entry.url,
        entry.startedAt,
        entry.submittedAt ?? "",
        entry.note
      ])
    ];
    const content = `\uFEFF${rows.map((row) => row.map(escape).join(",")).join("\r\n")}`;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const urlObject = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = urlObject;
    link.download = `resumepilot-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(urlObject), 1000);
  };

  const add = async () => {
    if (!company.trim() || !role.trim() || !profileId) return;
    let normalizedUrl = url.trim();
    if (normalizedUrl && !/^https?:\/\//i.test(normalizedUrl))
      normalizedUrl = `https://${normalizedUrl}`;
    const hostname = normalizedUrl ? new URL(normalizedUrl).hostname : "manual";
    const entry: Application = {
      id: newId("application"),
      company: company.trim(),
      role: role.trim(),
      url: normalizedUrl,
      hostname,
      profileId,
      status: "filling",
      startedAt: new Date().toISOString(),
      note: ""
    };
    await save((draft) => {
      draft.applications.unshift(entry);
    });
    setCompany("");
    setRole("");
    setUrl("");
  };

  return (
    <>
      <div className="page-heading">
        <h2>投递记录 / Applications</h2>
        <p>插件仅在你亲自提交并确认后标记为已投递；其余进度由你手动维护。</p>
      </div>
      <section className="card">
        <h3>手动添加记录</h3>
        <div className="grid two">
          <label className="field">
            <span>公司</span>
            <input value={company} onChange={(event) => setCompany(event.target.value)} />
          </label>
          <label className="field">
            <span>岗位</span>
            <input value={role} onChange={(event) => setRole(event.target.value)} />
          </label>
          <label className="field">
            <span>职位链接（可选）</span>
            <input value={url} onChange={(event) => setUrl(event.target.value)} />
          </label>
          <label className="field">
            <span>使用档案</span>
            <select value={profileId} onChange={(event) => setProfileId(event.target.value)}>
              {data.jobProfiles.map((profile) => (
                <option value={profile.id} key={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="button-row end" style={{ marginTop: 12 }}>
          <button
            className="button primary"
            disabled={busy || !company.trim() || !role.trim()}
            onClick={() => void add()}
          >
            添加
          </button>
        </div>
      </section>
      <section className="card">
        <div className="section-title">
          <div>
            <h3>全部记录</h3>
            <p>
              {filteredApplications.length} / {data.applications.length} 条
            </p>
          </div>
          <button
            className="button small"
            disabled={!filteredApplications.length}
            onClick={exportCsv}
          >
            导出当前结果 CSV
          </button>
        </div>
        <div className="grid two" style={{ marginBottom: 14 }}>
          <label className="field">
            <span>搜索公司或岗位</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label className="field">
            <span>状态筛选</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ApplicationStatus | "all")}
            >
              <option value="all">全部状态</option>
              {STATUSES.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {data.applications.length === 0 ? (
          <div className="empty-state">尚无投递记录</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>公司 / 岗位</th>
                  <th>档案</th>
                  <th>状态</th>
                  <th>开始时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <strong>{entry.company}</strong>
                      <br />
                      {entry.url ? (
                        <a href={entry.url} target="_blank" rel="noreferrer">
                          {entry.role}
                        </a>
                      ) : (
                        entry.role
                      )}
                    </td>
                    <td>
                      {data.jobProfiles.find((item) => item.id === entry.profileId)?.name ??
                        "已删除"}
                    </td>
                    <td>
                      <select
                        value={entry.status}
                        onChange={(event) => {
                          const status = event.target.value as ApplicationStatus;
                          void save((draft) => {
                            const target = draft.applications.find((item) => item.id === entry.id)!;
                            target.status = status;
                            if (status === "submitted" && !target.submittedAt)
                              target.submittedAt = new Date().toISOString();
                          });
                        }}
                      >
                        {STATUSES.map(([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{new Date(entry.startedAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="button danger small"
                        onClick={() => {
                          if (confirm("删除这条投递记录？"))
                            void save((draft) => {
                              draft.applications = draft.applications.filter(
                                (item) => item.id !== entry.id
                              );
                            });
                        }}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
