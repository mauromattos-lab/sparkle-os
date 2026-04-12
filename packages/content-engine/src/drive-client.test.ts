// Unit tests for Google Drive Client — Story 5.5

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateKeyPairSync } from 'crypto';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { buildJwt, listDriveImages, selectDriveImage, getDriveImageAsBase64 } from './drive-client.js';

// Generate a real RSA key pair for tests (buildJwt uses createSign which requires valid PEM)
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const MOCK_KEY = {
  type: 'service_account',
  client_email: 'test@project.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('buildJwt', () => {
  it('builds a valid JWT string with 3 dot-separated segments', () => {
    const jwt = buildJwt(MOCK_KEY, 1000000);
    const parts = jwt.split('.');
    expect(parts).toHaveLength(3);
    // Header should decode to RS256/JWT
    const header = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString());
    expect(header).toMatchObject({ alg: 'RS256', typ: 'JWT' });
    // Payload should contain expected fields
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString());
    expect(payload.iss).toBe(MOCK_KEY.client_email);
    expect(payload.scope).toContain('drive.readonly');
  });
});

describe('listDriveImages', () => {
  it('AC1: returns list of image files from folder', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: [
          { id: 'file-1', name: 'plaka-hidratante.jpg', mimeType: 'image/jpeg', createdTime: '2026-04-12T08:00:00Z' },
          { id: 'file-2', name: 'plaka-serum.png', mimeType: 'image/png', createdTime: '2026-04-11T08:00:00Z' },
        ],
      }),
    });

    const files = await listDriveImages('folder-123', 'token-abc');
    expect(files).toHaveLength(2);
    expect(files[0]?.name).toBe('plaka-hidratante.jpg');
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('googleapis.com/drive/v3/files'), expect.objectContaining({
      headers: { Authorization: 'Bearer token-abc' },
    }));
  });

  it('AC4: returns empty array when folder has no images', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) });
    const files = await listDriveImages('folder-empty', 'token-abc');
    expect(files).toHaveLength(0);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' });
    await expect(listDriveImages('folder-123', 'bad-token')).rejects.toThrow('Drive files.list failed: 403');
  });
});

describe('selectDriveImage', () => {
  it('AC5: returns null when env vars are not set', async () => {
    const result = await selectDriveImage('skincare');
    expect(result).toBeNull();
  });

  it('AC2: selects image by topic keyword when available', async () => {
    vi.stubEnv('GOOGLE_DRIVE_FOLDER_ID', 'folder-123');
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_KEY', JSON.stringify(MOCK_KEY));

    // Mock: OAuth token call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'test-token', token_type: 'Bearer', expires_in: 3600 }),
    });
    // Mock: Drive files list
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: [
          { id: 'file-skincare', name: 'skincare-plaka.jpg', mimeType: 'image/jpeg', createdTime: '2026-04-12' },
          { id: 'file-other', name: 'promo.jpg', mimeType: 'image/jpeg', createdTime: '2026-04-11' },
        ],
      }),
    });

    const result = await selectDriveImage('skincare');
    expect(result).not.toBeNull();
    expect(result?.fileId).toBe('file-skincare');
    expect(result?.fileName).toBe('skincare-plaka.jpg');
  });

  it('AC2: falls back to most recent image when no topic match', async () => {
    vi.stubEnv('GOOGLE_DRIVE_FOLDER_ID', 'folder-123');
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_KEY', JSON.stringify(MOCK_KEY));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'test-token', token_type: 'Bearer', expires_in: 3600 }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: [
          { id: 'file-recent', name: 'produto-novo.jpg', mimeType: 'image/jpeg', createdTime: '2026-04-12' },
        ],
      }),
    });

    const result = await selectDriveImage('topico-sem-match');
    expect(result?.fileId).toBe('file-recent');
  });
});

describe('getDriveImageAsBase64', () => {
  it('AC3: returns base64 image data', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_KEY', JSON.stringify(MOCK_KEY));

    // OAuth
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'test-token', token_type: 'Bearer', expires_in: 3600 }),
    });
    // Metadata
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ mimeType: 'image/jpeg' }),
    });
    // File download — use a properly scoped ArrayBuffer (avoids Node.js pool sharing issue)
    const fakeBytes = Buffer.from('fake-image-bytes');
    const fakeArrayBuffer = fakeBytes.buffer.slice(fakeBytes.byteOffset, fakeBytes.byteOffset + fakeBytes.byteLength);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => fakeArrayBuffer,
    });

    const result = await getDriveImageAsBase64('file-123');
    expect(result).not.toBeNull();
    expect(result?.mimeType).toBe('image/jpeg');
    // Verify that base64 round-trips back to the original data
    expect(Buffer.from(result!.base64, 'base64').toString()).toBe('fake-image-bytes');
  });

  it('AC5: returns null when GOOGLE_SERVICE_ACCOUNT_KEY not set', async () => {
    const result = await getDriveImageAsBase64('file-123');
    expect(result).toBeNull();
  });
});
