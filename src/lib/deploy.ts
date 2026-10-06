import { logDeployment, type ServerRow } from "./db";
import { readPluginMeta, type PluginMeta } from "./jar";
import { deleteFiles, downloadFile, listFiles, power, uploadFile, type PelicanFile } from "./pelican";
import { errorMessage } from "./util";

export interface JarPackage {
  meta: PluginMeta;
  fileName: string;
  data: Buffer;
}

export type OutcomeStatus = "success" | "skipped" | "error";

export interface PluginOutcome {
  plugin: string;
  status: OutcomeStatus;
  message?: string;
}

export interface ServerResult {
  serverId: number;
  server: string;
  outcomes: PluginOutcome[];
  restarted: boolean;
  error?: string;
}

export interface DeployOptions {
  restart: boolean;
  trigger: "manual" | "auto";
}

// Über globalThis, damit Server Actions und der Scheduler denselben Cache nutzen
const globalForCache = globalThis as unknown as { pluginSyncMetaCache?: Map<string, PluginMeta | null> };
const metaCache = (globalForCache.pluginSyncMetaCache ??= new Map());

function joinPath(directory: string, name: string): string {
  return `${directory.replace(/\/+$/, "")}/${name}`;
}

async function existingMeta(server: ServerRow, file: PelicanFile): Promise<PluginMeta | null> {
  const filePath = joinPath(server.plugin_dir, file.name);
  const key = `${server.pelican_id}:${filePath}:${file.size}:${file.modified_at}`;
  if (metaCache.has(key)) return metaCache.get(key) ?? null;

  const meta = await readPluginMeta(await downloadFile(server.pelican_id, filePath));
  metaCache.set(key, meta);
  return meta;
}

export function deployToServers(servers: ServerRow[], jars: JarPackage[], options: DeployOptions): Promise<ServerResult[]> {
  return Promise.all(servers.map((server) => deployToServer(server, jars, options)));
}

async function deployToServer(server: ServerRow, jars: JarPackage[], options: DeployOptions): Promise<ServerResult> {
  const result: ServerResult = { serverId: server.id, server: server.name, outcomes: [], restarted: false };

  const record = (jar: JarPackage, status: OutcomeStatus, extra: { removed?: string[]; message?: string } = {}) => {
    logDeployment({
      server_id: server.id,
      server_name: server.name,
      plugin_name: jar.meta.name,
      version: jar.meta.version,
      file_name: jar.fileName,
      removed: extra.removed?.length ? extra.removed.join(", ") : null,
      status,
      message: extra.message ?? null,
      trigger: options.trigger,
    });
    result.outcomes.push({ plugin: jar.meta.name, status, message: extra.message });
  };

  let installed: { file: PelicanFile; meta: PluginMeta | null }[];
  try {
    const files = (await listFiles(server.pelican_id, server.plugin_dir)).filter(
      (file) => file.is_file && file.name.toLowerCase().endsWith(".jar"),
    );
    installed = await Promise.all(files.map(async (file) => ({ file, meta: await existingMeta(server, file) })));
  } catch (error) {
    result.error = errorMessage(error);
    for (const jar of jars) record(jar, "error", { message: `Plugin-Ordner nicht lesbar: ${result.error}` });
    return result;
  }

  for (const jar of jars) {
    const key = jar.meta.name.toLowerCase();
    const matches = installed.filter((entry) => entry.meta?.name.toLowerCase() === key);

    const identical =
      matches.length === 1 &&
      matches[0].meta?.version === jar.meta.version &&
      matches[0].file.size === jar.data.length;
    if (identical) {
      record(jar, "skipped", { message: "Gleiche Version bereits installiert" });
      continue;
    }

    const toDelete = matches.map((entry) => entry.file.name);
    try {
      if (toDelete.length) await deleteFiles(server.pelican_id, server.plugin_dir, toDelete);
      await uploadFile(server.pelican_id, server.plugin_dir, jar.fileName, jar.data);
      record(jar, "success", { removed: toDelete });
    } catch (error) {
      record(jar, "error", { removed: toDelete, message: errorMessage(error) });
    }
  }

  if (options.restart && result.outcomes.some((outcome) => outcome.status === "success")) {
    try {
      await power(server.pelican_id, "restart");
      result.restarted = true;
    } catch (error) {
      result.error = `Neustart fehlgeschlagen: ${errorMessage(error)}`;
    }
  }

  return result;
}
