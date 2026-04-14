// PM2 ecosystem config — used for production deploy on VPS
// Usage:
//   pm2 start ecosystem.config.cjs
//   pm2 restart zenya-webhook
//   pm2 logs zenya-webhook
//   pm2 save && pm2 startup

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
  ],
};
