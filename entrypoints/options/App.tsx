import { useState } from "react";
import { VaultGate } from "../../src/ui/VaultGate";
import { useVault } from "../../src/ui/useVault";
import ProfilesPanel from "./ProfilesPanel";
import AssetsPanel from "./AssetsPanel";
import AnswersPanel from "./AnswersPanel";
import ApplicationsPanel from "./ApplicationsPanel";
import SettingsPanel from "./SettingsPanel";

type Tab = "profiles" | "assets" | "answers" | "applications" | "settings";

const NAV: Array<{ id: Tab; zh: string; en: string }> = [
  { id: "profiles", zh: "档案", en: "Profiles" },
  { id: "assets", zh: "附件", en: "Files" },
  { id: "answers", zh: "答案库", en: "Answers" },
  { id: "applications", zh: "投递记录", en: "Applications" },
  { id: "settings", zh: "设置与备份", en: "Settings" }
];

export default function App() {
  const vault = useVault();
  const [tab, setTab] = useState<Tab>("profiles");

  return (
    <VaultGate
      state={vault.state}
      busy={vault.busy}
      error={vault.error}
      onCreate={vault.create}
      onUnlock={vault.unlock}
    >
      {vault.data && (
        <div className="app-shell">
          <header className="topbar">
            <div className="brand">
              <span className="brand-mark">RP</span>
              <div>
                <h1>ResumePilot</h1>
                <p>Local-first application assistant</p>
              </div>
            </div>
            <div className="button-row">
              {vault.error && <span className="error-text">{vault.error}</span>}
              <span className="pill success">本地加密 / Encrypted</span>
              <button className="button small" onClick={() => void vault.lock()}>
                锁定 / Lock
              </button>
            </div>
          </header>
          <div className="layout">
            <nav className="sidebar-nav" aria-label="Main navigation">
              {NAV.map((item) => (
                <button
                  key={item.id}
                  className={`nav-button ${tab === item.id ? "active" : ""}`}
                  onClick={() => setTab(item.id)}
                >
                  {vault.data!.settings.locale === "en" ? item.en : item.zh}
                </button>
              ))}
            </nav>
            <main className="content">
              {tab === "profiles" && (
                <ProfilesPanel data={vault.data} busy={vault.busy} save={vault.save} />
              )}
              {tab === "assets" && (
                <AssetsPanel data={vault.data} busy={vault.busy} save={vault.save} />
              )}
              {tab === "answers" && (
                <AnswersPanel data={vault.data} busy={vault.busy} save={vault.save} />
              )}
              {tab === "applications" && (
                <ApplicationsPanel data={vault.data} busy={vault.busy} save={vault.save} />
              )}
              {tab === "settings" && (
                <SettingsPanel data={vault.data} busy={vault.busy} save={vault.save} />
              )}
            </main>
          </div>
        </div>
      )}
    </VaultGate>
  );
}
