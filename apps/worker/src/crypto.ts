import type { Env } from "./env";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function getKey(env: Env) {
  if (!env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is not configured");
  }
  const secret = encoder.encode(env.SESSION_SECRET);
  const hash = await crypto.subtle.digest("SHA-256", secret);
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptToken(env: Env, value: string): Promise<string> {
  const key = await getKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(value));
  return `${arrayBufferToBase64(iv.buffer)}.${arrayBufferToBase64(cipherBuffer)}`;
}

export async function decryptToken(env: Env, payload: string | null): Promise<string | null> {
  if (!payload) return null;
  const [ivPart, cipherPart] = payload.split(".");
  if (!ivPart || !cipherPart) return null;
  const key = await getKey(env);
  const iv = base64ToArrayBuffer(ivPart);
  const cipherBuffer = base64ToArrayBuffer(cipherPart);
  try {
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, key, cipherBuffer);
    return decoder.decode(decrypted);
  } catch {
    return null;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
