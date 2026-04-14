// Tenant credential encryption — AES-256-GCM
// Wire format: IV (16 bytes) || authTag (16 bytes) || ciphertext
// Master key from ZENYA_MASTER_KEY env var (64-char hex = 32 bytes)

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const IV_BYTES = 16;
const AUTH_TAG_BYTES = 16;
const ALGORITHM = 'aes-256-gcm';

function getMasterKeyBuffer(masterKey: string): Buffer {
  const buf = Buffer.from(masterKey, 'hex');
  if (buf.length !== 32) {
    throw new Error('ZENYA_MASTER_KEY must be 64 hex characters (32 bytes)');
  }
  return buf;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a Buffer: IV (16) || authTag (16) || ciphertext.
 */
export function encryptCredential(value: string, masterKey: string): Buffer {
  const keyBuf = getMasterKeyBuffer(masterKey);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypts a Buffer produced by encryptCredential.
 * Throws if authentication fails (tampered data).
 */
export function decryptCredential(encrypted: Buffer, masterKey: string): string {
  const keyBuf = getMasterKeyBuffer(masterKey);
  const iv = encrypted.subarray(0, IV_BYTES);
  const authTag = encrypted.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const ciphertext = encrypted.subarray(IV_BYTES + AUTH_TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, keyBuf, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

/** Convenience: get master key from env var or throw. */
export function getMasterKey(): string {
  const key = process.env['ZENYA_MASTER_KEY'];
  if (!key) throw new Error('ZENYA_MASTER_KEY env var is required');
  return key;
}
