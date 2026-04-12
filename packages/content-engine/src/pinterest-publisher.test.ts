// Unit tests for Pinterest Publisher — Story 5.4

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sparkle-os/core', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@sparkle-os/core')>();
  return { ...mod, updateContentPost: vi.fn() };
});

vi.mock('./drive-client.js', () => ({
  getDriveImageAsBase64: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { updateContentPost } from '@sparkle-os/core';
import { getDriveImageAsBase64 } from './drive-client.js';
import { extractDriveFileId, publishToPinterest } from './pinterest-publisher.js';

const mockUpdate = vi.mocked(updateContentPost);
const mockGetDriveImage = vi.mocked(getDriveImageAsBase64);

const BASE_POST = {
  id: 'post-123',
  clientId: 'plaka',
  status: 'publicado' as const,
  topic: 'skincare',
  title: 'Como cuidar da pele no inverno',
  meta: 'Dicas essenciais de skincare para o frio',
  bodyPreview: null,
  bodyFull: null,
  imageDesc: null,
  pinCopy: 'Sua pele merece cuidado extra ❄️',
  pinHashtags: '#skincare #inverno',
  imageDriveUrl: 'https://drive.google.com/file/d/file-abc123/view',
  blogUrl: 'https://plaka.com.br/blog/como-cuidar-da-pele',
  pinUrl: null,
  errorMsg: null,
  rejectionNote: null,
  createdAt: new Date('2026-04-12T08:00:00Z').toISOString(),
  approvedAt: new Date('2026-04-12T09:00:00Z').toISOString(),
  publishedAt: new Date('2026-04-12T09:01:00Z').toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mockUpdate.mockResolvedValue({ ...BASE_POST, status: 'pin_publicado' });
});

describe('extractDriveFileId', () => {
  it('extracts file ID from /file/d/{id}/ pattern', () => {
    expect(extractDriveFileId('https://drive.google.com/file/d/file-abc123/view')).toBe('file-abc123');
  });

  it('extracts file ID from ?id= query param', () => {
    expect(extractDriveFileId('https://drive.google.com/uc?id=file-xyz789&export=view')).toBe('file-xyz789');
  });

  it('returns null for unrecognized URL', () => {
    expect(extractDriveFileId('https://example.com/image.jpg')).toBeNull();
  });
});

describe('publishToPinterest', () => {
  it('AC6: sets status erro_pin when env vars missing', async () => {
    await publishToPinterest(BASE_POST);
    expect(mockUpdate).toHaveBeenCalledWith('post-123', expect.objectContaining({
      status: 'erro_pin',
      errorMsg: expect.stringContaining('PINTEREST_ACCESS_TOKEN'),
    }));
  });

  it('sets status erro_pin when imageDriveUrl is null', async () => {
    vi.stubEnv('PINTEREST_ACCESS_TOKEN', 'token-abc');
    vi.stubEnv('PINTEREST_BOARD_ID', 'board-123');

    const postNoImage = { ...BASE_POST, imageDriveUrl: null };
    await publishToPinterest(postNoImage);

    expect(mockUpdate).toHaveBeenCalledWith('post-123', expect.objectContaining({
      status: 'erro_pin',
      errorMsg: expect.stringContaining('Imagem do Drive'),
    }));
  });

  it('sets status erro_pin when Drive image download fails', async () => {
    vi.stubEnv('PINTEREST_ACCESS_TOKEN', 'token-abc');
    vi.stubEnv('PINTEREST_BOARD_ID', 'board-123');
    mockGetDriveImage.mockResolvedValueOnce(null);

    await publishToPinterest(BASE_POST);

    expect(mockUpdate).toHaveBeenCalledWith('post-123', expect.objectContaining({
      status: 'erro_pin',
    }));
  });

  it('AC1+AC4: sets status pin_publicado with pinUrl on success', async () => {
    vi.stubEnv('PINTEREST_ACCESS_TOKEN', 'token-abc');
    vi.stubEnv('PINTEREST_BOARD_ID', 'board-123');
    mockGetDriveImage.mockResolvedValueOnce({ base64: 'abc123', mimeType: 'image/jpeg' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'pin-987654' }),
    });

    await publishToPinterest(BASE_POST);

    expect(mockUpdate).toHaveBeenCalledWith('post-123', expect.objectContaining({
      status: 'pin_publicado',
      pinUrl: 'https://pinterest.com/pin/pin-987654',
    }));
  });

  it('AC2: sends correct pin body with board_id, title, description, link, media_source', async () => {
    vi.stubEnv('PINTEREST_ACCESS_TOKEN', 'token-abc');
    vi.stubEnv('PINTEREST_BOARD_ID', 'board-123');
    mockGetDriveImage.mockResolvedValueOnce({ base64: 'imgdata', mimeType: 'image/png' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'pin-111' }),
    });

    await publishToPinterest(BASE_POST);

    expect(mockFetch).toHaveBeenCalledWith('https://api.pinterest.com/v5/pins', expect.objectContaining({
      method: 'POST',
    }));

    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string) as Record<string, unknown>;
    expect(body.board_id).toBe('board-123');
    expect(body.title).toBe('Como cuidar da pele no inverno');
    expect(body.link).toBe('https://plaka.com.br/blog/como-cuidar-da-pele');
    expect((body.media_source as Record<string, string>).source_type).toBe('image_base64');
    expect((body.media_source as Record<string, string>).data).toBe('imgdata');
  });

  it('AC5: sets status erro_pin on Pinterest API error without throwing', async () => {
    vi.stubEnv('PINTEREST_ACCESS_TOKEN', 'token-abc');
    vi.stubEnv('PINTEREST_BOARD_ID', 'board-123');
    mockGetDriveImage.mockResolvedValueOnce({ base64: 'imgdata', mimeType: 'image/jpeg' });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => 'Invalid board',
    });

    await publishToPinterest(BASE_POST);

    expect(mockUpdate).toHaveBeenCalledWith('post-123', expect.objectContaining({
      status: 'erro_pin',
      errorMsg: expect.stringContaining('422'),
    }));
  });
});
