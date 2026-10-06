import { listPlugins, markChecked, serversForPlugin, setPluginRelease, type ServerRow } from "./db";
import { deployToServers, type JarPackage } from "./deploy";
import { readPluginMeta } from "./jar";
import { resolveLatest } from "./sources";
import { errorMessage } from "./util";

export interface UpdateSummary {
  checked: number;
  updated: string[];
  failed: string[];
  skipped?: boolean;
}

// Lock über globalThis, da Scheduler und Server Actions in getrennten Bundles laufen können
const globalForLock = globalThis as unknown as { pluginSyncUpdating?: boolean };

/**
 * Prüft alle Plugins mit Auto-Update auf neue Releases und deployt sie.
 * Pro Server wird gesammelt deployt, damit jeder Server nur einmal neu startet.
 */
export async function runUpdateCheck(): Promise<UpdateSummary> {
  if (globalForLock.pluginSyncUpdating) return { checked: 0, updated: [], failed: [], skipped: true };
  globalForLock.pluginSyncUpdating = true;

  try {
    const plugins = (await listPlugins()).filter((plugin) => plugin.auto_update);
    const perServer = new Map<number, { server: ServerRow; jars: JarPackage[] }>();
    const pending: { pluginId: number; jar: JarPackage; version: string }[] = [];
    const failed: string[] = [];

    for (const plugin of plugins) {
      try {
        const release = await resolveLatest(plugin);
        if (release.version === plugin.current_version) {
          await markChecked(plugin.id, null);
          continue;
        }

        const servers = await serversForPlugin(plugin.id);
        if (!servers.length) {
          await markChecked(plugin.id, "Keine Server zugewiesen");
          continue;
        }

        const data = await release.download();
        const meta = await readPluginMeta(data);
        if (!meta) throw new Error(`${release.fileName} enthält keine plugin.yml, paper-plugin.yml oder velocity-plugin.json`);

        const jar: JarPackage = { meta, fileName: release.fileName, data };
        for (const server of servers) {
          const entry = perServer.get(server.id) ?? { server, jars: [] };
          entry.jars.push(jar);
          perServer.set(server.id, entry);
        }
        pending.push({ pluginId: plugin.id, jar, version: release.version });
        await markChecked(plugin.id, null);
      } catch (error) {
        await markChecked(plugin.id, errorMessage(error));
        failed.push(plugin.name ?? plugin.ref);
      }
    }

    const results = (
      await Promise.all(
        [...perServer.values()].map(({ server, jars }) =>
          deployToServers([server], jars, { restart: true, trigger: "auto" }),
        ),
      )
    ).flat();

    const updated: string[] = [];
    for (const { pluginId, jar, version } of pending) {
      const outcomes = results.flatMap((result) => result.outcomes.filter((outcome) => outcome.plugin === jar.meta.name));
      if (outcomes.every((outcome) => outcome.status !== "error")) {
        await setPluginRelease(pluginId, jar.meta.name, version);
        updated.push(jar.meta.name);
      } else {
        // Version bleibt alt, damit der nächste Lauf es erneut versucht
        await markChecked(pluginId, "Deploy auf mindestens einem Server fehlgeschlagen, siehe Verlauf");
        failed.push(jar.meta.name);
      }
    }

    return { checked: plugins.length, updated, failed };
  } finally {
    globalForLock.pluginSyncUpdating = false;
  }
}
