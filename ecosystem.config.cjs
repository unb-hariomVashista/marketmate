module.exports = {
  apps: [
    {
      name: "marketmate",
      script: "./node_modules/@react-router/serve/bin.js",
      args: "./build/server/index.js",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3005,
      },
    },
  ],
};
