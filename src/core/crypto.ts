import type { EncryptedValue } from "./model";

export const KDF_ITERATIONS = 310_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

export async function deriveKeyBytes(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations = KDF_ITERATIONS
): Promise<Uint8Array<ArrayBuffer>> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits"
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    256
  );
  return new Uint8Array(bits);
}

export async function importAesKey(rawKey: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptBytes(
  value: Uint8Array<ArrayBuffer>,
  key: CryptoKey,
  context?: string
): Promise<EncryptedValue> {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: context ? encoder.encode(context) : undefined
    },
    key,
    value
  );
  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext))
  };
}

export async function decryptBytes(
  value: EncryptedValue,
  key: CryptoKey,
  context?: string
): Promise<Uint8Array<ArrayBuffer>> {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(value.iv),
      additionalData: context ? encoder.encode(context) : undefined
    },
    key,
    base64ToBytes(value.ciphertext)
  );
  return new Uint8Array(plaintext);
}

export async function encryptJson(value: unknown, key: CryptoKey): Promise<EncryptedValue> {
  return encryptBytes(encoder.encode(JSON.stringify(value)), key);
}

export async function decryptJson<T>(value: EncryptedValue, key: CryptoKey): Promise<T> {
  const plaintext = await decryptBytes(value, key);
  return JSON.parse(decoder.decode(plaintext)) as T;
}
