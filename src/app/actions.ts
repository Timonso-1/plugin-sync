"use server";

import { revalidatePath } from "next/cache";
import * as store from "@/lib/db";
import { deployToServers, type JarPackage, type ServerResult } from "@/lib/deploy";
import { readPluginMeta } from "@/lib/jar";
import { requireUser } from "@/lib/session";
import { runUpdateCheck, type UpdateSummary } from "@/lib/updater";
import { errorMessage } from "@/lib/util";

export type FormState = { error?: string; ok?: string } | null;
export type DeployState = { error?: string; results?: ServerResult[] } | null;
export type UpdateState = { error?: string; summary?: UpdateSummary } | null;

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function ids(form: FormData, key: string): number[] {
  return form
    .getAll(key)
    .map(Number)
    .filter((value) => Number.isInteger(value));
}

function refreshAll() {
  revalidatePath("/", "layout");
}

// --- Deploy ---

export async function deployUpload(_previous: DeployState, form: FormData): Promise<DeployState> {
  await requireUser();

  const files = form.getAll("jars").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const serverIds = ids(form, "servers");
  if (!files.length) return { error: "Keine JAR ausgewählt." };
  if (!serverIds.length) return { error: "Kein Server ausgewählt." };

  const jars: JarPackage[] = [];
  for (const file of files) {
    const data = Buffer.from(await file.arrayBuffer());
    const meta = await readPluginMeta(data);
    if (!meta) return { error: `${file.name}: keine plugin.yml, paper-plugin.yml oder velocity-plugin.json gefunden.` };
    if (jars.some((jar) => jar.meta.name.toLowerCase() === meta.name.toLowerCase())) {
      return { error: `Plugin "${meta.name}" ist mehrfach ausgewählt.` };
    }
    jars.push({ meta, fileName: file.name, data });
  }

  const servers = store.listServers().filter((server) => serverIds.includes(server.id));
  const results = await deployToServers(servers, jars, { restart: form.get("restart") === "on", trigger: "manual" });

  refreshAll();
  return { results };
}

// --- Server ---

export async function addServer(_previous: FormState, form: FormData): Promise<FormState> {
  await requireUser();
  const name = text(form, "name");
  const pelicanId = text(form, "pelican_id");
  if (!name || !pelicanId) return { error: "Name und Pelican-ID sind Pflicht." };
  if (store.listServers().some((server) => server.pelican_id === pelicanId)) {
    return { error: "Dieser Server ist bereits angelegt." };
  }
  store.addServer(name, pelicanId, text(form, "plugin_dir") || "/plugins");
  refreshAll();
  return { ok: `${name} hinzugefügt.` };
}

export async function importServer(name: string, pelicanId: string) {
  await requireUser();
  store.addServer(name, pelicanId, "/plugins");
  refreshAll();
}

export async function removeServer(id: number) {
  await requireUser();
  store.deleteServer(id);
  refreshAll();
}

// --- Plugins ---

export async function addPlugin(_previous: FormState, form: FormData): Promise<FormState> {
  await requireUser();
  const source = text(form, "source");
  const ref = text(form, "ref");
  const assetPattern = text(form, "asset_pattern");

  if (source !== "github" && source !== "modrinth") return { error: "Unbekannte Quelle." };
  if (!ref) return { error: "Repo bzw. Projekt fehlt." };
  if (source === "github" && !/^[\w.-]+\/[\w.-]+$/.test(ref)) {
    return { error: "GitHub-Repo im Format owner/repo angeben." };
  }
  if (assetPattern) {
    try {
      new RegExp(assetPattern);
    } catch (error) {
      return { error: `Ungültiger Regex: ${errorMessage(error)}` };
    }
  }

  store.addPlugin(
    {
      source,
      ref,
      asset_pattern: source === "github" ? assetPattern || null : null,
      loaders: source === "modrinth" ? text(form, "loaders") || null : null,
      game_version: source === "modrinth" ? text(form, "game_version") || null : null,
      auto_update: form.get("auto_update") === "on",
      stable_only: form.get("stable_only") === "on",
    },
    ids(form, "servers"),
  );
  refreshAll();
  return { ok: `${ref} hinzugefügt. Die Version erscheint nach der ersten Prüfung.` };
}

export async function savePluginServers(id: number, form: FormData) {
  await requireUser();
  store.setPluginServers(id, ids(form, "servers"));
  refreshAll();
}

export async function toggleAutoUpdate(id: number, enabled: boolean) {
  await requireUser();
  store.setAutoUpdate(id, enabled);
  refreshAll();
}

export async function removePlugin(id: number) {
  await requireUser();
  store.deletePlugin(id);
  refreshAll();
}

export async function checkUpdates(_previous: UpdateState): Promise<UpdateState> {
  await requireUser();
  try {
    const summary = await runUpdateCheck();
    refreshAll();
    return { summary };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
