// Content Engine panel — Gate de aprovação do AEO Squad Plaka
// GET  /cockpit/content        → exibe painel com post pendente + histórico
// POST /cockpit/content/approve/:id → aprova post (status → aprovado)
// POST /cockpit/content/reject/:id  → rejeita com nota (status → gerando, guarda nota)

import type { Context } from 'hono';
import {
  getPendingPost,
  getRecentHistory,
  approvePost,
  rejectPost,
  type ContentPost,
} from '../services/content-engine.service.js';
import { renderShell } from './shell.js';

// Status labels for display (AC6)
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  gerando: { label: 'Gerando…', color: '#d69e2e' },
  aguardando_aprovacao: { label: 'Aguardando aprovação', color: '#3182ce' },
  aprovado: { label: 'Aprovado', color: '#38a169' },
  publicado: { label: 'Publicado', color: '#2b6cb0' },
  escalado: { label: 'Escalado — requer atenção', color: '#e53e3e' },
  erro: { label: 'Erro', color: '#c53030' },
};

function statusBadge(status: string): string {
  const s = STATUS_LABELS[status] ?? { label: status, color: '#718096' };
  return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;background:${s.color}20;color:${s.color};border:1px solid ${s.color}40">${s.label}</span>`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildPendingPostHtml(post: ContentPost): string {
  const title = post.title ?? '(título ainda sendo gerado)';
  const meta = post.meta ?? '';
  const bodySnippet = post.bodyPreview
    ? post.bodyPreview.slice(0, 200) + (post.bodyPreview.length > 200 ? '…' : '')
    : '(corpo ainda sendo gerado)';
  const imageDesc = post.imageDesc ?? '(imagem ainda sendo selecionada)';
  const pinCopy = post.pinCopy ?? '(copy do pin ainda sendo gerado)';
  const pinHashtags = post.pinHashtags ?? '';
  const isPending = post.status === 'aguardando_aprovacao';
  const isGenerating = post.status === 'gerando' || post.status === 'escalado';

  const actionButtons = isPending
    ? `
    <div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap">
      <form method="POST" action="/cockpit/content/approve/${post.id}" style="margin:0">
        <button type="submit" style="padding:10px 28px;background:#38a169;color:#fff;border:none;border-radius:8px;font-size:0.9rem;font-weight:700;cursor:pointer;transition:opacity 0.15s" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
          ✓ Aprovar
        </button>
      </form>
      <button onclick="document.getElementById('reject-form-${post.id}').style.display='block';this.style.display='none'"
        style="padding:10px 28px;background:#fff;color:#e53e3e;border:2px solid #e53e3e;border-radius:8px;font-size:0.9rem;font-weight:700;cursor:pointer">
        ✕ Rejeitar com nota
      </button>
    </div>
    <div id="reject-form-${post.id}" style="display:none;margin-top:16px;background:#fff5f5;border-radius:8px;padding:16px;border:1px solid #fed7d7">
      <form method="POST" action="/cockpit/content/reject/${post.id}">
        <label style="display:block;font-size:0.85rem;font-weight:600;color:#c53030;margin-bottom:8px">
          Instrução para Lyra refazer:
        </label>
        <textarea name="note" required placeholder="Ex: Foque mais nos benefícios do produto, menos na rotina…"
          style="width:100%;padding:10px;border:1px solid #fc8181;border-radius:6px;font-size:0.85rem;min-height:80px;resize:vertical;font-family:inherit"></textarea>
        <div style="margin-top:10px;display:flex;gap:8px">
          <button type="submit" style="padding:8px 20px;background:#e53e3e;color:#fff;border:none;border-radius:6px;font-size:0.85rem;font-weight:700;cursor:pointer">
            Enviar rejeição
          </button>
          <button type="button" onclick="document.getElementById('reject-form-${post.id}').style.display='none';document.querySelector('button[onclick*=reject-form]').style.display='inline-block'"
            style="padding:8px 20px;background:#edf2f7;color:#4a5568;border:none;border-radius:6px;font-size:0.85rem;cursor:pointer">
            Cancelar
          </button>
        </div>
      </form>
    </div>`
    : isGenerating
    ? `<div style="margin-top:20px;padding:12px 16px;background:#fffbeb;border-radius:8px;border-left:4px solid #d69e2e;font-size:0.85rem;color:#744210">
        ⏳ Post ainda sendo gerado — botões de ação disponíveis quando pronto para revisão.
       </div>`
    : '';

  return `
    <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.08);margin-bottom:24px;border-left:4px solid #3182ce">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:20px">
        <h2 style="font-size:1.15rem;font-weight:700;color:#2d3748">Post do dia — ${formatDate(post.createdAt)}</h2>
        ${statusBadge(post.status)}
      </div>

      <div style="display:grid;gap:14px">
        <div>
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#718096;margin-bottom:4px">Título</div>
          <div style="font-size:1rem;font-weight:600;color:#1a202c">${title}</div>
        </div>

        ${meta ? `<div>
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#718096;margin-bottom:4px">Meta Description</div>
          <div style="font-size:0.875rem;color:#4a5568;font-style:italic">${meta}</div>
        </div>` : ''}

        <div>
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#718096;margin-bottom:4px">Preview do Corpo (200 chars)</div>
          <div style="font-size:0.875rem;color:#2d3748;background:#f7fafc;padding:12px;border-radius:6px;border-left:3px solid #e2e8f0">${bodySnippet}</div>
        </div>

        <div>
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#718096;margin-bottom:4px">Imagem Selecionada (Vista)</div>
          <div style="font-size:0.875rem;color:#2d3748;background:#f7fafc;padding:12px;border-radius:6px;border-left:3px solid #9ae6b4">${imageDesc}</div>
        </div>

        <div>
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#718096;margin-bottom:4px">Copy do Pin Pinterest</div>
          <div style="font-size:0.875rem;color:#2d3748;background:#f7fafc;padding:12px;border-radius:6px;border-left:3px solid #feb2b2">${pinCopy}</div>
          ${pinHashtags ? `<div style="font-size:0.8rem;color:#718096;margin-top:6px">${pinHashtags}</div>` : ''}
        </div>

        ${post.rejectionNote ? `<div>
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#c53030;margin-bottom:4px">Nota de Rejeição Anterior</div>
          <div style="font-size:0.85rem;color:#742a2a;background:#fff5f5;padding:10px;border-radius:6px;border-left:3px solid #fc8181;font-style:italic">"${post.rejectionNote}"</div>
        </div>` : ''}
      </div>

      ${actionButtons}
    </div>`;
}

