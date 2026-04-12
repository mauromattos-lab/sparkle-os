// Epics panel — shows epic-level progress based on story frontmatter
// GET /cockpit/progress — Story 4.7

import type { Context } from 'hono';
import { parseAllStories, groupByEpic, type EpicProgress } from '../services/stories-parser.service.js';
import { renderShell } from './shell.js';

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function progressBarHtml(pct: number): string {
  const color = pct === 100 ? '#48bb78' : pct >= 50 ? '#4299e1' : '#ecc94b';
  return `
    <div style="background:#e2e8f0;border-radius:4px;height:8px;width:100%;margin-top:6px;">
      <div style="background:${color};border-radius:4px;height:8px;width:${pct}%;transition:width 0.3s;"></div>
    </div>`;
}

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    Done: '#48bb78',
    InProgress: '#4299e1',
    InReview: '#9f7aea',
    Ready: '#ecc94b',
    Draft: '#a0aec0',
  };
  const bg = colors[status] ?? '#a0aec0';
  return `<span style="display:inline-block;background:${bg};color:#fff;border-radius:4px;padding:2px 8px;font-size:0.7rem;font-weight:600;">${status}</span>`;
}

function buildEpicCard(epic: EpicProgress): string {
  const inProgressRows = epic.stories
    .filter((s) => s.status === 'InProgress')
    .map(
      (s) => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f0f4f8;">
        <span style="font-size:0.8rem;font-weight:600;color:#2d3748;min-width:48px;">${s.story_id}</span>
        <span style="flex:1;font-size:0.8rem;color:#4a5568;">${s.title}</span>
        ${statusBadge(s.status)}
        <span style="font-size:0.75rem;color:#718096;">${s.assigned_to}</span>
      </div>`,
    )
    .join('');

  const staleRows = epic.staleStories
    .map(
      (s) => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #fff5f5;background:#fff5f5;border-radius:4px;padding:8px;">
        <span style="font-size:0.8rem;font-weight:600;color:#c53030;min-width:48px;">${s.story_id}</span>
        <span style="flex:1;font-size:0.8rem;color:#742a2a;">${s.title}</span>
        ${statusBadge(s.status)}
        <span style="font-size:0.75rem;color:#c53030;">aguardando &gt;7d</span>
      </div>`,
    )
    .join('');

  const inProgressSection =
    inProgressRows
      ? `<div style="margin-top:16px;">
           <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#4299e1;margin-bottom:8px;">Em andamento</div>
           ${inProgressRows}
         </div>`
      : '';

  const staleSection =
    staleRows
      ? `<div style="margin-top:16px;">
           <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#c53030;margin-bottom:8px;">Aguardando (&gt;7 dias)</div>
           ${staleRows}
         </div>`
      : '';

  return `
    <div style="background:#fff;border-radius:10px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:20px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
        <div style="flex:1;">
          <div style="font-size:1rem;font-weight:700;color:#1a202c;">Épico ${epic.epicNum}</div>
          <div style="font-size:0.8rem;color:#718096;margin-top:2px;">
            ${epic.totalCount} stories &nbsp;|&nbsp;
            <span style="color:#48bb78;">${epic.doneCount} Done</span> &nbsp;|&nbsp;
            <span style="color:#4299e1;">${epic.inProgressCount} InProgress</span> &nbsp;|&nbsp;
            <span style="color:#9f7aea;">${epic.inReviewCount} InReview</span> &nbsp;|&nbsp;
            <span style="color:#ecc94b;">${epic.readyCount} Ready</span> &nbsp;|&nbsp;
            <span style="color:#a0aec0;">${epic.draftCount} Draft</span>
          </div>
          ${progressBarHtml(epic.completionPct)}
        </div>
        <div style="text-align:right;min-width:60px;">
          <div style="font-size:1.5rem;font-weight:700;color:${epic.completionPct === 100 ? '#276749' : '#2d3748'};">${epic.completionPct}%</div>
          <div style="font-size:0.7rem;color:#718096;">completo</div>
        </div>
      </div>
      ${inProgressSection}
      ${staleSection}
    </div>`;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function renderEpicsPanel(c: Context): Promise<Response> {
  const stories = await parseAllStories();
  const epics = groupByEpic(stories);

  const totalStories = stories.length;
  const totalDone = stories.filter((s) => s.status === 'Done').length;
  const totalInProgress = stories.filter((s) => s.status === 'InProgress').length;
  const overallPct = totalStories > 0 ? Math.round((totalDone / totalStories) * 100) : 0;
  const totalStale = epics.reduce((acc, e) => acc + e.staleStories.length, 0);

  const epicCardsHtml = epics.length > 0
    ? epics.map(buildEpicCard).join('')
    : `<div style="background:#fff;border-radius:10px;padding:48px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.08);color:#718096;">
         Nenhuma story encontrada em docs/stories/
       </div>`;

  const summaryCardsHtml = `
    <div class="cards" style="margin-bottom:24px;">
      <div class="card">
        <div class="card-label">Total de Stories</div>
        <div class="card-value">${totalStories}</div>
      </div>
      <div class="card">
        <div class="card-label">Concluídas</div>
        <div class="card-value" style="color:#276749;">${totalDone}</div>
      </div>
      <div class="card">
        <div class="card-label">Em Andamento</div>
        <div class="card-value" style="color:#2b6cb0;">${totalInProgress}</div>
      </div>
      <div class="card">
        <div class="card-label">Progresso Geral</div>
        <div class="card-value">${overallPct}%</div>
      </div>
      ${totalStale > 0 ? `
      <div class="card" style="border-left:4px solid #e53e3e;">
        <div class="card-label">Aguardando &gt;7d</div>
        <div class="card-value" style="color:#c53030;">${totalStale}</div>
      </div>` : ''}
    </div>`;

  const content = `
    <div class="main-header">
      <h1>Progresso de Épicos e Stories</h1>
      <div class="subtitle">${epics.length} épico(s) &nbsp;|&nbsp; ${totalStories} stories no total</div>
    </div>

    ${summaryCardsHtml}

    <div>
      <h2 style="font-size:1rem;font-weight:600;color:#2d3748;margin-bottom:16px;">Por Épico</h2>
      ${epicCardsHtml}
    </div>
  `;

  return c.html(renderShell({ title: 'Progresso', activePanel: 'progress', content }));
}
