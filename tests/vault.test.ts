import { beforeEach, describe, expect, it, vi } from "vitest";

const stores = vi.hoisted(() => ({
  local: new Map<string, unknown>(),
  session: new Map<string, unknown>()
}));

function storageArea(store: Map<string, unknown>) {
  return {
    async get(key: string) {
      return store.has(key) ? { [key]: store.get(key) } : {};
    },
    async set(values: Record<string, unknown>) {
      for (const [key, value] of Object.entries(values)) store.set(key, value);
    },
    async remove(key: string) {
      store.delete(key);
    }
  };
}

vi.mock("wxt/browser", () => ({
  browser: {
    storage: {
      local: storageArea(stores.local),
      session: storageArea(stores.session)
    }
  }
}));

import {
  createVault,
  getVaultState,
  lockVault,
  readVault,
  unlockVault,
  updateVault
} from "../src/core/vault";

describe("encrypted vault lifecycle", () => {
  beforeEach(() => {
    stores.local.clear();
    stores.session.clear();
  });

  it("creates, locks and unlocks a vault", async () => {
    expect(await getVaultState()).toBe("missing");
    const created = await createVault("a strong test password");
    expect(created.jobProfiles.map((profile) => profile.name)).toEqual([
      "雷达岗位",
      "Agent 开发岗位"
    ]);
    expect(await getVaultState()).toBe("unlocked");

    await lockVault();
    expect(await getVaultState()).toBe("locked");
    await expect(readVault()).rejects.toThrow("资料库已锁定");
    await expect(unlockVault("wrong password")).rejects.toThrow("主密码不正确");

    const unlocked = await unlockVault("a strong test password");
    expect(unlocked.activeProfileId).toBe(created.activeProfileId);
  });

  it("encrypts updates and preserves schema-valid data", async () => {
    await createVault("another strong password");
    await updateVault((draft) => {
      draft.commonProfile.personal.fullNameZh = "虚构候选人";
      draft.jobProfiles[0]!.expectedSalary = "面议";
    });
    const envelopeText = JSON.stringify(stores.local.get("resumepilot.vault"));
    expect(envelopeText).not.toContain("虚构候选人");
    expect((await readVault()).commonProfile.personal.fullNameZh).toBe("虚构候选人");
  });

  it("rejects weak master passwords", async () => {
    await expect(createVault("short")).rejects.toThrow("至少需要 10 个字符");
  });
});
