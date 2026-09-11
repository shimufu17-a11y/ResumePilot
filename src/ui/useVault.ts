import { useCallback, useEffect, useState } from "react";
import { browser } from "wxt/browser";
import type { VaultData } from "../core/model";
import {
  createVault,
  getVaultState,
  lockVault,
  readVault,
  touchVaultSession,
  unlockVault,
  updateVault,
  type VaultState
} from "../core/vault";

export function useVault() {
  const [state, setState] = useState<VaultState>("locked");
  const [data, setData] = useState<VaultData>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const nextState = await getVaultState();
      setState(nextState);
      setData(nextState === "unlocked" ? await readVault() : undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法读取资料库");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const storageListener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      const sessionChange = changes["resumepilot.session"];
      if (areaName === "session" && sessionChange && !sessionChange.newValue) {
        setData(undefined);
        setState("locked");
      }
    };
    browser.storage.onChanged.addListener(storageListener);

    let lastTouch = 0;
    const activityListener = () => {
      if (state !== "unlocked" || Date.now() - lastTouch < 30_000) return;
      lastTouch = Date.now();
      void touchVaultSession();
    };
    window.addEventListener("pointerdown", activityListener, { passive: true });
    window.addEventListener("keydown", activityListener, { passive: true });
    return () => {
      browser.storage.onChanged.removeListener(storageListener);
      window.removeEventListener("pointerdown", activityListener);
      window.removeEventListener("keydown", activityListener);
    };
  }, [state]);

  const create = useCallback(async (password: string) => {
    setBusy(true);
    setError("");
    try {
      const next = await createVault(password);
      setData(next);
      setState("unlocked");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法创建资料库");
      throw cause;
    } finally {
      setBusy(false);
    }
  }, []);

  const unlock = useCallback(async (password: string) => {
    setBusy(true);
    setError("");
    try {
      const next = await unlockVault(password);
      setData(next);
      setState("unlocked");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法解锁资料库");
      throw cause;
    } finally {
      setBusy(false);
    }
  }, []);

  const lock = useCallback(async () => {
    await lockVault();
    setData(undefined);
    setState("locked");
  }, []);

  const save = useCallback(async (update: (draft: VaultData) => void | VaultData) => {
    setBusy(true);
    setError("");
    try {
      const next = await updateVault(update);
      setData(next);
      return next;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
      throw cause;
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, data, busy, error, create, unlock, lock, save, refresh };
}
