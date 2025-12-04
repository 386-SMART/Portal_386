// ecosystem.config.js - Configuración optimizada de PM2
module.exports = {
  apps: [{
    name: 'Portal386',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    
    // Optimización de Memoria para servidor con 64GB RAM
    max_memory_restart: '2G',  // Reiniciar si supera 2GB
    node_args: '--max-old-space-size=2048',  // 2GB de heap (tu servidor tiene recursos)
    
    // Variables de Entorno
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // Logs
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Comportamiento
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: false,
    listen_timeout: 3000,
    
    // Optimización adicional
    instance_var: 'INSTANCE_ID',
    combine_logs: true,
    
    // Configuración de Node.js
    interpreterArgs: '--expose-gc',  // Permitir GC manual si es necesario
  }]
};
