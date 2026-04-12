// Shell layout — shared HTML wrapper with sidebar navigation
// Used by all cockpit panels as the base layout

export interface ShellOptions {
  title: string;
  activePanel: string;
  content: string;
  /** Number of pending decisions — shown as badge in sidebar nav link. 0 = no badge. */
  decisionCount?: number;
}

const NAV_PANELS = [
  { id: 'overview', label: 'Visão Geral', href: '/cockpit/' },
  { id: 'agents', label: 'Agentes', href: '/cockpit/agents' },
  { id: 'decisions', label: 'Decisões', href: '/cockpit/decisions' },
  { id: 'zenya', label: 'Zenya', href: '/cockpit/zenya' },
  { id: 'brain', label: 'Cérebro', href: '/cockpit/brain' },
  { id: 'costs', label: 'Custos', href: '/cockpit/costs' },
  { id: 'progress', label: 'Progresso', href: '/cockpit/progress' },
  { id: 'summary', label: 'Resumo', href: '/cockpit/summary' },
];

export function renderShell(opts: ShellOptions): string {
  const decisionCount = opts.decisionCount ?? 0;

  const navItems = NAV_PANELS.map((panel) => {
    const isActive = panel.id === opts.activePanel;
    const badge =
      panel.id === 'decisions' && decisionCount > 0
        ? ` <span class="nav-badge">${decisionCount}</span>`
        : '';
    return `<a href="${panel.href}" class="nav-item${isActive ? ' active' : ''}">${panel.label}${badge}</a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="30">
  <title>${opts.title} — SparkleOS Cockpit</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f4f8;
      color: #1a202c;
      display: flex;
      min-height: 100vh;
    }

    /* Sidebar */
    .sidebar {
      width: 220px;
      min-height: 100vh;
      background: #1a202c;
      color: #e2e8f0;
      padding: 24px 0;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
    }
    .sidebar-brand {
      font-size: 1.1rem;
      font-weight: 700;
      color: #fff;
      padding: 0 20px 20px;
      border-bottom: 1px solid #2d3748;
      margin-bottom: 16px;
    }
    .sidebar-brand span {
      display: block;
      font-size: 0.7rem;
      font-weight: 400;
      color: #718096;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    .nav-item {
      display: block;
      padding: 10px 20px;
      color: #a0aec0;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      border-left: 3px solid transparent;
      transition: background 0.15s, color 0.15s;
    }
    .nav-item:hover {
      background: #2d3748;
      color: #e2e8f0;
    }
    .nav-item.active {
      background: #2d3748;
      color: #fff;
      border-left-color: #4299e1;
    }
    .nav-section {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .1em;
      color: #4a5568;
      padding: 16px 20px 6px;
    }
    .nav-badge {
      display: inline-block;
      background: #e53e3e;
      color: #fff;
      font-size: 0.65rem;
      font-weight: 700;
      border-radius: 10px;
      padding: 1px 6px;
      margin-left: 6px;
      vertical-align: middle;
      line-height: 1.4;
    }

    /* Main content */
    .main {
      flex: 1;
      padding: 32px;
      overflow-y: auto;
    }
    .main-header {
      margin-bottom: 24px;
    }
    .main-header h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1a202c;
    }
    .main-header .subtitle {
      font-size: 0.875rem;
      color: #718096;
      margin-top: 4px;
    }

    /* Cards */
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .card {
      background: #fff;
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,.08);
    }
    .card-label {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: #718096;
      margin-bottom: 8px;
    }
    .card-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #2d3748;
    }

    /* Status indicators */
    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.875rem;
      font-weight: 600;
    }
    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .status.ok .status-dot { background: #48bb78; }
    .status.degraded .status-dot { background: #ecc94b; }
    .status.offline .status-dot { background: #fc8181; }
    .status.ok { color: #276749; }
    .status.degraded { color: #744210; }
    .status.offline { color: #c53030; }

    /* Integration cards */
    .integration-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .integration-card {
      background: #fff;
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,.08);
      border-left: 4px solid #e2e8f0;
    }
    .integration-card.ok { border-left-color: #48bb78; }
    .integration-card.degraded { border-left-color: #ecc94b; }
    .integration-card.offline { border-left-color: #fc8181; }
    .integration-name {
      font-weight: 600;
      font-size: 1rem;
      margin-bottom: 8px;
      color: #2d3748;
    }
    .integration-detail {
      font-size: 0.8rem;
      color: #718096;
      margin-top: 6px;
    }

    /* Alerts */
    .alert-section {
      background: #fff;
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,.08);
      margin-bottom: 24px;
    }
    .alert-section h2 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 16px;
      color: #2d3748;
    }
    .alert-item {
      padding: 14px 16px;
      border-radius: 8px;
      margin-bottom: 12px;
      background: #fff5f5;
      border-left: 4px solid #fc8181;
    }
    .alert-item:last-child { margin-bottom: 0; }
    .alert-title {
      font-weight: 600;
      font-size: 0.9rem;
      color: #c53030;
      margin-bottom: 4px;
    }
    .alert-desc {
      font-size: 0.8rem;
      color: #742a2a;
      margin-bottom: 8px;
    }
    .alert-sop {
      font-size: 0.75rem;
      color: #2d3748;
      background: #f7fafc;
      border-radius: 4px;
      padding: 8px 10px;
      border-left: 3px solid #4299e1;
    }
    .alert-sop strong { display: block; margin-bottom: 2px; color: #2b6cb0; }

    .no-alerts {
      text-align: center;
      color: #718096;
      font-size: 0.875rem;
      padding: 24px;
    }

    /* Footer auto-refresh info */
    .auto-refresh-note {
      font-size: 0.75rem;
      color: #a0aec0;
      text-align: center;
      margin-top: 32px;
    }

    /* Coming soon placeholder */
    .placeholder {
      background: #fff;
      border-radius: 10px;
      padding: 48px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,.08);
    }
    .placeholder h2 { color: #4a5568; margin-bottom: 8px; }
    .placeholder p { color: #718096; font-size: 0.875rem; }
  </style>
</head>
<body>
  <nav class="sidebar">
    <div class="sidebar-brand">
      SparkleOS
      <span>Cockpit</span>
    </div>
    <div class="nav-section">Painéis</div>
    ${navItems}
  </nav>
  <main class="main">
    ${opts.content}
    <p class="auto-refresh-note">Atualização automática a cada 30 segundos</p>
  </main>
</body>
</html>`;
}
