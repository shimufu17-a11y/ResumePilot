import { browser } from "wxt/browser";
import {
  base64ToBytes,
  bytesToBase64,
  decryptJson,
  deriveKeyBytes,
  encryptJson,
  importAesKey,
  KDF_ITERATIONS,
  randomBytes
} from "./crypto";
import { createInitialVaultData } from "./defaults";
import { type VaultData, type VaultEnvelope, vaultDataSchema } from "./model";

const VAULT_STORAGE_KEY = "resumepilot.vault";
const SESSION_KEY = "resumepilot.session";
const VERIFIER = "ResumePilot vault verifier v1";

interface SessionRecord {
  rawKey: string;
  expiresAt: number;
  durationMinutes: number;
}

export type VaultState = "missing" | "locked" | "unlocked";

async function getEnvelope(): Promise<VaultEnvelope | undefined> {
  const result = await browser.storage.local.get(VAULT_STORAGE_KEY);
  return result[VAULT_STORAGE_KEY] as VaultEnvelope | undefined;
}

async function setEnvelope(envelope: VaultEnvelope): Promise<void> {
  await browser.storage.local.set({ [VAULT_STORAGE_KEY]: envelope });
}

async function setSession(rawKey: Uint8Array<ArrayBuffer>, minutes: number): Promise<void> {
  const record: SessionRecord = {
    rawKey: bytesToBase64(rawKey),
    expiresAt: Date.now() + minutes * 60_000,
    durationMinutes: minutes
  };
  await browser.storage.session.set({ [SESSION_KEY]: record });
}

async function getSession(): Promise<SessionRecord | undefined> {
  const result = await browser.storage.session.get(SESSION_KEY);
  const session = result[SESSION_KEY] as SessionRecord | undefined;
  if (!session) return undefined;
  if (Date.now() >= session.expiresAt) {
    await browser.storage.session.remove(SESSION_KEY);
    return undefined;
  }
  return session;
}

export async function getVaultState(): Promise<VaultState> {
  const envelope = await getEnvelope();
  if (!envelope) return "missing";
  return (await getSession()) ? "unlocked" : "locked";
}

export async function createVault(password: string): Promise<VaultData> {
  if (password.length < 10) {
    throw new Error("主密码至少需要 10 个字符");
  }
  if (await getEnvelope()) {
    throw new Error("资料库已经存在");
  }

  const salt = randomBytes(16);
  const rawKey = await deriveKeyBytes(password, salt);
  const key = await importAesKey(rawKey);
  const data = createInitialVaultData();
  const envelope: VaultEnvelope = {
    version: 1,
    kdf: {
      algorithm: "PBKDF2",
      hash: "SHA-256",
      iterations: KDF_ITERATIONS,
      salt: bytesToBase64(salt)
    },
    verifier: await encryptJson(VERIFIER, key),
    payload: await encryptJson(data, key),
    updatedAt: new Date().toISOString()
  };
  await setEnvelope(envelope);
  await setSession(rawKey, data.settings.autoLockMinutes);
  return data;
}

export async function unlockVault(password: string): Promise<VaultData> {
  const envelope = await getEnvelope();
  if (!envelope) throw new Error("尚未创建资料库");
  try {
    const rawKey = await deriveKeyBytes(
      password,
      base64ToBytes(envelope.kdf.salt),
      envelope.kdf.iterations
    );
    const key = await importAesKey(rawKey);
    const verifier = await decryptJson<string>(envelope.verifier, key);
    if (verifier !== VERIFIER) throw new Error("Invalid verifier");
    const data = vaultDataSchema.parse(await decryptJson<VaultData>(envelope.payload, key));
    await setSession(rawKey, data.settings.autoLockMinutes);
    return data;
  } catch {
    throw new Error("主密码不正确或资料库已损坏");
  }
}

export async function lockVault(): Promise<void> {
  await browser.storage.session.remove(SESSION_KEY);
}

export async function touchVaultSession(): Promise<void> {
  const session = await getSession();
  if (!session) return;
  session.expiresAt = Date.now() + session.durationMinutes * 60_000;
  await browser.storage.session.set({ [SESSION_KEY]: session });
}

export async function getSessionCryptoKey(): Promise<CryptoKey> {
  const session = await getSession();
  if (!session) throw new Error("资料库已锁定");
  return importAesKey(base64ToBytes(session.rawKey));
}

export async function readVault(): Promise<VaultData> {
  const envelope = await getEnvelope();
  if (!envelope) throw new Error("尚未创建资料库");
  const key = await getSessionCryptoKey();
  return vaultDataSchema.parse(await decryptJson<VaultData>(envelope.payload, key));
}

export async function writeVault(data: VaultData): Promise<void> {
  const parsed = vaultDataSchema.parse(data);
  const envelope = await getEnvelope();
  if (!envelope) throw new Error("尚未创建资料库");
  const session = await getSession();
  if (!session) throw new Error("资料库已锁定");
  const rawKey = base64ToBytes(session.rawKey);
  const key = await importAesKey(rawKey);
  envelope.payload = await encryptJson(parsed, key);
  envelope.updatedAt = new Date().toISOString();
  await setEnvelope(envelope);
  await setSession(rawKey, parsed.settings.autoLockMinutes);
}

export async function updateVault(
  update: (draft: VaultData) => void | VaultData
): Promise<VaultData> {
  const operation = async (): Promise<VaultData> => {
    const current = await readVault();
    const draft = structuredClone(current);
    const returned = update(draft);
    const next = vaultDataSchema.parse(returned ?? draft);
    await writeVault(next);
    return next;
  };

  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("resumepilot-vault-write", operation);
  }
  return operation();
}

export async function exportEncryptedVault(): Promise<string> {
  const envelope = await getEnvelope();
  if (!envelope) throw new Error("尚未创建资料库");
  return JSON.stringify({ format: "resumepilot-backup", version: 1, envelope }, null, 2);
}

export async function exportPlainVault(): Promise<string> {
  return JSON.stringify(
    { format: "resumepilot-plain-backup", version: 1, data: await readVault() },
    null,
    2
  );
}

export async function readVaultEnvelope(): Promise<VaultEnvelope> {
  const envelope = await getEnvelope();
  if (!envelope) throw new Error("尚未创建资料库");
  return structuredClone(envelope);
}

export function assertVaultEnvelope(envelope: VaultEnvelope): void {
  if (
    envelope.version !== 1 ||
    envelope.kdf?.algorithm !== "PBKDF2" ||
    envelope.kdf?.hash !== "SHA-256" ||
    !Number.isInteger(envelope.kdf?.iterations) ||
    envelope.kdf.iterations < 100_000 ||
    envelope.kdf.iterations > 2_000_000 ||
    !envelope.payload?.ciphertext ||
    !envelope.verifier?.ciphertext
  ) {
    throw new Error("备份中的加密资料库格式无效");
  }
}

export async function replaceVaultEnvelope(envelope: VaultEnvelope): Promise<void> {
  assertVaultEnvelope(envelope);
  await setEnvelope(envelope);
  await lockVault();
}
