// Unit tests for Content Engine panel (Story 5.2)
// Tests: route renders HTML, pending post display, approve/reject actions

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../index.js';

// Mock @sparkle-os/core content functions
vi.mock('@sparkle-os/core', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@sparkle-os/core')>();
  return {
    ...mod,
    getPendingPostForToday: vi.fn(),
    getRecentPosts: vi.fn(),
    updateContentPost: vi.fn(),
  };
});

// Mock publication pipeline so cockpit tests don't trigger real publishers
vi.mock('@sparkle-os/content-engine/publisher', () => ({
  triggerPublication: vi.fn().mockResolvedValue(undefined),
}));

// Also mock fetch for overview panel (used by other routes in same app)
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { getPendingPostForToday, getRecentPosts, updateContentPost } from '@sparkle-os/core';

const mockGetPending = vi.mocked(getPendingPostForToday);
const mockGetRecent = vi.mocked(getRecentPosts);
const mockUpdate = vi.mocked(updateContentPost);

const BASE_POST = {
  id: 'post-123',
  clientId: 'plaka',
  status: 'aguardando_aprovacao' as const,
  topic: 'skincare',
  title: 'Como cuidar da pele no inverno',
  meta: 'Dicas essenciais de skincare para o frio',
  bodyPreview: 'Com a chegada do inverno, a pele resseca mais facilmente...',
  bodyFull: null,
  imageDesc: 'Foto da linha Plaka Hidratante — fundo branco limpo',
  pinCopy: 'Sua pele merece cuidado extra no inverno ❄️',
  pinHashtags: '#skincare #inverno #Plaka',
  imageDriveUrl: null,
  blogUrl: null,
  pinUrl: null,
  errorMsg: null,
  rejectionNote: null,
  createdAt: new Date('2026-04-12T08:00:00Z').toISOString(),
  approvedAt: null,
  publishedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ status: 'ok', db: 'ok', embeddingService: 'ok' }),
  });
  mockGetRecent.mockResolvedValue([]);
});

describe('GET /cockpit/content', () => {
  it('AC1: returns 200 with HTML content type', async () => {
    mockGetPending.mockResolvedValue(null);

    const res = await app.fetch(new Request('http://localhost/cockpit/content'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('AC1: shows "Content Engine" in the page when no pending post', async () => {
    mockGetPending.mockResolvedValue(null);

    const res = await app.fetch(new Request('http://localhost/cockpit/content'));
    const html = await res.text();

    expect(html).toContain('Content Engine');
    expect(html).toContain('Nenhum post aguardando aprovação hoje');
  });

  it('AC2: shows title, meta, body preview, image desc, pin copy when post is pending', async () => {
    mockGetPending.mockResolvedValue(BASE_POST);

    const res = await app.fetch(new Request('http://localhost/cockpit/content'));
    const html = await res.text();

    expect(html).toContain('Como cuidar da pele no inverno');
    expect(html).toContain('Dicas essenciais de skincare para o frio');
    expect(html).toContain('Com a chegada do inverno');
    expect(html).toContain('Foto da linha Plaka Hidratante');
    expect(html).toContain('Sua pele merece cuidado extra no inverno');
  });

  it('AC3: shows Aprovar and Rejeitar buttons when post awaits approval', async () => {
    mockGetPending.mockResolvedValue(BASE_POST);

    const res = await app.fetch(new Request('http://localhost/cockpit/content'));
    const html = await res.text();

    expect(html).toContain('Aprovar');
    expect(html).toContain('Rejeitar com nota');
  });

  it('AC6: shows real-time status badge', async () => {
    mockGetPending.mockResolvedValue(BASE_POST);

    const res = await app.fetch(new Request('http://localhost/cockpit/content'));
    const html = await res.text();

    expect(html).toContain('Aguardando aprovação');
  });

  it('AC7: renders history table when recent posts exist', async () => {
    mockGetPending.mockResolvedValue(null);
    mockGetRecent.mockResolvedValue([
      { ...BASE_POST, id: 'post-old', status: 'publicado', publishedAt: new Date('2026-04-10T10:00:00Z').toISOString() },
    ]);

    const res = await app.fetch(new Request('http://localhost/cockpit/content'));
    const html = await res.text();

    expect(html).toContain('Histórico');
    expect(html).toContain('Como cuidar da pele no inverno');
    expect(html).toContain('Publicado');
  });

  it('AC4: shows clientId badge in pending post and history', async () => {
    mockGetPending.mockResolvedValue(BASE_POST);
    mockGetRecent.mockResolvedValue([
      { ...BASE_POST, id: 'post-old', status: 'publicado', publishedAt: new Date('2026-04-10T10:00:00Z').toISOString() },
    ]);

    const res = await app.fetch(new Request('http://localhost/cockpit/content'));
    const html = await res.text();

    // clientId badge should appear (at least twice: pending + history row)
    const matches = html.match(/plaka/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    // History table should have a Cliente column header
    expect(html).toContain('Cliente');
  });

  it('includes Content Engine in sidebar navigation', async () => {
    mockGetPending.mockResolvedValue(null);

    const res = await app.fetch(new Request('http://localhost/cockpit/content'));
    const html = await res.text();

    expect(html).toContain('Content Engine');
    // Active panel should be highlighted
    expect(html).toContain('/cockpit/content');
  });
});

describe('POST /cockpit/content/approve/:id', () => {
  it('AC4: calls updateContentPost with status aprovado and redirects', async () => {
    mockUpdate.mockResolvedValue({ ...BASE_POST, status: 'aprovado' });

    const req = new Request('http://localhost/cockpit/content/approve/post-123', {
      method: 'POST',
    });
    const res = await app.fetch(req);

    expect(mockUpdate).toHaveBeenCalledWith('post-123', expect.objectContaining({
      status: 'aprovado',
      approvedAt: expect.any(Date),
    }));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/cockpit/content');
  });
});

describe('POST /cockpit/content/reject/:id', () => {
  it('AC5: calls updateContentPost with status gerando and rejection note, then redirects', async () => {
    mockUpdate.mockResolvedValue({ ...BASE_POST, status: 'gerando', rejectionNote: 'Foque mais nos benefícios' });

    const formData = new FormData();
    formData.append('note', 'Foque mais nos benefícios');

    const req = new Request('http://localhost/cockpit/content/reject/post-123', {
      method: 'POST',
      body: formData,
    });
    const res = await app.fetch(req);

    expect(mockUpdate).toHaveBeenCalledWith('post-123', expect.objectContaining({
      status: 'gerando',
      rejectionNote: 'Foque mais nos benefícios',
    }));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/cockpit/content');
  });
});
