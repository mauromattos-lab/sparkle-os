// Unit tests for Publication Orchestrator — Stories 5.3 + 5.4 + 5.5 + 6.2 + 6.7
// Atualizado Story 6.4: mock de ghost-publisher em vez de nuvemshop-publisher
// Atualizado Story 6.7: mock de product-enricher para fetchFirstProductImageUrl

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sparkle-os/core', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@sparkle-os/core')>();
  return { ...mod, getContentPost: vi.fn(), updateContentPost: vi.fn() };
});

vi.mock('./drive-client.js', () => ({
  selectDriveImage: vi.fn(),
}));

vi.mock('./ghost-publisher.js', () => ({
  publishToGhost: vi.fn(),
}));

vi.mock('./pinterest-publisher.js', () => ({
  publishToPinterest: vi.fn(),
}));

vi.mock('./product-enricher.js', () => ({
  fetchClientProducts: vi.fn().mockResolvedValue(''),
  fetchFirstProductImageUrl: vi.fn().mockResolvedValue(null),
}));

import { getContentPost, updateContentPost } from '@sparkle-os/core';
import { selectDriveImage } from './drive-client.js';
import { publishToGhost } from './ghost-publisher.js';
import { publishToPinterest } from './pinterest-publisher.js';
import { fetchFirstProductImageUrl } from './product-enricher.js';
import { triggerPublication } from './publication-orchestrator.js';

const mockGetPost = vi.mocked(getContentPost);
const mockUpdate = vi.mocked(updateContentPost);
const mockSelectDrive = vi.mocked(selectDriveImage);
const mockPublishGhost = vi.mocked(publishToGhost);
const mockPublishPin = vi.mocked(publishToPinterest);
const mockFetchImageUrl = vi.mocked(fetchFirstProductImageUrl);

const BASE_POST = {
  id: 'post-123',
  clientId: 'plaka',
  status: 'aprovado' as const,
  topic: 'skincare',
  title: 'Post de teste',
  meta: null,
  bodyPreview: null,
  bodyFull: null,
  imageDesc: null,
  pinCopy: null,
  pinHashtags: null,
  imageDriveUrl: null,
  blogUrl: null,
  pinUrl: null,
  errorMsg: null,
  rejectionNote: null,
  createdAt: new Date().toISOString(),
  approvedAt: new Date().toISOString(),
  publishedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate.mockResolvedValue(BASE_POST);
  mockPublishGhost.mockResolvedValue(undefined);
  mockPublishPin.mockResolvedValue(undefined);
});

describe('triggerPublication', () => {
  it('returns early when post not found', async () => {
    mockGetPost.mockResolvedValue(null);
    await triggerPublication('post-not-found');
    expect(mockSelectDrive).not.toHaveBeenCalled();
    expect(mockPublishGhost).not.toHaveBeenCalled();
  });

  it('stores Drive image URL when Drive returns a file', async () => {
    mockGetPost.mockResolvedValue(BASE_POST);
    mockSelectDrive.mockResolvedValueOnce({ fileId: 'drive-file-1', fileName: 'img.jpg', mimeType: 'image/jpeg' });
    // Re-fetch returns post with imageDriveUrl
    const postWithImage = { ...BASE_POST, imageDriveUrl: 'https://drive.google.com/file/d/drive-file-1/view' };
    mockGetPost.mockResolvedValueOnce(BASE_POST);  // initial fetch
    mockGetPost.mockResolvedValueOnce(postWithImage); // after Drive
    mockGetPost.mockResolvedValueOnce(postWithImage); // after Ghost

    await triggerPublication('post-123');

    expect(mockUpdate).toHaveBeenCalledWith('post-123', expect.objectContaining({
      imageDriveUrl: expect.stringContaining('drive-file-1'),
    }));
  });

  it('calls publishToGhost with updated post (Story 6.2)', async () => {
    const postWithImage = { ...BASE_POST, imageDriveUrl: 'https://drive.google.com/file/d/file-1/view' };
    mockGetPost.mockResolvedValue(postWithImage);
    mockSelectDrive.mockResolvedValueOnce(null); // Drive fails gracefully
    mockFetchImageUrl.mockResolvedValueOnce(null); // no product image

    await triggerPublication('post-123');

    expect(mockPublishGhost).toHaveBeenCalledWith(expect.objectContaining({ id: 'post-123' }), undefined);
  });

  it('calls publishToPinterest after Ghost', async () => {
    const postWithBlog = { ...BASE_POST, imageDriveUrl: 'https://drive.google.com/file/d/f1/view', blogUrl: 'http://187.77.37.88:2368/post/' };
    mockGetPost.mockResolvedValue(postWithBlog);
    mockSelectDrive.mockResolvedValueOnce(null);

    await triggerPublication('post-123');

    expect(mockPublishGhost).toHaveBeenCalled();
    expect(mockPublishPin).toHaveBeenCalled();
  });

  it('AC5: Pinterest failure does not throw or block', async () => {
    const postWithBlog = { ...BASE_POST, imageDriveUrl: null, blogUrl: 'http://187.77.37.88:2368/post/' };
    mockGetPost.mockResolvedValue(postWithBlog);
    mockSelectDrive.mockResolvedValueOnce(null);
    mockPublishPin.mockRejectedValueOnce(new Error('Pinterest API down'));

    // Should not throw
    await expect(triggerPublication('post-123')).resolves.toBeUndefined();
    expect(mockPublishGhost).toHaveBeenCalled();
  });

  it('Drive failure does not block pipeline', async () => {
    mockGetPost.mockResolvedValue(BASE_POST);
    mockSelectDrive.mockRejectedValueOnce(new Error('Drive offline'));
    // After failed Drive, re-fetch returns original post
    mockGetPost.mockResolvedValue(BASE_POST);

    await expect(triggerPublication('post-123')).resolves.toBeUndefined();
    expect(mockPublishGhost).toHaveBeenCalled();
  });

  // ─── Story 6.7 — feature image ─────────────────────────────────────────────

  it('AC2: passa featureImageUrl para publishToGhost quando disponível', async () => {
    mockGetPost.mockResolvedValue(BASE_POST);
    mockSelectDrive.mockResolvedValueOnce(null);
    mockFetchImageUrl.mockResolvedValueOnce('https://cdn.plaka.com.br/produto.jpg');

    await triggerPublication('post-123');

    expect(mockPublishGhost).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'post-123' }),
      'https://cdn.plaka.com.br/produto.jpg',
    );
  });

  it('AC6: passa undefined para publishToGhost quando fetchFirstProductImageUrl retorna null', async () => {
    mockGetPost.mockResolvedValue(BASE_POST);
    mockSelectDrive.mockResolvedValueOnce(null);
    mockFetchImageUrl.mockResolvedValueOnce(null);

    await triggerPublication('post-123');

    expect(mockPublishGhost).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'post-123' }),
      undefined,
    );
  });

  it('AC6: falha em fetchFirstProductImageUrl não bloqueia publicação', async () => {
    mockGetPost.mockResolvedValue(BASE_POST);
    mockSelectDrive.mockResolvedValueOnce(null);
    mockFetchImageUrl.mockRejectedValueOnce(new Error('NuvemShop offline'));

    await expect(triggerPublication('post-123')).resolves.toBeUndefined();
    expect(mockPublishGhost).toHaveBeenCalled();
  });
});
