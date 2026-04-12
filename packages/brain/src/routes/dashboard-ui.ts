// Dashboard UI route — Story 3.9
// GET /brain/dashboard/ui — serves a self-contained HTML page that fetches
// /brain/dashboard client-side and renders the data. No external dependencies.

import { Hono } from 'hono';

export const dashboardUiRouter = new Hono();

const HTML_PAGE = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cérebro Coletivo — Dashboard</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f4f8;
      color: #1a202c;
      padding: 24px;
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 4px;
      color: #1a202c;
    }
    .subtitle {
      font-size: 0.875rem;
      color: #718096;
      margin-bottom: 24px;
    }
    .badge {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 9999px;
      margin-left: 8px;
      vertical-align: middle;
      background: #bee3f8;
      color: #2b6cb0;
    }
    .badge.cached { background: #c6f6d5; color: #276749; }

    /* Cards */
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,.08);
    }
    .card-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: #718096; margin-bottom: 8px; }
    .card-value { font-size: 2rem; font-weight: 700; color: #2d3748; }
    .card.blue  .card-value { color: #2b6cb0; }
    .card.green .card-value { color: #276749; }
    .card.red   .card-value { color: #c53030; }
    .card.gold  .card-value { color: #744210; }

    /* Sections */
    .section { background: #fff; border-radius: 12px; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .section h2 { font-size: 1rem; font-weight: 600; margin-bottom: 16px; color: #2d3748; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th { text-align: left; font-weight: 600; color: #718096; padding: 8px 12px; border-bottom: 2px solid #e2e8f0; }
    td { padding: 10px 12px; border-bottom: 1px solid #f7fafc; }
    tr:last-child td { border-bottom: none; }
    .rate { font-weight: 700; font-size: 1.1rem; color: #276749; }

    /* Quality bar */
    .bar-wrap { height: 8px; background: #e2e8f0; border-radius: 4px; margin-top: 4px; overflow: hidden; }
    .bar { height: 100%; background: #4299e1; border-radius: 4px; }

    /* Top applied */
    .insight-row { padding: 12px 0; border-bottom: 1px solid #f7fafc; }
    .insight-row:last-child { border-bottom: none; }
    .insight-summary { font-weight: 500; margin-bottom: 4px; }
    .insight-meta { font-size: 0.75rem; color: #718096; }
    .improvement { font-weight: 700; color: #276749; }

    /* Loading / Error */
    #loading { padding: 48px; text-align: center; color: #718096; font-size: 1rem; }
    #error-msg { padding: 24px; text-align: center; color: #c53030; background: #fff5f5; border-radius: 12px; }
    #dashboard { display: none; }
  </style>
</head>
<body>
  <h1>Cérebro Coletivo <span id="cache-badge" class="badge" style="display:none">LIVE</span></h1>
  <div class="subtitle" id="generated-at">Carregando dados...</div>

  <div id="loading">Carregando dashboard...</div>
  <div id="error-msg" style="display:none"></div>

  <div id="dashboard">
    <!-- Summary cards -->
    <div class="cards" id="summary-cards"></div>

    <!-- Cycle table -->
    <div class="section">
      <h2>Ciclo de Conhecimento</h2>
      <table>
        <thead>
          <tr>
            <th>Fase</th>
            <th>Contagem</th>
          </tr>
        </thead>
        <tbody id="cycle-body"></tbody>
      </table>
    </div>

    <!-- Confidence breakdown -->
    <div class="section">
      <h2>Insights por Nível de Confiança (não-rejeitados)</h2>
      <table>
        <thead><tr><th>Nível</th><th>Contagem</th></tr></thead>
        <tbody id="confidence-body"></tbody>
      </table>
    </div>

    <!-- Top applied -->
    <div class="section">
      <h2>Top 5 Insights Aplicados (mais recentes)</h2>
      <div id="top-applied-list"></div>
    </div>

    <!-- Quality distribution -->
    <div class="section">
      <h2>Distribuição de Quality Score</h2>
      <table>
        <thead><tr><th>Faixa</th><th>Contagem</th><th>Barra</th></tr></thead>
        <tbody id="quality-body"></tbody>
      </table>
    </div>

    <!-- Duplicates -->
    <div class="section">
      <h2>Duplicatas</h2>
      <p id="total-dup" style="margin-bottom:16px; font-size:0.875rem; color:#718096;"></p>
      <table>
        <thead><tr><th>Canonical ID</th><th>Duplicatas</th><th>Resumo</th></tr></thead>
        <tbody id="canonical-body"></tbody>
      </table>
    </div>
  </div>

  <script>
    function esc(str) {
      if (str == null) return '—';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function shortId(id) {
      return id ? id.slice(0, 8) + '…' : '—';
    }

    function renderDashboard(d) {
      // Header
      document.getElementById('generated-at').textContent =
        'Gerado em: ' + new Date(d.generatedAt).toLocaleString('pt-BR');

      const badge = document.getElementById('cache-badge');
      badge.style.display = 'inline-block';
      badge.textContent = d.cacheHit ? 'CACHE' : 'LIVE';
      badge.className = 'badge' + (d.cacheHit ? ' cached' : '');

      // Summary cards
      const s = d.summary;
      const cards = [
        { label: 'Total', value: s.total, cls: 'blue' },
        { label: 'Raw', value: s.by_status.raw, cls: '' },
        { label: 'Validados', value: s.by_status.validated, cls: '' },
        { label: 'Aplicados', value: s.by_status.applied, cls: 'green' },
        { label: 'Rejeitados', value: s.by_status.rejected, cls: 'red' },
        { label: 'Duplicatas', value: s.total_duplicates, cls: '' },
        { label: 'Avg Quality', value: s.avg_quality_score != null ? s.avg_quality_score.toFixed(2) : '—', cls: 'gold' },
      ];
      document.getElementById('summary-cards').innerHTML = cards
        .map(c => '<div class="card ' + c.cls + '"><div class="card-label">' + esc(c.label) + '</div><div class="card-value">' + esc(c.value) + '</div></div>')
        .join('');

      // Cycle table
      const cy = d.cycle;
      document.getElementById('cycle-body').innerHTML = [
        ['Ingested (total)', cy.ingested],
        ['Validados', cy.validated],
        ['Aplicados', cy.applied],
        ['Rejeitados', cy.rejected],
        ['Completion Rate', '<span class="rate">' + cy.completionRate.toFixed(2) + '%</span>'],
      ].map(([k, v]) => '<tr><td>' + esc(k) + '</td><td>' + v + '</td></tr>').join('');

      // Confidence breakdown
      const conf = d.insights_by_confidence;
      document.getElementById('confidence-body').innerHTML = [
        ['Authoritative', conf.authoritative],
        ['High', conf.high],
        ['Medium', conf.medium],
      ].map(([k, v]) => '<tr><td>' + esc(k) + '</td><td>' + esc(v) + '</td></tr>').join('');

      // Top applied
      const listEl = document.getElementById('top-applied-list');
      if (!d.top_applied.length) {
        listEl.innerHTML = '<p style="color:#718096;font-size:.875rem;">Nenhum insight aplicado ainda.</p>';
      } else {
        listEl.innerHTML = d.top_applied.map(i => {
          const imp = i.improvementPercent != null
            ? '<span class="improvement">+' + i.improvementPercent + '%</span>'
            : '';
          return '<div class="insight-row"><div class="insight-summary">' + esc(i.summary || i.id) + ' ' + imp + '</div>' +
            '<div class="insight-meta">Fonte: ' + esc(i.source) + ' · Confiança: ' + esc(i.confidenceLevel) +
            ' · Aplicado: ' + esc(i.appliedAt ? new Date(i.appliedAt).toLocaleString('pt-BR') : '—') + '</div></div>';
        }).join('');
      }

      // Quality distribution
      const maxCount = Math.max(...d.quality_distribution.map(b => b.count), 1);
      document.getElementById('quality-body').innerHTML = d.quality_distribution.map(b => {
        const pct = Math.round((b.count / maxCount) * 100);
        return '<tr><td>' + esc(b.range) + '</td><td>' + esc(b.count) + '</td>' +
          '<td><div class="bar-wrap"><div class="bar" style="width:' + pct + '%"></div></div></td></tr>';
      }).join('');

      // Duplicates
      document.getElementById('total-dup').textContent =
        'Total de insights marcados como duplicata: ' + s.total_duplicates;
      const dup = d.duplicates;
      if (!dup.top_canonical.length) {
        document.getElementById('canonical-body').innerHTML = '<tr><td colspan="3" style="color:#718096;">Nenhuma duplicata registrada.</td></tr>';
      } else {
        document.getElementById('canonical-body').innerHTML = dup.top_canonical.map(c =>
          '<tr><td>' + esc(shortId(c.canonicalId)) + '</td><td>' + esc(c.count) + '</td><td>' + esc(c.summary || '—') + '</td></tr>'
        ).join('');
      }

      // Show dashboard
      document.getElementById('loading').style.display = 'none';
      document.getElementById('dashboard').style.display = 'block';
    }

    fetch('/brain/dashboard')
      .then(function(res) {
        if (!res.ok) throw new Error('Status ' + res.status);
        return res.json();
      })
      .then(renderDashboard)
      .catch(function(err) {
        document.getElementById('loading').style.display = 'none';
        var errEl = document.getElementById('error-msg');
        errEl.style.display = 'block';
        errEl.textContent = 'Erro ao carregar dashboard: ' + err.message;
      });
  </script>
</body>
</html>`;

dashboardUiRouter.get('/ui', (c) => {
  return c.html(HTML_PAGE);
});
