const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "sqlite.db");
console.log("DB path:", dbPath);
console.log("DB exists before:", fs.existsSync(dbPath));

const db = new Database(dbPath);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
console.log("Tables found:", tables.map(t => t.name).join(", "));

db.pragma("foreign_keys = OFF");

for (const table of tables) {
  try {
    const count = db.prepare("SELECT COUNT(*) as c FROM \"" + table.name + "\"").get().c;
    db.prepare("DELETE FROM \"" + table.name + "\"").run();
    try { db.prepare("DELETE FROM sqlite_sequence WHERE name='" + table.name + "'").run(); } catch(e) {}
    console.log("Cleared: " + table.name + " (" + count + " rows)");
  } catch (e) {
    console.log("Could not clear: " + table.name + " - " + e.message);
  }
}

db.pragma("foreign_keys = ON");
db.close();

console.log("\nDatabase berhasil dikosongkan!");
