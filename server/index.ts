export {};

const { createDb } = require("./db");
const { TTLCache } = require("./cache");
const { GenealogyRepository } = require("./repository");
const { GenealogyService } = require("./services/genealogyService");
const { createApp } = require("./app");

function buildRuntime() {
  const port = Number(process.env.PORT || 4000);
  const dbPath = process.env.DB_PATH;

  const { db, dbPath: resolvedDbPath } = createDb(dbPath);
  const repository = new GenealogyRepository(db);
  const cache = new TTLCache();
  const service = new GenealogyService({
    repository,
    cache,
    dbPath: resolvedDbPath,
  });
  const app = createApp({ service });

  return { app, db, port };
}

function startServer() {
  const { app, db, port } = buildRuntime();
  const server = app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Genealogy API running on http://localhost:${port}`);
  });

  const shutdown = () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
  buildRuntime,
};
