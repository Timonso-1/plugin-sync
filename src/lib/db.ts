import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

// Über getBuiltinModule laden, damit der Bundler node:sqlite nicht auflösen muss
const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");

export const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS servers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  pelican_id  TEXT NOT NULL UNIQUE,
  plugin_dir  TEXT NOT NULL DEFAULT '/plugins'
);

CREATE TABLE IF NOT EXISTS plugins (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  source           TEXT NOT NULL CHECK (source IN ('github', 'modrinth')),
  ref              TEXT NOT NULL,
  asset_pattern    TEXT,
  loaders          TEXT,
  game_version     TEXT,
  name             TEXT,
  current_version  TEXT,
  auto_update      INTEGER NOT NULL DEFAULT 1,
  stable_only      INTEGER NOT NULL DEFAULT 1,
  last_checked     TEXT,
  last_error       TEXT
);

CREATE TABLE IF NOT EXISTS plugin_servers (
  plugin_id  INTEGER NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  server_id  INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  PRIMARY KEY (plugin_id, server_id)
);

CREATE TABLE IF NOT EXISTS deployments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id    INTEGER,
  server_name  TEXT NOT NULL,
  plugin_name  TEXT NOT NULL,
  version      TEXT,
  file_name    TEXT,
  removed      TEXT,
  status       TEXT NOT NULL,
  message      TEXT,
  trigger      TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

const globalForDb = globalThis as unknown as { pluginSyncDb?: DatabaseSyncType };

function open(): DatabaseSyncType {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const database = new DatabaseSync(path.join(DATA_DIR, "plugin-sync.db"));
  database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  database.exec(SCHEMA);
  migrate(database);
  return database;
}

/** Ergänzt Spalten in bestehenden Datenbanken. */
function migrate(database: DatabaseSyncType): void {
  const columns = (database.prepare("PRAGMA table_info(plugins)").all() as unknown as { name: string }[]).map(
    (column) => column.name,
  );
  if (!columns.includes("stable_only")) {
    database.exec("ALTER TABLE plugins ADD COLUMN stable_only INTEGER NOT NULL DEFAULT 1");
  }
}

export const db = globalForDb.pluginSyncDb ?? (globalForDb.pluginSyncDb = open());

function transaction(work: () => void): void {
  db.exec("BEGIN");
  try {
    work();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export type PluginSource = "github" | "modrinth";

export interface ServerRow {
  id: number;
  name: string;
  pelican_id: string;
  plugin_dir: string;
}

export interface PluginRow {
  id: number;
  source: PluginSource;
  ref: string;
  asset_pattern: string | null;
  loaders: string | null;
  game_version: string | null;
  name: string | null;
  current_version: string | null;
  auto_update: number;
  stable_only: number;
  last_checked: string | null;
  last_error: string | null;
}

export interface DeploymentRow {
  id: number;
  server_id: number | null;
  server_name: string;
  plugin_name: string;
  version: string | null;
  file_name: string | null;
  removed: string | null;
  status: "success" | "skipped" | "error";
  message: string | null;
  trigger: "manual" | "auto";
  created_at: string;
}

export interface NewPlugin {
  source: PluginSource;
  ref: string;
  asset_pattern: string | null;
  loaders: string | null;
  game_version: string | null;
  auto_update: boolean;
  stable_only: boolean;
}

// --- Server ---

export function listServers(): ServerRow[] {
  return db.prepare("SELECT * FROM servers ORDER BY name COLLATE NOCASE").all() as unknown as ServerRow[];
}

export function addServer(name: string, pelicanId: string, pluginDir: string): void {
  db.prepare("INSERT OR IGNORE INTO servers (name, pelican_id, plugin_dir) VALUES (?, ?, ?)").run(
    name,
    pelicanId,
    pluginDir,
  );
}

export function deleteServer(id: number): void {
  db.prepare("DELETE FROM servers WHERE id = ?").run(id);
}

// --- Plugins ---

export function listPlugins(): PluginRow[] {
  return db
    .prepare("SELECT * FROM plugins ORDER BY COALESCE(name, ref) COLLATE NOCASE")
    .all() as unknown as PluginRow[];
}

function writePluginServers(pluginId: number, serverIds: number[]): void {
  db.prepare("DELETE FROM plugin_servers WHERE plugin_id = ?").run(pluginId);
  const insert = db.prepare("INSERT OR IGNORE INTO plugin_servers (plugin_id, server_id) VALUES (?, ?)");
  for (const serverId of serverIds) insert.run(pluginId, serverId);
}

export function addPlugin(plugin: NewPlugin, serverIds: number[]): void {
  transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO plugins (source, ref, asset_pattern, loaders, game_version, auto_update, stable_only)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        plugin.source,
        plugin.ref,
        plugin.asset_pattern,
        plugin.loaders,
        plugin.game_version,
        plugin.auto_update ? 1 : 0,
        plugin.stable_only ? 1 : 0,
      );
    writePluginServers(Number(result.lastInsertRowid), serverIds);
  });
}

