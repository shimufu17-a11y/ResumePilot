import { useState, type ReactNode } from "react";
import type { VaultState } from "../core/vault";

interface Props {
  state: VaultState;
  busy: boolean;
  error: string;
  onCreate: (password: string) => Promise<void>;
  onUnlock: (password: string) => Promise<void>;
  children: ReactNode;
  compact?: boolean;
}

export function VaultGate({
  state,
  busy,
  error,
  onCreate,
  onUnlock,
  children,
  compact = false
}: Props) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [localError, setLocalError] = useState("");

  if (state === "unlocked") return <>{children}</>;

  const submit = async () => {
    setLocalError("");
    if (state === "missing" && password !== confirmation) {
      setLocalError("两次输入的主密码不一致");
      return;
    }
    try {
      if (state === "missing") await onCreate(password);
      else await onUnlock(password);
      setPassword("");
      setConfirmation("");
    } catch {
      // The caller exposes a user-safe error message.
    }
  };

  const content = (
    <div className="gate-card">
      <span className="brand-mark">RP</span>
      <h1>{state === "missing" ? "创建本地资料库" : "解锁 ResumePilot"}</h1>
      <p>
        {state === "missing"
          ? "你的档案、答案和附件只保存在本机，并使用主密码加密。主密码无法找回，请妥善保存。"
          : "资料库已自动锁定。输入主密码后才能读取或填写求职资料。"}
      </p>
      <div className="field">
        <span>主密码</span>
        <input
          autoFocus
          type="password"
          autoComplete={state === "missing" ? "new-password" : "current-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && state !== "missing") void submit();
          }}
          placeholder="至少 10 个字符"
        />
      </div>
      {state === "missing" && (
        <div className="field" style={{ marginTop: 12 }}>
          <span>再次输入</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
          />
        </div>
      )}
      {(localError || error) && <p className="error-text">{localError || error}</p>}
      <button
        className="button primary"
        style={{ marginTop: 16, width: "100%" }}
        disabled={busy || password.length < 1}
        onClick={() => void submit()}
      >
        {busy ? "处理中…" : state === "missing" ? "创建并进入" : "解锁"}
      </button>
    </div>
  );

  return compact ? <div>{content}</div> : <div className="gate">{content}</div>;
}
