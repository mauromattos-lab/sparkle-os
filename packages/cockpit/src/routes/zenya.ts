// Zenya panel — Zenya nucleus operational status
// GET /cockpit/zenya

import { Hono } from 'hono';
import { getZenyaStatus, getEpicStoryProgress } from '../services/zenya.service.js';
import { renderShell } from './shell.js';

const zenyaRouter = new Hono();

// ---------------------------------------------------------------------------
// HTML builders
// ---------------------------------------------------------------------------

function buildN8nStatusHtml(
  online: boolean,
  workflowCount: number | null,
  error: string | null,
): string {
  if (!online) {
    return `
      <div class="integration-card offline">
        <div class="integration-name">
          <span class="status offline">
            <span class="status-dot"></span>n8n — Offline
          </span>
        </div>
        <div class="alert-item" style="margin-top:12px;">
          <div class="alert-title">n8n indisponível</div>
          <div class="alert-desc">${error ?? 'Serviço não responde.'}</div>
          <div class="alert-sop">
            <strong>O que verificar:</strong>
            Acesse a VPS onde o n8n está hospedado e confirme que o serviço está rodando.
            Execute: <code>systemctl status n8n</code> ou <code>docker ps | grep n8n</code>.
            Se parado, reinicie com: <code>systemctl start n8n</code>.
            Configure a variável <code>N8N_URL</code> no <code>.env</code> com a URL correta (VPS ou tunnel SSH).
          </div>
        </div>
      </div>
    `;
  }

  const workflowLine =
    workflowCount !== null
      ? `<div class="integration-detail">${workflowCount} workflow${workflowCount !== 1 ? 's' : ''} ativo${workflowCount !== 1 ? 's' : ''}</div>`
      : `<div class="integration-detail" style="color:#a0aec0;">Contagem de workflows indisponível — configure N8N_API_KEY para habilitar</div>`;

  return `
    <div class="integration-card ok">
      <div class="integration-name">
        <span class="status ok">
          <span class="status-dot"></span>n8n — Operacional
        </span>
      </div>
      ${workflowLine}
    </div>
  `;
}

function buildStoryProgressHtml(
  done: number,
  inProgress: number,
  inReview: number,
  ready: number,
  draft: number,
  total: number,
): string {
  if (total === 0) {
    return `<div class="no-alerts">Nenhuma story do Epic 2 encontrada em <code>docs/stories/</code>.</div>`;
  }

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return `
    <div class="cards">
      <div class="card">
        <div class="card-label">Concluídas</div>
        <div class="card-value" style="color:#276749;">${done}</div>
        <div class="integration-detail">${pct(done)}% do total</div>
      </div>
      <div class="card">
        <div class="card-label">Em Progresso</div>
        <div class="card-value" style="color:#2b6cb0;">${inProgress}</div>
      </div>
      <div class="card">
        <div class="card-label">Em Revisão</div>
        <div class="card-value" style="color:#744210;">${inReview}</div>
      </div>
      <div class="card">
        <div class="card-label">Prontas</div>
        <div class="card-value" style="color:#4a5568;">${ready}</div>
      </div>
      <div class="card">
        <div class="card-label">Rascunho</div>
        <div class="card-value" style="color:#a0aec0;">${draft}</div>
      </div>
      <div class="card">
        <div class="card-label">Total</div>
        <div class="card-value">${total}</div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

zenyaRouter.get('/', async (c) => {
  const [zenyaStatus, epicProgress] = await Promise.all([
    getZenyaStatus(),
    getEpicStoryProgress('2.'),
  ]);

  const checkedAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const n8nHtml = buildN8nStatusHtml(
    zenyaStatus.online,
    zenyaStatus.workflowCount,
    zenyaStatus.error,
  );

  const storyHtml = buildStoryProgressHtml(
    epicProgress.done,
    epicProgress.inProgress,
    epicProgress.inReview,
    epicProgress.ready,
    epicProgress.draft,
    epicProgress.total,
  );

  const content = `
    <div class="main-header">
      <h1>Núcleo Zenya</h1>
      <div class="subtitle">Status operacional da Zenya — verificado em ${checkedAt}</div>
    </div>

    <div class="alert-section">
      <h2>Conectividade n8n</h2>
      <div class="integration-grid">
        ${n8nHtml}
      </div>
    </div>

    <div class="alert-section">
      <h2>Progresso das Stories — Epic 2 (Zenya)</h2>
      ${storyHtml}
    </div>
  `;

  return c.html(renderShell({ title: 'Zenya', activePanel: 'zenya', content }));
});

export { zenyaRouter };
