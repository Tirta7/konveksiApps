const Database = require("better-sqlite3");
const { drizzle } = require("drizzle-orm/better-sqlite3");
const { migrate } = require("drizzle-orm/better-sqlite3/migrator");

const sqlite = new Database("sqlite.db");
const db = drizzle(sqlite);

console.log("Migrating database...");
migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migration complete!");
