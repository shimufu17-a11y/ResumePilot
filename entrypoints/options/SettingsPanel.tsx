import { useState } from "react";
import { browser } from "wxt/browser";
import { setSessionAiKey } from "../../src/core/ai";
import {
  createEncryptedBackup,
  createPlainBackup,
  restoreEncryptedBackup,
  restorePlainBackup
} from "../../src/core/backup";
import type { VaultData } from "../../src/core/model";

interface Props {
  data: VaultData;
  busy: boolean;
  save: (update: (draft: VaultData) => void | VaultData) => Promise<VaultData>;
}

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SettingsPanel({ data, busy, save }: Props) {
  const [locale, setLocale] = useState(data.settings.locale);
  const [autoLockMinutes, setAutoLockMinutes] = useState(data.settings.autoLockMinutes);
  const [enabled, setEnabled] = useState(data.aiConfig.enabled);
  const [baseUrl, setBaseUrl] = useState(data.aiConfig.baseUrl);
  const [model, setModel] = useState(data.aiConfig.model);
  const [apiKey, setApiKey] = useState("");
  const [rememberKey, setRememberKey] = useState(data.aiConfig.rememberKey);
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);

  const saveSettings = async () => {
    setProcessing(true);
    setMessage("");
    try {
      if (enabled) {
        if (!baseUrl || !model) throw new Error("启用 AI 时需要填写 Base URL 和模型名");
        const originPattern = `${new URL(baseUrl).origin}/*`;
        const granted = await browser.permissions.request({ origins: [originPattern] });
        if (!granted) throw new Error("未授予 AI 接口域名的网络权限");
      }
      await setSessionAiKey(rememberKey ? "" : apiKey);
      await save((draft) => {
        draft.settings.locale = locale;
        draft.settings.autoLockMinutes = autoLockMinutes;
        draft.aiConfig.enabled = enabled;
        draft.aiConfig.baseUrl = baseUrl.trim().replace(/\/+$/, "");
        draft.aiConfig.model = model.trim();
        draft.aiConfig.rememberKey = rememberKey;
        if (rememberKey && apiKey) draft.aiConfig.encryptedApiKey = apiKey;
        if (!rememberKey) delete draft.aiConfig.encryptedApiKey;
      });
      setApiKey("");
      setMessage("设置已加密保存。界面语言在下次打开页面时完全生效。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "设置保存失败");
    } finally {
      setProcessing(false);
    }
  };

  const exportBackup = async (plain: boolean) => {
    setProcessing(true);
    setMessage("");
    try {
      if (plain && !confirm("未加密备份包含你的完整个人资料、API Key 和附件内容。确定继续导出？")) {
        return;
      }
      const content = plain ? await createPlainBackup() : await createEncryptedBackup();
      const date = new Date().toISOString().slice(0, 10);
      downloadText(`resumepilot-${plain ? "plain" : "encrypted"}-${date}.json`, content);
      setMessage(
        plain ? "未加密备份已导出，请立即安全保管。" : "加密备份已导出。恢复时需要原主密码。"
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "备份导出失败");
    } finally {
      setProcessing(false);
    }
  };

  const importBackup = async (file: File) => {
    setProcessing(true);
    setMessage("");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { format?: string };
      if (!confirm("恢复备份会覆盖当前档案和附件。请确认你已经另行备份当前资料。是否继续？"))
        return;
      if (parsed.format === "resumepilot-encrypted-backup") {
        await restoreEncryptedBackup(text);
        setMessage("加密备份已恢复。页面即将刷新，请使用该备份的原主密码解锁。");
        window.setTimeout(() => location.reload(), 900);
      } else if (parsed.format === "resumepilot-plain-backup") {
        if (!confirm("这是未加密备份。确认将其中的明文资料写入当前加密资料库？")) return;
        await restorePlainBackup(text);
        setMessage("未加密备份已恢复。");
        window.setTimeout(() => location.reload(), 900);
      } else {
        throw new Error("无法识别此备份文件");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "备份恢复失败");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <div className="page-heading">
        <h2>设置与备份 / Settings</h2>
        <p>AI 完全可选。每次发送 JD 或答案上下文前，侧边栏都会再次展示数据范围并要求确认。</p>
      </div>
      <section className="card">
        <h3>通用设置 / General</h3>
        <div className="grid two">
          <label className="field">
            <span>界面语言 / Language</span>
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as "zh-CN" | "en")}
            >
              <option value="zh-CN">简体中文</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="field">
            <span>自动锁定时间 / Auto-lock</span>
            <select
              value={autoLockMinutes}
              onChange={(event) => setAutoLockMinutes(Number(event.target.value))}
            >
              {[5, 15, 30, 60, 240].map((minutes) => (
                <option value={minutes} key={minutes}>
                  {minutes} 分钟
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <section className="card">
        <div className="section-title">
          <div>
            <h3>可选 AI 接口</h3>
            <p>支持 OpenAI 兼容的 Chat Completions 接口。</p>
          </div>
          <label className="button small">
            <input
              type="checkbox"
              style={{ minHeight: "auto", width: "auto", marginRight: 7 }}
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            启用 AI
          </label>
        </div>
        <div className="notice warning">
          ResumePilot 永远不会向 AI 发送身份证号、详细地址、健康信息或附件原文。自定义 Base URL
          对应的服务由你自行信任。
        </div>
        <div className="grid two">
          <label className="field">
            <span>Base URL</span>
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              disabled={!enabled}
            />
          </label>
          <label className="field">
            <span>模型名 / Model</span>
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              disabled={!enabled}
              placeholder="例如 gpt-5-mini"
            />
          </label>
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span>
              API Key {data.aiConfig.encryptedApiKey ? "（已有加密保存的密钥，留空则不替换）" : ""}
            </span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              disabled={!enabled}
              autoComplete="off"
            />
          </label>
          <label
            className="field"
            style={{ gridColumn: "1 / -1", flexDirection: "row", alignItems: "center" }}
          >
            <input
              type="checkbox"
              style={{ minHeight: "auto", width: "auto" }}
              checked={rememberKey}
              disabled={!enabled}
              onChange={(event) => setRememberKey(event.target.checked)}
            />
            <span>随资料库加密保存 API Key；关闭后只保留到当前浏览器会话</span>
          </label>
        </div>
      </section>
      <section className="card">
        <div className="section-title">
          <div>
            <h3>本地网站规则 / Site rules</h3>
            <p>这些映射只保存在本机，可随加密备份迁移。</p>
          </div>
          <span className="pill">{data.siteRules.length}</span>
        </div>
        {data.siteRules.length === 0 && <div className="empty-state">尚未从侧边栏保存字段映射</div>}
        {data.siteRules.map((rule) => (
          <div className="list-item" key={rule.id}>
            <div>
              <h4>{rule.hostname}</h4>
              <p>
                {rule.pathPattern} · {rule.targetPath} · 指纹 {rule.fingerprint}
              </p>
            </div>
            <button
              className="button danger small"
              onClick={() =>
                void save((draft) => {
                  draft.siteRules = draft.siteRules.filter((item) => item.id !== rule.id);
                })
              }
            >
              删除
            </button>
          </div>
        ))}
      </section>
      <section className="card">
        <h3>备份与恢复 / Backup</h3>
        <div className="notice">
          加密备份包含档案及附件密文，恢复时需要创建备份时的主密码。主密码无法找回。
        </div>
        <div className="button-row">
          <button className="button" disabled={processing} onClick={() => void exportBackup(false)}>
            导出加密备份
          </button>
          <button
            className="button danger"
            disabled={processing}
            onClick={() => void exportBackup(true)}
          >
            导出未加密备份
          </button>
          <label className="button">
            恢复备份
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              disabled={processing}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importBackup(file);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </section>
      {message && (
        <div className={`notice ${/失败|无法|需要|未授予/.test(message) ? "danger" : ""}`}>
          {message}
        </div>
      )}
      <div className="button-row end">
        <button
          className="button primary"
          disabled={busy || processing}
          onClick={() => void saveSettings()}
        >
          {processing ? "处理中…" : "保存设置"}
        </button>
      </div>
    </>
  );
}
