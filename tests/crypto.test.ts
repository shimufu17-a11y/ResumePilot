import { describe, expect, it } from "vitest";
import {
  decryptJson,
  deriveKeyBytes,
  encryptJson,
  importAesKey,
  randomBytes
} from "../src/core/crypto";

describe("vault cryptography", () => {
  it("round-trips structured data with AES-GCM", async () => {
    const raw = await deriveKeyBytes("correct horse battery staple", randomBytes(16), 1_000);
    const key = await importAesKey(raw);
    const value = { name: "虚构用户", profiles: ["雷达", "Agent"], count: 2 };
    const encrypted = await encryptJson(value, key);

    expect(encrypted.ciphertext).not.toContain("虚构用户");
    await expect(decryptJson(encrypted, key)).resolves.toEqual(value);
  });

  it("rejects decryption with a different key", async () => {
    const salt = randomBytes(16);
    const first = await importAesKey(await deriveKeyBytes("first password", salt, 1_000));
    const second = await importAesKey(await deriveKeyBytes("second password", salt, 1_000));
    const encrypted = await encryptJson({ secret: "value" }, first);

    await expect(decryptJson(encrypted, second)).rejects.toBeDefined();
  });

  it("uses a fresh IV for each encryption", async () => {
    const key = await importAesKey(await deriveKeyBytes("same password", randomBytes(16), 1_000));
    const first = await encryptJson({ same: true }, key);
    const second = await encryptJson({ same: true }, key);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });
});
