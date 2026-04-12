// Costs panel — displays spending vs. budget for the current month
// GET /cockpit/costs

import type { Context } from 'hono';
import { getCostsDashboard, type AgentCostSummary, type BudgetIndicator } from '../services/costs.service.js';
import { renderShell } from './shell.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function indicatorStyle(indicator: BudgetIndicator): { bg: string; text: string; border: string } {
  if (indicator === 'red') {
    return { bg: '#fff5f5', text: '#c53030', border: '#fc8181' };
  }
  if (indicator === 'yellow') {
    return { bg: '#fffff0', text: '#744210', border: '#ecc94b' };
  }
  return { bg: '#f0fff4', text: '#276749', border: '#48bb78' };
}

function indicatorLabel(indicator: BudgetIndicator): string {
  if (indicator === 'red') return 'Orçamento excedido';
  if (indicator === 'yellow') return 'Atenção — acima de 80%';
  return 'Dentro do orçamento';
}

function buildAgentRowsHtml(agents: AgentCostSummary[]): string {
  if (agents.length === 0) {
    return `<tr>
      <td colspan="2" style="text-align:center; color:#718096; padding:20px 0;">
        Nenhum custo registrado este mês
      </td>
    </tr>`;
  }

  return agents
    .map(
      (a) => `<tr>
      <td style="padding:10px 16px; color:#2d3748; font-weight:500;">${a.agentId}</td>
      <td style="padding:10px 16px; color:#2d3748; text-align:right;">${formatUsd(a.totalCost)}</td>
    </tr>`,
    )
    .join('\n');
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function renderCosts(c: Context): Promise<Response> {
  const data = await getCostsDashboard();

  if (!data.available) {
    const content = `
      <div class="main-header">
        <h1>Custos</h1>
        <div class="subtitle">Rastreamento de gastos por agente e operação</div>
      </div>
      <div class="alert-section">
        <p style="text-align:center; color:#718096; padding:24px 0;">
          Dados de custo indisponíveis — banco de dados inacessível.
          Verifique se o serviço core está em execução.
        </p>
      </div>
    `;
    return c.html(renderShell({ title: 'Custos', activePanel: 'costs', content }));
  }

  const { budget, summary, agentBreakdown, indicator } = data;
  const style = indicatorStyle(indicator);
  const percentDisplay = `${(budget.percentUsed * 100).toFixed(1)}%`;
  const agentRows = buildAgentRowsHtml(agentBreakdown);
  const hasCosts = summary.eventCount > 0;

  const content = `
    <div class="main-header">
      <h1>Custos</h1>
      <div class="subtitle">Mês corrente — gastos por agente e operação</div>
    </div>

    <!-- Budget summary card -->
    <div style="
      background:${style.bg};
      border:1px solid ${style.border};
      border-left:4px solid ${style.border};
      border-radius:10px;
      padding:24px 28px;
      margin-bottom:24px;
      box-shadow:0 1px 3px rgba(0,0,0,.06);
    ">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
        <span style="
          display:inline-block;
          width:12px; height:12px;
          border-radius:50%;
          background:${style.border};
          flex-shrink:0;
        "></span>
        <span style="font-weight:700; font-size:1rem; color:${style.text};">
          ${indicatorLabel(indicator)}
        </span>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:16px;">
        <div>
          <div style="font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#718096; margin-bottom:6px;">Gasto no mês</div>
          <div style="font-size:1.6rem; font-weight:700; color:#2d3748;">${formatUsd(budget.currentMonthCost)}</div>
        </div>
        <div>
          <div style="font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#718096; margin-bottom:6px;">Orçamento</div>
          <div style="font-size:1.6rem; font-weight:700; color:#2d3748;">${formatUsd(budget.monthlyBudgetUsd)}</div>
        </div>
        <div>
          <div style="font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#718096; margin-bottom:6px;">Restante</div>
          <div style="font-size:1.6rem; font-weight:700; color:${style.text};">${formatUsd(budget.remainingBudget)}</div>
        </div>
        <div>
          <div style="font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#718096; margin-bottom:6px;">Utilização</div>
          <div style="font-size:1.6rem; font-weight:700; color:${style.text};">${percentDisplay}</div>
        </div>
      </div>
    </div>

    <!-- Agent breakdown table -->
    <div style="background:#fff; border-radius:10px; box-shadow:0 1px 3px rgba(0,0,0,.08); overflow:hidden; margin-bottom:24px;">
      <div style="padding:16px 20px; border-bottom:1px solid #e2e8f0;">
        <h2 style="font-size:1rem; font-weight:600; color:#2d3748;">Breakdown por Agente</h2>
        ${hasCosts ? `<div style="font-size:0.8rem; color:#718096; margin-top:4px;">${agentBreakdown.length} agente${agentBreakdown.length !== 1 ? 's' : ''} com gastos no período</div>` : ''}
      </div>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:#f7fafc;">
            <th style="padding:10px 16px; text-align:left; font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#718096;">Agente</th>
            <th style="padding:10px 16px; text-align:right; font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#718096;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${agentRows}
        </tbody>
      </table>
    </div>

    ${
      !hasCosts
        ? `<div style="background:#fff; border-radius:10px; padding:32px; text-align:center; box-shadow:0 1px 3px rgba(0,0,0,.06);">
        <div style="color:#a0aec0; font-size:0.875rem;">Nenhum custo registrado este mês</div>
        <div style="color:#cbd5e0; font-size:0.8rem; margin-top:6px;">Os gastos aparecerão aqui assim que os agentes registrarem atividade.</div>
      </div>`
        : ''
    }
  `;

  return c.html(renderShell({ title: 'Custos', activePanel: 'costs', content }));
}
