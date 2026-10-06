import type { PluginRow } from "./db";
import { splitList } from "./util";

const USER_AGENT = "Timonso-1/plugin-sync";

export interface ResolvedRelease {
  version: string;
  fileName: string;
  download(): Promise<Buffer>;
}

export function resolveLatest(plugin: PluginRow): Promise<ResolvedRelease> {
  return plugin.source === "github" ? latestGithub(plugin) : latestModrinth(plugin);
}

async function fetchOk(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} bei ${url}`);
  return response;
}

async function toBuffer(response: Response): Promise<Buffer> {
  return Buffer.from(await response.arrayBuffer());
}

// --- GitHub Releases ---

interface GithubAsset {
  id: number;
  name: string;
}

interface GithubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: GithubAsset[];
}

function githubHeaders(accept = "application/vnd.github+json"): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: accept,
    "User-Agent": USER_AGENT,
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function latestGithub(plugin: PluginRow): Promise<ResolvedRelease> {
  let release: GithubRelease | undefined;
  if (plugin.stable_only) {
    // /releases/latest ignoriert Drafts und Pre-Releases
    release = (await (
      await fetchOk(`https://api.github.com/repos/${plugin.ref}/releases/latest`, { headers: githubHeaders() })
    ).json()) as GithubRelease;
  } else {
    const releases = (await (
      await fetchOk(`https://api.github.com/repos/${plugin.ref}/releases?per_page=10`, { headers: githubHeaders() })
    ).json()) as GithubRelease[];
    release = releases.find((candidate) => !candidate.draft);
  }
  if (!release) throw new Error("Keine Releases gefunden");

  const pattern = new RegExp(plugin.asset_pattern || "\\.jar$", "i");
  const asset = release.assets.find(
    (candidate) => pattern.test(candidate.name) && !/-(sources|javadoc)\.jar$/i.test(candidate.name),
  );
  if (!asset) throw new Error(`Release ${release.tag_name} hat kein Asset passend zu /${pattern.source}/`);

  return {
    version: release.tag_name,
    fileName: asset.name,
    // Asset-Endpunkt statt browser_download_url, damit private Repos mit Token funktionieren
    download: async () =>
      toBuffer(
        await fetchOk(`https://api.github.com/repos/${plugin.ref}/releases/assets/${asset.id}`, {
          headers: githubHeaders("application/octet-stream"),
        }),
      ),
  };
}

// --- Modrinth ---

interface ModrinthFile {
  url: string;
  filename: string;
  primary: boolean;
}

interface ModrinthVersion {
  version_number: string;
  version_type: "release" | "beta" | "alpha";
  date_published: string;
  files: ModrinthFile[];
}

async function latestModrinth(plugin: PluginRow): Promise<ResolvedRelease> {
  const params = new URLSearchParams();
  const loaders = splitList(plugin.loaders);
  const gameVersions = splitList(plugin.game_version);
  if (loaders.length) params.set("loaders", JSON.stringify(loaders));
  if (gameVersions.length) params.set("game_versions", JSON.stringify(gameVersions));

  const versions = (await (
    await fetchOk(`https://api.modrinth.com/v2/project/${encodeURIComponent(plugin.ref)}/version?${params}`, {
      headers: { "User-Agent": USER_AGENT },
    })
  ).json()) as ModrinthVersion[];

  const latest = versions
    .filter((version) => !plugin.stable_only || version.version_type === "release")
    .sort((a, b) => b.date_published.localeCompare(a.date_published))[0];
  if (!latest) {
    throw new Error(
      `Keine passende ${plugin.stable_only ? "stabile " : ""}Version auf Modrinth gefunden (Loader/Spielversion prüfen)`,
    );
  }

  const file = latest.files.find((candidate) => candidate.primary) ?? latest.files[0];
  if (!file) throw new Error(`Version ${latest.version_number} hat keine Datei`);

  return {
    version: latest.version_number,
    fileName: file.filename,
    download: async () => toBuffer(await fetchOk(file.url, { headers: { "User-Agent": USER_AGENT } })),
  };
}
