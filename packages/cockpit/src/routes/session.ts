// Session Summary panel — GET /cockpit/session
// Displays a 24h summary: commits, done stories, decisions, brain status
// Graceful degradation: shows available data even if some sources are offline

import type { Context } from 'hono';
import { getSessionSummary, type SessionSummary } from '../services/session-summary.service.js';
import { renderShell } from './shell.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function buildUnavailableWarning(unavailable: string[]): string {
  if (unavailable.length === 0) return '';
  const labels: Record<string, string> = {
    commits: 'Commits',
    stories: 'Stories',
    activity: 'Atividade',
    decisions: 'Decisões',
    brain: 'Cérebro',
  };
  const names = unavailable.map((u) => labels[u] ?? u).join(', ');
  return `
    <div style="background:#fffff0;border:1px solid #f6e05e;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:0.8rem;color:#744210">
      Fontes indisponíveis (degradação parcial): <strong>${names}</strong> — dados mostrados são parciais.
    </div>
  `;
}

function buildActivitySection(summary: SessionSummary): string {
  const { activity } = summary;

  if (!activity) {
    return `
      <div class="alert-section" style="margin-bottom:24px">
        <h2>Atividade — Últimas 24h</h2>
        <div class="no-alerts">Fonte de atividade indisponível</div>
      </div>
    `;
  }

  const { commits, recentDoneStories } = activity;

  // Commits section
  let commitsHtml: string;
  if (commits.length === 0) {
    commitsHtml = `<div class="no-alerts" style="padding:16px">Nenhum commit nas últimas 24h</div>`;
  } else {
    commitsHtml = commits
      .slice(0, 10)
      .map((c) => {
        const storyTag = c.storyRef
          ? `<span style="font-size:0.7rem;background:#ebf8ff;color:#2b6cb0;border-radius:4px;padding:1px 6px;margin-left:6px">${c.storyRef}</span>`
          : '';
        return `
          <div style="padding:10px 0;border-bottom:1px solid #f0f4f8;display:flex;align-items:baseline;gap:8px">
            <code style="font-size:0.75rem;color:#718096;flex-shrink:0">${c.hash}</code>
            <span style="font-size:0.875rem;color:#2d3748;flex:1">${c.message}${storyTag}</span>
            <span style="font-size:0.75rem;color:#a0aec0;flex-shrink:0">${c.author}</span>
          </div>
        `;
      })
      .join('');
    if (commits.length > 10) {
      commitsHtml += `<div style="font-size:0.75rem;color:#718096;padding:8px 0">+ ${commits.length - 10} commits adicionais</div>`;
    }
  }

  // Done stories section
  let storiesHtml: string;
  if (recentDoneStories.length === 0) {
    storiesHtml = `<div class="no-alerts" style="padding:16px">Nenhuma story concluída nas últimas 24h</div>`;
  } else {
    storiesHtml = recentDoneStories
      .map(
        (s) => `
        <div style="padding:10px 0;border-bottom:1px solid #f0f4f8;display:flex;align-items:center;gap:12px">
          <span style="font-size:0.75rem;font-weight:700;color:#276749;background:#f0fff4;border-radius:4px;padding:2px 8px;flex-shrink:0">Done</span>
          <span style="font-size:0.875rem;color:#2d3748">[${s.storyId}] ${s.title}</span>
          <span style="font-size:0.75rem;color:#a0aec0;margin-left:auto;flex-shrink:0">${s.assignedTo}</span>
        </div>
      `,
      )
      .join('');
  }

  const commitCount = commits.length;
  const storyCount = recentDoneStories.length;

  return `
    <div class="alert-section" style="margin-bottom:24px">
      <h2>Atividade — Últimas 24h</h2>
      <div class="cards" style="margin-top:16px;margin-bottom:20px">
        <div class="card">
          <div class="card-label">Commits</div>
          <div class="card-value" style="color:${commitCount > 0 ? '#2d3748' : '#a0aec0'}">${commitCount}</div>
        </div>
        <div class="card">
          <div class="card-label">Stories Concluídas</div>
          <div class="card-value" style="color:${storyCount > 0 ? '#276749' : '#a0aec0'}">${storyCount}</div>
        </div>
      </div>

      <div style="margin-bottom:20px">
        <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#4a5568;margin-bottom:8px">Commits recentes</div>
        ${commitsHtml}
      </div>

      <div>
        <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#4a5568;margin-bottom:8px">Stories concluídas</div>
        ${storiesHtml}
      </div>
    </div>
  `;
}

