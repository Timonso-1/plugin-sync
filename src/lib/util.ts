export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function splitList(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

const TIME_ZONE = process.env.TZ_DISPLAY ?? "Europe/Berlin";

/** SQLite liefert UTC als "YYYY-MM-DD HH:MM:SS" ohne Zeitzone. */
export function parseSqliteDate(value: string): Date {
  return new Date(`${value.replace(" ", "T")}Z`);
}

export function formatDateTime(value: string | null): string {
  if (!value) return "-";
  return parseSqliteDate(value).toLocaleString("de-DE", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(value: string | null): string {
  if (!value) return "nie";
  const minutes = Math.round((Date.now() - parseSqliteDate(value).getTime()) / 60_000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  return formatDateTime(value);
}

export function formatToday(): string {
  return new Date().toLocaleDateString("de-DE", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
