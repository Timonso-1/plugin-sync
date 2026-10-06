import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

/**
 * MySQL/MariaDB-Zugriff über einen Connection-Pool.
 * Zeiten werden als UTC gespeichert und als String "YYYY-MM-DD HH:MM:SS" gelesen.
 */

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS servers (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(191) NOT NULL,
    pelican_id  VARCHAR(64)  NOT NULL,
    plugin_dir  VARCHAR(255) NOT NULL DEFAULT '/plugins',
    UNIQUE KEY servers_pelican_id_unique (pelican_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS plugins (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    source           ENUM('github', 'modrinth') NOT NULL,
    ref              VARCHAR(191) NOT NULL,
    asset_pattern    VARCHAR(255) NULL,
    loaders          VARCHAR(191) NULL,
    game_version     VARCHAR(191) NULL,
    name             VARCHAR(191) NULL,
    current_version  VARCHAR(191) NULL,
    auto_update      TINYINT(1) NOT NULL DEFAULT 1,
    stable_only      TINYINT(1) NOT NULL DEFAULT 1,
    last_checked     DATETIME NULL,
    last_error       TEXT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS plugin_servers (
    plugin_id  INT UNSIGNED NOT NULL,
    server_id  INT UNSIGNED NOT NULL,
    PRIMARY KEY (plugin_id, server_id),
    CONSTRAINT plugin_servers_plugin_fk FOREIGN KEY (plugin_id) REFERENCES plugins (id) ON DELETE CASCADE,
    CONSTRAINT plugin_servers_server_fk FOREIGN KEY (server_id) REFERENCES servers (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS deployments (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    server_id    INT UNSIGNED NULL,
    server_name  VARCHAR(191) NOT NULL,
    plugin_name  VARCHAR(191) NOT NULL,
    version      VARCHAR(191) NULL,
    file_name    VARCHAR(255) NULL,
    removed      TEXT NULL,
    status       ENUM('success', 'skipped', 'error') NOT NULL,
    message      TEXT NULL,
    \`trigger\`    ENUM('manual', 'auto') NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY deployments_created_at_index (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

const globalForDb = globalThis as unknown as { pluginSyncPool?: Pool; pluginSyncReady?: Promise<void> };

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ist nicht gesetzt (mysql://user:passwort@host:3306/datenbank)");
  return mysql.createPool({
    uri: url,
    connectionLimit: 10,
    timezone: "Z",
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
  });
}

function pool(): Pool {
  return (globalForDb.pluginSyncPool ??= createPool());
}

async function migrate(): Promise<void> {
  const connection = await pool().getConnection();
  try {
    await connection.query("SET time_zone = '+00:00'");
    for (const statement of SCHEMA) await connection.query(statement);
  } finally {
    connection.release();
  }
}

/** Legt beim ersten Zugriff die Tabellen an. Schlägt die Migration fehl, wird beim nächsten Aufruf erneut versucht. */
function ready(): Promise<void> {
  globalForDb.pluginSyncReady ??= migrate().catch((error) => {
    globalForDb.pluginSyncReady = undefined;
    throw error;
  });
  return globalForDb.pluginSyncReady;
}

type Param = string | number | boolean | null;

async function query<T>(sql: string, params: Param[] = []): Promise<T[]> {
  await ready();
  const [rows] = await pool().query<RowDataPacket[]>(sql, params);
  return rows as unknown as T[];
}

async function execute(sql: string, params: Param[] = [], connection?: PoolConnection): Promise<ResultSetHeader> {
  await ready();
  const [result] = await (connection ?? pool()).query<ResultSetHeader>(sql, params);
  return result;
}

async function transaction(work: (connection: PoolConnection) => Promise<void>): Promise<void> {
  await ready();
  const connection = await pool().getConnection();
  try {
    await connection.beginTransaction();
    await work(connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
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

export function listServers(): Promise<ServerRow[]> {
  return query<ServerRow>("SELECT * FROM servers ORDER BY name");
}

export async function addServer(name: string, pelicanId: string, pluginDir: string): Promise<void> {
  await execute("INSERT IGNORE INTO servers (name, pelican_id, plugin_dir) VALUES (?, ?, ?)", [name, pelicanId, pluginDir]);
}

export async function deleteServer(id: number): Promise<void> {
  await execute("DELETE FROM servers WHERE id = ?", [id]);
}

// --- Plugins ---

export function listPlugins(): Promise<PluginRow[]> {
  return query<PluginRow>("SELECT * FROM plugins ORDER BY COALESCE(name, ref)");
}

async function writePluginServers(connection: PoolConnection, pluginId: number, serverIds: number[]): Promise<void> {
  await execute("DELETE FROM plugin_servers WHERE plugin_id = ?", [pluginId], connection);
  for (const serverId of serverIds) {
    await execute("INSERT IGNORE INTO plugin_servers (plugin_id, server_id) VALUES (?, ?)", [pluginId, serverId], connection);
  }
}

export function addPlugin(plugin: NewPlugin, serverIds: number[]): Promise<void> {
  return transaction(async (connection) => {
    const result = await execute(
      `INSERT INTO plugins (source, ref, asset_pattern, loaders, game_version, auto_update, stable_only)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        plugin.source,
        plugin.ref,
        plugin.asset_pattern,
        plugin.loaders,
        plugin.game_version,
        plugin.auto_update ? 1 : 0,
        plugin.stable_only ? 1 : 0,
      ],
      connection,
    );
    await writePluginServers(connection, result.insertId, serverIds);
  });
}

export function setPluginServers(pluginId: number, serverIds: number[]): Promise<void> {
  return transaction((connection) => writePluginServers(connection, pluginId, serverIds));
}

export async function pluginServerMap(): Promise<Map<number, Set<number>>> {
  const rows = await query<{ plugin_id: number; server_id: number }>("SELECT plugin_id, server_id FROM plugin_servers");
  const map = new Map<number, Set<number>>();
  for (const row of rows) {
    const set = map.get(row.plugin_id) ?? new Set<number>();
    set.add(row.server_id);
    map.set(row.plugin_id, set);
  }
  return map;
}

export function serversForPlugin(pluginId: number): Promise<ServerRow[]> {
  return query<ServerRow>(
    `SELECT s.* FROM servers s
     JOIN plugin_servers ps ON ps.server_id = s.id
     WHERE ps.plugin_id = ?`,
    [pluginId],
  );
}

export async function deletePlugin(id: number): Promise<void> {
  await execute("DELETE FROM plugins WHERE id = ?", [id]);
}

export async function setAutoUpdate(id: number, enabled: boolean): Promise<void> {
  await execute("UPDATE plugins SET auto_update = ? WHERE id = ?", [enabled ? 1 : 0, id]);
}

export async function markChecked(id: number, error: string | null): Promise<void> {
  await execute("UPDATE plugins SET last_checked = UTC_TIMESTAMP(), last_error = ? WHERE id = ?", [error, id]);
}

export async function setPluginRelease(id: number, name: string, version: string): Promise<void> {
  await execute("UPDATE plugins SET name = ?, current_version = ?, last_error = NULL WHERE id = ?", [name, version, id]);
}

// --- Deployments ---

export async function logDeployment(entry: Omit<DeploymentRow, "id" | "created_at">): Promise<void> {
  await execute(
    `INSERT INTO deployments (server_id, server_name, plugin_name, version, file_name, removed, status, message, \`trigger\`, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [
      entry.server_id,
      entry.server_name,
      entry.plugin_name,
      entry.version,
      entry.file_name,
      entry.removed,
      entry.status,
      entry.message,
      entry.trigger,
    ],
  );
}

export function listDeployments(limit = 200): Promise<DeploymentRow[]> {
  return query<DeploymentRow>("SELECT * FROM deployments ORDER BY id DESC LIMIT ?", [limit]);
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

export async function dashboardStats(): Promise<DashboardStats> {
  const [row] = await query<{
    servers: number;
    plugins: number;
    auto_update: number;
    deploys_today: number;
    errors_24h: number;
    last_check: string | null;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM servers) AS servers,
       (SELECT COUNT(*) FROM plugins) AS plugins,
       (SELECT COUNT(*) FROM plugins WHERE auto_update = 1) AS auto_update,
       (SELECT COUNT(*) FROM deployments WHERE status = 'success' AND created_at >= UTC_DATE()) AS deploys_today,
       (SELECT COUNT(*) FROM deployments WHERE status = 'error' AND created_at >= UTC_TIMESTAMP() - INTERVAL 1 DAY) AS errors_24h,
       (SELECT MAX(last_checked) FROM plugins) AS last_check`,
  );
  return {
    servers: Number(row.servers),
    plugins: Number(row.plugins),
    autoUpdate: Number(row.auto_update),
    deploysToday: Number(row.deploys_today),
    errors24h: Number(row.errors_24h),
    lastCheck: row.last_check,
  };
}

export function pluginsWithErrors(): Promise<PluginRow[]> {
  return query<PluginRow>("SELECT * FROM plugins WHERE last_error IS NOT NULL ORDER BY COALESCE(name, ref)");
}
