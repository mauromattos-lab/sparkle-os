// Brain Collective panel — GET /cockpit/brain
// Displays insights summary, knowledge cycle stats, and top applied insights
// Gracefully handles Brain API unavailability

import type { Context } from 'hono';
import { getBrainStatus, type TopAppliedInsight } from '../services/brain.service.js';
import { renderShell } from './shell.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatScore(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toFixed(2);
}

function buildTopAppliedHtml(insights: TopAppliedInsight[]): string {
  if (insights.length === 0) {
    return `<div class="no-alerts"><span style="color:#718096">Nenhum insight aplicado ainda</span></div>`;
  }

  return insights
    .map((insight, idx) => {
      const score = insight.quality_score != null ? insight.quality_score.toFixed(2) : '—';
      const source = insight.source ?? 'desconhecido';
      const tags =
        Array.isArray(insight.tags) && insight.tags.length > 0
          ? `<span style="font-size:0.75rem;color:#718096">${insight.tags.slice(0, 3).join(', ')}</span>`
          : '';

      return `
      <div class="insight-item">
        <div class="insight-rank">#${idx + 1}</div>
        <div class="insight-body">
          <div class="insight-content">${insight.content}</div>
          <div class="insight-meta">
            <span class="insight-source">${source}</span>
            <span class="insight-score">Score: ${score}</span>
            ${tags}
          </div>
        </div>
      </div>`;
    })
    .join('');
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function renderBrainPanel(c: Context): Promise<Response> {
  const brainStatus = await getBrainStatus();

  if (!brainStatus.healthy) {
    const content = `
      <div class="main-header">
        <h1>Cérebro Coletivo</h1>
        <div class="subtitle">Base de conhecimento do SparkleOS</div>
      </div>
      <div class="alert-section">
        <h2>Alertas Ativos</h2>
        <div class="alert-item">
          <div class="alert-title">Brain API — Offline</div>
          <div class="alert-desc">${brainStatus.error}</div>
          <div class="alert-sop">
            <strong>O que fazer:</strong>
            O Cérebro está desligado. Abra um terminal, vá até packages/brain e execute: npm run dev. Se o problema persistir, verifique se o banco de dados Supabase está acessível.
          </div>
        </div>
      </div>
    `;
    return c.html(renderShell({ title: 'Cérebro', activePanel: 'brain', content }));
  }

  const { health, dashboard, topApplied } = brainStatus;
  const { summary, cycle } = dashboard;

  const dbStatus = health.db === 'ok' ? 'ok' : 'offline';
  const embStatus = health.embeddingService === 'ok' ? 'ok' : 'offline';
  const dbLabel = health.db === 'ok' ? 'Operacional' : 'Falha';
  const embLabel = health.embeddingService === 'ok' ? 'Operacional' : 'Falha';

  const generatedAt = new Date(dashboard.generatedAt).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });

  const content = `
    <div class="main-header">
      <h1>Cérebro Coletivo</h1>
      <div class="subtitle">
        Última atualização: ${generatedAt}
        &nbsp;|&nbsp;
        <span class="status ok"><span class="status-dot"></span>Brain API Online</span>
        ${dashboard.cacheHit ? '&nbsp;|&nbsp;<span style="font-size:0.75rem;color:#718096">cache</span>' : ''}
      </div>
    </div>

    <!-- Infraestrutura -->
    <div class="integration-grid" style="margin-bottom:24px">
      <div class="integration-card ${dbStatus}">
        <div class="integration-name">Banco de Dados</div>
        <span class="status ${dbStatus}">
          <span class="status-dot"></span>${dbLabel}
        </span>
        <div class="integration-detail">Supabase / PostgreSQL</div>
      </div>
      <div class="integration-card ${embStatus}">
        <div class="integration-name">Serviço de Embeddings</div>
        <span class="status ${embStatus}">
          <span class="status-dot"></span>${embLabel}
        </span>
        <div class="integration-detail">Geração de vetores semânticos</div>
      </div>
    </div>

    <!-- Resumo de insights -->
    <div class="cards" style="margin-bottom:24px">
      <div class="card">
        <div class="card-label">Total de Insights</div>
        <div class="card-value">${summary.total}</div>
      </div>
      <div class="card">
        <div class="card-label">Aplicados</div>
        <div class="card-value" style="color:#276749">${summary.by_status.applied}</div>
      </div>
      <div class="card">
        <div class="card-label">Validados</div>
        <div class="card-value" style="color:#2b6cb0">${summary.by_status.validated}</div>
      </div>
      <div class="card">
        <div class="card-label">Rejeitados</div>
        <div class="card-value" style="color:#c53030">${summary.by_status.rejected}</div>
      </div>
      <div class="card">
        <div class="card-label">Brutos</div>
        <div class="card-value" style="color:#744210">${summary.by_status.raw}</div>
      </div>
      <div class="card">
        <div class="card-label">Score Médio</div>
        <div class="card-value">${formatScore(summary.avg_quality_score)}</div>
      </div>
      <div class="card">
        <div class="card-label">Duplicatas</div>
        <div class="card-value">${summary.total_duplicates}</div>
      </div>
    </div>

    <!-- Ciclo de conhecimento -->
    <div class="alert-section" style="margin-bottom:24px">
      <h2>Ciclo de Conhecimento — Taxa de Conclusão: ${formatPercent(cycle.completionRate)}</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-top:12px">
        <div class="card" style="border-left:4px solid #4299e1">
          <div class="card-label">Ingeridos</div>
          <div class="card-value">${cycle.ingested}</div>
        </div>
        <div class="card" style="border-left:4px solid #805ad5">
          <div class="card-label">Validados</div>
          <div class="card-value">${cycle.validated}</div>
        </div>
        <div class="card" style="border-left:4px solid #48bb78">
          <div class="card-label">Aplicados</div>
          <div class="card-value">${cycle.applied}</div>
        </div>
        <div class="card" style="border-left:4px solid #fc8181">
          <div class="card-label">Rejeitados</div>
          <div class="card-value">${cycle.rejected}</div>
        </div>
      </div>
    </div>

    <!-- Fontes -->
    <div class="alert-section" style="margin-bottom:24px">
      <h2>Insights por Fonte</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-top:12px">
        <div class="card">
          <div class="card-label">Zenya (Operação)</div>
          <div class="card-value">${summary.by_source.zenya_operation}</div>
        </div>
        <div class="card">
          <div class="card-label">Agentes (Pesquisa)</div>
          <div class="card-value">${summary.by_source.agent_research}</div>
        </div>
        <div class="card">
          <div class="card-label">Mauro (Input Direto)</div>
          <div class="card-value">${summary.by_source.mauro_input}</div>
        </div>
      </div>
    </div>

    <!-- Top insights aplicados -->
    <div class="alert-section">
      <h2>Top Insights Aplicados</h2>
      <style>
        .insight-item {
          display: flex;
          gap: 14px;
          padding: 14px 0;
          border-bottom: 1px solid #f0f4f8;
          align-items: flex-start;
        }
        .insight-item:last-child { border-bottom: none; }
        .insight-rank {
          font-size: 1.1rem;
          font-weight: 700;
          color: #4299e1;
          min-width: 32px;
          padding-top: 2px;
        }
        .insight-content {
          font-size: 0.9rem;
          color: #2d3748;
          margin-bottom: 6px;
          line-height: 1.5;
        }
        .insight-meta {
          display: flex;
          gap: 14px;
          align-items: center;
          flex-wrap: wrap;
        }
        .insight-source {
          font-size: 0.75rem;
          color: #718096;
          background: #f7fafc;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid #e2e8f0;
        }
        .insight-score {
          font-size: 0.75rem;
          color: #2b6cb0;
          font-weight: 600;
        }
        .insight-body { flex: 1; }
      </style>
      ${buildTopAppliedHtml(topApplied)}
    </div>
  `;

  return c.html(renderShell({ title: 'Cérebro', activePanel: 'brain', content }));
}