function buildDecisionsSection(decisionsCount: number | null): string {
  if (decisionsCount === null) {
    return `
      <div class="alert-section" style="margin-bottom:24px">
        <h2>Decisões Pendentes</h2>
        <div class="no-alerts">Core indisponível — dados de decisões não carregados</div>
      </div>
    `;
  }

  const countColor = decisionsCount > 0 ? '#c53030' : '#276749';
  const countLabel = decisionsCount === 0 ? 'Nenhuma decisão pendente' : `${decisionsCount} ${decisionsCount === 1 ? 'decisão pendente' : 'decisões pendentes'}`;
  const linkHtml =
    decisionsCount > 0
      ? `<a href="/cockpit/decisions" style="font-size:0.8rem;color:#2b6cb0;text-decoration:none;margin-left:12px">Ver todas →</a>`
      : '';

  return `
    <div class="alert-section" style="margin-bottom:24px">
      <h2>Decisões Pendentes</h2>
      <div style="display:flex;align-items:center;margin-top:12px">
        <span style="font-size:1.5rem;font-weight:700;color:${countColor}">${decisionsCount}</span>
        <span style="font-size:0.875rem;color:#718096;margin-left:12px">${countLabel}</span>
        ${linkHtml}
      </div>
    </div>
  `;
}

function buildBrainSection(brain: SessionSummary['brain']): string {
  if (brain === null) {
    return `
      <div class="alert-section" style="margin-bottom:24px">
        <h2>Cérebro Coletivo</h2>
        <div class="no-alerts">Brain API indisponível</div>
      </div>
    `;
  }

  if (!brain.healthy) {
    return `
      <div class="alert-section" style="margin-bottom:24px">
        <h2>Cérebro Coletivo</h2>
        <div style="display:flex;align-items:center;gap:8px;padding:12px 0">
          <span class="status offline"><span class="status-dot"></span>Offline</span>
          <span style="font-size:0.8rem;color:#718096;margin-left:8px">${brain.error}</span>
        </div>
        <a href="/cockpit/brain" style="font-size:0.8rem;color:#2b6cb0;text-decoration:none">Ver painel completo →</a>
      </div>
    `;
  }

  const { dashboard } = brain;
  const { summary, cycle } = dashboard;
  const completionRate = `${cycle.completionRate.toFixed(1)}%`;

  return `
    <div class="alert-section" style="margin-bottom:24px">
      <h2>Cérebro Coletivo <span class="status ok" style="margin-left:8px;font-size:0.8rem"><span class="status-dot"></span>Online</span></h2>
      <div class="cards" style="margin-top:16px;margin-bottom:12px">
        <div class="card">
          <div class="card-label">Total de Insights</div>
          <div class="card-value">${summary.total}</div>
        </div>
        <div class="card">
          <div class="card-label">Aplicados</div>
          <div class="card-value" style="color:#276749">${summary.by_status.applied}</div>
        </div>
        <div class="card">
          <div class="card-label">Ciclo de Conclusão</div>
          <div class="card-value" style="color:#2b6cb0">${completionRate}</div>
        </div>
      </div>
      <a href="/cockpit/brain" style="font-size:0.8rem;color:#2b6cb0;text-decoration:none">Ver painel completo →</a>
    </div>
  `;
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function renderSession(c: Context): Promise<Response> {
  const summary = await getSessionSummary();

  const generatedAt = formatDateTime(summary.generatedAt);

  if (summary.isEmpty) {
    const content = `
      <div class="main-header">
        <h1>Últimas 24h</h1>
        <div class="subtitle">Gerado em ${generatedAt}</div>
      </div>
      <div class="placeholder">
        <h2>Sistema em repouso — nenhuma atividade registrada</h2>
        <p style="margin-top:8px">Nenhum commit, story concluída ou decisão pendente nas últimas 24 horas.</p>
      </div>
    `;
    return c.html(renderShell({ title: 'Resumo', activePanel: 'session', content }));
  }

  const content = `
    <div class="main-header">
      <h1>Últimas 24h</h1>
      <div class="subtitle">Gerado em ${generatedAt} &nbsp;|&nbsp; Resumo automático do período</div>
    </div>

    ${buildUnavailableWarning(summary.unavailable)}
    ${buildActivitySection(summary)}
    ${buildDecisionsSection(summary.decisionsCount)}
    ${buildBrainSection(summary.brain)}
  `;

  return c.html(renderShell({ title: 'Resumo', activePanel: 'session', content }));
}
