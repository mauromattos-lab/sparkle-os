// Overview panel — main cockpit panel
// Shows system health, integration status, and alerts
// Exported as a handler function used by index.ts for GET /cockpit and /cockpit/

import type { Context } from 'hono';
import { getSystemHealth, type ServiceStatus, type IntegrationHealth } from '../services/health.service.js';
import { getDecisionsCount } from '../services/decisions.service.js';
import { renderShell } from './shell.js';

const BRAIN_URL = process.env['BRAIN_URL'] ?? 'http://localhost:3003';

function statusLabel(status: ServiceStatus): string {
  if (status === 'ok') return 'Operacional';
  if (status === 'degraded') return 'Degradado';
  return 'Offline';
}

function buildAlertsHtml(integrations: IntegrationHealth[]): string {
  const offlineOrDegraded = integrations.filter((i) => i.status !== 'ok');

  if (offlineOrDegraded.length === 0) {
    return `<div class="no-alerts">
      <span class="status ok"><span class="status-dot"></span>Nenhum alerta ativo — tudo operacional</span>
    </div>`;
  }

  return offlineOrDegraded
    .map((integration) => {
      const sop = getSOP(integration.name, integration.status);
      return `
      <div class="alert-item">
        <div class="alert-title">${integration.name} — ${statusLabel(integration.status)}</div>
        <div class="alert-desc">${integration.detail}</div>
        <div class="alert-sop">
          <strong>O que fazer:</strong>
          ${sop}
        </div>
      </div>`;
    })
    .join('');
}

/**
 * Inline SOP — explains what Mauro should do for each alert type
 * No external links, no technical jargon
 */
function getSOP(serviceName: string, status: ServiceStatus): string {
  if (status === 'offline') {
    if (serviceName.includes('Brain')) {
      return 'O Cérebro está desligado. Abra um terminal, vá até packages/brain e execute: npm run dev. Se o problema persistir, verifique se o banco de dados Supabase está acessível.';
    }
    return `O serviço ${serviceName} está sem resposta. Verifique se ele está rodando localmente e tente reiniciá-lo. Se o problema continuar, contacte o time técnico.`;
  }

  if (status === 'degraded') {
    if (serviceName.includes('Brain')) {
      return 'O Cérebro está funcionando parcialmente. Alguma parte interna está com falha (banco ou embeddings). Verifique os logs em packages/brain com: npm run dev. Pode ser uma questão temporária — aguarde 1 minuto e recarregue.';
    }
    return `O serviço ${serviceName} está com desempenho reduzido. Aguarde alguns minutos — pode ser uma instabilidade temporária. Se persistir, reinicie o serviço.`;
  }

  return 'Serviço em estado inesperado. Verifique os logs do sistema.';
}

export async function renderOverview(c: Context): Promise<Response> {
  const [health, decisionCount] = await Promise.all([
    getSystemHealth(BRAIN_URL),
    getDecisionsCount(),
  ]);
  const lastUpdated = new Date(health.checkedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const integrationsHtml = health.integrations
    .map((integration) => {
      return `
      <div class="integration-card ${integration.status}">
        <div class="integration-name">${integration.name}</div>
        <span class="status ${integration.status}">
          <span class="status-dot"></span>
          ${statusLabel(integration.status)}
        </span>
        <div class="integration-detail">${integration.detail}</div>
      </div>`;
    })
    .join('');

  const overallStatusHtml = `
    <span class="status ${health.overall}">
      <span class="status-dot"></span>
      Sistema ${statusLabel(health.overall)}
    </span>`;

  const decisionSummaryHtml =
    decisionCount > 0
      ? `<div class="cards" style="margin-bottom:0">
          <div class="card" style="border-left:4px solid #e53e3e">
            <div class="card-label">Decisões Pendentes</div>
            <div class="card-value" style="color:#c53030">${decisionCount}</div>
            <div style="font-size:0.75rem;color:#718096;margin-top:6px">
              <a href="/cockpit/decisions" style="color:#3182ce;text-decoration:none">Ver fila de decisões &rarr;</a>
            </div>
          </div>
        </div>`
      : '';

  const content = `
    <div class="main-header">
      <h1>Visão Geral do SparkleOS</h1>
      <div class="subtitle">Última atualização: ${lastUpdated} &nbsp;|&nbsp; ${overallStatusHtml}</div>
    </div>

    ${decisionSummaryHtml}

    <div class="integration-grid">
      ${integrationsHtml}
    </div>

    <div class="alert-section">
      <h2>Alertas Ativos</h2>
      ${buildAlertsHtml(health.integrations)}
    </div>
  `;

  return c.html(renderShell({ title: 'Visão Geral', activePanel: 'overview', content, decisionCount }));
}
