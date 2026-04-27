// PM2 ecosystem config — used for production deploy on VPS
// Usage:
//   pm2 start ecosystem.config.cjs                 # starts both apps
//   pm2 reload ecosystem.config.cjs --only zenya-kb-sync   # reload one app
//   pm2 restart zenya-webhook                      # restart specific app
//   pm2 logs zenya-webhook | pm2 logs zenya-kb-sync
//   pm2 save && pm2 startup
//
// Story 18.4 / TD-01: zenya-kb-sync added as separate process.
// Isolation rationale (Dara): KB sync may crash on Sheets rate limit
// without affecting webhook. Independent restart policies.

module.exports = {
  apps: [
    {
      name: 'zenya-webhook',
      script: './dist/index.js',

      // ESM support
      node_args: '--experimental-vm-modules',

      // Environment
      env_file: '.env',

      // Restart policy
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000, // 3s between restarts

      // Logging
      out_file: './logs/zenya-out.log',
      error_file: './logs/zenya-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Memory limit — restart if over 512MB
      max_memory_restart: '512M',
    },
    {
      // Story 18.4 — KB sync ativo (worker PM2 dedicado)
      // Sincroniza Google Sheets → zenya_tenant_kb_entries a cada 15min
      // Tenants alvo: todos com credencial 'sheets_kb' em zenya_tenant_credentials
      name: 'zenya-kb-sync',
      script: './scripts/run-kb-sync.mjs',

      // Environment
      env_file: '.env',

      // Restart policy — não-urgente, restart_delay maior pra evitar tight loop em rate-limit Sheets
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 60_000, // 1min between restarts (Sheets rate limit safety)

      // Logging — separado do webhook
      out_file: './logs/kb-sync-out.log',
      error_file: './logs/kb-sync-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Memory limit — sync é leve, 256MB suficiente
      max_memory_restart: '256M',
    },
  ],
};
