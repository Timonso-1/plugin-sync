import JSZip from "jszip";
import YAML from "yaml";

export interface PluginMeta {
  /** Eindeutiger Plugin-Name aus der Beschreibungsdatei, dient zum Abgleich alter Versionen. */
  name: string;
  version: string | null;
  kind: "paper" | "bukkit" | "velocity";
}

const YAML_DESCRIPTORS = [
  ["paper-plugin.yml", "paper"],
  ["plugin.yml", "bukkit"],
] as const;

/** Liest Name und Version aus einer Plugin-JAR. Gibt null zurück, wenn keine Beschreibung gefunden wird. */
export async function readPluginMeta(data: Buffer): Promise<PluginMeta | null> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    return null;
  }

  for (const [file, kind] of YAML_DESCRIPTORS) {
    const entry = zip.file(file);
    if (!entry) continue;
    try {
      const doc = YAML.parse(await entry.async("string")) as { name?: unknown; version?: unknown } | null;
      if (doc?.name) {
        return { name: String(doc.name), version: doc.version != null ? String(doc.version) : null, kind };
      }
    } catch {
      // defekte Datei, nächste Beschreibung versuchen
    }
  }

  const velocity = zip.file("velocity-plugin.json");
  if (velocity) {
    try {
      const json = JSON.parse(await velocity.async("string")) as { id?: string; version?: string };
      if (json.id) return { name: json.id, version: json.version ?? null, kind: "velocity" };
    } catch {
      // ignorieren
    }
  }

  return null;
}
