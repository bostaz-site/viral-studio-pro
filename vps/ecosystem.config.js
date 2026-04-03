export default {
  apps: [
    {
      // Application name (used in pm2 commands)
      name: 'viral-studio-api',

      // Script to run
      script: 'server.js',

      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 3100,
      },

      // Cluster mode: number of instances
      // 1 for single instance, 'max' to use all CPU cores
      instances: 1,

      // Watch for file changes and auto-restart (disable in production)
      watch: false,

      // Automatically restart crashed app
      autorestart: true,

      // Max memory before restart (500MB)
      max_memory_restart: '500M',

      // Log timestamps
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Merge logs from all instances
      merge_logs: true,

      // Output & Error log file paths
      out_file: '/var/log/viral-studio/api.out.log',
      error_file: '/var/log/viral-studio/api.error.log',

      // PID file location
      pid_file: '/var/run/viral-studio-api.pid',

      // Node args (useful for memory limits, profiling, etc.)
      node_args: '--max-old-space-size=1024',

      // Grace period for shutdown (ms)
      kill_timeout: 5000,

      // Listen for SIGTERM and gracefully exit
      listen_timeout: 3000,
    },
  ],

  // Deploy section (for CI/CD)
  deploy: {
    production: {
      user: 'app',
      host: 'api.viral-studio-pro.com', // Replace with actual server
      ref: 'origin/main',
      repo: 'git@github.com:your-org/viral-studio-pro.git', // Replace with actual repo
      path: '/opt/viral-studio',
      'post-deploy':
        'npm install && cp .env /opt/viral-studio/.env && pm2 startOrRestart ecosystem.config.js',
    },
  },
};
