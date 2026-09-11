import {
  exportEncryptedAssets,
  readAssetBytes,
  replaceEncryptedAssets,
  saveAssetBytes,
  type StoredAsset
} from "./assets";
import { base64ToBytes, bytesToBase64 } from "./crypto";
import type { VaultData, VaultEnvelope } from "./model";
import { vaultDataSchema } from "./model";
import {
  assertVaultEnvelope,
  readVault,
  readVaultEnvelope,
  replaceVaultEnvelope,
  writeVault
} from "./vault";

interface EncryptedBackup {
  format: "resumepilot-encrypted-backup";
  version: 1;
  exportedAt: string;
  envelope: VaultEnvelope;
  assets: StoredAsset[];
}

interface PlainBackup {
  format: "resumepilot-plain-backup";
  version: 1;
  exportedAt: string;
  data: VaultData;
  assets: Array<{ id: string; bytes: string }>;
}

export async function createEncryptedBackup(): Promise<string> {
  const backup: EncryptedBackup = {
    format: "resumepilot-encrypted-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    envelope: await readVaultEnvelope(),
    assets: await exportEncryptedAssets()
  };
  return JSON.stringify(backup);
}

export async function createPlainBackup(): Promise<string> {
  const data = await readVault();
  const assets: PlainBackup["assets"] = [];
  for (const meta of data.assets) {
    const bytes = await readAssetBytes(meta.id);
    assets.push({ id: meta.id, bytes: bytesToBase64(bytes) });
  }
  const backup: PlainBackup = {
    format: "resumepilot-plain-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
    assets
  };
  return JSON.stringify(backup, null, 2);
}

export async function restoreEncryptedBackup(text: string): Promise<void> {
  const parsed = JSON.parse(text) as Partial<EncryptedBackup>;
  if (
    parsed.format !== "resumepilot-encrypted-backup" ||
    parsed.version !== 1 ||
    !parsed.envelope ||
    !Array.isArray(parsed.assets)
  ) {
    throw new Error("不是有效的 ResumePilot 加密备份");
  }
  assertVaultEnvelope(parsed.envelope);
  for (const asset of parsed.assets) {
    if (
      !asset ||
      typeof asset.id !== "string" ||
      typeof asset.iv !== "string" ||
      typeof asset.ciphertext !== "string"
    ) {
      throw new Error("加密备份中的附件格式无效");
    }
  }
  await replaceEncryptedAssets(parsed.assets);
  await replaceVaultEnvelope(parsed.envelope);
}

export async function restorePlainBackup(text: string): Promise<void> {
  const parsed = JSON.parse(text) as Partial<PlainBackup>;
  if (
    parsed.format !== "resumepilot-plain-backup" ||
    parsed.version !== 1 ||
    !parsed.data ||
    !Array.isArray(parsed.assets)
  ) {
    throw new Error("不是有效的 ResumePilot 未加密备份");
  }
  const data = vaultDataSchema.parse(parsed.data);
  await replaceEncryptedAssets([]);
  for (const asset of parsed.assets) {
    if (!asset.id || !asset.bytes) throw new Error("备份附件格式无效");
    await saveAssetBytes(asset.id, base64ToBytes(asset.bytes));
  }
  await writeVault(data);
}
