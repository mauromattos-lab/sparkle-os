// Unit tests for Publication Orchestrator — Stories 5.3 + 5.4 + 5.5

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sparkle-os/core', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@sparkle-os/core')>();
  return { ...mod, getContentPost: vi.fn(), updateContentPost: vi.fn() };
});

vi.mock('./drive-client.js', () => ({
  selectDriveImage: vi.fn(),
}));

vi.mock('./nuvemshop-publisher.js', () => ({
  publishToNuvemShop: vi.fn(),
}));

vi.mock('./pinterest-publisher.js', () => ({
  publishToPinterest: vi.fn(),
}));

import { getContentPost, updateContentPost } from '@sparkle-os/core';
import { selectDriveImage } from './drive-client.js';
import { publishToNuvemShop } from './nuvemshop-publisher.js';
import { publishToPinterest } from './pinterest-publisher.js';
import { triggerPublication } from './publication-orchestrator.js';

const mockGetPost = vi.mocked(getContentPost);
const mockUpdate = vi.mocked(updateContentPost);
const mockSelectDrive = vi.mocked(selectDriveImage);
const mockPublishNuvem = vi.mocked(publishToNuvemShop);
const mockPublishPin = vi.mocked(publishToPinterest);

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
  mockPublishNuvem.mockResolvedValue(undefined);
  mockPublishPin.mockResolvedValue(undefined);
});

describe('triggerPublication', () => {
  it('returns early when post not found', async () => {
    mockGetPost.mockResolvedValue(null);
    await triggerPublication('post-not-found');
    expect(mockSelectDrive).not.toHaveBeenCalled();
    expect(mockPublishNuvem).not.toHaveBeenCalled();
  });

  it('stores Drive image URL when Drive returns a file', async () => {
    mockGetPost.mockResolvedValue(BASE_POST);
    mockSelectDrive.mockResolvedValueOnce({ fileId: 'drive-file-1', fileName: 'img.jpg', mimeType: 'image/jpeg' });
    // Re-fetch returns post with imageDriveUrl
    const postWithImage = { ...BASE_POST, imageDriveUrl: 'https://drive.google.com/file/d/drive-file-1/view' };
    mockGetPost.mockResolvedValueOnce(BASE_POST);  // initial fetch
    mockGetPost.mockResolvedValueOnce(postWithImage); // after Drive
    mockGetPost.mockResolvedValueOnce(postWithImage); // after NuvemShop

    await triggerPublication('post-123');

    expect(mockUpdate).toHaveBeenCalledWith('post-123', expect.objectContaining({
      imageDriveUrl: expect.stringContaining('drive-file-1'),
    }));
  });

  it('calls publishToNuvemShop with updated post', async () => {
    const postWithImage = { ...BASE_POST, imageDriveUrl: 'https://drive.google.com/file/d/file-1/view' };
    mockGetPost.mockResolvedValue(postWithImage);
    mockSelectDrive.mockResolvedValueOnce(null); // Drive fails gracefully

    await triggerPublication('post-123');

    expect(mockPublishNuvem).toHaveBeenCalledWith(expect.objectContaining({ id: 'post-123' }));
  });

  it('calls publishToPinterest after NuvemShop', async () => {
    const postWithBlog = { ...BASE_POST, imageDriveUrl: 'https://drive.google.com/file/d/f1/view', blogUrl: 'https://plaka.com/blog/post' };
    mockGetPost.mockResolvedValue(postWithBlog);
    mockSelectDrive.mockResolvedValueOnce(null);

    await triggerPublication('post-123');

    expect(mockPublishNuvem).toHaveBeenCalled();
    expect(mockPublishPin).toHaveBeenCalled();
  });

  it('AC5: Pinterest failure does not throw or block', async () => {
    const postWithBlog = { ...BASE_POST, imageDriveUrl: null, blogUrl: 'https://plaka.com/blog/post' };
    mockGetPost.mockResolvedValue(postWithBlog);
    mockSelectDrive.mockResolvedValueOnce(null);
    mockPublishPin.mockRejectedValueOnce(new Error('Pinterest API down'));

    // Should not throw
    await expect(triggerPublication('post-123')).resolves.toBeUndefined();
    expect(mockPublishNuvem).toHaveBeenCalled();
  });

  it('Drive failure does not block pipeline', async () => {
    mockGetPost.mockResolvedValue(BASE_POST);
    mockSelectDrive.mockRejectedValueOnce(new Error('Drive offline'));
    // After failed Drive, re-fetch returns original post
    mockGetPost.mockResolvedValue(BASE_POST);

    await expect(triggerPublication('post-123')).resolves.toBeUndefined();
    expect(mockPublishNuvem).toHaveBeenCalled();
  });
});
