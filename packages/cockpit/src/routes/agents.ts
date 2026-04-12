// Agents panel — shows recent agent activity
// GET /cockpit/agents

import { Hono } from 'hono';
import { getAgentActivity, getInProgressStories, getRecentDoneStories } from '../services/agent-activity.service.js';
import { renderShell } from './shell.js';

const agentsRouter = new Hono();

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Builds HTML for the recent commits section.
 */
function buildCommitsHtml(commits: Awaited<ReturnType<typeof getAgentActivity>>): string {
  if (commits.length === 0) {
    return `<div class="no-activity">Nenhum commit encontrado nos últimos registros.</div>`;
  }

  const rows = commits
    .map((c) => {
      const storyBadge = c.storyRef
        ? `<span class="story-badge">Story ${c.storyRef}</span>`
        : '';
      return `
        <tr>
          <td class="commit-hash"><code>${c.hash}</code></td>
          <td class="commit-author">${escapeHtml(c.author)}</td>
          <td class="commit-message">${escapeHtml(c.message)} ${storyBadge}</td>
          <td class="commit-date">${formatDate(c.date)}</td>
        </tr>`;
    })
    .join('');

  return `
    <table class="activity-table">
      <thead>
        <tr>
          <th>Hash</th>
          <th>Autor</th>
          <th>Mensagem</th>
          <th>Data</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}

/**
 * Builds HTML for the in-progress stories section.
 */
function buildInProgressHtml(stories: Awaited<ReturnType<typeof getInProgressStories>>): string {
  if (stories.length === 0) {
    return `<div class="no-activity">Nenhum agente com story em andamento no momento.</div>`;
  }

  return stories
    .map((s) => {
      return `
        <div class="story-card inprogress">
          <div class="story-id">Story ${escapeHtml(s.storyId)}</div>
          <div class="story-title">${escapeHtml(s.title)}</div>
          <div class="story-meta">
            <span class="story-agent">${escapeHtml(s.assignedTo)}</span>
            <span class="story-status inprogress">Em andamento</span>
          </div>
        </div>`;
    })
    .join('');
}

/**
 * Builds HTML for the recent done stories section.
 */
function buildRecentDoneHtml(stories: Awaited<ReturnType<typeof getRecentDoneStories>>): string {
  if (stories.length === 0) {
    return `<div class="no-activity">Nenhuma entrega nas últimas 48 horas.</div>`;
  }

  return stories
    .map((s) => {
      return `
        <div class="story-card done">
          <div class="story-id">Story ${escapeHtml(s.storyId)}</div>
          <div class="story-title">${escapeHtml(s.title)}</div>
          <div class="story-meta">
            <span class="story-agent">${escapeHtml(s.assignedTo)}</span>
            <span class="story-status done">Entregue</span>
          </div>
        </div>`;
    })
    .join('');
}

/** Minimal HTML escaping to prevent XSS from file/git data */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const AGENTS_EXTRA_CSS = `
  /* Agent activity panel styles */
  .section {
    background: #fff;
    border-radius: 10px;
    padding: 20px 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,.08);
    margin-bottom: 24px;
  }
  .section h2 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 16px;
    color: #2d3748;
  }

  /* Commits table */
  .activity-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  .activity-table th {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 2px solid #e2e8f0;
    color: #4a5568;
    font-weight: 600;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: .05em;
  }
  .activity-table td {
    padding: 8px 10px;
    border-bottom: 1px solid #f0f4f8;
    vertical-align: top;
  }
  .activity-table tr:last-child td { border-bottom: none; }
  .commit-hash code {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 0.75rem;
    color: #4299e1;
    background: #ebf8ff;
    padding: 2px 5px;
    border-radius: 3px;
  }
  .commit-author { color: #4a5568; font-weight: 500; }
  .commit-message { color: #2d3748; }
  .commit-date { color: #718096; white-space: nowrap; }
  .story-badge {
    display: inline-block;
    background: #e9d8fd;
    color: #553c9a;
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 0.65rem;
    font-weight: 600;
    margin-left: 6px;
  }

  /* Story cards */
  .stories-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }
  .story-card {
    background: #f7fafc;
    border-radius: 8px;
    padding: 14px 16px;
    border-left: 4px solid #e2e8f0;
  }
  .story-card.inprogress { border-left-color: #4299e1; }
  .story-card.done { border-left-color: #48bb78; }
  .story-id {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: #718096;
    margin-bottom: 4px;
  }
  .story-title {
    font-weight: 600;
    font-size: 0.9rem;
    color: #2d3748;
    margin-bottom: 8px;
  }
  .story-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .story-agent {
    font-size: 0.75rem;
    color: #4a5568;
    background: #edf2f7;
    padding: 2px 7px;
    border-radius: 10px;
  }
  .story-status {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 10px;
  }
  .story-status.inprogress { background: #bee3f8; color: #2b6cb0; }
  .story-status.done { background: #c6f6d5; color: #276749; }

  /* Empty state */
  .no-activity {
    text-align: center;
    color: #718096;
    font-size: 0.875rem;
    padding: 20px;
  }
`;

agentsRouter.get('/', async (c) => {
  const [commits, inProgress, recentDone] = await Promise.all([
    Promise.resolve(getAgentActivity()),
    getInProgressStories(),
    getRecentDoneStories(48),
  ]);

  const generatedAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const content = `
    <style>${AGENTS_EXTRA_CSS}</style>

    <div class="main-header">
      <h1>Atividade dos Agentes</h1>
      <div class="subtitle">Últimos 20 commits e stories em andamento &nbsp;|&nbsp; Gerado em: ${generatedAt}</div>
    </div>

    <div class="section">
      <h2>Agentes com Trabalho em Andamento</h2>
      <div class="stories-grid">
        ${buildInProgressHtml(inProgress)}
      </div>
    </div>

    <div class="section">
      <h2>Entregas Recentes (últimas 48h)</h2>
      <div class="stories-grid">
        ${buildRecentDoneHtml(recentDone)}
      </div>
    </div>

    <div class="section">
      <h2>Últimos 20 Commits</h2>
      ${buildCommitsHtml(commits)}
    </div>
  `;

  return c.html(renderShell({ title: 'Agentes', activePanel: 'agents', content }));
});

export { agentsRouter };