function buildHistoryHtml(posts: ContentPost[]): string {
  if (posts.length === 0) {
    return `<div style="background:#fff;border-radius:10px;padding:24px;text-align:center;color:#a0aec0;font-size:0.875rem;box-shadow:0 1px 3px rgba(0,0,0,.08)">
      Nenhum post nos últimos 7 dias.
    </div>`;
  }

  const rows = posts
    .map((p) => {
      const title = p.title ?? '(sem título)';
      const published = p.publishedAt ? formatDate(p.publishedAt) : '—';
      return `
      <tr style="border-top:1px solid #edf2f7">
        <td style="padding:10px 12px;font-size:0.85rem;color:#2d3748;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${title}</td>
        <td style="padding:10px 12px">${statusBadge(p.status)}</td>
        <td style="padding:10px 12px;font-size:0.8rem;color:#718096">${formatDate(p.createdAt)}</td>
        <td style="padding:10px 12px;font-size:0.8rem;color:#718096">${published}</td>
      </tr>`;
    })
    .join('');

  return `
    <div style="background:#fff;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.08);overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid #edf2f7">
        <h2 style="font-size:1rem;font-weight:600;color:#2d3748">Histórico — últimos 7 dias</h2>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f7fafc">
            <th style="padding:10px 12px;text-align:left;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#718096">Título</th>
            <th style="padding:10px 12px;text-align:left;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#718096">Status</th>
            <th style="padding:10px 12px;text-align:left;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#718096">Criado</th>
            <th style="padding:10px 12px;text-align:left;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#718096">Publicado</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

export async function renderContentEngine(c: Context): Promise<Response> {
  const [pendingPost, history] = await Promise.all([
    getPendingPost(),
    getRecentHistory(),
  ]);

  const pendingHtml = pendingPost
    ? buildPendingPostHtml(pendingPost)
    : `<div style="background:#fff;border-radius:12px;padding:32px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:24px">
        <div style="font-size:2rem;margin-bottom:8px">✅</div>
        <h2 style="font-size:1rem;font-weight:600;color:#2d3748;margin-bottom:4px">Nenhum post aguardando aprovação hoje</h2>
        <p style="font-size:0.875rem;color:#718096">O squad gera um post diariamente às 8h. Volte amanhã!</p>
       </div>`;

  const content = `
    <div class="main-header">
      <h1>Content Engine</h1>
      <div class="subtitle">AEO Squad Plaka — aprovação de posts</div>
    </div>
    ${pendingHtml}
    ${buildHistoryHtml(history)}
  `;

  return c.html(renderShell({ title: 'Content Engine', activePanel: 'content', content }));
}

export async function handleApprove(c: Context): Promise<Response> {
  const id = c.req.param('id') ?? '';
  try {
    await approvePost(id);
    // TODO: trigger publication pipeline (Stories 5.3 + 5.4) once implemented
  } catch (err) {
    console.error('[content-engine] Approve failed:', err);
  }
  return c.redirect('/cockpit/content');
}

export async function handleReject(c: Context): Promise<Response> {
  const id = c.req.param('id') ?? '';
  let note = '';
  try {
    const body = await c.req.parseBody();
    note = typeof body['note'] === 'string' ? body['note'].trim() : '';
    await rejectPost(id, note);
  } catch (err) {
    console.error('[content-engine] Reject failed:', err);
  }
  return c.redirect('/cockpit/content');
}