export function setPluginServers(pluginId: number, serverIds: number[]): void {
  transaction(() => writePluginServers(pluginId, serverIds));
}

export function pluginServerIds(pluginId: number): number[] {
  const rows = db.prepare("SELECT server_id FROM plugin_servers WHERE plugin_id = ?").all(pluginId) as unknown as {
    server_id: number;
  }[];
  return rows.map((row) => row.server_id);
}

export function serversForPlugin(pluginId: number): ServerRow[] {
  return db
    .prepare(
      `SELECT s.* FROM servers s
       JOIN plugin_servers ps ON ps.server_id = s.id
       WHERE ps.plugin_id = ?`,
    )
    .all(pluginId) as unknown as ServerRow[];
}

export function deletePlugin(id: number): void {
  db.prepare("DELETE FROM plugins WHERE id = ?").run(id);
}

export function setAutoUpdate(id: number, enabled: boolean): void {
  db.prepare("UPDATE plugins SET auto_update = ? WHERE id = ?").run(enabled ? 1 : 0, id);
}

export function markChecked(id: number, error: string | null): void {
  db.prepare("UPDATE plugins SET last_checked = datetime('now'), last_error = ? WHERE id = ?").run(error, id);
}

export function setPluginRelease(id: number, name: string, version: string): void {
  db.prepare("UPDATE plugins SET name = ?, current_version = ?, last_error = NULL WHERE id = ?").run(name, version, id);
}

// --- Deployments ---

export function logDeployment(entry: Omit<DeploymentRow, "id" | "created_at">): void {
  db.prepare(
    `INSERT INTO deployments (server_id, server_name, plugin_name, version, file_name, removed, status, message, trigger)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.server_id,
    entry.server_name,
    entry.plugin_name,
    entry.version,
    entry.file_name,
    entry.removed,
    entry.status,
    entry.message,
    entry.trigger,
  );
}

export function listDeployments(limit = 200): DeploymentRow[] {
  return db.prepare("SELECT * FROM deployments ORDER BY id DESC LIMIT ?").all(limit) as unknown as DeploymentRow[];
}

// --- Dashboard ---

export interface DashboardStats {
  servers: number;
  plugins: number;
  autoUpdate: number;
  deploysToday: number;
  errors24h: number;
  lastCheck: string | null;
}

function count(sql: string): number {
  return Number((db.prepare(sql).get() as { n: number | bigint }).n);
}

export function dashboardStats(): DashboardStats {
  const lastCheck = db.prepare("SELECT MAX(last_checked) AS t FROM plugins").get() as { t: string | null };
  return {
    servers: count("SELECT COUNT(*) AS n FROM servers"),
    plugins: count("SELECT COUNT(*) AS n FROM plugins"),
    autoUpdate: count("SELECT COUNT(*) AS n FROM plugins WHERE auto_update = 1"),
    deploysToday: count(
      "SELECT COUNT(*) AS n FROM deployments WHERE status = 'success' AND date(created_at) = date('now')",
    ),
    errors24h: count(
      "SELECT COUNT(*) AS n FROM deployments WHERE status = 'error' AND created_at >= datetime('now', '-1 day')",
    ),
    lastCheck: lastCheck.t,
  };
}

export function pluginsWithErrors(): PluginRow[] {
  return db
    .prepare("SELECT * FROM plugins WHERE last_error IS NOT NULL ORDER BY COALESCE(name, ref) COLLATE NOCASE")
    .all() as unknown as PluginRow[];
}
