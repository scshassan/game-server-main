module.exports = {
  apps: [
    {
      name: "rand-game-server",
      script: "yarn",
      args: "start",
      log_date_format: "YYYY-MM-DD HH:mm:ss.SSS Z",
      output: "./log/output.log",
      error: "./log/error.log",
      max_size: "10M",
      retain: 5,
    },
  ],
};
