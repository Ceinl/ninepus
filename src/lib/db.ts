import { mkdirSync } from "node:fs";
import { createClient, type Client } from "@libsql/client";

export interface BoardRow {
  id: string;
  name: string;
  doc: string;
  manage_hash: string;
  created_at: number;
  updated_at: number;
  expires_at: number | null;
}

let client: Client | null = null;

function newClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  try {
    mkdirSync(".data", { recursive: true });
  } catch {
    /* read-only FS — only local file mode needs the directory */
  }
  return createClient({ url: "file:.data/ninepus.db" });
}

async function db(): Promise<Client> {
  if (!client) {
    client = newClient();
    await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        doc TEXT NOT NULL DEFAULT '[]',
        manage_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER
      );
    `);
    await client.execute(
      "CREATE INDEX IF NOT EXISTS idx_boards_expires ON boards(expires_at) WHERE expires_at IS NOT NULL",
    );
  }
  return client;
}

function toBoardRow(row: Record<string, unknown>): BoardRow {
  return {
    id: row.id as string,
    name: row.name as string,
    doc: row.doc as string,
    manage_hash: row.manage_hash as string,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
    expires_at: (row.expires_at as number | null) ?? null,
  };
}

export async function boardById(id: string): Promise<BoardRow | null> {
  const res = await (await db()).execute({ sql: "SELECT * FROM boards WHERE id = ?", args: [id] });
  return res.rows.length ? toBoardRow(res.rows[0]) : null;
}

export async function insertBoard(row: {
  id: string;
  name: string;
  doc: string;
  manageHash: string;
  now: number;
  expiresAt: number | null;
}): Promise<void> {
  await (
    await db()
  ).execute({
    sql: "INSERT INTO boards (id, name, doc, manage_hash, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [row.id, row.name, row.doc, row.manageHash, row.now, row.now, row.expiresAt],
  });
}

export async function updateDoc(doc: string, now: number, id: string): Promise<void> {
  await (await db()).execute({ sql: "UPDATE boards SET doc = ?, updated_at = ? WHERE id = ?", args: [doc, now, id] });
}

export async function setName(name: string, now: number, id: string): Promise<void> {
  await (await db()).execute({ sql: "UPDATE boards SET name = ?, updated_at = ? WHERE id = ?", args: [name, now, id] });
}

export async function setExpiry(expiresAt: number | null, now: number, id: string): Promise<void> {
  await (await db()).execute({ sql: "UPDATE boards SET expires_at = ?, updated_at = ? WHERE id = ?", args: [expiresAt, now, id] });
}

export async function deleteBoard(id: string): Promise<void> {
  await (await db()).execute({ sql: "DELETE FROM boards WHERE id = ?", args: [id] });
}

/** Expired boards are garbage-collected lazily on every API touch. */
export async function sweepExpired(now = Date.now()): Promise<void> {
  await (
    await db()
  ).execute({ sql: "DELETE FROM boards WHERE expires_at IS NOT NULL AND expires_at < ?", args: [now] });
}

