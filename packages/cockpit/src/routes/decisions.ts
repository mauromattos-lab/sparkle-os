// Decisions panel — lists pending decisions that require Mauro's input
// GET /cockpit/decisions
// Data source: @sparkle-os/core listPendingDecisions()

import type { Context } from 'hono';
import { getDecisionsDashboard } from '../services/decisions.service.js';
import type { PendingDecision } from '../services/decisions.service.js';
import { renderShell } from './shell.js';

function formatDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return isoDate;
  }
}

function buildDecisionCard(decision: PendingDecision): string {
  const optionsHtml =
    decision.options && decision.options.length > 0
      ? `
      <div class="decision-options">
        <div class="decision-options-title">Opções disponíveis:</div>
        ${decision.options
          .map(
            (opt) => `
          <div class="decision-option${opt.recommendation ? ' recommended' : ''}">
            <div class="option-label">${opt.label}${opt.recommendation ? ' <span class="rec-badge">Recomendada</span>' : ''}</div>
            ${opt.description ? `<div class="option-desc">${opt.description}</div>` : ''}
          </div>`,
          )
          .join('')}
      </div>`
      : '';

  return `
    <div class="decision-card">
      <div class="decision-header">
        <div class="decision-title">${decision.title}</div>
        <div class="decision-meta">
          Pedido por <strong>${decision.requestedBy}</strong>
          &nbsp;·&nbsp;
          ${formatDate(decision.createdAt)}
          ${decision.priority === 'urgent' ? '&nbsp;·&nbsp;<span class="priority-badge urgent">Urgente</span>' : ''}
          ${decision.priority === 'low' ? '&nbsp;·&nbsp;<span class="priority-badge low">Baixa prioridade</span>' : ''}
        </div>
      </div>
      <div class="decision-context">${decision.context}</div>
      ${optionsHtml}
    </div>`;
}

export async function renderDecisions(c: Context): Promise<Response> {
  const dashboard = await getDecisionsDashboard();

  let bodyContent: string;

  if (!dashboard.coreAvailable) {
    bodyContent = `
      <div class="unavailable-banner">
        <strong>Decisões indisponíveis no momento</strong>
        <p>Não foi possível conectar ao core do SparkleOS. Verifique se o serviço está ativo e tente recarregar.</p>
      </div>`;
  } else if (dashboard.decisions.length === 0) {
    bodyContent = `
      <div class="empty-state">
        <div class="empty-icon">&#10003;</div>
        <div class="empty-title">Nenhuma decisão pendente — tudo sob controle</div>
        <div class="empty-sub">Quando os agentes precisarem de você, as decisões aparecerão aqui.</div>
      </div>`;
  } else {
    bodyContent = dashboard.decisions.map(buildDecisionCard).join('');
  }

  const content = `
    <div class="main-header">
      <h1>Fila de Decisões</h1>
      <div class="subtitle">
        ${
          dashboard.coreAvailable
            ? dashboard.decisions.length > 0
              ? `${dashboard.decisions.length} decisão${dashboard.decisions.length !== 1 ? 'ões' : ''} aguardando`
              : 'Nenhuma decisão pendente'
            : 'Core indisponível'
        }
      </div>
    </div>

    <div class="decisions-list">
      ${bodyContent}
    </div>

    <style>
      .decisions-list { display: flex; flex-direction: column; gap: 16px; }

      /* Decision card */
      .decision-card {
        background: #fff;
        border-radius: 10px;
        padding: 20px 24px;
        box-shadow: 0 1px 3px rgba(0,0,0,.08);
        border-left: 4px solid #4299e1;
      }
      .decision-header { margin-bottom: 10px; }
      .decision-title {
        font-size: 1.05rem;
        font-weight: 700;
        color: #1a202c;
        margin-bottom: 4px;
      }
      .decision-meta {
        font-size: 0.78rem;
        color: #718096;
      }
      .decision-meta strong { color: #4a5568; }
      .decision-context {
        font-size: 0.875rem;
        color: #4a5568;
        line-height: 1.6;
        margin-bottom: 12px;
        white-space: pre-wrap;
      }

      /* Options */
      .decision-options { margin-top: 12px; }
      .decision-options-title {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .06em;
        color: #718096;
        margin-bottom: 8px;
      }
      .decision-option {
        background: #f7fafc;
        border-radius: 6px;
        padding: 10px 14px;
        margin-bottom: 8px;
        border-left: 3px solid #e2e8f0;
      }
      .decision-option.recommended { border-left-color: #48bb78; background: #f0fff4; }
      .option-label {
        font-weight: 600;
        font-size: 0.875rem;
        color: #2d3748;
        margin-bottom: 2px;
      }
      .option-desc { font-size: 0.8rem; color: #718096; }

      /* Badges */
      .rec-badge {
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .06em;
        background: #c6f6d5;
        color: #22543d;
        padding: 2px 6px;
        border-radius: 4px;
        margin-left: 6px;
        vertical-align: middle;
      }
      .priority-badge {
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .06em;
        padding: 2px 6px;
        border-radius: 4px;
        vertical-align: middle;
      }
      .priority-badge.urgent { background: #fed7d7; color: #c53030; }
      .priority-badge.low { background: #e2e8f0; color: #718096; }

      /* Empty state */
      .empty-state {
        background: #fff;
        border-radius: 10px;
        padding: 64px 32px;
        text-align: center;
        box-shadow: 0 1px 3px rgba(0,0,0,.08);
      }
      .empty-icon { font-size: 2.5rem; color: #48bb78; margin-bottom: 16px; }
      .empty-title { font-size: 1.1rem; font-weight: 600; color: #2d3748; margin-bottom: 8px; }
      .empty-sub { font-size: 0.875rem; color: #718096; }

      /* Unavailable banner */
      .unavailable-banner {
        background: #fffaf0;
        border: 1px solid #fbd38d;
        border-radius: 10px;
        padding: 24px;
        text-align: center;
        color: #744210;
      }
      .unavailable-banner strong { display: block; font-size: 1rem; margin-bottom: 8px; }
      .unavailable-banner p { font-size: 0.875rem; }
    </style>
  `;

  return c.html(
    renderShell({
      title: 'Fila de Decisões',
      activePanel: 'decisions',
      content,
      decisionCount: dashboard.count,
    }),
  );
}
