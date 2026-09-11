import { browser } from "wxt/browser";
import { VaultGate } from "../../src/ui/VaultGate";
import { useVault } from "../../src/ui/useVault";

export default function App() {
  const vault = useVault();

  const openSidePanel = async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.windowId) return;
    await browser.sidePanel.open({ windowId: tab.windowId });
    window.close();
  };

  return (
    <div className="popup-root">
      <VaultGate
        state={vault.state}
        busy={vault.busy}
        error={vault.error}
        onCreate={vault.create}
        onUnlock={vault.unlock}
        compact
      >
        {vault.data && (
          <>
            <div className="brand">
              <span className="brand-mark">RP</span>
              <div>
                <h1>ResumePilot</h1>
                <p>当前资料库已解锁</p>
              </div>
            </div>
            <label className="field">
              <span>当前求职档案</span>
              <select
                value={vault.data.activeProfileId ?? ""}
                onChange={(event) => {
                  const id = event.target.value;
                  void vault.save((draft) => {
                    draft.activeProfileId = id;
                  });
                }}
              >
                {vault.data.jobProfiles.map((profile) => (
                  <option value={profile.id} key={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="notice small-text">
              打开侧边栏后先扫描并预览当前页面。ResumePilot 不会点击最终提交。
            </div>
            <div className="grid" style={{ gap: 8 }}>
              <button className="button primary" onClick={() => void openSidePanel()}>
                打开填写侧边栏
              </button>
              <button className="button" onClick={() => void browser.runtime.openOptionsPage()}>
                管理档案与附件
              </button>
              <button className="button ghost small" onClick={() => void vault.lock()}>
                锁定资料库
              </button>
            </div>
          </>
        )}
      </VaultGate>
    </div>
  );
}
