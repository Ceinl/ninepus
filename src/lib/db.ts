import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const DATA_DIR = path.join(process.cwd(), ".data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "ninepus.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  doc TEXT NOT NULL DEFAULT '[]',
  manage_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_boards_expires ON boards(expires_at) WHERE expires_at IS NOT NULL;
`);

export interface BoardRow {
  id: string;
  name: string;
  doc: string;
  manage_hash: string;
  created_at: number;
  updated_at: number;
  expires_at: number | null;
}

const stmts = {
  boardById: db.prepare<[string], BoardRow>("SELECT * FROM boards WHERE id = ?"),
  insertBoard: db.prepare(
    "INSERT INTO boards (id, name, doc, manage_hash, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ),
  updateDoc: db.prepare("UPDATE boards SET doc = ?, updated_at = ? WHERE id = ?"),
  setName: db.prepare("UPDATE boards SET name = ?, updated_at = ? WHERE id = ?"),
  setExpiry: db.prepare("UPDATE boards SET expires_at = ?, updated_at = ? WHERE id = ?"),
  deleteBoard: db.prepare("DELETE FROM boards WHERE id = ?"),
  deleteExpired: db.prepare("DELETE FROM boards WHERE expires_at IS NOT NULL AND expires_at < ?"),
};

/** Expired boards are garbage-collected lazily on every API touch. */
export function sweepExpired(now = Date.now()): void {
  stmts.deleteExpired.run(now);
}

export { db, stmts };
