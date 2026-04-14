import { describe, it, expect } from 'vitest';
import { encryptCredential, decryptCredential } from '../tenant/crypto.js';

// 32-byte key (64 hex chars) — test key only, never in production
const TEST_KEY = 'a'.repeat(64);

describe('encryptCredential / decryptCredential', () => {
  it('round-trips a simple string', () => {
    const plain = 'super-secret-api-key';
    const encrypted = encryptCredential(plain, TEST_KEY);
    const decrypted = decryptCredential(encrypted, TEST_KEY);
    expect(decrypted).toBe(plain);
  });

  it('round-trips a JSON string (credential payload)', () => {
    const plain = JSON.stringify({ token: 'tok_123', refresh: 'ref_456' });
    const encrypted = encryptCredential(plain, TEST_KEY);
    const decrypted = decryptCredential(encrypted, TEST_KEY);
    expect(decrypted).toBe(plain);
  });

  it('produces different ciphertext on each call (unique IV)', () => {
    const plain = 'same-value';
    const enc1 = encryptCredential(plain, TEST_KEY);
    const enc2 = encryptCredential(plain, TEST_KEY);
    expect(enc1.toString('hex')).not.toBe(enc2.toString('hex'));
  });

  it('encrypted buffer has minimum expected length (16 IV + 16 authTag + data)', () => {
    const plain = 'x';
    const encrypted = encryptCredential(plain, TEST_KEY);
    expect(encrypted.length).toBeGreaterThanOrEqual(16 + 16 + 1);
  });

  it('throws on tampered ciphertext (authTag mismatch)', () => {
    const encrypted = encryptCredential('value', TEST_KEY);
    // Flip a byte in the ciphertext region
    encrypted[encrypted.length - 1] = (encrypted[encrypted.length - 1]! ^ 0xff);
    expect(() => decryptCredential(encrypted, TEST_KEY)).toThrow();
  });

  it('throws when master key is wrong length', () => {
    expect(() => encryptCredential('x', 'short')).toThrow(/64 hex/);
    expect(() => decryptCredential(Buffer.alloc(48), 'short')).toThrow(/64 hex/);
  });
});
