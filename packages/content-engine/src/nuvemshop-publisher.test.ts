// Unit tests for NuvemShop Blog Publisher — Story 5.3

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sparkle-os/core', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@sparkle-os/core')>();
  return { ...mod, updateContentPost: vi.fn() };
});

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { updateContentPost } from '@sparkle-os/core';
import { markdownToHtml, publishToNuvemShop, getNuvemShopImageUrl } from './nuvemshop-publisher.js';

const mockUpdate = vi.mocked(updateContentPost);

const BASE_POST = {
  id: 'post-123',
  clientId: 'plaka',
  status: 'aprovado' as const,
  topic: 'skincare',
  title: 'Como cuidar da pele no inverno',
  meta: 'Dicas essenciais de skincare para o frio',
  bodyPreview: 'Com a chegada do inverno...',
  bodyFull: '# Cuidados com a Pele\n\nO inverno resseca a pele. **Use hidratante** diariamente.\n\n- Beba água\n- Use protetor solar',
  imageDesc: 'Foto da linha Plaka Hidratante',
  pinCopy: 'Sua pele merece cuidado extra ❄️',
  pinHashtags: '#skincare #inverno',
  imageDriveUrl: 'https://drive.google.com/file/d/file-abc/view',
  blogUrl: null,
  pinUrl: null,
  errorMsg: null,
  rejectionNote: null,
  createdAt: new Date('2026-04-12T08:00:00Z').toISOString(),
  approvedAt: new Date('2026-04-12T09:00:00Z').toISOString(),
  publishedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mockUpdate.mockResolvedValue({ ...BASE_POST, status: 'publicado' });
});

describe('markdownToHtml', () => {
  it('converts headings', () => {
    expect(markdownToHtml('# H1\n## H2\n### H3')).toContain('<h1>H1</h1>');
    expect(markdownToHtml('# H1\n## H2\n### H3')).toContain('<h2>H2</h2>');
    expect(markdownToHtml('# H1\n## H2\n### H3')).toContain('<h3>H3</h3>');
  });

  it('converts bold and italic', () => {
    expect(markdownToHtml('**bold** and *italic*')).toContain('<strong>bold</strong>');
    expect(markdownToHtml('**bold** and *italic*')).toContain('<em>italic</em>');
  });

  it('converts links', () => {
    const html = markdownToHtml('[Plaka](https://plaka.com)');
    expect(html).toContain('<a href="https://plaka.com">Plaka</a>');
  });
});

describe('publishToNuvemShop', () => {
  it('AC6: sets status erro_publicacao when env vars missing', async () => {
    await publishToNuvemShop(BASE_POST);
    expect(mockUpdate).toHaveBeenCalledWith('post-123', expect.objectContaining({
      status: 'erro_publicacao',
      errorMsg: expect.stringContaining('NUVEMSHOP_ACCESS_TOKEN'),
    }));
  });

  it('AC1+AC4: sets status publicado with blogUrl on success', async () => {
    vi.stubEnv('NUVEMSHOP_ACCESS_TOKEN', 'token-abc');
    vi.stubEnv('NUVEMSHOP_USER_ID', '123456');

    // getNuvemShopImageUrl call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ images: [{ src: 'https://cdn.nuvemshop.com/img.jpg' }] }],
    });
    // Post article call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 99, url: 'https://plaka.com.br/blog/como-cuidar-da-pele' }),
    });

    await publishToNuvemShop(BASE_POST);

    expect(mockUpdate).toHaveBeenCalledWith('post-123', expect.objectContaining({
      status: 'publicado',
      blogUrl: 'https://plaka.com.br/blog/como-cuidar-da-pele',
      publishedAt: expect.any(Date),
    }));
  });

  it('AC2: includes title, content HTML, meta_description in article body', async () => {
    vi.stubEnv('NUVEMSHOP_ACCESS_TOKEN', 'token-abc');
    vi.stubEnv('NUVEMSHOP_USER_ID', '123456');

    mockFetch.mockResolvedValueOnce({ ok: false }); // image fetch fails → no image
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 100, url: 'https://plaka.com.br/blog/post' }),
    });

    await publishToNuvemShop(BASE_POST);

    const [, reqOptions] = mockFetch.mock.calls[1] as [string, RequestInit];
    const parsed = JSON.parse(reqOptions.body as string) as Record<string, unknown>;
    expect((parsed.title as Record<string, string>).pt).toBe('Como cuidar da pele no inverno');
    expect((parsed.content as Record<string, string>).pt).toContain('<h1>Cuidados com a Pele</h1>');
    expect((parsed.meta_description as Record<string, string>).pt).toBe('Dicas essenciais de skincare para o frio');
  });

  it('AC5: sets status erro_publicacao on API error', async () => {
    vi.stubEnv('NUVEMSHOP_ACCESS_TOKEN', 'token-abc');
    vi.stubEnv('NUVEMSHOP_USER_ID', '123456');

    mockFetch.mockResolvedValueOnce({ ok: false }); // image fetch fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    await publishToNuvemShop(BASE_POST);

    expect(mockUpdate).toHaveBeenCalledWith('post-123', expect.objectContaining({
      status: 'erro_publicacao',
      errorMsg: expect.stringContaining('500'),
    }));
  });
});

describe('getNuvemShopImageUrl', () => {
  it('returns null on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    const result = await getNuvemShopImageUrl('skincare', 'token', 'user123');
    expect(result).toBeNull();
  });

  it('returns null when products have no images', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [{ images: [] }] });
    const result = await getNuvemShopImageUrl('skincare', 'token', 'user123');
    expect(result).toBeNull();
  });

  it('returns image URL from first product', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ images: [{ src: 'https://cdn.com/img.jpg' }] }],
    });
    const result = await getNuvemShopImageUrl('skincare', 'token', 'user123');
    expect(result).toBe('https://cdn.com/img.jpg');
  });
});
