/**
 * Minimaler Client für die Pelican Client-API (Pterodactyl-kompatibel).
 * Benötigt einen Client-API-Key, keinen Application-Key.
 */

export interface PelicanFile {
  name: string;
  size: number;
  is_file: boolean;
  modified_at: string;
}

export interface PelicanServer {
  identifier: string;
  name: string;
}

export type PowerSignal = "start" | "stop" | "restart" | "kill";

const enc = encodeURIComponent;

function config() {
  const url = process.env.PELICAN_URL;
  const key = process.env.PELICAN_API_KEY;
  if (!url || !key) throw new Error("PELICAN_URL oder PELICAN_API_KEY ist nicht gesetzt");
  return { base: `${url.replace(/\/+$/, "")}/api/client`, key };
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const { base, key } = config();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Accept", "application/json");
  if (typeof init.body === "string") headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { ...init, headers, cache: "no-store" });
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : "";
    throw new Error(`Pelican unter ${process.env.PELICAN_URL} nicht erreichbar${cause}`);
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error(`Pelican lehnt den API-Key ab (${response.status}). Client-Key aus dem Kontobereich verwenden.`);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Pelican ${init.method ?? "GET"} ${path} -> ${response.status} ${body.slice(0, 300)}`);
  }
  return response;
}

/** Signierte URLs zeigen direkt auf Wings, nicht auf das Panel. */
async function wingsFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: "no-store" });
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : "";
    throw new Error(`Wings-Node unter ${new URL(url).host} nicht erreichbar${cause}`);
  }
}

async function signedUrl(path: string): Promise<string> {
  const json = (await (await api(path)).json()) as { attributes: { url: string } };
  return json.attributes.url;
}

export async function listPelicanServers(): Promise<PelicanServer[]> {
  const json = (await (await api("")).json()) as { data: { attributes: PelicanServer }[] };
  return json.data.map(({ attributes }) => ({ identifier: attributes.identifier, name: attributes.name }));
}

export async function listFiles(server: string, directory: string): Promise<PelicanFile[]> {
  const json = (await (await api(`/servers/${server}/files/list?directory=${enc(directory)}`)).json()) as {
    data: { attributes: PelicanFile }[];
  };
  return json.data.map(({ attributes }) => attributes);
}

export async function downloadFile(server: string, file: string): Promise<Buffer> {
  const url = await signedUrl(`/servers/${server}/files/download?file=${enc(file)}`);
  const response = await wingsFetch(url);
  if (!response.ok) throw new Error(`Download ${file} -> ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function uploadFile(server: string, directory: string, fileName: string, data: Buffer): Promise<void> {
  const url = await signedUrl(`/servers/${server}/files/upload`);
  const form = new FormData();
  form.append("files", new Blob([new Uint8Array(data)]), fileName);

  const separator = url.includes("?") ? "&" : "?";
  const response = await wingsFetch(`${url}${separator}directory=${enc(directory)}`, { method: "POST", body: form });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Upload ${fileName} -> ${response.status} ${body.slice(0, 300)}`);
  }
}

export async function deleteFiles(server: string, root: string, files: string[]): Promise<void> {
  await api(`/servers/${server}/files/delete`, { method: "POST", body: JSON.stringify({ root, files }) });
}

export async function power(server: string, signal: PowerSignal): Promise<void> {
  await api(`/servers/${server}/power`, { method: "POST", body: JSON.stringify({ signal }) });
}
