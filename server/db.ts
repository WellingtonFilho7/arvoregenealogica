export {};

const path = require("path");
const Database = require("better-sqlite3");

function resolveDbPath(inputPath) {
  if (inputPath) {
    return path.resolve(inputPath);
  }

  return path.resolve(process.cwd(), "FamilyTree.rmtree");
}

function createDb(dbPath) {
  const resolved = resolveDbPath(dbPath);
  const db = new Database(resolved, {
    readonly: true,
    fileMustExist: true,
  });

  return {
    db,
    dbPath: resolved,
  };
}

module.exports = {
  createDb,
  resolveDbPath,
};
